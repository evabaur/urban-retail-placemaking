import { all, one, runtime, check, passwordHash, now, User, RecordRow, getRecord, save } from './server';

const prefix = (id: string) => 'sandbox:' + id;
// Owner-triggered, resumable copy. Never modifies the archive or live course.
export async function prepareHistoricalDemo(body: any) {
  if (await getRecord('sandbox:ready', 'meta', 'sandbox')) return {ok:true, ready:true};
  if (body.phase === 'accounts') {
    check(typeof body.password === 'string' && body.password.length >= 16, 'Use a demo password of at least 16 characters.');
    const people = await all<User>("SELECT * FROM users WHERE course='archive' AND role='student' ORDER BY id");
    check(people.length, 'Import the historical archive first.');
    const candidate = await one<{owner:string}>("SELECT a.owner FROM records a JOIN users u ON a.owner=u.id LEFT JOIN records r ON r.parent=a.id AND r.kind='review' WHERE a.course='archive' AND a.kind='allocation' AND u.group_id IS NOT NULL GROUP BY a.owner ORDER BY COUNT(r.id) DESC,COUNT(a.id) DESC,a.owner LIMIT 1");
    const primary = people.find(p => p.id === candidate?.owner) || people[0];
    const password = await passwordHash(body.password);
    const rows = people.map(p => runtime().DB.prepare("INSERT OR IGNORE INTO users(id,uni,name,role,course,group_id,password,must_change,disabled) VALUES(?,?,?,'student','sandbox',?,?,0,1)").bind(prefix(p.id), p.id === primary.id ? 'demo-student' : 'demo-' + p.uni.replace(/^archive-/, ''), p.name, p.group_id ? prefix(p.group_id) : null, password));
    rows.push(runtime().DB.prepare("INSERT OR IGNORE INTO users(id,uni,name,role,course,password,must_change,disabled) VALUES('sandbox:admin','demo-admin','Demo teaching team','staff','sandbox',?,0,1)").bind(password));
    await runtime().DB.batch(rows);
    return {ok:true, students:people.length, primary:primary.name};
  }
  if (body.phase === 'records') {
    const offset = Number(body.offset || 0);
    check(Number.isInteger(offset) && offset >= 0 && offset < 10000, 'Invalid cursor.');
    const references = await all<{id:string}>("SELECT id FROM records WHERE course='archive' UNION SELECT id FROM users WHERE course='archive'");
    const ids = new Set(references.map(r=>r.id));
    const remap = (v:any):any => typeof v === 'string' ? (ids.has(v) ? prefix(v) : v) : Array.isArray(v) ? v.map(remap) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k,x])=>[k,remap(x)])) : v;
    const rows = await all<RecordRow>("SELECT * FROM records WHERE course='archive' ORDER BY id LIMIT 25 OFFSET ?",offset);
    if (rows.length) await runtime().DB.batch(rows.map(r=>{
      const data = remap(JSON.parse(r.data));
      data.demoCopy = true;
      if(r.kind === 'assignment') data.published = true;
      return runtime().DB.prepare("INSERT OR IGNORE INTO records(id,kind,course,owner,group_id,parent,data,updated) VALUES(?,?,'sandbox',?,?,?,?,?)").bind(prefix(r.id),r.kind,r.owner?prefix(r.owner):null,r.group_id?prefix(r.group_id):null,r.parent?prefix(r.parent):null,JSON.stringify(data),now());
    }));
    return {ok:true,copied:rows.length,next:offset+rows.length,done:rows.length<25};
  }
  check(body.phase === 'finish', 'Invalid preparation phase.');
  const source = await one<{n:number}>("SELECT COUNT(*) n FROM records WHERE course='archive'");
  const dest = await one<{n:number}>("SELECT COUNT(*) n FROM records WHERE course='sandbox'");
  check(source && dest && source.n === dest.n && source.n > 0, 'Snapshot is incomplete. Resume copying first.');
  const students = await one<{n:number}>("SELECT COUNT(*) n FROM users WHERE course='archive' AND role='student'");
  const copied = await one<{n:number}>("SELECT COUNT(*) n FROM users WHERE course='sandbox'");
  check(copied?.n === (students?.n || 0)+1, 'Demo accounts are incomplete.');
  await runtime().DB.batch([
    runtime().DB.prepare("INSERT INTO records(id,kind,course,data,updated) VALUES('sandbox:ready','meta','sandbox',?,?)").bind(JSON.stringify({title:'FA2025 historical demo',source:'Historical submissions; copied development scores/attendance are simulations.',records:source.n}),now()),
    runtime().DB.prepare("UPDATE users SET disabled=0 WHERE course='sandbox'")
  ]);
  return {ok:true,ready:true,records:source.n,students:students?.n};
}

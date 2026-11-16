// Two independent demo sessions stand in for phone and desktop. No Canvas writes.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {join} from 'node:path';
const origin='https://app.example.com';
const password=JSON.parse(readFileSync(join(homedir(),'.urp_app/historical-demo-access.json'),'utf8')).password;
const cookies=[];
async function call(path,body,cookie='',expected=200){
 const r=await fetch(origin+'/api/'+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(55000)});
 const d=await r.json();assert.equal(r.status,expected,path+' '+JSON.stringify(d).slice(0,140));const next=r.headers.getSetCookie().find(s=>s.startsWith('urp_session='))?.split(';')[0];if(next)cookies.push(next);return {d,cookie:next||cookie};
}
const path='trek/notes?course=sandbox&trek=independent';
try{
 const phone=(await call('login',{uni:'demo-student',password})).cookie;
 const desktop=(await call('login',{uni:'demo-student',password})).cookie;
 const staff=(await call('login',{uni:'demo-admin',password})).cookie;assert.notEqual(phone,desktop);
 await call(path,undefined,'',401);await call('trek/notes?course=live&trek=independent',undefined,phone,403);
 const old=(await call(path,undefined,phone)).d;
 if(old.draft.notes?.other&&!old.draft.notes.other.startsWith('DEMO TEST'))throw Error('Non-test work in target field; refusing to overwrite.');
 const photo='data:image/png;base64,'+readFileSync(join(homedir(),'.urp_app/vpa-hosted-proof-1.png')).toString('base64');
 const d={...old.draft,notes:{...old.draft.notes,other:'DEMO TEST - saved on phone, opened on desktop. Cloud sync '+Date.now()}};
 if(!d.notes.roles)d.notes.roles='DEMO TEST - cloud trek roles import into VPA4.';
 if(!d.notePhotos?.length)d.notePhotos=[photo];
 const saved=(await call(path,{draft:d,revision:old.revision},phone)).d;assert(saved.backedUp);
 const read=(await call(path,undefined,desktop)).d;assert.deepEqual(read.draft,saved.draft);assert.equal(read.revision,old.revision+1);
 await call(path,{draft:d,revision:old.revision},desktop,409);
 const alien=(await call(path,undefined,staff)).d;assert.notEqual(alien.draft.notes?.other,d.notes.other);
 const img=saved.draft.notePhotos[0];assert(img.startsWith('/api/trek/photo?'));
 for(const [cookie,status] of [[desktop,200],[staff,404],['',401]]){const r=await fetch(origin+img,{headers:{Cookie:cookie},signal:AbortSignal.timeout(30000)});assert.equal(r.status,status);if(status===200)assert((await r.arrayBuffer()).byteLength>100);}
 await call(path,{draft:{...d,notePhotos:['https://example.com/image.png']},revision:saved.revision},phone,413);
 await call('backup?course=sandbox',{},phone,403);
 const backup=(await call('backup?course=sandbox',{},staff)).d;assert(backup.records>0);
 const restored=(await call('backup?course=sandbox&download=1',undefined,staff)).d;
 assert(restored.records.some(r=>r.kind==='trek-notes'&&JSON.parse(r.data).revision===saved.revision));
 assert(restored.records.some(r=>r.kind==='review'));assert(restored.records.some(r=>r.kind==='vpa-package'));
 assert(restored.people.every(p=>!('password' in p)));assert(!restored.records.some(r=>r.kind==='vpa-transfer'));
 console.log('PASS two independent demo sessions: text/photo persisted, revision increment, stale-save rejection, account/course/anonymous isolation, untrusted photo URL rejected.');
 console.log('PASS private R2 course backup readback: notes pointers, reviews, VPA packages and roster; no passwords or transfer tokens.');
 console.log('No Canvas submissions, grades or invitations sent.');
}finally{for(const cookie of cookies)await call('logout',{},cookie).catch(()=>{});}

import {runtime,check,hash,now,uid,getRecord,run,User} from './server';
import {emptyDraft,FieldDraft} from './trek-storage';
import {TREKS} from './trek-plan';

const json=(value:unknown)=>Response.json(value,{headers:{'Cache-Control':'no-store'}});
// Each committed revision points to an immutable private R2 snapshot. Photos are
// content-addressed within the account; no public URLs or client-supplied owners.
export async function handleTrekCloud(req:Request,u:User,course:string,path:string){
 check(['live','demo','sandbox'].includes(course),'Notebook unavailable.',403);
 const url=new URL(req.url),trek=url.searchParams.get('trek')||'';
 check([...TREKS.map(t=>t.id),'independent'].includes(trek),'Unknown trek.',404);
 const scope=await hash(JSON.stringify([course,u.id,trek])),prefix=`trek/${course}/${scope}`;
 if(path==='trek/photo'&&req.method==='GET'){
  const id=url.searchParams.get('photo')||'';check(/^[a-f0-9]{64}$/.test(id),'Not found.',404);
  const object=await runtime().BUCKET.get(`${prefix}/photos/${id}`);check(object,'Not found.',404);
  return new Response(object.body,{headers:{'Content-Type':object.httpMetadata?.contentType||'image/jpeg','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }
 check(path==='trek/notes','Not found.',404);
 const id=`trek-notes:${course}:${u.id}:${trek}`,record=await getRecord(id,'trek-notes',course);
 if(req.method==='GET'){
  if(!record)return json({draft:emptyDraft(),revision:0});
  const object=await runtime().BUCKET.get(record.key);check(object,'Notebook snapshot unavailable. Please contact the teaching team.',503);
  return json({draft:await object.json(),revision:record.revision,backedUp:true});
 }
 check(req.method==='POST','Method not allowed.',405);
 const raw=await req.text();check(raw.length<=16*1024*1024,'Notebook exceeds 16 MB. Remove some photos.',413);
 const b=JSON.parse(raw);check(Number.isSafeInteger(b.revision)&&b.revision>=0,'Invalid revision.');
 check((record?.revision||0)===b.revision,'This notebook changed on another device. Download your copy, then load the cloud version.',409);
 function fields(value:any){check(value&&typeof value==='object'&&!Array.isArray(value),'Invalid notes.');const entries=Object.entries(value);check(entries.length<=100,'Too many fields.');for(const [k,v] of entries)check(/^[a-zA-Z0-9_]+$/.test(k)&&typeof v==='string'&&v.length<=20000,'Each note must be under 20,000 characters.');return Object.fromEntries(entries) as Record<string,string>;}
 let count=0;
 async function photo(p:unknown){
  check(typeof p==='string'&&++count<=36,'Too many photos.');
  if(p.startsWith('/api/trek/photo?')){const x=new URL(p,url.origin);check(x.searchParams.get('course')===course&&x.searchParams.get('trek')===trek,'Wrong notebook photo.');const h=x.searchParams.get('photo')||'';check(/^[a-f0-9]{64}$/.test(h)&&await runtime().BUCKET.head(`${prefix}/photos/${h}`),'Photo not found.',404);return p;}
  check(/^data:image\/(jpeg|png);base64,/.test(p)&&p.length<=3*1024*1024,'Use a JPEG or PNG under 2 MB.',413);
  const content=p.split(',')[1],bytes=Uint8Array.from(atob(content),c=>c.charCodeAt(0));
  const png=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71,jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;check(png||jpeg,'Invalid image.');
  const h=await hash(content),key=`${prefix}/photos/${h}`;
  if(!await runtime().BUCKET.head(key))await runtime().BUCKET.put(key,bytes,{httpMetadata:{contentType:png?'image/png':'image/jpeg'}});
  const copy=`file-backups/${course}/trek/${scope}/${h}`;if(!await runtime().BUCKET.head(copy))await runtime().BUCKET.put(copy,bytes,{httpMetadata:{contentType:png?'image/png':'image/jpeg'}});
  return `/api/trek/photo?course=${course}&trek=${trek}&photo=${h}`;
 }
 async function photos(v:any){check(Array.isArray(v)&&v.length<=12,'Up to 12 photos per notebook.');const out=[];for(const p of v)out.push(await photo(p));return out;}
 const source=b.draft;check(source&&Array.isArray(source.stores)&&source.stores.length<=12,'Invalid notebook.');
 const d:FieldDraft={fields:fields(source.fields||{}),stores:[],notes:fields(source.notes||{}),updated:now()};
 for(const s of source.stores){check(typeof s.id==='string'&&s.id.length<200,'Invalid legacy entry.');d.stores.push({id:s.id,fields:fields(s.fields||{}),photos:await photos(s.photos||[])});}
 if(source.notePhotos!==undefined)d.notePhotos=await photos(source.notePhotos);
 const revision=b.revision+1,key=`${prefix}/versions/${revision}-${uid()}.json`;
 // Write-ahead snapshot: a successful DB commit can never point to missing backup.
 await runtime().BUCKET.put(key,JSON.stringify(d),{httpMetadata:{contentType:'application/json'},customMetadata:{owner:u.id,course,trek,revision:String(revision)}});
 const data=JSON.stringify({revision,key,trek});
 const r=b.revision===0?await run('INSERT OR IGNORE INTO records(id,kind,course,owner,data,updated) VALUES(?,?,?,?,?,?)',id,'trek-notes',course,u.id,data,now()):await run("UPDATE records SET data=?,updated=? WHERE id=? AND course=? AND owner=? AND json_extract(data,'$.revision')=?",data,now(),id,course,u.id,b.revision);
 check(r.meta.changes===1,'This notebook changed on another device. Download your copy, then load the cloud version.',409);
 return json({draft:d,revision,backedUp:true});
}

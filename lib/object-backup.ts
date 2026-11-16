import {all,runtime,now,uid,User,check} from './server';
// Private, immutable course snapshots. Authentication material is never exported.
// Attachment bodies and notebook history already reside in private versioned R2 keys.
export async function backupCourse(course:string){
 const records=await all("SELECT * FROM records WHERE course=? AND kind NOT IN ('vpa-transfer')",course);
 const people=await all('SELECT id,uni,name,role,course,group_id,disabled,canvas_id,email FROM users WHERE course=?',course);
 const created=now(),key=`backups/${course}/${created.replaceAll(':','-')}-${uid()}.json`;
 const audit=await all("SELECT * FROM audit WHERE actor IN (SELECT id FROM users WHERE course=?) OR (actor='system:canvas-sync' AND json_valid(target) AND json_extract(target,'$.course')=?) ORDER BY at",course,course);
 let previous:any={files:[]};const pointer=await runtime().BUCKET.get(`backups/${course}/latest.json`);
 if(pointer){const meta:any=await pointer.json();const old=await runtime().BUCKET.get(meta.key);if(old)previous=await old.json();}
 const files=[];
 for(const row of records){const data=JSON.parse(String(row.data));if(typeof data.key!=='string'||!['vpa-file','file','canvas-test-file','canvas-file','asset'].includes(String(row.kind)))continue;
  const source=data.key,backupKey=`file-backups/${course}/${row.id}`;
  const known=previous.files?.find((f:any)=>f.record===row.id&&f.source===source);if(known){files.push(known);continue;}
  let copy=await runtime().BUCKET.head(backupKey);
  if(!copy){const original=await runtime().BUCKET.get(source);check(original,'A stored file is missing; backup incomplete.',503);await runtime().BUCKET.put(backupKey,original.body,{httpMetadata:original.httpMetadata});copy=await runtime().BUCKET.head(backupKey);check(copy&&copy.size===original.size,'File backup verification failed.',503);}
  files.push({record:row.id,source,key:backupKey,size:copy.size});
 }
 const snapshot={schema:2,course,created,people,records,audit,files};
 await runtime().BUCKET.put(key,JSON.stringify(snapshot),{httpMetadata:{contentType:'application/json'}});
 const metadata={key,created,records:records.length,people:people.length,audit:audit.length,files:files.length};
 await runtime().BUCKET.put(`backups/${course}/latest.json`,JSON.stringify(metadata));return metadata;
}
export async function handleBackup(req:Request,u:User,course:string){
 check(u.role==='staff','Staff only.',403);
 if(req.method==='POST')return Response.json(await backupCourse(course),{headers:{'Cache-Control':'no-store'}});
 const pointer=await runtime().BUCKET.get(`backups/${course}/latest.json`);check(pointer,'No backup yet.',404);
 const metadata=await pointer.json() as {key:string};
 const file=new URL(req.url).searchParams.get('file');
 if(file){const snapshot=await runtime().BUCKET.get(metadata.key);check(snapshot,'Backup unavailable.',404);const data:any=await snapshot.json();const item=data.files?.find((f:any)=>f.record===file);check(item,'File backup not found.',404);const obj=await runtime().BUCKET.get(item.key);check(obj&&obj.size===item.size,'File backup failed verification.',503);return new Response(obj.body,{headers:{'Content-Type':'application/octet-stream','Cache-Control':'no-store','Content-Disposition':'attachment; filename="backup-copy"'}});}
 if(new URL(req.url).searchParams.get('download')==='1'){
  const obj=await runtime().BUCKET.get(metadata.key);check(obj,'Backup not found.',404);
  return new Response(obj.body,{headers:{'Content-Type':'application/json','Content-Disposition':'attachment; filename="urp-course-backup.json"','Cache-Control':'no-store'}});
 }
 return Response.json(metadata,{headers:{'Cache-Control':'no-store'}});
}

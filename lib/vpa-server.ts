import {all,one,run,save,getRecord,unpack,runtime,check,uid,now,hash,audit,User,RecordRow} from './server';
import {VPAS,vpaById,freshVpa,packageErrors,fileSpec,validSignature,VpaDraft,Vpa} from './vpa';
import {createVpaPdf} from './vpa-pdf';
import {allowedCanvasTest,CANVAS_TEST_USER,CANVAS_TEST_ASSIGNMENT,CANVAS_TEST_VPA} from './canvas-test';
type Actor=User&{actor?:string|null};
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const draftId=(c:string,u:string,v:string)=>`vpa-draft:${c}:${u}:${v}`;
async function own(id:string,kind:string,course:string,u:Actor){const r=await getRecord(id,kind,course);check(r&&r.owner===u.id,'Not found.',404);return r;}
async function draft(course:string,u:Actor,v:Vpa){const r=await getRecord(draftId(course,u.id,v.id),'vpa-draft',course);return r?{revision:r.revision,includeNotes:r.includeNotes,answers:r.answers,photos:r.photos,ppt:r.ppt,video:r.video,importedFrom:r.importedFrom}:freshVpa();}
async function fileCheck(id:string,course:string,u:Actor,vpa:string,kind:string){const f=await own(id,'vpa-file',course,u);check(f.vpa===vpa&&f.fileKind===kind,'Wrong attachment for this assignment.');return f;}
async function relay(body:unknown){
 const e=runtime();check(e.CANVAS_RELAY_URL==='https://relay.example.com'&&e.CANVAS_RELAY_KEY,'Canvas transport unavailable.',503);
 const r=await fetch(e.CANVAS_RELAY_URL+'/v1/vpa',{method:'POST',redirect:'manual',headers:{Authorization:'Bearer '+e.CANVAS_RELAY_KEY,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(55000)});
 check(r.ok,'Canvas transfer failed. Your package is saved; retry to check status.',502);return r.json() as Promise<any>;
}
async function pdfFile(req:Request,v:Vpa,d:VpaDraft,u:Actor,course:string){
 const origin=new URL(req.url).origin;
 check(['https://app.example.com','https://preview.example.com','http://localhost:5173','http://127.0.0.1:5173'].includes(origin),'Unexpected PDF origin.');
 const font=await fetch(origin+'/fonts/NotoSans-Regular.ttf');check(font.ok,'PDF font unavailable.',503);
 const photos=[];
 for(const id of d.photos){const f=await fileCheck(id,course,u,v.id,'photo');const object=await runtime().BUCKET.get(f.key);check(object,'Photo is missing.',409);photos.push({bytes:new Uint8Array(await object.arrayBuffer()),type:f.type,caption:f.name});}
 const bytes=await createVpaPdf(v,d,u.name,u.uni,new Uint8Array(await font.arrayBuffer()),photos,course!=='live');
 const id=uid(),key=`vpa/${course}/${u.id}/${v.id}/${id}.pdf`,name=`${v.id.toUpperCase()}-${u.uni}-Notes.pdf`;
 await runtime().BUCKET.put(key,bytes,{httpMetadata:{contentType:'application/pdf'}});
 await save('vpa-file',course,id,{vpa:v.id,fileKind:'pdf',name,type:'application/pdf',size:bytes.length,key},u.id);
 return id;
}
export async function vpaTransfer(req:Request){
 check(req.method==='GET','Method not allowed.',405);
 const key=runtime().CANVAS_RELAY_KEY;check(key&&await hash(req.headers.get('authorization')||'')===await hash('Bearer '+key),'Unauthorized',401);
 const id=new URL(req.url).searchParams.get('id')||'';const t=await getRecord(id,'vpa-transfer','live')||await getRecord(id,'vpa-transfer','sandbox');
 check(t&&t.expires>Date.now(),'Transfer expired.',403);
 if(t.course==='sandbox'){const config=await getRecord('canvas-test-authorization','meta','sandbox');check(t.owner==='fa26-test-student'&&config?.packageId===t.packageId&&config.expires>Date.now(),'Test transfer is not authorized.',403);}
 const f=await getRecord(t.file,'vpa-file',t.course);check(f&&f.owner===t.owner,'Not found',404);
 const obj=await runtime().BUCKET.get(f.key);check(obj,'Not found',404);
 return new Response(obj.body,{headers:{'Content-Type':f.type,'Content-Length':String(f.size),'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
export async function handleVpa(req:Request,u:Actor,course:string,path:string){
 check(['live','sandbox','demo'].includes(course),'VPA editing is unavailable in the archive.',403);
 const url=new URL(req.url),method=req.method;
 if(path==='vpa'&&method==='GET'){
  // One scoped query instead of twelve round trips. Never fetch other students'
  // private files/drafts, even when the caller is teaching staff.
  const rows=(await all<RecordRow>(`SELECT * FROM records WHERE course=? AND
   ((owner=? AND kind IN ('vpa-file','vpa-package','vpa-draft','submission-status'))
   OR kind='assignment' OR (kind='meta' AND id='fa26-test-source'))`,course,u.id)).map(unpack);
  const files=rows.filter(r=>r.kind==='vpa-file').map(({key,...f})=>f);
  const attempts=rows.filter(r=>r.kind==='vpa-package').sort((a,b)=>b.updated.localeCompare(a.updated)).map(({lock,lockUntil,canvasFiles,...a})=>a);
  const currentTest=course==='sandbox'&&rows.some(r=>r.kind==='meta'&&r.id==='fa26-test-source');
  const definitions=course==='live'||currentTest?VPAS.flatMap(v=>{const a=rows.find(r=>r.kind==='assignment'&&r.id===(currentTest?'fa26-test:':'')+'canvas-assignment-'+v.canvasId);return a&&a.published!==false&&!a.retiredFromCanvas?[{...v,due:a.due||''}]:[];}):VPAS;
  const canvasStatuses=course==='live'||currentTest?rows.filter(r=>r.kind==='submission-status').map(s=>({...s,parent:currentTest?s.parent?.replace(/^fa26-test:/,''):s.parent})):[];
  const drafts=Object.fromEntries(VPAS.map(v=>{const r=rows.find(r=>r.kind==='vpa-draft'&&r.id===draftId(course,u.id,v.id));return [v.id,r?{revision:r.revision,includeNotes:r.includeNotes,answers:r.answers,photos:r.photos,ppt:r.ppt,video:r.video,importedFrom:r.importedFrom}:freshVpa()];}));
  return json({vpas:definitions,canvasStatuses,drafts,files,attempts,demo:course!=='live',liveEnabled:runtime().VPA_CANVAS_SUBMIT_ENABLED==='true'});
 }
 if(path==='vpa/file'&&method==='GET'){
  const f=await own(url.searchParams.get('id')||'','vpa-file',course,u);const o=await runtime().BUCKET.get(f.key);check(o,'File not found',404);
  return new Response(o.body,{headers:{'Content-Type':f.type,'Content-Length':String(f.size),'Content-Disposition':`attachment; filename="${f.name.replace(/[^a-zA-Z0-9._-]/g,'_')}"`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 }
 const v=vpaById(url.searchParams.get('vpa')||'');check(v,'Unknown VPA.',404);
 if(course==='live'&&method==='POST'){
  const a=await getRecord('canvas-assignment-'+v.canvasId,'assignment',course);
  check(a&&a.published!==false&&!a.retiredFromCanvas,'This VPA is not currently published in Canvas. Existing files are preserved.',409);
 }
 if(path==='vpa/draft'&&method==='POST'){
  const b:any=await req.json(),d:VpaDraft={revision:0,includeNotes:b.includeNotes===true,answers:{},photos:[],ppt:null,video:null};
  check(Number.isSafeInteger(b.revision)&&b.revision>=0,'Invalid revision.');
  for(const q of v.questions){const t=b.answers?.[q.key]||'';check(typeof t==='string'&&t.length<=6000,'Each answer must be under 6,000 characters.');d.answers[q.key]=t;}
  check(Array.isArray(b.photos)&&b.photos.length<=6,'Up to six photos.');d.photos=[...new Set<string>(b.photos)];
  for(const id of d.photos)await fileCheck(id,course,u,v.id,'photo');
  for(const k of ['ppt','video'] as const){if(b[k]){await fileCheck(b[k],course,u,v.id,k);d[k]=b[k];}}
  if(typeof b.importedFrom==='string')d.importedFrom=b.importedFrom.slice(0,200);
  const id=draftId(course,u.id,v.id);d.revision=b.revision+1;
  let r;
  if(b.revision===0)r=await run('INSERT OR IGNORE INTO records(id,kind,course,owner,data,updated) VALUES(?,?,?,?,?,?)',id,'vpa-draft',course,u.id,JSON.stringify(d),now());
  else r=await run("UPDATE records SET data=?,updated=? WHERE id=? AND owner=? AND course=? AND json_extract(data,'$.revision')=?",JSON.stringify(d),now(),id,u.id,course,b.revision);
  check(r.meta.changes===1,'This draft changed in another window. Reload before saving; your local text has not been replaced.',409);
  return json({draft:d});
 }
 if(path==='vpa/upload'&&method==='POST'){
  const kind=url.searchParams.get('kind')||'',name=decodeURIComponent(req.headers.get('X-File-Name')||'').replace(/[\r\n\\/]/g,'_').slice(0,160);
  let spec;try{spec=fileSpec(kind,name);}catch{check(false,'Use PPT/PPTX, MP4, or JPEG/PNG as indicated.');}
  const size=Number(req.headers.get('Content-Length'));check(Number.isSafeInteger(size)&&size>=16&&size<=spec.max,`File is empty or exceeds ${spec.max/1024/1024} MB.`,413);check(req.body,'Missing file.');
  const quota=await one<{n:number;size:number}>("SELECT COUNT(*) n,COALESCE(SUM(json_extract(data,'$.size')),0) size FROM records WHERE kind='vpa-file' AND course=? AND owner=?",course,u.id);
  check((quota?.n||0)<150&&(quota?.size||0)+size<750*1024*1024,'Upload quota reached. Contact the teaching team.',413);
  const id=uid(),key=`vpa/${course}/${u.id}/${v.id}/${id}.${spec.ext}`;
  let seen=0,head=new Uint8Array(0),checked=false;
  const guard=new TransformStream<Uint8Array,Uint8Array>({transform(chunk,c){seen+=chunk.length;if(seen>size)throw Error('File size mismatch');if(!checked){const joined=new Uint8Array(head.length+chunk.length);joined.set(head);joined.set(chunk,head.length);head=joined;if(head.length<16)return;if(!validSignature(spec.ext,head))throw Error('File contents do not match its extension.');checked=true;c.enqueue(head);head=new Uint8Array(0);}else c.enqueue(chunk);},flush(){if(!checked||seen!==size)throw Error('Incomplete file');}});
  const fixed=new FixedLengthStream(size);const pumping=req.body.pipeThrough(guard).pipeTo(fixed.writable);
  try{await Promise.all([pumping,runtime().BUCKET.put(key,fixed.readable,{httpMetadata:{contentType:spec.type}})]);}catch{check(false,'Upload failed or file contents do not match the format. Try again.',400);}
  await save('vpa-file',course,id,{vpa:v.id,fileKind:kind,name,type:spec.type,size,key},u.id);await audit(u.id,'vpa-upload',id);
  return json({id,name,size,fileKind:kind,type:spec.type,vpa:v.id});
 }
 if(path==='vpa/pdf'&&method==='POST'){
  const d=await draft(course,u,v);check(d.includeNotes&&packageErrors(v,{...d,ppt:'preview'}).length===0,'Complete the Notes questions first.');
  return json({id:await pdfFile(req,v,d,u,course)});
 }
 if(path==='vpa/prepare'&&method==='POST'){
  const b:any=await req.json(),d=await draft(course,u,v);check(b.revision===d.revision,'Save your latest draft before previewing.',409);
  const errors=packageErrors(v,d);check(errors.length===0,errors.join(' '));
  const ppt=await fileCheck(d.ppt!,course,u,v.id,'ppt');const files=[ppt.id];if(d.video)files.push((await fileCheck(d.video,course,u,v.id,'video')).id);
  const id='vpa-package:'+await hash(JSON.stringify([course,u.id,v.id,d]));const existing=await getRecord(id,'vpa-package',course);if(existing)return json({package:existing});
  if(d.includeNotes)files.push(await pdfFile(req,v,d,u,course));
  const p={vpa:v.id,revision:d.revision,files,status:'prepared',demo:course!=='live',canvasFiles:{},lockUntil:0,created:now(),answers:d.includeNotes?d.answers:{}};
  await run('INSERT OR IGNORE INTO records(id,kind,course,owner,parent,data,updated) VALUES(?,?,?,?,?,?,?)',id,'vpa-package',course,u.id,v.id,JSON.stringify(p),now());
  return json({package:await own(id,'vpa-package',course,u)});
 }
 if(path==='vpa/submit'&&method==='POST'){
  const b:any=await req.json();check(b.confirm===true,'Confirm the complete submission first.');const p=await own(b.id,'vpa-package',course,u);check(p.vpa===v.id,'Wrong VPA.');
  if(p.status==='submitted')return json({package:p});
  const canvasTest=v.canvasId===CANVAS_TEST_VPA&&await allowedCanvasTest(u,course,p.id);
  check(!p.canvasTest||canvasTest,'This Canvas Test Student authorization has expired. Ask the course owner to check the saved receipt.',403);
  check(course!=='live'||(u.role==='student'&&!u.actor&&u.canvas_id&&runtime().VPA_CANVAS_SUBMIT_ENABLED==='true'),'Live Canvas submission is not enabled for this account. Export your files and submit in Canvas.',403);
  const lock=uid(),until=Date.now()+90000;
  const acquired=await run("UPDATE records SET data=json_set(data,'$.lock',?,'$.lockUntil',?) WHERE id=? AND owner=? AND course=? AND COALESCE(json_extract(data,'$.lockUntil'),0)<?",lock,until,p.id,u.id,course,Date.now());
  check(acquired.meta.changes===1,'A submission step is still running. Check again shortly.',409);
  try{
   Object.assign(p,await own(p.id,'vpa-package',course,u));
   if(p.status==='submitted'){await run("UPDATE records SET data=json_set(data,'$.lockUntil',0) WHERE id=? AND json_extract(data,'$.lock')=?",p.id,lock);return json({package:p});}
   if(course!=='live'&&!canvasTest){
    // No relay/Canvas calls on any demo path, including retry/reconcile.
    p.status='submitted';p.receipt={demo:true,label:'Demo submission saved - NOT sent to Canvas',at:now(),id:'demo-'+uid(),files:p.files};
   }else{
    if(canvasTest)p.canvasTest=true;
    const common={assignment:canvasTest?CANVAS_TEST_ASSIGNMENT:v.canvasId,user:canvasTest?CANVAS_TEST_USER:u.canvas_id};
    if(p.status==='unknown'||p.status==='submitting'){
     const result=await relay({...common,op:'status'});
     const expected=Object.values(p.canvasFiles).map(Number).sort((a,b)=>a-b),actual=(result.attachments||[]).map((a:any)=>Number(a.id)).sort((a:number,b:number)=>a-b);
     if(expected.length&&JSON.stringify(expected)===JSON.stringify(actual)&&result.submitted_at){p.status='submitted';p.receipt=result;}
     else{p.status='unknown';p.message='Canvas receipt not confirmed. Do not submit again; contact the teaching team with this package ID.';}
    }else{
     const file=p.files.find((id:string)=>!p.canvasFiles[id]);
     if(file){const f=await own(file,'vpa-file',course,u),transfer=uid();await save('vpa-transfer',course,transfer,{file,packageId:p.id,expires:Date.now()+120000},u.id);
      const result=await relay({...common,op:'upload',transfer,name:f.name,size:f.size,type:f.type});check(Number.isSafeInteger(result.id),'Canvas did not confirm the upload.',502);p.canvasFiles[file]=result.id;p.status='transferring';
     }else{
      p.status='submitting';await save('vpa-package',course,p.id,{...p,lock,lockUntil:until},u.id,null,v.id);
      try{const result=await relay({...common,op:'submit',files:Object.values(p.canvasFiles)});check(result.user_id===common.user&&result.assignment_id===common.assignment&&result.submitted_at,'Invalid Canvas receipt.',502);p.status='submitted';p.receipt=result;}
      catch{p.status='unknown';p.message='Canvas did not return a confirmed receipt. Check status before taking further action.';}
     }
    }
   }
   await save('vpa-package',course,p.id,{...p,lock:null,lockUntil:0},u.id,null,v.id);await audit(u.id,'vpa-'+p.status,p.id);return json({package:p});
  }catch(e){await run("UPDATE records SET data=json_set(data,'$.lockUntil',0) WHERE id=? AND json_extract(data,'$.lock')=?",p.id,lock);throw e;}
 }
 check(false,'Not found',404);
}

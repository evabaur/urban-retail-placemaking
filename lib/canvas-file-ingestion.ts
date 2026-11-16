import {runtime,getRecord,save,run,check,now,audit} from './server';
type Item=Record<string,any>;
export type IngestionBudget={remaining:number;until:number};
export const ingestionBudget=():IngestionBudget=>({remaining:6,until:Date.now()+35000});
const VPA_IDS=[2000033,2000044,2000055,2000121];
function mediaType(name:string){const ext=name.toLowerCase().split('.').pop();return ({pdf:'application/pdf',mp4:'video/mp4',ppt:'application/vnd.ms-powerpoint',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation'} as Record<string,string>)[ext||'']||'application/octet-stream';}

// Source IDs come only from authenticated Canvas metadata, never a caller URL.
// Both live sync and isolated QA call this exact ingestion path.
export async function hydrateCanvasSubmission(course:string,id:string,budget=ingestionBudget()){
 const s=await getRecord(id,'submission',course);check(s&&s.canvasUserId&&s.canvasAssignmentId,'Canvas source identity missing.',409);
 check((course==='live'&&VPA_IDS.includes(s.canvasAssignmentId))||(course==='sandbox'&&id==='qa-canvas-origin-submission'&&s.canvasAssignmentId===2000154&&s.canvasUserId===2000176),'Outside Canvas ingestion scope.',403);
 const attachments:Item[]=s.attachments||[],files:Item[]=[];let downloaded=0,reused=0,error:string|null=null;
 if(attachments.length>20)error='More than 20 attachments: teaching-team review required.';
 for(const f of error?[]:attachments){
  if(!Number.isSafeInteger(f.id)||f.id<=0||!Number.isSafeInteger(f.size)||f.size<=0||f.size>64*1024*1024){error='Attachment is invalid or exceeds the 64 MB transport limit.';break;}
  const recordId=`canvas-file:${course}:${s.canvasAssignmentId}:${s.canvasUserId}:${f.id}`,key=`canvas-files/${course}/${s.canvasAssignmentId}/${s.canvasUserId}/${f.id}`,backupKey=`file-backups/${course}/${recordId}`;
  try{
   let stored=await getRecord(recordId,'canvas-file',course),primary=await runtime().BUCKET.head(key);
   if(!(stored&&primary?.size===f.size&&primary?.customMetadata?.sha256===stored.sha256)){
    if(budget.remaining<=0||Date.now()>=budget.until)break;
    budget.remaining--;const e=runtime();check(e.CANVAS_RELAY_URL==='https://relay.example.com'&&e.CANVAS_RELAY_KEY,'Canvas transport unavailable.',503);
    const response=await fetch(e.CANVAS_RELAY_URL+'/v1/vpa',{method:'POST',redirect:'manual',headers:{Authorization:'Bearer '+e.CANVAS_RELAY_KEY,'Content-Type':'application/json'},body:JSON.stringify({op:'download',assignment:s.canvasAssignmentId,user:s.canvasUserId,file:f.id}),signal:AbortSignal.timeout(Math.max(1000,Math.min(35000,budget.until-Date.now())))});
    check(response.ok&&response.body,'Canvas attachment download failed; will retry.',502);
    const digest=response.headers.get('X-Content-SHA256')||'';
    check(Number(response.headers.get('Content-Length'))===f.size&&/^[a-f0-9]{64}$/.test(digest),'Canvas attachment integrity headers missing.',502);
    const type=mediaType(f.name||'');await runtime().BUCKET.put(key,response.body,{httpMetadata:{contentType:type},customMetadata:{sha256:digest,canvasFile:String(f.id)}});
    primary=await runtime().BUCKET.head(key);check(primary?.size===f.size&&primary?.customMetadata?.sha256===digest,'Stored attachment incomplete.',503);
    stored={key,backupKey,name:f.name||'Canvas attachment',size:f.size,type,sha256:digest,canvasFileId:f.id,canvasAssignmentId:s.canvasAssignmentId,canvasUserId:s.canvasUserId,importedAt:now()};downloaded++;
   }else reused++;
   const copy=await runtime().BUCKET.head(backupKey);
   if(!copy){const source=await runtime().BUCKET.get(key);check(source,'Stored attachment missing.',503);await runtime().BUCKET.put(backupKey,source.body,{httpMetadata:source.httpMetadata,customMetadata:source.customMetadata});}
   const verified=await runtime().BUCKET.head(backupKey);check(verified?.size===f.size&&verified?.customMetadata?.sha256===stored.sha256,'Attachment backup integrity mismatch.',503);
   await save('canvas-file',course,recordId,stored,s.owner,null,id);
   files.push({key:stored.key,name:stored.name,size:stored.size,type:stored.type,sha256:stored.sha256,canvasFileId:f.id});
  }catch{error='Attachment transfer or backup failed; saved files retained for retry.';break;}
 }
 const complete=files.length===attachments.length&&!error;
 const ingestion={status:complete?'ready':error?'retry':'pending',checkedAt:now(),expected:attachments.length,stored:files.length,error};
 // A slow retry must never overwrite a newer Canvas attempt imported concurrently.
 const updated=await run("UPDATE records SET data=json_set(data,'$.files',json(?),'$.materialsIncomplete',json(?),'$.ingestion',json(?)),updated=? WHERE id=? AND kind='submission' AND course=? AND json_extract(data,'$.submittedAt')=? AND COALESCE(json_array_length(data,'$.files'),0)<=?",JSON.stringify(files),JSON.stringify(!complete),JSON.stringify(ingestion),now(),id,course,s.submittedAt,files.length);
 if(downloaded||error)await audit('system:canvas-sync',error?'canvas-file-retry':'canvas-files-imported',JSON.stringify({course,submission:id,downloaded,reused,status:ingestion.status}));
 if(updated.meta.changes!==1){const latest=await getRecord(id,'submission',course);return {complete:latest?.submittedAt===s.submittedAt&&latest?.ingestion?.status==='ready',downloaded,reused,status:'superseded'};}
 return {complete,downloaded,reused,...ingestion};
}

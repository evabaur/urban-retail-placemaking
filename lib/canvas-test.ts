import {runtime,getRecord,save,check,now,audit,User,all,RecordRow,unpack} from './server';
import {canvas} from './integrations';
import {teamProgress} from './team-progress';
// Explicit owner authorization: one enrolled identity, isolated restricted QA assignment.
export const CANVAS_TEST_USER=2000176;
export const CANVAS_TEST_ASSIGNMENT=2000154;
export const CANVAS_TEST_VPA=2000044;
export async function testRelay(body:unknown){
 const e=runtime();check(e.CANVAS_RELAY_URL==='https://relay.example.com'&&e.CANVAS_RELAY_KEY,'Canvas transport unavailable.',503);
 const r=await fetch(e.CANVAS_RELAY_URL+'/v1/vpa',{method:'POST',redirect:'manual',headers:{Authorization:'Bearer '+e.CANVAS_RELAY_KEY,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(55000)});
 check(r.ok,'Canvas test transport failed.',502);return r;
}
export async function allowedCanvasTest(u:User,course:string,packageId:string){
 if(course!=='sandbox'||u.id!=='fa26-test-student'||!['test-student','teststudent'].includes(u.uni))return false;
 const config=await getRecord('canvas-test-authorization','meta','sandbox');
 return !!(config&&config.packageId===packageId&&config.expires>Date.now()&&config.canvasUser===CANVAS_TEST_USER&&config.assignment===CANVAS_TEST_ASSIGNMENT);
}
export async function handleCanvasTest(req:Request,u:User){
 check(u.uni==='owner01'&&u.role==='staff'&&u.course==='live','Course owner only.',403);check(req.method==='POST','Method not allowed.',405);
 const b:any=await req.json(),common={user:CANVAS_TEST_USER,assignment:CANVAS_TEST_ASSIGNMENT};
 if(['prepare-canvas-origin','ingest-canvas-origin','close-canvas-origin'].includes(b.action)){
  const assignment='qa-canvas-origin-assignment',submission='qa-canvas-origin-submission';
  if(b.action==='prepare-canvas-origin'){
   const old=await getRecord(assignment,'assignment','sandbox');check(!old?.qaArchived,'This QA fixture is archived.',409);if(old)return Response.json({ok:true,assignment,reused:true});
   const receipt:any=await(await testRelay({...common,op:'status'})).json();check(receipt.submitted_at&&receipt.attachments?.length===2,'Expected the previously authorized synthetic QA submission.',409);
   const source=await getRecord('fa26-test:canvas-assignment-'+CANVAS_TEST_VPA,'assignment','sandbox');check(source?.rubric?.length,'Test rubric missing.',409);
   await save('assignment','sandbox',assignment,{title:'QA ONLY · Canvas-origin attachment review',assignmentType:'vpa',vpa:'canvas-origin-qa',published:true,demoReviewRound:true,due:new Date(Date.now()-1000).toISOString(),rubric:source.rubric});
   await save('submission','sandbox',submission,{assignment,canvasAssignmentId:CANVAS_TEST_ASSIGNMENT,canvasUserId:CANVAS_TEST_USER,submittedAt:receipt.submitted_at,text:'',files:[],materialsIncomplete:true,attachments:receipt.attachments.map((f:any)=>({id:f.id,name:f.display_name||f.filename,size:f.size}))},'fa26-test-student',null,assignment);
   await audit(u.id,'qa-canvas-origin-prepared',assignment);return Response.json({ok:true,assignment,source:'Canvas only; no app package reuse'});
  }
  const fixture=await getRecord(assignment,'assignment','sandbox');check(fixture&&!fixture.qaArchived,'Active QA fixture required.',409);
  if(b.action==='close-canvas-origin'){await save('assignment','sandbox',assignment,{...fixture,published:false,demoReviewRound:false,retiredFromCanvas:true,qaArchived:true});return Response.json({ok:true});}
  const {hydrateCanvasSubmission}=await import('./canvas-file-ingestion');const result=await hydrateCanvasSubmission('sandbox',submission);
  return Response.json({ok:true,...result});
 }
 if(b.action==='group-submit'){
  const existing=await getRecord('qa-group-result:2000165','qa-group-result','sandbox');if(existing)return Response.json({ok:true,result:existing});
  const p=await getRecord(b.id,'vpa-package','sandbox');check(p&&p.owner==='fa26-test-student'&&p.canvasTest&&p.status==='submitted','Verify the isolated individual QA package first.',409);
  const target={user:CANVAS_TEST_USER,assignment:2000165};const before:any=await(await testRelay({...target,op:'status'})).json();check(!before.submitted_at&&!before.attempt,'Existing group QA work; manual reconciliation required.',409);
  await audit(u.id,'qa-group-submit-start',p.id);
  const receipt:any=await(await testRelay({...target,op:'submit',files:Object.values(p.canvasFiles)})).json();check(receipt.submitted_at&&receipt.user_id===CANVAS_TEST_USER&&receipt.assignment_id===2000165,'Invalid group receipt.',502);
  const members:any[]=await canvas('groups/2000242/users'),statuses:any[]=await canvas('courses/900001/assignments/2000165/submissions');
  const progress=teamProgress({groupCategoryId:2000231,due:null},members.map(m=>({id:'canvas-'+m.id,canvasId:m.id,name:m.name})),statuses.map(s=>({canvasUserId:s.user_id,workflowState:s.workflow_state,submittedAt:s.submitted_at,submissionType:s.submission_type,syncedAt:now()})),true);
  const result={receipt,progress,at:now(),packageId:p.id,syntheticQaOnly:true};await save('qa-group-result','sandbox','qa-group-result:2000165',result,u.id);await audit(u.id,'qa-group-submitted',String(receipt.id));return Response.json({ok:true,result});
 }
 if(b.action==='authorize-package'){
  const p=await getRecord(b.id,'vpa-package','sandbox');check(p&&p.owner==='fa26-test-student'&&p.vpa==='vpa2'&&['prepared','transferring','unknown'].includes(p.status),'Only the isolated QA VPA2 package is eligible.',400);
  // Verify the fixed owner-authorized enrolled identity and preserve existing QA work.
  const before:any=await (await testRelay({...common,op:'status'})).json();
  if(before.submitted_at){
   const priorConfig=await getRecord('canvas-test-authorization','meta','sandbox'),prior=priorConfig?await getRecord(priorConfig.packageId,'vpa-package','sandbox'):null;
   const expected=Object.values(prior?.canvasFiles||{}).map(Number).sort((a,b)=>a-b),actual=(before.attachments||[]).map((f:any)=>Number(f.id)).sort((a:number,b:number)=>a-b);
   check(b.previousReceipt===before.id&&b.previousAttempt===before.attempt&&prior?.owner==='fa26-test-student'&&expected.length===2&&JSON.stringify(expected)===JSON.stringify(actual),'Existing QA work requires its exact verified receipt and files.',409);
   await save('vpa-package','sandbox',prior.id,{...prior,status:'submitted',receipt:before,message:null,lock:null,lockUntil:0},prior.owner,null,prior.parent);await audit(u.id,'qa-reconcile-confirmed-receipt',prior.id);
   check(p.id!==prior.id,'Prepare a new QA package for an additional attempt.',409);
  }
  if(p.status==='unknown'){check(!before.attempt&&!(before.attachments||[]).length,'Canvas outcome requires manual reconciliation.',409);await save('vpa-package','sandbox',p.id,{...p,status:Object.keys(p.canvasFiles||{}).length?'transferring':'prepared',message:null,lock:null,lockUntil:0},p.owner,null,p.parent);await audit(u.id,'qa-resume-confirmed-unsubmitted',p.id);}
  await save('meta','sandbox','canvas-test-authorization',{...common,canvasUser:common.user,packageId:p.id,expires:Date.now()+1800000,authorizedBy:u.id,before});
  await audit(u.id,'authorize-canvas-test',p.id);return Response.json({ok:true,canvasUser:common.user,assignment:common.assignment,expiresInMinutes:30});
 }
 if(b.action==='status'){
  const status:any=await (await testRelay({...common,op:'status'})).json();
  const parent='fa26-test:canvas-assignment-'+CANVAS_TEST_VPA;
  await save('submission-status','sandbox','canvas-test-status:'+CANVAS_TEST_ASSIGNMENT,{workflowState:status.workflow_state,submittedAt:status.submitted_at||null,submissionType:status.submission_type||null,syncedAt:now(),testCanvas:true},'fa26-test-student',null,parent);
  return Response.json({ok:true,status});
 }
 if(b.action==='download'){
  const r=await testRelay({...common,op:'download',file:b.file});
  const key=`canvas-test/${CANVAS_TEST_USER}/${CANVAS_TEST_ASSIGNMENT}/${b.file}`;
  await runtime().BUCKET.put(key,r.body);const stored=await runtime().BUCKET.get(key);check(stored,'Returned attachment not saved.',503);
  await save('canvas-test-file','sandbox','canvas-test-file:'+b.file,{key,canvasFile:b.file,size:stored.size,downloadedAt:now()},'fa26-test-student');
  return new Response(stored.body,{headers:{'Content-Type':'application/octet-stream','Cache-Control':'no-store','Content-Disposition':'attachment; filename="canvas-test-file"'}});
 }
 if(b.action==='close'){
  const old=await getRecord('canvas-test-authorization','meta','sandbox');if(old)await save('meta','sandbox',old.id,{...old,expires:0,closedAt:now()});
  return Response.json({ok:true});
 }
 check(false,'Unknown test action.');
}

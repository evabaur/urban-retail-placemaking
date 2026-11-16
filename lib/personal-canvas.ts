import {canvas} from './integrations';
import {records,getRecord,save,runtime,check,now,User} from './server';
export async function refreshPersonalCanvas(u:User){
 check(u.course==='live'&&u.role==='student'&&u.canvas_id,'Canvas status is available for enrolled students only.',403);
 const assignments=(await records('assignment','live')).filter(a=>a.canvasId&&a.published!==false&&!a.retiredFromCanvas);
 const output:any[]=[];
 // Existing read-only relay route; cache the course response briefly so a
 // classroom login burst does not request the same roster forty times.
 for(let i=0;i<assignments.length;i+=3)await Promise.all(assignments.slice(i,i+3).map(async a=>{
  const cacheId='canvas-status-cache:'+a.canvasId;
  const cached=await getRecord(cacheId,'canvas-status-cache','live');
  let rows=cached?.rows;
  if(!cached||Date.now()-Date.parse(cached.fetchedAt)>30000){
   rows=await canvas(`courses/900001/assignments/${Number(a.canvasId)}/submissions`);
   await save('canvas-status-cache','live',cacheId,{rows:rows.map((r:any)=>({user_id:r.user_id,assignment_id:r.assignment_id,workflow_state:r.workflow_state,submitted_at:r.submitted_at,submission_type:r.submission_type,late:r.late,excused:r.excused,cached_due_date:r.cached_due_date})),fetchedAt:now()});
  }
  const s=rows.find((s:any)=>Number(s.user_id)===u.canvas_id&&Number(s.assignment_id)===Number(a.canvasId));
  // Missing/filtered rows are not proof of an unsubmitted assignment.
  if(!s)return;
  const data:any={workflowState:s.workflow_state,submittedAt:s.submitted_at,submissionType:s.submission_type,late:!!s.late,excused:!!s.excused,syncedAt:now()};
  if(Object.prototype.hasOwnProperty.call(s,'cached_due_date'))data.due=s.cached_due_date;
  output.push({a,data});
 }));
 // Only commit when all requests succeeded. A transport failure leaves the
 // last successful personal snapshot untouched.
 if(output.length)await runtime().DB.batch(output.map(({a,data})=>runtime().DB.prepare(
 'INSERT INTO records(id,kind,course,owner,parent,data,updated) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated=excluded.updated'
 ).bind(`submission-status:${a.canvasId}:${u.canvas_id}`,'submission-status','live',u.id,a.id,JSON.stringify(data),now())));
 return {ok:true,checked:output.length,total:assignments.length,syncedAt:now(),partial:output.length!==assignments.length};
}

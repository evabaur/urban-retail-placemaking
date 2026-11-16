import {all,records,getRecord,runtime,check,now,audit,User,RecordRow,unpack,safeUser} from './server';
import {canvas} from './integrations';
import {VPAS} from './vpa';
export async function teachingDashboard(req:Request,u:User,course:string){
 check(u.role==='staff'&&u.course==='live'&&course==='live','Teaching-team access required.',403);
 const roster=await getRecord('live-roster','meta','live');
 const people=(await all<User>("SELECT * FROM users WHERE course='live' AND role='student' ORDER BY name")).filter(p=>roster?.currentStudentIds?.includes(p.id));
 const assignments=(await records('assignment','live')).filter(a=>a.published!==false&&!a.retiredFromCanvas&&a.canvasId);
 if(req.method==='POST'){
  const body:any=await req.json(),a=assignments.find(a=>a.id===body.assignment);check(a,'Published assignment not found.',404);
  const rows=await canvas(`courses/900001/assignments/${Number(a.canvasId)}/submissions`),at=now();
  const statements=[];
  for(const p of people){const s=rows.find((s:any)=>Number(s.user_id)===p.canvas_id&&Number(s.assignment_id)===Number(a.canvasId));if(!s)continue;
   const data={workflowState:s.workflow_state,submittedAt:s.submitted_at||null,submissionType:s.submission_type||null,late:!!s.late,excused:!!s.excused,syncedAt:at,...(Object.hasOwn(s,'cached_due_date')?{due:s.cached_due_date}:{})};
   statements.push(runtime().DB.prepare("INSERT INTO records(id,kind,course,owner,parent,data,updated) VALUES(?,'submission-status','live',?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated=excluded.updated").bind(`submission-status:${a.canvasId}:${p.canvas_id}`,p.id,a.id,JSON.stringify(data),at));
  }
  if(statements.length)await runtime().DB.batch(statements);await audit(u.id,'dashboard-canvas-refresh',a.id);
  return {ok:true,checked:statements.length,total:people.length,at};
 }
 check(req.method==='GET','Method not allowed.',405);
 const ids=new Set(people.map(p=>p.id));
 const rows=(await all<RecordRow>("SELECT * FROM records WHERE course='live' AND kind IN ('trek-notes','vpa-draft','vpa-package','submission-status') ORDER BY updated")).map(unpack).filter(r=>ids.has(r.owner));
 const statuses=rows.filter(r=>r.kind==='submission-status');
 const matrix=assignments.map(a=>{
  const cells=people.map(p=>{const s=statuses.filter(s=>s.owner===p.id&&s.parent===a.id).at(-1);return {student:p.id,status:!s?'unknown':s.excused?'excused':s.submittedAt||['submitted','graded','pending_review'].includes(s.workflowState)?'submitted':'not-submitted',late:s?.late||false,syncedAt:s?.syncedAt||null,submittedAt:s?.submittedAt||null};});
  return {id:a.id,canvasId:a.canvasId,title:a.title,due:a.due||a.dueAt||null,vpa:VPAS.some(v=>v.canvasId===Number(a.canvasId)),cells};
 });
 const notes=rows.filter(r=>r.kind==='trek-notes'),drafts=rows.filter(r=>r.kind==='vpa-draft'&&r.revision>0),packages=rows.filter(r=>r.kind==='vpa-package');
 return {people:people.map(safeUser),assignments:matrix,notes:{total:notes.length,students:new Set(notes.map(n=>n.owner)).size,byTrek:['trek1','trek2','trek3','independent'].map(id=>({id,count:notes.filter(n=>n.trek===id).length}))},vpa:{drafts:drafts.length,packages:packages.length,submitted:matrix.filter(a=>a.vpa).reduce((n,a)=>n+a.cells.filter(c=>c.status==='submitted').length,0)},generatedAt:now()};
}

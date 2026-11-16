import {records,getRecord,save,now} from './server';
import {SESSION_EVENTS,SESSION_ASSIGNMENTS,TERM_AUDIT_DATE} from './term-release';
// Staff-only, explicit preparation. Does not provision users, open rounds or write Canvas.
export async function prepareTerm() {
  const assignments=await records('assignment','live');
  for(const s of SESSION_EVENTS){
    const old=await getRecord(s.id,'event','live');
    await save('event','live',s.id,{...old,title:`Session ${s.number} · ${s.topic}`,date:s.date,
      location:'Tuesdays 2:20–5:35 pm · room to be confirmed',snapshot:false,
      assignmentIds:SESSION_ASSIGNMENTS[s.number].map(id=>'canvas-assignment-'+id).filter(id=>assignments.some(a=>a.id===id&&a.published!==false&&!a.retiredFromCanvas))});
  }
  for(const [id,date,location] of [
    ['live-event-2','2026-11-06T13:25:00Z','Sample Flagship A · meet 9:00 am; tour 9:00–10:30'],
    ['live-event-4','2026-11-13T14:30:00Z','Sample Store B · 9:30 am; district walk 11:00–12:15; Sample Store C 12:30'],
    ['live-event-6','2026-11-20T14:00:00Z','Sample Flagship D · 9:00 am; later split-group times partly pending'],
  ]){const old=await getRecord(id,'event','live');if(old)await save('event','live',id,{...old,date,location,snapshot:false});}
  for(const id of ['live-event-8','live-event-9']){const old=await getRecord(id,'event','live');if(old)await save('event','live',id,{...old,date:null,snapshot:false,location:id==='live-event-9'?'At least one self-organized field day; schedule with your team.':'Arrange a review slot with your client.'});}
  for(const [id,assignmentId] of [['live-milestone-7',2000088],['live-milestone-10',2000022]] as const){
    const old=await getRecord(id,'milestone','live'),a=assignments.find(a=>a.canvasId===assignmentId&&a.published!==false);
    if(old&&a)await save('milestone','live',id,{...old,due:a.due,snapshot:false,detail:'Official Canvas deadline (New York time). Submit to '+a.canvasUrl});
  }
  for(const [id,detail] of [
    ['live-milestone-6','Brand narrative and target groups are part of WIP preparation, not a separate Canvas deadline.'],
    ['live-milestone-8','Arrange a client review in the late-November window. No common fixed time for all teams.'],
    ['live-milestone-9','Prepare the strategy for your client review, around Nov 25–30. No separately published Canvas assignment/deadline exists.'],
  ]){const old=await getRecord(id,'milestone','live');if(old)await save('milestone','live',id,{...old,due:null,detail,snapshot:false});}
  const duplicate=await getRecord('live-milestone-11','milestone','live');
  if(duplicate)await save('milestone','live',duplicate.id,{...duplicate,retiredFromPlan:true,detail:'Old unpublished placeholder, superseded by published assignment 2000022. Retained for audit only.'});
  await save('meta','live','live-source',{stage:'pre-release',auditDate:TERM_AUDIT_DATE,preparedAt:now(),note:'Fall 2026 preparation. Canvas is read-only; student access, automatic invitations and direct Canvas submission are not released.'});
  return {ok:true,stage:'pre-release',sessions:6};
}

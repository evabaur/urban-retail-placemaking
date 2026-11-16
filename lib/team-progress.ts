import {courseTimestamp} from './course-plan';
type Item=Record<string,any>;
export const TEAM_ASSIGNMENTS=[{canvasId:2000088,label:'Work in Progress'},{canvasId:2000022,label:'Final Presentation'}];
export function teamAssignmentKind(a:Item){
 if(a.canvasId===2000088||/work[\s-]*in[\s-]*progress/i.test(a.title||''))return 'Work in Progress';
 if(a.canvasId===2000022||/final.*(presentation|recommendation)/i.test(a.title||''))return 'Final Presentation';
 return null;
}
export function teamProgress(a:Item,members:Item[],statuses:Item[],groupVerified:boolean,clock=Date.now()){
 const details=members.map(p=>{const s=statuses.find(s=>(p.canvasId!=null&&s.canvasUserId===p.canvasId)||s.owner===p.id);
  const submitted=!!s?.submittedAt||['submitted','pending_review'].includes(s?.workflowState)||(s?.workflowState==='graded'&&(!!s?.submissionType||s?.hasSubmissionEvidence===true));
  return {id:p.id,name:p.name,submitted,submittedAt:s?.submittedAt||null,late:s?.late===true,excused:s?.excused===true,
   known:!!s&&(['unsubmitted','submitted','graded','pending_review'].includes(s.workflowState)||submitted),
   due:s&&Object.hasOwn(s,'due')?s.due:a.due,syncedAt:s?.syncedAt||null};});
 const shared=!!a.groupCategoryId&&groupVerified;
 const submitted=shared&&details.some(p=>p.submitted),allKnown=details.length>0&&details.every(p=>p.known);
 const complete=!shared&&details.length>0&&details.every(p=>p.submitted||p.excused);
 const kind=submitted||complete?'submitted':allKnown?(details.some(p=>p.submitted)?'partial':'not-submitted'):'unknown';
 const dueValues=[...new Set(details.map(p=>p.due))],due=dueValues.length===1?dueValues[0]:a.due;
 const hours=(courseTimestamp(due)-clock)/3600000;
 const reminder=kind==='submitted'||!Number.isFinite(hours)?null:hours<0?(kind==='not-submitted'?'Deadline passed · not submitted at last check':'Deadline passed · check Canvas'):hours<=24?'Due within 24 hours':hours<=168?'Due this week':null;
 return {kind,shared,due,individualDeadlines:dueValues.length>1,reminder,members:details,
  submittedAt:details.find(p=>p.submittedAt)?.submittedAt||null,
  label:kind==='submitted'?(shared?'Team submitted':'All members submitted'):kind==='partial'?'Some members submitted':kind==='not-submitted'?'Not submitted':'Awaiting Canvas sync'};
}

import {planVpaReviews} from './vpa-review-plan';
import {REVIEW_WINDOW_MS} from './review-window';
type Item=Record<string,any>;
export function roundPlan(assignment:Item,roster:string[],submissions:Item[],clock=Date.now()){
 const due=Date.parse(assignment.due||''),expires=due+REVIEW_WINDOW_MS;
 if(!Number.isFinite(due))return {status:'missing-deadline'};
 if(clock<due)return {status:'scheduled'};
 if(clock>=expires)return {status:'expired',expiresAt:new Date(expires).toISOString()};
 if(!assignment.rubric?.length)return {status:'needs-rubric'};
 const latest=new Map<string,Item>();
 for(const s of submissions){const at=Date.parse(s.submittedAt||'');if(!roster.includes(s.owner)||!Number.isFinite(at)||at>due||s.reviewSnapshot)continue;const prior=latest.get(s.owner);if(!prior||Date.parse(prior.submittedAt)<at||(Date.parse(prior.submittedAt)===at&&prior.materialsIncomplete&&!s.materialsIncomplete))latest.set(s.owner,s);}
 if(!latest.size)return {status:'waiting-for-submissions'};
 const unreadable=[...latest.values()].filter(s=>!s.text?.trim()&&!s.reviewFiles?.length);
 if(unreadable.length)return {status:'needs-materials',missing:unreadable.map(s=>s.id)};
 // Missing attachments must not silently become a text-only or partial review.
 if([...latest.values()].some(s=>s.materialsIncomplete))return {status:'needs-materials'};
 const plan=planVpaReviews(roster,[...latest.keys()]);
 return {status:'planned',opensAt:new Date(due).toISOString(),expiresAt:new Date(expires).toISOString(),
  roster:[...roster],pending:plan.pending,allocations:plan.allocations.map(a=>({...a,submission:latest.get(a.author)!}))};
}

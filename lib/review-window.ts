import {courseTimestamp} from './course-plan';
type Item=Record<string,any>;
export const REVIEW_WINDOW_MS=7*24*60*60*1000;
// Store this window on newly issued invitations. Legacy rows use the assignment
// deadline; a missing deadline must not create an invitation that never expires.
export function reviewWindow(allocation:Item,assignment:Item|undefined,clock=Date.now()){
 const opens=courseTimestamp(allocation.opensAt||assignment?.due);
 const closes=allocation.expiresAt?courseTimestamp(allocation.expiresAt):opens+REVIEW_WINDOW_MS;
 const configured=Number.isFinite(opens)&&Number.isFinite(closes)&&closes>opens;
 return {opensAt:configured?new Date(opens).toISOString():null,expiresAt:configured?new Date(closes).toISOString():null,
  open:configured&&clock>=opens&&clock<closes,expired:configured&&clock>=closes,configured};
}

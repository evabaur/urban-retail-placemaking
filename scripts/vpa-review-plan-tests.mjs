import assert from 'node:assert/strict';
import {planVpaReviews} from '../lib/vpa-review-plan.ts';
let seed=7;const random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
let cases=0;
for(let n=1;n<=50;n++)for(let m=0;m<=n;m++){
 const roster=Array.from({length:n},(_,i)=>'student'+i),authors=roster.slice(0,m);
 const result=planVpaReviews(roster,authors,random),loads=Object.fromEntries(authors.map(a=>[a,0]));
 assert.equal(new Set(result.allocations.map(a=>a.reviewer)).size,result.allocations.length);
 for(const a of result.allocations){assert.notEqual(a.reviewer,a.author);assert(authors.includes(a.author));loads[a.author]++;}
 if(m>=2){assert.equal(result.allocations.length,n);assert.equal(result.pending.length,0);assert(Math.max(...Object.values(loads))-Math.min(...Object.values(loads))<=1);}
 else assert.equal(result.pending.length,m?1:n);
 cases++;
}
console.log(`PASS ${cases} VPA allocation plans: all reviewers, no self-review, balanced loads, explicit 0/1-submission exceptions. No invitations or grades written.`);

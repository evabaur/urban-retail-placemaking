// Pure planning function, not a scheduler or a grade writer. Persist an approved
// allocation once per VPA round; never re-randomize invitations already issued.
export function planVpaReviews(students:string[],authors:string[],random:()=>number=Math.random){
 const roster=[...new Set(students)],pool=[...new Set(authors)].filter(id=>roster.includes(id));
 const shuffle=<T>(items:T[])=>{const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
 if(pool.length<2)return {allocations:roster.filter(id=>pool.length===1&&id!==pool[0]).map(reviewer=>({reviewer,author:pool[0]})),pending:pool.length?pool:[...roster]};
 const order=shuffle(pool),slots=Array.from({length:roster.length},(_,i)=>order[i%order.length]);
 const owners=new Array<string|undefined>(slots.length);
 function match(reviewer:string,seen:Set<number>):boolean{
  for(const slot of shuffle(slots.map((_,i)=>i))){if(slots[slot]===reviewer||seen.has(slot))continue;seen.add(slot);if(!owners[slot]||match(owners[slot]!,seen)){owners[slot]=reviewer;return true;}}
  return false;
 }
 for(const reviewer of shuffle(roster))if(!match(reviewer,new Set()))throw new Error('No non-self allocation exists. Staff intervention required.');
 return {allocations:slots.map((author,i)=>({reviewer:owners[i]!,author})),pending:[] as string[]};
}

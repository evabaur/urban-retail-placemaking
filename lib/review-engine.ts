import {all,run,records,getRecord,save,now,uid,hash,runtime,check,audit,User} from './server';
import {roundPlan} from './review-round-plan';
import {reviewWindow} from './review-window';
import {backupCourse} from './object-backup';
import {VPAS} from './vpa';
type Item=Record<string,any>;
type Actor=User&{actor?:string|null};
const json=(x:unknown)=>Response.json(x,{headers:{'Cache-Control':'no-store'}});
const roundId=(c:string,a:string)=>`peer-round:${c}:${a}`;
export const liveReviewsEnabled=()=>runtime().VPA_REVIEW_LIVE_ENABLED==='true';

async function submissionPool(course:string,a:Item){
 const subs=(await records('submission',course)).filter(s=>s.parent===a.id&&!s.reviewSnapshot);
 const vpa=a.vpa||VPAS.find(v=>v.canvasId===a.canvasId)?.id;
 const packages=(await records('vpa-package',course)).filter(p=>vpa&&p.status==='submitted'&&p.vpa===vpa);
 // New app packages and Canvas-origin submissions share one per-author pool.
 for(const p of packages){
  const files=[];for(const id of p.files||[]){const f=await getRecord(id,'vpa-file',course);if(f&&f.owner===p.owner)files.push({key:f.key,name:f.name,size:f.size,type:f.type});}
  const answers=Object.entries(p.answers||{}).map(([k,v])=>`${k}\n${v}`).join('\n\n');
  subs.push({id:p.id,owner:p.owner,parent:a.id,submittedAt:p.receipt?.submitted_at||p.receipt?.at,text:answers,files,materialsIncomplete:files.length!==(p.files||[]).length});
 }
 return subs.map(s=>({...s,reviewFiles:(s.files||[]).filter((f:Item)=>f.key),materialsIncomplete:s.materialsIncomplete||(!!s.canvasUserId&&s.ingestion?.status!=='ready')||((s.attachments||[]).length>0&&(s.files||[]).length<(s.attachments||[]).length)}));
}
export async function dispatchReviews(course:string,trigger:'manual'|'cloud'='manual'){
 check(course==='sandbox'||course==='live','Automatic reviews are unavailable for this dataset.',403);
 check(course!=='live'||liveReviewsEnabled(),'Live automatic invitations are not released. Use the demo.',403);
 const people=await all<User>("SELECT * FROM users WHERE course=? AND role='student'",course);
 const current=course==='live'?(await getRecord('live-roster','meta',course))?.currentStudentIds:null;
 const roster=people.filter(p=>current?current.includes(p.id):!p.disabled).map(p=>p.id);
 const assignments=(await records('assignment',course)).filter(a=>a.assignmentType==='vpa'&&a.published!==false&&!a.retiredFromCanvas&&(course==='live'||a.demoReviewRound===true));
 const results=[];let changed=false;
 for(const a of assignments){
  if(roster.length<2){results.push({assignment:a.id,status:'needs-reviewers'});continue;}
  const id=roundId(course,a.id);let saved=await getRecord(id,'peer-round',course);
  if(saved?.status==='dispatched'){results.push({assignment:a.id,status:Date.now()>=Date.parse(saved.expiresAt)?'expired':'dispatched',invitations:saved.allocations.length,pending:saved.pending.length});continue;}
  if(course==='live'&&(a.canvasPeerReviews||a.canvasAutomaticPeerReviews)){results.push({assignment:a.id,status:'canvas-conflict'});continue;}
  // The saved immutable plan wins even if a retry races or new work arrives.
  if(!saved){
   if(course==='live'&&Date.now()>=Date.parse(a.due||'')&&Date.now()<Date.parse(a.due||'')+7*86400000){const {syncSubmissions}=await import('./integrations');await syncSubmissions(a.id);}
   const plan=roundPlan(a,roster,await submissionPool(course,a));
   if(plan.status!=='planned'){results.push({assignment:a.id,...plan});continue;}
   const data={...plan,assignment:a.id,createdAt:now(),rubric:a.rubric,title:a.title};
   // R2 write-ahead: no invitation can be persisted without its recoverable plan.
   await runtime().BUCKET.put(`peer-rounds/${course}/${id}/${uid()}.json`,JSON.stringify(data));
   await run('INSERT OR IGNORE INTO records(id,kind,course,parent,data,updated) VALUES(?,?,?,?,?,?)',id,'peer-round',course,a.id,JSON.stringify(data),now());
   saved=await getRecord(id,'peer-round',course);
  }
  check(saved,'Round could not be saved.',503);
  const batch=[];const snapshots=new Map<string,Item>();
  for(const link of saved.allocations){
   const sid=`peer-submission:${id}:${link.author}`;snapshots.set(sid,link.submission);
   const aid=`peer-invite:${id}:${link.reviewer}`;
   const data={assignment:a.id,round:id,opensAt:saved.opensAt,expiresAt:saved.expiresAt,issuedAt:now(),source:'deadline',rubric:saved.rubric};
   batch.push(runtime().DB.prepare('INSERT OR IGNORE INTO records(id,kind,course,owner,parent,data,updated) VALUES(?,?,?,?,?,?,?)').bind(aid,'allocation',course,link.reviewer,sid,JSON.stringify(data),now()));
  }
  for(const [sid,s] of snapshots){const data={text:s.text||'',files:s.reviewFiles||[],submittedAt:s.submittedAt,sourceSubmission:s.id,assignment:a.id,reviewSnapshot:true};batch.unshift(runtime().DB.prepare('INSERT OR IGNORE INTO records(id,kind,course,owner,parent,data,updated) VALUES(?,?,?,?,?,?,?)').bind(sid,'review-submission',course,s.owner,a.id,JSON.stringify(data),now()));}
  batch.push(runtime().DB.prepare("UPDATE records SET data=json_set(data,'$.status','dispatched','$.dispatchedAt',?),updated=? WHERE id=? AND kind='peer-round'").bind(now(),now(),id));
  await runtime().DB.batch(batch);changed=true;
  results.push({assignment:a.id,status:'dispatched',invitations:saved.allocations.length,pending:saved.pending.length});
 }
 const previousHealth=await getRecord(`review-engine:${course}`,'meta',course);
 const health={checkedAt:now(),lastAutomaticAt:trigger==='cloud'?now():previousHealth?.lastAutomaticAt||null,trigger,results,liveEnabled:liveReviewsEnabled(),scheduler:'Oracle timer; 5-minute checks',policy:'one invitation per student, seven days from VPA deadline; no automatic late redistribution'};
 await save('meta',course,`review-engine:${course}`,health);
 await runtime().BUCKET.put(`peer-rounds/${course}/scheduler-health.json`,JSON.stringify(health));
 if(changed)await backupCourse(course);
 return {course,changed,results};
}

export async function scheduledReviewTick(req:Request){
 check(req.method==='POST','Method not allowed.',405);
 const key=runtime().CANVAS_RELAY_KEY;
 const expected=key?await hash('urp-review-scheduler-v1:'+key):'';
 check(expected&&await hash(req.headers.get('authorization')||'')===await hash('Bearer '+expected),'Unauthorized.',401);
 // This service credential only starts the bounded engine; never submits to Canvas.
 const results=[];
 for(const course of liveReviewsEnabled()?['sandbox','live']:['sandbox']){
  try{results.push(await dispatchReviews(course,'cloud'));}
  catch(e){await save('meta',course,`review-engine:${course}`,{checkedAt:now(),error:'Dispatch failed; check scheduler logs and materials.',liveEnabled:liveReviewsEnabled()});throw e;}
 }
 // Backups are independent of review activation; no new student invitations.
 for(const course of ['live','sandbox']){
  try{const pointer=await runtime().BUCKET.get(`backups/${course}/latest.json`);const latest:any=pointer?await pointer.json():null;
   if(!latest||Date.now()-Date.parse(latest.created)>3600000){const snapshot=await backupCourse(course);await save('meta',course,'backup-health:'+course,{ok:true,checkedAt:now(),created:snapshot.created});}
  }catch{await save('meta',course,'backup-health:'+course,{ok:false,checkedAt:now(),error:'Scheduled object backup failed; retry on next tick.'});throw Error('Scheduled object backup failed');}
 }
 return json({ok:true,results});
}

export async function reviewMaterials(course:string,a:Item,s:Item|null){
 return (s?.files||[]).map((f:Item,index:number)=>({name:f.name||'Attachment',size:f.size,type:f.type||'application/octet-stream',url:`/api/review-file?course=${encodeURIComponent(course)}&allocation=${encodeURIComponent(a.id)}&index=${index}`}));
}
export async function handleReviewFile(req:Request,u:Actor,course:string){
 const url=new URL(req.url),a=await getRecord(url.searchParams.get('allocation')||'','allocation',course);
 check(a&&(u.role==='staff'||a.owner===u.id),'Not found.',404);
 const assignment=await getRecord(a.assignment,'assignment',course),done=(await records('review',course)).some(r=>r.parent===a.id);
 check(u.role==='staff'||(assignment?.published!==false&&!assignment?.retiredFromCanvas&&(reviewWindow(a,assignment).open||done)),'This invitation has expired.',410);
 const s=await getRecord(a.parent,'review-submission',course)||await getRecord(a.parent,'submission',course),index=Number(url.searchParams.get('index'));
 check(Number.isSafeInteger(index)&&index>=0,'Invalid attachment.');
 const f=s?.files?.[index];check(f?.key,'Not found.',404);const o=await runtime().BUCKET.get(f.key);check(o,'Attachment unavailable.',404);
 // Only PDF/MP4 may render inline. HTML/SVG/unknown uploads are downloads, never executable on our origin.
 const type=f.type||'application/octet-stream',inline=['application/pdf','video/mp4'].includes(type)&&url.searchParams.get('inline')==='1';
 return new Response(o.body,{headers:{'Content-Type':type,'Content-Disposition':`${inline?'inline':'attachment'}; filename="${String(f.name||'attachment').replace(/[^a-zA-Z0-9._-]/g,'_')}"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox; default-src 'none'"}});
}

export async function handleReviewRounds(req:Request,u:Actor,course:string){
 check(u.role==='staff','Staff only.',403);
 if(req.method==='GET')return json({rounds:(await records('peer-round',course)).map(({allocations,roster,rubric,...r})=>({...r,invitations:allocations?.length||0,students:roster?.length||0})),health:await getRecord(`review-engine:${course}`,'meta',course),liveEnabled:liveReviewsEnabled()});
 const b:any=await req.json();
 if(b.action==='demo-fixture'){
  check(!(await getRecord('fa26-test-source','meta','sandbox')),'Legacy historical fixtures are retired. Use current-term isolated tests.',410);
  check(course==='sandbox','Demo fixture is sandbox-only.',403);
  const old=(await records('assignment',course)).find(a=>a.demoReviewRound&&a.published!==false);
  if(old&&b.newRound!==true)return json({assignment:old.id,reused:true});
  const p=(await records('vpa-package',course)).find(p=>p.status==='submitted'&&p.files?.length);
  check(p,'Submit a demo VPA package first.',409);
  const files=[];for(const id of p.files){const f=await getRecord(id,'vpa-file',course);check(f&&f.owner===p.owner,'Demo file unavailable.');files.push({key:f.key,name:f.name,size:f.size,type:f.type});}
  const people=await all<User>("SELECT * FROM users WHERE course='sandbox' AND role='student' AND disabled=0 ORDER BY id");
  check(people.length>=2,'Two demo students are needed.');
  const rubric=(await records('assignment','sandbox')).find(a=>a.assignmentType==='vpa'&&a.rubric?.length)?.rubric;
  check(rubric,'Demo rubric missing.');
  const id='demo-deadline-vpa-'+uid(),due=new Date(Date.now()+60000).toISOString(),at=new Date(Date.now()-1000).toISOString();
  await save('assignment',course,id,{title:'DEMO · Automatic VPA review practice',assignmentType:'vpa',published:true,demoReviewRound:true,demoRubric:true,due,rubric});
  // Synthetic copies in sandbox only. Original packages, historical reviews and live records unchanged.
  for(const person of [people.find(p=>p.uni==='demo-student')||people[0],people.find(p=>p.uni!=='demo-student')||people[1]])await save('submission',course,`${id}:${person.id}`,{assignment:id,submittedAt:at,text:'Synthetic demo copy of a submitted VPA package. Practice only; not a real assessment.',files,demoFixture:true},person.id,null,id);
  await audit(u.id,'demo-review-fixture',id);return json({assignment:id,due});
 }
 check(b.action==='dispatch','Unknown action.');return json(await dispatchReviews(course));
}

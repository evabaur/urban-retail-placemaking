import {all,one,run,records,save,getRecord,runtime,check,now,hash,uid,User} from './server';
import {backupCourse} from './object-backup';
import {VPAS,freshVpa,validSignature} from './vpa';
import {createVpaPdf} from './vpa-pdf';
const course='sandbox',student='fa26-test-student',group='fa26-test-team';
export async function classroomDemo(req:Request,u:User&{actor?:string|null}){
 check(u.uni==='owner01'&&u.role==='staff'&&u.course==='live'&&!u.actor,'Course owner only.',403);
 const existing=await getRecord('classroom-demo-v43','meta',course);if(existing)return {ok:true,reused:true};
 const body:any=await req.json();check(typeof body.ppt==='string'&&body.ppt.length<2_000_000,'Presentation required.');
 const pptBytes=Uint8Array.from(atob(body.ppt),c=>c.charCodeAt(0));check(validSignature('pptx',pptBytes),'Invalid presentation.');
 const account=await one<User>("SELECT * FROM users WHERE id=? AND course='sandbox'",student);check(account,'Test account missing.');
 const backup=await backupCourse(course);
 // Preserve old QA records and blobs recoverably, rather than showing them as
 // classroom content. Identity/passwords and current-term definitions survive.
 await run("UPDATE records SET kind='retired-test:'||kind WHERE course='sandbox' AND kind IN ('file','submission','submission-status','review-submission','allocation','review','draft','participation-credit','vpa-draft','vpa-package','trek-notes','peer-round')");
 await save('group',course,group,{name:'Sample Brand · Team 1',max:6,classroomDemo:true});
 const mate=await one<User>("SELECT * FROM users WHERE uni='test-teammate' AND course='sandbox'");
 if(mate)await run('UPDATE users SET name=?,group_id=? WHERE id=?','Maya Patel',group,mate.id);
 const people=[{id:student,name:'Test Student'},...(mate?[{id:mate.id,name:'Maya Patel'}]:[])];
 for(const [i,name] of ['Daniel Kim','Sofia Martinez','Ethan Brooks'].entries()){
  const id='classroom-person-'+i;await run("INSERT OR IGNORE INTO users(id,uni,name,role,course,group_id,password,must_change,disabled) VALUES(?,?,?,'student','sandbox',?,'!disabled',0,1)",id,'classroom-'+i,name,group);people.push({id,name});
 }
 const aId=(v:number)=>'fa26-test:canvas-assignment-'+VPAS[v-1].canvasId;
 const at=now(),opensAt=new Date(Date.now()-86400000).toISOString(),expiresAt=new Date(Date.now()+7*86400000).toISOString();
 const answers:Record<string,string>={
  store:'Sample Flagship A, Madison Avenue',visited:'6 November 2026 (classroom scenario)',
  first_impression:'The window felt like a small stage: one carefully lit object, generous empty space and warm material textures. The quiet pace contrasted with the busy avenue outside.',
  sems:'Sense: warm lighting, leather texture and quiet acoustics. Think: the visible construction details invite questions about craft. Relate: the consultation frames the visitor as someone who appreciates making, not just a logo.',
  sem_why:'The craft story works through a small detail rather than a large sign. A sample seam beside a finished object makes the hidden work visible. It gives staff a reason to begin a conversation about process.',
  impact:'In this fictional observation, a visitor leaned closer and asked how a seam was made. That supports a claim about attention and curiosity, not a claim that the display increased sales.',
  synthesis:'Luxury is communicated through controlled attention and skilled service. Making craftsmanship legible can support value without relying on price messaging.',
  district:'Madison Avenue',district_narrative:'A sequence of quiet, individual brand worlds along an active city street.',
  narrative:'The store presents a world of enduring craftsmanship rather than fast-changing fashion.',
  narrative_register:'Rational: materials and construction. Emotional: patience and care. Mythical: objects intended to outlast a season.',
  target:'The design target is a patient collector who values knowledge and continuity. The broader customer may be visiting for a gift.',
  walkthrough:'A restrained window leads to an open threshold and a series of smaller display zones. Low displays preserve sight lines; the consultation table slows movement.',
  codes:'Natural textures, warm light and careful spacing suggest permanence. The absence of promotional clutter makes staff interaction more prominent.',
  interaction:'A staff member used an object to explain a construction detail, then asked the visitor what they had noticed.',
  curious:'How would visitors interpret the same display without the staff explanation?'
 };
 const scope=await hash(JSON.stringify([course,student,'trek1'])),key=`trek/${course}/${scope}/versions/classroom-${uid()}.json`;
 await runtime().BUCKET.put(key,JSON.stringify({fields:{},stores:[],notes:answers,notePhotos:[],updated:at}));
 await save('trek-notes',course,`trek-notes:${course}:${student}:trek1`,{revision:1,key,trek:'trek1'},student);
 // Existing rows were retired above; explicit upsert restores their kinds.
 async function put(kind:string,id:string,data:any,owner:string|null=null,team:string|null=null,parent:string|null=null){
  await run('INSERT INTO records(id,kind,course,owner,group_id,parent,data,updated) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET kind=excluded.kind,owner=excluded.owner,group_id=excluded.group_id,parent=excluded.parent,data=excluded.data,updated=excluded.updated',id,kind,course,owner,team,parent,JSON.stringify(data),at);
 }
 await put('trek-notes',`trek-notes:${course}:${student}:trek1`,{revision:1,key,trek:'trek1'},student);
 const fontResponse=await fetch(new URL('/fonts/NotoSans-Regular.ttf',req.url));check(fontResponse.ok,'PDF font unavailable.');const font=new Uint8Array(await fontResponse.arrayBuffer());
 for(const n of [1,2,3]){
  const v=VPAS[n-1],d={...freshVpa(),revision:1,includeNotes:true,answers:n===3?{store:'Sample Flagship D, SoHo',first_impression:'The change in floor level creates a theatrical arrival. I want to compare how people pause at the edge with how they enter the display area.'}:Object.fromEntries(v.questions.map(q=>[q.key,answers[q.key]||'To be developed.']))};
  const pid=`classroom:${v.id}:ppt`,pkey=`classroom/${student}/${v.id}/slides.pptx`;
  await runtime().BUCKET.put(pkey,pptBytes,{httpMetadata:{contentType:'application/vnd.openxmlformats-officedocument.presentationml.presentation'}});
  await put('vpa-file',pid,{vpa:v.id,fileKind:'ppt',name:'Experience-and-brand-worlds.pptx',size:pptBytes.length,type:'application/vnd.openxmlformats-officedocument.presentationml.presentation',key:pkey},student);
  await put('vpa-draft',`vpa-draft:${course}:${student}:${v.id}`,{...d,ppt:pid},student);
  if(n===3)continue;
  const pdf=await createVpaPdf(v,d,'Test Student','test-student',font,[],true),pdfid=`classroom:${v.id}:pdf`,pdfkey=`classroom/${student}/${v.id}/notes.pdf`;
  await runtime().BUCKET.put(pdfkey,pdf,{httpMetadata:{contentType:'application/pdf'}});
  await put('vpa-file',pdfid,{vpa:v.id,fileKind:'pdf',name:v.id.toUpperCase()+'-Notes.pdf',size:pdf.length,type:'application/pdf',key:pdfkey},student);
  await put('vpa-package',`classroom:package:${v.id}`,{vpa:v.id,revision:1,files:[pid,pdfid],status:'submitted',demo:true,answers:d.answers,receipt:{demo:true,label:'Classroom example - not sent to Canvas',at,id:'classroom-'+v.id},created:at},student,null,v.id);
  const files=[{key:pdfkey,name:v.id.toUpperCase()+'-Notes.pdf',size:pdf.length,type:'application/pdf'}];
  await put('submission',`classroom:own:${n}`,{assignment:aId(n),text:Object.values(d.answers).join('\n\n'),submittedAt:at,files},student,null,aId(n));
 }
 const assignments=await records('assignment',course);
 for(const a of assignments.filter(a=>a.published!==false&&!a.retiredFromCanvas)){
  const submitted=[aId(1),aId(2)].includes(a.id)||/on.boarding|choose your brand|work.in.progress/i.test(a.title||'');
  for(const person of people)await put('submission-status',`classroom:status:${a.id}:${person.id}`,{workflowState:submitted?'submitted':'unsubmitted',submittedAt:submitted?at:null,submissionType:submitted?'online_upload':null,syncedAt:at,classroomDemo:true},person.id,null,a.id);
 }
 const rubric=(assignments.find(a=>a.id===aId(1))?.rubric)||[];check(rubric.length,'Missing VPA rubric.');
 const other=mate?.id||people[1].id;
 for(const n of [1,2]){
  const assignment=aId(n),sid=`classroom:peer:${n}`,aid=`classroom:invite:${n}`;
  await put('review-submission',sid,{assignment,text:'A notebook display showed rough sketches beside finished drawings. The contrast invited visitors to imagine themselves as makers. In this fictional observation, two visitors tried a pen after looking at the sketch. This suggests an invitation to Act and Think; it does not establish a causal effect on purchases. The strongest strategic link is making creative identity accessible through an ordinary object.',files:[],submittedAt:at},other,null,assignment);
  await put('allocation',aid,{assignment,opensAt,expiresAt,rubric,status:n===1?'complete':'pending'},student,null,sid);
  if(n===1){
   const scores=Object.fromEntries(rubric.map((r:any)=>[r.id,Math.min(2,r.points)])),comments=Object.fromEntries(rubric.map((r:any)=>[r.id,'Specific observation and a clear course connection. Consider comparing this explanation with a practical merchandising explanation.']));
   await put('review','classroom:review:done',{assignment,scores,comments,total:Object.values(scores).reduce((a:any,b:any)=>a+b,0),comment:'I liked the distinction between an invitation to participate and evidence of actual behavior.',completedAt:at},student,null,aid);
   await put('participation-credit','classroom:credit:1',{assignment,completedAt:at,status:'eligible',points:null,canvasGradeWritten:false},student,null,aid);
   await put('allocation','classroom:incoming',{assignment,opensAt,expiresAt,rubric},other,null,'classroom:own:1');
   await put('review','classroom:feedback',{assignment,scores,comments,total:Object.values(scores).reduce((a:any,b:any)=>a+b,0),comment:'Your strongest insight is that staff make craftsmanship legible. The seam example is concrete. I would add an alternative explanation for the visitor’s curiosity and explain how you could test it.'},other,null,'classroom:incoming');
  }
 }
 for(const [i,name] of ['Client-brief-questions.txt','Store-observation-plan.txt'].entries()){
  const text=i?'Observation plan\nCompare the window, threshold, display and staff interaction.\nDaniel: spatial map\nSofia: narrative cues\nEthan: customer journey\nMaya: client questions':'Opening brief\nWhat change in customer behavior would count as success?\nWhich audience should our recommendation prioritize?\nWhat constraints should we keep in mind?';
  const key=`classroom/${group}/${name}`;await runtime().BUCKET.put(key,text);
  await put('file','classroom:team-file:'+i,{key,filename:name,size:new TextEncoder().encode(text).length,uploader:i?'Daniel Kim':'Maya Patel',uploadedAt:at},people[i+1].id,group);
 }
 await save('meta',course,'classroom-demo-v43',{created:at,backup:backup.key,fictional:true});
 await backupCourse(course);
 return {ok:true,teammates:people.length,submittedVpas:2,draftVpas:1,activeInvitations:1,feedback:1};
}

import {all,one,records,getRecord,save,runtime,check,passwordHash,now,audit,User,RecordRow,run} from './server';
import {backupCourse} from './object-backup';

// Owner-only, resumable cutover. Retired datasets are recoverable but not API-selectable.
export async function launchTransition(u:User,b:any){
 check(u.uni==='owner01'&&u.role==='staff'&&u.course==='live','Course owner only.',403);
 if(b.action==='retire-archive'){
  const old=await getRecord('fa2025-archive-offline','meta','live');if(old)return {ok:true,reused:true,...old};
  const backup=await backupCourse('archive'),object=await runtime().BUCKET.get(backup.key);check(object,'Archive backup unavailable.',503);const snapshot:any=await object.json();check(snapshot.records.length===backup.records&&snapshot.people.length===backup.people,'Archive backup verification failed.',503);
  await runtime().DB.batch([runtime().DB.prepare("DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE course='archive')"),runtime().DB.prepare("UPDATE users SET disabled=1 WHERE course='archive'")]);
  await save('meta','live','fa2025-archive-offline',{at:now(),backup});await audit(u.id,'archive-offline','archive');return {ok:true,backup};
 }
 if(b.action==='prepare-staff'){
  const known:Record<string,string>={instructor01:'Course Instructor',ta01:'Teaching Assistant'};
  check(known[b.uni],'Unknown teaching-team identity.');
  const existing=await one<User>('SELECT * FROM users WHERE uni=?',b.uni);
  if(existing){check(existing.role==='staff'&&existing.course==='live','Identity conflict.',409);return {ok:true,reused:true,enabled:!existing.disabled};}
  check(typeof b.password==='string'&&b.password.length>=20,'Use a strong temporary password.');
  await run("INSERT INTO users(id,uni,name,role,course,password,must_change,disabled,email) VALUES(?,?,?,'staff','live',?,1,1,?)",'staff-'+b.uni,b.uni,known[b.uni],await passwordHash(b.password),b.uni+'@columbia.edu');
  await audit(u.id,'prepare-staff-access',b.uni);return {ok:true,prepared:true,enabled:false};
 }
 if(b.action==='prepare-student'){
  const roster=await getRecord('live-roster','meta','live');
  check(roster?.currentStudentIds?.includes(b.id),'Not a current student.',400);
  const p=await one<User>("SELECT * FROM users WHERE id=? AND course='live' AND role='student'",b.id);
  check(p,'Student unavailable.',404);
  const marker='onboarding:'+p.id;
  if(await getRecord(marker,'onboarding','live'))return {ok:true,prepared:true,reused:true};
  if(!p.disabled)return {ok:true,alreadyActive:true};
  check(typeof b.password==='string'&&b.password.length>=20,'Use a unique strong temporary password.');
  const hashed=await passwordHash(b.password);
  await runtime().DB.batch([
   runtime().DB.prepare('UPDATE users SET password=?,must_change=1 WHERE id=? AND disabled=1').bind(hashed,p.id),
   runtime().DB.prepare("INSERT OR IGNORE INTO records(id,kind,course,owner,data,updated) VALUES(?,'onboarding','live',?,?,?)").bind(marker,p.id,JSON.stringify({preparedAt:now(),delivery:'not-sent',activation:'awaiting-owner'}),now())
  ]);
  await audit(u.id,'prepare-student-access',p.id);return {ok:true,prepared:true,enabled:false};
 }
 check(b.action==='transition','Unknown transition action.');
 check(typeof b.testPassword==='string'&&b.testPassword.length>=20,'Test password required.');
 const completed=await getRecord('fa2026-launch-transition','meta','live');
 if(completed)return {ok:true,reused:true,...completed};
 const roster=await getRecord('live-roster','meta','live');
 check(roster?.currentStudentIds?.length&&Date.now()-Date.parse(roster.syncedAt)<3600000,'Refresh Canvas roster first.');
 const backups=[];
 for(const course of ['live','sandbox','demo']){
  const backup=await backupCourse(course),o=await runtime().BUCKET.get(backup.key);
  check(o,'Backup missing; cutover aborted.',503);const snapshot:any=await o.json();
  check(snapshot.course===course&&snapshot.records.length===backup.records&&snapshot.people.length===backup.people,'Backup readback failed.',503);
  backups.push({course,...backup});
 }
 const stamp=now(),allowedKinds=['assignment','event','milestone','round'];
 const source=(await all<RecordRow>("SELECT * FROM records WHERE course='live'")).filter(r=>allowedKinds.includes(r.kind));
 const ids=new Map(source.map(r=>[r.id,'fa26-test:'+r.id]));
 const remap=(x:any):any=>typeof x==='string'?(ids.get(x)||x):Array.isArray(x)?x.map(remap):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).map(([k,v])=>[k,remap(v)])):x;
 const testHash=await passwordHash(b.testPassword),db=runtime().DB;
 const batch=[
  db.prepare("DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE course IN ('sandbox','demo'))"),
  db.prepare("UPDATE users SET disabled=1,course='retired-'||course WHERE course IN ('sandbox','demo')"),
  db.prepare("UPDATE records SET course='retired-'||course WHERE course IN ('sandbox','demo')"),
  db.prepare("UPDATE records SET id='retired:'||id WHERE id='review-engine:sandbox' AND course='retired-sandbox'"),
  db.prepare("INSERT INTO users(id,uni,name,role,course,group_id,password,must_change,disabled) VALUES('fa26-test-student','test-student','Test Student','student','sandbox','fa26-test-team',?,0,0)").bind(testHash),
  db.prepare("INSERT INTO records(id,kind,course,data,updated) VALUES('fa26-test-team','group','sandbox',?,?)").bind(JSON.stringify({name:'Test team · not a real project group',max:6}),stamp),
 ];
 for(const row of source){const data=remap(JSON.parse(row.data));delete data.demoCopy;if(row.kind==='round'){data.open=false;data.closes=null;}data.testCopy=true;
  batch.push(db.prepare('INSERT INTO records(id,kind,course,owner,group_id,parent,data,updated) VALUES(?,?,?,NULL,NULL,?,?,?)').bind(ids.get(row.id),row.kind,'sandbox',row.parent?ids.get(row.parent)||null:null,JSON.stringify(data),stamp));
 }
 batch.push(db.prepare("INSERT INTO records(id,kind,course,data,updated) VALUES('fa26-test-source','meta','sandbox',?,?)").bind(JSON.stringify({currentTermTest:true,source:'live',copiedAt:stamp,note:'Current-term content only. No student data copied; test work never reaches Canvas.'}),stamp));
 const data={stage:'current-term',transitionedAt:stamp,backups,testUni:'test-student',studentAccess:'awaiting-owner',liveDispatchEnabled:false};
 batch.push(db.prepare("INSERT INTO records(id,kind,course,data,updated) VALUES('fa2026-launch-transition','meta','live',?,?)").bind(JSON.stringify(data),stamp));
 await db.batch(batch);
 const old=await getRecord('live-source','meta','live');
 await save('meta','live','live-source',{...old,stage:'current-term',preparedAt:stamp,note:'Fall 2026 course workspace. Use Canvas for official submissions until direct submission is validated.'});
 await audit(u.id,'fa2026-cutover','historical-demo-retired');
 await backupCourse('sandbox');await backupCourse('live');return {ok:true,...data};
}

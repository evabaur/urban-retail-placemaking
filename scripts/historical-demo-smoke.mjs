import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {adminPassword} from './test-credentials.mjs';
const origin=process.env.TEST_ORIGIN || 'https://app.example.com';
const demoPassword=JSON.parse(readFileSync(join(homedir(),'.urp_app/historical-demo-access.json'),'utf8')).password;
const sessions=[];
async function call(path,body,cookie='',status=200){
 const r=await fetch(origin+'/api/'+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(90000)});
 const text=await r.text();assert.equal(r.status,status,path+': '+text.slice(0,300));
 const next=r.headers.getSetCookie().find(x=>x.startsWith('urp_session='))?.split(';')[0];
 if(next)sessions.push(next);return {data:JSON.parse(text),cookie:next||cookie};
}
const fingerprint=s=>createHash('sha256').update(JSON.stringify(s)).digest('hex');
try {
 const owner=(await call('login',{uni:'owner01',password:adminPassword()})).cookie;
 const before={};for(const c of ['live','archive']) before[c]=fingerprint((await call('state?course='+c,undefined,owner)).data);
 if(process.argv.includes('--prepare')){
  console.log('ACCOUNTS',JSON.stringify((await call('prepare-historical-demo',{phase:'accounts',password:demoPassword},owner)).data));
  for(let offset=0;offset<10000;){
   const r=(await call('prepare-historical-demo',{phase:'records',offset},owner)).data;
   if(r.ready||r.done)break;offset=r.next;console.log('COPY',offset);
  }
  console.log('READY',JSON.stringify((await call('prepare-historical-demo',{phase:'finish'},owner)).data));
 }
 await call('state?course=sandbox',undefined,'',401);
 await call('login',{uni:'demo-admin',password:'incorrect-demo-password'},'',401);
 const admin=(await call('login',{uni:'demo-admin',password:demoPassword})).cookie;
 const student=(await call('login',{uni:'demo-student',password:demoPassword})).cookie;
 const a=(await call('state?course=sandbox',undefined,admin)).data;
 const s=(await call('state?course=sandbox',undefined,student)).data;
 assert.equal(a.course,'sandbox');assert.equal(s.course,'sandbox');
 assert(a.submission.length>0 && s.submission.length>0 && s.allocation.length>0 && s.user.group_id);
 for(const cookie of [admin,student]) for(const c of ['live','archive','demo']) await call('state?course='+c,undefined,cookie,403);
 for(const path of ['canvas-sync','import-snapshot','import-archive','import-file','prepare-historical-demo','reset-password','account','ai']) await call(path+'?course=sandbox',{},admin,403);
 await call('impersonate?course=sandbox',{id:'staff-jack'},admin,403);
 const allocation=s.allocation.find(x=>a.assignment.find(y=>y.id===x.assignment)?.rubric?.length);
 assert(allocation,'No reviewable historical work');
 const detail=(await call('review?course=sandbox&id='+encodeURIComponent(allocation.id),undefined,student)).data;
 assert(detail.submission.text.length>100);
 await call('review-draft?course=sandbox',{id:allocation.id,scores:{},comments:{},comment:'Demo draft - this does not affect course grades.'},student);
 const saved=(await call('review?course=sandbox&id='+encodeURIComponent(allocation.id),undefined,student)).data;
 assert.equal(saved.draft.comment,'Demo draft - this does not affect course grades.');
 const peer=a.people.find(p=>p.role==='student'&&p.group_id===s.user.group_id&&p.id!==s.user.id);assert(peer);
 const preview=(await call('impersonate?course=sandbox',{id:peer.id},admin)).cookie;
 const peerState=(await call('state?course=sandbox',undefined,preview)).data;
 assert.deepEqual(s.file.map(f=>f.id).sort(),peerState.file.map(f=>f.id).sort());
 const upload=await fetch(origin+'/api/upload?course=sandbox',{method:'POST',headers:{Origin:origin,Cookie:student,'Content-Type':'application/octet-stream','X-File-Name':'Demo workflow check.txt'},body:'Demo test upload. Historical originals are unchanged.'});
 assert.equal(upload.status,200);const uploaded=await upload.json();
 const updatedPeer=(await call('state?course=sandbox',undefined,preview)).data;
 const file=updatedPeer.file.find(f=>f.id===uploaded.id);assert(file?.uploader&&file.updated);
 const bytes=await fetch(origin+'/api/file?course=sandbox&id='+uploaded.id,{headers:{Cookie:preview}});assert.equal(bytes.status,200);assert((await bytes.text()).startsWith('Demo test upload'));
 const round=a.round[0];assert(round);
 await call('round?course=sandbox',{id:round.id,open:false},admin);
 await call('assessment?course=sandbox',{round:round.id,target:peer.id},student,403);
 await call('round?course=sandbox',{id:round.id,open:true},admin);
 await call('assessment?course=sandbox',{round:round.id,target:peer.id,scores:{share:4,reliable:4,quality:4,field:4,collab:4},well:'Demo test: useful contributions.',improve:'Demo test: share updates earlier.',privateNote:'Test only.'},student);
 await call('round?course=sandbox',{id:round.id,open:false,closes:round.closes},admin);
 for(const c of ['live','archive']) assert.equal(fingerprint((await call('state?course='+c,undefined,owner)).data),before[c],c+' changed');
 console.log('VERIFIED',JSON.stringify({students:a.people.filter(p=>p.role==='student').length,submissions:a.submission.length,assignments:a.assignment.length,groups:a.group.length,allocations:a.allocation.length,reviews:a.review.length,teamFiles:a.file.length,sourceFiles:a.sourcefile.length,insights:a.insight.length,student:s.user.name,studentSubmissions:s.submission.length,studentReviews:s.allocation.length,feedback:s.feedback.length,feedbackLocked:s.feedbackLocked,studentFiles:s.file.length,originalsUnchanged:true,accessIsolation:true,reviewDraft:true,teamSharing:true,assessmentWindow:true}));
} finally {for(const cookie of sessions)await call('logout',{},cookie).catch(()=>{});}

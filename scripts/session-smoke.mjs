import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {adminPassword} from './test-credentials.mjs';
const origin=process.env.TEST_ORIGIN||'https://app.example.com';
const password=JSON.parse(readFileSync(join(homedir(),'.urp_app/historical-demo-access.json'),'utf8')).password;
const cookies=[];
async function call(path,body,cookie='',expected=200){
 const r=await fetch(origin+'/api/'+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(90000)});
 const text=await r.text();assert.equal(r.status,expected,path+': '+text.slice(0,250));
 const next=r.headers.getSetCookie().find(x=>x.startsWith('urp_session='))?.split(';')[0];if(next)cookies.push(next);
 return {data:JSON.parse(text),cookie:next||cookie};
}
try{
 const admin=(await call('login',{uni:'demo-admin',password})).cookie;
 const student=(await call('login',{uni:'demo-student',password})).cookie;
 const a=(await call('state?course=sandbox',undefined,admin)).data;
 const s=(await call('state?course=sandbox',undefined,student)).data;
 const e=a.event.find(e=>e.readings?.some(r=>r.type==='required'));assert(e,'No populated required readings');
 assert.deepEqual(s.event.find(x=>x.id===e.id).readings,e.readings);
 assert(s.event.some(e=>e.assignmentIds?.length));
 assert(s.submission.every(x=>x.owner===s.user.id));
 assert(s['submission-status'].every(x=>x.owner===s.user.id));
 await call('session-content?course=sandbox',{},student,403);
 await call('session-content?course=live',{},admin,403);
 const original={id:e.id,readings:e.readings,assignmentIds:e.assignmentIds||[],preparation:e.preparation||'',contentSource:e.contentSource||''};
 await call('session-content?course=sandbox',{...original,readings:[{title:'Unsafe',type:'required',url:'javascript:alert(1)'}]},admin,400);
 await call('session-content?course=sandbox',{...original,assignmentIds:['outside-this-course']},admin,400);
 try{
  await call('session-content?course=sandbox',{...original,preparation:'Session editor verification'},admin);
  const changed=(await call('state?course=sandbox',undefined,student)).data;
  assert.equal(changed.event.find(x=>x.id===e.id).preparation,'Session editor verification');
 }finally{await call('session-content?course=sandbox',original,admin);}
 console.log('PASS: session content visible, editing persisted/restored, student writes blocked, cross-course and unsafe links blocked, own submissions only.');
 console.log('DEMO',JSON.stringify({sessions:s.event.length,readings:s.event.reduce((n,e)=>n+(e.readings?.length||0),0),linkedAssignments:s.event.reduce((n,e)=>n+(e.assignmentIds?.length||0),0),sampleDue:s.assignment[0]?.due}));
 if(process.argv.includes('--sync-live')){
  const owner=(await call('login',{uni:'owner01',password:adminPassword()})).cookie;
  const live=(await call('state?course=live',undefined,owner)).data;
  for(const a of live.assignment.filter(a=>a.canvasId&&a.published!==false)){
   const result=(await call('canvas-submissions?course=live',{id:a.id},owner)).data;
   console.log('STATUS REFRESH',a.title,JSON.stringify(result));
  }
  const after=(await call('state?course=live',undefined,owner)).data;
  assert(after['submission-status'].length>0);
  console.log('LIVE',JSON.stringify({sessions:after.event.length,readings:after.event.reduce((n,e)=>n+(e.readings?.length||0),0),statusSnapshots:after['submission-status'].length}));
 }
}finally{for(const cookie of cookies)await call('logout',{},cookie).catch(()=>{});}

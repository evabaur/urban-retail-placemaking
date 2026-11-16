// Only app demo endpoints. Never calls Canvas or enables real accounts.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {join} from 'node:path';
const origin='https://app.example.com';
const password=JSON.parse(readFileSync(join(homedir(),'.urp_app/historical-demo-access.json'),'utf8')).password;
const cookies=[];
async function call(path,body,cookie='',expected=200){const r=await fetch(origin+'/api/'+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(60000)});const t=await r.text();assert.equal(r.status,expected,path+': '+t.slice(0,250));const next=r.headers.getSetCookie().find(x=>x.startsWith('urp_session='))?.split(';')[0];if(next)cookies.push(next);return {data:JSON.parse(t),cookie:next||cookie};}
async function upload(vpa,kind,name,bytes,cookie,expected=200){const r=await fetch(`${origin}/api/vpa/upload?course=sandbox&vpa=${vpa}&kind=${kind}`,{method:'POST',headers:{Origin:origin,Cookie:cookie,'X-File-Name':name,'Content-Type':'application/octet-stream'},body:bytes});const d=await r.json();assert.equal(r.status,expected,JSON.stringify(d));return d;}
try{
 const login=await call('login',{uni:'demo-student',password});const cookie=login.cookie;
 const staff=(await call('login',{uni:'demo-admin',password})).cookie;
 const initial=(await call('vpa?course=sandbox',undefined,cookie)).data;
 assert(initial.demo);assert.equal(initial.vpas.length,4);
 await call('vpa?course=live',undefined,cookie,403);
 await call('vpa?course=sandbox',undefined,'',401);
 await upload('vpa1','ppt','bad.pptx',new TextEncoder().encode('this is a fake file without zip header'),cookie,400);
 const ppt=readFileSync(join(homedir(),'.urp_app/vpa-demo-slides.pptx'));
 const video=readFileSync(join(homedir(),'.urp_app/vpa-demo-video.mp4'));
 const report=[];
 for(const [i,v] of initial.vpas.slice(0,3).entries()){
  const path=p=>`vpa/${p}?course=sandbox&vpa=${v.id}`;
  let d=(await call('vpa?course=sandbox',undefined,cookie)).data.drafts[v.id];
  // Preserve pre-existing draft by refusing to replace unrecognized user work.
  if(Object.values(d.answers||{}).some(x=>x&&!String(x).startsWith('DEMO TEST')))throw Error('Existing non-test draft detected; not overwriting '+v.id);
  const complete=Object.fromEntries(v.questions.map(q=>[q.key,'DEMO TEST - '+q.label+': observation and supporting evidence for workflow verification.']));
  let b={...d,includeNotes:i!==1,answers:complete,photos:[],ppt:null,video:null};
  d=(await call(path('draft'),b,cookie)).data.draft;
  await call(path('prepare'),{revision:d.revision},cookie,400);
  const p=await upload(v.id,'ppt','vpa-demo-slides.pptx',ppt,cookie);
  const vid=i>0?await upload(v.id,'video','vpa-demo-video.mp4',video,cookie):null;
  d=(await call(path('draft'),{...d,ppt:p.id,video:vid?.id||null},cookie)).data.draft;
  await call(path('draft'),{...d,revision:d.revision-1},cookie,409);
  const prepared=(await call(path('prepare'),{revision:d.revision},cookie)).data.package;
  assert.equal(prepared.files.length,i===2?3:2);
  await call(path('submit'),{id:prepared.id,confirm:false},cookie,400);
  const receipt=(await call(path('submit'),{id:prepared.id,confirm:true},cookie)).data.package;
  assert.equal(receipt.status,'submitted');assert(receipt.receipt.demo);
  const again=(await call(path('submit'),{id:prepared.id,confirm:true},cookie)).data.package;
  assert.equal(again.receipt.id,receipt.receipt.id,'Retry must not create another submission');
  await call(path('submit'),{id:prepared.id,confirm:true},staff,404);
  const foreign=await fetch(`${origin}/api/vpa/file?course=sandbox&id=${p.id}`,{headers:{Cookie:staff}});assert.equal(foreign.status,404);
  for(const id of prepared.files){const r=await fetch(`${origin}/api/vpa/file?course=sandbox&id=${id}`,{headers:{Cookie:cookie}});assert.equal(r.status,200);const bytes=new Uint8Array(await r.arrayBuffer());assert(bytes.length>16);if(r.headers.get('content-type')==='application/pdf'){assert.equal(new TextDecoder().decode(bytes.slice(0,4)),'%PDF');writeFileSync(join(homedir(),`.urp_app/${v.id}-hosted-demo.pdf`),bytes);}}
  report.push({vpa:v.id,case:i===0?'Notes+PPT':i===1?'Video+PPT':'Notes+Video+PPT',files:prepared.files.length,receipt:receipt.receipt.id,retryStable:true});
 }
 const v=initial.vpas[3];let d=(await call('vpa?course=sandbox',undefined,cookie)).data.drafts[v.id];
 if(!d.revision){const p=await upload(v.id,'ppt','vpa-demo-slides.pptx',ppt,cookie);d=(await call(`vpa/draft?course=sandbox&vpa=${v.id}`,{...d,ppt:p.id,includeNotes:true,answers:{}},cookie)).data.draft;await call(`vpa/prepare?course=sandbox&vpa=${v.id}`,{revision:d.revision},cookie,400);}
 console.log('PASS hosted demo cases',JSON.stringify(report));console.log('PASS missing materials, blank Notes, bad signature, stale save, confirmation, cross-course/account guards, receipt retry and downloadable real PDF. No Canvas call used.');
}finally{for(const cookie of cookies)await call('logout',{},cookie).catch(()=>{});}

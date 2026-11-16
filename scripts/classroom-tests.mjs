import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {resolve,dirname} from 'node:path';import vm from 'node:vm';import ts from 'typescript';import {DatabaseSync} from 'node:sqlite';import {webcrypto} from 'node:crypto';
const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE records(id TEXT PRIMARY KEY,kind TEXT,course TEXT,owner TEXT,group_id TEXT,parent TEXT,data TEXT,updated TEXT)');
function prepare(sql){let args=[];return{bind(...a){args=a;return this},async all(){return{results:db.prepare(sql).all(...args)}},async first(){return db.prepare(sql).get(...args)||null},async run(){return{meta:db.prepare(sql).run(...args)}}};}
const env={DB:{prepare,async batch(items){return Promise.all(items.map(i=>i.run()))}}};let fail=false,rows=[],calls=0;
const cache=new Map();function load(file){file=resolve(file);if(cache.has(file))return cache.get(file).exports;const mod={exports:{}};cache.set(file,mod);const code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const req=s=>s==='cloudflare:workers'?{env}:s==='./integrations'?{canvas:async()=>{calls++;if(fail)throw Error('offline');return rows}}:load(resolve(dirname(file),s+'.ts'));vm.runInNewContext(`(function(require,module,exports){${code}\n})`,{console,crypto:webcrypto,Date,TextEncoder,Response,Request,URL,AbortSignal})(req,mod,mod.exports);return mod.exports;}
const s=load('lib/server.ts'),{reserveTeamUpload:reserve,teamStorage}=load('lib/team-storage.ts'),{refreshPersonalCanvas:refresh}=load('lib/personal-canvas.ts');
const u={id:'s1',course:'live',role:'student',canvas_id:123,group_id:'g1'};
await s.save('file','live','big',{size:999_999_990},u.id,u.group_id);
const results=await Promise.allSettled([reserve(u,'r1',8),reserve(u,'r2',8)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal((await teamStorage('live','g1')).reserved,8);
await assert.rejects(reserve(u,'r3',3),/1 GB/);await reserve({...u,group_id:'g2'},'other',20);await assert.rejects(reserve(u,'nan',NaN));
await s.save('assignment','live','a1',{canvasId:100,published:true});await s.save('assignment','live','hidden',{canvasId:101,published:false});
rows=[{user_id:123,assignment_id:100,workflow_state:'submitted',submitted_at:'2026-10-25T12:00:00Z',submission_type:'online_upload'},{user_id:999,assignment_id:100,workflow_state:'unsubmitted'}];
assert.equal((await refresh(u)).checked,1);const id='submission-status:100:123';assert.equal((await s.getRecord(id,'submission-status','live')).workflowState,'submitted');assert.equal((await s.records('submission-status','live')).length,1);
await refresh(u);assert.equal(calls,1,'short cache should prevent a duplicate upstream call');
await s.run("DELETE FROM records WHERE kind='canvas-status-cache'");fail=true;await assert.rejects(refresh(u),/offline/);assert.equal((await s.getRecord(id,'submission-status','live')).workflowState,'submitted');
fail=false;rows=[];assert.equal((await refresh(u)).partial,true);assert.equal((await s.getRecord(id,'submission-status','live')).workflowState,'submitted');
await assert.rejects(refresh({...u,course:'sandbox'}));await assert.rejects(refresh({...u,canvas_id:null}));
console.log('PASS atomic team quota, concurrent reservation, cross-team isolation, personal status/cache, missing-row/failure preservation and sandbox rejection');

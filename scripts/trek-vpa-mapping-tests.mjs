import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {readFileSync} from 'node:fs';
registerHooks({resolve(spec,context,next){return next(spec==='./vpa'?'./vpa.ts':spec,context);}});
const {NOTE_CATEGORIES,NOTE_FIELDS,trekAnswers,trekPhotos,importTrekAnswers}=await import('../lib/trek-notes.ts');
const {VPAS}=await import('../lib/vpa.ts');
const keys=NOTE_CATEGORIES.flatMap(c=>c.keys);
assert.equal(keys.length,new Set(keys).size);
for(const v of VPAS)for(const q of v.questions){assert(keys.includes(q.key),`${q.key} must have a notebook box`);assert(NOTE_FIELDS[q.key]);}
const old={fields:{narrative:'District, not brand story'},stores:[{id:'a',fields:{name:'A',narrative:'Story A',archetype_why:'Layout A'},photos:['image-a']},{id:'b',fields:{name:'B',narrative:'Story B'},photos:['image-b']}],updated:''};
const backup=JSON.stringify(old),mapped=trekAnswers(old);
assert(mapped.narrative.includes('Story A')&&mapped.narrative.includes('Story B'));assert(!mapped.narrative.includes('District'));assert.equal(mapped.district_narrative,'District, not brand story');assert.equal(JSON.stringify(old),backup);
assert.equal(trekAnswers({...old,notes:{narrative:''}}).narrative,'','Explicitly cleared notes stay empty');
assert.deepEqual(trekPhotos(old),['image-a','image-b']);assert.deepEqual(trekPhotos({...old,notePhotos:[]}),[]);
for(const v of VPAS){const d={...old,notes:Object.fromEntries(v.questions.map(q=>[q.key,'Box '+q.key]))};const result=importTrekAnswers(v,{first_impression:'Keep mine'},d);for(const q of v.questions)assert.equal(result.answers[q.key],q.key==='first_impression'?'Keep mine':'Box '+q.key);assert.equal(result.count,v.questions.length-1);}
assert.throws(()=>importTrekAnswers(VPAS[0],{}, {...old,notes:{store:'x'.repeat(6001)}}));
const workspace=readFileSync(new URL('../app/workspace.tsx',import.meta.url),'utf8');
const notebook=readFileSync(new URL('../app/trek-workspace.tsx',import.meta.url),'utf8');
const editor=readFileSync(new URL('../app/vpa-workspace.tsx',import.meta.url),'utf8');
assert(workspace.includes('["vpa", "VPA", FileText]'));assert(workspace.includes('["reviews", "Peer reviews", NotebookPen]'));assert(!workspace.includes('["feedback", "Feedback"'));
assert(!notebook.includes('requiredStore'));assert(!notebook.includes('<small>Required</small>'));assert(!notebook.includes('VpaWorkspace'));assert(!editor.includes('Import a store observation'));
console.log('PASS all VPA fields mapped directly; trek-wide multi-store legacy compatibility, optional categories, no destructive migration, preserved answers, isolated navigation.');

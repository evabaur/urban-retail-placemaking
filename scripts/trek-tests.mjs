import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {draftKey, emptyDraft} from '../lib/trek-storage.ts';
import {TREKS} from '../lib/trek-plan.ts';
import {FRAMEWORKS} from '../lib/trek-frameworks.ts';

const keys = new Set();
for (const course of ['live','demo']) for (const user of ['student-a','student-b','staff']) {
  for (const trek of [...TREKS.map(t=>t.id),'independent']) keys.add(draftKey(course,user,trek));
}
assert.equal(keys.size,24,'Every user/course/trek gets its own key');
assert.notEqual(draftKey('a:b','c','d'), draftKey('a','b:c','d'),'Delimiter-safe keys');
const a=emptyDraft(),b=emptyDraft(); a.fields.narrative='test'; a.stores.push({id:'test',fields:{},photos:[]});
assert.deepEqual(b,{fields:{},stores:[],updated:''},'Fresh drafts share no mutable state');
assert.equal(new Set(TREKS.map(t=>t.id)).size,3);
assert.ok(TREKS.every(t=>t.stops.length>0));
for(const key of ['semiotic-space','retail-archetypes']) assert.ok(FRAMEWORKS.some(f=>f.key===key));
console.log('PASS 24 isolated notebook keys, delimiter safety, independent draft state, three itineraries and model references.');
const workspace=readFileSync(new URL('../app/workspace.tsx',import.meta.url),'utf8');
const trek=readFileSync(new URL('../app/trek-workspace.tsx',import.meta.url),'utf8');
assert.ok(!workspace.includes('"today"')&&!workspace.includes('"progress"'),'Removed student routes cannot be reached');
assert.ok(workspace.includes('useState("sessions")'),'Student entry is Sessions');
assert.ok(workspace.includes('["attendance", "Attendance", CalendarCheck]'),'Staff attendance retained');
assert.ok(!trek.includes("part==='debrief'")&&!trek.includes("['debrief'"),'Debrief removed');
console.log('PASS simplified student navigation, default landing, retained attendance and removed Debrief.');

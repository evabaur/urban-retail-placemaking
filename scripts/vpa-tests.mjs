import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {VPAS,freshVpa,packageErrors,importAnswers,fileSpec,validSignature} from '../lib/vpa.ts';
for(const v of VPAS){
 const d=freshVpa();assert.equal(packageErrors(v,d).length,2);d.ppt='ppt';assert.equal(packageErrors(v,d).length,1);
 d.video='video';assert.equal(packageErrors(v,d).length,0);d.includeNotes=true;assert.ok(packageErrors(v,d).length);
 d.answers=Object.fromEntries(v.questions.map(q=>[q.key,'Observed evidence']));assert.equal(packageErrors(v,d).length,0);d.video=null;assert.equal(packageErrors(v,d).length,0);
 d.ppt=null;assert.ok(packageErrors(v,d).length);d.ppt='ppt';d.answers.store=' \n ';assert.ok(packageErrors(v,d).length);
 const source={name:'Store A',first_impression:'Original impression',synthesis:'Original insight',codes:'Codes',narrative:'Narrative'};
 const result=importAnswers(v,{first_impression:'My existing answer'},source);assert.equal(result.answers.first_impression,'My existing answer');assert.equal(result.answers.store,'Store A');assert.equal(source.name,'Store A');assert.ok(!Object.hasOwn(result.answers,'codes')||v.id==='vpa3');
}
assert.throws(()=>fileSpec('ppt','slides.pdf'));assert.throws(()=>fileSpec('video','video.mov'));assert.equal(fileSpec('video','film.mp4').max,64*1024*1024);
assert.equal(validSignature('mp4',new Uint8Array([0,0,0,24,102,116,121,112,0,0,0,0,0,0,0,0])),true);assert.equal(validSignature('pptx',new TextEncoder().encode('not a PowerPoint')),false);
const api=readFileSync(new URL('../lib/vpa-server.ts',import.meta.url),'utf8');assert.ok(api.includes("if(course!=='live')"));assert.ok(api.includes("u.role==='student'&&!u.actor"));assert.ok(api.includes('VPA_CANVAS_SUBMIT_ENABLED'));assert.ok(api.includes("p.status==='unknown'||p.status==='submitting'"));
console.log('PASS VPA materials matrix, four question sets, blank-answer rejection, non-destructive selective import, upload type checks and live/demo guards.');

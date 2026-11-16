import {createVpaPdf} from '../lib/vpa-pdf.ts';
import {VPAS,freshVpa} from '../lib/vpa.ts';
import {readFileSync,writeFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {join} from 'node:path';
const d=freshVpa();d.includeNotes=true;
for(const q of VPAS[0].questions)d.answers[q.key]=q.key==='store'?'Demo store — Montréal':q.key==='visited'?'25 October 2026':'DEMO TEST. The window display introduces a material story. A tactile demonstration invites customers to compare surfaces. I observed visitors pausing at the display; the inference about memory is separate from that observation.';
const bytes=await createVpaPdf(VPAS[0],d,'Demo Student','demo-student',readFileSync(new URL('../public/fonts/NotoSans-Regular.ttf',import.meta.url)),[{bytes:readFileSync(new URL('../public/trek/logo.png',import.meta.url)),type:'image/png',caption:'Demo fixture - URP logo, not field evidence'}],true);
writeFileSync(join(homedir(),'.urp_app/vpa-demo-notes.pdf'),bytes);console.log('PDF fixture generated, bytes:',bytes.length);

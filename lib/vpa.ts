export type Question={key:string;label:string;hint:string;importKey?:string};
export type Vpa={id:string;canvasId:number;title:string;summary:string;due:string;questions:Question[]};
const intro:Question[]=[
 {key:'store',label:'Store and location',hint:'Name the retailer and the location you observed.',importKey:'name'},
 {key:'visited',label:'Date of your observation',hint:'When did you visit?'},
 {key:'first_impression',label:'First impression',hint:'What did you notice before analyzing the experience?',importKey:'first_impression'},
];
export const VPAS:Vpa[]=[
 {id:'vpa1',canvasId:2000033,title:'Observation 1: The Experience',summary:'What makes a visit memorable',due:'2026-11-09T17:00:00Z',questions:[...intro,
 {key:'sems',label:'Which parts of the experience stood out?',hint:'Consider the senses, emotions, ideas and actions the store invites.',importKey:'sems'},
 {key:'sem_why',label:'Explain one element in detail',hint:'Pick a specific, ideally less obvious, element and explain how it works.',importKey:'sem_why'},
 {key:'impact',label:'Customer response and evidence',hint:'What behavior might it create? Separate what you observed from what you infer.'},
 {key:'synthesis',label:'Your central insight',hint:'What does this tell us about the retailer’s strategy?',importKey:'synthesis'}]},
 {id:'vpa2',canvasId:2000044,title:'Observation 2: The Story',summary:'How the store tells the brand’s story',due:'2026-11-16T17:00:00Z',questions:[...intro,
 {key:'narrative',label:'What story does the brand tell?',hint:'Explain how this story appears in the store, with specific evidence.',importKey:'narrative'},
 {key:'narrative_register',label:'Practical and emotional appeal',hint:'Which needs or feelings does the story speak to?',importKey:'narrative_register'},
 {key:'target',label:'Who is the store designed for?',hint:'Describe the intended visitor and how the space signals it.'},
 {key:'synthesis',label:'Your central insight',hint:'Connect the story to the brand’s strategy.',importKey:'synthesis'}]},
 {id:'vpa3',canvasId:2000055,title:'Observation 3: The Space',summary:'A walk-through of spatial choices',due:'2026-11-23T17:00:00Z',questions:[...intro,
 {key:'walkthrough',label:'Walk us through the space',hint:'Approach, facade, window, entrance, layout and flow. What stands out?'},
 {key:'archetype',label:'Layout and spatial form',hint:'How is the space organized, and to what effect?',importKey:'archetype_why'},
 {key:'codes',label:'Materials, signs and style',hint:'What do the design choices communicate about the brand?',importKey:'codes'},
 {key:'auxiliary',label:'Social spaces',hint:'Are there spaces for lingering or events? Do they help the brand? If absent, say so.'},
 {key:'synthesis',label:'Your central insight',hint:'Connect the physical design to retail strategy, using observed evidence.',importKey:'synthesis'}]},
 {id:'vpa4',canvasId:2000121,title:'Observation 4: The People',summary:'Staff, customers and interaction',due:'2026-11-30T17:00:00Z',questions:[...intro,
 {key:'roles',label:'Staff roles',hint:'What role are staff expected to play?'},
 {key:'rituals',label:'Language and routines',hint:'Did you notice brand-specific language or routines? If none, say so.'},
 {key:'interaction',label:'Interactions',hint:'Describe a concrete interaction. How is it encouraged and to what end?',importKey:'interaction'},
 {key:'relate',label:'Community',hint:'How does the experience connect people or communities?'},
 {key:'synthesis',label:'Your central insight',hint:'Explain how these interactions contribute to retail strategy.',importKey:'synthesis'}]},
];
export type VpaDraft={revision:number;includeNotes:boolean;answers:Record<string,string>;photos:string[];ppt:string|null;video:string|null;importedFrom?:string};
export const freshVpa=():VpaDraft=>({revision:0,includeNotes:false,answers:{},photos:[],ppt:null,video:null});
export const vpaById=(id:string)=>VPAS.find(v=>v.id===id);
export function missingAnswers(v:Vpa,d:VpaDraft){return v.questions.filter(q=>!d.answers[q.key]?.trim()).map(q=>q.label);}
export function packageErrors(v:Vpa,d:VpaDraft){
 const errors:string[]=[];
 if(!d.ppt)errors.push('Upload your PowerPoint presentation.');
 if(!d.includeNotes&&!d.video)errors.push('Include completed Notes or an MP4 video (or both).');
 if(d.includeNotes){const missing=missingAnswers(v,d);if(missing.length)errors.push('Complete Notes: '+missing.join('; '));}
 return errors;
}
export function importAnswers(v:Vpa,existing:Record<string,string>,fields:Record<string,string>){
 const next={...existing};let count=0;
 for(const q of v.questions) if(q.importKey&&fields[q.importKey]?.trim()&&!next[q.key]?.trim()){next[q.key]=fields[q.importKey];count++;}
 return {answers:next,count};
}
export const FILE_LIMITS={ppt:25*1024*1024,video:64*1024*1024,photo:6*1024*1024,pdf:16*1024*1024};
export function fileSpec(kind:string,name:string){
 const ext=name.split('.').pop()?.toLowerCase()||'';
 const m:Record<string,Record<string,string>>={ppt:{ppt:'application/vnd.ms-powerpoint',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation'},video:{mp4:'video/mp4'},photo:{jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png'}};
 const type=m[kind]?.[ext];if(!type)throw Error('Unsupported file type.');return {ext,type,max:FILE_LIMITS[kind as keyof typeof FILE_LIMITS]};
}
export function validSignature(ext:string,b:Uint8Array){
 const at=(i:number,s:number[])=>s.every((v,j)=>b[i+j]===v);
 if(ext==='pptx')return at(0,[80,75,3,4]);
 if(ext==='ppt')return at(0,[208,207,17,224,161,177,26,225]);
 if(ext==='mp4')return at(4,[102,116,121,112]);
 if(ext==='png')return at(0,[137,80,78,71,13,10,26,10]);
 if(ext==='jpg'||ext==='jpeg')return at(0,[255,216,255]);
 return false;
}

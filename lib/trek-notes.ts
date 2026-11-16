import {VPAS} from './vpa';
import type {Vpa} from './vpa';
import type {FieldDraft} from './trek-storage';

export const NOTE_CATEGORIES=[
 {id:'visit',title:'Visit & first impressions',description:'Where you went and what caught your attention.',keys:['store','visited','first_impression','feeling']},
 {id:'district',title:'The neighborhood',description:'People, physical character and local tensions.',keys:['district','district_narrative','people','physical','tension']},
 {id:'experience',title:'Experience makers',description:'Sense, Feel, Think, Act and Relate.',keys:['sems','sem_why','impact']},
 {id:'narrative',title:'Brand stories',description:'Narrative, motivations and the world the brand creates.',keys:['narrative','narrative_register','target']},
 {id:'space',title:'Space & signs',description:'Layout, retail archetypes, visual codes and social spaces.',keys:['walkthrough','archetype','codes','auxiliary','space_type','space_type_why','harmony_disruption','trad_contemp','exclusive_accessible','transactional_experiential','local_global']},
 {id:'social',title:'People & interaction',description:'Staff performances, rituals and relationships.',keys:['roles','rituals','interaction','relate']},
 {id:'insight',title:'Ideas to take away',description:'Your central insight, questions or anything unexpected.',keys:['synthesis','curious','other']},
];
export const NOTE_FIELDS:Record<string,{label:string;hint:string}>=Object.fromEntries(VPAS.flatMap(v=>v.questions).map(q=>[q.key,{label:q.label,hint:q.hint}]));
Object.assign(NOTE_FIELDS,{
 store:{label:'Stores and locations',hint:'Use store names in your notes when comparing several stops.'},
 synthesis:{label:'Your central insight',hint:'What surprised you? What does it tell you about retail strategy?'},
 feeling:{label:'Feeling on entry',hint:'How did the atmosphere affect you?'},
 district:{label:'District / neighborhood',hint:''},district_narrative:{label:'What is this district about?',hint:''},people:{label:'Who is here?',hint:'Residents, workers, shoppers and visitors.'},physical:{label:'Physical character',hint:'Facades, materials, signage and scale.'},tension:{label:'Tensions in the district',hint:'Old/new, local/global, community/commerce.'},
 space_type:{label:'Service-space semiotic',hint:'Theatre, Circus, Carnival, Flat Space, Mixed, or your own description.'},space_type_why:{label:'Staff–customer relationship',hint:'How are their roles arranged in the space?'},
 harmony_disruption:{label:'Harmony / disruption',hint:''},trad_contemp:{label:'Traditional / contemporary',hint:''},exclusive_accessible:{label:'Exclusive / accessible',hint:''},transactional_experiential:{label:'Transactional / experiential',hint:''},local_global:{label:'Local / global',hint:''},curious:{label:'Questions to explore',hint:''},other:{label:'Anything else',hint:''},
});

// Read old per-store notebooks without changing or deleting the originals.
// An explicit new empty value stays empty rather than reviving an old answer.
export function trekAnswers(d:FieldDraft):Record<string,string>{
 const out:Record<string,string>={};
 for(const [target,key] of Object.entries({district:'district',district_narrative:'narrative',people:'people',physical:'physical',tension:'tension',curious:'curious'}))if(d.fields[key])out[target]=d.fields[key];
 for(const key of Object.keys(NOTE_FIELDS)){
  if(['district','district_narrative','people','physical','tension','curious'].includes(key))continue;
  const oldKey=key==='store'?'name':key==='archetype'?'archetype_why':key;
  const values=d.stores.flatMap((s,i)=>s.fields[oldKey]?.trim()?[{name:s.fields.name||`Stop ${i+1}`,text:s.fields[oldKey]}]:[]);
  if(values.length)out[key]=key==='store'?values.map(x=>x.text).join('\n'):values.map(x=>values.length>1?`${x.name}\n${x.text}`:x.text).join('\n\n');
 }
 return {...out,...d.notes};
}
export function trekPhotos(d:FieldDraft):string[]{return d.notePhotos??[...new Set(d.stores.flatMap(s=>s.photos))];}
export function importTrekAnswers(v:Vpa,existing:Record<string,string>,d:FieldDraft){
 const source=trekAnswers(d),answers={...existing};let count=0;
 for(const q of v.questions)if(!answers[q.key]?.trim()&&source[q.key]?.trim()){
  if(source[q.key].length>6000)throw Error(`Shorten the trek note for “${q.label}” to 6,000 characters before importing.`);
  answers[q.key]=source[q.key];count++;
 }
 return {answers,count};
}

import {FieldDraft,draftKey} from './trek-storage';
export type CloudNotebook={draft:FieldDraft;revision:number;backedUp?:boolean};
export async function cloudNotebook(key:string,draft?:FieldDraft,revision?:number):Promise<CloudNotebook>{
 const [,course,,trek]=JSON.parse(key);
 const r=await fetch(`/api/trek/notes?course=${encodeURIComponent(course)}&trek=${encodeURIComponent(trek)}`,{method:draft?'POST':'GET',cache:'no-store',headers:{'Content-Type':'application/json'},body:draft?JSON.stringify({draft,revision}):undefined,signal:AbortSignal.timeout(45000)});
 const data:any=await r.json();if(!r.ok)throw Object.assign(new Error(data.error||'Cloud save failed.'),{status:r.status});return data as CloudNotebook;
}
export async function readCloudDraft(course:string,user:string,trek:string){return (await cloudNotebook(draftKey(course,user,trek))).draft;}

// Swappable local adapter: deliberately no dependency on course-app APIs.
export type StoreNote = { id: string; fields: Record<string,string>; photos: string[] };
export type FieldDraft = { fields: Record<string,string>; stores: StoreNote[]; updated: string; notes?:Record<string,string>; notePhotos?:string[] };
export const emptyDraft = (): FieldDraft => ({ fields:{}, stores:[], updated:'' });
export const draftKey = (course:string,user:string,trek:string) => JSON.stringify(['urp-trek-v1',course,user,trek]);
function database(): Promise<IDBDatabase> {
  return new Promise((resolve,reject)=>{
    const r=indexedDB.open('urp-field-notes-v1',1);
    r.onupgradeneeded=()=>r.result.createObjectStore('drafts');
    r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error);
  });
}
export async function readDraft(key:string):Promise<FieldDraft> {
  const db=await database();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('drafts','readonly'); const r=tx.objectStore('drafts').get(key);
    r.onsuccess=()=>resolve(r.result || emptyDraft()); r.onerror=()=>reject(r.error); tx.oncomplete=()=>db.close();
  });
}
export async function writeDraft(key:string,draft:FieldDraft) {
  const db=await database();
  return new Promise<void>((resolve,reject)=>{
    const tx=db.transaction('drafts','readwrite'); tx.objectStore('drafts').put(draft,key);
    tx.oncomplete=()=>{db.close();resolve();}; tx.onerror=()=>{db.close();reject(tx.error);}; tx.onabort=()=>reject(tx.error);
  });
}
export async function compressPhoto(file:File):Promise<string> {
  if (!file.type.startsWith('image/') || file.size>20*1024*1024) throw new Error('Choose an image under 20 MB.');
  const url=URL.createObjectURL(file);
  try {
    const img=await new Promise<HTMLImageElement>((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(new Error('This image format cannot be opened. Try JPEG or PNG.'));i.src=url;});
    const scale=Math.min(1,1200/Math.max(img.naturalWidth,img.naturalHeight));
    const canvas=document.createElement('canvas'); canvas.width=Math.round(img.naturalWidth*scale); canvas.height=Math.round(img.naturalHeight*scale);
    const ctx=canvas.getContext('2d'); if(!ctx)throw new Error('Image processing unavailable.');
    ctx.drawImage(img,0,0,canvas.width,canvas.height);return canvas.toDataURL('image/jpeg',.72);
  } finally {URL.revokeObjectURL(url);}
}

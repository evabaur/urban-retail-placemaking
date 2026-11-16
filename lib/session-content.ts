import { check, string, getRecord, save } from './server';
import { safeReadingUrl } from './course-plan';
export async function saveSessionContent(course:string, b:any) {
  const id=string(b.id,160), event=await getRecord(id,'event',course);
  check(event,'Session not found.',404);
  check(Array.isArray(b.readings) && b.readings.length<=40,'Use at most 40 readings.');
  const readings=b.readings.map((r:any,i:number)=>{
    const title=string(r.title,500),url=string(r.url||'',2000);
    check(title && (!url || safeReadingUrl(url)),'Reading links must use HTTPS.');
    check(['required','recommended'].includes(r.type),'Invalid reading type.');
    return {id:'reading-'+i,title,url,type:r.type};
  });
  check(Array.isArray(b.assignmentIds) && b.assignmentIds.length<=40,'Invalid assignment list.');
  const assignmentIds=[...new Set(b.assignmentIds)] as string[];
  for(const aid of assignmentIds) check(typeof aid==='string' && await getRecord(aid,'assignment',course),'Assignment outside this course.',400);
  await save('event',course,id,{...event,readings,assignmentIds,preparation:string(b.preparation||'',5000),contentSource:string(b.contentSource||'Teaching team',500)});
  return {ok:true};
}

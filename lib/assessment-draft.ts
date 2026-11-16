import {User,check,getRecord,one,run,now,string} from './server';
export async function assessmentDraft(req:Request,u:User){
 const url=new URL(req.url),b:any=req.method==='POST'?await req.json():Object.fromEntries(url.searchParams),round=string(b.round,200),target=string(b.target,100);
 check(u.role==='student'&&u.group_id,'Student team only.',403);
 const person=await one<User>('SELECT * FROM users WHERE id=? AND course=? AND group_id=?',target,u.course,u.group_id);check(person,'Teammate not found.',404);
 const r=await getRecord(round,'round',u.course);check(r,'Round not found.',404);
 const id=`assessment-draft:${round}:${u.id}:${target}`,old=await getRecord(id,'assessment-draft',u.course);
 if(req.method==='GET')return Response.json({draft:old||{revision:0,scores:{},well:'',improve:'',privateNote:''}},{headers:{'Cache-Control':'no-store'}});
 check(r.open&&(!r.closes||Date.parse(r.closes)>Date.now()),'This assessment round is closed.',403);
 check(Number.isSafeInteger(b.revision)&&b.revision>=0,'Invalid revision.');
 const scores:Record<string,number>={};for(const k of ['share','reliable','quality','field','collab'])if(b.scores?.[k]!==undefined){check(Number.isInteger(b.scores[k])&&b.scores[k]>=1&&b.scores[k]<=5,'Invalid score.');scores[k]=b.scores[k];}
 const data={revision:b.revision+1,scores,well:string(b.well||'',4000),improve:string(b.improve||'',4000),privateNote:string(b.privateNote||'',4000),round,target};
 const result=b.revision===0?await run('INSERT OR IGNORE INTO records(id,kind,course,owner,parent,data,updated) VALUES(?,?,?,?,?,?,?)',id,'assessment-draft',u.course,u.id,round,JSON.stringify(data),now()):await run("UPDATE records SET data=?,updated=? WHERE id=? AND course=? AND owner=? AND json_extract(data,'$.revision')=?",JSON.stringify(data),now(),id,u.course,u.id,b.revision);
 check(result.meta.changes===1,'Draft changed on another device. Keep your text and reload before saving.',409);
 return Response.json({draft:data},{headers:{'Cache-Control':'no-store'}});
}

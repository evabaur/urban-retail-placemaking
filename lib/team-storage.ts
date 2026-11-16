import {run,one,check,now,User} from './server';
export const TEAM_STORAGE_LIMIT=1_000_000_000;
export async function reserveTeamUpload(u:User,id:string,size:number){
 check(u.group_id&&Number.isSafeInteger(size)&&size>0,'Invalid upload.');
 // One SQL statement serializes competing uploads. Reservations count until
 // finalized or explicitly released; a crashed worker cannot overbook capacity.
 const result=await run(`INSERT INTO records(id,kind,course,owner,group_id,data,updated)
 SELECT ?,'file-reservation',?,?,?,?,? WHERE
 (SELECT COALESCE(SUM(CAST(json_extract(data,'$.size') AS INTEGER)),0) FROM records
 WHERE course=? AND group_id=? AND kind IN ('file','file-reservation'))+?<=?`,
 id,u.course,u.id,u.group_id,JSON.stringify({size}),now(),u.course,u.group_id,size,TEAM_STORAGE_LIMIT);
 check(result.meta.changes===1,'Your team has reached its shared 1 GB storage limit. Contact the teaching team.',413);
}
export async function teamStorage(course:string,group:string|null){
 if(!group)return {used:0,reserved:0,limit:TEAM_STORAGE_LIMIT};
 const r=await one<{used:number;reserved:number}>(`SELECT
 COALESCE(SUM(CASE WHEN kind='file' THEN json_extract(data,'$.size') ELSE 0 END),0) used,
 COALESCE(SUM(CASE WHEN kind='file-reservation' THEN json_extract(data,'$.size') ELSE 0 END),0) reserved
 FROM records WHERE course=? AND group_id=? AND kind IN ('file','file-reservation')`,course,group);
 return {...r,limit:TEAM_STORAGE_LIMIT};
}

import {all,RecordRow,unpack,User} from './server';
export const sharedKinds=['assignment','event','round','milestone','group','meta'];
export const personalKinds=['allocation','review','assessment','attendance','submission','submission-status','participation-credit'];
export const teamKinds=['file','booking'];
export const staffKinds=[...sharedKinds,...personalKinds,...teamKinds,'insight','sourcefile','extraction'];
const marks=(items:string[])=>items.map(()=>'?').join(',');
// One bounded query; all course/owner/team predicates stay server-side.
export function workspaceQuery(u:User,course:string){
 if(u.role==='staff')return {sql:`SELECT * FROM records WHERE course=? AND kind IN (${marks(staffKinds)}) ORDER BY updated`,args:[course,...staffKinds]};
 return {sql:`SELECT * FROM records WHERE course=? AND (kind IN (${marks([...sharedKinds,'insight'])}) OR (owner=? AND kind IN (${marks(personalKinds)})) OR (group_id=? AND kind IN (${marks(teamKinds)}))) ORDER BY updated`,args:[course,...sharedKinds,'insight',u.id,...personalKinds,u.group_id,...teamKinds]};
}
export async function workspaceRecords(u:User,course:string){
 const q=workspaceQuery(u,course),rows=await all<RecordRow>(q.sql,...q.args);
 const grouped:Record<string,any[]>={};for(const k of staffKinds)grouped[k]=[];
 for(const row of rows)grouped[row.kind].push(unpack(row));return grouped;
}

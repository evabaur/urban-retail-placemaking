import {all,records,getRecord,save,runtime,User,check,now,RecordRow,unpack,rateLimit} from './server';
import {canvas} from './integrations';
import {TEAM_ASSIGNMENTS,teamAssignmentKind,teamProgress} from './team-progress';
type Actor=User&{actor?:string|null};
const cacheMs=5*60*1000;
export async function handleTeamCanvas(req:Request,u:Actor,course:string){
 const url=new URL(req.url),requested=url.searchParams.get('group');
 check(u.role==='staff'||!requested||requested===u.group_id,'Only your own team is available.',403);
 const groupId=u.role==='staff'?(requested||u.group_id):u.group_id;
 if(groupId)check(await getRecord(groupId,'group',course),'Team not found.',404);
 let synced=await getRecord('team-canvas-sync:'+course,'team-canvas-sync',course);
 if(req.method==='POST'&&course==='live'){
  await rateLimit('team-canvas:'+u.id,30);
  // Cache is shared across the class to keep 40 student page loads from making
  // 40 identical upstream requests. All data is fetched before committing a batch.
  if(!synced||Date.now()-Date.parse(synced.syncedAt)>cacheMs){
   const source=await canvas('courses/900001/assignments');
   const groups=await canvas('courses/900001/groups');
   const people=await all<User>("SELECT * FROM users WHERE course='live' AND role='student'");
   const fetched=[];
   for(const target of TEAM_ASSIGNMENTS){const a=source.find(x=>x.id===target.canvasId);check(a,'Tracked Canvas assignment is missing.',502);if(a.published!==false)fetched.push({a,rows:await canvas(`courses/900001/assignments/${a.id}/submissions`)});}
   const at=now(),statements=[];
   for(const {a,rows} of fetched){
    const id='canvas-assignment-'+a.id,previous=await getRecord(id,'assignment','live');
    const data={...previous,title:a.name,due:a.due_at,canvasId:a.id,canvasUrl:a.html_url,published:a.published,groupCategoryId:a.group_category_id||null,gradeGroupIndividually:a.grade_group_students_individually,teamTracked:true};
    statements.push(runtime().DB.prepare("INSERT INTO records(id,kind,course,data,updated) VALUES(?,'assignment','live',?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated=excluded.updated").bind(id,JSON.stringify(data),at));
    for(const s of rows){const p=people.find(x=>x.canvas_id===s.user_id);if(!p)continue;
     const data={canvasUserId:s.user_id,workflowState:s.workflow_state,submittedAt:s.submitted_at||null,submissionType:s.submission_type||null,excused:s.excused===true,late:s.late===true,syncedAt:at,...(Object.hasOwn(s,'cached_due_date')?{due:s.cached_due_date}:{})};
     statements.push(runtime().DB.prepare("INSERT INTO records(id,kind,course,owner,parent,data,updated) VALUES(?,'submission-status','live',?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated=excluded.updated").bind('submission-status:'+a.id+':'+s.user_id,p.id,id,JSON.stringify(data),at));
    }
   }
   // Hide removed/unpublished assignments without destroying their old snapshots.
   for(const target of TEAM_ASSIGNMENTS){const a=source.find(x=>x.id===target.canvasId);if(a?.published===false)statements.push(runtime().DB.prepare("UPDATE records SET data=json_set(data,'$.published',json('false')),updated=? WHERE id=? AND course='live'").bind(at,'canvas-assignment-'+a.id));}
   const summary={syncedAt:at,groups:groups.map(g=>({id:g.id,category:g.group_category_id}))};
   statements.push(runtime().DB.prepare("INSERT INTO records(id,kind,course,data,updated) VALUES(?,'team-canvas-sync','live',?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated=excluded.updated").bind('team-canvas-sync:live',JSON.stringify(summary),at));
   await runtime().DB.batch(statements);synced=summary;
  }
  if(groupId&&/^canvas-group-\d+$/.test(groupId)){
   const id=Number(groupId.replace('canvas-group-','')),membership=await getRecord('team-members:'+groupId,'team-canvas-members','live');
   if(!membership||Date.now()-Date.parse(membership.syncedAt)>cacheMs){
    check(synced?.groups?.some((g:any)=>g.id===id),'Canvas team mapping needs a staff refresh.',409);
    const members=await canvas(`groups/${id}/users`);
    check(u.role==='staff'||members.some(p=>p.id===u.canvas_id),'Your Canvas team changed. Please ask the teaching team to refresh your membership.',409);
    await save('team-canvas-members','live','team-members:'+groupId,{members:members.map(p=>({canvasId:p.id,name:p.name})),syncedAt:now()},null,groupId);
   }
  }
 }
 let members:any[]=groupId?await all<User>("SELECT * FROM users WHERE course=? AND group_id=? AND role='student'",course,groupId):[];
 let category:number|null=null,verified=false;
 if(course==='live'&&groupId){
  const membership=await getRecord('team-members:'+groupId,'team-canvas-members',course);
  const group=synced?.groups?.find((g:any)=>'canvas-group-'+g.id===groupId);
  if(membership&&group){
   check(u.role==='staff'||membership.members.some((p:any)=>p.canvasId===u.canvas_id),'Canvas team membership needs refresh.',409);
   category=group.category;verified=true;
   const people=await all<User>("SELECT * FROM users WHERE course=? AND role='student'",course);
   members=membership.members.map((p:any)=>({...p,id:people.find(x=>x.canvas_id===p.canvasId)?.id||'canvas-'+p.canvasId}));
  }
 }
 members=members.map(p=>({id:p.id,name:p.name,canvasId:p.canvasId??p.canvas_id}));
 const assignments=(await records('assignment',course)).filter(a=>a.published!==false&&teamAssignmentKind(a)&&(course!=='live'||TEAM_ASSIGNMENTS.some(t=>t.canvasId===a.canvasId)));
 const rows=[];
 for(const a of assignments){
  const statuses=(await all<RecordRow>("SELECT * FROM records WHERE kind='submission-status' AND course=? AND parent=?",course,a.id)).map(unpack);
  if(course!=='live'){
   const stored=(await all<RecordRow>("SELECT * FROM records WHERE kind='submission' AND course=? AND parent=?",course,a.id)).map(unpack);
   for(const s of stored){const existing=statuses.find(x=>x.owner===s.owner);if(existing)existing.hasSubmissionEvidence=true;else statuses.push({owner:s.owner,workflowState:'submitted',submittedAt:s.submittedAt||null,syncedAt:null});}
  }
  rows.push({id:a.id,title:a.title,shortTitle:teamAssignmentKind(a),canvasUrl:a.canvasUrl||(a.canvasId&&['live','sandbox','archive'].includes(course)?`https://canvas.example.edu/courses/${course==='live'?900001:900000}/assignments/${a.canvasId}`:null),...teamProgress(a,members,statuses,verified&&category===a.groupCategoryId)});
 }
 for(const target of TEAM_ASSIGNMENTS)if(!rows.some(a=>a.shortTitle===target.label))rows.push({id:'unavailable-'+target.canvasId,shortTitle:target.label,title:course==='live'?'Not yet available in the synced course.':'No corresponding assignment in this historical snapshot.',canvasUrl:null,...teamProgress({due:null},[],[],false)});
 return Response.json({items:rows,hasTeam:!!groupId,teamVerified:verified,demo:course!=='live',syncedAt:course==='live'?synced?.syncedAt||null:null,
  note:course==='live'?'Canvas submission status. Uploading to Team space is not a Canvas submission.':'Isolated test workspace. Real team submissions are not copied and no live Canvas requests are made.'},{headers:{'Cache-Control':'no-store'}});
}

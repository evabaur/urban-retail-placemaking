// Project stages, not Canvas deadlines or completion inferred from a file upload.
export const PROJECT_STAGES = [
 {id:'project-opening-brief',title:'Opening brief with client',detail:'Agree the project scope and expectations with your client.'},
 {id:'project-interim-review',title:'Interim project review',detail:'Review work in progress with your client. Arrange the time with your team and client.'},
 {id:'project-final-presentation',title:'Final presentation',detail:'Present your recommendations. File deadlines and submission status are shown separately in Canvas submissions.'},
] as const;
export function isProjectMilestone(id:string){return PROJECT_STAGES.some(s=>s.id===id);}
export function projectMilestones(saved:Record<string,any>[],events:Record<string,any>[]){
 const finalSession=events.find(e=>/^Session 6\b/.test(e.title||''));
 return PROJECT_STAGES.map(stage=>{const existing=saved.find(m=>m.id===stage.id);return {...stage,...existing,id:stage.id,title:stage.title,due:existing?.due??(stage.id==='project-final-presentation'?finalSession?.date||null:null)};});
}

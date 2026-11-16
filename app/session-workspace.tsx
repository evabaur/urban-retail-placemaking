"use client";
import {useState,useEffect} from 'react';
import {Button} from '@/components/ui/button';
import {Textarea} from '@/components/ui/textarea';
import {Checkbox} from '@/components/ui/checkbox';
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select';
import {BookOpen,ClipboardList,Clock,CheckCircle2,ArrowUpRight,AlertCircle} from 'lucide-react';
import {assignmentProgress,courseDate,courseTimestamp,safeReadingUrl} from '@/lib/course-plan';
import {assignmentRequirement} from '@/lib/term-release';
import {SessionGuests} from './term-readiness';
import {CanvasLinks} from './canvas-links';
import {canvasAppUrl} from '@/lib/canvas-links';
type Item=Record<string,any>;
function useClock(){const [clock,setClock]=useState(Date.now());useEffect(()=>{const timer=setInterval(()=>setClock(Date.now()),60000);return()=>clearInterval(timer)},[]);return clock;}
function AssignmentCard({assignment:a,state,clock}:{assignment:Item,state:Item,clock:number}){
 const p=assignmentProgress(a,state.submission||[],state['submission-status']||[],clock);
 const requirement=assignmentRequirement(a,state.course), optional=requirement.kind!=='standard';
 const url=safeReadingUrl(a.canvasUrl)|| (a.canvasId ? `https://canvas.example.edu/courses/${state.course==='live'?900001:900000}/assignments/${a.canvasId}`:'');
 const done=['submitted','late','excused'].includes(p.kind);
 return <article className={'assignment-card '+(done?'done':!optional&&p.kind==='overdue'?'overdue':'')}>
  <div className="assignment-icon">{done?<CheckCircle2 size={22}/>:<ClipboardList size={22}/>}</div>
  <div className="assignment-info"><h3>{a.title}</h3><p className="deadline"><Clock size={14}/> {p.due ? 'Due '+courseDate(p.due) : 'Deadline to be confirmed'}</p>
   {requirement.label&&<span className="pill">{requirement.label}</span>}
   {requirement.note&&<p className="muted">{requirement.note}</p>}
   {!state.preview&&!optional&&p.reminder&&<p className="deadline-reminder">{p.reminder}</p>}
   {!state.preview&&<span className={'submission-badge '+(optional&&!done?'unknown':p.kind)}>{p.label}</span>}
   {p.submittedAt&&<small>Submitted {courseDate(p.submittedAt)}</small>}
   <small>{state.preview?'Personal status appears only in the student’s own account.':state.course==='sandbox'?'Classroom example':p.syncedAt?'Canvas checked '+courseDate(p.syncedAt):'Waiting for Canvas. No submission status has been assumed.'}</small>
   {!p.individualDeadline&&p.due&&state.course==='live'&&<small>Course deadline shown; check Canvas for personal extensions.</small>}
  </div>
  {url&&<CanvasLinks url={url}/>}
 </article>;
}
export function DeadlineReminders({state,onOpen}:{state:Item,onOpen:()=>void}){
 const clock=useClock();
 const work=(state.assignment||[]).map((a:Item)=>({a,p:assignmentProgress(a,state.submission||[],state['submission-status']||[],clock)})).filter((x:any)=>x.p.reminder).sort((a:any,b:any)=>courseTimestamp(a.p.due)-courseTimestamp(b.p.due));
 return <section className="panel deadline-panel"><div className="row between"><h3><Clock size={19}/> Assignment deadlines</h3><Button variant="outline" onClick={onOpen}>Sessions & work <ArrowUpRight size={15}/></Button></div>
 {work.length ? <div className="deadline-list">{work.slice(0,3).map(({a,p}:any)=><button key={a.id} onClick={onOpen}><AlertCircle size={18}/><span><strong>{a.title}</strong><small>{p.reminder} · {courseDate(p.due)}</small></span><ArrowUpRight size={17}/></button>)}{work.length>3&&<p className="muted">{work.length-3} more in Sessions & work</p>}</div>:<p className="muted">No approaching deadlines in the loaded schedule. View all readings and assignments by session.</p>}
 </section>;
}
export function SessionWorkspace({state}:{state:Item}){
 const clock=useClock(), events=[...(state.event||[])].filter(e=>/^Session\s+\d/i.test(e.title)||/Team work week/i.test(e.title)||e.readings?.length||e.assignmentIds?.length).sort((a,b)=>courseTimestamp(a.date,true)-courseTimestamp(b.date,true));
 const [selected,setSelected]=useState(()=>events.find(e=>courseTimestamp(e.date,true)>=Date.now())?.id||events[0]?.id||'');
 const current=events.find(e=>e.id===selected)||events[0];
 const assigned=new Set(events.flatMap(e=>e.assignmentIds||[]));
 const unrelated=(state.assignment||[]).filter((a:Item)=>!assigned.has(a.id));
 const readings=current?.readings||[];
 return <>
  <div className="session-layout"><nav className="session-rail" aria-label="Sessions">{events.map((e,i)=><button key={e.id} aria-current={current?.id===e.id?'true':undefined} onClick={()=>setSelected(e.id)}><span className="session-number">{String(i+1).padStart(2,'0')}</span><span><strong>{e.title}</strong><small>{courseDate(e.date,true)}</small><small>{(e.readings||[]).filter((r:Item)=>r.type==='required').length} required readings · {(e.assignmentIds||[]).length} assignments</small></span></button>)}</nav>
  <div className="session-detail">{current ? <>
   <section className="panel session-heading"><span className="eyebrow">SESSION PREPARATION</span><h2>{current.title}</h2><p>{courseDate(current.date,true)}</p>{current.location&&<p className="muted">{current.location}</p>}{current.preparation&&<p className="session-notes">{current.preparation}</p>}{current.contentSource&&<small className="muted">{current.contentSource}</small>}</section>
   {(state.course==='live'||current.testCopy)&&<SessionGuests session={Number(/^Session\s+(\d)/i.exec(current.title)?.[1])}/>}
   <section className="panel"><h3 className="icon-heading"><BookOpen size={20}/> Required readings</h3>{readings.filter((r:Item)=>r.type==='required').map((r:Item)=><Reading key={r.id} reading={r}/>)}{!readings.some((r:Item)=>r.type==='required')&&<p className="muted">No required readings listed yet. See the session notes or check with the teaching team.</p>}
   {readings.some((r:Item)=>r.type==='recommended')&&<details className="recommended-readings"><summary>Recommended & suggested readings ({readings.filter((r:Item)=>r.type==='recommended').length})</summary>{readings.filter((r:Item)=>r.type==='recommended').map((r:Item)=><Reading key={r.id} reading={r}/>)}</details>}</section>
   <section className="panel"><h3 className="icon-heading"><ClipboardList size={20}/> Assignments for this session</h3>{(state.assignment||[]).filter((a:Item)=>(current.assignmentIds||[]).includes(a.id)).map((a:Item)=><AssignmentCard key={a.id} assignment={a} state={state} clock={clock}/>)}{!(current.assignmentIds||[]).length&&<p className="muted">No assignments linked to this session yet.</p>}</section>
  </>:<section className="panel"><h2>Sessions are being prepared.</h2><p>The teaching team will add readings and session details here.</p></section>}</div></div>
  {!!unrelated.length&&<section className="panel"><h3>Other course assignments</h3><p className="muted">These assignments have not yet been linked to a session.</p>{unrelated.map((a:Item)=><AssignmentCard key={a.id} assignment={a} state={state} clock={clock}/>)}</section>}
 </>;
}
function Reading({reading:r}:{reading:Item}){const url=safeReadingUrl(r.url);return <div className="reading-row"><BookOpen size={18}/>{url?<span className="reading-link-body">{canvasAppUrl(url)&&<span className="canvas-reading-title">{r.title}</span>}<a className={canvasAppUrl(url)?'canvas-reading-web':undefined} href={url} target="_blank" rel="noopener noreferrer">{r.title}<ArrowUpRight size={15}/></a>{canvasAppUrl(url)&&<span className="canvas-reading-actions"><CanvasLinks url={url}/></span>}</span>:<span>{r.title}<small>See course materials / library</small></span>}</div>;}

export function SessionEditor({events,assignments,busy,action,course}:{events:Item[],assignments:Item[],busy:boolean,action:any,course:string}){
 const [id,setId]=useState(events[0]?.id||''),[required,setRequired]=useState(''),[recommended,setRecommended]=useState(''),[notes,setNotes]=useState(''),[ids,setIds]=useState<string[]>([]),[source,setSource]=useState(''),[syncing,setSyncing]=useState(false),[syncMessage,setSyncMessage]=useState('');
 const current=events.find(e=>e.id===id);
 useEffect(()=>{if(!current)return;const lines=(type:string)=>(current.readings||[]).filter((r:Item)=>r.type===type).map((r:Item)=>r.title+(r.url?' | '+r.url:'')).join('\n');setRequired(lines('required'));setRecommended(lines('recommended'));setNotes(current.preparation||'');setIds(current.assignmentIds||[]);setSource(current.contentSource||'Teaching team');},[id,current?.updated]);
 const parse=(text:string,type:string)=>text.split('\n').filter(s=>s.trim()).map(s=>{const at=s.lastIndexOf(' | ');return {title:(at<0?s:s.slice(0,at)).trim(),url:at<0?'':s.slice(at+3).trim(),type}});
 return <section className="panel session-editor"><h3>Session readings & assignments</h3>{events.length ? <form onSubmit={async e=>{e.preventDefault();await action('session-content',{id,readings:[...parse(required,'required'),...parse(recommended,'recommended')],assignmentIds:ids,preparation:notes,contentSource:'Teaching team · updated '+new Date().toISOString().slice(0,10)},'Session preparation saved').catch(()=>{});}}>
  <label>Session<Select value={id} onValueChange={setId}><SelectTrigger aria-label="Edit session"><SelectValue/></SelectTrigger><SelectContent>{events.map(e=><SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>)}</SelectContent></Select></label>
  <label>Required readings<Textarea value={required} onChange={e=>setRequired(e.target.value)} rows={5}/></label>
  <label>Recommended / suggested readings<Textarea value={recommended} onChange={e=>setRecommended(e.target.value)} rows={4}/></label><p className="muted">One reading per line: Title | https://link. A title without a link is allowed.</p>
  <label>Preparation notes<Textarea value={notes} onChange={e=>setNotes(e.target.value)}/></label>
  <fieldset><legend>Related assignments</legend><div className="session-assignment-picker">{assignments.map(a=><label key={a.id}><Checkbox checked={ids.includes(a.id)} onCheckedChange={checked=>setIds(checked?[...ids,a.id]:ids.filter(x=>x!==a.id))}/><span>{a.title}<small>{courseDate(a.due)}{a.published===false?' · Unpublished':''}</small></span></label>)}</div></fieldset>
  <Button disabled={busy||!current}>Save session preparation</Button>
 </form>:<p>Add a session to the calendar first.</p>}
 {course==='live'&&<div className="status-sync"><h3>Canvas submission status</h3><p className="muted">Read-only refresh of published assignments, including unsubmitted and excused records. Students see their own status and the last checked time. This does not change Canvas.</p><Button disabled={busy||syncing} onClick={async()=>{setSyncing(true);try{const eligible=assignments.filter(a=>a.canvasId&&a.published!==false);for(let i=0;i<eligible.length;i++){setSyncMessage(`Checking ${i+1} / ${eligible.length}: ${eligible[i].title}`);await action('canvas-submissions',{id:eligible[i].id},'Submission status updated');}setSyncMessage('Submission status refresh complete.');}catch{setSyncMessage('Refresh stopped. Completed updates are saved; retry the remaining assignments.');}finally{setSyncing(false);}}}>{syncing?'Checking Canvas…':'Refresh submission status'}</Button><p role="status">{syncMessage}</p></div>}
 </section>;
}

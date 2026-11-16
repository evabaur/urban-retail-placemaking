'use client';
import {useEffect,useState} from 'react';
import {CheckCircle2,Clock,ArrowUpRight,RefreshCw,UploadCloud} from 'lucide-react';
import {courseDate,safeReadingUrl} from '@/lib/course-plan';
import {Button} from '@/components/ui/button';
import {CanvasLinks} from './canvas-links';
type Item=Record<string,any>;
export default function TeamCanvasPanel({course,userId}:{course:string;userId:string}){
 const [data,setData]=useState<Item|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function load(refresh=false){const r=await fetch('/api/team-canvas?course='+encodeURIComponent(course),{method:refresh?'POST':'GET',headers:refresh?{'Content-Type':'application/json'}:undefined,body:refresh?'{}':undefined,cache:'no-store',signal:AbortSignal.timeout(60000)});const d:any=await r.json();if(!r.ok)throw Error(d.error||'Could not check Canvas.');return d;}
 async function refresh(){setBusy(true);setError('');try{setData(await load(true));}catch(e){setError((e as Error).message+' Previous status is unchanged.');}finally{setBusy(false);}}
 useEffect(()=>{let cancelled=false;setBusy(true);setData(null);setError('');
  (async()=>{try{const cached=await load();if(!cancelled)setData(cached);if(course==='live'){const latest=await load(true);if(!cancelled)setData(latest);}}catch(e){if(!cancelled)setError((e as Error).message+' Check Canvas for the latest status.');}finally{if(!cancelled)setBusy(false);}})();return()=>{cancelled=true};
 },[course,userId]);
 return <section className="panel team-canvas-panel"><div className="row between"><div><span className="eyebrow">CANVAS DELIVERABLES</span><h2>Keep your project on track.</h2></div><Button variant="outline" disabled={busy} onClick={refresh}><RefreshCw size={16}/>{busy?'Checking…':course==='live'?'Check Canvas':'Refresh snapshot'}</Button></div>
 <p className="muted">Work in Progress and Final Presentation. Files in this team workspace still need to be submitted in Canvas.</p>
 {error&&<p className="error" role="alert">{error}</p>}
 {data&&!data.hasTeam&&<p className="team-status-note">Your project team has not been assigned in the app yet. Team submission status will appear after your team is linked.</p>}
 {data?.demo&&<p className="team-status-note">Current-term test account. Real students’ Canvas submissions are not copied into this workspace.</p>}
 <div className="team-deliverables">{data?.items?.map((a:Item)=>{const done=a.kind==='submitted',url=safeReadingUrl(a.canvasUrl);return <article key={a.id} className={'team-deliverable '+(done?'is-submitted':'')}><div className="team-deliverable-icon">{done?<CheckCircle2/>:<UploadCloud/>}</div><div className="team-deliverable-body"><h3>{a.shortTitle}</h3><p className="muted">{a.title}</p><p className="deadline"><Clock size={14}/>{a.due?'Due '+courseDate(a.due):'Deadline to be confirmed'}</p><span className={'submission-badge '+a.kind}>{a.label}</span>
 {a.reminder&&<p className="deadline-reminder">{a.reminder}</p>}{a.submittedAt&&<small>Submitted {courseDate(a.submittedAt)}</small>}
 {a.shared&&<small>Canvas group submission · one teammate submits for the team.</small>}
 {!a.shared&&data.hasTeam&&<small>{data.demo?'Test team only. Submission status below is not a real Canvas record.':'Group submission coverage is not verified; check each member’s Canvas status.'}</small>}
 {a.individualDeadlines&&<small>Some members have different deadlines. Check your own Canvas assignment.</small>}
 {!!a.members?.length&&<details><summary>Member submission status</summary><ul>{a.members.map((m:Item)=><li key={m.id}><span>{m.name}</span><span>{m.excused?'Excused':m.submitted?(m.late?'Submitted late':'Submitted'):m.known?'Not submitted at last check':'Not verified'}</span></li>)}</ul></details>}
 {url&&<CanvasLinks url={url}/>}</div></article>;})}</div>
 {!data?.items?.length&&!busy&&<p className="muted">These assignments have not been synced yet.</p>}
 <p className="team-sync-time" role="status">{data?.syncedAt?'Canvas checked '+courseDate(data.syncedAt)+' · refresh after submitting.':data?.demo?'Current assignment deadlines; isolated test status. No live Canvas requests.':'Waiting for a successful Canvas check.'}</p>
 </section>;
}

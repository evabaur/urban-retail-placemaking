'use client';
import {useEffect,useState} from 'react';
import {Button} from '@/components/ui/button';
import ReviewPdf from './review-pdf';
type Item=Record<string,any>;
export function ReviewRoundPanel({course,assignments,credits,onChange}:{course:string;assignments:Item[];credits:Item[];onChange:()=>void}){
 const [data,setData]=useState<Item|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function load(){const r=await fetch('/api/review-rounds?course='+course);const d:any=await r.json();if(!r.ok)throw Error(d.error);setData(d);}
 useEffect(()=>{setData(null);load().catch(e=>setError(e.message));const t=setInterval(()=>load().catch(e=>setError(e.message)),15000);return()=>clearInterval(t);},[course]);
 async function act(action:string){setBusy(true);setError('');try{const r=await fetch('/api/review-rounds?course='+course,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action})});const d:any=await r.json();if(!r.ok)throw Error(d.error);await load();onChange();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 const stale=data?.health?.lastAutomaticAt&&Date.now()-Date.parse(data.health.lastAutomaticAt)>15*60000;
 return <section className="panel review-round-monitor"><div className="row between"><div><p className="eyebrow">DEADLINE ROUNDS</p><h2>One invitation. One week.</h2></div><span className="badge">{course==='sandbox'?'Isolated test':data?.liveEnabled?'Live enabled':'Live dispatch locked'}</span></div>
 <p>After each VPA deadline, every student receives one random review invitation. No self-review; submissions are shared as evenly as possible. Invitations close seven days after the deadline. Late work does not reshuffle an issued round.</p>
 <div className="row between"><span>{credits.length} completed reviews eligible for participation credit · numeric grades not configured</span><span>{data?.health?.lastAutomaticAt?'Last automatic check: '+new Date(data.health.lastAutomaticAt).toLocaleString('en-US',{timeZone:'America/New_York'}):'No automatic check recorded yet'}</span></div>
 {(stale||data?.health?.error)&&<p role="alert">Scheduler needs attention: {data?.health?.error||'no successful check in the last 15 minutes.'}</p>}
 {error&&<p role="alert">{error}</p>}
 {course==='sandbox'&&<div className="button-wrap"><Button variant="outline" disabled={busy} onClick={()=>act('dispatch')}>Check test rounds</Button><small>Isolated test account. No real student work is copied here; a peer-review test requires a separate synthetic submission and reviewer.</small></div>}
 <div className="card-grid">{assignments.filter(a=>a.assignmentType==='vpa'&&a.published!==false&&(course==='live'||a.demoReviewRound)).map(a=>{const r=data?.rounds?.find((r:Item)=>r.assignment===a.id),h=data?.health?.results?.find((r:Item)=>r.assignment===a.id);const expired=r&&Date.now()>=Date.parse(r.expiresAt);return <article className="panel" key={a.id}><h3>{a.title}</h3><p>{expired?'Closed':r?.status||h?.status||'Awaiting deadline check'}</p><p>{r?.invitations||0} invitations · {r?.pending?.length||0} waiting for a non-self submission</p><small>{r?.expiresAt?'Review closes '+new Date(r.expiresAt).toLocaleString('en-US',{timeZone:'America/New_York'}):'VPA due '+new Date(a.due).toLocaleString('en-US',{timeZone:'America/New_York'})}</small></article>;})}</div>
 <small>If nobody submits, the round waits. With one submission, its author cannot be assigned a self-review and is flagged for staff. Completed reviews are retained after expiry.</small>
 </section>;
}
export function ReviewAttachments({files=[]}:{files:Item[]}){
 const [selected,setSelected]=useState<Item|null>(null);
 return <div className="review-attachments"><h4>Submission files</h4>{!files.length?<p className="muted">No files attached to this review. Read the submission text below.</p>:files.map((f,i)=><div className="review-attachment-row" key={i}><div><strong>{f.name}</strong><small>{Math.round((f.size||0)/1024)} KB</small></div><div className="button-wrap">{['application/pdf','video/mp4'].includes(f.type)&&<Button type="button" variant="outline" onClick={()=>setSelected(selected?.url===f.url?null:f)}>{selected?.url===f.url?'Close':'Preview'}</Button>}<a href={f.url} download>Download</a></div></div>)}
 {selected?.type==='application/pdf'&&<ReviewPdf url={selected.url} name={selected.name}/>}
 {selected?.type==='video/mp4'&&<video controls preload="metadata" src={selected.url+'&inline=1'} className="review-video"/>}
 {files.some(f=>!['application/pdf','video/mp4'].includes(f.type))&&<small>Slides and other formats download privately. Open them in your own viewer; files are not sent to an external preview service.</small>}
 </div>;
}

"use client";
import {GUESTS,RELEASE_ISSUES,TERM_AUDIT_DATE,currentAssignments} from '@/lib/term-release';
import {courseDate} from '@/lib/course-plan';
import {CheckCircle2,LockKeyhole,ArrowUpRight} from 'lucide-react';
export function TermReadiness({state,onPreview}:{state:any,onPreview:()=>void}) {
 const roster=state.meta?.find((m:any)=>m.id==='live-roster');
 const ids=new Set(roster?.currentStudentIds||[]);
 const students=state.people.filter((p:any)=>p.role==='student'&&ids.has(p.id));
 const published=currentAssignments(state.assignment||[]);
 return <section className="panel term-readiness">
  <div className="row between"><div><span className="eyebrow">FALL 2026</span><h2>Course readiness.</h2></div><button className="session-link" onClick={onPreview}>Preview course content <ArrowUpRight size={16}/></button></div>
  <p>Current coursework, student access and launch checks. The test account is isolated from this roster.</p>
  <div className="term-metrics">{[[roster?.students??'—','Current students'],[state.group.length,'Project teams'],[published.length,'Published assignments'],[students.filter((p:any)=>!p.disabled).length,'Enabled student accounts']].map(([n,label])=><div key={String(label)}><strong>{n}</strong><span>{label}</span></div>)}</div>
  <p className="muted">Canvas roster checked {roster?.syncedAt?courseDate(roster.syncedAt):'not yet'}. Content audit: {TERM_AUDIT_DATE}. Historical identities are retained separately from the current roster.</p>
  <div className="term-flags"><span><CheckCircle2 size={16}/> Cloud notes & private object backups</span><span><LockKeyhole size={16}/> Direct Canvas submission: {state.integrations?.canvasSubmit?'enabled - verify before launch':'off'}</span><span><LockKeyhole size={16}/> Automatic review invitations: not active</span></div>
  <details><summary>Release checklist · {RELEASE_ISSUES.length} areas to resolve</summary><div className="term-checklist">{RELEASE_ISSUES.map(x=><article key={x.title}><span className="eyebrow">{x.status}</span><h3>{x.title}</h3><p>{x.detail}</p></article>)}</div></details>
 </section>;
}
export function SessionGuests({session}:{session:number}) {
 const guests=GUESTS.filter(g=>g.session===session);
 if(!guests.length)return null;
 return <section className="panel"><h3>Guest sessions</h3><div className="term-guests">{guests.map(g=><article key={g.name}><div className="term-guest-time">{g.time}<small>New York</small></div><div><h3>{g.name}</h3><p>{g.organization}</p><span className="pill">{g.status}</span><p className="muted">{g.detail}</p></div></article>)}</div><small className="muted">Teaching-team schedule checked {TERM_AUDIT_DATE}; room and check-in details to follow.</small></section>;
}

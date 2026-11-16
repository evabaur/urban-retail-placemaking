type Item = Record<string, any>;
// Legacy SQLAlchemy snapshots stored UTC without a zone; never interpret them as browser-local time.
export function courseTimestamp(value: unknown, localEvent=false): number {
  if(typeof value!=='string'||!value)return NaN;
  if(localEvent && /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(value)) {
    const wall=Date.parse(value.replace(' ','T')+'Z');let result=wall;
    for(let i=0;i<2;i++){
      const offset=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',timeZoneName:'shortOffset'}).formatToParts(new Date(result)).find(p=>p.type==='timeZoneName')?.value;
      const hours=Number(/GMT([+-]\d+)/.exec(offset||'')?.[1]||0);result=wall-hours*3600000;
    }
    return result;
  }
  const normalized=/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(value)?value.replace(' ','T')+'Z':value;
  return Date.parse(normalized);
}
export function safeReadingUrl(value: unknown): string {
  if (typeof value !== 'string' || !value) return '';
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password ? u.href : ''; } catch { return ''; }
}
export function assignmentProgress(a: Item, submissions: Item[], statuses: Item[], clock = Date.now()) {
  const status = statuses.find(s => s.parent === a.id);
  const submission = submissions.find(s => s.parent === a.id || s.assignment === a.id);
  const due = status && Object.prototype.hasOwnProperty.call(status,'due') ? status.due : a.due;
  const timestamp = courseTimestamp(due);
  // A manual grade/zero is not evidence that a student submitted work.
  const accepted = status ? !!status.submittedAt || ['submitted','pending_review'].includes(status.workflowState) || (!!status.submissionType && status.submissionType!=='none') : !!submission?.submittedAt;
  const confirmedMissing = status?.workflowState === 'unsubmitted' && !accepted;
  const kind = status?.excused ? 'excused' : accepted ? (status?.late ? 'late' : 'submitted') : confirmedMissing ? (Number.isFinite(timestamp) && timestamp < clock ? 'overdue' : 'not-submitted') : 'unknown';
  const hours = (timestamp-clock)/3600000;
  const reminder = ['submitted','late','excused'].includes(kind) || !Number.isFinite(timestamp) ? null : hours < 0 ? (kind === 'overdue' ? 'Overdue · not submitted at last sync' : 'Deadline passed') : hours <= 24 ? 'Due within 24 hours' : hours <= 168 ? 'Due this week' : null;
  return {kind,due,reminder,syncedAt:status?.syncedAt || null,submittedAt:status?.submittedAt || submission?.submittedAt || null,individualDeadline:!!status && Object.prototype.hasOwnProperty.call(status,'due'),label:({excused:'Excused',late:'Submitted late',submitted:'Submitted',overdue:'Not submitted','not-submitted':'Not submitted',unknown:'Awaiting Canvas sync'} as Record<string,string>)[kind]};
}
export function courseDate(value: unknown, localEvent=false) {
  const timestamp=courseTimestamp(value,localEvent);
  if (!Number.isFinite(timestamp)) return 'Date to be confirmed';
  return new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZone:'America/New_York',timeZoneName:'short'}).format(new Date(timestamp));
}

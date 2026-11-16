// Sample pre-release audit for the showcase build. All names and details are fictional.
export const TERM_AUDIT_DATE = '2026-10-25';
export const SESSION_ASSIGNMENTS: Record<number, number[]> = {
  1: [2000077, 2000011, 2000110], 2: [2000033], 3: [2000044, 2000088],
  4: [2000055], 5: [2000121, 2000132], 6: [2000022, 2000143],
};
export const SESSION_EVENTS = [
  {id:'live-event-1',number:1,date:'2026-10-27T18:20:00Z',topic:'Introduction & the retail brandscape'},
  {id:'live-event-3',number:2,date:'2026-11-10T19:20:00Z',topic:'People, shoppers & brand narrative'},
  {id:'live-event-5',number:3,date:'2026-11-17T19:20:00Z',topic:'Designing brand experiences: place'},
  {id:'live-event-7',number:4,date:'2026-11-24T19:20:00Z',topic:'Designing brand experiences: people'},
  {id:'live-event-10',number:5,date:'2026-12-01T19:20:00Z',topic:'Districts, neighborhoods & store locations'},
  {id:'live-event-11',number:6,date:'2026-12-08T19:20:00Z',topic:'Client presentations & course close'},
];
export const GUESTS = [
  {session:2,name:'Guest Speaker A',organization:'Sample Brand Co.',time:'4:30 pm',status:'Travel reconfirmation pending',detail:'Fireside conversation with the teaching team.'},
  {session:3,name:'Guest Speaker B',organization:'Sample Design Studio',time:'3:20 pm',status:'Confirmed',detail:'Talk on building brand worlds in physical space.'},
  {session:4,name:'Guest Speaker C',organization:'Sample Retailer',time:'2:50 pm',status:'Confirmed',detail:'Retail training and a mock training exercise.'},
  {session:5,name:'Guest Speaker D',organization:'Sample University',time:'2:50 pm',status:'Confirmed; Zoom',detail:'Remote guest session on street-level retail.'},
];
export const RELEASE_ISSUES = [
  {title:'Canvas submission',status:'Blocked',detail:'Direct submission stays off until a real upload and receipt test passes with an isolated test identity. Export and manual Canvas submission remain available.'},
  {title:'Peer-review launch',status:'Awaiting activation',detail:'Deadline rounds were tested with isolated accounts. Live dispatch remains locked until the teaching team confirms launch.'},
  {title:'Upload file formats',status:'Resolved',detail:'File-upload assignments accept the formats each brief requires.'},
  {title:'Student and staff access',status:'Awaiting owner',detail:'Accounts stay disabled and nothing is emailed until the course owner approves access.'},
  {title:'Trek logistics',status:'Partly confirmed',detail:'Some stop times and group splits remain open and are marked as tentative in the app.'},
  {title:'Monitoring & handover',status:'Before launch',detail:'Complete a restore drill, failure notification plan and upload-limit check.'},
];
export function assignmentRequirement(a:Record<string,any>,course:string) {
  if(course!=='live'&&!a.testCopy)return {kind:'standard',label:'',note:''};
  const id=Number(a.canvasId);
  if([2000033,2000044,2000055,2000121].includes(id))return {kind:'optional',label:'Voluntary participation',note:'Optional VPA. If you choose to submit: 2–4 PPT slides plus Notes PDF or a 3–5 minute MP4. Notes and video may both be included.'};
  if([2000132,2000143].includes(id))return {kind:'choice',label:'Individual assessment · choose one',note:id===2000132?'Store route: instructor pre-approval, individual fieldwork, approximately 1,000 words or a 5–10 minute video link in Word, plus field-app PDF.':'District route: instructor pre-approval, solo or one approved partner, approximately 2,000 words or a 10–15 minute video link in Word, plus field-app PDF. Each collaborator submits separately.'};
  return {kind:'standard',label:id===2000110?'Visit prerequisite':id===2000088||id===2000022?'Team submission':'Course preparation',note:id===2000110?'One-page PDF CV. Required for store visit access.':id===2000088?'One team PPT/PPTX; up to 5 minutes, speaker notes up to 800 words.':id===2000022?'15-minute presentation in PPT/PPTX plus an illustrated Word report: at most 10 pages / 3,500 words.':''};
}
export function currentAssignments(items:Record<string,any>[]) {return items.filter(a=>a.published!==false&&!a.retiredFromCanvas);}

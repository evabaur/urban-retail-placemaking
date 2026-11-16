"use client";
import { RoundWindow } from "./round-window";
import {reviewWindow} from "@/lib/review-window";
import {courseDate} from "@/lib/course-plan";
import { SessionWorkspace, SessionEditor } from "./session-workspace";
import {TermReadiness} from './term-readiness';
import { scoreGroup } from "@/lib/scoring";
import { useEffect, useState, useRef, ReactNode, lazy, Suspense, ComponentType } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Toaster, toast } from "sonner";
import {
  Home,
  NotebookPen,
  MessageSquare,
  Users,
  CalendarCheck,
  RefreshCw,
  Settings,
  LogOut,
  ArrowUpRight,
  FileText,
  Download,
  LockKeyhole,
  Sparkles,
  MapPin,
  Check,
  Clock,
  ClipboardList,
  BookOpen,
} from "lucide-react";
type Item = Record<string, any>;
function deferred(load:()=>Promise<{default:ComponentType<any>}>){
 const Panel=lazy(load);
 return function DeferredPanel(props:any){return <Suspense fallback={<section className="panel" role="status">Opening this section…</section>}><Panel {...props}/></Suspense>;};
}
const TrekWorkspace=deferred(()=>import('./trek-workspace'));
const VpaWorkspace=deferred(()=>import('./vpa-workspace'));
const TeamCanvasPanel=deferred(()=>import('./team-canvas-panel'));
const ReviewRoundPanel=deferred(()=>import('./review-round-panel').then(m=>({default:m.ReviewRoundPanel})));
const ReviewAttachments=deferred(()=>import('./review-round-panel').then(m=>({default:m.ReviewAttachments})));
const TeamControls=deferred(()=>import('./staff-tools').then(m=>({default:m.TeamControls})));
const TeachingDashboard=deferred(()=>import('./teaching-dashboard'));
const CalendarManager=deferred(()=>import('./staff-tools').then(m=>({default:m.CalendarManager})));
const SubmissionRegister=deferred(()=>import('./staff-tools').then(m=>({default:m.SubmissionRegister})));
const AnalyzeButton=deferred(()=>import('./staff-tools').then(m=>({default:m.AnalyzeButton})));
async function api(path: string, body?: unknown) {
  const r = await fetch("/api/" + path, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const d: any = await r.json();
  if (!r.ok) throw new Error(d.error || "Request failed");
  if(r.headers.get('X-Backup-Status')==='failed'||r.headers.get('X-Audit-Status')==='failed')toast.warning('Your change was saved, but the additional server backup needs attention. Please tell the teaching team; do not submit again.');
  return d;
}
const date = (v: string) => {
  const d = new Date((v || "").replace(" ", "T").replace(/-(\d)(?=T)/, "-0$1"));
  return Number.isFinite(d.getTime())
    ? d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "America/New_York",
      })
    : "To be scheduled";
};
function Pick({
  value,
  onChange,
  items,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  items: { value: string; label: string }[];
  label: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        {items.map((i) => (
          <SelectItem key={i.value} value={i.value}>
            {i.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={"panel " + className}>{children}</section>;
}
function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="empty-state">
      <ClipboardList size={30} />
      <p>{children}</p>
    </div>
  );
}
function Pill({
  children,
  good = false,
}: {
  children: ReactNode;
  good?: boolean;
}) {
  return <span className={"pill " + (good ? "good" : "")}>{children}</span>;
}
const studentNav = [
  ["sessions", "Sessions", BookOpen],
  ["treks", "Treks", MapPin],
  ["vpa", "VPA", FileText],
  ["reviews", "Peer reviews", NotebookPen],
  ["team", "Team project", Users],
];
const staffNav = [
  ["overview", "Overview", Home],
  ["course-preview", "Course content", BookOpen],
  ["treks", "Trek guide", MapPin],
  ["vpa", "VPA", FileText],
  ["people", "People & accounts", Users],
  ["submissions", "Submissions", FileText],
  ["allocations", "Peer reviews", NotebookPen],
  ["assessment", "Team assessment", MessageSquare],
  ["attendance", "Attendance", CalendarCheck],
  ["calendar", "Course calendar", Clock],
  ["teams", "Team workspaces", FileText],
  ["insights", "Insights", Sparkles],
];
export default function Workspace({initialView='sessions'}:{initialView?:'sessions'|'treks'}) {
  const [reviewClock,setReviewClock]=useState(Date.now());
  useEffect(()=>{const tick=setInterval(()=>setReviewClock(Date.now()),1000);return()=>clearInterval(tick);},[]);

  const [peerTab,setPeerTab]=useState('write');
  const [user, setUser] = useState<Item | null>(null),
    [loading, setLoading] = useState(true),
    [state, setState] = useState<Item | null>(null),
    [view, setView] = useState<string>(initialView),
    [course, setCourse] = useState("live"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [review, setReview] = useState<Item | null>(null);
  const requestVersion = useRef(0),
    reviewVersion = useRef(0);
  const resolvedCourse=useRef<string|null>(null);
  const [openingReview,setOpeningReview]=useState<string|null>(null);
  const [reviewLoadError,setReviewLoadError]=useState('');
  const canvasRefreshUser=useRef<string|null>(null);
  const [canvasSync,setCanvasSync]=useState('');
  useEffect(()=>{
    if(!user){canvasRefreshUser.current=null;setCanvasSync('');return;}
    if(user.role!=='student'||user.course!=='live'||user.must_change||state?.impersonating||canvasRefreshUser.current===user.id)return;
    canvasRefreshUser.current=user.id;
    let active=true;setCanvasSync('Checking Canvas…');
    api('personal-canvas',{}).then(async r=>{
      if(!active)return;
      await refresh();
      if(active)setCanvasSync(r.partial?'Some assignments could not be checked. Previous statuses are retained.':'Canvas is up to date.');
    }).catch(()=>{if(active)setCanvasSync('Canvas refresh failed. Showing your last saved status; please check Canvas.');});
    return()=>{active=false;};
  },[user?.id,user?.must_change]);
  function clearReview() {
    reviewVersion.current++;
    setReview(null);
    setOpeningReview(null);
    setReviewLoadError('');
  }
  function invalidate() {
    requestVersion.current++;
    clearReview();
  }
  async function refresh() {
    const version = ++requestVersion.current;
    const s = await api("bootstrap?course="+course);
    if (version !== requestVersion.current) return;
    setUser(s.user);
    if(s.course&&s.course!==course){resolvedCourse.current=s.course;setCourse(s.course);}
    if (s.user?.role === "staff")
      setView((v) => (v === "sessions" ? "overview" : v));
    setState(s.user&&!s.user.must_change?s:null);
  }
  useEffect(() => {
    if(resolvedCourse.current===course){resolvedCourse.current=null;return;}
    setLoading(true);
    setState(null);
    setError("");
    refresh()
      .catch((e) => {
        setError(e.message);
        setState(null);
      })
      .finally(() => setLoading(false));
    return () => {
      requestVersion.current++;
      reviewVersion.current++;
    };
  }, [course]);
  useEffect(()=>{if(user?.role==='student'&&!user.must_change&&['sessions','treks','vpa','reviews','feedback','team','assessment','account'].includes(view))api('activity-event',{section:view}).catch(()=>{});},[user?.id,user?.must_change,view]);
  useEffect(()=>{
    if(!user||view!=='reviews'||review)return;
    const update=()=>{if(document.visibilityState==='visible')refresh().catch(()=>{});};
    const timer=setInterval(update,60000);window.addEventListener('focus',update);
    return()=>{clearInterval(timer);window.removeEventListener('focus',update);};
  },[course,user?.id,view,!!review]);
  async function action(path: string, body: unknown, message = "Saved") {
    setBusy(true);
    try {
      const r = await api(
        path + (path.includes("?") ? "&" : "?") + "course=" + course,
        body,
      );
      await refresh();
      toast.success(message);
      return r;
    } catch (e) {
      toast.error((e as Error).message);
      throw e;
    } finally {
      setBusy(false);
    }
  }
  async function submit(
    e: React.FormEvent<HTMLFormElement>,
    path: string,
    body: (f: FormData) => unknown,
    message?: string,
  ) {
    e.preventDefault();
    await action(path, body(new FormData(e.currentTarget)), message).catch(
      () => {},
    );
  }
  useEffect(() => {
    const ctx = (document as any).modelContext;
    if (!ctx?.registerTool) return;
    const ac = new AbortController();
    Promise.resolve(
      ctx.registerTool(
        {
          name: "urp_navigate_workspace",
          description:
            "Navigate to a visible course workspace section. Does not submit or change course records.",
          inputSchema: {
            type: "object",
            properties: { section: { type: "string" } },
            required: ["section"],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: true },
          execute: async (input: Item) => {
            const nav = user?.role === "staff" ? staffNav : studentNav;
            if (!nav.some((x) => x[0] === input.section))
              throw new Error("Unknown section");
            setView(input.section);
            clearReview();
            return { section: input.section };
          },
        },
        { signal: ac.signal },
      ),
    ).catch(() => {});
    return () => ac.abort();
  }, [user?.role]);
  if (loading)
    return (
      <main className="loading">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-52 w-full" />
        <p>Opening your workspace…</p>
      </main>
    );
  if (!user)
    return (
      <main className="login-scene">
        <section className="login-brand">
          <img className="urp-logo login-logo" src="/trek/logo.png" alt="Urban Retail Placemaking logo" width="104" height="104" />
          <span className="eyebrow">COLUMBIA BUSINESS SCHOOL / FALL 2026</span>
          <h1>
            Urban Retail
            <br />
            Placemaking<span className="brand-period">.</span>
          </h1>
          <p>
            Your work. Your team.
            <br />A closer look at the city.
          </p>
          <div className="brand-rail">
            <span>01 Observe</span>
            <span>02 Exchange</span>
            <span>03 Create</span>
          </div>
        </section>
        <section className="login-panel">
          <div className="login-card">
            <span className="eyebrow">FALL 2026</span>
            <h2>Your course, in one place.</h2>
            <p>Sign in with your Columbia UNI and the password provided by the teaching team.</p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError("");
                invalidate();
                const f = new FormData(e.currentTarget);
                try {
                  const r = await api("login", {
                    uni: f.get("uni"),
                    password: f.get("password"),
                  });
                  setView(initialView==='treks'?'treks':r.user.role === "staff" ? "overview" : "sessions");
                  const targetCourse=r.user.course==='sandbox'?'sandbox':r.user.role==='staff'?'live':r.user.course;
                  if(course!==targetCourse){setUser(r.user);setState(null);setCourse(targetCourse);}
                  else await refresh();
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
                <label htmlFor="uni">Columbia UNI</label>
                <Input id="uni" name="uni" autoComplete="username" required />
              <label htmlFor="password">Password</label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
              <Button type="submit" size="lg" disabled={busy}>
                {busy ? "Signing in…" : "Sign in"}
              </Button>
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
            </form>
            <small>Need access? Contact the teaching team.</small>
          </div>
        </section>
      </main>
    );
  if (user.must_change || view === "settings")
    return (
      <main className="settings-page">
        <Toaster />
        <Card>
          <h2>{user.must_change ? "Set your password" : "Account settings"}</h2>
          <p>
            {user.name} · {user.uni}
          </p>
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              if (f.get("password") !== f.get("confirm")) {
                toast.error("Passwords do not match");
                return;
              }
              try {
                await action(
                  "password",
                  { current: f.get("current"), password: f.get("password") },
                  "Password changed",
                );
                setView(initialView==='treks'?'treks':user.role === "staff" ? "overview" : "sessions");
              } catch {}
            }}
          >
            <label>
              Current password
              <Input
                name="current"
                type="password"
                autoComplete="current-password"
                required
              />
            </label>
            <label>
              New password
              <Input
                name="password"
                type="password"
                minLength={12}
                autoComplete="new-password"
                required
              />
            </label>
            <label>
              Confirm new password
              <Input
                name="confirm"
                type="password"
                minLength={12}
                autoComplete="new-password"
                required
              />
            </label>
            <Button disabled={busy}>Save password</Button>
          </form>
          {!user.must_change && (
            <Button
              variant="ghost"
              onClick={() =>
                setView(user.role === "staff" ? "overview" : "sessions")
              }
            >
              Back to workspace
            </Button>
          )}
        </Card>
      </main>
    );
  if (!state)
    return (
      <main className="loading">
        <p role="alert">{error || "Loading course data…"}</p>
        <Button onClick={() => refresh().catch((e) => setError(e.message))}>
          Retry
        </Button>
      </main>
    );
  const staff = user.role === "staff",
    nav = staff ? staffNav : studentNav;
  const assignments = state.assignment || [],
    allocations = state.allocation || [],
    reviews = state.review || [],
    people = state.people || [],
    groups = state.group || [],
    rounds = state.round || [],
    events = state.event || [];
  const name = (id: string) =>
    people.find((p: Item) => p.id === id)?.name || "Student";
  const title = (id: string) =>
    assignments.find((a: Item) => a.id === id)?.title || "Assignment";
  const visibleAllocations=allocations.filter((a:Item)=>reviews.some((r:Item)=>r.parent===a.id)||reviewWindow(a,assignments.find((x:Item)=>x.id===a.assignment),reviewClock).open);
  const pending = allocations.filter(
    (a: Item) => !reviews.some((r: Item) => r.parent === a.id) && reviewWindow(a,assignments.find((x:Item)=>x.id===a.assignment),reviewClock).open,
  );
  const currentTitle = review
    ? "Write your review"
    : String(nav.find((n) => n[0] === view)?.[1] || "Workspace");
  async function openReview(id: string) {
    const version = ++reviewVersion.current;
    setOpeningReview(id);
    setReviewLoadError('');
    try {
      const result = await api(
        "review?id=" + encodeURIComponent(id) + "&course=" + course,
      );
      if (version === reviewVersion.current){setReview(result);setOpeningReview(null);}
    } catch (e) {
      if(version===reviewVersion.current)setReviewLoadError((e as Error).message);
    }
  }
  return (
    <SidebarProvider>
      <Toaster position="top-center" />
      <Sidebar>
        <SidebarHeader className="brand-sidebar">
          <img className="urp-logo" src="/trek/logo.png" alt="Urban Retail Placemaking logo" width="76" height="76" />
          <span className="eyebrow">COLUMBIA BUSINESS SCHOOL</span>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setView(staff ? "overview" : "sessions");
              clearReview();
            }}
          >
            Urban Retail
            <br />
            Placemaking<span>.</span>
          </a>
          <Pill>{staff ? "Teaching team" : "Student workspace"}</Pill>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {nav.map(([id, label, Icon]: any) => (
              <SidebarMenuItem key={id}>
                <SidebarMenuButton
                  isActive={view === id}
                  onClick={() => {
                    setView(id);
                    clearReview();
                  }}
                  size="lg"
                >
                  <Icon />
                  <span>{label}</span>
                  {id === "reviews" && pending.length > 0 && (
                    <b className="nav-count">{pending.length}</b>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          <div className="identity">
            <span className="avatar">
              {user.name
                .split(" ")
                .map((x: string) => x[0])
                .slice(0, 2)
                .join("")}
            </span>
            <div>
              <strong>{user.name}</strong>
              <small>{user.uni}</small>
            </div>
          </div>
          <div className="row">
            <Button variant="ghost" onClick={() => setView("settings")}>
              <Settings size={16} />
              Account
            </Button>
            <Button
              variant="ghost"
              onClick={async () => {
                invalidate();
                await api("logout", {});
                setUser(null);
                setState(null);
              }}
            >
              <LogOut size={16} />
              Out
            </Button>
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="topline">
          <div className="row">
            <SidebarTrigger />
            <span>
              URP <span className="muted">/ {currentTitle}</span>
            </span>
          </div>
          {staff && user.course !== "sandbox" && (
            <Pick
              label="Course dataset"
              value={course}
              onChange={(c) => {
                setCourse(c);
                clearReview();
              }}
              items={[
                { value: "live", label: "Fall 2026" },
                { value: "sandbox", label: "Fall 2026 · isolated test" },
              ]}
            />
          )}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Refresh course data"
            onClick={() =>
              refresh()
                .then(() => toast.success("Up to date"))
                .catch((e) => toast.error(e.message))
            }
          >
            <RefreshCw size={17} />
          </Button>
          <span className="term-label">{state.course === "sandbox" ? "FA2026 · TEST" : state.course==='archive'?'FA2025 ARCHIVE':'FALL 2026'}</span>
        </header>
        <main className="workspace-content">
          {state.course === "live" &&
            (state.meta || []).some((m: Item) => m.id === "live-source") && (
              <div className="demo-strip">
                Use Canvas for official submissions. Saving notes or uploading to Team project does not submit an assignment to Canvas.
              </div>
            )}
          {state.course === "archive" && (
            <div className="demo-strip">
              FA2025 ARCHIVE · Original student submissions. Peer scores and
              attendance are development simulations, not official grades.
            </div>
          )}
          {state.impersonating && (
            <div className="demo-strip">
              <strong>Student view: {user.name} ({user.uni}){state.course==='live'?' · Read-only':''}</strong>
              {state.impersonating && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    invalidate();
                    await action("return-staff", {}, "Returned to staff");
                    setView("overview");
                  }}
                >
                  Return to staff
                </Button>
              )}
            </div>
          )}
          {canvasSync&&<p className="muted" role="status">{canvasSync}</p>}
          <div className="page-heading">
            <div>
              <span className="eyebrow">
                {staff ? "TEACHING CONSOLE" : "YOUR COURSE"}
              </span>
              <h1>{currentTitle}</h1>
            </div>
            <span className="muted">{date(new Date().toISOString())}</span>
          </div>
          {openingReview ? (
            <Card aria-busy={!reviewLoadError}>
              <Button variant="outline" onClick={clearReview}>Back to peer reviews</Button>
              <h2>{title(allocations.find((a:Item)=>a.id===openingReview)?.assignment)}</h2>
              <p role={reviewLoadError?'alert':'status'}>{reviewLoadError||'Opening your review…'}</p>
              {reviewLoadError&&<Button onClick={()=>openReview(openingReview)}>Try again</Button>}
            </Card>
          ) : review ? (
            <ReviewEditor
              key={review.allocation.id}
              detail={{...review,readOnly:review.readOnly||!reviewWindow(review.allocation,review.assignment,reviewClock).open}}
              busy={busy}
              onSave={async (data) => {
                await action("review", data, "Review submitted");
                clearReview();
              }}
              onBack={() => clearReview()}
            />
          ) : (
            <>
              {staff && view==='overview' && state.course==='live' && <TeachingDashboard onStudent={async(id:string)=>{invalidate();await action('impersonate',{id},'Read-only student view');setView('sessions');}}/>}
              {staff && view==='course-preview' && <><div className="demo-strip">COURSE CONTENT PREVIEW · Read-only view; no student is impersonated. Personal submission statuses are intentionally not shown.</div><SessionWorkspace key={state.course} state={{...state,preview:true,assignment:(state.assignment||[]).filter((a:Item)=>a.published!==false&&!a.retiredFromCanvas),submission:[],['submission-status']:[]}}/></>}
              {view === "treks" && <TrekWorkspace key={course+user.id} userId={user.id} course={course} name={user.name} readOnly={!!state.impersonating&&course==='live'} />}
              {view === "vpa" && <VpaWorkspace key={course+user.id} userId={user.id} course={course} name={user.name} canvasStatuses={state['submission-status']} />}
              {!staff && view === "reviews" && <nav className="trek-switch" aria-label="Peer reviews"><button aria-pressed={peerTab==='write'} onClick={()=>setPeerTab('write')}>Reviews to give {pending.length>0&&`(${pending.length})`}</button><button aria-pressed={peerTab==='received'} onClick={()=>setPeerTab('received')}>Feedback received</button></nav>}
              {!staff && view === "reviews" && peerTab === "write" && (
                <div className="card-grid">
                  {visibleAllocations.map((a: Item) => {
                    const done = reviews.some((r: Item) => r.parent === a.id);
                    const window=reviewWindow(a,assignments.find((x:Item)=>x.id===a.assignment),reviewClock);
                    return (
                      <Card key={a.id}>
                        <div className="row between">
                          <NotebookPen />
                          <Pill good={done}>
                            {done ? "Submitted" : "To do"}
                          </Pill>
                        </div>
                        <h3>{title(a.assignment)}</h3>
                        <p className="muted">Peer review · your name is not shown with feedback. Submitted files may identify their author.</p>
                        {done&&(state['participation-credit']||[]).some((c:Item)=>c.parent===a.id)&&<p className="muted">Review completed · participation eligibility recorded</p>}
                        <p className="deadline"><Clock size={14}/>{window.expiresAt?(window.expired?"Closed ":"Due ")+courseDate(window.expiresAt):"Timing to be confirmed"}</p>
                        <Button
                          variant={done ? "outline" : "default"}
                          onClick={() => openReview(a.id)}
                        >
                          {done ? "Read review" : "Start review"}
                          <ArrowUpRight />
                        </Button>
                      </Card>
                    );
                  })}
                  {!visibleAllocations.length && (
                    <Empty>No active invitations. Reviews are available for one week after the VPA deadline. Completed reviews remain here.</Empty>
                  )}
                </div>
              )}
              {!staff && view === "sessions" && <SessionWorkspace key={state.course} state={state} />}
              {!staff &&
                view === "reviews" && peerTab === "received" &&
                (state.feedbackLocked && pending.length>0 && !state.feedback?.length ? (
                  <Card>
                    <LockKeyhole />
                    <h2>Finish your reviews first.</h2>
                    <p>
                      {pending.length} review{pending.length === 1 ? "" : "s"}{" "}
                      left before your feedback opens.
                    </p>
                    <Button onClick={() => setPeerTab("write")}>
                      Go to reviews
                    </Button>
                  </Card>
                ) : (
                  <div className="card-grid">
                    {(state.feedback || []).map((r: Item) => (
                      <Card key={r.id}>
                        <Pill good>Anonymous feedback</Pill>
                        <h3>{title(r.assignment)}</h3>
                        <div className="score-display">
                          {r.total}
                          <small> rubric points</small>
                        </div>
                        {Object.entries(r.comments || {}).map(([k, v]) => (
                          <div className="feedback-criterion" key={k}>
                            <strong>
                              {assignments
                                .find((a: Item) => a.id === r.assignment)
                                ?.rubric?.find((c: Item) => c.id === k)
                                ?.title || k}{" "}
                              · {r.scores[k]}
                            </strong>
                            <p>{String(v)}</p>
                          </div>
                        ))}
                        <p>{r.comment}</p>
                      </Card>
                    ))}
                    {!state.feedback?.length && (
                      <Empty>No feedback received yet.</Empty>
                    )}
                  </div>
                ))}
              {!staff && view === "team" && (
                <>
                  <TeamCanvasPanel key={course+user.id} course={course} userId={user.id}/>
                  <div className="columns">
                    <Card>
                      <div className="row between">
                        <h2>
                          {groups.find((g: Item) => g.id === user.group_id)
                            ?.name || "Your project team"}
                        </h2>
                        <Users />
                      </div>
                      <div className="member-grid">
                        {people.map((p: Item) => (
                          <div className="identity" key={p.id}>
                            <span className="avatar">
                              {p.name
                                .split(" ")
                                .map((x: string) => x[0])
                                .join("")}
                            </span>
                            <div>
                              <strong>{p.name}</strong>
                              <small>{p.uni}</small>
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>
                    <Card>
                      <h3>Team assessment</h3>
                      <p className="muted">
                        Your responses are confidential to the teaching team.
                      </p>
                      {rounds.map((r: Item) => (
                        <div className="list-row" key={r.id}>
                          <div>
                            <strong>{r.title}</strong>
                            <small>
                              {r.closes
                                ? "Closes " + date(r.closes)
                                : "Timing set by the teaching team"}
                            </small>
                          </div>
                          <Button
                            variant="outline"
                            disabled={
                              !r.open ||
                              (r.closes && Date.parse(r.closes) <= Date.now())
                            }
                            onClick={() => setView("rate:" + r.id)}
                          >
                            {r.open ? "Rate teammates" : "Closed"}
                          </Button>
                        </div>
                      ))}
                    </Card>
                  </div>
                  <Card>
                    <h3>Project milestones</h3>
                    <div className="milestone-track">
                      {(state.milestone || []).map((m: Item,index:number) => {
                        return (
                          <div className="list-row" key={m.id}>
                            <span className="project-stage-number">{index+1}</span>
                            <div className="grow">
                              <strong>{m.title}</strong>
                              <small>
                                {m.due?date(m.due)+' · ':''}{m.detail}
                              </small>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                  <Card>
                    <h3>Shared files</h3>
                    <p className="muted">
                      Everyone in your team can see these files.
                    </p>
                    <p className="muted">{((state.teamStorage?.used||0)/1_000_000).toFixed(1)} MB used of 1 GB shared team storage.</p>
                    <FileList files={state.file || []} course={course} />
                    <form
                      className="upload-form"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const form = e.currentTarget;
                        setBusy(true);
                        try {
                          const f = new FormData(form),
                            file = f.get("file") as File;
                          const r = await fetch("/api/upload", {
                            method: "POST",
                            headers: {
                              "Content-Type": "application/octet-stream",
                              "X-File-Name": encodeURIComponent(file.name),
                            },
                            body: file,
                          });
                          const d: any = await r.json();
                          if (!r.ok) throw new Error(d.error);
                          await refresh();
                          form.reset();
                          toast.success("Uploaded — your team can see it");
                        } catch (e) {
                          toast.error((e as Error).message);
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      <label>
                        File (up to 40 MB)
                        <Input
                          type="file"
                          name="file"
                          accept=".pdf,.pptx,.docx,.xlsx,.csv,.txt,.png,.jpg,.jpeg,.webp"
                          required
                          disabled={!user.group_id}
                        />
                      </label>
                      <Button disabled={busy || !user.group_id}>
                        Upload to team
                      </Button>
                    </form>
                  </Card>
                </>
              )}
              {!staff && view.startsWith("rate:") && (
                <AssessmentEditor
                  round={rounds.find((r: Item) => r.id === view.slice(5))}
                  people={people}
                  user={user}
                  saved={state.assessment || []}
                  busy={busy}
                  onSave={(data) =>
                    action("assessment", data, "Assessment saved")
                  }
                  onBack={() => setView("team")}
                />
              )}
              {staff && view === "overview" && state.course!=='live' && (
                <>
                  <div className="metrics">
                    <Metric
                      label="Students"
                      value={
                        state.course==='live' ? (state.meta||[]).find((m:Item)=>m.id==='live-roster')?.students ?? people.filter((p:Item)=>p.role==='student').length : people.filter((p: Item) => p.role === "student").length
                      }
                    />
                    <Metric
                      label="Reviews outstanding"
                      value={pending.length}
                    />
                    <Metric
                      label="Shared files"
                      value={state.file?.length || 0}
                    />
                    <Metric
                      label="Open assessment rounds"
                      value={rounds.filter((r: Item) => r.open).length}
                    />
                  </div>
                  {course === "demo" && !people.length && (
                    <Card className="focus-card">
                      <h2>Try the complete course flow.</h2>
                      <p>
                        Create a separate demonstration class, then preview any
                        student account.
                      </p>
                      <Button
                        disabled={busy}
                        onClick={() =>
                          action("seed-demo", {}, "Demo course ready").catch(
                            () => {},
                          )
                        }
                      >
                        Prepare demo class
                      </Button>
                    </Card>
                  )}
                  <div className="columns">
                    <Card>
                      <h3>Review completion</h3>
                      {assignments.filter((a:Item)=>state.course!=='live'||(a.published!==false&&!a.retiredFromCanvas&&a.assignmentType==='vpa')).map((a: Item) => {
                        const aa = allocations.filter(
                            (x: Item) => x.assignment === a.id,
                          ),
                          done = aa.filter((x: Item) =>
                            reviews.some((r: Item) => r.parent === x.id),
                          ).length;
                        return (
                          <div className="progress-row" key={a.id}>
                            <div className="row between">
                              <span>{a.title}</span>
                              <strong>
                                {done}/{aa.length}
                              </strong>
                            </div>
                            <Progress
                              value={aa.length ? (100 * done) / aa.length : 0}
                            />
                          </div>
                        );
                      })}
                      {!assignments.length && (
                        <Empty>No assignments loaded.</Empty>
                      )}
                    </Card>
                    <Card>
                      <h3>Next actions</h3>
                      <a
                        className="action-row"
                        href={"/api/export?course=" + course}
                      >
                        <Download />
                        <span>Export course records</span>
                        <ArrowUpRight />
                      </a>
                      <button
                        className="action-row"
                        onClick={() => setView("people")}
                      >
                        <Users />
                        <span>Manage student accounts</span>
                        <ArrowUpRight />
                      </button>
                      <button
                        className="action-row"
                        onClick={() => setView("attendance")}
                      >
                        <CalendarCheck />
                        <span>Open attendance register</span>
                        <ArrowUpRight />
                      </button>
                      <button
                        className="action-row"
                        onClick={() => setView("assessment")}
                      >
                        <MessageSquare />
                        <span>Manage assessment windows</span>
                        <ArrowUpRight />
                      </button>
                    </Card>
                  </div>
                </>
              )}
              {staff && view === "people" && (
                <>
                  <Card>
                    <div className="row between">
                      <h3>Roster</h3>
                      {course === "live" && (
                        <Button
                          disabled={busy || !state.integrations?.canvas}
                          onClick={() =>
                            action(
                              "canvas-sync",
                              {},
                              "Roster and assignments synced",
                            ).catch(() => {})
                          }
                        >
                          Sync Canvas roster
                        </Button>
                      )}
                    </div>
                    <div className="table-scroll">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>UNI</TableHead>
                            <TableHead>Team</TableHead>
                            <TableHead>Account</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {people.map((p: Item) => (
                            <TableRow key={p.id}>
                              <TableCell>{p.name}</TableCell>
                              <TableCell>{p.uni}</TableCell>
                              <TableCell>
                                {groups.find((g: Item) => g.id === p.group_id)
                                  ?.name || "Unassigned"}
                              </TableCell>
                              <TableCell>
                                {p.role === "student" && !p.disabled ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={async () => {
                                      invalidate();
                                      await action(
                                        "impersonate",
                                        { id: p.id },
                                        "Student preview",
                                      );
                                      setView("sessions");
                                    }}
                                  >
                                    Student view
                                  </Button>
                                ) : (
                                  <Pill>
                                    {p.disabled
                                      ? "Disabled"
                                      : p.must_change
                                        ? "Change password required"
                                        : p.role}
                                  </Pill>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </Card>
                  {user.course !== "sandbox" && <Card>
                    <h3>Create an account</h3>
                    <AccountForm
                      groups={groups}
                      busy={busy}
                      submit={(b: Item) =>
                        action("account", b, "Account created")
                      }
                    />
                  </Card>}
                  {user.course !== "sandbox" && <Card>
                    <h3>Reset a password</h3>
                    <ResetForm
                      people={people}
                      busy={busy}
                      submit={(b: Item) =>
                        action("reset-password", b, "Temporary password set")
                      }
                    />
                  </Card>}
                  <TeamControls
                    people={people}
                    groups={groups}
                    busy={busy}
                    action={action}
                  />
                </>
              )}
              {staff && view === "submissions" && (
                <SubmissionRegister
                  assignments={assignments}
                  submissions={state.submission || []}
                  people={people}
                  course={course}
                  integrations={state.integrations}
                  files={state.sourcefile || []}
                  action={action}
                />
              )}{" "}
              {staff && view === "calendar" && (
                <>
                <SessionEditor key={state.course} course={state.course} events={events} assignments={assignments} busy={busy} action={action}/>
                <CalendarManager
                  events={events}
                  milestones={state.milestone || []}
                  busy={busy}
                  action={action}
                />
                </>
              )}{" "}
              {staff && view === "allocations" && (
                <>
                  <ReviewRoundPanel key={course} course={course} assignments={assignments} credits={state['participation-credit']||[]} onChange={()=>refresh()}/>
                  <Card>
                    <h3>Review register</h3>
                    <div className="table-scroll">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Reviewer</TableHead>
                            <TableHead>Assignment</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Score</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {allocations.map((a: Item) => {
                            const r = reviews.find(
                              (x: Item) => x.parent === a.id,
                            );
                            return (
                              <TableRow key={a.id}>
                                <TableCell>{name(a.owner)}</TableCell>
                                <TableCell>
                                  <button onClick={() => openReview(a.id)}>
                                    {title(a.assignment)}
                                  </button>
                                </TableCell>
                                <TableCell>
                                  <Pill good={!!r}>
                                    {r ? "Done" : "Pending"}
                                  </Pill>
                                </TableCell>
                                <TableCell>{r?.total ?? "—"}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </Card>
                </>
              )}
              {staff && view === "assessment" && (
                <>
                  <div className="card-grid">
                    {rounds.map((r: Item) => (
                      <Card key={r.id}>
                        <div className="row between">
                          <h3>{r.title}</h3>
                          <Pill good={r.open}>
                            {r.open ? "Open" : "Closed"}
                          </Pill>
                        </div>
                        <p>
                          {
                            (state.assessment || []).filter(
                              (a: Item) => a.round === r.id,
                            ).length
                          }{" "}
                          responses
                        </p>
                        <Button
                          disabled={busy}
                          variant={r.open ? "outline" : "default"}
                          onClick={() =>
                            action(
                              "round",
                              { id: r.id, open: !r.open, closes: r.closes },
                              r.open ? "Round closed" : "Round opened",
                            ).catch(() => {})
                          }
                        >
                          {r.open ? "Close round" : "Open round"}
                        </Button>
                        <RoundWindow
                          key={r.updated}
                          round={r}
                          busy={busy}
                          onSave={(b) =>
                            action("round", b, "Closing time saved")
                          }
                        />
                      </Card>
                    ))}
                  </div>
                  <Card>
                    <h3>Team contribution</h3>
                    <p className="muted">
                      Advisory peer ratings, not grades. Self-ratings are
                      excluded.
                    </p>
                    <AssessmentSummary
                      assessments={state.assessment || []}
                      people={people}
                      groups={groups}
                      rounds={rounds}
                    />
                  </Card>
                </>
              )}
              {staff && view === "attendance" && (
                <AttendanceRegister
                  events={events}
                  people={people}
                  attendance={state.attendance || []}
                  busy={busy}
                  onSave={(b: Item) =>
                    action("attendance", b, "Register saved")
                  }
                />
              )}
              {staff && view === "teams" && (
                <div className="card-grid">
                  {groups.map((g: Item) => (
                    <Card key={g.id}>
                      <h3>{g.name}</h3>
                      <p className="muted">
                        {people
                          .filter((p: Item) => p.group_id === g.id)
                          .map((p: Item) => p.name)
                          .join(" · ")}
                      </p>
                      <FileList
                        files={(state.file || []).filter(
                          (f: Item) => f.group_id === g.id,
                        )}
                        course={course}
                      />
                      {(state.booking || [])
                        .filter((b: Item) => b.group_id === g.id)
                        .map((b: Item) => (
                          <p key={b.id}>
                            Client meeting: {b.contact} · {date(b.time)}
                          </p>
                        ))}
                    </Card>
                  ))}
                </div>
              )}
              {staff && view === "insights" && (
                <>
                  <Card>
                    <h3>Read across the class</h3>
                    <p>
                      Compare observations, recurring themes and distinctive
                      insights. Reports are advisory, never an automated grade
                      or proof of AI use.
                    </p>
                    <div className="button-wrap">
                      {assignments
                        .filter((a: Item) =>
                          (state.submission || []).some(
                            (s: Item) => s.parent === a.id,
                          ),
                        )
                        .map((a: Item) => (
                          <AnalyzeButton
                            key={a.id}
                            assignment={a}
                            course={course}
                            enabled={state.integrations?.ai}
                            onDone={refresh}
                          />
                        ))}
                    </div>
                    {!state.integrations?.ai && (
                      <p className="muted">
                        {state.course === "sandbox" ? "Real student insights are not copied here. Paid AI runs are disabled for test accounts." : "AI credentials have not been configured."}
                      </p>
                    )}
                  </Card>
                  {(state.extraction || []).length > 0 && (
                    <Card>
                      <h3>Individual observations</h3>
                      <p className="muted">
                        Evidence quotes and writing notes for staff review — not
                        AI-authorship detection.
                      </p>
                      {state.extraction.map((e: Item) => (
                        <details key={e.id}>
                          <summary className="list-row">
                            <strong>{name(e.owner)}</strong>
                            <span>
                              {(e.observations || []).length} observations
                            </span>
                          </summary>
                          {(e.observations || []).map((o: Item, i: number) => (
                            <blockquote key={i}>
                              <strong>{o.claim}</strong>
                              <p>“{o.evidence}”</p>
                              <small>
                                {o.concept} · {o.specificity}
                              </small>
                            </blockquote>
                          ))}
                          {e.writingSignal?.note && (
                            <p className="muted">{e.writingSignal.note}</p>
                          )}
                        </details>
                      ))}
                    </Card>
                  )}
                  {(state.insight || []).map((r: Item) => (
                    <Card key={r.id}>
                      <h3>{title(r.assignment)}</h3>
                      <Pill>AI-assisted · verify against submissions</Pill>
                      <p>{r.headline}</p>
                      <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() =>
                          action(
                            "insight-release",
                            { id: r.id, released: !r.released },
                            r.released
                              ? "Hidden from students"
                              : "Personal insights released",
                          ).catch(() => {})
                        }
                      >
                        {r.released
                          ? "Hide from students"
                          : "Release personal insights to students"}
                      </Button>
                      <h4>Shared themes</h4>
                      {r.consensus?.map((x: Item, i: number) => (
                        <blockquote key={i}>
                          <strong>{x.insight}</strong>
                          <p>
                            {typeof x.evidence === "string"
                              ? x.evidence
                              : JSON.stringify(x.evidence)}
                          </p>
                        </blockquote>
                      ))}
                      <h4>Distinctive observations</h4>
                      {r.singletons?.map((x: Item, i: number) => (
                        <blockquote key={i}>
                          <strong>
                            {name(x.studentId)} · {x.insight}
                          </strong>
                          <p>“{x.evidence}”</p>
                          <small>{x.why_inobvious}</small>
                          <p>{x.teaching_use}</p>
                        </blockquote>
                      ))}
                      {r.teachingNotes?.length > 0 && (
                        <>
                          <h4>Teaching notes</h4>
                          <ul>
                            {r.teachingNotes.map((n: string, i: number) => (
                              <li key={i}>{n}</li>
                            ))}
                          </ul>
                        </>
                      )}
                    </Card>
                  ))}
                </>
              )}
            </>
          )}
        </main>
        {!staff && (
          <nav className="mobile-nav" aria-label="Student navigation">
            {studentNav.map(([id, label, Icon]: any) => (
              <button
                key={id}
                aria-current={view === id ? "page" : undefined}
                onClick={() => {
                  setView(id);
                  clearReview();
                }}
              >
                <Icon size={20} />
                <span>
                  {id === "team" ? "Team" : label}
                </span>
              </button>
            ))}
          </nav>
        )}
      </SidebarInset>
    </SidebarProvider>
  );
}
function Metric({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>
        {value === null ? "—" : value.toString().padStart(2, "0")}
      </strong>
    </div>
  );
}
function FileList({ files, course }: { files: Item[]; course: string }) {
  return files.length ? (
    <div>
      {files.map((f) => (
        <div className="list-row" key={f.id}>
          <FileText />
          <div className="grow">
            <strong>{f.filename}</strong>
            <small>
              {f.uploader} · {date(f.uploadedAt || f.updated)} ·{" "}
              {Math.max(1, Math.round(f.size / 1024))} KB
            </small>
          </div>
          <a
            className="download-link"
            href={
              "/api/file?id=" + encodeURIComponent(f.id) + "&course=" + course
            }
            aria-label={"Download " + f.filename}
          >
            <Download size={19} />
          </a>
        </div>
      ))}
    </div>
  ) : (
    <Empty>No shared files yet.</Empty>
  );
}
function ReviewEditor({
  detail,
  busy,
  onSave,
  onBack,
}: {
  detail: Item;
  busy: boolean;
  onSave: (d: Item) => Promise<void>;
  onBack: () => void;
}) {
  const [scores, setScores] = useState<Item>(
      detail.draft?.scores || detail.review?.scores || {},
    ),
    [comments, setComments] = useState<Item>(
      detail.draft?.comments || detail.review?.comments || {},
    ),
    [comment, setComment] = useState(
      detail.draft?.comment || detail.review?.comment || "",
    );
  const rubric = detail.assignment.rubric || [];
  const [draftNotice,setDraftNotice]=useState('Drafts save automatically; Submit review completes the review.');
  const reviewVersion=useRef(detail.draft?.revision||0),reviewQueue=useRef<Promise<any>>(Promise.resolve()),reviewAlive=useRef(true),reviewFinished=useRef(false),reviewLatest=useRef<any>(null),reviewFlush=useRef<()=>Promise<any>>(async()=>{}),reviewSaved=useRef(JSON.stringify({scores,comments,comment}));
  reviewLatest.current={scores,comments,comment};
  function persistReview(){const snapshot=reviewLatest.current;if(detail.readOnly||reviewFinished.current||JSON.stringify(snapshot)===reviewSaved.current)return reviewQueue.current;reviewQueue.current=reviewQueue.current.catch(()=>{}).then(async()=>{if(reviewFinished.current)return;const result=await api('review-draft',{id:detail.allocation.id,...snapshot,revision:reviewVersion.current});reviewVersion.current=result.revision;reviewSaved.current=JSON.stringify(snapshot);if(reviewAlive.current)setDraftNotice('Draft saved to your account — not submitted.');});return reviewQueue.current;}
  reviewFlush.current=persistReview;
  useEffect(()=>{if(detail.readOnly)return;const timer=setTimeout(()=>{persistReview().catch(e=>{if(reviewAlive.current)setDraftNotice(e.message);});},1200);return()=>clearTimeout(timer);},[scores,comments,comment,detail.readOnly]);
  useEffect(()=>{reviewAlive.current=true;return()=>{reviewAlive.current=false;reviewFlush.current().catch(()=>{});};},[]);
  const done = rubric.filter(
    (c: Item) => scores[c.id] !== undefined && comments[c.id]?.trim(),
  ).length;
  return (
    <>
      <Button variant="ghost" onClick={onBack}>
        ← Back
      </Button>
      <div className="columns review-columns">
        <Card className="submission">
          <span className="eyebrow">ASSIGNED SUBMISSION</span>
          <h2>{detail.assignment.title}</h2>
          <ReviewAttachments files={detail.submission.files||[]}/>
          <div className="prose-text">
            {detail.submission.text ||
              "Text extraction is not available for this submission."}
          </div>
        </Card>
        <Card>
          <h3>{detail.readOnly ? "Submitted review" : "Your review"}</h3>
          {detail.assignment.demoRubric && (
            <Pill>Illustrative demo rubric</Pill>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (detail.readOnly) return;
              persistReview().then(()=>{reviewFinished.current=true;return onSave({
                id: detail.allocation.id,
                scores,
                comments,
                comment,
              });}).catch((e) => {reviewFinished.current=false;setDraftNotice(e.message);});
            }}
          >
            <fieldset disabled={detail.readOnly}>
              {!detail.readOnly&&<p role="status" className="muted">{draftNotice}</p>}
              {rubric.map((c: Item) => (
                <div className="rubric-block" key={c.id}>
                  <div className="row between">
                    <strong>{c.title}</strong>
                    <span>
                      {scores[c.id] ?? "—"} / {c.points}
                    </span>
                  </div>
                  <p className="muted">{c.description}</p>
                  <div
                    className="score-options"
                    role="group"
                    aria-label={c.title}
                  >
                    {Array.from({ length: c.points + 1 }, (_, i) => (
                      <Button
                        key={i}
                        type="button"
                        variant={scores[c.id] === i ? "default" : "outline"}
                        aria-pressed={scores[c.id] === i}
                        onClick={() => setScores({ ...scores, [c.id]: i })}
                      >
                        {i}
                      </Button>
                    ))}
                  </div>
                  {c.ratings?.find((r: Item) => r.points === scores[c.id]) && (
                    <p className="muted">
                      {
                        c.ratings.find((r: Item) => r.points === scores[c.id])
                          .description
                      }{" "}
                      ·{" "}
                      {
                        c.ratings.find((r: Item) => r.points === scores[c.id])
                          .long_description
                      }
                    </p>
                  )}
                  <label>
                    Comment
                    <Textarea
                      required
                      value={comments[c.id] || ""}
                      onChange={(e) =>
                        setComments({ ...comments, [c.id]: e.target.value })
                      }
                    />
                  </label>
                </div>
              ))}
              <label>
                Overall comment (optional)
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
              </label>
              <div className="save-bar">
                <div>
                  <strong>
                    {Object.values(scores).reduce(
                      (a: number, b: any) => a + Number(b),
                      0,
                    )}{" "}
                    points
                  </strong>
                  <small>
                    {done}/{rubric.length} complete
                  </small>
                </div>
                {!detail.readOnly && (
                  <div className="button-wrap">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        persistReview()
                          .then(() =>
                            toast.success("Draft saved — not submitted"),
                          )
                          .catch((e) => toast.error(e.message))
                      }
                    >
                      Save draft
                    </Button>
                    <Button
                      disabled={
                        busy || done !== rubric.length || !rubric.length
                      }
                    >
                      Submit review
                    </Button>
                  </div>
                )}
              </div>
            </fieldset>
          </form>
        </Card>
      </div>
    </>
  );
}
const dims = [
  ["share", "Fair share of the work"],
  ["reliable", "Reliability"],
  ["quality", "Quality of work"],
  ["field", "Field research"],
  ["collab", "Working with the team"],
];
function AssessmentEditor({
  round,
  people,
  user,
  saved,
  busy,
  onSave,
  onBack,
}: {
  round: Item;
  people: Item[];
  user: Item;
  saved: Item[];
  busy: boolean;
  onSave: (b: Item) => Promise<any>;
  onBack: () => void;
}) {
  const [target, setTarget] = useState(people[0]?.id || "");
  const row = saved.find((a) => a.round === round?.id && a.target === target);
  return (
    <>
      <Button variant="ghost" onClick={onBack}>
        ← Back to team
      </Button>
      <Card>
        <h2>{round?.title}</h2>
        <Pick
          value={target}
          onChange={setTarget}
          label="Teammate"
          items={people.map((p) => ({
            value: p.id,
            label: p.name + (p.id === user.id ? " (self-assessment)" : ""),
          }))}
        />
        <TeammateForm
          key={target}
          row={row}
          target={target}
          round={round}
          busy={busy}
          onSave={onSave}
        />
      </Card>
    </>
  );
}
function TeammateForm({ row, target, round, busy, onSave }: Item) {
  const [scores, setScores] = useState<Item>(row?.scores || {});
  const [well,setWell]=useState(row?.well||''),[improve,setImprove]=useState(row?.improve||''),[privateNote,setPrivateNote]=useState(row?.privateNote||''),[loaded,setLoaded]=useState(false),[draftStatus,setDraftStatus]=useState('Loading saved draft…');
  const draftRevision=useRef(0),savedText=useRef(''),draftQueue=useRef<Promise<any>>(Promise.resolve()),alive=useRef(true),latest=useRef<any>(null),flush=useRef<()=>Promise<any>>(async()=>{});
  latest.current={round:round.id,target,scores,well,improve,privateNote};
  useEffect(()=>{let cancelled=false;api('assessment-draft?round='+encodeURIComponent(round.id)+'&target='+encodeURIComponent(target)).then(r=>{if(cancelled)return;draftRevision.current=r.draft.revision;const source=r.draft.revision&&(!row?.updated||r.draft.updated>row.updated)?r.draft:row||{};setScores(source.scores||{});setWell(source.well||'');setImprove(source.improve||'');setPrivateNote(source.privateNote||'');savedText.current=JSON.stringify({round:round.id,target,scores:source.scores||{},well:source.well||'',improve:source.improve||'',privateNote:source.privateNote||''});setLoaded(true);setDraftStatus('Drafts save automatically. Not submitted until you save assessment.');}).catch(e=>{if(!cancelled)setDraftStatus(e.message);});return()=>{cancelled=true;};},[round.id,target]);
  function persistAssessment(){const snapshot=latest.current;if(!loaded||JSON.stringify(snapshot)===savedText.current)return draftQueue.current;draftQueue.current=draftQueue.current.catch(()=>{}).then(async()=>{const response=await api('assessment-draft',{...snapshot,revision:draftRevision.current});draftRevision.current=response.draft.revision;savedText.current=JSON.stringify(snapshot);if(alive.current)setDraftStatus('Draft saved to your account — not submitted.');});return draftQueue.current;}
  flush.current=persistAssessment;
  useEffect(()=>{if(!loaded)return;const timer=setTimeout(()=>{persistAssessment().catch(e=>{if(alive.current)setDraftStatus(e.message);});},1200);return()=>clearTimeout(timer);},[scores,well,improve,privateNote,loaded]);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;flush.current().catch(()=>{});};},[]);
  return (
    <form
      className="form-stack"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        persistAssessment().then(()=>onSave({
          round: round.id,
          target,
          scores,
          well: f.get("well"),
          improve: f.get("improve"),
          privateNote: f.get("privateNote"),
        })).catch(() => {});
      }}
    >
      <p role="status" className="muted">{draftStatus}</p><fieldset disabled={!loaded||busy}>{dims.map(([key, label]) => (
        <div className="rating-row" key={key}>
          <strong>{label}</strong>
          <div className="score-options" role="group" aria-label={label}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Button
                type="button"
                key={n}
                variant={scores[key] === n ? "default" : "outline"}
                aria-pressed={scores[key] === n}
                onClick={() => setScores({ ...scores, [key]: n })}
              >
                {n}
              </Button>
            ))}
          </div>
          <small className="muted">
            1 · Below expectations — 3 · Meets expectations — 5 · Exceeds
            expectations
          </small>
        </div>
      ))}
      <label>
        One thing they did well
        <Textarea name="well" value={well} onChange={e=>setWell(e.target.value)} required />
      </label>
      <label>
        One thing they could do differently
        <Textarea name="improve" value={improve} onChange={e=>setImprove(e.target.value)} required />
      </label>
      <label>
        Private note to teaching team (optional)
        <Textarea name="privateNote" value={privateNote} onChange={e=>setPrivateNote(e.target.value)} />
      </label>
      <Button disabled={busy || Object.keys(scores).length < 5 || !round.open}>
        Save assessment
      </Button></fieldset>
    </form>
  );
}
function AttendanceRegister({
  events,
  people,
  attendance,
  busy,
  onSave,
}: Item) {
  const [event, setEvent] = useState(events[0]?.id || ""),
    [marks, setMarks] = useState<Item>({}),
    [search, setSearch] = useState("");
  useEffect(() => {
    const initial: Item = {};
    for (const p of people.filter((x: Item) => x.role === "student"))
      initial[p.id] =
        attendance.find((a: Item) => a.parent === event && a.owner === p.id)
          ?.status || "unrecorded";
    setMarks(initial);
  }, [event, attendance, people]);
  return (
    <Card>
      <div className="row between">
        <h3>Register</h3>
        <Pick
          value={event}
          onChange={setEvent}
          label="Class or trek"
          items={events.map((e: Item) => ({
            value: e.id,
            label: date(e.date) + " · " + e.title,
          }))}
        />
      </div>
      <Input
        aria-label="Search students"
        placeholder="Find a student…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {people
        .filter(
          (p: Item) =>
            p.role === "student" &&
            p.name.toLowerCase().includes(search.toLowerCase()),
        )
        .map((p: Item) => (
          <div className="list-row register-row" key={p.id}>
            <strong>{p.name}</strong>
            <div
              className="attendance-options"
              role="group"
              aria-label={p.name + " attendance"}
            >
              {["unrecorded", "present", "late", "excused", "absent"].map(
                (s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant={marks[p.id] === s ? "default" : "outline"}
                    aria-pressed={marks[p.id] === s}
                    onClick={() => setMarks({ ...marks, [p.id]: s })}
                  >
                    {s}
                  </Button>
                ),
              )}
            </div>
          </div>
        ))}
      <div className="save-bar">
        <span>Unmarked students stay unrecorded.</span>
        <Button
          disabled={busy || !event}
          onClick={() =>
            onSave({
              event,
              marks: Object.entries(marks).map(([id, status]) => ({
                id,
                status,
              })),
            }).catch(() => {})
          }
        >
          Save register
        </Button>
      </div>
    </Card>
  );
}
function AccountForm({ groups, busy, submit }: Item) {
  const [role, setRole] = useState("student"),
    [group, setGroup] = useState("none");
  return (
    <form
      className="form-grid"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        submit({
          uni: f.get("uni"),
          name: f.get("name"),
          password: f.get("password"),
          role,
          group: group === "none" ? "" : group,
        }).catch(() => {});
      }}
    >
      <label>
        UNI
        <Input name="uni" required />
      </label>
      <label>
        Full name
        <Input name="name" required />
      </label>
      <label>
        Role
        <Pick
          value={role}
          onChange={setRole}
          label="Role"
          items={[
            { value: "student", label: "Student" },
            { value: "staff", label: "Teaching staff" },
          ]}
        />
      </label>
      <label>
        Team
        <Pick
          value={group}
          onChange={setGroup}
          label="Team"
          items={[
            { value: "none", label: "Not assigned" },
            ...groups.map((g: Item) => ({ value: g.id, label: g.name })),
          ]}
        />
      </label>
      <label>
        Temporary password
        <Input
          type="password"
          name="password"
          minLength={12}
          autoComplete="new-password"
          required
        />
      </label>
      <Button disabled={busy}>Create account</Button>
    </form>
  );
}
function ResetForm({ people, busy, submit }: Item) {
  const [id, setId] = useState("");
  return (
    <form
      className="form-grid"
      onSubmit={(e) => {
        e.preventDefault();
        submit({
          id,
          password: new FormData(e.currentTarget).get("password"),
        }).catch(() => {});
      }}
    >
      <label>
        Account
        <Pick
          value={id}
          onChange={setId}
          label="Select account"
          items={people.map((p: Item) => ({
            value: p.id,
            label: p.name + " · " + p.uni,
          }))}
        />
      </label>
      <label>
        New temporary password
        <Input type="password" name="password" minLength={12} required />
      </label>
      <Button disabled={busy || !id}>Reset password</Button>
    </form>
  );
}
function AssessmentSummary({ assessments, people, groups, rounds }: Item) {
  const [round, setRound] = useState(rounds[0]?.id || "");
  const selected = assessments.filter((a: Item) => a.round === round);
  return (
    <div>
      <Pick
        label="Assessment round"
        value={round}
        onChange={setRound}
        items={rounds.map((r: Item) => ({ value: r.id, label: r.title }))}
      />
      <p className="muted">
        Relative index compares each student with their team median. Adjusted
        index accounts for generous or strict raters. These are prompts for
        review, not automatic grade changes.
      </p>
      {groups.map((g: Item) => {
        const members = people.filter((p: Item) => p.group_id === g.id),
          scores = scoreGroup(members, selected);
        return (
          <div key={g.id} className="group-summary">
            <h4>{g.name}</h4>
            {members.map((p: Item) => {
              const s = scores.find((x) => x.id === p.id)!,
                rs = selected.filter(
                  (a: Item) => a.target === p.id && a.owner !== p.id,
                );
              return (
                <details key={p.id}>
                  <summary className="list-row">
                    <strong>{p.name}</strong>
                    <span>
                      {s.avg?.toFixed(2) || "—"} / 5 · {s.n}/
                      {Math.max(0, members.length - 1)} peer responses
                    </span>
                  </summary>
                  <div className="metrics">
                    <Metric
                      label="Relative index"
                      value={
                        s.index === null ? null : Number(s.index.toFixed(2))
                      }
                    />
                    <Metric
                      label="Rater-adjusted index"
                      value={
                        s.indexAdj === null
                          ? null
                          : Number(s.indexAdj.toFixed(2))
                      }
                    />
                  </div>
                  {!s.n && <p>No peer scores yet; indices are unavailable.</p>}
                  {s.flags.map((f) => (
                    <Pill key={f}>{f}</Pill>
                  ))}
                  {s.selfGap !== null && (
                    <p>Self / peer gap: {s.selfGap.toFixed(2)}</p>
                  )}
                  {rs.map((r: Item) => (
                    <div className="feedback-criterion" key={r.id}>
                      <small>
                        {people.find((x: Item) => x.id === r.owner)?.name}
                      </small>
                      <p>{r.well}</p>
                      <p>{r.improve}</p>
                      {r.privateNote && <p>Private note: {r.privateNote}</p>}
                    </div>
                  ))}
                </details>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

import {
  all,
  one,
  run,
  records,
  getRecord,
  save,
  uid,
  now,
  identity,
  session,
  passwordHash,
  verify,
  hash,
  cookie,
  protectMutation,
  rateLimit,
  safeUser,
  check,
  fail,
  string,
  audit,
  runtime,
  User,
  RecordRow,
  unpack,
} from "@/lib/server";
import { seedDemo } from "@/lib/demo";
import {reserveTeamUpload,teamStorage} from '@/lib/team-storage';
import {after} from 'next/server';
import {workspaceRecords} from '@/lib/workspace-state';
import {reviewWindow} from '@/lib/review-window';
import {handleTeamCanvas} from '@/lib/team-canvas';
import {projectMilestones,isProjectMilestone} from '@/lib/project-milestones';
import {handleTrekCloud} from '@/lib/trek-cloud-server';
import {backupCourse,handleBackup} from '@/lib/object-backup';
import {beginActivity,finishActivity} from '@/lib/activity-log';
import {handleVpa,vpaTransfer} from '@/lib/vpa-server';
import {scheduledReviewTick,handleReviewRounds,handleReviewFile,reviewMaterials} from '@/lib/review-engine';
export const dynamic = "force-dynamic";
const reply = (
  data: unknown,
  status = 200,
  headers: Record<string, string> = {},
) =>
  Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });
const dimensions = ["share", "reliable", "quality", "field", "collab"];
async function handle(req: Request) {
  try {
    const path = new URL(req.url).pathname.replace(/^\/api\//, "");
    const method = req.method;
    if(path==='review-tick')return await scheduledReviewTick(req);
    if (method !== "GET") protectMutation(req);
    if(path==='test-access'&&method==='POST'){const {testAccess}=await import('@/lib/test-access');return await testAccess(req);}
    if (path === "health") return reply({ ok: true });
    if (path === 'vpa-transfer') return await vpaTransfer(req);
    if (path === "login" && method === "POST") {
      const b: any = await req.json();
      const uni = string(b.uni, 80).toLowerCase();
      const password = string(b.password, 256);
      await rateLimit("login:" + (await hash(uni)));
      await rateLimit(
        "ip:" + (await hash(req.headers.get("cf-connecting-ip") || "local")),
        100,
      );
      let u = await one<User>("SELECT * FROM users WHERE uni=?", uni);
      if (
        !u &&
        uni === "owner01" &&
        runtime().ADMIN_INITIAL_PASSWORD &&
        (await hash(password)) ===
          (await hash(runtime().ADMIN_INITIAL_PASSWORD!))
      ) {
        await run(
          "INSERT OR IGNORE INTO users(id,uni,name,role,course,password,must_change,disabled) VALUES(?,?,?,?,?,?,0,0)",
          "staff-jack",
          "owner01",
          "Course Owner",
          "staff",
          "live",
          await passwordHash(password),
        );
        u = await one<User>("SELECT * FROM users WHERE uni=?", uni);
      }
      check(
        u && ['live','sandbox','demo'].includes(u.course) && !u.disabled && (await verify(password, u.password)),
        "UNI or password is incorrect.",
        401,
      );
      await run(
        "DELETE FROM attempts WHERE key=?",
        "login:" + (await hash(uni)),
      );
      await audit(u.id, "login");
      return reply({ user: safeUser(u) }, 200, {
        "Set-Cookie": await session(req, u),
      });
    }
    const u = await identity(req);
    if(path==='bootstrap'&&(!u||u.must_change))return reply({user:u?safeUser(u):null});
    if (path === "me")
      return reply({ user: u ? safeUser(u) : null, impersonating: !!u?.actor });
    check(u, "Please sign in.", 401);
    if(u.actor&&u.course==='live'&&method!=='GET')check(['return-staff','logout'].includes(path),'Student view is read-only. Return to the teaching console to make changes.',403);
    if (path === "logout" && method === "POST") {
      await run("DELETE FROM sessions WHERE id=?", await hash(cookie(req)));
      return reply({ ok: true }, 200, {
        "Set-Cookie":
          "urp_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0",
      });
    }
    if (path === "password" && method === "POST") {
      const b: any = await req.json();
      check(
        await verify(string(b.current, 256), u.password),
        "Current password is incorrect.",
        403,
      );
      const p = string(b.password, 256);
      check(p.length >= 12, "Use at least 12 characters.");
      await run(
        "UPDATE users SET password=?,must_change=0 WHERE id=?",
        await passwordHash(p),
        u.id,
      );
      await run("DELETE FROM sessions WHERE user_id=?", u.id);
      await audit(u.id, "password-change");
      return reply({ ok: true }, 200, { "Set-Cookie": await session(req, u) });
    }
    check(!u.must_change, "Please change your temporary password first.", 403);
    const staff = u.role === "staff";
    const url = new URL(req.url);
    const sandbox = u.course === "sandbox";
    const requestedCourse = path==='bootstrap'&&sandbox?'sandbox':url.searchParams.get("course");
    if (sandbox && requestedCourse) check(requestedCourse === "sandbox", "Demo accounts cannot access other courses.", 403);
    const course = sandbox ? "sandbox" : staff ? requestedCourse || "live" : u.course;
    check(course!=='archive'&&!['archive-file','extraction-check','import-archive','import-asset'].includes(path),'Historical archive is offline; contact the course owner for an authorized recovery.',410);
    check(["demo", "live", "archive", "sandbox"].includes(course), "Unknown course.");
    if(course==='demo')check(!(await getRecord('fa2026-launch-transition','meta','live')),'The old demonstration course has been retired.',410);
    if(path.startsWith('trek/'))return await handleTrekCloud(req,u,course,path);
    if(path==='personal-canvas'&&method==='POST'){
      const {refreshPersonalCanvas}=await import('@/lib/personal-canvas');let student:User=u;
      if(staff){check(u.uni==='owner01'&&!u.actor,'Owner only.',403);const b:any=await req.json();const target=await one<User>("SELECT * FROM users WHERE id=? AND course='live' AND role='student'",string(b.id,200));check(target,'Student not found.',404);student=target;}
      return reply(await refreshPersonalCanvas(student));
    }
    if(path==='classroom-demo'&&method==='POST'){const {classroomDemo}=await import('@/lib/classroom-demo');return reply(await classroomDemo(req,u));}
    if(path==='team-canvas')return await handleTeamCanvas(req,u,course);
    if(path==='backup')return await handleBackup(req,u,course);
    if(path==='activity-event'&&method==='POST'){
      const b:any=await req.json();check(['sessions','treks','vpa','reviews','feedback','team','home','assessment','account'].includes(b.section),'Unknown view.');
      await audit(u.id,'view-section',b.section);return reply({ok:true});
    }
    if(path==='assessment-draft'){const {assessmentDraft}=await import('@/lib/assessment-draft');return await assessmentDraft(req,u);}
    if(path==='activity'&&method==='GET'){
      check(staff,'Staff only.',403);
      const events=await all("SELECT * FROM audit WHERE actor IN (SELECT id FROM users WHERE course=?) ORDER BY at DESC LIMIT 500",course);
      return reply({events});
    }
    if(path==='review-rounds')return await handleReviewRounds(req,u,course);
    if(path==='review-file'&&method==='GET')return await handleReviewFile(req,u,course);
    if(path==='vpa'||path.startsWith('vpa/')) return await handleVpa(req,u,course,path);
    if(path==='canvas-test'){
      const {handleCanvasTest}=await import('@/lib/canvas-test');
      return await handleCanvasTest(req,u);
    }
    // Scope enforcement is server-side, including privileged endpoints which
    // otherwise operate on fixed datasets rather than the selected course.
    if (sandbox) check(!["import-live", "import-archive", "import-asset", "archive-file", "seed-demo", "prepare-historical-demo", "account", "reset-password", "sourcefile-extract", "analyze", "canvas-sync", "canvas-submissions", "extract-submission", "canvas-diagnostic"].includes(path), "This operation is unavailable in the demo.", 403);
    if ((path === "state"||path==='bootstrap') && method === "GET") {
      const prefetched=await workspaceRecords(u,course);
      const records=async(kind:string,_course:string)=>prefetched[kind]||[];
      const kinds = [
        "assignment",
        "event",
        "round",
        "milestone",
        "group",
        "meta",
      ];
      const base: Record<string, unknown> = {};
      base.teamStorage=await teamStorage(course,u.group_id);
      for (const k of kinds) base[k] = await records(k, course);
      base.milestone = projectMilestones(base.milestone as any[],base.event as any[]);
      base.group = (base.group as any[]).filter(g=>!g.retiredFromCanvas);
      if (staff) {
        for (const k of [
          "allocation",
          "review",
          "submission",
          "submission-status",
          "assessment",
          "file",
          "attendance",
          "booking",
          "insight",
          "sourcefile",
          "extraction",
          "participation-credit",
        ])
          base[k] = await records(k, course);
        base.people = (
          await all<User>(
            "SELECT * FROM users WHERE course=? ORDER BY name",
            course,
          )
        ).map(safeUser);
        if(course==='live'){
          const roster=(base.meta as any[]).find(m=>m.id==='live-roster');
          if(Array.isArray(roster?.currentStudentIds))base.people=(base.people as any[]).filter(p=>p.role!=='student'||roster.currentStudentIds.includes(p.id));
        }
        base.integrations = {
          canvas: !sandbox && !!(runtime().CANVAS_TOKEN || runtime().CANVAS_RELAY_KEY),
          ai: !sandbox && !!runtime().OPENROUTER_API_KEY,
          canvasSubmit: !sandbox && runtime().VPA_CANVAS_SUBMIT_ENABLED === 'true',
        };
      } else {
        base.assignment = (base.assignment as any[]).filter((a) => a.published !== false && !a.retiredFromCanvas);
        // Internal roster IDs and release checks belong only to the teaching console.
        base.meta = (base.meta as any[]).filter(m=>m.id!=='live-roster'&&!m.id.startsWith('review-engine:'));
        const visibleAssignments = new Set((base.assignment as any[]).map(a => a.id));
        base.event = (base.event as any[]).map(e => ({...e, assignmentIds: (e.assignmentIds || []).filter((id:string) => visibleAssignments.has(id))}));
        base.people = u.group_id
          ? (
              await all<User>(
                "SELECT * FROM users WHERE course=? AND group_id=? ORDER BY name",
                course,
                u.group_id,
              )
            ).map(safeUser)
          : [safeUser(u)];
        for (const k of [
          "allocation",
          "review",
          "assessment",
          "attendance",
          "submission",
          "submission-status",
          "participation-credit",
        ])
          base[k] = prefetched[k]||[];
        for (const k of ["file", "booking"])
          base[k] = u.group_id ? prefetched[k]||[] : [];
        const allAllocations = base.allocation as any[];
        const assignments=base.assignment as any[];
        const reviewed=new Set((base.review as any[]).map(r=>r.parent));
        const allocations=allAllocations.map(a=>({...a,...reviewWindow(a,assignments.find(x=>x.id===a.assignment))})).filter(a=>reviewed.has(a.id)||a.open);
        base.allocation=allocations;
        const myReviews = base.review as any[];
        const complete = allocations.every((a) =>
          myReviews.some((r) => r.parent === a.id) || !a.open,
        );
        base.feedbackLocked = !complete;
        const blockedAssignments=new Set(allocations.filter(a=>a.open&&!reviewed.has(a.id)).map(a=>a.assignment));
        base.feedback = (
              await all<RecordRow>(
                "SELECT r.* FROM records r JOIN records a ON r.parent=a.id JOIN records s ON a.parent=s.id WHERE r.kind='review' AND s.kind IN ('submission','review-submission') AND s.owner=? AND r.course=? AND s.course=r.course AND a.course=r.course",
                u.id,
                course,
              )
            ).filter(r=>!blockedAssignments.has(JSON.parse(r.data).assignment)).map((r) => {
              const x = unpack(r);
              return {
                id: x.id,
                scores: x.scores,
                comments: x.comments,
                comment: x.comment,
                total: x.total,
                assignment: x.assignment,
                updated: x.updated,
              };
            })
          ;
        base.insight = (await records("insight", course))
          .filter((i) => i.released === true)
          .flatMap((i) =>
            (i.singletons || [])
              .filter((s: any) => s.studentId === u.id)
              .map((s: any) => ({ insight: s.insight, evidence: s.evidence })),
          );
      }
      return reply({
        ...base,
        user: safeUser(u),
        course,
        impersonating: !!u.actor,
      });
    }
    if (path === "review" && method === "GET") {
      const a = await getRecord(
        url.searchParams.get("id") || "",
        "allocation",
        course,
      );
      check(a && (staff || a.owner === u.id), "Review not found.", 404);
      const [submissionRow,assignment,completedRow,draft]=await Promise.all([
        one<RecordRow>("SELECT * FROM records WHERE id=? AND course=? AND kind IN ('review-submission','submission')",a.parent,course),
        getRecord(a.assignment,'assignment',course),
        one<RecordRow>("SELECT * FROM records WHERE kind='review' AND course=? AND parent=? ORDER BY updated DESC LIMIT 1",course,a.id),
        staff?Promise.resolve(null):getRecord('draft:'+a.id,'draft',course),
      ]);
      const s=submissionRow?unpack(submissionRow):null;
      check(
        staff || assignment?.published !== false,
        "Assignment not available.",
        404,
      );
      const completed=completedRow?unpack(completedRow):null;
      const window=reviewWindow(a,assignment);
      check(staff||window.open||completed,'This review invitation is no longer active.',410);
      return reply({
        allocation: {...a,...window},
        submission: { text: s?.text || "", filename: s?.filename || "",files:await reviewMaterials(course,a,s) },
        assignment: {...assignment,rubric:a.rubric||assignment?.rubric},
        readOnly: staff || !!completed || !window.open,
        draft,
        review: completed,
      });
    }
    if (path === "review" && method === "POST") {
      const b: any = await req.json();
      const a = await getRecord(string(b.id, 200), "allocation", u.course);
      check(a && a.owner === u.id, "Review not found.", 404);
      const assignment = await getRecord(a.assignment, "assignment", u.course);
      check(reviewWindow(a,assignment).open,"The one-week review window has closed or has not opened yet.",410);
      check(assignment&&assignment.published!==false&&!assignment.retiredFromCanvas,'Assignment unavailable.',404);
      if(a.rubric)assignment.rubric=a.rubric;
      const finished=(await records('review',u.course)).find(r=>r.parent===a.id);
      if(finished)return reply({ok:true,alreadyCompleted:true});
      check(assignment?.rubric?.length, "The rubric is not available.");
      let total = 0;
      const scores: Record<string, number> = {},
        comments: Record<string, string> = {};
      for (const c of assignment.rubric) {
        const n = b.scores?.[c.id];
        check(
          typeof n === "number" &&
            Number.isFinite(n) &&
            n >= 0 &&
            n <= c.points,
          "Score every criterion within its scale.",
        );
        scores[c.id] = n;
        comments[c.id] = string(b.comments?.[c.id] || "", 4000);
        check(comments[c.id].length > 0, "Add a comment for each criterion.");
        total += n;
      }
      const existingDemoReview = sandbox ? (await records("review", "sandbox")).find(r => r.parent === a.id && r.owner === u.id) : null;
      const reviewData={
          scores,
          comments,
          total,
          comment: string(b.comment || "", 8000),
          assignment: a.assignment,
          completedAt:now(),
        };
      await runtime().DB.batch([
        runtime().DB.prepare('INSERT OR IGNORE INTO records(id,kind,course,owner,parent,data,updated) VALUES(?,?,?,?,?,?,?)').bind(existingDemoReview?.id||'review:'+a.id,'review',u.course,u.id,a.id,JSON.stringify(reviewData),now()),
        runtime().DB.prepare('INSERT OR IGNORE INTO records(id,kind,course,owner,parent,data,updated) VALUES(?,?,?,?,?,?,?)').bind('participation:'+a.id,'participation-credit',u.course,u.id,a.id,JSON.stringify({assignment:a.assignment,completedAt:now(),status:'eligible',points:null,canvasGradeWritten:false}),now()),
      ]);
      await run(
        "DELETE FROM records WHERE id=? AND kind='draft' AND owner=?",
        "draft:" + a.id,
        u.id,
      );
      await audit(u.actor || u.id, "review-save", a.id);
      return reply({ ok: true });
    }
    if (path === "review-draft" && method === "POST") {
      const b: any = await req.json(),
        a = await getRecord(string(b.id, 200), "allocation", u.course);
      check(a && a.owner === u.id, "Review not found.", 404);
      const assignment = await getRecord(a.assignment, "assignment", u.course),
        scores: Record<string, number> = {},
        comments: Record<string, string> = {};
      check(reviewWindow(a,assignment).open,"The one-week review window has closed or has not opened yet.",410);
      check(!(await records('review',u.course)).some(r=>r.parent===a.id),'This review has already been submitted.',409);
      if(a.rubric&&assignment)assignment.rubric=a.rubric;
      for (const c of assignment?.rubric || []) {
        const n = b.scores?.[c.id];
        if (n !== undefined) {
          check(
            typeof n === "number" &&
              Number.isFinite(n) &&
              n >= 0 &&
              n <= c.points,
            "Invalid score.",
          );
          scores[c.id] = n;
        }
        comments[c.id] = string(b.comments?.[c.id] || "", 4000);
      }
      const id='draft:'+a.id,old=await getRecord(id,'draft',u.course),version=b.revision??old?.revision??0;
      check(Number.isSafeInteger(version)&&version>=0,'Invalid revision.');
      const data={scores,comments,comment:string(b.comment||'',8000),revision:version+1};
      const result=!old?await run('INSERT OR IGNORE INTO records(id,kind,course,owner,parent,data,updated) VALUES(?,?,?,?,?,?,?)',id,'draft',u.course,u.id,a.id,JSON.stringify(data),now()):await run("UPDATE records SET data=?,updated=? WHERE id=? AND course=? AND owner=? AND COALESCE(json_extract(data,'$.revision'),0)=?",JSON.stringify(data),now(),id,u.course,u.id,version);
      check(result.meta.changes===1,'This draft changed on another device. Keep your text and reload before saving.',409);
      return reply({ok:true,revision:data.revision});
    }
    if (path === "assessment" && method === "POST") {
      const b: any = await req.json();
      const r = await getRecord(string(b.round, 200), "round", u.course);
      check(
        r && r.open && (!r.closes || Date.parse(r.closes) > Date.now()),
        "This assessment round is closed.",
        403,
      );
      const target = await one<User>(
        "SELECT * FROM users WHERE id=? AND course=? AND group_id=?",
        string(b.target, 100),
        u.course,
        u.group_id || "",
      );
      check(target && u.group_id, "Teammate not found.", 404);
      const scores: Record<string, number> = {};
      for (const d of dimensions) {
        check(
          Number.isInteger(b.scores?.[d]) &&
            b.scores[d] >= 1 &&
            b.scores[d] <= 5,
          "Rate every dimension from 1 to 5.",
        );
        scores[d] = b.scores[d];
      }
      const well = string(b.well || "", 4000),
        improve = string(b.improve || "", 4000);
      check(well && improve, "Please complete both comments.");
      await save(
        "assessment",
        u.course,
        `assessment:${r.id}:${u.id}:${target.id}`,
        {
          target: target.id,
          scores,
          well,
          improve,
          privateNote: string(b.privateNote || "", 4000),
          round: r.id,
        },
        u.id,
        u.group_id,
        r.id,
      );
      await audit(u.actor || u.id, "assessment-save", r.id);
      return reply({ ok: true });
    }
    if (path === "upload" && method === "POST") {
      check(u.group_id, "Join a project team before uploading.");
      const raw =
        req.headers.get("content-type") === "application/octet-stream";
      const f = raw ? null : await req.formData();
      const file = raw
        ? {
            name: decodeURIComponent(req.headers.get("x-file-name") || ""),
            size: Number(req.headers.get("content-length") || 0),
            stream: () => req.body,
          }
        : f?.get("file");
      check(
        file &&
          typeof file === "object" &&
          "name" in file &&
          file.size > 0 &&
          file.size <= 40 * 1024 * 1024,
        "Choose a file between 1 byte and 40 MB.",
      );
      const filename = file.name.replace(/[\x00-\x1f"\\/]/g, "_").slice(0, 160);
      check(
        /\.(pdf|pptx|docx|xlsx|csv|txt|png|jpe?g|webp)$/i.test(filename),
        "Supported files: PDF, Office documents, text and images.",
      );
      const milestone = String(
        raw ? req.headers.get("x-milestone") || "" : f?.get("milestone") || "",
      );
      if (milestone)
        check(
          isProjectMilestone(milestone) || await getRecord(milestone, "milestone", u.course),
          "Milestone not found.",
        );
      const id = uid(),
        key = `${u.course}/${u.group_id}/${id}`;
      await reserveTeamUpload(u,id,file.size);
      try {
        let seen=0;const guard=new TransformStream<Uint8Array,Uint8Array>({transform(chunk,c){seen+=chunk.length;if(seen>file.size)throw Error('File size mismatch');c.enqueue(chunk);},flush(){if(seen!==file.size)throw Error('Incomplete file');}});
        const body=file.stream();check(body,'Missing file.');
        const fixed=new FixedLengthStream(file.size);
        const [,object]=await Promise.all([body.pipeThrough(guard).pipeTo(fixed.writable),runtime().BUCKET.put(key,fixed.readable,{httpMetadata:{contentType:'application/octet-stream'}})]);
        check(object&&object.size===file.size,'Upload length does not match the file.',400);
        await run("UPDATE records SET kind='file',data=?,updated=? WHERE id=? AND kind='file-reservation' AND owner=?",JSON.stringify({key,filename,size:file.size,uploader:u.name}),now(),id,u.id);
      } catch (e) {
        await runtime().BUCKET.delete(key);
        await run("DELETE FROM records WHERE id=? AND kind='file-reservation' AND owner=?",id,u.id);
        throw e;
      }
      await audit(u.actor || u.id, "upload", id);
      return reply({ ok: true, id });
    }
    if (path === "file" && method === "GET") {
      const f = await getRecord(
        url.searchParams.get("id") || "",
        "file",
        course,
      );
      check(
        f && (staff || (f.group_id === u.group_id && !!u.group_id)),
        "File not found.",
        404,
      );
      const obj = await runtime().BUCKET.get(f.key);
      check(obj, "File unavailable.", 404);
      return new Response(obj.body, {
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(f.filename)}`,
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    if (path === "booking" && method === "POST") {
      check(u.group_id, "Join a project team first.");
      const b: any = await req.json();
      const contact = string(b.contact, 200),
        time = string(b.time, 80);
      check(
        contact && Number.isFinite(Date.parse(time)),
        "Provide a contact and meeting date.",
      );
      await save(
        "booking",
        u.course,
        "booking:" + u.group_id,
        { contact, time, note: string(b.note || "", 2000), updatedBy: u.name },
        u.id,
        u.group_id,
      );
      await audit(u.actor || u.id, "booking-save", u.group_id);
      return reply({ ok: true });
    }
    if (path === "return-staff" && method === "POST") {
      check(u.actor, "No staff session.", 403);
      const actor = await one<User>(
        "SELECT * FROM users WHERE id=? AND role=? AND disabled=0",
        u.actor,
        "staff",
      );
      check(actor, "Staff account unavailable.", 403);
      await run("DELETE FROM sessions WHERE id=?", await hash(cookie(req)));
      return reply({ ok: true }, 200, {
        "Set-Cookie": await session(req, actor),
      });
    }
    check(staff, "Staff access required.", 403);
    if(path==='teaching-dashboard'){
      const {teachingDashboard}=await import('@/lib/teaching-dashboard');
      return reply(await teachingDashboard(req,u,course));
    }
    if(path==='launch-transition'&&method==='POST'){
      const {launchTransition}=await import('@/lib/launch-transition');
      return reply(await launchTransition(u,await req.json()));
    }
    if(['seed-demo','prepare-historical-demo','import-snapshot'].includes(path))check(!(await getRecord('fa2026-launch-transition','meta','live')),'Historical demo creation is retired.',410);
    if (sandbox) check(["sourcefile", "group", "membership", "calendar", "session-content", "export", "insight-release", "impersonate", "round", "attendance", "allocate"].includes(path), "This staff operation is unavailable in the demo.", 403);
    if (path === 'prepare-term' && method === 'POST') {
      check(course==='live','Select Fall 2026.',400);
      const {prepareTerm}=await import('@/lib/term-staging');
      const result=await prepareTerm();
      await audit(u.id,'prepare-term',course);
      return reply(result);
    }
    if (path === "session-content" && method === "POST") {
      const { saveSessionContent } = await import("@/lib/session-content");
      return reply(await saveSessionContent(course, await req.json()));
    }
    if (path === "prepare-historical-demo" && method === "POST") {
      const { prepareHistoricalDemo } = await import("@/lib/historical-demo");
      return reply(await prepareHistoricalDemo(await req.json()));
    }
    if (path === "extraction-check" && method === "POST") {
      const b: any = await req.json(),
        f = await getRecord(string(b.id, 200), "sourcefile", "archive");
      check(f, "Source file not found.", 404);
      check(
        f.size <= 12 * 1024 * 1024,
        "Automatic extraction supports files up to 12 MB.",
      );
      const obj = await runtime().BUCKET.get(f.key);
      check(obj, "Source file unavailable.", 404);
      const { extractDocument } = await import("@/lib/extract");
      const result = await extractDocument(await obj.arrayBuffer(), f.filename);
      return reply({
        ok: true,
        status: result.extractionStatus,
        characters: result.text.length,
      });
    }
    if (path === "import-snapshot" && method === "POST") {
      const b: any = await req.json();
      check(
        Array.isArray(b.records) && b.records.length <= 50,
        "Import at most 50 records.",
      );
      for (const r of b.records) {
        check(
          [
            "group",
            "assignment",
            "event",
            "milestone",
            "round",
            "context",
          ].includes(r.kind) &&
            typeof r.id === "string" &&
            (r.id.startsWith("canvas-") || r.id.startsWith("live-")),
          "Invalid snapshot record.",
        );
        check(JSON.stringify(r.data).length < 200000, "Record too large.");
        const existing = await getRecord(r.id, r.kind, "live");
        if (!existing)
          await save(r.kind, "live", r.id, { ...r.data, snapshot: true });
        else if (r.kind === "assignment" && r.data.assignmentType)
          await save(r.kind, "live", r.id, {
            ...existing,
            assignmentType: r.data.assignmentType,
          });
      }
      if (b.people) {
        check(
          Array.isArray(b.people) && b.people.length <= 50,
          "Invalid roster.",
        );
        const locked = await passwordHash(uid() + uid());
        for (const p of b.people) {
          check(/^canvas-\d+$/.test(p.id), "Invalid student ID.");
          await run(
            "INSERT OR IGNORE INTO users(id,uni,name,role,course,group_id,password,must_change,disabled,canvas_id,email) VALUES(?,?,?,?,?,?,?,1,1,?,?)",
            p.id,
            string(p.uni, 80).toLowerCase(),
            string(p.name, 200),
            "student",
            "live",
            p.group_id || null,
            locked,
            p.canvas_id,
            p.email || null,
          );
        }
      }
      await save("meta", "live", "live-source", {
        note: "Imported from the existing local app. Not a current Canvas sync; verify roster before enabling accounts.",
      });
      await audit(u.id, "snapshot-import");
      return reply({ ok: true });
    }
    if (path === "import-file" && method === "POST") {
      const meta = JSON.parse(req.headers.get("x-archive-metadata") || "{}");
      const f = new Map(Object.entries(meta));
      const file = {
        name: String(meta.filename || "document"),
        size: Number(req.headers.get("content-length") || 0),
        stream: () => req.body,
      };
      const id = String(f.get("id") || ""),
        group = String(f.get("group") || ""),
        submission = String(f.get("submission") || "");
      check(
        id.startsWith("archive-") &&
          !!req.body &&
          file.size > 0 &&
          file.size <= 60 * 1024 * 1024,
        "Invalid archive file.",
      );
      if (group)
        check(
          await getRecord(group, "group", "archive"),
          "Unknown archive group.",
        );
      if (submission)
        check(
          await getRecord(submission, "submission", "archive"),
          "Unknown archive submission.",
        );
      check(group || submission, "File needs a group or submission.");
      const kind = submission ? "sourcefile" : "file";
      if (await getRecord(id, kind, "archive"))
        return reply({ ok: true, exists: true });
      const key = "archive/files/" + id;
      await runtime().BUCKET.put(key, file.stream(), {
        httpMetadata: { contentType: "application/octet-stream" },
      });
      await save(
        kind,
        "archive",
        id,
        {
          key,
          filename: file.name,
          size: file.size,
          uploader: String(f.get("uploader") || ""),
          uploadedAt: String(f.get("date") || ""),
          milestone: String(f.get("milestone") || ""),
          simulation: !submission,
        },
        null,
        group || null,
        submission || null,
      );
      return reply({ ok: true });
    }
    if (path === "sourcefile" && method === "GET") {
      const f = await getRecord(
        url.searchParams.get("id") || "",
        "sourcefile",
        course,
      );
      check(f, "File not found.", 404);
      const obj = await runtime().BUCKET.get(f.key);
      check(obj, "File unavailable.", 404);
      return new Response(obj.body, {
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Disposition":
            "attachment; filename*=UTF-8''" + encodeURIComponent(f.filename),
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    if (path === "canvas-submissions" && method === "POST") {
      check(course === "live", "Select the live course.");
      const b: any = await req.json();
      const { syncSubmissions } = await import("@/lib/integrations");
      const result = await syncSubmissions(string(b.id, 100));
      await audit(u.id, "canvas-submissions", b.id);
      return reply(result);
    }
    if (path === "extract" && method === "POST") {
      check(course === "live", "Select the live course.");
      const b: any = await req.json();
      const { extractSubmission } = await import("@/lib/integrations");
      return reply(await extractSubmission(string(b.id, 100)));
    }
    if (path === "group" && method === "POST") {
      const b: any = await req.json(),
        id = b.id ? string(b.id, 100) : course + "-group-" + uid(),
        name = string(b.name, 200);
      check(name, "Name is required.");
      if (b.id)
        check(await getRecord(id, "group", course), "Group not found.", 404);
      await save("group", course, id, { name, max: 6 });
      await audit(u.id, "group-save", id);
      return reply({ ok: true, id });
    }
    if (path === "membership" && method === "POST") {
      const b: any = await req.json(),
        id = string(b.id, 100),
        group = string(b.group || "", 100) || null;
      check(
        await one(
          "SELECT id FROM users WHERE id=? AND course=? AND role='student'",
          id,
          course,
        ),
        "Student not found.",
        404,
      );
      if (group) {
        check(await getRecord(group, "group", course), "Group not found.");
        check(
          (
            await all(
              "SELECT id FROM users WHERE group_id=? AND id<>? AND role='student'",
              group,
              id,
            )
          ).length < 6,
          "A team can have at most six students.",
        );
      }
      await run("UPDATE users SET group_id=? WHERE id=?", group, id);
      await audit(u.id, "membership-save", id);
      return reply({ ok: true });
    }
    if (path === "calendar" && method === "POST") {
      const b: any = await req.json(),
        kind = string(b.kind, 20);
      check(["event", "milestone"].includes(kind), "Invalid calendar type.");
      const id = b.id ? string(b.id, 100) : course + "-" + kind + "-" + uid();
      const previous = b.id ? await getRecord(id, kind, course) : null;
      if (b.id) check(previous, "Item not found.", 404);
      const title = string(b.title, 200),
        time = string(b.time, 80);
      check(
        title && Number.isFinite(Date.parse(time)),
        "Provide a title and valid date.",
      );
      await save(
        kind,
        course,
        id,
        kind === "event"
          ? { ...previous, title, date: time, location: string(b.detail || "", 300) }
          : { ...previous, title, due: time, detail: string(b.detail || "", 2000) },
      );
      await audit(u.id, "calendar-save", id);
      return reply({ ok: true });
    }
    if (path === "export" && method === "GET") {
      const kinds = [
        "group",
        "assignment",
        "allocation",
        "review",
        "assessment",
        "event",
        "attendance",
        "milestone",
        "file",
        "booking",
        "insight",
      ];
      const data: Record<string, unknown> = { course, exportedAt: now() };
      for (const k of kinds) data[k] = await records(k, course);
      data.people = (
        await all<User>("SELECT * FROM users WHERE course=?", course)
      ).map(safeUser);
      await audit(u.id, "data-export", course);
      return new Response(JSON.stringify(data, null, 2), {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition":
            'attachment; filename="urp-' + course + '-export.json"',
          "Cache-Control": "no-store",
        },
      });
    }
    if (path === "insight-release" && method === "POST") {
      const b: any = await req.json(),
        r = await getRecord(string(b.id, 200), "insight", course);
      check(r, "Report not found.", 404);
      check(typeof b.released === "boolean", "Invalid release state.");
      await save("insight", course, r.id, { ...r, released: b.released });
      await audit(u.id, "insight-release", r.id);
      return reply({ ok: true });
    }
    if (path === "import-archive" && method === "POST") {
      const b: any = await req.json();
      check(
        Array.isArray(b.records) && b.records.length <= 50,
        "Import at most 50 records per batch.",
      );
      const allowed = [
        "group",
        "assignment",
        "submission",
        "allocation",
        "review",
        "round",
        "assessment",
        "milestone",
        "booking",
        "event",
        "attendance",
        "insight",
        "context",
        "extraction",
      ];
      for (const r of b.records) {
        check(
          allowed.includes(r.kind) &&
            typeof r.id === "string" &&
            r.id.startsWith("archive-"),
          "Invalid archive record.",
        );
        check(JSON.stringify(r.data).length < 200000, "Record too large.");
      }
      for (const r of b.records)
        await save(
          r.kind,
          "archive",
          r.id,
          r.data,
          r.owner || null,
          r.group_id || null,
          r.parent || null,
        );
      if (b.people) {
        check(
          Array.isArray(b.people) && b.people.length <= 50,
          "Invalid archive roster.",
        );
        const locked = await passwordHash(uid() + uid());
        for (const p of b.people) {
          check(
            typeof p.id === "string" && p.id.startsWith("archive-"),
            "Invalid archive user.",
          );
          await run(
            "INSERT OR IGNORE INTO users(id,uni,name,role,course,group_id,password,must_change,disabled) VALUES(?,?,?,?,?,?,?,1,1)",
            p.id,
            "archive-" + string(p.uni || p.id, 80),
            string(p.name, 200),
            "student",
            "archive",
            p.group_id || null,
            locked,
          );
        }
      }
      await audit(u.id, "archive-import", String(b.records.length));
      return reply({ ok: true, count: b.records.length });
    }
    if (path === "seed-demo" && method === "POST") {
      await seedDemo();
      await audit(u.id, "seed-demo");
      return reply({ ok: true });
    }
    if (path === "impersonate" && method === "POST") {
      const b: any = await req.json();
      const target = await one<User>(
        "SELECT * FROM users WHERE id=? AND course=? AND role='student'",
        string(b.id, 100),
        course,
      );
      check(target&&!target.disabled, "Student account unavailable.", 403);
      if(course==='live'){const roster=await getRecord('live-roster','meta','live');check(roster?.currentStudentIds?.includes(target.id),'Only current enrolled students can be viewed.',403);}
      await audit(u.id, course==='live'?'student-view-start':'preview-demo', target.id);
      return reply({ ok: true }, 200, {
        "Set-Cookie": await session(req, target, u.id),
      });
    }
    if (path === "account" && method === "POST") {
      const b: any = await req.json(),
        uni = string(b.uni, 80).toLowerCase(),
        name = string(b.name, 200),
        password = string(b.password, 256);
      check(
        /^[a-z][a-z0-9._-]{1,50}$/.test(uni) && name && password.length >= 12,
        "Provide a UNI, name and a password of at least 12 characters.",
      );
      check(["student", "staff"].includes(b.role), "Invalid role.");
      const group = string(b.group || "", 100) || null;
      if (group) {
        check(await getRecord(group, "group", course), "Group not found.");
        check(
          (
            await all(
              "SELECT id FROM users WHERE group_id=? AND role=?",
              group,
              "student",
            )
          ).length < 6,
          "A team can have at most six students.",
        );
      }
      const id = uid();
      await run(
        "INSERT INTO users(id,uni,name,role,course,group_id,password,must_change,disabled) VALUES(?,?,?,?,?,?,?,1,0)",
        id,
        uni,
        name,
        b.role,
        course,
        group,
        await passwordHash(password),
      );
      await audit(u.id, "account-create", id);
      return reply({ ok: true });
    }
    if (path === "reset-password" && method === "POST") {
      const b: any = await req.json(),
        id = string(b.id, 100),
        p = string(b.password, 256);
      check(p.length >= 12, "Use at least 12 characters.");
      check(
        await one("SELECT id FROM users WHERE id=? AND course=?", id, course),
        "Account not found.",
        404,
      );
      await run(
        "UPDATE users SET password=?,must_change=1,disabled=0 WHERE id=?",
        await passwordHash(p),
        id,
      );
      await run("DELETE FROM sessions WHERE user_id=?", id);
      await audit(u.id, "password-reset", id);
      return reply({ ok: true });
    }
    if (path === "round" && method === "POST") {
      const b: any = await req.json(),
        r = await getRecord(string(b.id, 100), "round", course);
      check(r, "Round not found.", 404);
      check(typeof b.open === "boolean", "Invalid state.");
      if (b.closes)
        check(Number.isFinite(Date.parse(b.closes)), "Invalid date.");
      await save("round", course, r.id, {
        title: r.title,
        open: b.open,
        closes: b.closes || null,
      });
      await audit(u.id, b.open ? "round-open" : "round-close", r.id);
      return reply({ ok: true });
    }
    if (path === "attendance" && method === "POST") {
      const b: any = await req.json(),
        e = await getRecord(string(b.event, 100), "event", course);
      check(e, "Event not found.", 404);
      check(
        Array.isArray(b.marks) && b.marks.length <= 100,
        "Invalid register.",
      );
      const people = await all<User>(
        "SELECT * FROM users WHERE course=? AND role=?",
        course,
        "student",
      );
      const ids = new Set(people.map((p) => p.id));
      for (const m of b.marks) {
        check(
          ids.has(m.id) &&
            ["present", "late", "excused", "absent", "unrecorded"].includes(
              m.status,
            ),
          "Invalid attendance mark.",
        );
      }
      await runtime().DB.batch(
        b.marks.map((m: any) =>
          runtime()
            .DB.prepare(
              "INSERT INTO records(id,kind,course,owner,parent,data,updated) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated=excluded.updated",
            )
            .bind(
              `attendance:${e.id}:${m.id}`,
              "attendance",
              course,
              m.id,
              e.id,
              JSON.stringify({ status: m.status, markedBy: u.name }),
              now(),
            ),
        ),
      );
      await audit(u.id, "attendance-save", e.id);
      return reply({ ok: true });
    }
    if (path === "allocate" && method === "POST") {
      check(course!=='live','Use deadline rounds. Live invitations are not released.',403);
      const b: any = await req.json(),
        a = await getRecord(string(b.id, 100), "assignment", course);
      check(a, "Assignment not found.", 404);
      check(
        a.assignmentType === "vpa",
        "Only participation / trek assignments use this allocation workflow.",
      );
      const { allocateAssignment } = await import("@/lib/allocator");
      const result = await allocateAssignment(course, a.id);
      await audit(u.id, "allocate", a.id);
      return reply(result);
    }
    if (path === "canvas-diagnostic" && method === "GET") {
      check(course === "live", "Canvas diagnostic requires the live course.");
      if (url.searchParams.get("mode") === "network") {
        const { probeCanvasNetwork } = await import("@/lib/canvas-network-probe");
        check(runtime().CANVAS_TOKEN, "Canvas is not configured.");
        return reply(await probeCanvasNetwork(runtime().CANVAS_TOKEN!));
      }
      const { diagnoseCanvas } = await import("@/lib/integrations");
      return reply(await diagnoseCanvas());
    }
    if (path === "canvas-sync" && method === "POST") {
      check(
        course === "live",
        "Canvas sync is only available in the live course.",
      );
      const { syncCanvas } = await import("@/lib/integrations");
      const result = await syncCanvas();
      await audit(u.id, "canvas-sync");
      return reply(result);
    }
    if (path === "ai" && method === "POST") {
      const b: any = await req.json();
      const { analyzeStep } = await import("@/lib/ai");
      const result = await analyzeStep(course, string(b.id, 100));
      await audit(u.id, "ai-analyze", b.id);
      return reply(result);
    }
    fail("Not found.", 404);
  } catch (e) {
    const error = e as Error & { status?: number };
    if (!error.status) console.error("URP request failed", error.message);
    return reply(
      {
        error: error.status
          ? error.message
          : "Something went wrong. Your saved work is safe; please try again.",
      },
      error.status || 500,
    );
  }
}
export async function GET(req:Request){
 const response=await handle(req);
 if(/^\/api\/(bootstrap|me|state|review|vpa)$/.test(new URL(req.url).pathname)){
  // Platform-supported after()/waitUntil: only read logs leave the response path.
  // Save/submit/upload logging and backups below remain awaited.
  after(async()=>{
   let entry;try{entry=await beginActivity(req);}catch{try{entry=await beginActivity(req);}catch{console.error('Read activity request backup failed after retry');return;}}
   try{await finishActivity(entry,new Response(null,{status:response.status}));}catch{try{await finishActivity(entry,new Response(null,{status:response.status}));}catch{console.error('Read activity result backup failed after retry');}}
  });
  return response;
 }
 // Log authenticated reads/downloads without exposing file URLs or authentication.
 try{await finishActivity(await beginActivity(req),response);}catch{console.error('Read activity log failed');response.headers.set('X-Audit-Status','failed');}
 return response;
}
export async function POST(req:Request){
 let activity;
 try{activity=await beginActivity(req);}catch{return reply({error:'Server activity backup is unavailable. Nothing was submitted; please retry.'},503);}
 const response=await handle(req);
 const path=new URL(req.url).pathname;
 // Snapshot successful data mutations, including SQL writes outside save().
 // Notes have their own write-ahead R2 snapshots; account secrets are excluded.
 if(response.ok&&!/\/(login|logout|password|impersonate|backup|activity-event|trek\/notes)$/.test(path)){
  try{const user=await identity(req);if(user){const course=user.course==='sandbox'?'sandbox':user.role==='staff'?new URL(req.url).searchParams.get('course')||'live':user.course;await backupCourse(course);response.headers.set('X-Backup-Status','saved');}}
  catch{response.headers.set('X-Backup-Status','failed');console.error('Course object backup failed after mutation',path);}
 }
 try{await finishActivity(activity,response);}catch{response.headers.set('X-Audit-Status','failed');console.error('Activity result log failed');}
 return response;
}

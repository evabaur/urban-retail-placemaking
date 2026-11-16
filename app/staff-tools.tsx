"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
type Item = Record<string, any>;
export function TeamControls({ people, groups, busy, action }: Item) {
  const [id, setId] = useState(""),
    [group, setGroup] = useState("");
  return (
    <section className="panel">
      <h3>Manage project teams</h3>
      <form
        className="form-grid"
        onSubmit={(e) => {
          e.preventDefault();
          action(
            "group",
            { name: new FormData(e.currentTarget).get("name") },
            "Team created",
          ).catch(() => {});
        }}
      >
        <label>
          New team name
          <Input name="name" required />
        </label>
        <Button disabled={busy}>Create team</Button>
      </form>
      <form
        className="form-grid"
        onSubmit={(e) => {
          e.preventDefault();
          action("membership", { id, group }, "Team updated").catch(() => {});
        }}
      >
        <label>
          Student
          <select
            className="native-select"
            value={id}
            onChange={(e) => setId(e.target.value)}
            required
          >
            <option value="">Choose student</option>
            {people
              .filter((p: Item) => p.role === "student")
              .map((p: Item) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          Project team
          <select
            className="native-select"
            value={group}
            onChange={(e) => setGroup(e.target.value)}
          >
            <option value="">Unassigned</option>
            {groups.map((g: Item) => (
              <option key={g.id} value={g.id}>
                {g.name} ·{" "}
                {people.filter((p: Item) => p.group_id === g.id).length}/6
              </option>
            ))}
          </select>
        </label>
        <Button disabled={busy || !id}>Move student</Button>
      </form>
      <p className="muted">
        Team changes do not reshuffle existing peer-review allocations.
      </p>
    </section>
  );
}
export function CalendarManager({ events, milestones, busy, action }: Item) {
  const [kind, setKind] = useState("event");
  return (
    <>
      <section className="panel">
        <h3>Sessions, field days & team deadlines</h3>
        {[
          ...events.map((e: Item) => ({
            ...e,
            time: e.date,
            type: "Session / field day",
          })),
          ...milestones.map((m: Item) => ({
            ...m,
            time: m.due,
            type: "Team milestone",
          })),
        ]
          .sort((a, b) => String(a.time).localeCompare(String(b.time)))
          .map((r: Item) => (
            <div className="list-row" key={r.id}>
              <strong>{r.title}</strong>
              <div className="grow" />
              <span>
                {r.time
                  ? new Date(r.time).toLocaleString("en-US", {
                      timeZone: "America/New_York",
                    })
                  : "TBD"}
              </span>
              <small>{r.type}</small>
            </div>
          ))}
      </section>
      <section className="panel">
        <h3>Add to course calendar</h3>
        <form
          className="form-grid"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            action(
              "calendar",
              {
                kind,
                title: f.get("title"),
                time: new Date(String(f.get("time"))).toISOString(),
                detail: f.get("detail"),
              },
              "Calendar updated",
            ).catch(() => {});
          }}
        >
          <label>
            Type
            <select
              className="native-select"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              <option value="event">Session / field day</option>
              <option value="milestone">Team milestone</option>
            </select>
          </label>
          <label>
            Title
            <Input name="title" required />
          </label>
          <label>
            Date & time (your local time)
            <Input name="time" type="datetime-local" required />
          </label>
          <label>
            {kind === "event" ? "Location" : "Instructions"}
            <Textarea name="detail" />
          </label>
          <Button disabled={busy}>Add item</Button>
        </form>
      </section>
    </>
  );
}
export function SubmissionRegister({
  assignments,
  submissions,
  people,
  course,
  integrations,
  files = [],
  action,
}: Item) {
  const [assignment, setAssignment] = useState("all"),
    [progress, setProgress] = useState(""),
    [running, setRunning] = useState(false);
  const selected = submissions.filter(
    (s: Item) => assignment === "all" || s.parent === assignment,
  );
  async function extract() {
    setRunning(true);
    try {
      const todo = selected.filter(
        (s: Item) =>
          s.extractionStatus === "pending" || s.extractionStatus === "error",
      );
      for (let i = 0; i < todo.length; i++) {
        setProgress("Extracting " + (i + 1) + " / " + todo.length);
        await action("extract", { id: todo[i].id }, "Text extracted");
      }
      setProgress("Extraction complete. Review flagged files below.");
    } catch (e) {
      setProgress(
        "Stopped: " + (e as Error).message + ". Completed files are retained.",
      );
    } finally {
      setRunning(false);
    }
  }
  return (
    <>
      <section className="panel">
        <div className="row between">
          <h3>Student work</h3>
          <select
            className="native-select"
            value={assignment}
            onChange={(e) => setAssignment(e.target.value)}
            aria-label="Filter submissions"
          >
            <option value="all">All assignments</option>
            {assignments.map((a: Item) => (
              <option key={a.id} value={a.id}>
                {a.title}
              </option>
            ))}
          </select>
        </div>
        {course === "live" && (
          <div className="button-wrap">
            <Button
              disabled={
                running || assignment === "all" || !integrations?.canvas
              }
              onClick={() =>
                action(
                  "canvas-submissions",
                  { id: assignment },
                  "Submission metadata synced",
                ).catch(() => {})
              }
            >
              Import selected assignment
            </Button>
            <Button
              variant="outline"
              disabled={
                running ||
                !selected.some(
                  (s: Item) =>
                    s.extractionStatus === "pending" ||
                    s.extractionStatus === "error",
                )
              }
              onClick={extract}
            >
              Extract pending PDF / Word files
            </Button>
          </div>
        )}
        <p className="muted">
          {selected.length} submissions ·{" "}
          {selected.filter((s: Item) => s.text?.trim()).length} with readable
          text
        </p>
        {progress && <p role="status">{progress}</p>}
        {running && (
          <p className="muted">
            Keep this page open. Each file is saved separately; you can resume
            if interrupted.
          </p>
        )}
      </section>
      {selected.map((s: Item) => (
        <details className="panel" key={s.id}>
          <summary className="row between">
            <strong>
              {people.find((p: Item) => p.id === s.owner)?.name || "Student"}
            </strong>
            <span>
              {assignments.find((a: Item) => a.id === s.parent)?.title}
            </span>
            <span className="pill">
              {s.extractionStatus || "Archived text"}
            </span>
          </summary>
          {s.newerAttemptAvailable && (
            <p className="error">
              Canvas has a newer attempt. Existing peer reviews remain linked to
              the previously imported version.
            </p>
          )}
          <div className="button-wrap">
            {files
              .filter((f: Item) => f.parent === s.id)
              .map((f: Item) => (
                <a
                  className="download-link"
                  key={f.id}
                  href={
                    "/api/sourcefile?course=" +
                    course +
                    "&id=" +
                    encodeURIComponent(f.id)
                  }
                >
                  Download original · {f.filename}
                </a>
              ))}
          </div>
          <div className="prose-text">{s.text || "No text extracted yet."}</div>
          {s.attachments?.length > 0 && (
            <small>{s.attachments.map((f: Item) => f.name).join(" · ")}</small>
          )}
        </details>
      ))}
    </>
  );
}
export function AnalyzeButton({ assignment, course, enabled, onDone }: Item) {
  const [running, setRunning] = useState(false),
    [progress, setProgress] = useState<Item | null>(null),
    [error, setError] = useState("");
  async function start() {
    setRunning(true);
    setError("");
    try {
      for (let step = 0; step < 150; step++) {
        const response = await fetch("/api/ai?course=" + course, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: assignment.id }),
        });
        const d: any = await response.json();
        if (!response.ok) throw Error(d.error);
        setProgress(d);
        if (d.done) {
          await onDone();
          toast.success("Analysis ready");
          break;
        }
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  }
  return (
    <div className="analysis-job">
      <Button variant="outline" disabled={running || !enabled} onClick={start}>
        {running
          ? "Analyzing…"
          : progress && !progress.done
            ? "Resume analysis"
            : "Analyze / refresh"}{" "}
        · {assignment.title}
      </Button>
      {progress && (
        <>
          <Progress value={(100 * progress.completed) / progress.total} />
          <small>
            {progress.completed}/{progress.total} extractions saved ·{" "}
            {progress.done ? "Report ready" : "Synthesis follows extraction"}
          </small>
        </>
      )}
      {running && (
        <small>
          Keep this view open. Saved extraction steps are reused after an
          interruption.
        </small>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}

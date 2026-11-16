import { records, all, User, check, runtime, now, getRecord } from "./server";
import {reviewWindow} from "./review-window";
import { cycleOrder } from "./allocation-core";
export async function allocateAssignment(course: string, assignment: string) {
  const assignmentRecord=await getRecord(assignment,"assignment",course);
  const window=reviewWindow({},assignmentRecord||undefined);
  check(window.open,"Reviews can only be allocated during the week after the assignment deadline.");
  const submissions = (await records("submission", course)).filter(
    (s) => s.parent === assignment && s.text?.trim(),
  );
  const allPeople = await all<User>(
    "SELECT * FROM users WHERE course=?",
    course,
  );
  const people = allPeople.filter((p) =>
    submissions.some((s) => s.owner === p.id),
  );
  const existing = (await records("allocation", course)).filter(
    (a) => a.assignment === assignment,
  );
  const subByOwner = new Map(submissions.map((s) => [s.owner, s]));
  const ownerBySub = new Map(submissions.map((s) => [s.id, s.owner]));
  const pairs = existing.map((a) => ({
    reviewer: a.owner as string,
    reviewee: ownerBySub.get(a.parent) as string,
  }));
  const added: typeof pairs = [];
  const same = (a: string, b: string) => {
    const x = people.find((p) => p.id === a),
      y = people.find((p) => p.id === b);
    return !!x?.group_id && x.group_id === y?.group_id;
  };
  const allowed = (a: string, b: string) =>
    a !== b &&
    !same(a, b) &&
    ![...pairs, ...added].some(
      (p) =>
        (p.reviewer === a && p.reviewee === b) ||
        (p.reviewer === b && p.reviewee === a),
    );
  if (!existing.length) {
    const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    const order = cycleOrder(people, seed);
    for (let i = 0; i < order.length; i++)
      added.push({
        reviewer: order[i].id,
        reviewee: order[(i + 1) % order.length].id,
      });
  } else {
    check(people.length >= 3, "At least three participants are required.");
    const load = (id: string, out: boolean) =>
      [...pairs, ...added].filter((p) => (out ? p.reviewer : p.reviewee) === id)
        .length;
    for (const p of people.filter((p) => load(p.id, true) === 0)) {
      const target = people
        .filter((t) => allowed(p.id, t.id))
        .sort(
          (a, b) =>
            load(a.id, false) - load(b.id, false) || a.id.localeCompare(b.id),
        )[0];
      check(target, "Late allocation needs staff review; no changes saved.");
      added.push({ reviewer: p.id, reviewee: target.id });
    }
    for (const p of people.filter((p) => load(p.id, false) === 0)) {
      const reviewer = people
        .filter((t) => allowed(t.id, p.id))
        .sort(
          (a, b) =>
            load(a.id, true) - load(b.id, true) || a.id.localeCompare(b.id),
        )[0];
      check(reviewer, "Late allocation needs staff review; no changes saved.");
      added.push({ reviewer: reviewer.id, reviewee: p.id });
    }
  }
  if (added.length)
    await runtime().DB.batch(
      added.map((p) => {
        const sub = subByOwner.get(p.reviewee)!;
        return runtime()
          .DB.prepare(
            "INSERT OR IGNORE INTO records(id,kind,course,owner,parent,data,updated) VALUES(?,?,?,?,?,?,?)",
          )
          .bind(
            `allocation:${assignment}:${p.reviewer}:${sub.id}`,
            "allocation",
            course,
            p.reviewer,
            sub.id,
            JSON.stringify({
              assignment,
              opensAt:window.opensAt,
              expiresAt:window.expiresAt,
              status: "pending",
              round: existing.length ? 2 : 1,
            }),
            now(),
          );
      }),
    );
  return { ok: true, added: added.length, existing: existing.length };
}

import { adminPassword } from "./test-credentials.mjs";
import assert from "node:assert/strict";
const origin = process.env.TEST_ORIGIN || "http://localhost:5173";
const password = adminPassword();
const privateHeaders = process.env.SITES_BYPASS_TOKEN
  ? { "OAI-Sites-Authorization": "Bearer " + process.env.SITES_BYPASS_TOKEN }
  : {};
let passed = 0;
const log = (n) => {
  passed++;
  console.log("PASS", n);
};
async function request(
  path,
  { body, cookie = "", status = 200, originHeader = origin } = {},
) {
  const r = await fetch(origin + "/api/" + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      ...privateHeaders,
      ...(body === undefined
        ? {}
        : { "Content-Type": "application/json", Origin: originHeader }),
      Cookie: cookie,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  assert.equal(r.status, status, path + ": " + text.slice(0, 300));
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return {
    data,
    cookie:
      r.headers
        .getSetCookie()
        .find((v) => v.startsWith("urp_session="))
        ?.split(";")[0] || cookie,
  };
}
await request("state", { status: 401 });
log("anonymous data blocked");
await request("login", {
  body: { uni: "owner01", password },
  originHeader: "https://wrong.invalid",
  status: 403,
});
log("cross-origin login blocked");
const staff = (await request("login", { body: { uni: "owner01", password } }))
  .cookie;
log("UNI/password login");
await request("seed-demo", { cookie: staff, body: {} });
log("persistent demo seed");
const state = (await request("state?course=demo", { cookie: staff })).data;
assert.equal(state.people.length, 9);
assert.equal(state.allocation.length, 27);
log("staff data populated");
const student = (
  await request("impersonate", { cookie: staff, body: { id: "demo-0" } })
).cookie;
const peer = (
  await request("impersonate", { cookie: staff, body: { id: "demo-3" } })
).cookie;
const outsider = (
  await request("impersonate", { cookie: staff, body: { id: "demo-1" } })
).cookie;
const personal = (await request("state", { cookie: student })).data;
assert.equal(personal.people.length, 3);
assert.equal(personal.allocation.length, 3);
assert(personal.feedbackLocked);
assert(!JSON.stringify(personal).includes("password"));
log("student scope and reciprocal feedback gate");
await request("attendance", { cookie: student, body: {}, status: 403 });
log("student cannot access staff writes");
await request(
  "review?id=" +
    encodeURIComponent(state.allocation.find((a) => a.owner === "demo-1").id),
  { cookie: student, status: 404 },
);
log("other reviewer work blocked");
const a = personal.allocation[0];
await request("review", {
  cookie: student,
  body: { id: a.id, scores: {}, comments: {} },
  status: 400,
});
log("incomplete review blocked");
await request("review", {
  cookie: student,
  body: {
    id: a.id,
    scores: { insight: 2, evidence: 3, connection: 2 },
    comments: {
      insight: "Specific interpretation",
      evidence: "Anchored in observation",
      connection: "Connect to the framework",
    },
    comment: "Useful observation",
  },
});
log("rubric review saved");
assert((await request("state", { cookie: student })).data.review.length >= 1);
log("review survives refresh");
await request("file?id=demo-welcome-file", { cookie: peer });
await request("file?id=demo-welcome-file", { cookie: outsider, status: 404 });
log("same-team download allowed; other team blocked");
const form = new FormData();
form.append(
  "file",
  new Blob(["Team meeting notes"], { type: "text/plain" }),
  "smoke.txt",
);
const up = await fetch(origin + "/api/upload", {
  method: "POST",
  headers: { ...privateHeaders, Cookie: student, Origin: origin },
  body: form,
});
assert.equal(up.status, 200);
const file = await up.json();
await request("file?id=" + file.id, { cookie: peer });
await request("file?id=" + file.id, { cookie: outsider, status: 404 });
log("R2 upload and team sharing");
const rating = {
  round: "demo-round-0",
  target: "demo-3",
  scores: { share: 3, reliable: 4, quality: 3, field: 4, collab: 4 },
  well: "Reliable observations",
  improve: "Share notes earlier",
  privateNote: "smoke-private-canary",
};
await request("round?course=demo", {
  cookie: staff,
  body: { id: "demo-round-0", open: false },
});
await request("assessment", { cookie: student, body: rating, status: 403 });
log("closed assessment cannot be submitted");
await request("round?course=demo", {
  cookie: staff,
  body: { id: "demo-round-0", open: true },
});
await request("assessment", { cookie: student, body: rating });
await request("assessment", {
  cookie: student,
  body: { ...rating, target: "demo-1" },
  status: 404,
});
log("assessment own-team only");
assert(
  !JSON.stringify((await request("state", { cookie: peer })).data).includes(
    "smoke-private-canary",
  ),
);
log("private teammate feedback not leaked");
await request("round?course=demo", {
  cookie: staff,
  body: { id: "demo-round-0", open: false },
});
await request("attendance?course=demo", {
  cookie: staff,
  body: { event: "demo-trek-0", marks: [{ id: "demo-0", status: "excused" }] },
});
assert(
  (await request("state", { cookie: student })).data.attendance.some(
    (a) => a.status === "excused",
  ),
);
log("attendance staff write and student read");
const allocated = await request("allocate?course=demo", {
  cookie: staff,
  body: { id: "demo-assignment-0" },
});
assert.equal(allocated.data.added, 0);
log("allocation rerun does not reshuffle");
await request("logout", { cookie: student, body: {} });
await request("state", { cookie: student, status: 401 });
log("logout revokes session");
console.log("ALL PASS:", passed);

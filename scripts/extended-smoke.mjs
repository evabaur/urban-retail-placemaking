import { adminPassword } from "./test-credentials.mjs";
import assert from "node:assert/strict";
const origin = process.env.TEST_ORIGIN || "http://localhost:5173",
  password = adminPassword();
const headers = process.env.SITES_BYPASS_TOKEN
  ? { "OAI-Sites-Authorization": "Bearer " + process.env.SITES_BYPASS_TOKEN }
  : {};
async function call(path, body, cookie = "", status = 200) {
  const r = await fetch(origin + "/api/" + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      ...headers,
      Origin: origin,
      Cookie: cookie,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const d = await r.json();
  assert.equal(r.status, status, path + ":" + JSON.stringify(d));
  return {
    d,
    c:
      r.headers
        .getSetCookie()
        .find((v) => v.startsWith("urp_session="))
        ?.split(";")[0] || cookie,
  };
}
const staff = (await call("login", { uni: "owner01", password })).c;
const state = (await call("state?course=demo", undefined, staff)).d;
const student = (await call("impersonate", { id: "demo-0" }, staff)).c,
  peer = (await call("impersonate", { id: "demo-3" }, staff)).c,
  other = (await call("impersonate", { id: "demo-1" }, staff)).c;
const a = state.allocation.find((x) => x.owner === "demo-0");
await call(
  "review-draft",
  {
    id: a.id,
    scores: { insight: 1 },
    comments: { insight: "A persisted draft" },
  },
  student,
);
assert.equal(
  (await call("review?id=" + encodeURIComponent(a.id), undefined, student)).d
    .draft.comments.insight,
  "A persisted draft",
);
assert.equal(
  (await call("review?id=" + encodeURIComponent(a.id), undefined, staff)).d
    .draft,
  null,
);
console.log("PASS draft persistence and privacy");
const size = 2 * 1024 * 1024 + 17,
  bytes = new Uint8Array(size);
bytes.fill(65);
const upload = await fetch(origin + "/api/upload", {
  method: "POST",
  headers: {
    ...headers,
    Origin: origin,
    Cookie: student,
    "Content-Type": "application/octet-stream",
    "X-File-Name": "large-test.txt",
  },
  body: bytes,
});
assert.equal(upload.status, 200);
const file = await upload.json();
const download = await fetch(origin + "/api/file?id=" + file.id, {
  headers: { ...headers, Cookie: peer },
});
assert.equal(download.status, 200);
assert.equal((await download.arrayBuffer()).byteLength, size);
await call("file?id=" + file.id, undefined, other, 404);
console.log("PASS >1 MB streaming upload and exact-size same-team download");
await call("logout", undefined, student, 403); // GET never mutates a session
assert((await call("me", undefined, student)).d.user);
console.log("PASS GET logout cannot revoke session");
const archive = (await call("state?course=archive", undefined, staff)).d;
assert.equal(archive.people.length, 42);
assert.equal(archive.submission.length, 107);
assert.equal(archive.insight.length, 1);
const ar = archive.allocation.find((a) =>
  archive.review.some((r) => r.parent === a.id),
);
assert(
  (
    await call(
      "review?id=" + encodeURIComponent(ar.id) + "&course=archive",
      undefined,
      staff,
    )
  ).d.review,
);
console.log("PASS archived submissions, reports and review joins");
await call("export?course=archive", undefined, student, 403);
console.log("PASS staff export restricted");
const live = (await call("state?course=live", undefined, staff)).d;
assert.equal(live.people.filter((p) => p.role === "student").length, 40);
assert(
  live.people.filter((p) => p.role === "student").every((p) => p.disabled),
);
console.log("PASS cached live roster stays disabled");
console.log("EXTENDED CHECKS PASSED");

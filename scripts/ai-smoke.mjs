// Runs only against the nine fictional demo submissions, never sends archived work.
import { adminPassword } from "./test-credentials.mjs";
import assert from "node:assert/strict";
const origin = process.env.TEST_ORIGIN || "http://localhost:5173",
  password = adminPassword(),
  h = process.env.SITES_BYPASS_TOKEN
    ? { "OAI-Sites-Authorization": "Bearer " + process.env.SITES_BYPASS_TOKEN }
    : {};
let cookie = "";
async function call(path, body) {
  const r = await fetch(origin + "/api/" + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      ...h,
      Cookie: cookie,
      Origin: origin,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(100000),
  });
  cookie =
    r.headers
      .getSetCookie()
      .find((v) => v.startsWith("urp_session="))
      ?.split(";")[0] || cookie;
  const data = await r.json();
  assert.equal(r.status, 200, JSON.stringify(data));
  return data;
}
await call("login", { uni: "owner01", password });
let done = false;
for (let step = 0; step < 12; step++) {
  const d = await call("ai?course=demo", { id: "demo-assignment-0" });
  console.log("AI checkpoint", d.completed, "/", d.total, "done:", d.done);
  if (d.done) {
    done = true;
    break;
  }
}
assert(done, "Analysis did not finish within the expected checkpoints");
const again = await call("ai?course=demo", { id: "demo-assignment-0" });
assert(again.cached, "Second run should reuse saved results");
const state = await call("state?course=demo");
assert(
  state.insight.some(
    (r) => r.assignment === "demo-assignment-0" && !r.released,
  ),
);
console.log(
  "PASS resumable two-pass AI; cached repeat and private-by-default report",
);

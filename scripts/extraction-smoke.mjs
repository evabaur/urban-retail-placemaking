import { adminPassword } from "./test-credentials.mjs";
import assert from "node:assert/strict";
const origin = process.env.TEST_ORIGIN || "http://localhost:5173",
  password = adminPassword(),
  privateHeaders = process.env.SITES_BYPASS_TOKEN
    ? { "OAI-Sites-Authorization": "Bearer " + process.env.SITES_BYPASS_TOKEN }
    : {};
let cookie = "";
async function call(path, body) {
  const r = await fetch(origin + "/api/" + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      ...privateHeaders,
      Cookie: cookie,
      Origin: origin,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  cookie =
    r.headers
      .getSetCookie()
      .find((v) => v.startsWith("urp_session="))
      ?.split(";")[0] || cookie;
  const d = await r.json();
  assert.equal(r.status, 200, JSON.stringify(d));
  return d;
}
await call("login", { uni: "owner01", password });
const state = await call("state?course=archive");
for (const ext of [".pdf", ".docx"]) {
  const f = state.sourcefile
    .filter(
      (f) => f.filename.toLowerCase().endsWith(ext) && f.size < 5 * 1024 * 1024,
    )
    .sort((a, b) => a.size - b.size)[0];
  assert(f);
  const result = await call("extraction-check", { id: f.id });
  assert(result.characters > 200);
  console.log(
    "PASS",
    ext,
    "worker extraction:",
    result.characters,
    "characters",
  );
}

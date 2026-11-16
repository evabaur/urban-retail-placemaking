// Uses only the fictional demo9 account; leaves it with an unknown random password.
import { adminPassword } from "./test-credentials.mjs";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
const origin = process.env.TEST_ORIGIN || "http://localhost:5173",
  password = adminPassword(),
  h = process.env.SITES_BYPASS_TOKEN
    ? { "OAI-Sites-Authorization": "Bearer " + process.env.SITES_BYPASS_TOKEN }
    : {};
async function call(path, body, cookie = "", status = 200) {
  const r = await fetch(origin + "/api/" + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      ...h,
      Origin: origin,
      Cookie: cookie,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await r.json();
  assert.equal(r.status, status, JSON.stringify(data));
  return {
    data,
    cookie:
      r.headers
        .getSetCookie()
        .find((v) => v.startsWith("urp_session="))
        ?.split(";")[0] || cookie,
  };
}
const staff = (await call("login", { uni: "owner01", password })).cookie;
const temporary = randomBytes(24).toString("hex"),
  permanent = randomBytes(24).toString("hex");
await call("reset-password", { id: "demo-8", password: temporary }, staff);
const first = await call("login", { uni: "demo9", password: temporary });
assert(first.data.user.must_change);
await call("state", undefined, first.cookie, 403);
console.log("PASS initial password must be changed");
const changed = await call(
  "password",
  { current: temporary, password: permanent },
  first.cookie,
);
await call("state", undefined, first.cookie, 401);
assert(
  (await call("state", undefined, changed.cookie)).data.user.must_change === 0,
);
await call("login", { uni: "demo9", password: temporary }, "", 401);
console.log(
  "PASS password change revokes old session and temporary credential",
);
await call("logout", {}, changed.cookie);
console.log(
  "PASS password-account workflow complete; demo remains previewable",
);

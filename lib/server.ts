import { env } from "cloudflare:workers";
export const runtime = () =>
  env as unknown as {
    DB: D1Database;
    BUCKET: R2Bucket;
    ADMIN_INITIAL_PASSWORD?: string;
    OPENROUTER_API_KEY?: string;
    CANVAS_TOKEN?: string;
    CANVAS_RELAY_URL?: string;
    CANVAS_RELAY_KEY?: string;
    VPA_CANVAS_SUBMIT_ENABLED?: string;
    VPA_REVIEW_LIVE_ENABLED?: string;
    AI_MODEL?: string;
  };
export type User = {
  id: string;
  uni: string;
  name: string;
  role: string;
  course: string;
  group_id: string | null;
  password: string;
  must_change: number;
  disabled: number;
  canvas_id: number | null;
  email: string | null;
};
export type RecordRow = {
  id: string;
  kind: string;
  course: string;
  owner: string | null;
  group_id: string | null;
  parent: string | null;
  data: string;
  updated: string;
};
export const uid = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
export async function all<T = Record<string, unknown>>(
  sql: string,
  ...args: unknown[]
) {
  return (
    await runtime()
      .DB.prepare(sql)
      .bind(...args)
      .all<T>()
  ).results;
}
export async function one<T = Record<string, unknown>>(
  sql: string,
  ...args: unknown[]
) {
  return runtime()
    .DB.prepare(sql)
    .bind(...args)
    .first<T>();
}
export async function run(sql: string, ...args: unknown[]) {
  return runtime()
    .DB.prepare(sql)
    .bind(...args)
    .run();
}
export const unpack = (r: RecordRow) => ({
  ...JSON.parse(r.data),
  id: r.id,
  kind: r.kind,
  course: r.course,
  owner: r.owner,
  group_id: r.group_id,
  parent: r.parent,
  updated: r.updated,
});
export async function records(kind: string, course: string) {
  return (
    await all<RecordRow>(
      "SELECT * FROM records WHERE kind=? AND course=? ORDER BY updated",
      kind,
      course,
    )
  ).map(unpack);
}
export async function getRecord(id: string, kind: string, course: string) {
  const r = await one<RecordRow>(
    "SELECT * FROM records WHERE id=? AND kind=? AND course=?",
    id,
    kind,
    course,
  );
  return r ? unpack(r) : null;
}
export async function save(
  kind: string,
  course: string,
  id: string,
  data: unknown,
  owner: string | null = null,
  group: string | null = null,
  parent: string | null = null,
) {
  await run(
    "INSERT INTO records(id,kind,course,owner,group_id,parent,data,updated) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated=excluded.updated",
    id,
    kind,
    course,
    owner,
    group,
    parent,
    JSON.stringify(data),
    now(),
  );
}
export async function audit(actor: string, action: string, target = "") {
  const event={id:uid(),actor,action,target,at:now()};
  await runtime().BUCKET.put(`audit/${event.at.slice(0,10)}/${event.id}.json`,JSON.stringify(event),{httpMetadata:{contentType:'application/json'}});
  await run(
    "INSERT INTO audit(id,actor,action,target,at) VALUES(?,?,?,?,?)",
    event.id,
    actor,
    action,
    target,
    event.at,
  );
}
export const safeUser = (u: User) => ({
  id: u.id,
  uni: u.uni,
  name: u.name,
  role: u.role,
  course: u.course,
  group_id: u.group_id,
  must_change: u.must_change,
  disabled: !!u.disabled,
});
export function fail(message: string, status = 400): never {
  throw Object.assign(new Error(message), { status });
}
export function check(ok: unknown, message: string, status = 400): asserts ok {
  if (!ok) fail(message, status);
}
export function string(v: unknown, max = 10000) {
  check(typeof v === "string" && v.length <= max, "Invalid text");
  return v.trim();
}
export async function hash(value: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
  )
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
export async function passwordHash(p: string, salt = uid()) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(p),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: new TextEncoder().encode(salt),
      iterations: 100000,
    },
    key,
    256,
  );
  return (
    salt +
    ":" +
    Array.from(new Uint8Array(bits))
      .map((x) => x.toString(16).padStart(2, "0"))
      .join("")
  );
}
export async function verify(p: string, h: string) {
  const c = await passwordHash(p, h.split(":")[0]);
  let d = c.length ^ h.length;
  for (let i = 0; i < Math.max(c.length, h.length); i++)
    d |= (c.charCodeAt(i) || 0) ^ (h.charCodeAt(i) || 0);
  return d === 0;
}
export function cookie(req: Request) {
  return (
    /(?:^|; )urp_session=([^;]+)/.exec(req.headers.get("cookie") || "")?.[1] ||
    ""
  );
}
export async function identity(req: Request) {
  const token = cookie(req);
  if (!token) return null;
  const user = await one<User & { actor: string | null }>(
    "SELECT u.*,s.actor FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id=? AND s.expires>? AND u.disabled=0",
    await hash(token),
    Date.now(),
  );
  if(user?.actor){
    const actor=await one<User>('SELECT * FROM users WHERE id=? AND role=\'staff\' AND disabled=0',user.actor);
    if(!actor||actor.course!==user.course)return null;
    // Preview must work even before the student has changed their initial password.
    return {...user,must_change:0};
  }
  return user;
}
export async function session(
  req: Request,
  u: User,
  actor: string | null = null,
) {
  const token = uid() + uid();
  await run(
    "INSERT INTO sessions(id,user_id,expires,actor) VALUES(?,?,?,?)",
    await hash(token),
    u.id,
    Date.now() + 8 * 3600000,
    actor,
  );
  return (
    "urp_session=" +
    token +
    "; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800" +
    (new URL(req.url).protocol === "https:" ? "; Secure" : "")
  );
}
export function protectMutation(req: Request) {
  check(
    req.headers.get("origin") === new URL(req.url).origin,
    "Invalid request origin",
    403,
  );
}
export async function rateLimit(key: string, limit = 10) {
  const a = await one<{ count: number; until: number }>(
    "SELECT * FROM attempts WHERE key=?",
    key,
  );
  check(
    !a || a.until < Date.now() || a.count < limit,
    "Too many attempts. Try again in 15 minutes.",
    429,
  );
  await run(
    "INSERT INTO attempts(key,count,until) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN until<? THEN 1 ELSE count+1 END,until=CASE WHEN until<? THEN excluded.until ELSE until END",
    key,
    Date.now() + 900000,
    Date.now(),
    Date.now(),
  );
}

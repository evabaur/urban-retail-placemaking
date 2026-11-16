import { canvasHeaders } from "./canvas-http";
// Fixed, read-only targets. Shared unchanged between Node and the hosted Worker.
export async function probeCanvasNetwork(token: string) {
  const results = [];
  for (const target of [
    { label: "public-home-no-token", url: "https://canvas.example.edu/", authenticated: false, accept: "*/*", identity: false },
    { label: "roster-default", url: "https://canvas.example.edu/api/v1/courses/900001/users?enrollment_type[]=student&per_page=100", authenticated: true, accept: "", identity: false },
    { label: "roster-json", url: "https://canvas.example.edu/api/v1/courses/900001/users?enrollment_type[]=student&per_page=100", authenticated: true, accept: "application/json", identity: false },
    { label: "roster-json-identity", url: "https://canvas.example.edu/api/v1/courses/900001/users?enrollment_type[]=student&per_page=100", authenticated: true, accept: "application/json", identity: true },
  ]) {
    const headers = canvasHeaders(target.authenticated ? token : undefined);
    if (target.accept) headers.Accept = target.accept;
    if (target.identity) headers["Accept-Encoding"] = "identity";
    const res = await fetch(target.url, { headers, redirect: target.authenticated ? "follow" : "manual", signal: AbortSignal.timeout(25000) });
    const reader = res.body?.getReader();
    let sample = "", bytes = 0;
    const decoder = new TextDecoder();
    try {
      if (reader) while (bytes < 32768) {
        const part = await reader.read();
        if (part.done) break;
        const kept = part.value.slice(0, 32768 - bytes);
        bytes += kept.length;
        sample += decoder.decode(kept, { stream: true });
      }
      sample += decoder.decode();
    } finally { await reader?.cancel(); }
    const clean = (text: string) => text.replaceAll(token, "[token]")
      .replace(/[\w.+-]+@[\w.-]+/g, "[email]")
      .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "[ip]")
      .replace(/\b[A-Za-z0-9_~-]{48,}\b/g, "[opaque-value]");
    const plain = sample.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    const location = res.headers.get("location");
    const destination = location ? new URL(location, target.url) : null;
    results.push({
      label: target.label, status: res.status,
      server: res.headers.get("server"), contentType: res.headers.get("content-type"),
      vary: res.headers.get("vary"), contentEncoding: res.headers.get("content-encoding"),
      ray: res.headers.get("cf-ray"), requestId: res.headers.get("x-request-id"),
      mitigation: res.headers.get("cf-mitigated"), redirected: res.redirected,
      redirectDestination: destination ? destination.origin + destination.pathname : null,
      title: clean(/<title[^>]*>([^<]*)<\/title>/i.exec(sample)?.[1] || ""),
      // Never return successful roster bodies or HTML markup; error text is untrusted.
      errorText: res.status >= 400 ? clean(plain).slice(0, 4000) : null,
      sampledBytes: bytes,
    });
  }
  return { checkedAt: new Date().toISOString(), results };
}

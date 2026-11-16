// Canvas requires an explicit application User-Agent, including in Workers.
export const CANVAS_USER_AGENT =
  "UrbanRetailPlacemaking/1.0 (+https://app.example.com)";

export function canvasHeaders(token?: string): Record<string, string> {
  return {
    "User-Agent": CANVAS_USER_AGENT,
    ...(token ? { Authorization: "Bearer " + token } : {}),
  };
}

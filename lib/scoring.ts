type Row = Record<string, any>;
const mean = (a: number[]) =>
  a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
const median = (a: number[]) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  return s.length % 2
    ? s[(s.length - 1) / 2]
    : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const value = (r: Row) =>
  mean(
    Object.values(r.scores || {}).filter(
      (n): n is number => typeof n === "number",
    ),
  );
export function scoreGroup(people: Row[], reviews: Row[]) {
  const ids = new Set(people.map((p) => p.id));
  const valid = reviews.filter((r) => ids.has(r.owner) && ids.has(r.target));
  const peer = valid.filter((r) => r.owner !== r.target);
  const raterMeans = new Map(
    people.map((p) => [
      p.id,
      mean(
        peer
          .filter((r) => r.owner === p.id)
          .map(value)
          .filter((v): v is number => v !== null),
      ),
    ]),
  );
  const grand = mean(
    [...raterMeans.values()].filter((v): v is number => v !== null),
  );
  const raw = new Map(
    people.map((p) => [
      p.id,
      mean(
        peer
          .filter((r) => r.target === p.id)
          .map(value)
          .filter((v): v is number => v !== null),
      ),
    ]),
  );
  const adj = new Map(
    people.map((p) => [
      p.id,
      mean(
        peer
          .filter((r) => r.target === p.id)
          .map((r) => {
            const v = value(r),
              rm = raterMeans.get(r.owner);
            return v !== null && rm != null && grand !== null
              ? v - rm + grand
              : null;
          })
          .filter((v): v is number => v !== null),
      ),
    ]),
  );
  const base = median([...raw.values()].filter((v): v is number => v !== null)),
    baseAdj = median([...adj.values()].filter((v): v is number => v !== null));
  return people.map((p) => {
    const avg = raw.get(p.id) ?? null,
      adjusted = adj.get(p.id) ?? null,
      self = valid.find((r) => r.owner === p.id && r.target === p.id),
      selfMean = self ? value(self) : null;
    const index = avg !== null && base ? avg / base : null,
      indexAdj = adjusted !== null && baseAdj ? adjusted / baseAdj : null,
      selfGap = selfMean !== null && avg !== null ? selfMean - avg : null;
    const flags: string[] = [];
    if (index !== null && index < 0.85) flags.push("Low relative contribution");
    if (index !== null && index > 1.1 && avg !== null && avg >= 4)
      flags.push("High contribution");
    if (selfGap !== null && selfGap >= 1) flags.push("Self-rating above peers");
    const given = raterMeans.get(p.id);
    if (given != null && grand !== null && given - grand <= -0.75)
      flags.push("Consistently low rater");
    return {
      id: p.id,
      avg,
      index,
      indexAdj,
      selfGap,
      flags,
      n: peer.filter((r) => r.target === p.id).length,
      submitted: valid.filter((r) => r.owner === p.id).length,
      expected: people.length,
    };
  });
}

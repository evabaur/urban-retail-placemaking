function check(ok: unknown, message: string): asserts ok {
  if (!ok) throw Object.assign(new Error(message), { status: 400 });
}
type Person = { id: string; group_id: string | null };
// One review per participating student per trek. A cycle of length >2 prevents
// reciprocal reviews. Group adjacency includes the wraparound edge.
export function cycleOrder(people: Person[], seed = 1) {
  check(people.length >= 3, "At least three submissions are required.");
  const random = () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const shuffled = [...people];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const groups = new Map<string, Person[]>();
  for (const p of shuffled) {
    const k = p.group_id || p.id;
    groups.set(k, [...(groups.get(k) || []), p]);
  }
  check(
    Math.max(...[...groups.values()].map((x) => x.length)) <=
      Math.floor(people.length / 2),
    "Too many submissions from one team for a valid allocation.",
  );
  const sorted = [...groups.values()].sort((a, b) => b.length - a.length);
  const slots = [...Array(people.length).keys()]
    .filter((x) => x % 2 === 0)
    .concat([...Array(people.length).keys()].filter((x) => x % 2 === 1));
  const order: Person[] = [];
  let k = 0;
  for (const g of sorted) for (const p of g) order[slots[k++]] = p;
  const bad = (a: Person[]) =>
    a.reduce(
      (n, p, i) =>
        n +
        (p.group_id && p.group_id === a[(i + 1) % a.length].group_id ? 1 : 0),
      0,
    );
  for (let round = 0; bad(order) && round < people.length; round++) {
    let improved = false;
    const score = bad(order);
    for (let i = 0; i < order.length && !improved; i++)
      for (let j = i + 1; j < order.length; j++) {
        [order[i], order[j]] = [order[j], order[i]];
        if (bad(order) < score) {
          improved = true;
          break;
        }
        [order[i], order[j]] = [order[j], order[i]];
      }
    if (!improved) break;
  }
  check(
    bad(order) === 0,
    "No valid allocation found. Existing reviews were not changed.",
  );
  return order;
}

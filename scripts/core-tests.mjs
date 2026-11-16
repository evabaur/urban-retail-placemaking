import assert from "node:assert/strict";
import { cycleOrder } from "../lib/allocation-core.ts";
import { scoreGroup } from "../lib/scoring.ts";
let cases = 0;
for (const sizes of [
  [6, 6, 6, 6, 6, 5, 5],
  [6, 6, 6, 6, 6, 6, 4],
  [3, 3, 3],
  [1, 1, 1],
  [20, 20],
  [5, 4, 3, 2],
  [2, 1, 1],
  [1, 1, 1, 1],
]) {
  const people = sizes.flatMap((n, g) =>
    Array.from({ length: n }, (_, i) => ({
      id: g + "-" + i,
      group_id: "g" + g,
    })),
  );
  for (let seed = 1; seed <= 500; seed++) {
    const order = cycleOrder(people, seed);
    assert.equal(new Set(order.map((p) => p.id)).size, people.length);
    for (let i = 0; i < order.length; i++) {
      assert.notEqual(order[i].id, order[(i + 1) % order.length].id);
      assert.notEqual(
        order[i].group_id,
        order[(i + 1) % order.length].group_id,
      );
      assert.notEqual(order[i].id, order[(i + 2) % order.length].id);
    }
    cases++;
  }
}
assert.throws(() =>
  cycleOrder([
    { id: "a", group_id: "x" },
    { id: "b", group_id: "x" },
    { id: "c", group_id: "y" },
  ]),
);
const people = ["a", "b", "c"].map((id) => ({ id }));
const reviews = people.flatMap((p) =>
  people.map((q) => ({
    owner: p.id,
    target: q.id,
    scores: { share: p.id === q.id ? 5 : 3, reliable: p.id === q.id ? 5 : 3 },
  })),
);
const scores = scoreGroup(people, reviews);
for (const s of scores) {
  assert.equal(s.avg, 3);
  assert.equal(s.index, 1);
  assert.equal(s.indexAdj, 1);
  assert.equal(s.selfGap, 2);
  assert.equal(s.n, 2);
}
assert.equal(scoreGroup(people, [])[0].avg, null);
console.log(
  "PASS",
  cases,
  "seeded allocation configurations; infeasibility, no-self/no-teammate/no-reciprocal, self-rating exclusion and median/rater adjustment.",
);

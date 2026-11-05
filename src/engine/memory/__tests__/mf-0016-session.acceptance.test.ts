/**
 * MF-0016 acceptance (frozen): SC-5, a cuckoo round is picked by the Duel's rule (weight × (1 − R),
 * one item per skill, least recently seen first), and the Duel's own picks are unchanged.
 * The real pack is read at runtime; weights copied from packs/ccdv-f/pack.yaml (2026-11-04).
 */
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { loadPackFile } from "../../pack/load-pack";
import type { Pack } from "../../pack/types";
import { loadPackQuestions } from "../../questions/load-questions";
import { pickSessionItems, pickSessionQuestions } from "../select";
import type { Attempt } from "../types";

const ROOT = process.cwd();
const NOW = new Date("2026-11-04T12:00:00Z");
// D6.S1 3.8, D6.S2 4.6, D6.S3 2.6, D7.S1 3.2, D7.S2 2.3, D7.S3 1.0, D7.S4 1.6
const SKILLS = ["D6.S1", "D6.S2", "D6.S3", "D7.S1", "D7.S2", "D7.S3", "D7.S4"];
const ITEMS = SKILLS.flatMap((s) => [
  { id: `p.${s}.a`, skillCode: s },
  { id: `p.${s}.b`, skillCode: s },
]);

let pack: Pack;
beforeAll(async () => {
  pack = await loadPackFile(join(ROOT, "packs/ccdv-f/pack.yaml"));
});

describe("MF-0016 SC-5: cuckoo round", () => {
  it("SC-5: with nothing seen, the 5 heaviest skills with cuckoos, one each, file order within a skill", () => {
    const picked = pickSessionItems({
      pack,
      items: ITEMS,
      attempts: [],
      now: NOW,
    });
    expect(picked.map((i) => i.id)).toEqual([
      "p.D6.S2.a",
      "p.D6.S1.a",
      "p.D7.S1.a",
      "p.D6.S3.a",
      "p.D7.S2.a",
    ]);
  });

  it("SC-5: within a skill, the item seen least recently (never seen first)", () => {
    const attempts: Attempt[] = [
      {
        questionId: "p.D6.S2.a",
        skillCode: "D6.S2",
        correct: false,
        // Long ago, so D6.S2 still ranks first (a fresh attempt would push R to ~1).
        answeredAt: new Date("2026-01-01T00:00:00Z"),
      },
    ];
    const picked = pickSessionItems({ pack, items: ITEMS, attempts, now: NOW });
    expect(picked.map((i) => i.id)).toContain("p.D6.S2.b");
    expect(picked.map((i) => i.id)).not.toContain("p.D6.S2.a");
  });

  it("SC-5: fewer than 5 skills with cuckoos gives a shorter round; none gives an empty one", () => {
    const two = ITEMS.filter(
      (i) => i.skillCode === "D7.S3" || i.skillCode === "D7.S4",
    );
    expect(
      pickSessionItems({ pack, items: two, attempts: [], now: NOW }).map(
        (i) => i.id,
      ),
    ).toEqual(["p.D7.S4.a", "p.D7.S3.a"]);
    expect(
      pickSessionItems({ pack, items: [], attempts: [], now: NOW }),
    ).toEqual([]);
  });

  it("SC-5: over questions, the general picker returns exactly the Duel's picks", async () => {
    const questions = await loadPackQuestions(
      pack,
      join(ROOT, "packs/ccdv-f/questions"),
    );
    const first = questions[0];
    if (!first) throw new Error("the pack has no questions");
    const attempts: Attempt[] = [
      {
        questionId: first.id,
        skillCode: first.skillCode,
        correct: true,
        answeredAt: new Date("2026-11-03T09:00:00Z"),
      },
    ];
    expect(
      pickSessionItems({ pack, items: questions, attempts, now: NOW }).map(
        (q) => q.id,
      ),
    ).toEqual(
      pickSessionQuestions({ pack, questions, attempts, now: NOW }).map(
        (q) => q.id,
      ),
    );
  });
});

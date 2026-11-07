/**
 * MF-0062 acceptance (SC-1, SC-2, SC-3): the course map's node mode, its one next step and its shape.
 * Rows and literals from the edge-input tables in .planning/tasks/MF-0062/GOAL.md (M1–M7, N1–N10,
 * C1–C6). The boundary rows (N8, N9) go through the real `treeStage`: FOREST_THRESHOLDS
 * saplingStabilityDays = 3 (`>=`), wiltBelowRetrievability = 0.85 (`<`).
 */
import { describe, expect, it } from "vitest";
import {
  type ForestView,
  type MemorySnapshot,
  type TreeStage,
  treeStage,
} from "@/engine/forest";
import { courseMap, nextStep, nodeMode } from "@/engine/path";

interface TreeSpec {
  code: string;
  stage: TreeStage;
  wilting?: boolean;
  weight?: number;
}

/** A forest from regions of tree specs; weight defaults to 10, wilting to false. */
function forest(regions: Record<string, readonly TreeSpec[]>): ForestView {
  return {
    packSlug: "demo",
    packName: "Demo pack",
    regions: Object.entries(regions).map(([domainCode, trees]) => ({
      domainCode,
      name: `Domain ${domainCode}`,
      weight: 50,
      trees: trees.map((t) => ({
        skillCode: t.code,
        name: `Skill ${t.code}`,
        weight: t.weight ?? 10,
        stage: t.stage,
        wilting: t.wilting ?? false,
      })),
    })),
  };
}

function memory(stabilityDays: number, retrievability: number): MemorySnapshot {
  return {
    successfulRecalls: 2,
    stabilityDays,
    retrievability,
    feynmanPassed: false,
    stormProven: false,
    fullStormProven: false,
  };
}

const NONE: ReadonlySet<string> = new Set();

describe("MF-0062 SC-1: nodeMode opens an existing mode (M1–M7)", () => {
  it("SC-1 M1: a Seed with something to plant opens Seed Planting", () => {
    expect(nodeMode({ stage: "seed", wilting: false, isPlantable: true })).toBe(
      "plant",
    );
  });
  it("SC-1 M2: a Seed with nothing to plant opens the Daily Walk", () => {
    expect(
      nodeMode({ stage: "seed", wilting: false, isPlantable: false }),
    ).toBe("walk");
  });
  it("SC-1 M3: a healthy Sprout with something to plant opens Seed Planting", () => {
    expect(
      nodeMode({ stage: "sprout", wilting: false, isPlantable: true }),
    ).toBe("plant");
  });
  it("SC-1 M4: a healthy Sprout with nothing to plant opens the Daily Walk", () => {
    expect(
      nodeMode({ stage: "sprout", wilting: false, isPlantable: false }),
    ).toBe("walk");
  });
  it("SC-1 M5: a wilting Sprout opens the Daily Walk, which waters it", () => {
    expect(
      nodeMode({ stage: "sprout", wilting: true, isPlantable: true }),
    ).toBe("walk");
  });
  it("SC-1 M6: a wilting Sapling, Tree or Ancient tree opens the Daily Walk", () => {
    for (const stage of ["sapling", "tree", "ancient"] as const) {
      for (const isPlantable of [true, false]) {
        expect(nodeMode({ stage, wilting: true, isPlantable })).toBe("walk");
      }
    }
  });
  it("SC-1 M7: a healthy Sapling, Tree or Ancient tree opens the Scenario Duel", () => {
    for (const stage of ["sapling", "tree", "ancient"] as const) {
      for (const isPlantable of [true, false]) {
        expect(nodeMode({ stage, wilting: false, isPlantable })).toBe("duel");
      }
    }
  });
});

describe("MF-0062 SC-2: nextStep picks one obvious next step (N1–N10)", () => {
  it("SC-2 N1: no memory at all → Next on the first skill of the first domain", () => {
    const f = forest({
      D1: [
        { code: "D1.1", stage: "seed" },
        { code: "D1.2", stage: "seed" },
      ],
      D2: [{ code: "D2.1", stage: "seed", weight: 40 }],
    });
    expect(nextStep(f)).toEqual({ kind: "next", skillCode: "D1.1" });
  });

  it("SC-2 N2: one skill never attempted among healthy Saplings → Next on that Seed", () => {
    const f = forest({
      D1: [
        { code: "D1.1", stage: "sapling" },
        { code: "D1.2", stage: "tree" },
      ],
      D2: [
        { code: "D2.1", stage: "sapling" },
        { code: "D2.2", stage: "seed" },
      ],
    });
    expect(nextStep(f)).toEqual({ kind: "next", skillCode: "D2.2" });
  });

  it("SC-2 N3: all wilting → Water first on the heaviest; a weight tie goes to the lower code", () => {
    const heaviest = forest({
      D1: [
        { code: "D1.1", stage: "sprout", wilting: true, weight: 5 },
        { code: "D1.2", stage: "sapling", wilting: true, weight: 20 },
      ],
      D2: [{ code: "D2.1", stage: "tree", wilting: true, weight: 12 }],
    });
    expect(nextStep(heaviest)).toEqual({ kind: "water", skillCode: "D1.2" });

    const tie = forest({
      D1: [{ code: "D1.9", stage: "sprout", wilting: true, weight: 10 }],
      D2: [{ code: "D1.3", stage: "sapling", wilting: true, weight: 10 }],
    });
    expect(nextStep(tie)).toEqual({ kind: "water", skillCode: "D1.3" });
  });

  it("SC-2 N4: every skill at Sapling or above and none wilting → done", () => {
    const f = forest({
      D1: [
        { code: "D1.1", stage: "sapling" },
        { code: "D1.2", stage: "ancient" },
      ],
      D2: [{ code: "D2.1", stage: "tree" }],
    });
    expect(nextStep(f)).toEqual({ kind: "done" });
  });

  it("SC-2 N5: all done but one Sapling wilting → Water first on that Sapling", () => {
    const f = forest({
      D1: [
        { code: "D1.1", stage: "tree" },
        { code: "D1.2", stage: "sapling", wilting: true },
      ],
    });
    expect(nextStep(f)).toEqual({ kind: "water", skillCode: "D1.2" });
  });

  it("SC-2 N6: a healthy Sprout before a Seed → Next on the Seed (no futile loop on the Sprout)", () => {
    const f = forest({
      D1: [
        { code: "D1.1", stage: "sapling" },
        { code: "D1.2", stage: "sprout" },
      ],
      D2: [
        { code: "D2.1", stage: "sprout" },
        { code: "D2.2", stage: "seed" },
        { code: "D2.3", stage: "seed" },
      ],
    });
    expect(nextStep(f)).toEqual({ kind: "next", skillCode: "D2.2" });
  });

  it("SC-2 N7: only healthy Sprouts left → Next on the first Sprout in map order", () => {
    const f = forest({
      D1: [
        { code: "D1.1", stage: "sapling" },
        { code: "D1.2", stage: "tree" },
      ],
      D2: [
        { code: "D2.1", stage: "sapling" },
        { code: "D2.2", stage: "sprout", weight: 1 },
      ],
      D3: [{ code: "D3.1", stage: "sprout", weight: 30 }],
    });
    expect(nextStep(f)).toEqual({ kind: "next", skillCode: "D2.2" });
  });

  it("SC-2 N8: stability 2.99 d is a Sprout (not done); 3.0 d is a Sapling (done)", () => {
    const below = treeStage(memory(2.99, 0.95));
    const at = treeStage(memory(3.0, 0.95));
    expect(below).toEqual({ stage: "sprout", wilting: false });
    expect(at).toEqual({ stage: "sapling", wilting: false });
    const f = forest({
      D1: [
        { code: "D1.1", ...at },
        { code: "D1.2", ...below },
      ],
    });
    expect(nextStep(f)).toEqual({ kind: "next", skillCode: "D1.2" });
    const map = courseMap({ forest: f, plantable: NONE, hasExam: false });
    expect(map.domains[0]?.nodes.map((n) => n.isDone)).toEqual([true, false]);
    expect(map.doneCount).toBe(1);
  });

  it("SC-2 N9: retrievability 0.85 is healthy; 0.8499 wilts and is watered first", () => {
    const healthy = treeStage(memory(2, 0.85));
    const fading = treeStage(memory(2, 0.8499));
    expect(healthy).toEqual({ stage: "sprout", wilting: false });
    expect(fading).toEqual({ stage: "sprout", wilting: true });
    const f = forest({
      D1: [
        { code: "D1.1", stage: "seed" },
        { code: "D1.2", ...healthy },
        { code: "D1.3", ...fading },
      ],
    });
    expect(nextStep(f)).toEqual({ kind: "water", skillCode: "D1.3" });
  });

  it("SC-2 N10: a Seed answered only wrongly is a Seed: Next, never Water", () => {
    const wrongOnly = treeStage({
      ...memory(0.5, 0.1),
      successfulRecalls: 0,
    });
    expect(wrongOnly).toEqual({ stage: "seed", wilting: false });
    const f = forest({
      D1: [
        { code: "D1.1", stage: "sapling" },
        { code: "D1.2", ...wrongOnly },
      ],
    });
    expect(nextStep(f)).toEqual({ kind: "next", skillCode: "D1.2" });
  });
});

describe("MF-0062 SC-3: courseMap groups nodes by domain with one next step (C1–C6)", () => {
  it("SC-3 C1: a pack with one domain has one domain and one checkpoint (exam pack)", () => {
    const f = forest({
      D1: [
        { code: "D1.1", stage: "sapling" },
        { code: "D1.2", stage: "seed" },
      ],
    });
    const map = courseMap({ forest: f, plantable: NONE, hasExam: true });
    expect(map.domains).toHaveLength(1);
    expect(map.domains[0]?.checkpoint).toEqual({ isReady: false });
  });

  it("SC-3 C2: a pack without an exam has no checkpoint in any domain", () => {
    const f = forest({
      D1: [{ code: "D1.1", stage: "sapling" }],
      D2: [{ code: "D2.1", stage: "tree" }],
    });
    const map = courseMap({ forest: f, plantable: NONE, hasExam: false });
    expect(map.domains.map((d) => d.checkpoint)).toEqual([null, null]);
  });

  it("SC-3 C3 + N4: every node done → each checkpoint Ready, done N of N, next done", () => {
    const f = forest({
      D1: [
        { code: "D1.1", stage: "sapling" },
        { code: "D1.2", stage: "tree" },
      ],
      D2: [{ code: "D2.1", stage: "ancient" }],
    });
    const map = courseMap({ forest: f, plantable: NONE, hasExam: true });
    expect(map.domains.map((d) => d.checkpoint)).toEqual([
      { isReady: true },
      { isReady: true },
    ]);
    expect(map.doneCount).toBe(3);
    expect(map.totalSkills).toBe(3);
    expect(map.next).toEqual({ kind: "done" });
  });

  it("SC-3 C4: a domain with k of n done is not ready and carries k and n", () => {
    const f = forest({
      D1: [
        { code: "D1.1", stage: "sapling", wilting: true },
        { code: "D1.2", stage: "sprout" },
        { code: "D1.3", stage: "seed" },
      ],
    });
    const map = courseMap({ forest: f, plantable: NONE, hasExam: true });
    const domain = map.domains[0];
    expect(domain?.doneCount).toBe(1);
    expect(domain?.skillCount).toBe(3);
    expect(domain?.checkpoint).toEqual({ isReady: false });
    expect(map.wiltingSkills).toBe(1);
  });

  it("SC-3 C5: domains and nodes keep pack order; each node carries stage, wilting, done and mode", () => {
    const f = forest({
      D2: [
        { code: "D2.9", stage: "seed" },
        { code: "D2.1", stage: "sprout", wilting: true },
      ],
      D1: [
        { code: "D1.5", stage: "tree" },
        { code: "D1.2", stage: "sprout" },
      ],
    });
    const map = courseMap({
      forest: f,
      plantable: new Set(["D2.9", "D1.2"]),
      hasExam: false,
    });
    expect(map.packSlug).toBe("demo");
    expect(map.packName).toBe("Demo pack");
    expect(map.domains.map((d) => d.domainCode)).toEqual(["D2", "D1"]);
    expect(map.domains[0]?.name).toBe("Domain D2");
    expect(
      map.domains.flatMap((d) =>
        d.nodes.map((n) => [n.skillCode, n.stage, n.wilting, n.isDone, n.mode]),
      ),
    ).toEqual([
      ["D2.9", "seed", false, false, "plant"],
      ["D2.1", "sprout", true, false, "walk"],
      ["D1.5", "tree", false, true, "duel"],
      ["D1.2", "sprout", false, false, "plant"],
    ]);
    expect(map.domains[0]?.nodes[0]?.name).toBe("Skill D2.9");
    expect(map.next).toEqual({ kind: "water", skillCode: "D2.1" });
  });

  it("SC-3 C6: an empty forest has no domains, totals 0 and nothing next", () => {
    const empty: ForestView = { packSlug: "e", packName: "E", regions: [] };
    const map = courseMap({ forest: empty, plantable: NONE, hasExam: true });
    expect(map.domains).toEqual([]);
    expect(map.doneCount).toBe(0);
    expect(map.totalSkills).toBe(0);
    expect(map.wiltingSkills).toBe(0);
    expect(map.next).toEqual({ kind: "done" });
  });

  it("SC-3 N1: no memory at all → done 0 of N, fading 0, next on the first skill", () => {
    const f = forest({
      D1: [
        { code: "D1.1", stage: "seed" },
        { code: "D1.2", stage: "seed" },
      ],
    });
    const map = courseMap({ forest: f, plantable: NONE, hasExam: false });
    expect(map.doneCount).toBe(0);
    expect(map.totalSkills).toBe(2);
    expect(map.wiltingSkills).toBe(0);
    expect(map.next).toEqual({ kind: "next", skillCode: "D1.1" });
  });
});

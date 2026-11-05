/**
 * MF-0021 acceptance: the group heatmap shows the healthy share as one of three bands, worked out on
 * integers, and the recall as a word only, so no region reveals how many members have played.
 * Expected values come from GOAL.md (edge-input table, decided by the user 2026-11-05), never from code.
 */
import { describe, expect, it } from "vitest";
import { parsePack } from "../../pack/load-pack";
import { summarizeGroupHeatmap } from "../group-heatmap";
import type { MemorySnapshot } from "../tree-stage";

const pack = parsePack(`
slug: p
name: P
kind: course
version: 1
domains:
  - code: S1
    name: Single
    weight: 50
    skills:
      - { code: S1.1, name: One, weight: 50 }
  - code: S2
    name: Double
    weight: 50
    skills:
      - { code: S2.1, name: Two, weight: 25 }
      - { code: S2.2, name: Three, weight: 25 }
`);

const snap = (
  successfulRecalls: number,
  stabilityDays: number,
  retrievability: number,
): MemorySnapshot => ({
  successfulRecalls,
  stabilityDays,
  retrievability,
  feynmanPassed: false,
  stormProven: false,
  fullStormProven: false,
});
// sapling, holding → healthy
const healthy = snap(2, 4, 0.9);
// sprout below the wilt line → not healthy, but the member has memory, so they contribute
const wilting = snap(1, 1, 0.7);

const SKILLS = ["S1.1", "S2.1", "S2.2"] as const;

/** N contributors; the first `k1` are healthy on S1.1 and the first `k2` (member, skill) pairs of S2 are healthy. */
function group(
  n: number,
  k1: number,
  k2: number,
): Map<string, MemorySnapshot>[] {
  return Array.from({ length: n }, (_, i) => {
    const memory = new Map<string, MemorySnapshot>();
    memory.set(SKILLS[0], i < k1 ? healthy : wilting);
    memory.set(SKILLS[1], 2 * i < k2 ? healthy : wilting);
    memory.set(SKILLS[2], 2 * i + 1 < k2 ? healthy : wilting);
    return memory;
  });
}

const none = new Map<string, MemorySnapshot>();
const regionsOf = (others: Map<string, MemorySnapshot>[]) => {
  const heatmap = summarizeGroupHeatmap({ pack, viewer: none, others });
  if (heatmap.status !== "ready") throw new Error("expected a ready heatmap");
  return heatmap.regions;
};
const bandOf = (region: object): unknown => Reflect.get(region, "healthyBand");

describe("MF-0021 heatmap bands", () => {
  it("SC-1: a region carries exactly domainCode, healthyBand, name and status: no percent, no count", () => {
    for (const region of regionsOf(group(4, 2, 3))) {
      expect(Object.keys(region).sort()).toEqual([
        "domainCode",
        "healthyBand",
        "name",
        "status",
      ]);
    }
  });

  it("SC-2: the band follows the edge table on integers", () => {
    const single = (n: number, k: number) =>
      bandOf(regionsOf(group(n, k, 0))[0] ?? {});
    const double = (n: number, k: number) =>
      bandOf(regionsOf(group(n, 0, k))[1] ?? {});
    expect(single(4, 1)).toBe("few"); // 1/4, just under ⅓
    expect(single(3, 1)).toBe("some"); // exactly ⅓
    expect(double(3, 2)).toBe("some"); // 2/6
    expect(single(5, 3)).toBe("some"); // 3/5, just under ⅔
    expect(single(3, 2)).toBe("most"); // exactly ⅔
    expect(double(3, 4)).toBe("most"); // 4/6
    expect(single(4, 0)).toBe("few"); // none healthy
    expect(single(4, 4)).toBe("most"); // all healthy
  });

  it("SC-3: every band is reachable for every contributor count, so the bands never pin N", () => {
    for (let n = 3; n <= 12; n++) {
      const singleBands = new Set<unknown>();
      for (let k = 0; k <= n; k++) {
        singleBands.add(bandOf(regionsOf(group(n, k, 0))[0] ?? {}));
      }
      const doubleBands = new Set<unknown>();
      for (let k = 0; k <= 2 * n; k++) {
        doubleBands.add(bandOf(regionsOf(group(n, 0, k))[1] ?? {}));
      }
      expect({ n, bands: [...singleBands].sort() }).toEqual({
        n,
        bands: ["few", "most", "some"],
      });
      expect({ n, bands: [...doubleBands].sort() }).toEqual({
        n,
        bands: ["few", "most", "some"],
      });
    }
  });

  it("SC-3: the worked example: 3 of 4 and 4 of 5 healthy read the same, as do 1 of 4 and 1 of 5", () => {
    expect(regionsOf(group(4, 3, 0))[0]).toEqual(regionsOf(group(5, 4, 0))[0]);
    expect(regionsOf(group(4, 1, 0))[0]).toEqual(regionsOf(group(5, 1, 0))[0]);
    expect(regionsOf(group(4, 3, 0))[0]).toEqual({
      domainCode: "S1",
      name: "Single",
      healthyBand: "most",
      // mean recall (3 × 0.9 + 0.7) / 4 = 0.85 → 85 % → holding
      status: "holding",
    });
  });

  it("SC-4: the status word keeps MF-0011's rule (0.846 → holding, 0.84 → fading, no memory → no-data)", () => {
    const only = (r: number) => new Map([["S1.1", snap(2, 4, r)]]);
    const status = (r: number) =>
      regionsOf([only(r), only(r), only(r)])[0]?.status;
    expect(status(0.846)).toBe("holding");
    expect(status(0.84)).toBe("fading");
    const elsewhere = regionsOf([only(0.9), only(0.9), only(0.9)])[1];
    expect(elsewhere).toEqual({
      domainCode: "S2",
      name: "Double",
      healthyBand: "few",
      status: "no-data",
    });
  });
});

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
  - code: A
    name: Alpha
    weight: 100
    skills:
      - { code: A.1, name: One, weight: 40 }
      - { code: A.2, name: Two, weight: 30 }
      - { code: A.3, name: Three, weight: 30 }
`);

const snap = (retrievability: number, stabilityDays = 4): MemorySnapshot => ({
  successfulRecalls: 2,
  stabilityDays,
  retrievability,
  feynmanPassed: false,
  stormProven: false,
  fullStormProven: false,
});
const none = new Map<string, MemorySnapshot>();
const only = (r: number) => new Map([["A.1", snap(r)]]);

describe("summarizeGroupHeatmap", () => {
  it("bands the healthy share in thirds over every pair (1 of 9 → few, 3 of 9 → some, 6 of 9 → most)", () => {
    const all = (r: number) =>
      new Map([
        ["A.1", snap(r)],
        ["A.2", snap(r)],
        ["A.3", snap(r)],
      ]);
    const band = (others: ReadonlyMap<string, MemorySnapshot>[]) => {
      const heatmap = summarizeGroupHeatmap({ pack, viewer: none, others });
      return heatmap.status === "ready" && heatmap.regions[0]?.healthyBand;
    };
    expect(band([only(0.9), only(0.5), only(0.5)])).toBe("few");
    expect(band([all(0.9), only(0.5), only(0.5)])).toBe("some");
    expect(band([all(0.9), all(0.9), only(0.5)])).toBe("most");
  });

  it("calls a region 'holding' exactly at the wilt threshold (85 %)", () => {
    const heatmap = summarizeGroupHeatmap({
      pack,
      viewer: none,
      others: [only(0.85), only(0.85), only(0.85)],
    });
    expect(heatmap.status === "ready" && heatmap.regions[0]?.status).toBe(
      "holding",
    );
  });

  it("decides the word on the whole-percent mean: 0.846 rounds to 85 and reads 'holding' (review N1)", () => {
    const heatmap = summarizeGroupHeatmap({
      pack,
      viewer: none,
      others: [only(0.846), only(0.846), only(0.846)],
    });
    expect(heatmap.status === "ready" && heatmap.regions[0]?.status).toBe(
      "holding",
    );
  });

  it("does not count the viewer towards the 3, even with memory", () => {
    expect(
      summarizeGroupHeatmap({
        pack,
        viewer: only(0.9),
        others: [only(0.9), only(0.9)],
      }),
    ).toEqual({ status: "not-enough-data" });
  });

  it("ignores memory for skills that aren't in the pack", () => {
    const elsewhere = new Map([["Z.9", snap(0.2)]]);
    expect(
      summarizeGroupHeatmap({
        pack,
        viewer: none,
        others: [elsewhere, elsewhere, elsewhere],
      }),
    ).toEqual({
      status: "ready",
      regions: [
        {
          domainCode: "A",
          name: "Alpha",
          healthyBand: "few",
          status: "no-data",
        },
      ],
    });
  });

  it("returns 'not-enough-data' with nobody", () => {
    expect(summarizeGroupHeatmap({ pack, viewer: none, others: [] })).toEqual({
      status: "not-enough-data",
    });
  });
});

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
  it("rounds the healthy share to a whole percent (1 of 9 pairs → 11)", () => {
    const heatmap = summarizeGroupHeatmap({
      pack,
      viewer: none,
      others: [only(0.9), only(0.5), only(0.5)],
    });
    expect(
      heatmap.status === "ready" && heatmap.regions[0]?.healthyPercent,
    ).toBe(11);
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

  it("decides the word on the shown figure: a mean of 0.846 shows 85 % and reads 'holding' (review N1)", () => {
    const heatmap = summarizeGroupHeatmap({
      pack,
      viewer: none,
      others: [only(0.846), only(0.846), only(0.846)],
    });
    expect(heatmap.status === "ready" && heatmap.regions[0]).toMatchObject({
      retrievabilityPercent: 85,
      status: "holding",
    });
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
          healthyPercent: 0,
          retrievabilityPercent: null,
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

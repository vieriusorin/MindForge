/**
 * MF-0021 SC-7 (review, user 2026-11-05): the viewer's own memory never moves the card. If it did, the
 * viewer could compare two loads around one of their own answers and pin how many others have played
 * (1 of 3 healthy reads "some", 1 of 4 reads "few"). Expected values come from GOAL.md, not from code.
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
    name: Other
    weight: 50
    skills:
      - { code: S2.1, name: Two, weight: 50 }
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
const healthy = snap(2, 4, 0.9);
const wilting = snap(1, 1, 0.7);
const seed = snap(0, 0.5, 0.6);
const none = new Map<string, MemorySnapshot>();

// 3 others: one healthy on S1.1, two wilting on S1.1; nobody on S2
const others = [
  new Map([["S1.1", healthy]]),
  new Map([["S1.1", wilting]]),
  new Map([["S1.1", wilting]]),
];

describe("MF-0021 SC-7: the viewer's own memory never changes the card", () => {
  it("SC-7: the viewer's first answer elsewhere leaves a single-skill region's band as it was (the review's two-load case)", () => {
    const before = summarizeGroupHeatmap({ pack, viewer: none, others });
    const after = summarizeGroupHeatmap({
      pack,
      viewer: new Map([["S2.1", seed]]),
      others,
    });
    expect(after).toEqual(before);
    // 1 of 3 others healthy → exactly ⅓ → some
    expect(after).toEqual({
      status: "ready",
      regions: [
        {
          domainCode: "S1",
          name: "Single",
          healthyBand: "some",
          status: "fading",
        },
        {
          domainCode: "S2",
          name: "Other",
          healthyBand: "few",
          status: "no-data",
        },
      ],
    });
  });

  it("SC-7: a viewer healthy everywhere reads the same card as a viewer who never played", () => {
    expect(
      summarizeGroupHeatmap({
        pack,
        viewer: new Map([
          ["S1.1", healthy],
          ["S2.1", healthy],
        ]),
        others,
      }),
    ).toEqual(summarizeGroupHeatmap({ pack, viewer: none, others }));
  });
});

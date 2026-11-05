/**
 * MF-0052 acceptance (frozen, SC-11): the recent-storms rows on the Storm start page. Newest first, at
 * most 5, each a link to /storms/<id> with its kind and a Survived / Not survived verdict. Verdicts
 * here are worked out by hand from CONTEXT.md ("Survived domain": at least 72 % right; unanswered
 * counts as wrong, voided is not scored). Every fixture storm is either survived in all its domains
 * or in none, so the expected verdict does not depend on how a multi-domain storm is summarised.
 */
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { loadPackFile, type Pack } from "@/engine/pack";
import type { StormResultQuestion } from "@/engine/storm";
import type { FinishedStormInput } from "../types";
import { toRecentStormRows } from "../utils";

let pack: Pack;
beforeAll(async () => {
  pack = await loadPackFile(
    join(process.cwd(), "packs", "ccdv-f", "pack.yaml"),
  );
});

/** `n` questions of one skill, the first `right` answered correctly, the rest answered wrong. */
function answers(
  skillCode: string,
  n: number,
  right: number,
  prefix: string,
): StormResultQuestion[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `${prefix}-${skillCode}-${i}`,
    skillCode,
    chosen: ["A"],
    correct: i < right,
    voided: false,
  }));
}

function storm(
  id: string,
  finishedAt: string,
  questions: StormResultQuestion[],
  boss: string | null = null,
): FinishedStormInput {
  return {
    id,
    kind: boss ? "boss" : "full",
    domainCode: boss,
    finishedAt,
    questions,
  };
}

describe("MF-0052 SC-11 recent storms", () => {
  it("no finished storm, no rows", () => {
    expect(toRecentStormRows({ pack, storms: [] })).toEqual([]);
  });

  it("newest first, at most 5, each linking to its report with kind and engine verdict", () => {
    const storms: FinishedStormInput[] = [
      // oldest two fall off the list
      storm("s1", "2026-10-01T09:00:00.000Z", answers("D1.S1", 4, 4, "s1")),
      storm("s2", "2026-10-02T09:00:00.000Z", answers("D1.S1", 4, 0, "s2")),
      // Full Storm, every domain 100 % → survived
      storm("s3", "2026-10-20T09:00:00.000Z", [
        ...answers("D1.S1", 3, 3, "s3"),
        ...answers("D2.S3", 2, 2, "s3"),
      ]),
      // Boss Storm D1, exactly 18 of 25 = 72 % → survived (the threshold is inclusive)
      storm(
        "s4",
        "2026-10-25T09:00:00.000Z",
        answers("D1.S2", 25, 18, "s4"),
        "D1",
      ),
      // Boss Storm D2, 17 of 25 = 68 % → not survived
      storm(
        "s5",
        "2026-11-01T09:00:00.000Z",
        answers("D2.S1", 25, 17, "s5"),
        "D2",
      ),
      // Full Storm: 2 right + 2 unanswered in D1 = 50 %, 0 of 2 in D2 → not survived
      storm("s6", "2026-11-03T09:00:00.000Z", [
        ...answers("D1.S1", 2, 2, "s6"),
        {
          id: "s6-u1",
          skillCode: "D1.S1",
          chosen: null,
          correct: null,
          voided: false,
        },
        {
          id: "s6-u2",
          skillCode: "D1.S3",
          chosen: null,
          correct: null,
          voided: false,
        },
        ...answers("D2.S3", 2, 0, "s6"),
      ]),
      // Boss Storm D1: 2 voided (not scored) + 3 of 3 right → survived
      storm(
        "s7",
        "2026-11-04T09:00:00.000Z",
        [
          ...answers("D1.S1", 3, 3, "s7"),
          {
            id: "s7-v1",
            skillCode: "D1.S1",
            chosen: null,
            correct: null,
            voided: true,
          },
          {
            id: "s7-v2",
            skillCode: "D1.S2",
            chosen: ["B"],
            correct: null,
            voided: true,
          },
        ],
        "D1",
      ),
    ];
    // input order must not matter
    const shuffled = [
      storms[3],
      storms[0],
      storms[6],
      storms[2],
      storms[5],
      storms[1],
      storms[4],
    ].flatMap((s) => (s ? [s] : []));

    expect(toRecentStormRows({ pack, storms: shuffled })).toEqual([
      {
        id: "s7",
        href: "/storms/s7",
        finishedAt: "2026-11-04T09:00:00.000Z",
        kindLabel: "Boss Storm: Agents and Workflows",
        survived: true,
      },
      {
        id: "s6",
        href: "/storms/s6",
        finishedAt: "2026-11-03T09:00:00.000Z",
        kindLabel: "Full Storm",
        survived: false,
      },
      {
        id: "s5",
        href: "/storms/s5",
        finishedAt: "2026-11-01T09:00:00.000Z",
        kindLabel: "Boss Storm: Applications and Integration",
        survived: false,
      },
      {
        id: "s4",
        href: "/storms/s4",
        finishedAt: "2026-10-25T09:00:00.000Z",
        kindLabel: "Boss Storm: Agents and Workflows",
        survived: true,
      },
      {
        id: "s3",
        href: "/storms/s3",
        finishedAt: "2026-10-20T09:00:00.000Z",
        kindLabel: "Full Storm",
        survived: true,
      },
    ]);
  });
});

import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { loadPackFile } from "../../pack/load-pack";
import type { Pack } from "../../pack/types";
import { readinessStorms } from "../readiness-storms";
import type { StormResult, StormResultQuestion } from "../types";

// MF-0013 × MF-0015 wiring (ROADMAP §4.3: the second to merge wires them): every finished storm gives
// one readiness entry per domain it scored, with its own finish time, in MF-0015's own type.
let pack: Pack;
beforeAll(async () => {
  pack = await loadPackFile(
    join(__dirname, "../../../../packs/ccdv-f/pack.yaml"),
  );
});

const q = (
  id: string,
  skillCode: string,
  correct: boolean | null,
): StormResultQuestion => ({
  id,
  skillCode,
  chosen: correct === null ? null : ["A"],
  correct,
  voided: false,
});

describe("readinessStorms", () => {
  it("maps each finished storm's domain scores to MF-0015's StormDomainScore, finishedAt as a Date", () => {
    const boss: StormResult = {
      kind: "boss",
      finishedAt: new Date("2026-11-10T09:00:00.000Z"),
      questions: [
        q("a", "D2.S1", true),
        q("b", "D2.S2", false),
        q("c", "D2.S3", true),
        q("d", "D2.S4", true),
      ],
    };
    const full: StormResult = {
      kind: "full",
      finishedAt: new Date("2026-11-12T09:00:00.000Z"),
      questions: [q("e", "D1.S1", true), q("f", "D2.S1", null)],
    };

    expect(readinessStorms(pack, [boss, full])).toEqual([
      {
        domainCode: "D2",
        percent: 75,
        finishedAt: new Date("2026-11-10T09:00:00.000Z"),
      },
      {
        domainCode: "D1",
        percent: 100,
        finishedAt: new Date("2026-11-12T09:00:00.000Z"),
      },
      {
        domainCode: "D2",
        percent: 0,
        finishedAt: new Date("2026-11-12T09:00:00.000Z"),
      },
    ]);
  });

  it("gives nothing without finished storms", () => {
    expect(readinessStorms(pack, [])).toEqual([]);
  });
});

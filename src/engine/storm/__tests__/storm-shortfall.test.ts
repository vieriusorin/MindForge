import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { loadPackFile } from "../../pack/load-pack";
import type { Pack } from "../../pack/types";
import { stormShortfall } from "../storm-shortfall";

let pack: Pack;
beforeAll(async () => {
  pack = await loadPackFile(
    join(__dirname, "../../../../packs/ccdv-f/pack.yaml"),
  );
});

const repeat = (skillCode: string, n: number) =>
  Array.from({ length: n }, () => ({ skillCode }));

const FULL = {
  "D1.S2": 8,
  "D2.S1": 17,
  "D3.S1": 2,
  "D4.S1": 1,
  "D5.S1": 9,
  "D6.S1": 6,
  "D7.S1": 4,
  "D8.S1": 6,
};
const fullQuestions = (over: Record<string, number> = {}) =>
  Object.entries({ ...FULL, ...over }).flatMap(([skill, n]) =>
    repeat(skill, n),
  );

describe("stormShortfall", () => {
  it("is empty for a full-sized Full Storm", () => {
    expect(
      stormShortfall(pack, {
        kind: "full",
        domainCode: null,
        questions: fullQuestions(),
      }),
    ).toEqual([]);
  });

  it("lists only the short domains of a Full Storm, in pack order", () => {
    expect(
      stormShortfall(pack, {
        kind: "full",
        domainCode: null,
        questions: fullQuestions({ "D2.S1": 13, "D8.S1": 0 }),
      }),
    ).toEqual([
      { domainCode: "D2", planned: 17, actual: 13 },
      { domainCode: "D8", planned: 6, actual: 0 },
    ]);
  });

  it("compares a Boss Storm with its 12 seats", () => {
    expect(
      stormShortfall(pack, {
        kind: "boss",
        domainCode: "D4",
        questions: repeat("D4.S1", 4),
      }),
    ).toEqual([{ domainCode: "D4", planned: 12, actual: 4 }]);
    expect(
      stormShortfall(pack, {
        kind: "boss",
        domainCode: "D2",
        questions: repeat("D2.S3", 12),
      }),
    ).toEqual([]);
  });
});

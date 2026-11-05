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

function question(
  id: string,
  over: Partial<StormResultQuestion> = {},
): StormResultQuestion {
  return {
    id,
    skillCode: "D1.S1",
    chosen: ["A"],
    correct: true,
    voided: false,
    ...over,
  };
}

function storm(over: Partial<FinishedStormInput> & { id: string }) {
  return {
    kind: "full",
    domainCode: null,
    finishedAt: "2026-11-01T09:00:00.000Z",
    questions: [question(`${over.id}-q`)],
    ...over,
  } satisfies FinishedStormInput;
}

describe("toRecentStormRows", () => {
  it("breaks a tie on finishedAt by id, descending", () => {
    const rows = toRecentStormRows({
      pack,
      storms: [storm({ id: "a" }), storm({ id: "c" }), storm({ id: "b" })],
    });
    expect(rows.map((r) => r.id)).toEqual(["c", "b", "a"]);
  });

  it("drops the sixth storm, which is the oldest", () => {
    const storms = Array.from({ length: 6 }, (_, i) =>
      storm({ id: `s${i}`, finishedAt: `2026-11-0${i + 1}T09:00:00.000Z` }),
    );
    const rows = toRecentStormRows({ pack, storms });
    expect(rows.map((r) => r.id)).toEqual(["s5", "s4", "s3", "s2", "s1"]);
  });

  it("does not reorder the caller's array", () => {
    const storms = [storm({ id: "a" }), storm({ id: "b" })];
    toRecentStormRows({ pack, storms });
    expect(storms.map((s) => s.id)).toEqual(["a", "b"]);
  });

  it("labels a Boss Storm with an unknown domain by its code", () => {
    const [row] = toRecentStormRows({
      pack,
      storms: [storm({ id: "x", kind: "boss", domainCode: "D9" })],
    });
    expect(row?.kindLabel).toBe("Boss Storm: D9");
  });

  it("does not count a storm with every question voided as survived", () => {
    const [row] = toRecentStormRows({
      pack,
      storms: [
        storm({
          id: "v",
          questions: [question("v1", { voided: true, correct: null })],
        }),
      ],
    });
    expect(row?.survived).toBe(false);
  });

  it("links each row to its storm report and keeps the ISO date for the view", () => {
    const [row] = toRecentStormRows({
      pack,
      storms: [storm({ id: "abc", finishedAt: "2026-11-04T10:30:00.000Z" })],
    });
    expect(row).toMatchObject({
      href: "/storms/abc",
      finishedAt: "2026-11-04T10:30:00.000Z",
      kindLabel: "Full Storm",
      survived: true,
    });
  });
});

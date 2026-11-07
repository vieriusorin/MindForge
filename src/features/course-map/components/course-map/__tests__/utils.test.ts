import { describe, expect, it } from "vitest";
import type { CourseMap } from "@/engine/path";
import {
  atSaplingLine,
  domainHeaderLine,
  fadingLine,
  findNextNode,
  nextStepReason,
  STEP_MARKER,
  stepMarker,
} from "../utils";

const MAP: CourseMap = {
  packSlug: "p",
  packName: "P",
  doneCount: 0,
  totalSkills: 2,
  wiltingSkills: 0,
  next: { kind: "next", skillCode: "b.1" },
  domains: [
    {
      domainCode: "A",
      name: "A",
      weight: 50,
      doneCount: 0,
      skillCount: 1,
      checkpoint: null,
      nodes: [
        {
          skillCode: "a.1",
          name: "a1",
          weight: 50,
          stage: "sprout",
          wilting: false,
          isDone: false,
          mode: "plant",
        },
      ],
    },
    {
      domainCode: "B",
      name: "B",
      weight: 50,
      doneCount: 0,
      skillCount: 1,
      checkpoint: { isReady: false },
      nodes: [
        {
          skillCode: "b.1",
          name: "b1",
          weight: 50,
          stage: "seed",
          wilting: false,
          isDone: false,
          mode: "plant",
        },
      ],
    },
  ],
};

describe("stepMarker", () => {
  it("marks only the node the next step names, with its word", () => {
    expect(stepMarker({ kind: "next", skillCode: "x" }, "x")).toBe("Next");
    expect(stepMarker({ kind: "water", skillCode: "x" }, "x")).toBe(
      "Water first",
    );
    expect(stepMarker({ kind: "next", skillCode: "x" }, "y")).toBeNull();
    expect(stepMarker({ kind: "done" }, "x")).toBeNull();
  });

  it("uses the STEP_MARKER words", () => {
    expect(STEP_MARKER).toEqual({ water: "Water first", next: "Next" });
  });
});

describe("findNextNode", () => {
  it("finds the named node in any domain", () => {
    expect(findNextNode(MAP)?.name).toBe("b1");
  });

  it("is null when done or when the code is not on the map", () => {
    expect(findNextNode({ ...MAP, next: { kind: "done" } })).toBeNull();
    expect(
      findNextNode({ ...MAP, next: { kind: "next", skillCode: "zz" } }),
    ).toBeNull();
  });
});

describe("labels", () => {
  it("atSaplingLine reads k of n at Sapling", () => {
    expect(atSaplingLine(0, 3)).toBe("0 of 3 at Sapling");
  });

  it("fadingLine is null at 0, singular at 1, plural above", () => {
    expect(fadingLine(0)).toBeNull();
    expect(fadingLine(1)).toBe("1 skill fading");
    expect(fadingLine(4)).toBe("4 skills fading");
  });

  it("domainHeaderLine shows the figure only when there is no checkpoint", () => {
    expect(
      domainHeaderLine(MAP.domains[0] as CourseMap["domains"][number]),
    ).toBe("0 of 1 at Sapling");
    expect(
      domainHeaderLine(MAP.domains[1] as CourseMap["domains"][number]),
    ).toBeNull();
  });

  it("nextStepReason explains water and next differently", () => {
    expect(nextStepReason("water")).toMatch(/fading/);
    expect(nextStepReason("next")).not.toMatch(/fading/);
  });

  it("nextStepReason does not send a fading skill to the Daily Walk (MF-0062 review, MF-0064)", () => {
    expect(nextStepReason("water")).not.toMatch(/Daily Walk/);
    expect(nextStepReason("water")).toMatch(/lesson/);
  });
});

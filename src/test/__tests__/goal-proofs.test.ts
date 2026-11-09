import { describe, expect, it } from "vitest";
import {
  checkGoalProofs,
  proofPart,
  successCriteriaBlocks,
} from "../../../scripts/lib/goal-proofs.mjs";

const goal = (...scs: string[]): string =>
  `---\nticket_id: MF-9999\n---\n\n## Objective\n\nX.\n\n## Success Criteria\n\n${scs.join("\n")}\n\n## Constraints\n\n- [ ] SC-9: not an SC (other section). Proof: \`src/nope.ts\`.\n`;

const base = {
  planText: null,
  verifyText: null,
  frozenText: null,
  scripts: new Set(["test", "gate:planning"]),
  exists: (path: string) => path.startsWith("src/exists"),
  isTrackedBasename: (name: string) => name === "tracked.test.ts",
};

const problems = (goalText: string | null, extra = {}) =>
  checkGoalProofs({ ...base, goalText, ...extra }).problems;

describe("successCriteriaBlocks", () => {
  it("keeps sub-bullets, blank lines and indented text inside an SC, and stops at the next section", () => {
    const blocks = successCriteriaBlocks(
      goal(
        "- [ ] SC-1: rule:",
        "  - a;",
        "",
        "  Proof: `src/exists/a.ts`.",
        "- [x] **SC-2** done. Proof: `pnpm test`.",
      ),
    );
    expect(blocks.map((b) => b.id)).toEqual(["SC-1", "SC-2"]);
    expect(blocks[0].text).toContain("Proof: `src/exists/a.ts`");
  });
});

describe("proofPart", () => {
  it("takes the text after the last Proof: outside backticks", () => {
    expect(proofPart("x `Proof:` y. Proof: `a` then Proof: `b`.")).toBe(
      " `b`.",
    );
    expect(proofPart("only `Proof:` in backticks")).toBeNull();
  });
});

describe("checkGoalProofs (rejected inputs, LOOP-PLAN Parsers table)", () => {
  it("no GOAL.md", () => {
    expect(problems(null)).toEqual(["cannot read GOAL.md"]);
  });
  it("FROZEN.json is not JSON", () => {
    expect(
      problems(goal("- [ ] SC-1: x. Proof: `pnpm test`."), {
        frozenText: "{",
      }),
    ).toEqual(["FROZEN.json is not valid JSON"]);
  });
  it("a FROZEN.json file entry without a path", () => {
    expect(
      problems(goal("- [ ] SC-1: x. Proof: `pnpm test`."), {
        frozenText: JSON.stringify({ files: [{ sha256: "x" }] }),
      }),
    ).toEqual(["FROZEN.json files[0] has no path"]);
    expect(
      problems(goal("- [ ] SC-1: x. Proof: `pnpm test`."), {
        frozenText: JSON.stringify({ files: "x" }),
      }),
    ).toEqual(["FROZEN.json files is not an array"]);
  });
  it("an SC without Proof:, or with Proof: only in backticks", () => {
    expect(problems(goal("- [ ] SC-1: x.", "- [ ] SC-2: `Proof:` y."))).toEqual(
      ["SC-1 has no Proof:", "SC-2 has no Proof:"],
    );
  });
  it("a duplicate SC id", () => {
    expect(
      problems(
        goal(
          "- [ ] SC-1: x. Proof: `pnpm test`.",
          "- [ ] SC-1: y. Proof: `pnpm test`.",
        ),
      ),
    ).toEqual(["SC-1 appears twice"]);
  });
  it("an SC bullet in another shape is named as unreadable, not read as no SC (MF-0052's `- **SC-1 Title.**`)", () => {
    expect(
      problems(goal("- **SC-1 Deterministic pack.** x. Proof: `pnpm test`.")),
    ).toEqual([
      "cannot read SC line (expected `- [ ] SC-n: …`): - **SC-1 Deterministic pack.** x. Proof: `pnpm test`.",
      "no Success Criteria found",
    ]);
  });
  it("a GOAL with no SC", () => {
    expect(problems("---\n---\n\n## Objective\n\nX.\n")).toEqual([
      "no Success Criteria found",
    ]);
  });
});

describe("checkGoalProofs (rules)", () => {
  it("(a) a missing path or untracked basename is named with its SC; placeholders are skipped", () => {
    expect(
      problems(
        goal(
          "- [ ] SC-1: x. Proof: `src/exists/a.ts:12`, `src/missing.ts`, `packs/<slug>/pack.yaml`, `src/**`, `a b`.",
          "- [ ] SC-2: y. Proof: `tracked.test.ts` and `untracked.test.tsx`.",
        ),
      ),
    ).toEqual([
      "SC-1: proof path src/missing.ts does not exist",
      "SC-2: proof test file untracked.test.tsx is not in git ls-files",
    ]);
  });
  it("(b) every frozen file must be named by path or basename in GOAL, LOOP-PLAN or LOOP-VERIFY", () => {
    const frozenText = JSON.stringify({
      files: [
        { path: "src/a/__tests__/in-goal.acceptance.test.ts" },
        { path: "src/b/__tests__/in-plan.acceptance.test.ts" },
        { path: "src/c/__tests__/nowhere.acceptance.test.ts" },
      ],
    });
    expect(
      problems(
        goal(
          "- [ ] SC-1: x. Proof: `pnpm test` over in-goal.acceptance.test.ts.",
        ),
        {
          frozenText,
          planText: "T1 owns src/b/__tests__/in-plan.acceptance.test.ts",
          verifyText: "",
        },
      ),
    ).toEqual([
      "frozen file src/c/__tests__/nowhere.acceptance.test.ts is named in no record (GOAL.md, LOOP-PLAN.md, LOOP-VERIFY.md)",
    ]);
  });
  it("(c) a pnpm script must exist; pnpm built-ins pass", () => {
    expect(
      problems(
        goal(
          "- [ ] SC-1: x. Proof: `pnpm check:nope`, `pnpm run gate:planning`, `pnpm exec biome`, `pnpm dlx x`, `pnpm vitest run`.",
        ),
      ),
    ).toEqual([
      "SC-1: proof command pnpm check:nope is not a package.json script",
    ]);
  });
  it("ignores SC-like lines outside the Success Criteria section", () => {
    expect(problems(goal("- [ ] SC-1: x. Proof: `pnpm test`."))).toEqual([]);
  });
});

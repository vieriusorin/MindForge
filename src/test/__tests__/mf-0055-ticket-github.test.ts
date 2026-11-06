/**
 * MF-0055: the decisions behind `pnpm ticket:github` (GOAL.md → GitHub issue + project) and the
 * `gate:planning` "See it yourself" rule. Expected values come from the ticket's SCs, not the code.
 */
import { describe, expect, it } from "vitest";
import { checkSeeItYourself } from "../../../scripts/lib/planning-check.mjs";
import {
  claimDecision,
  issueBody,
  issueTitle,
  milestoneFor,
  nextTicketId,
  parseGoal,
  progressComment,
  syncPlan,
} from "../../../scripts/lib/ticket-github.mjs";

const goalText = (front: string, body = ""): string =>
  `---\n${front}\n---\n\n${body}`;

const reservedFromRetro = goalText(
  [
    "ticket_id: MF-0041",
    "tier: normal                      # dev tooling",
    "stage: intake",
    "goal_status: reserved             # created by the MF-0036 retro",
    "builds_on: [MF-0016, MF-0036]",
  ].join("\n"),
  "> Reserved 2026-11-04 by the MF-0036 retro (Action 2). Not built until the user picks it up.\n\n## Objective\n\n**Today.** x.\n\n**End state.** `pnpm check:packs` gains a flaw-key rule. More text.\n\n## Proof cases\n- a\n",
);

describe("parseGoal", () => {
  it("reads front matter without trailing comments and folds the origin line into a parent", () => {
    const goal = parseGoal(reservedFromRetro);
    expect(goal).toMatchObject({
      id: "MF-0041",
      tier: "normal",
      stage: "intake",
      status: "reserved",
      statusKey: "reserved",
      dependsOn: ["MF-0016", "MF-0036"],
      parent: "MF-0036",
    });
  });

  it("maps every blocked-on-<owner> to blocked and unions depends_on with builds_on", () => {
    const goal = parseGoal(
      goalText(
        "ticket_id: MF-0020\nstage: design\ngoal_status: blocked-on-user  # infra\ndepends_on: [MF-0004, MF-0010]\nbuilds_on: [MF-0004, MF-0020]",
        "> Reserved 2026-11-04 from MF-0010 C-2 (user decision).\n",
      ),
    );
    expect(goal.statusKey).toBe("blocked");
    expect(goal.dependsOn).toEqual(["MF-0004", "MF-0010"]);
    expect(goal.parent).toBe("MF-0010");
  });

  it("knows the split-out and drafted-by origins, and no origin at all", () => {
    expect(
      parseGoal(
        goalText("ticket_id: MF-0019", "> Split out of MF-0005 in DESIGN.\n"),
      ).parent,
    ).toBe("MF-0005");
    expect(
      parseGoal(
        goalText(
          "ticket_id: MF-0050",
          "> Drafted 2026-11-05 by MF-0025 (user decision).\n",
        ),
      ).parent,
    ).toBe("MF-0025");
    expect(
      parseGoal(goalText("ticket_id: MF-0001", "## Objective\n\nx\n")).parent,
    ).toBeNull();
  });

  it("treats an unknown status as unknown, not as a guess", () => {
    expect(
      parseGoal(goalText("ticket_id: MF-0001\ngoal_status: done-ish"))
        .statusKey,
    ).toBeNull();
  });
});

describe("syncPlan: what GitHub shows per GOAL status", () => {
  const open = { isClosed: false, assignees: [] as string[] };
  const plan = (front: string, issue = open) =>
    syncPlan(parseGoal(goalText(`ticket_id: MF-0060\n${front}`)), issue);

  it("reserved → Todo + backlog label, nobody assigned", () => {
    expect(plan("stage: intake\ngoal_status: reserved")).toEqual({
      projectStatus: "Todo",
      stage: "Intake",
      label: "status: backlog",
      close: null,
      assignMe: false,
    });
  });

  it("in-progress with nobody assigned → In Progress and assign the person running it", () => {
    expect(plan("stage: build\ngoal_status: in-progress")).toMatchObject({
      projectStatus: "In Progress",
      stage: "Build",
      label: "status: in progress",
      assignMe: true,
    });
  });

  it("in-progress already assigned → no second assignee", () => {
    expect(
      plan("stage: build\ngoal_status: in-progress", {
        isClosed: false,
        assignees: ["vladstefanparvana"],
      }).assignMe,
    ).toBe(false);
  });

  it("blocked-on-user → Blocked; hand-off → In Review (Done waits for the merge)", () => {
    expect(
      plan("stage: design\ngoal_status: blocked-on-user").projectStatus,
    ).toBe("Blocked");
    expect(
      plan("stage: handoff\ngoal_status: complete-pending-manual-commit"),
    ).toMatchObject({
      projectStatus: "In Review",
      stage: "Hand-off",
      label: "status: in review",
      close: null,
    });
  });

  it("a reserved GOAL on an issue someone already holds changes nothing (stale branch copy)", () => {
    expect(
      plan("stage: intake\ngoal_status: reserved", {
        isClosed: false,
        assignees: ["vieriusorin"],
      }),
    ).toEqual({
      projectStatus: null,
      stage: null,
      label: null,
      close: null,
      assignMe: false,
    });
  });

  it("withdrawn → closed as not planned", () => {
    expect(plan("stage: intake\ngoal_status: withdrawn")).toMatchObject({
      projectStatus: "Done",
      close: "not planned",
    });
  });

  it("a closed issue (merged with Closes #N) stays closed and Done whatever the GOAL says", () => {
    expect(
      plan("stage: handoff\ngoal_status: complete-pending-manual-commit", {
        isClosed: true,
        assignees: [],
      }),
    ).toEqual({
      projectStatus: "Done",
      stage: "Hand-off",
      label: null,
      close: null,
      assignMe: false,
    });
  });
});

describe("claimDecision", () => {
  it("lets you claim an unassigned ticket or your own", () => {
    expect(claimDecision([], "Stefan-A-ddroidd", false)).toEqual({ ok: true });
    expect(
      claimDecision(["stefan-a-ddroidd"], "Stefan-A-ddroidd", false),
    ).toEqual({ ok: true });
  });

  it("refuses a ticket someone else holds unless forced", () => {
    const refused = claimDecision(["vieriusorin"], "vladstefanparvana", false);
    expect(refused.ok).toBe(false);
    expect(!refused.ok && refused.reason).toContain("vieriusorin");
    expect(claimDecision(["vieriusorin"], "vladstefanparvana", true)).toEqual({
      ok: true,
    });
  });
});

describe("nextTicketId", () => {
  it("is one past the highest id seen anywhere: folders, branch listings, issue titles", () => {
    expect(
      nextTicketId([
        "MF-0041",
        ".planning/tasks/MF-0054",
        "MF-0055: Ticket sync",
      ]),
    ).toBe("MF-0056");
  });
  it("starts at MF-0001 with nothing taken", () => {
    expect(nextTicketId(["README.md"])).toBe("MF-0001");
  });
});

describe("milestoneFor", () => {
  it("maps roadmap weeks to milestones and leaves an unplanned ticket alone", () => {
    expect(milestoneFor("W1")).toBe("W1–W2: Playable MVP");
    expect(milestoneFor("W1–W2")).toBe("W1–W2: Playable MVP");
    expect(milestoneFor("W3–W4")).toBe("W3: Exam practice");
    expect(milestoneFor("W4 (stretch: only if W3 is green)")).toBe(
      "W4: Stretch",
    );
    expect(milestoneFor("")).toBeNull();
  });
});

describe("issueTitle and issueBody", () => {
  it("prefers the GOAL title, then the existing issue title, then the end state's first sentence", () => {
    const goal = parseGoal(reservedFromRetro);
    expect(issueTitle({ ...goal, title: "Flaw-key rule" }, "old")).toBe(
      "MF-0041: Flaw-key rule",
    );
    expect(issueTitle(goal, "MF-0041: Kept")).toBe("MF-0041: Kept");
    expect(issueTitle(goal, null)).toBe(
      "MF-0041: pnpm check:packs gains a flaw-key rule",
    );
  });

  it("links the GOAL, names the origin, and never @-mentions anyone copied from the text", () => {
    const body = issueBody(
      parseGoal(
        goalText(
          "ticket_id: MF-0060",
          "> Split out of MF-0055.\n\n## Objective\n\nInstall @types/node.\n",
        ),
      ),
      "https://github.com/o/r/blob/main",
    );
    expect(body).toContain(
      "https://github.com/o/r/blob/main/.planning/tasks/MF-0060/GOAL.md",
    );
    expect(body).toContain("**Came from:** MF-0055");
    expect(body).not.toMatch(/@types/);
  });
});

describe("progressComment", () => {
  const goal = parseGoal(
    goalText("ticket_id: MF-0060\nstage: build\ngoal_status: in-progress"),
  );
  it("says what moved", () => {
    expect(
      progressComment({ stage: "design", status: "in-progress" }, goal),
    ).toBe(
      "Progress (from `.planning/tasks/MF-0060/GOAL.md`): stage `design` → `build`.",
    );
  });
  it("says nothing without an earlier record or when nothing moved", () => {
    expect(progressComment(undefined, goal)).toBeNull();
    expect(
      progressComment({ stage: "build", status: "in-progress" }, goal),
    ).toBeNull();
  });
});

describe("gate:planning — See it yourself (MF-0055)", () => {
  const handoff = (id: string) => ({
    dir: id,
    goalText: goalText(
      `ticket_id: ${id}\nstage: handoff\ngoal_status: complete-pending-manual-commit`,
    ),
  });

  it("fails a hand-off after MF-0054 whose evidence lacks the section or is missing", () => {
    const evidence: Record<string, string> = {
      "MF-0056": "# MF-0056 evidence\n\n## Checks\n",
    };
    expect(
      checkSeeItYourself(
        [handoff("MF-0056"), handoff("MF-0057")],
        (d) => evidence[d] ?? null,
      ),
    ).toEqual([
      'MF-0056: evidence has no "## See it yourself" section (URL, account and clicks per SC, or "n/a: <reason>")',
      "MF-0057: at hand-off but .planning/evidence/MF-0057.md is missing",
    ]);
  });

  it("passes with the section (including n/a), before the cutoff, and before hand-off", () => {
    const withSection =
      "# e\n\n## See it yourself\n\nn/a: script only, nothing on screen.\n";
    expect(
      checkSeeItYourself(
        [
          handoff("MF-0056"),
          handoff("MF-0054"),
          {
            dir: "MF-0058",
            goalText: goalText(
              "ticket_id: MF-0058\nstage: build\ngoal_status: in-progress",
            ),
          },
        ],
        () => withSection,
      ),
    ).toEqual([]);
    expect(checkSeeItYourself([handoff("MF-0054")], () => null)).toEqual([]);
  });
});

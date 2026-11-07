/**
 * MF-0062 acceptance (SC-6): the course map as a learner meets it. Given an engine `CourseMap`, the
 * view shows each domain, each skill node with its stage and health in words, exactly one next step,
 * a Start link to that node's mode, the Boss Storm checkpoints (exam packs only), and no XP, streak
 * or league (D-3). Links are what a tap opens; their targets are the start-node contract (SC-4).
 * Re-frozen by MF-0064 (U-2): Seed, Sprout and fading nodes are labelled and open "Lesson".
 */
import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { CourseMap as CourseMapData, CourseMapNode } from "@/engine/path";
import { renderWithProviders } from "@/test/render";
import { CourseMap } from "..";

function node(
  skillCode: string,
  name: string,
  rest: Partial<CourseMapNode>,
): CourseMapNode {
  return {
    skillCode,
    name,
    weight: 10,
    stage: "seed",
    wilting: false,
    isDone: false,
    mode: "plant",
    ...rest,
  };
}

const EXAM_MAP: CourseMapData = {
  packSlug: "ccdv-f",
  packName: "Claude Certified Developer",
  doneCount: 2,
  totalSkills: 5,
  wiltingSkills: 1,
  next: { kind: "water", skillCode: "2.1" },
  domains: [
    {
      domainCode: "D1",
      name: "Agentic architecture",
      weight: 30,
      doneCount: 2,
      skillCount: 2,
      checkpoint: { isReady: true },
      nodes: [
        node("1.1", "Agent loops", {
          stage: "sapling",
          isDone: true,
          mode: "duel",
        }),
        node("1.2", "Tool design", {
          stage: "tree",
          isDone: true,
          mode: "duel",
        }),
      ],
    },
    {
      domainCode: "D2",
      name: "Prompt engineering",
      weight: 70,
      doneCount: 0,
      skillCount: 3,
      checkpoint: { isReady: false },
      nodes: [
        node("2.1", "System prompts", {
          stage: "sprout",
          wilting: true,
          mode: "walk",
        }),
        node("2.2", "Few-shot examples", { stage: "sprout", mode: "plant" }),
        node("2.3", "Output formats", { stage: "seed", mode: "plant" }),
      ],
    },
  ],
};

const COURSE_MAP: CourseMapData = {
  packSlug: "ai-capabilities",
  packName: "AI Capabilities and Limitations",
  doneCount: 0,
  totalSkills: 2,
  wiltingSkills: 0,
  next: { kind: "next", skillCode: "c.1" },
  domains: [
    {
      domainCode: "C",
      name: "What models can do",
      weight: 100,
      doneCount: 0,
      skillCount: 2,
      checkpoint: null,
      nodes: [
        node("c.1", "Context windows", { stage: "seed", mode: "plant" }),
        node("c.2", "Hallucination", { stage: "seed", mode: "walk" }),
      ],
    },
  ],
};

const DONE_MAP: CourseMapData = {
  packSlug: "subagents",
  packName: "Subagents",
  doneCount: 2,
  totalSkills: 2,
  wiltingSkills: 0,
  next: { kind: "done" },
  domains: [
    {
      domainCode: "S",
      name: "Delegation",
      weight: 100,
      doneCount: 2,
      skillCount: 2,
      checkpoint: null,
      nodes: [
        node("s.1", "When to delegate", {
          stage: "sapling",
          isDone: true,
          mode: "duel",
        }),
        node("s.2", "Context hand-off", {
          stage: "ancient",
          isDone: true,
          mode: "duel",
        }),
      ],
    },
  ],
};

function section(name: string): HTMLElement {
  return screen.getByRole("region", { name });
}

describe("MF-0062 SC-6: the course map view", () => {
  it("SC-6: one section per domain, nodes in pack order with stage and health in words", () => {
    renderWithProviders(<CourseMap packSlug="ccdv-f" map={EXAM_MAP} />);
    const d1 = section("Agentic architecture");
    const d2 = section("Prompt engineering");
    expect(within(d1).getByText("Agent loops")).toBeTruthy();
    expect(within(d1).getAllByText("Done")).toHaveLength(2);
    expect(within(d1).getByText("Sapling")).toBeTruthy();
    expect(within(d1).getByText("Tree")).toBeTruthy();
    expect(within(d2).getByText("Fading")).toBeTruthy();
    expect(within(d2).getAllByText("Sprout")).toHaveLength(2);
    expect(within(d2).getByText("Seed")).toBeTruthy();
    const names = within(d2)
      .getAllByRole("link", {
        name: /^(Lesson|Scenario Duel): /,
      })
      .map((a) => a.getAttribute("aria-label") ?? a.textContent);
    expect(names).toEqual([
      "Lesson: System prompts",
      "Lesson: Few-shot examples",
      "Lesson: Output formats",
    ]);
  });

  it("SC-6: each node links to its mode through the start-node contract", () => {
    renderWithProviders(<CourseMap packSlug="ccdv-f" map={EXAM_MAP} />);
    expect(
      screen.getByRole("link", { name: "Scenario Duel: Agent loops" }),
    ).toHaveProperty("pathname", "/play/ccdv-f/duel");
    expect(
      screen.getByRole("link", { name: "Lesson: System prompts" }),
    ).toHaveProperty("pathname", "/play/ccdv-f/lesson/2.1");
    expect(
      screen.getByRole("link", { name: "Lesson: Output formats" }),
    ).toHaveProperty("pathname", "/play/ccdv-f/lesson/2.3");
  });

  it("SC-6: exactly one node carries Water first, and Start opens that node's mode", async () => {
    const { user } = renderWithProviders(
      <CourseMap packSlug="ccdv-f" map={EXAM_MAP} />,
    );
    expect(screen.getAllByText("Water first").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("Next")).toBeNull();
    const marked = screen
      .getAllByRole("listitem")
      .filter((li) => within(li).queryByText("Water first"));
    expect(marked).toHaveLength(1);
    expect(
      within(marked[0] as HTMLElement).getByText("System prompts"),
    ).toBeTruthy();
    const start = screen.getByRole("link", { name: /^Start/ });
    expect(start).toHaveProperty("pathname", "/play/ccdv-f/lesson/2.1");
    await user.tab();
    expect(document.activeElement).toBe(start);
  });

  it("SC-6: a Next step marks its node and Start opens the lesson for it", () => {
    renderWithProviders(
      <CourseMap packSlug="ai-capabilities" map={COURSE_MAP} />,
    );
    const marked = screen
      .getAllByRole("listitem")
      .filter((li) => within(li).queryByText("Next"));
    expect(marked).toHaveLength(1);
    expect(
      within(marked[0] as HTMLElement).getByText("Context windows"),
    ).toBeTruthy();
    expect(screen.queryByText("Water first")).toBeNull();
    expect(screen.getByRole("link", { name: /^Start/ })).toHaveProperty(
      "pathname",
      "/play/ai-capabilities/lesson/c.1",
    );
  });

  it("SC-6: an exam pack shows a Boss Storm checkpoint per domain, Ready or k of n at Sapling", () => {
    renderWithProviders(<CourseMap packSlug="ccdv-f" map={EXAM_MAP} />);
    const ready = screen.getByRole("link", {
      name: /Boss Storm: Agentic architecture/,
    });
    expect(ready).toHaveProperty("pathname", "/play/ccdv-f/storm/boss/D1");
    expect(
      within(section("Agentic architecture")).getByText("Ready"),
    ).toBeTruthy();
    const open = screen.getByRole("link", {
      name: /Boss Storm: Prompt engineering/,
    });
    expect(open).toHaveProperty("pathname", "/play/ccdv-f/storm/boss/D2");
    expect(
      within(section("Prompt engineering")).getByText("0 of 3 at Sapling"),
    ).toBeTruthy();
  });

  it("SC-6: a pack without an exam shows no checkpoint", () => {
    renderWithProviders(
      <CourseMap packSlug="ai-capabilities" map={COURSE_MAP} />,
    );
    expect(screen.queryByText(/Boss Storm/)).toBeNull();
  });

  it("SC-6: when every skill is done, no node is marked and the banner says so", () => {
    renderWithProviders(<CourseMap packSlug="subagents" map={DONE_MAP} />);
    expect(screen.getByText(/Every skill is at Sapling/)).toBeTruthy();
    expect(screen.queryByText("Next")).toBeNull();
    expect(screen.queryByText("Water first")).toBeNull();
  });

  it("SC-6 (D-3): no XP, streak or league anywhere on the map", () => {
    for (const map of [EXAM_MAP, COURSE_MAP, DONE_MAP]) {
      const { container, unmount } = renderWithProviders(
        <CourseMap packSlug={map.packSlug} map={map} />,
      );
      expect(container.textContent ?? "").not.toMatch(/\bXP\b|streak|league/i);
      unmount();
    }
  });
});

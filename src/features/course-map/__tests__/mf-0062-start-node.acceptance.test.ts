/**
 * MF-0062 acceptance (SC-4): the start-node contract. A node opens a mode that exists today, and
 * the URL is built in one place (`startNodeHref`). Re-frozen by MF-0064 (U-2): Seed, Sprout and fading
 * nodes now open the lesson for that skill; Sapling+ keeps the Duel. Each target route is checked on
 * disk under src/app/(app)/play/[packSlug]/.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  bossStormHref,
  NODE_MODE_LABEL,
  startNodeHref,
} from "@/features/course-map/utils/start-node";

const PLAY = join(process.cwd(), "src", "app", "(app)", "play", "[packSlug]");

describe("MF-0062 SC-4: startNodeHref and bossStormHref", () => {
  it("SC-4: plant opens the lesson for that skill, with the code URL-encoded", () => {
    expect(
      startNodeHref({ packSlug: "ccdv-f", skillCode: "1.2", mode: "plant" }),
    ).toBe("/play/ccdv-f/lesson/1.2");
    expect(
      startNodeHref({ packSlug: "demo", skillCode: "a b/c", mode: "plant" }),
    ).toBe("/play/demo/lesson/a%20b%2Fc");
  });

  it("SC-4: walk opens the lesson for that skill; duel opens the pack's Scenario Duel", () => {
    expect(
      startNodeHref({
        packSlug: "ai-capabilities",
        skillCode: "x",
        mode: "walk",
      }),
    ).toBe("/play/ai-capabilities/lesson/x");
    expect(
      startNodeHref({
        packSlug: "ai-capabilities",
        skillCode: "x",
        mode: "duel",
      }),
    ).toBe("/play/ai-capabilities/duel");
  });

  it("SC-4: the checkpoint opens that domain's Boss Storm", () => {
    expect(bossStormHref({ packSlug: "ccdv-f", domainCode: "D3" })).toBe(
      "/play/ccdv-f/storm/boss/D3",
    );
  });

  it("SC-4: each mode has a label, and every target route exists today", () => {
    expect(NODE_MODE_LABEL).toEqual({
      plant: "Lesson",
      walk: "Lesson",
      duel: "Scenario Duel",
    });
    for (const route of [
      ["lesson", "[skill]", "page.tsx"],
      ["duel", "page.tsx"],
      ["storm", "boss", "[domain]", "page.tsx"],
    ]) {
      expect(existsSync(join(PLAY, ...route))).toBe(true);
    }
  });
});

/**
 * MF-0062 acceptance (SC-4): the start-node contract. A node opens a mode that exists today, and
 * the URL is built in one place (`startNodeHref`) that MF-0064 will retarget. Each target route is
 * checked on disk under src/app/(app)/play/[packSlug]/.
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
  it("SC-4: plant opens Seed Planting for that skill, with the code URL-encoded", () => {
    expect(
      startNodeHref({ packSlug: "ccdv-f", skillCode: "1.2", mode: "plant" }),
    ).toBe("/play/ccdv-f/plant/1.2");
    expect(
      startNodeHref({ packSlug: "demo", skillCode: "a b/c", mode: "plant" }),
    ).toBe("/play/demo/plant/a%20b%2Fc");
  });

  it("SC-4: walk opens the pack's Daily Walk; duel opens its Scenario Duel", () => {
    expect(
      startNodeHref({
        packSlug: "ai-capabilities",
        skillCode: "x",
        mode: "walk",
      }),
    ).toBe("/play/ai-capabilities/walk");
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
      plant: "Seed Planting",
      walk: "Daily Walk",
      duel: "Scenario Duel",
    });
    for (const route of [
      ["plant", "[skill]", "page.tsx"],
      ["walk", "page.tsx"],
      ["duel", "page.tsx"],
      ["storm", "boss", "[domain]", "page.tsx"],
    ]) {
      expect(existsSync(join(PLAY, ...route))).toBe(true);
    }
  });
});

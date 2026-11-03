import { Bean, Leaf, Sprout, TreeDeciduous, TreePine } from "lucide-react";
import { describe, expect, it } from "vitest";
import {
  formatWeight,
  STAGE_HINT,
  STAGE_ICON,
  STAGE_LABEL,
} from "../forest-display";

describe("forest display vocabulary", () => {
  it("formats blueprint weights with one decimal", () => {
    expect(formatWeight(33.1)).toBe("33.1%");
    expect(formatWeight(11)).toBe("11.0%");
  });

  it("has an icon and a label for every stage", () => {
    expect(STAGE_ICON).toEqual({
      seed: Bean,
      sprout: Sprout,
      sapling: Leaf,
      tree: TreeDeciduous,
      ancient: TreePine,
    });
    expect(STAGE_LABEL.ancient).toBe("Ancient tree");
    expect(STAGE_LABEL.seed).toBe("Seed");
  });

  it("explains each stage with the spec thresholds (3 / 14 / 45 days)", () => {
    expect(STAGE_HINT.seed).toBe("Not recalled correctly yet");
    expect(STAGE_HINT.sapling).toBe("Remembered for 3+ days");
    expect(STAGE_HINT.tree).toBe("Remembered 14+ days and explained it back");
    expect(STAGE_HINT.ancient).toBe("Remembered 45+ days and survived a storm");
  });
});

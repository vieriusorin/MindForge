import { describe, expect, it } from "vitest";
import { connectionSentences } from "../utils";

describe("connectionSentences", () => {
  it("reads each arrow with node labels and its own label", () => {
    expect(
      connectionSentences(
        [
          { id: "A", label: "Hive" },
          { id: "B", label: "Bee" },
        ],
        [
          { from: "A", to: "B" },
          { from: "B", to: "A", label: "back" },
        ],
      ),
    ).toEqual(["Hive → Bee", "Bee → Hive (back)"]);
  });
});

import { describe, expect, it } from "vitest";
import { pathNoticeFor } from "../utils";

const PATHS = [
  { slug: "claude-developer", name: "Claude Developer" },
  { slug: "other", name: "Other" },
];

describe("pathNoticeFor", () => {
  it("names the chosen path when the kind is Path", () => {
    expect(
      pathNoticeFor({ kind: "path", pathSlug: "other", paths: PATHS }),
    ).toBe(
      "This group follows the Other path. Creating it starts the path for you, and joining starts it for each member.",
    );
  });

  it("says nothing for a pack group", () => {
    expect(
      pathNoticeFor({ kind: "pack", pathSlug: "other", paths: PATHS }),
    ).toBeNull();
  });

  it("says nothing while no listed path is chosen", () => {
    expect(
      pathNoticeFor({ kind: "path", pathSlug: "", paths: PATHS }),
    ).toBeNull();
  });
});

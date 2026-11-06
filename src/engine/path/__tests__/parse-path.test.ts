import { describe, expect, it } from "vitest";
import { parsePath } from "../parse-path";

const VALID = [
  "slug: demo",
  "name: Demo",
  "source: https://example.com/path",
  "courses:",
  "  - subagents",
  "",
].join("\n");

describe("parsePath", () => {
  it("parses a valid path", () => {
    expect(parsePath(VALID, "paths/demo.yaml")).toEqual({
      slug: "demo",
      name: "Demo",
      source: "https://example.com/path",
      courses: ["subagents"],
    });
  });

  it("names the source and the field when the source url isn't https", () => {
    expect(() =>
      parsePath(VALID.replace("https:", "http:"), "paths/demo.yaml"),
    ).toThrow(/^paths\/demo\.yaml: source /);
  });

  it("refuses an unknown key", () => {
    expect(() => parsePath(`${VALID}extra: 1\n`, "paths/demo.yaml")).toThrow(
      /paths\/demo\.yaml/,
    );
  });

  it("refuses a course slug that isn't kebab-case", () => {
    expect(() =>
      parsePath(VALID.replace("subagents", "Sub_Agents"), "paths/demo.yaml"),
    ).toThrow(/^paths\/demo\.yaml: courses\.0 /);
  });

  it("refuses an empty course list", () => {
    expect(() =>
      parsePath(
        VALID.replace("courses:\n  - subagents", "courses: []"),
        "x.yaml",
      ),
    ).toThrow(/^x\.yaml: courses /);
  });

  it("names the source when the text isn't YAML", () => {
    expect(() => parsePath("slug: [", "paths/broken.yaml")).toThrow(
      /^paths\/broken\.yaml: yaml /,
    );
  });

  it("names the root when the document isn't a mapping", () => {
    expect(() => parsePath("- a\n", "p.yaml")).toThrow(/^p\.yaml: \(root\) /);
  });
});

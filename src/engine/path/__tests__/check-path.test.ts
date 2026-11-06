import { describe, expect, it } from "vitest";
import { checkPath } from "../check-path";

const COUNTS: ReadonlyMap<string, number> = new Map([
  ["a", 3],
  ["b", 2],
  ["empty", 0],
]);

function yaml(courses: readonly string[]): string {
  return [
    "slug: demo",
    "name: Demo",
    "source: https://example.com/path",
    "courses:",
    ...courses.map((c) => `  - ${c}`),
    "",
  ].join("\n");
}

const check = (text: string) =>
  checkPath({ file: "paths/demo.yaml", text, packSkillCounts: COUNTS });

describe("checkPath", () => {
  it("returns nothing for a valid path", () => {
    expect(check(yaml(["a", "b"]))).toEqual([]);
  });

  it("returns the parse error, naming the file, for an invalid file", () => {
    expect(check("slug: demo\n")).toEqual([
      expect.stringMatching(/^paths\/demo\.yaml: /),
    ]);
  });

  it("reports a slug listed three times once", () => {
    expect(check(yaml(["a", "b", "a", "a"]))).toEqual([
      'paths/demo.yaml: path "demo" lists pack "a" twice',
    ]);
  });

  it("reports an unknown pack once, without a 0-skill line", () => {
    expect(check(yaml(["a", "nope"]))).toEqual([
      'paths/demo.yaml: path "demo" lists unknown pack "nope"',
    ]);
  });

  it("reports a pack with 0 skills", () => {
    expect(check(yaml(["empty"]))).toEqual([
      'paths/demo.yaml: path "demo" lists pack "empty" with 0 skills (a course needs at least one skill)',
    ]);
  });

  it("reports a duplicated unknown pack as unknown once and duplicate once", () => {
    expect(check(yaml(["x", "x"]))).toEqual([
      'paths/demo.yaml: path "demo" lists pack "x" twice',
      'paths/demo.yaml: path "demo" lists unknown pack "x"',
    ]);
  });
});

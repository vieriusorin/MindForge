import { describe, expect, it } from "vitest";
import { PackValidationError, parsePack } from "../load-pack";

const base = (domains: string): string => `
slug: t
name: T
kind: course
version: 1
domains:
${domains}`;

describe("parsePack", () => {
  it("wraps YAML syntax errors", () => {
    expect(() => parsePack("slug: [unclosed")).toThrow(PackValidationError);
    expect(() => parsePack("slug: [unclosed")).toThrow(/yaml:/);
  });

  it("rejects domain weights that do not sum to 100", () => {
    const yaml = base(`  - code: D1
    name: One
    weight: 90
    skills:
      - { code: D1.S1, name: A, weight: 90 }`);
    expect(() => parsePack(yaml)).toThrow(
      /domains: domain weights sum to 90\.00/,
    );
  });

  it("rejects a duplicate domain code", () => {
    const yaml = base(`  - code: D1
    name: One
    weight: 50
    skills:
      - { code: A, name: A, weight: 50 }
  - code: D1
    name: Two
    weight: 50
    skills:
      - { code: B, name: B, weight: 50 }`);
    expect(() => parsePack(yaml)).toThrow(
      /domains\.1\.code: duplicate domain code/,
    );
  });

  it("accepts rounding drift within 0.05", () => {
    const yaml = base(`  - code: D1
    name: One
    weight: 100
    skills:
      - { code: A, name: A, weight: 33.33 }
      - { code: B, name: B, weight: 33.33 }
      - { code: C, name: C, weight: 33.33 }`);
    expect(parsePack(yaml).domains[0]?.skills).toHaveLength(3);
  });

  it("requires exam metadata on exam packs", () => {
    const yaml = base(`  - code: D1
    name: One
    weight: 100
    skills:
      - { code: A, name: A, weight: 100 }`).replace(
      "kind: course",
      "kind: exam",
    );
    expect(() => parsePack(yaml)).toThrow(
      /exam: exam packs need exam metadata/,
    );
  });
});

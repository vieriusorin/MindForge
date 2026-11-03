import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadPackFile, parsePack } from "../load-pack";

const ROOT = process.cwd();
const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);

const VALID_SMALL = `
slug: tiny
name: Tiny
kind: course
version: 1
domains:
  - code: D1
    name: One
    weight: 60
    skills:
      - { code: D1.S1, name: A, weight: 40 }
      - { code: D1.S2, name: B, weight: 20 }
  - code: D2
    name: Two
    weight: 40
    skills:
      - { code: D2.S1, name: C, weight: 40 }
`;

describe("MF-0001 pack format and loader", () => {
  it("SC-1: CCDV-F pack loads with the exam guide blueprint", async () => {
    const pack = await loadPackFile(join(ROOT, "packs/ccdv-f/pack.yaml"));
    expect(pack.kind).toBe("exam");
    expect(pack.domains).toHaveLength(8);
    expect(pack.domains.flatMap((d) => d.skills)).toHaveLength(25);
    expect(
      Math.abs(sum(pack.domains.map((d) => d.weight)) - 100),
    ).toBeLessThanOrEqual(0.05);
    for (const d of pack.domains) {
      expect(
        Math.abs(sum(d.skills.map((s) => s.weight)) - d.weight),
      ).toBeLessThanOrEqual(0.05);
    }
    const d2 = pack.domains.find(
      (d) => d.name === "Applications and Integration",
    );
    expect(d2?.weight).toBe(33.1);
    expect(d2?.skills).toHaveLength(6);
    expect(pack.exam?.questions).toBe(53);
    expect(pack.exam?.passScaled).toBe(720);
  });

  it("SC-2a: rejects a skill with no weight, naming the path", () => {
    const bad = VALID_SMALL.replace(
      "{ code: D1.S1, name: A, weight: 40 }",
      "{ code: D1.S1, name: A }",
    );
    expect(parsePack(VALID_SMALL).slug).toBe("tiny");
    expect(() => parsePack(bad)).toThrow(/domains\.0\.skills\.0\.weight/);
  });

  it("SC-2b: rejects a duplicate skill code, naming the path", () => {
    const bad = VALID_SMALL.replace(
      "{ code: D2.S1, name: C, weight: 40 }",
      "{ code: D1.S1, name: C, weight: 40 }",
    );
    expect(() => parsePack(bad)).toThrow(/domains\.1\.skills\.0\.code/);
  });

  it("SC-2c: rejects skill weights that do not sum to the domain weight, naming the path", () => {
    const bad = VALID_SMALL.replace(
      "{ code: D1.S2, name: B, weight: 20 }",
      "{ code: D1.S2, name: B, weight: 25 }",
    );
    expect(() => parsePack(bad)).toThrow(/domains\.0\.skills/);
  });

  it("SC-3: a second, non-exam pack loads through the same loader", async () => {
    const pack = await loadPackFile(
      join(ROOT, "packs/team-onboarding-sample/pack.yaml"),
    );
    expect(pack.kind).toBe("onboarding");
    expect(pack.exam).toBeUndefined();
    expect(pack.domains).toHaveLength(2);
    expect(pack.domains.flatMap((d) => d.skills)).toHaveLength(5);
  });

  it("SC-4: engine source mentions no pack slug", () => {
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) {
          if (name !== "__tests__") walk(p);
        } else if (/ccdv|team-onboarding/i.test(readFileSync(p, "utf8"))) {
          offenders.push(p);
        }
      }
    };
    walk(join(ROOT, "src/engine"));
    expect(offenders).toEqual([]);
    // the contract must have something to check: the loader exists and is implemented
    expect(() => parsePack(VALID_SMALL)).not.toThrow();
  });
});

import { describe, expect, it } from "vitest";
import { seededRandom, shuffle } from "../seeded-random";

const take = (random: () => number, n: number) =>
  Array.from({ length: n }, () => random());

describe("seededRandom", () => {
  it("gives the same sequence for the same seed, and a different one for another seed", () => {
    expect(take(seededRandom(42), 5)).toEqual(take(seededRandom(42), 5));
    expect(take(seededRandom(42), 5)).not.toEqual(take(seededRandom(43), 5));
  });

  it("stays in [0, 1)", () => {
    for (const value of take(seededRandom(7), 1000)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe("shuffle", () => {
  it("returns a permutation and leaves its input untouched", () => {
    const items = Object.freeze(["a", "b", "c", "d", "e", "f"]);
    const out = shuffle(items, seededRandom(1));
    expect([...out].sort()).toEqual([...items]);
    expect(items).toEqual(["a", "b", "c", "d", "e", "f"]);
  });

  it("is deterministic for a seed", () => {
    const items = ["a", "b", "c", "d", "e", "f", "g", "h"];
    expect(shuffle(items, seededRandom(9))).toEqual(
      shuffle(items, seededRandom(9)),
    );
  });
});

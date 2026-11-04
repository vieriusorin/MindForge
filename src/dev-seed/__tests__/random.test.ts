import { describe, expect, it } from "vitest";
import { createRandom } from "../random";

describe("createRandom (seeded)", () => {
  it("repeats for the same seed and differs for another", () => {
    const a = createRandom(42);
    const b = createRandom(42);
    const c = createRandom(7);
    const seqA = [a.next(), a.next(), a.next()];
    expect([b.next(), b.next(), b.next()]).toEqual(seqA);
    expect([c.next(), c.next(), c.next()]).not.toEqual(seqA);
    for (const x of seqA) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it("int stays in range and pick returns a member", () => {
    const r = createRandom(1);
    for (let i = 0; i < 100; i++) {
      const n = r.int(3, 5);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(5);
    }
    expect(["x", "y"]).toContain(r.pick(["x", "y"]));
    expect(() => r.pick([])).toThrow();
  });
});

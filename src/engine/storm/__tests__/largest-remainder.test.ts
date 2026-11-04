import { describe, expect, it } from "vitest";
import { allocateSeats } from "../largest-remainder";

const open = (key: string, weight: number) => ({
  key,
  weight,
  capacity: Number.POSITIVE_INFINITY,
});

describe("allocateSeats (largest remainder)", () => {
  it("splits 53 seats by the ccdv-f domain weights: D1–D8 = 8/17/2/1/9/6/4/6", () => {
    const seats = allocateSeats(53, [
      open("D1", 14.7),
      open("D2", 33.1),
      open("D3", 3.1),
      open("D4", 2.6),
      open("D5", 16.8),
      open("D6", 11.0),
      open("D7", 8.1),
      open("D8", 10.6),
    ]);
    expect(Object.fromEntries(seats)).toEqual({
      D1: 8,
      D2: 17,
      D3: 2,
      D4: 1,
      D5: 9,
      D6: 6,
      D7: 4,
      D8: 6,
    });
  });

  it("gives a remainder tie to the earlier entry", () => {
    expect(
      Object.fromEntries(allocateSeats(1, [open("a", 1), open("b", 1)])),
    ).toEqual({
      a: 1,
      b: 0,
    });
    expect(
      Object.fromEntries(allocateSeats(1, [open("b", 1), open("a", 1)])),
    ).toEqual({
      b: 1,
      a: 0,
    });
  });

  it("re-allocates seats an entry cannot hold to entries with spare capacity", () => {
    const seats = allocateSeats(6, [
      { key: "a", weight: 1, capacity: 1 },
      { key: "b", weight: 1, capacity: 10 },
      { key: "c", weight: 1, capacity: 2 },
    ]);
    expect(Object.fromEntries(seats)).toEqual({ a: 1, b: 3, c: 2 });
  });

  it("stops when no capacity is left, placing fewer seats", () => {
    const seats = allocateSeats(5, [
      { key: "a", weight: 2, capacity: 1 },
      { key: "b", weight: 1, capacity: 2 },
    ]);
    expect(Object.fromEntries(seats)).toEqual({ a: 1, b: 2 });
  });

  it("gives nothing to a zero-weight entry", () => {
    const seats = allocateSeats(3, [open("a", 0), open("b", 1)]);
    expect(Object.fromEntries(seats)).toEqual({ a: 0, b: 3 });
  });
});

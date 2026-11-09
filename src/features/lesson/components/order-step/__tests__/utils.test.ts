import { describe, expect, it } from "vitest";
import {
  addedLine,
  canCheckOrder,
  focusAfterAdd,
  focusAfterRemove,
  orderVerdict,
  placedSteps,
  placeStep,
  removedLine,
  removeStep,
  unplacedSteps,
} from "../utils";

const STEPS = [
  { id: "RUN", label: "Run the tool" },
  { id: "REQ", label: "Send the request" },
  { id: "RES", label: "Send the result" },
];

describe("order step decisions (MF-0066)", () => {
  it("placeStep appends once and ignores a placed or unknown id", () => {
    expect(placeStep([], "REQ", STEPS)).toEqual(["REQ"]);
    expect(placeStep(["REQ"], "RUN", STEPS)).toEqual(["REQ", "RUN"]);
    expect(placeStep(["REQ"], "REQ", STEPS)).toEqual(["REQ"]);
    expect(placeStep(["REQ"], "XYZ", STEPS)).toEqual(["REQ"]);
  });

  it("removeStep takes one step out and keeps the rest in order", () => {
    expect(removeStep(["REQ", "RUN", "RES"], "RUN")).toEqual(["REQ", "RES"]);
    expect(removeStep(["REQ"], "RES")).toEqual(["REQ"]);
  });

  it("unplacedSteps keeps the shown order; placedSteps follows the learner's order", () => {
    expect(unplacedSteps(STEPS, ["REQ"]).map((s) => s.id)).toEqual([
      "RUN",
      "RES",
    ]);
    expect(placedSteps(STEPS, ["RES", "REQ"]).map((s) => s.label)).toEqual([
      "Send the result",
      "Send the request",
    ]);
  });

  it("canCheckOrder needs every step placed, no verdict and nothing pending", () => {
    const base = {
      stepCount: 3,
      placedCount: 3,
      isAnswered: false,
      isPending: false,
    };
    expect(canCheckOrder(base)).toBe(true);
    expect(canCheckOrder({ ...base, placedCount: 2 })).toBe(false);
    expect(canCheckOrder({ ...base, isAnswered: true })).toBe(false);
    expect(canCheckOrder({ ...base, isPending: true })).toBe(false);
    expect(canCheckOrder({ ...base, stepCount: 0, placedCount: 0 })).toBe(
      false,
    );
  });

  it("orderVerdict words the grade", () => {
    expect(orderVerdict(true)).toBe("Correct! That is the order.");
    expect(orderVerdict(false)).toBe("Not quite. Here is the order.");
  });
});

describe("order step focus and announcements (MF-0066 review)", () => {
  it("focusAfterAdd moves to the next step to place, else the previous, else Check order", () => {
    expect(focusAfterAdd(STEPS, "RUN")).toBe("add:REQ");
    expect(focusAfterAdd(STEPS, "RES")).toBe("add:REQ");
    expect(focusAfterAdd(STEPS.slice(1), "REQ")).toBe("add:RES");
    expect(focusAfterAdd(STEPS.slice(2), "RES")).toBe("check");
  });

  it("focusAfterRemove returns focus to the step's Add button", () => {
    expect(focusAfterRemove("REQ")).toBe("add:REQ");
  });

  it("addedLine and removedLine word each move", () => {
    expect(addedLine("Run the tool", 2, 4)).toBe(
      'Added "Run the tool" as step 2 of 4.',
    );
    expect(removedLine("Run the tool", 1, 4)).toBe(
      'Removed "Run the tool". 1 of 4 placed.',
    );
  });
});

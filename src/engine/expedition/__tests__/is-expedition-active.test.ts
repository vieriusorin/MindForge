import { describe, expect, it } from "vitest";
import { isExpeditionActive } from "@/engine/expedition";

const startsAt = new Date("2026-11-02T10:00:00.000Z");
const endsAt = new Date("2026-11-09T10:00:00.000Z");

describe("isExpeditionActive", () => {
  it("an open expedition is active from startsAt", () => {
    expect(isExpeditionActive({ startsAt, endsAt: null, now: startsAt })).toBe(
      true,
    );
  });

  it("an open expedition is not active before startsAt", () => {
    const now = new Date(startsAt.getTime() - 1000);
    expect(isExpeditionActive({ startsAt, endsAt: null, now })).toBe(false);
  });

  it("a bounded expedition is not active at endsAt (half-open window)", () => {
    expect(isExpeditionActive({ startsAt, endsAt, now: endsAt })).toBe(false);
  });

  it("a bounded expedition is active one second before endsAt", () => {
    const now = new Date(endsAt.getTime() - 1000);
    expect(isExpeditionActive({ startsAt, endsAt, now })).toBe(true);
  });
});

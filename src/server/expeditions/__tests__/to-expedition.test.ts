import { describe, expect, it } from "vitest";
import { toExpedition } from "../to-expedition";

const ROW = {
  id: "00000000-0000-4000-8000-000000000001",
  domain_code: "D1",
  target: 40,
  starts_at: "2026-11-03 09:00:00+00",
};

describe("toExpedition", () => {
  it("keeps an open expedition open: a null end stays null", () => {
    const expedition = toExpedition({ ...ROW, ends_at: null });
    expect(expedition.endsAt).toBeNull();
    expect(expedition.startsAt).toBe("2026-11-03T09:00:00.000Z");
  });

  it("maps a bounded expedition's end to an ISO timestamp", () => {
    const expedition = toExpedition({
      ...ROW,
      ends_at: "2026-11-10 09:00:00+02",
    });
    expect(expedition).toEqual({
      id: ROW.id,
      domainCode: "D1",
      target: 40,
      startsAt: "2026-11-03T09:00:00.000Z",
      endsAt: "2026-11-10T07:00:00.000Z",
    });
  });
});

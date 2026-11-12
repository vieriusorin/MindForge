// MF-0066 delta review D-1: the shown order must not let a learner recompute the key. Everything the browser
// receives (the shown steps, the order id) plus the learner's own user id and the public algorithm must not
// predict the key better than chance; only a server-only secret makes the layout.
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type OrderItem,
  orderSeed,
  type PlayableOrder,
  toPlayableOrder,
} from "@/engine/content";
import { toPlayerSteps } from "@/features/lesson/utils/to-player-steps";

vi.mock("server-only", () => ({}));
const { orderShuffleSeed, orderShuffleSeedWith } = await import(
  "../order-shuffle-seed"
);

const SECRET_A = "a".repeat(64);
const SECRET_B = "b".repeat(64);

const order: OrderItem = {
  id: "p.S1.order-five",
  skill: "S1",
  title: "Five steps",
  origin: "ai",
  diagram: "p.S1.diagram",
  steps: ["A", "B", "C", "D", "E"].map((n) => ({
    node: n,
    label: `step ${n}`,
  })),
  orderedBy: ["a", "b", "c", "d"],
  explanation: "Because.",
  source: { title: "Doc", url: "https://example.com" },
};
const KEY = order.steps.map((s) => s.node);
const USERS = Array.from({ length: 200 }, (_, i) => `user-${i}-${i * 7919}`);

/** What the page sends for this learner, through the app's seeding path. */
function shown(secret: string, userId: string): PlayableOrder {
  const [step] = toPlayerSteps({
    steps: [{ kind: "order", order }],
    hashes: { [order.id]: "h" },
    skillNames: new Map(),
    orderSeedOf: (orderId) => orderShuffleSeedWith(secret, userId, orderId),
  });
  if (step?.kind !== "order") throw new Error("no order step");
  return step.order;
}

/** The public attacker: replay the shuffle with the seed they can compute, then invert it. */
function attack(playable: PlayableOrder, userId: string): string[] {
  const placeholder: OrderItem = {
    ...order,
    steps: order.steps.map((_, i) => ({ node: `P${i}`, label: `step ${i}` })),
  };
  const perm = toPlayableOrder(
    placeholder,
    "h",
    orderSeed(userId, playable.id),
  ).steps.map((s) => Number(s.id.slice(1)));
  const key: string[] = [];
  perm.forEach((from, j) => {
    key[from] = playable.steps[j]?.id ?? "";
  });
  return key;
}

describe("order shuffle seed (server secret)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("the public seed no longer recovers the key: no better than chance over 200 learners", () => {
    const recovered = USERS.filter(
      (u) => attack(shown(SECRET_A, u), u).join() === KEY.join(),
    ).length;
    // Chance is 200 / 119 non-key layouts ≈ 2.
    expect(recovered).toBeLessThanOrEqual(10);
  });

  it("changing only the secret changes the shown order for most learners", () => {
    const changed = USERS.filter(
      (u) =>
        shown(SECRET_A, u)
          .steps.map((s) => s.id)
          .join() !==
        shown(SECRET_B, u)
          .steps.map((s) => s.id)
          .join(),
    ).length;
    expect(changed).toBeGreaterThanOrEqual(180);
  });

  it("stable for the same secret, learner and item, and never the key", () => {
    for (const u of USERS.slice(0, 50)) {
      expect(shown(SECRET_A, u)).toEqual(shown(SECRET_A, u));
      expect(shown(SECRET_A, u).steps.map((s) => s.id)).not.toEqual(KEY);
    }
  });

  it("orderShuffleSeed reads ORDER_SHUFFLE_SECRET; production refuses a missing or short secret", () => {
    vi.stubEnv("ORDER_SHUFFLE_SECRET", SECRET_A);
    expect(orderShuffleSeed("u1", order.id)).toBe(
      orderShuffleSeedWith(SECRET_A, "u1", order.id),
    );
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ORDER_SHUFFLE_SECRET", "");
    expect(() => orderShuffleSeed("u1", order.id)).toThrow(
      /ORDER_SHUFFLE_SECRET/,
    );
    vi.stubEnv("ORDER_SHUFFLE_SECRET", "short");
    expect(() => orderShuffleSeed("u1", order.id)).toThrow(
      /ORDER_SHUFFLE_SECRET/,
    );
  });
});

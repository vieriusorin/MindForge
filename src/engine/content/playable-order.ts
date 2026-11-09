import type { OrderItem, PlayableOrder } from "./types";

/** mulberry32: a small seeded PRNG, so the engine stays free of ambient randomness. */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates over a copy, driven by `next`. */
function shuffle<T>(items: readonly T[], next: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    const tmp = out[i] as T;
    out[i] = out[j] as T;
    out[j] = tmp;
  }
  return out;
}

const MAX_RESHUFFLES = 16;

/**
 * MF-0066 SC-3: the pre-answer view of an order, bound to the version the learner reads. Fields are picked
 * one by one, never spread, so a key field can't leak by default. Steps are shown in a permutation seeded by
 * `seed` (in production `orderShuffleSeed`, a server-secret HMAC; `orderSeed` only in tests) that is never the key: a shuffle that lands on the key
 * is shuffled again; after 16 tries (odds below 1 in 6^16 for 3 steps) the key's first two steps swap.
 */
export function toPlayableOrder(
  order: OrderItem,
  contentHash: string,
  seed: number,
): PlayableOrder {
  const key = order.steps.map((s) => ({ id: s.node, label: s.label }));
  const isKey = (xs: readonly { id: string }[]): boolean =>
    xs.every((s, i) => s.id === key[i]?.id);
  const next = prng(seed);
  let steps = shuffle(key, next);
  for (let i = 0; i < MAX_RESHUFFLES && isKey(steps); i++)
    steps = shuffle(key, next);
  if (isKey(steps))
    steps = [key[1], key[0], ...key.slice(2)].filter((s) => s !== undefined);
  return {
    id: order.id,
    skillCode: order.skill,
    origin: order.origin,
    title: order.title,
    steps,
    contentHash,
  };
}

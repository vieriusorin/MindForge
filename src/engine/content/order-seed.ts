/**
 * MF-0066 review: the seed for the order a learner first sees an order item in. Stable per learner and item
 * (FNV-1a 32-bit of `userId`, a NUL, then `orderId`), so a reload shows the same layout, two learners
 * usually see different ones, and nothing about the key goes into it. Its inputs are public, so it is for tests
 * and fixtures only: production seeds come from `orderShuffleSeed` (src/server/content/order-shuffle-seed.ts,
 * HMAC with a server secret), or a learner could recompute the shown order's key (MF-0066 review D-1).
 */
export function orderSeed(userId: string, orderId: string): number {
  let hash = 0x811c9dc5;
  for (const ch of `${userId}\u0000${orderId}`) {
    hash ^= ch.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

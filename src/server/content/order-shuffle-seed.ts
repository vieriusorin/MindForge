import "server-only";
import { createHmac } from "node:crypto";
import { z } from "zod";

/**
 * MF-0066 delta review D-1: ORDER_SHUFFLE_SECRET (server-only) keys the seed of an order item's shown
 * permutation. A seed made from public inputs (the learner's own user id and the order id) lets anyone with the
 * public algorithm invert the shuffle and read the key off the shown order. At least 32 characters; production
 * refuses to run without it, elsewhere a fixed local value keeps dev and tests working. Never NEXT_PUBLIC_.
 */
const ShuffleSecret = z
  .string()
  .trim()
  .min(32, "ORDER_SHUFFLE_SECRET must be at least 32 characters");

const LOCAL_SECRET = "mindforge-local-order-shuffle-secret-not-for-production";

function shuffleSecret(): string {
  const raw = process.env.ORDER_SHUFFLE_SECRET;
  if (!raw && process.env.NODE_ENV !== "production") return LOCAL_SECRET;
  const parsed = ShuffleSecret.safeParse(raw ?? "");
  if (!parsed.success)
    throw new Error(
      `ORDER_SHUFFLE_SECRET is missing or invalid (server-only; see .env.example): ${parsed.error.issues[0]?.message ?? "invalid"}`,
    );
  return parsed.data;
}

/** The seed for one learner's view of one order: the first 32 bits of HMAC-SHA256(secret, "<user>:<order>"). */
export function orderShuffleSeedWith(
  secret: string,
  userId: string,
  orderId: string,
): number {
  return createHmac("sha256", secret)
    .update(`${userId}:${orderId}`)
    .digest()
    .readUInt32BE(0);
}

/** The app's seed for one learner's view of one order, keyed by ORDER_SHUFFLE_SECRET. */
export function orderShuffleSeed(userId: string, orderId: string): number {
  return orderShuffleSeedWith(shuffleSecret(), userId, orderId);
}

import { createHash } from "node:crypto";

/** Object keys sorted at every depth; arrays keep their order (order is content). */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((k) => [k, canonical((value as Record<string, unknown>)[k])]),
    );
  }
  return value;
}

/** SHA-256 (hex) of the item's canonical JSON: object keys sorted at every depth, arrays kept in order. */
export function contentHash(item: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonical(item)))
    .digest("hex");
}

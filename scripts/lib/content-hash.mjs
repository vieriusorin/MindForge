// MF-0007: mirror of src/engine/content/hash.ts for the plain-node sync script (no TS import at
// deploy time). The MF-0007 SC-1 DB test compares both on every item, so drift fails a test.
import { createHash } from "node:crypto";

/** Object keys sorted at every depth; arrays keep their order (order is content). */
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((k) => [k, canonical(value[k])]),
    );
  }
  return value;
}

/** SHA-256 (hex) of the item's canonical JSON. */
export function contentHash(item) {
  return createHash("sha256")
    .update(JSON.stringify(canonical(item)))
    .digest("hex");
}

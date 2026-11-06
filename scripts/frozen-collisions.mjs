#!/usr/bin/env node
// MF-0043: `pnpm ticket:collisions <ID>`. Run at DESIGN / PLAN once LOOP-PLAN.md lists its `## Symbols changed`.
// Prints every frozen-file line that uses a changed symbol and is not listed under
// "Frozen files this will re-freeze". Exit 0 clean, 1 unlisted collisions, 2 bad input. Read-only.

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { checkFrozenCollisions } from "./lib/frozen-collisions.mjs";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const ticket = process.argv[2];

if (!ticket || ticket.startsWith("-")) {
  console.error(
    "usage: pnpm ticket:collisions <ID>   e.g. pnpm ticket:collisions MF-0043",
  );
  process.exit(2);
}

const result = checkFrozenCollisions({ root: ROOT, ticket });
for (const hit of result.hits)
  console.log(`${hit.path}:${hit.line}  ${hit.symbol}`);
if (result.code === 2) console.error(`ticket:collisions: ${result.message}`);
else console.log(`ticket:collisions: ${result.message}`);
process.exit(result.code);

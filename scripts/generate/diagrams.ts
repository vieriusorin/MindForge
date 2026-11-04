/**
 * MF-0014: diagrams for every skill without one. Run before `generate:cards`. See `items.ts`.
 *
 * Usage: pnpm generate:diagrams [--pack ccdv-f] [--skill D2.S1] [--dry-run]
 */
import { DIAGRAM_CLI, main } from "./items";

main(DIAGRAM_CLI);

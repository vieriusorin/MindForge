import { z } from "zod";

/**
 * MF-0031: who an item is pitched at. `foundation` = what it is and when to use it (junior),
 * `practitioner` = apply it to a scenario (mid), `expert` = failure modes and trade-offs (senior).
 * Optional on every item type; existing packs carry none.
 */
export const ITEM_LEVELS = ["foundation", "practitioner", "expert"] as const;

export const LevelSchema = z.enum(ITEM_LEVELS);

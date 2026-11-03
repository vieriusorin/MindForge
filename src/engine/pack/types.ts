import type { z } from "zod";
import type { PackSchema } from "./schema";

/** The schema owns the shape; these names are the engine's vocabulary for it. */
export type Pack = z.infer<typeof PackSchema>;
export type PackKind = Pack["kind"];
export type PackDomain = Pack["domains"][number];
export type PackSkill = PackDomain["skills"][number];
export type PackExamMeta = NonNullable<Pack["exam"]>;

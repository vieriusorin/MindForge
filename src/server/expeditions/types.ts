import { z } from "zod";

/** MF-0017: `public.latest_expedition` returns 0 or 1 of these rows. */
export const LatestExpeditionRows = z.array(
  z.object({
    id: z.uuid(),
    domain_code: z.string().min(1),
    target: z.number().int(),
    starts_at: z.string(),
    ends_at: z.string(),
  }),
);

/** The card's expedition: only the fields it shows (no creator, no per-member data). */
export interface Expedition {
  readonly id: string;
  readonly domainCode: string;
  readonly target: number;
  /** ISO timestamps: the DTO crosses into client props, where Dates are not allowed. */
  readonly startsAt: string;
  readonly endsAt: string;
}

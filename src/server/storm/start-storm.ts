import "server-only";
import { randomInt } from "node:crypto";
import {
  composeBossStorm,
  composeFullStorm,
  type StormKind,
  type StormPlan,
} from "@/engine/storm";
import type { ActionResult } from "@/lib/action-result";
import { getItemHashes } from "@/server/content/get-item-hashes";
import { getReviewContext } from "@/server/content/get-review-context";
import { getPack } from "@/server/packs/get-pack";
import { getPackQuestions } from "@/server/questions/get-pack-questions";
import { createServerSupabase } from "@/server/supabase/server";
import { buildStormCandidates } from "./build-storm-candidates";
import { listMySeenStormQuestionIds } from "./list-my-seen-storm-question-ids";

/** Why a storm did not start. Each caller words it for its own screen. */
export const STORM_START_ERRORS = [
  "no-questions",
  "already-running",
  "content-changed",
  "not-ready",
] as const;
export type StartStormError = (typeof STORM_START_ERRORS)[number];

export interface StartStormForInput {
  userId: string;
  packSlug: string;
  kind: StormKind;
  /** Required for a Boss Storm, null for a Full Storm. */
  domainCode: string | null;
}

/** start_storm's SQLSTATEs that are an outcome for the learner, not an infrastructure failure. */
const START_ERROR_BY_SQLSTATE: Readonly<Record<string, StartStormError>> = {
  "23505": "already-running",
  "55000": "content-changed",
  "22023": "not-ready",
};

/**
 * MF-0013: composes a storm for the learner on the server (randomness at this edge), then asks
 * the DATABASE to start it; the DB validates the composition and owns the clock. Callers have
 * already authenticated and parsed the input. Throws on an unexpected database error.
 */
export async function startStormFor({
  userId,
  packSlug,
  kind,
  domainCode,
}: StartStormForInput): Promise<
  ActionResult<{ stormId: string }, StartStormError>
> {
  const [pack, questions, review, hashes, seen] = await Promise.all([
    getPack(packSlug),
    getPackQuestions(packSlug),
    getReviewContext(userId, packSlug),
    getItemHashes(packSlug),
    listMySeenStormQuestionIds(userId),
  ]);
  if (!pack.exam) return { ok: false, error: "not-ready" };

  const pool = buildStormCandidates({ questions, review, hashes, seen });
  const seed = randomInt(0, 2 ** 31);
  let plan: StormPlan;
  if (kind === "full") {
    if (domainCode !== null) return { ok: false, error: "not-ready" };
    plan = composeFullStorm({ pack, pool, seed });
  } else {
    if (domainCode === null || !pack.domains.some((d) => d.code === domainCode))
      return { ok: false, error: "not-ready" };
    plan = composeBossStorm({ pack, domainCode, pool, seed });
  }
  if (plan.questions.length === 0) return { ok: false, error: "no-questions" };

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("start_storm", {
    p_pack_slug: packSlug,
    p_kind: kind,
    // A Full Storm omits the domain (`p_domain_code text default null`).
    ...(domainCode === null ? {} : { p_domain_code: domainCode }),
    p_questions: plan.questions.map((q) => ({
      question_id: q.id,
      content_hash: hashOf(hashes, q.id),
    })),
  });
  if (error) {
    const known = START_ERROR_BY_SQLSTATE[error.code];
    if (known) return { ok: false, error: known };
    throw new Error(`startStormFor: ${error.message}`);
  }
  return { ok: true, stormId: data };
}

function hashOf(hashes: Readonly<Record<string, string>>, id: string): string {
  const hash = hashes[id];
  // buildStormCandidates keeps only hashed questions, so a miss is a bug, not an outcome.
  if (hash === undefined) throw new Error(`startStormFor: no hash for "${id}"`);
  return hash;
}

/** MINDFORGE §2.8: Sonnet writes, Opus verifies. Ids from the claude-api skill (2026-11-04). */
export const WRITER_MODEL = "claude-sonnet-5-5";
export const VERIFIER_MODEL = "claude-opus-5-5";

/** GOAL "Decided": 20 questions per skill in total (G3 needs 15 approved; some get rejected). */
export const TARGET_PER_SKILL = 20;

/** Ask for 25% more drafts than needed so that `need` survive verification. */
export const OVERGENERATION = 1.25;

/** Room for adaptive thinking plus one question's JSON. */
export const MAX_TOKENS = 16_000;

/** The Message Batches `custom_id` pattern (API reference, 2026-11-04). */
export const BATCH_CUSTOM_ID = /^[a-zA-Z0-9_-]{1,64}$/;

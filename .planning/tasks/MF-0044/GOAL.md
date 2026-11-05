---
ticket_id: MF-0044
tier: normal                      # dev tooling: an offline content check; no app code, no DB
stage: intake
goal_status: reserved             # created by the MF-0042 retro (gate action); never built automatically
builds_on: [MF-0036, MF-0042]
---

> Reserved 2026-11-04 by the MF-0042 retro (Action 1). Not built until the user picks it up.

## Objective

**Today.** Nothing checks that a question's key is not the longest option. On MF-0042, 10 of 32 verifier FIX were
"key ≥ 1.15× the longest distractor", a tell a test-wise learner can use. The drafting brief said "similar length",
and the frozen course-pack acceptance test has no such rule, so the drafters' own runs never failed on it.
A read-only measure over shipped packs (MF-0042 retro): ccdv-f 44 of 53 questions, prod-prompting 28 of 54,
platform-foundations 2 of 54; agent-skills, ai-capabilities, subagents, claude-code-in-action 0.

**End state.** `pnpm check:packs` (`scripts/check-pack-grounding.mjs`) gains a key-length rule that needs no
corpus, so it runs before the `if (!existsSync(CORPUS))` early exit: for every `select: 1` question in
`packs/<slug>/questions/*.yaml`, fail when `len(key.text) / max(len(distractor.text)) >= 1.15`, printing the
question id, the key length and the longest distractor length. `GRANDFATHERED_PACKS = new Set(["ccdv-f",
"prod-prompting", "platform-foundations"])` is skipped with one summary line until retrofitted.

## Proof cases

- A temp fixture pack under `MF_PACKS_DIR`: a key at 1.20× fails, a key at 1.10× passes, a grandfathered slug is
  skipped. Test modelled on `mf-0036-cuckoo-grounding.acceptance.test.ts`.
- `claude-code-in-action` (66 questions, 0 hits) passes as shipped.

## Open questions

- Threshold 1.15× and character length (not words): confirm with the user, or make it a constant with a reason.
- Per the MF-0036 retro skill rule: probe the drafted rule read-only against the proof case and every shipped pack
  before freezing; list the hits as findings.
- Retrofit plan for ccdv-f and prod-prompting (a content ticket each, or one), then delete the grandfather set.

---
ticket: MF-0048
outcome: pass
causes: known-trap-repeated, wrong-plan, missing-context
actions: skill-edit, gate
lesson_keys: gate-parser-fail-closed, reserved-ticket-premise-recheck, plan-names-exact-semantics-and-bruteforce
applied: 2026-11-06
---
## Numbers
(No `pnpm ticket:retro` script exists; counted by hand.)
- REVIEW.md: 2 rounds. Round 1 blocking: B1 (owns syntax shipped as a blocklist), B2 (main-session exemption ran before the syntax check). Round 2: both fixed, no new blockers.
- Overlap algorithm: first-time right, brute-forced over 3.1M pairs, 0 false negatives.
- Premise recheck at pickup: reserved GOAL assumed `validatePlan` runs before BUILD; nothing calls it (F-1..F-4).
- Out-of-scope follow-ups from review: 3 (`.git` not in NEVER; `scopeDecision` case-sensitive on Windows; `evaluateTicket` owns check ignores braces).
- Changed set: `scripts/lib/ticket-eval.mjs`, `.claude/hooks/lib/agent-scopes.mjs`, 2 test files.

## Went right
- The plan named an exact overlap semantics and a brute-force cross-check test, so the hardest part (the overlap algorithm) had no review finding. — keep: add to `verification.md` §4 (Action 1) as the model for the primary algorithm.
- Pickup re-derived the reserved GOAL's facts and found that `validatePlan` is never called, before building on it. — keep: already is: `reserved-ticket-premise-recheck`.
- Overlap with another contributor's MF-0060 went to the user and was settled as "library only". — keep: already is: `escalation.md`.

## Went wrong
- B1 and B2 are the same two traps `verification.md` §4 already names (blocklist parser, MF-0046; exemption skipping the structure check, MF-0044). The plan applied them to the main algorithm and not to the secondary parser (the `owns` syntax) in the same file. Third occurrence of `gate-parser-fail-closed` (MF-0043, MF-0044/0046, MF-0048). The rule is prose in a reference that the planner reads once, and it is keyed on "a gate or check script", not on "every parser inside it". cause: known-trap-repeated, wrong-plan.
- The reserved GOAL's premise (validatePlan runs before BUILD) was false. It was caught, but only because pickup re-derived facts by hand. cause: missing-context (already recorded under `reserved-ticket-premise-recheck`; not repeated here).

## Actions (at most two)
1. gate: new reserved ticket. Id-free GOAL title: "Plan lint: a plan that adds or changes a parser must carry an accepted grammar and a rejected-inputs table".
   Build `pnpm ticket:plan-lint <ID>` in `scripts/ticket-plan-lint.mjs` (pure core in `scripts/lib/ticket-eval.mjs`, wired next to `ticket:collisions` in `package.json`, and called from the Stage 4 checklist in `SKILL.md`). It reads `.planning/tasks/<ID>/LOOP-PLAN.md` and the planned file list. If any planned file is under `scripts/`, `.claude/hooks/` or `src/engine/` and its path or the plan text matches `/pars(e|er)|check-|gate|exempt|allowlist|grandfather/i`, the plan must contain a `## Parsers` section with, per parser: (a) an `Accepted grammar` line, (b) a `Rejected inputs` table with at least 3 rows, (c) an `Exempt-path test` row stating the same malformed item inside the exempt set must still fail. Missing or empty section exits non-zero naming the parser. It must fail closed on its own input (unknown section shapes are errors). Real case it would have caught: MF-0048 LOOP-PLAN, which listed the overlap semantics but no grammar for `owns` syntax and no exempt-path test (review B1 and B2). Also wire the existing `validatePlan` call into it so the F-1 premise (nothing calls it) is closed in the same ticket.
   Would have saved: review round 2 of MF-0048, and the third repeat of MF-0043, MF-0046 and MF-0048 review loops (about 2 to 3 rounds each).
2. skill-edit: `.claude/skills/gsd-goal-loop/references/templates.md`, LOOP-PLAN template, insert after the `## Frozen files this will re-freeze` table and before `## SC coverage`:
   ```
   ## Parsers (omit only when no parser, gate or exemption is added or changed)

   <one block per parser, INCLUDING secondary parsers inside a larger change (an `owns:` list, a path pattern, a header
   line), not only the main algorithm. Accepted grammar: <the exact line or token shapes accepted; everything else is an
   error naming the input>. Rejected inputs: <table: input, expected error, test file>. Exempt-path test: <the same
   malformed item inside an exempt set / main-session / grandfather list must still fail; the shape check runs before
   the skip>. Cross-check: <a brute-force or property test against a naive oracle for the main algorithm, as MF-0048 did
   with 3.1M pairs>. See `verification.md` §4.>
   ```
   Interim until Action 1 lands: this section is the only place the §4 rule is in front of the planner when the plan is written.
   Would have saved: MF-0048 review round 1 blockers B1 and B2 (one review round and the rework).

## Not worth changing
- Follow-up 1: `.git` missing from NEVER. Own small ticket if wanted; not a pattern.
- Follow-up 2: `scopeDecision` is case-sensitive on Windows. Platform-specific; note in the follow-up ticket.
- Follow-up 3: `evaluateTicket` owns check ignores braces. Same follow-up ticket as 1 and 2.
- Overlap with MF-0060: resolved by a user decision; the collision case is already covered by `reserved-ticket-premise-recheck`.

## Applied

- 2026-11-06 gate → reserved ticket `.planning/tasks/MF-0069/GOAL.md` (issue #105): plan lint requiring a Parsers
  section (accepted grammar, rejected inputs, exempt-path test). Not built.
- 2026-11-06 skill-edit (additive) → `.claude/skills/gsd-goal-loop/references/templates.md`: LOOP-PLAN `## Parsers`
  section between "Frozen files this will re-freeze" and "SC coverage".
- Held: nothing.

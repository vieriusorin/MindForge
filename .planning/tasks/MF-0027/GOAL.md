---
ticket_id: MF-0027
tier: normal
stage: handoff
builds_on: [MF-0003, MF-0007]
last_iteration: 0
goal_status: complete-pending-manual-commit
---

> Renumbered MF-0023 → MF-0027 on 2026-11-04 by MF-0014 (user decision C-2: a merge had concatenated this file with MF-0023's original ticket). Drafted 2026-11-04 by MF-0012 (user decision C-3), from the MF-0003 review note "learn the key from
> the feedback, then answer it". Picked up 2026-11-05.

## Objective

**Today.** Every mode shows the key after a graded answer, correct or wrong: Duel (all rationales),
Daily Walk, seed checks, storm review. A learner who meets the same question again can answer from
memory of that reveal, and the correct answer grows the skill's tree like any other recall.

**End state.** One recorded decision (an ADR in `docs/adr/` plus the matching CONTEXT.md term): either
answers after a reveal count as recall, or a correct answer to a question whose key was shown within
N days is discounted. If the decision is a discount, the code change is a follow-up ticket (it changes
displayed figures, so high-risk), not this one.

## Affected users and surfaces

Learners (their own forest, readiness weather, storm-proof); groups indirectly (heatmap and
Expedition read the same countable attempts). Code that a discount would touch:
`src/engine/memory/countable.ts` (already drops Spoiled attempts), `replay.ts`.

## Facts (gathered 2026-11-05, read-only)

1. **Memory is per skill, not per question.** `memoryBySkill` replays all of a skill's attempts as one
   FSRS card (`src/engine/memory/memory-by-skill.ts`).
2. **Question banks are small.** Questions per skill: CCDV-F 2 (22 skills) or 3 (3 skills); every other
   pack 6. A "covered skill" needs 15 (CONTEXT.md, goal G3); none is covered today.
3. **Repeats are frequent.** Duel and Walk serve the least-recently-seen question of a skill
   (`least-recently-seen.ts`), so on CCDV-F the same question comes back every 2nd or 3rd time the
   skill is served.
4. **The MF-0003 note understates it.** "Sprout only (stability ≈ 2.3)" holds for one reveal then one
   correct answer. Repeated cycles on revealed keys grow further (ts-fsrs 5.4.2, fuzz off, probed
   2026-11-05): Again d0, Good d2 → S 2.43 (sprout); + Good d6 → S 9.69 (sapling); + Good d14 →
   S 24.0 (tree threshold met, needs storm proof); + Good d30 → S 50.0 (ancient threshold met, needs
   Full Storm proof). Storms draw from the same bank, so storm proof is also reachable on remembered keys.
5. **Precedent: Spoiled.** Reviewing a question shows its key without a retrieval, and the learner's
   later attempts on it never count (CONTEXT.md, MF-0007 `countableAttempts`). A reveal after a graded
   answer is feedback on a retrieval, which is a different event.
6. **A naive discount stalls CCDV-F.** A daily player sees q1 d0, q2 d1, q1 d2…: with N = 7 almost every
   attempt after the first pass would be discounted until the banks grow.

## Constraints

- MINDFORGE.md principle 1: every visible reward comes from measured recall.
- Displayed figures come from `src/engine/**` (a discount would live in `countableAttempts`).
- Must not contradict the Spoiled rule; the ADR states how the two differ or merge.

## Out of Scope

- Implementing a discount (follow-up ticket if chosen). Growing the question banks (pack tickets).

## Open questions

- Q-1: answered 2026-11-05 (see Decided by the user).

## Success Criteria

- [x] SC-1: `docs/adr/0005-*.md` records the decision, the facts above it rests on, and the residual
  risk. Proof: the file exists and quotes the user's choice.
- [x] SC-2: CONTEXT.md defines the term the ADR uses (e.g. **Revealed**) next to **Spoiled**, and the two
  definitions do not contradict. Proof: read-back.
- [x] SC-3: if the choice is a discount, a reserved follow-up ticket GOAL.md exists with its SCs and an
  edge-input table drafted; if not, none. Proof: `ls .planning/tasks/`.

Docs-only: no acceptance test, no code; VERIFY is `pnpm lint` (Biome ignores .md) plus read-back.

## Decided by the user

- 2026-11-05 · Q-1: "Count it". Answers after a reveal count as recall; no discount, no follow-up ticket. Recorded in ADR 0005 and CONTEXT.md **Revealed**.

## Decided without a question

- Ticket number free: the same single GOAL.md on every branch (`git grep`, 2026-11-05).
- Tier stays normal: this ticket ships a decision record only; any code change is a separate high-risk ticket.

## Iteration Log

- 2026-11-05 · intake/design · facts gathered; Q-1 put to the user.
- 2026-11-05 · handoff · user chose "Count it"; ADR 0005 + CONTEXT.md Revealed written; lint PASS. Iteration 0, no re-plan.

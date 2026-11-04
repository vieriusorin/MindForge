---
ticket: MF-0015
outcome: pass
causes: missing-context
actions: skill-edit
applied: 2026-11-04
lesson_keys: design-preflight-sc-preconditions, figure-edge-input-table, probe-library-behaviour-before-oracle
---
## Numbers
`pnpm ticket:retro` does not exist in this repo (no `ticket:*` scripts); figures are from the artifacts.
- iterations: 1 (it0, DONE at first receipt); freeze history: `[]` (no refreeze)
- frozen: 1 file, 7 tests, red at freeze with `Error: not implemented`, hash `ade38982...` unchanged at verify
- gates: typecheck 0 · lint 0 (409 files) · test 0 (73 files / 286 tests, baseline 70 / 270) · build 0
- review: none (normal tier, no fresh-context reviewer); open concerns at hand-off: 0
- not verified: real storm input (MF-0013 unmerged), screen reader
- session token metrics: not available to me, so no token signal either way

## Went right
- DESIGN found three gaps in a GOAL drafted the day before (unattempted skill = 0, no card without an exam date, fog = 0 in overall). One of them (C-2) contradicted the draft's "other packs show the forecast alone". All three were put to the user before FREEZE, so the frozen file never changed and nothing was rebuilt (freeze history empty, 1 iteration). Evidence: GOAL "Decided by the user", FROZEN.json `history: []`. — keep: partly written (SKILL.md Stage 2 preflight covers proofs, not figure inputs). See action 1.
- A probe of ts-fsrs (floored elapsed days) ran before the oracle was written. The oracle was cross-checked against ts-fsrs 5.4.2 (S 2.3065, R(10 d) 0.77437 by hand vs 0.77436692). Evidence: LOOP-VERIFY "RED at freeze". LOOP-PLAN Discovery also records "Elapsed days are floored". — keep: action 1 also adds the probe, since SKILL.md line 125 covers external wire formats only.
- Reusing `replayMemory` and the page's `countable` attempts made the forecast agree with the forest by construction. The plan rejected adding `lastReviewAt` to `MemorySnapshot` because it would touch frozen MF-0001/MF-0011 fixtures. Evidence: LOOP-PLAN "Rejected options". — keep: already is, in LOOP-PLAN of this ticket; it is ticket-specific, so no skill text.
- Weather was decided on the rounded percent shown (84.6 shows 85, sunny), with frozen cases for both sides of the boundary. Evidence: SC-1 third case in the acceptance file. — keep: already is, in the GOAL "Decided without a question" and the frozen test.

## Went wrong
- The draft GOAL's SCs were "proposals" that left edge inputs unspecified (a never-attempted skill, a pack with no exam date, a domain with no data in the overall figure). A figure's behaviour for empty, absent or partial input was not in any rule loaded at DESIGN. It was caught only because the designer happened to ask. This is the same family as `design-preflight-sc-preconditions` (MF-0006, MF-0007, MF-0012 and others), here about a figure's inputs instead of an SC's proof. Cost: three user decisions at DESIGN and no rework, so the impact is small. cause: missing-context
- No fresh-context code review ran (normal tier). The verify receipt is the only independent check. I did not read the diff, so I cannot say what review would have found. This is the tier policy working as written, not a failure. cause: none

## Actions (at most two)
1. skill-edit: `/Users/sorinvieriu/Projects/mind-forge/.claude/skills/gsd-goal-loop/SKILL.md`, Stage 2 DESIGN. Insert this paragraph after the paragraph ending "(MF-0008 retro: a Batches `custom_id` with dots, and a PDF stored as text)." (line ~128):

   > Any SC that shows a computed figure (a percent, a rank, a flag, a weather) gets an **edge-input table** in the GOAL before the checkpoint. It has one row per input state: nothing at all, partially present (a skill never attempted, a domain with no data), a config value absent (a pack without `exam.date`), and the boundary of every threshold. Each row names the shown result and who decided it. A row the draft did not state is a Concern for the user, not a default for the builder. When the GOAL was drafted in an earlier session, also re-read each draft decision against the user's later answers and `CONTEXT.md` for contradictions. Before writing an oracle over a library's numbers (ts-fsrs, date maths, rounding), run a one-line probe of the library and record the result in the oracle test's comment. A formula taken from the docs can differ from what the code does (MF-0015: ts-fsrs floors elapsed days).

   Would have saved: the three DESIGN questions asked ad hoc. Their success depended on the designer thinking of them. The probe step also turns the "elapsed days floored" discovery from a lucky find into a rule. Savings are small this ticket, but the missing-edge-input pattern is already behind several earlier `design-preflight-sc-preconditions` retros.

## Not worth changing
- Drafting the GOAL the day before from the planning grill: it worked, and DESIGN fixed the gaps. Do not drop the pre-draft habit.
- No `ticket:*` scripts, so FREEZE, VERIFY and EVAL ran by hand with LF-normalised hashes. The tree hash and frozen hash were recorded and matched. This is a known gap (`hand-run-ticket-scripts` in the MF-0005 retro), not new.
- Real storm input is unverified because MF-0013 is unmerged. The GOAL already says the second ticket to merge wires it. Make that a hand-off line for whoever merges second (MF-0013 or this one), not a skill change.
- No memory entry to add or delete: checked `feedback-verify-derived-facts.md` (re-count from source before SCs), which covers the same spirit and is not wrong or stale.

## Applied

- 2026-11-04: action 1 (skill-edit, additive) applied: edge-input table + draft re-read + library probe paragraph inserted in `.claude/skills/gsd-goal-loop/SKILL.md` Stage 2, after the MF-0008 retro paragraph.
- Held: none.

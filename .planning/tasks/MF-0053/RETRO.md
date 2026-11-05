---
ticket: MF-0053
applied: 2026-11-05
outcome: pass
causes: missing-context
actions: skill-edit
lesson_keys: reserved-ticket-premise-recheck, proof-case-replay-before-freeze, design-preflight-sc-preconditions, draft-rule-vs-own-proof-case
---
## Numbers
(`pnpm ticket:retro` is not wired; counts taken by hand from GOAL.md, FROZEN.json and the diff.)
- Tier normal, `last_iteration: 0`, no reviewer, no re-freeze. Frozen 14/15 red at freeze, all green after BUILD.
- Baseline `8b1aa89`: 144 files / 683 tests. After BUILD: 698 tests, typecheck, lint and `gate:planning` pass. MF-0028 frozen hash unchanged (SC-7).
- Diff: 5 tracked files (+189/-22): `planning-check.mjs` +73, `check-planning.mjs`, `SKILL.md` +4, `templates.md` +2, GOAL.md.
- Proof-case replay at DESIGN: RED for both cases (MF-0052 misses build, db:reset, dev:seed, test:db; MF-0025 has no preflight line).

## Went right
- Pickup re-derived every claim of the reserved GOAL (a `## Facts` section) before asking the user. It found three errors: the "design preflight" convention is written in no skill or template (only 2 of 53 GOALs use it), MF-0052 misses four commands not two, and MF-0025's miss is an absent line, not SC-6. Without that, the frozen SCs would have encoded a false rule. — keep: already is (`SKILL.md` Stage 3, the "reserved ticket is a hypothesis, re-derive at pickup" sentence from MF-0027, plus the proof-case replay FREEZE STOP from MF-0028).
- The probe also showed 39 shipped GOALs would be flagged, which justified the folder-name cutoff and "no retroactive flags". The drafted-rule-over-shipped-content probe worked as written. — keep: already is (`SKILL.md` line 150).
- A new export (`checkDesignPreflight`) kept the MF-0028 contract and its frozen test untouched; the user's three concerns were answered in one checkpoint. One iteration, no re-freeze. — keep: already is (MF-0028 shape in GOAL Constraints).

## Went wrong
- The MF-0052 retro drafted a gate GOAL from a convention it never grepped for. The GOAL said the preflight "line" exists and that the proof cases name "neither test:db nor build" and "SC-6". All three were wrong (see `## Facts`, lines 29 to 37 of GOAL.md). The pickup caught it, so the cost was small (extra SC-6 to write the convention, a corrected SC-4). But the retro step has no rule that a gate draft must be replayed on its own proof cases, so the next retro can do it again. cause: missing-context. `references/retro.md` line 40 tells the agent what a gate draft must contain, and the "probe before freezing" rule lives in Stage 3 of `SKILL.md`, which the retro agent does not read.

## Actions (at most two)
1. skill-edit: `/Users/sorinvieriu/Projects/mind-forge/.claude/skills/gsd-goal-loop/references/retro.md`, table row for `gate` (line 40). Replace
   `| \`gate\` | draft a new ticket: claim the number, \`GOAL.md\` with \`goal_status: reserved\` and the pattern + the file it would have caught. Never build it here | defer |`
   with
   `| \`gate\` | draft a new ticket: claim the number, \`GOAL.md\` with \`goal_status: reserved\` and the pattern + the file it would have caught. Before naming a convention, a phrase or a proof case, grep \`.claude/skills\` and \`.planning/tasks/*/GOAL.md\` for it and run \`git show <sha>:<path>\` on each proof case; quote what you saw, and mark anything unchecked "unverified, re-derive at pickup". Never build it here (MF-0053: the MF-0052 draft assumed a "design preflight" convention no skill states and misdescribed both proof cases) | defer |`
   Would have saved: the pickup rework (one extra SC and a corrected SC-4) and a GOAL that already told the truth when the user read it.

## Not worth changing
- Token usage: no session metrics available; the ticket is one lib function, a CLI wiring and two skill edits, so its size explains the cost.
- Gate matching is textual (C-2): `pnpm test:db` on the line passes without a result. The user accepted this on purpose; the skill text asks for a result or `not run: <reason>`. Not a defect.
- First run of the gate governs no ticket except MF-0053 itself (cutoff `> MF-0052`). Whether it catches the next real skip is unproven until the next ticket; check at the next retro, no change now.

## Applied
- 2026-11-05 skill-edit → `.claude/skills/gsd-goal-loop/references/retro.md` `gate` row: probe conventions and proof cases before drafting a gate GOAL (additive, applied).
- Held: none.

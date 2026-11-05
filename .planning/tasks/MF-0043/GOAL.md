---
ticket_id: MF-0043
tier: normal                      # dev tooling: a planning gate script; no app code, no DB
stage: intake
goal_status: reserved             # created by the MF-0032 retro (gate action); never built automatically
builds_on: [MF-0016, MF-0032]
---

> Reserved 2026-11-04 by the MF-0032 retro (Action 2). Not built until the user picks it up.

## Objective

**Today.** SKILL.md Stage 3a "Contract-widening tickets: grep the shape, not the table" is a hand grep over
a shape's key names and type name. It misses call sites of a function whose signature changes. In MF-0032 the
1-argument `toPlayableQuestion(q)` at `src/engine/questions/__tests__/mf-0008-schema.acceptance.test.ts:70` was
found at PLAN instead of DESIGN, which cost a separate re-freeze approval. MF-0016 hit the same lesson
(`frozen-shape-collision-grep-in-plan`), finding one collision per stage.

**End state.** `scripts/frozen-collisions.mjs`, run as `pnpm ticket:collisions <ID>`:
- reads a `## Symbols changed` list in `.planning/tasks/<ID>/LOOP-PLAN.md` (functions whose signature changes,
  closed-set names, shared type names);
- greps every `**/*.acceptance.test.*` and every path in the `FROZEN.json` of the ticket's `builds_on` tickets.
  For a function it flags `\b<name>\(` and imports of `<name>`;
- prints `file:line` for each hit not already listed under "Frozen files this will re-freeze", and exits 1 if
  there is any.

SKILL.md Stage 2 (before the checkpoint) and Stage 3a call it by name, in place of the hand grep. Changing
SKILL.md and `package.json` scripts are guarded edits, so the user approves them.

## Proof cases

- RED: an MF-0032 LOOP-PLAN with `toPlayableQuestion` under "Symbols changed" and only the MF-0003 + MF-0012
  rows listed → flags `mf-0008-schema.acceptance.test.ts:70`, exit 1.
- GREEN: the same plan with the MF-0008 row listed → exit 0.

## Open questions

- Should it also run inside a ticket:freeze-style step, or stay a DESIGN/PLAN check only?

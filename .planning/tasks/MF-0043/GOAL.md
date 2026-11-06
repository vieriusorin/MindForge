---
ticket_id: MF-0043
title: Frozen-collision check (pnpm ticket:collisions)
tier: high-risk                   # a planning gate script (MF-0055 retro: gates are high-risk); no app code, no DB
stage: handoff
branch: feat/MF-0043
goal_status: complete-pending-manual-commit
builds_on: [MF-0016, MF-0032]
last_iteration: 0
---

> Reserved 2026-11-04 by the MF-0032 retro (Action 2). Claimed 2026-11-06 (this session, user: "do MF-0043 with
> gsd-goal-loop"). `pnpm ticket:github MF-0043 --claim` could not run: the `gh` token lacks `read:project`.

## Objective

**Today.** SKILL.md Stage 3a "Contract-widening tickets: grep the shape, not the table" is a hand grep over a
shape's key names and type name. It misses call sites of a function whose signature changes. In MF-0032 the
1-argument `toPlayableQuestion(q)` at `src/engine/questions/__tests__/mf-0008-schema.acceptance.test.ts:70` was
found at PLAN instead of DESIGN, which cost a separate re-freeze approval. MF-0016 hit the same lesson.

**End state.** `pnpm ticket:collisions <ID>` reads the symbols a plan changes from `## Symbols changed` in
`.planning/tasks/<ID>/LOOP-PLAN.md`, greps every frozen file those symbols could break, and prints `file:line` for
each hit the plan's `## Frozen files this will re-freeze` section does not already name. Exit 1 when there is any.
SKILL.md Stage 2 and 3a run it by name in place of the hand grep; the LOOP-PLAN template carries both sections.

## Facts (re-derived 2026-11-06; the reserved draft is a hypothesis)

- Proof case holds. At `bd4e1dc` (MF-0008) the file has `import { parseQuestionFiles, toPlayableQuestion }` at
  line 10 and `toPlayableQuestion(q)` at line 70. MF-0032 landed inside `862f462`; its parent `da583a0` is the
  pre-MF-0032 tree.
- MF-0032's `builds_on` is `[MF-0003, MF-0007, MF-0009, MF-0016]`. MF-0008 is not in it, so the builds_on FROZEN.json
  paths alone would miss the proof case; the all-`*.acceptance.test.*` scan is what catches it.
- No plan has a `## Symbols changed` section today; this ticket introduces it. 15 plans have a "Frozen files this
  will re-freeze" section in four shapes: a table with `path:lines` (MF-0032), bullets with a backticked path
  (MF-0021, MF-0024), a "checked and holds" table (MF-0052), and "None." prose. Some write it as a bullet
  (`- Frozen files this will re-freeze: none`), not a heading (MF-0033, MF-0037…MF-0042).
- `references/templates.md`' LOOP-PLAN template defines neither section.
- `package.json` has no `ticket:freeze`, `ticket:verify` or `ticket:eval` script; `scripts/lib/ticket-*.mjs` exist
  without a CLI. The draft's open question "also run inside a ticket:freeze-style step" has no step to run in.
- `scripts/lib/foreign-frozen.mjs` reads every FROZEN.json for a different purpose (verify exclusion); it is unused.
- Script tests live in `src/test/__tests__/` and import `scripts/lib/*.mjs` directly (`mf-0028-planning-check`).
- Tier was `normal` in the draft. Gate scripts are high-risk (SKILL.md HIGH_RISK binding, MF-0055 retro), so this
  ticket is high-risk: plan approval and a fresh-context reviewer.

## Affected

- **Roles:** contributors running the goal loop (no app user).
- **Surfaces:** new `scripts/frozen-collisions.mjs` (CLI) + `scripts/lib/frozen-collisions.mjs` (pure decisions);
  `package.json` (`ticket:collisions`); `.claude/skills/gsd-goal-loop/SKILL.md` Stage 2 + 3a;
  `.claude/skills/gsd-goal-loop/references/templates.md` LOOP-PLAN.

## Constraints

- Read-only: the check reads files and writes nothing.
- No new dependency; Node built-ins only, like the other `scripts/*.mjs`.
- CRLF-safe: content is LF-normalised before lines are counted (Windows checkout, MF-0006 retro).
- Guarded edits (SKILL.md, templates.md, `package.json` scripts) need the user's approval.

## Decided without a question

- **Match rule:** a listed symbol matches a line on a word boundary (`\bname\b`). This is a superset of the
  draft's `\bname\(` + imports: it also catches a function passed by reference (`.map(toPlayableQuestion)`), a type
  name and a closed-set name, which the draft lists but gives no rule for. It does not match `toPlayableQuestionX`.
- **What counts as "already listed":** any backticked path to a scanned file, anywhere in the
  `Frozen files this will re-freeze` section (heading or bullet form), with any `:line` suffix ignored. A
  "checked and holds" row (MF-0052) counts: it records that the file was read. The section ends at the next heading.
- **Files scanned:** every `*.acceptance.test.*` under the repo (skipping `node_modules`, `.next`, dot-folders) plus
  every path in the `FROZEN.json` of each `builds_on` ticket. The ticket's own frozen files are skipped (its own
  `FROZEN.json` paths and `mf-<n>-*` files of its own number).
- **Inputs:** a missing ticket folder, a missing LOOP-PLAN.md, or no `## Symbols changed` heading is an input error:
  exit 2 with a message naming the path (fail loud; engineering-principles §3). A section with no backticked name
  ("None.") exits 0 and says no symbols are listed.
- **Freeze step:** no `ticket:freeze` script exists, so the check is a DESIGN/PLAN step only (open question closed).
- **Output:** one line per hit, `path:line  symbol`, sorted by path then line, then a summary line.
- Not wired into `gate:planning` or CI: it reads a plan in progress and needs the ticket ID (Out of Scope).

## Success Criteria

- [x] SC-1: Proof case RED. A fixture tree holding the pre-MF-0032 `mf-0008-schema` and `mf-0003-questions`
  lines, and a plan with `toPlayableQuestion` under Symbols changed and only the MF-0003 + MF-0012 rows listed,
  reports `src/engine/questions/__tests__/mf-0008-schema.acceptance.test.ts:10` and `:70` and exits 1.
  Proof: frozen `src/test/__tests__/mf-0043-frozen-collisions.acceptance.test.ts`.
- [x] SC-2: Proof case GREEN. The same plan with the MF-0008 row added reports nothing and exits 0. Proof: same file.
- [x] SC-3: Listing forms. A file named in the section by a table row with `:124-133`, a bullet, or a "holds" row
  is not reported; the same path named only in another section is reported. Proof: same file.
- [x] SC-4: Scope. A `builds_on` FROZEN.json path without `.acceptance.` in its name is scanned; `node_modules` is
  not; the ticket's own frozen file is not; `.map(toPlayableQuestion)` is reported, `toPlayableQuestionX` is not;
  a CRLF file reports the same line numbers as its LF copy. Proof: same file.
- [x] SC-5: Inputs. Unknown ticket, no LOOP-PLAN.md, and no `## Symbols changed` heading each exit 2 naming the
  path; "None." under the heading exits 0. Proof: same file.
- [x] SC-6: `pnpm ticket:collisions MF-0043` runs on this repo against MF-0043's own LOOP-PLAN and exits 0.
  Proof: command output in LOOP-VERIFY.
- [x] SC-7: SKILL.md Stage 2 (before the checkpoint) and Stage 3a name `pnpm ticket:collisions <ID>` in place of the
  hand grep, and the LOOP-PLAN template in `references/templates.md` has `## Symbols changed` and
  `## Frozen files this will re-freeze`. Proof: grep lines in LOOP-VERIFY + review.
- [x] SC-8: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm gate:planning` pass. Proof: receipt in LOOP-VERIFY.

## Constraints → how met

- Read-only → the lib returns hits; the CLI only prints and sets the exit code. Reviewed.
- No new dependency → `node:fs` / `node:path` only; `package.json` dependencies unchanged.
- CRLF-safe → SC-4 CRLF case.
- Guarded edits → asked at this checkpoint (C-1).

## Concerns

| # | Collision | Owner | Status |
|---|-----------|-------|--------|
| C-1 | The deliverable edits guarded files: `package.json` (add `ticket:collisions`), SKILL.md Stage 2 + 3a, `references/templates.md`. | user | resolved 2026-11-06 (user): approve all three |
| C-2 | The many plans that write "Frozen files this will re-freeze" as a bullet, not a heading, would read as "section missing" (the paths in it are then not counted as listed). New plans follow the template heading; old plans are not re-run. | agent | decided: a heading opens a section that runs to the next heading; a bullet starting with that phrase opens one that runs over its indented continuation lines, up to the next unindented line (SC-3) |

## Decided by the user (DESIGN checkpoint, 2026-11-06)

- C-1: approve the guarded edits to `package.json`, SKILL.md Stage 2 + 3a and `references/templates.md`.
- SCs frozen as written. No proof wipes or restarts shared local state.

## Out of Scope

- Wiring the check into `gate:planning` or CI (it needs a ticket ID and a plan in progress).
- Rewriting existing LOOP-PLANs to add `## Symbols changed`.
- Detecting which symbols change from the diff (the plan author lists them).

## Open questions

- none beyond C-1.

## Iteration Log

<!-- append-only -->
- 2026-11-06 · intake→design · Claimed. Facts re-derived (above). proof-case replay: RED. A throwaway probe of the
  drafted rule over `git archive da583a0`, with a fixture plan (Symbols changed: `toPlayableQuestion`; MF-0032's
  re-freeze table without the MF-0008 row) printed `mf-0008-schema.acceptance.test.ts:10` and `:70`, exit 1; with
  the MF-0008 row, exit 0 (GREEN, as SC-2 needs). The first run governs no shipped plan: none has the new section.
- 2026-11-06 · design preflight: `pnpm typecheck` exit 0 · `pnpm lint` exit 0 · `pnpm test` 154 files / 766 passed ·
  `pnpm gate:planning` ok (56 folders) · `pnpm ticket:collisions` not run: it is this ticket's deliverable · `main`
  CI: last 3 runs `success`. No proof wipes or restarts shared local state.
- 2026-11-06 · design→plan · DESIGN checkpoint: user approved C-1. RED frozen: 1 file, 5 cases, `not implemented`
  (LOOP-VERIFY "RED at freeze"; FROZEN.json). → PLAN (high-risk: plan approval before BUILD).
- 2026-11-06 · plan→build · User approved LOOP-PLAN iteration 0 (high-risk plan checkpoint). Baseline = the design
  preflight run (all green; only reds are MF-0043's 5 frozen cases).
- 2026-11-06 · build→test→handoff · T1-T3 built; review round 1 changes-requested (3 blocking, false-clean paths),
  round 2 changes-requested (generic kept its outer name), round 3 approve (`d6db2267…`). Each fix had its
  regression shown RED first; frozen file never edited. Receipt + SC table: LOOP-VERIFY.md. Evidence: MF-0043.md.

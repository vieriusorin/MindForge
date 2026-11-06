---
ticket_id: MF-0043
title: "Frozen-collision check (pnpm ticket:collisions)"
tier: normal                      # dev tooling: a read-only planning check; no app code, no DB, no outward writes
stage: handoff
branch: MF-0043
builds_on: [MF-0016, MF-0032]
last_iteration: 0
goal_status: complete-pending-manual-commit
---

> Reserved 2026-11-04 by the MF-0032 retro (Action 2). Picked up 2026-11-06.

## Objective

**Today.** SKILL.md Stage 3a "Contract-widening or behaviour-changing tickets" is a hand grep over a shape's
key names and type name. It misses call sites of a function whose signature changes. In MF-0032 the 1-argument
`toPlayableQuestion(q)` at `src/engine/questions/__tests__/mf-0008-schema.acceptance.test.ts:70` was found at
PLAN instead of DESIGN, which cost a separate re-freeze approval. MF-0016 hit the same lesson
(`frozen-shape-collision-grep-in-plan`), finding one collision per stage.

**End state.** `pnpm ticket:collisions <ID>` (`scripts/frozen-collisions.mjs`, pure logic in
`scripts/lib/frozen-collisions.mjs`) reads the ticket's `## Symbols changed` list, greps every frozen acceptance
file, and prints `file:line` for each hit whose file is not listed under "Frozen files this will re-freeze",
exiting 1 if there is any. SKILL.md Stage 2 (before the checkpoint) and Stage 3a call it by name, in place of the
hand grep.

## Facts (re-derived at pickup, 2026-11-06)

- Line 70 claim holds: on `862f462~1` the file has `toPlayableQuestion(q)` at :70 and the import at :10. Today
  (after MF-0032) both are still there, with :70 now `toPlayableQuestion(q, "h")`.
- Every path in every `FROZEN.json` (all tickets) is a `*.acceptance.test.*` file, and every tracked
  `*.acceptance.test.*` is in some `FROZEN.json` (probe 2026-11-06). The draft's "acceptance glob + `builds_on`
  FROZEN.json" set is therefore just the acceptance glob; the check scans the glob ∪ all FROZEN.json paths.
- The re-freeze listing in practice (MF-0032 LOOP-PLAN:36-42) is a `### Frozen files this will re-freeze` table whose
  first cell is a backticked path with an optional `:line` or `:a-b` suffix.
- No plan has a `## Symbols changed` section yet; the format is new (SC-2).
- No `ticket:freeze` / `ticket:verify` / `ticket:eval` scripts exist in `package.json` (the libs exist under
  `scripts/lib/`), which answers the draft's open question (see Decided without a question).
- Precedent shape: MF-0053 (`scripts/lib/planning-check.mjs` pure + `scripts/check-planning.mjs` CLI, acceptance
  tests in `src/test/__tests__/` importing the lib and spawning the CLI).

## Affected users and surfaces

Ticket authors (people and the `ticket-planner` agent). Files: `scripts/frozen-collisions.mjs` (new),
`scripts/lib/frozen-collisions.mjs` (new), `package.json` (one script), `.claude/skills/gsd-goal-loop/SKILL.md`
and `references/templates.md` (LOOP-PLAN shape). No app code, no DB, no network.

## Constraints

- `package.json` scripts and the gsd-goal-loop skill are guarded edits: the user approves them (C-1).
- Pure decision in the lib, I/O in the CLI (engineering-principles §1; MF-0053 shape).
- Fail loud: a missing or malformed `Symbols changed` list is an error (exit 2), never a silent pass.
- Read-only: the script writes nothing.

**Constraints → how met.** Guarded → C-1 at the checkpoint. Pure/I-O → `findCollisions({ symbols, listed, files })`
takes file texts in, CLI does the reads (SC-1…SC-4 test the lib, SC-5/SC-6 spawn the CLI). Fail loud → SC-5.
Read-only → the CLI has no write call (diff review).

## Success Criteria

- [x] **SC-1** Proof case RED: a temp repo holding the `862f462~1` text of `mf-0008-schema.acceptance.test.ts` and
  `mf-0003-questions.acceptance.test.ts` at their real paths, and a ticket whose plan lists
  `` - function `toPlayableQuestion` `` under `## Symbols changed` and only the MF-0003 and MF-0012 rows under
  "Frozen files this will re-freeze" → stdout has `src/engine/questions/__tests__/mf-0008-schema.acceptance.test.ts:10`
  and `…:70`, no `mf-0003` line, exit 1. *Proof:* frozen acceptance test (spawned CLI, `MF_ROOT` temp dir).
- [x] **SC-2** Proof case GREEN: the same with the MF-0008 row added → exit 0, stdout
  `ticket:collisions: MF-<id>: no unlisted collisions (<n> frozen files scanned)`. *Proof:* frozen acceptance test.
- [x] **SC-3** Symbol kinds, one bullet each `` - <kind> `<name>` ``: `function` flags lines matching `\b<name>\(` and
  import lines that name `<name>` as a whole word, including the specifier line inside a multi-line
  `import { … } from` block; `name` (a type, closed-set constant, any identifier) flags
  `\b<name>\b`; `literal` flags the exact substring (e.g. `` - literal `'question'` ``). `function toPlayable` does not
  flag `toPlayableQuestion(`. A file counts as listed when its path appears backticked (any `:line` suffix ignored)
  inside the "Frozen files this will re-freeze" section (any heading level), so every hit in a listed file is
  silent. *Proof:* frozen acceptance test on the lib.
- [x] **SC-4** The ticket's own frozen files (paths in its own `FROZEN.json`, and any file named `mf-<own number>-*`)
  are never flagged. *Proof:* frozen acceptance test.
- [x] **SC-5** Fail loud, exit 2 with one line naming the cause: unknown ID (no task folder); no `## Symbols changed`
  section in GOAL.md or LOOP-PLAN.md; a bullet that does not parse (quotes the line). A section holding exactly
  `- none` → exit 0. *Proof:* frozen acceptance test.
- [x] **SC-6** Sources: `## Symbols changed` and the re-freeze section are read from both `GOAL.md` and `LOOP-PLAN.md`
  when present (union), so the check works at DESIGN before a plan exists. *Proof:* frozen acceptance test.
- [x] **SC-7** `package.json` has `"ticket:collisions": "node scripts/frozen-collisions.mjs"`; SKILL.md Stage 2
  preflight and Stage 3a name `pnpm ticket:collisions <ID>` in place of the hand grep, and
  `references/templates.md` LOOP-PLAN shape has the `## Symbols changed` section. *Proof:*
  `grep -n "ticket:collisions" package.json .claude/skills/gsd-goal-loop/SKILL.md` and
  `grep -n "Symbols changed" .claude/skills/gsd-goal-loop/references/templates.md` (not frozen).

## Decided without a question

- Scan set = every `*.acceptance.test.*` under the repo (excluding `node_modules`, `.next`) ∪ every `FROZEN.json`
  path: the probe shows they coincide today, and the union stays right if they ever drift.
- Listed = file-level, not line-range: MF-0032 listed `mf-0003…:124-133`, but the import at :5 sits outside that
  range; line ranges go stale as soon as a file shifts.
- Draft open question (also run inside a freeze step?): no — there is no `ticket:freeze` script to run it in. It stays
  a DESIGN/PLAN command.
- Symbols live in GOAL.md at DESIGN and LOOP-PLAN.md at PLAN (SC-6): the draft read only LOOP-PLAN, which does not
  exist yet at the Stage 2 call the draft itself asks for.
- `literal` kind kept: Stage 3a already asks to grep sibling members as literals; dropping it would leave that part
  of the hand grep in place.
- Tier `normal`: read-only, not wired into the Stop hook or CI, no outward writes (unless C-2 picks enforcement).

## Concerns

| # | Concern | Owner | Status |
|---|---|---|---|
| C-1 | Guarded edits: `package.json` script and the gsd-goal-loop skill text. | user | resolved 2026-11-06: approve both |
| C-2 | Enforcement: the reserved draft makes it a command the skill tells you to run (prose, like the hand grep it replaces). Option B: `gate:planning` also fails a ticket after MF-0043 at `stage: plan`/`build` whose LOOP-PLAN has no `## Symbols changed` section (presence only; collisions still a manual run). B touches `scripts/lib/planning-check.mjs` → high-risk tier. | user | resolved 2026-11-06: command only |
| C-3 | Matching is textual: an aliased import (`import { toPlayableQuestion as tpq }`) is caught on the import line but its call sites are not. Accept as residual? | user | resolved 2026-11-06: accept residual |

## Decided by the user

- 2026-11-06: C-1 approve the `package.json` script and the skill/template edits · C-2 command only, no gate ·
  C-3 aliased call sites are an accepted residual.
- No proof command wipes shared local state (no DB, no `db:reset`). SCs frozen at this checkpoint.

## Out of Scope

- Parsing TypeScript (AST) to find calls. · Running the check inside a freeze or verify script. · Retroactive
  `Symbols changed` sections in shipped plans.

## Iteration Log

- 2026-11-06 design preflight: `pnpm typecheck` pass, `pnpm lint` pass (637 files), `pnpm test` pass (155 files, 786
  tests), `pnpm gate:planning` ok (56 folders), on `5069f63`. `pnpm ticket:collisions` not run: it is what this ticket
  builds. `main` CI: success (`5069f63`). No proof command needs the DB, a build, or wipes local state.
- 2026-11-06 proof-case replay: RED — grep `\btoPlayableQuestion\(` + import over acceptance files on `862f462~1`
  hits `mf-0008-schema.acceptance.test.ts:10` and `:70` (1-arg call); with mf-0003 + mf-0008 listed, no hit remains.
- 2026-11-06 iteration 0: frozen 6/6 red (stubs) → BUILD (lib + CLI + script + skill text) → TEST: typecheck / lint /
  test (792) / gate:planning / check-hooks pass, frozen hash matches, receipt `d4eb6fdc…66f8`. SC-3 wording made
  explicit about multi-line imports before the freeze. DONE.

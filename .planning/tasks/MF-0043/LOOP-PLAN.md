# MF-0043 — LOOP-PLAN (iteration 0)

## Discovery

- Precedent: MF-0053 — pure lib in `scripts/lib/planning-check.mjs`, CLI `scripts/check-planning.mjs`, frozen test in
  `src/test/__tests__/` importing the lib and spawning the CLI with an env override for the root.
- Re-freeze listing shape in practice: MF-0032 LOOP-PLAN:36-42 (`### Frozen files this will re-freeze`, table, first
  cell a backticked path with `:line`/`:a-b`).
- No `ticket:freeze` / `ticket:verify` / `ticket:eval` package scripts: freeze and verify are by hand (FROZEN.json
  LF-normalised sha256, as `scripts/lib/ticket-*.mjs`).
- Gates the files sit on: none (`scripts/frozen-collisions.mjs` is not `check-*.mjs`, not in the Stop hook or CI).
- Shared worktree: `mind-forge-MF-0055` is a separate worktree on `feat/MF-0055`; it also edits the gsd-goal-loop
  skill (Stage 5 hand-off). This ticket's SKILL.md hunks are Stage 2 and Stage 3a only.

## Symbols changed

- none

(New files only; `checkCollisions` has no callers yet.)

## SC coverage

| SC | Steps | Proof |
|----|-------|-------|
| SC-1, SC-2 | T1, T2 | frozen test (spawned CLI) |
| SC-3, SC-4, SC-6 | T1 | frozen test (lib) |
| SC-5 | T1, T2 | frozen test (lib + CLI) |
| SC-7 | T3 | grep |

## Steps

1. **T1** `scripts/lib/frozen-collisions.mjs`: `checkCollisions({ ticket, goalText, planText, ownFrozen, files })`
   → `{ code, hits, message }`. CRLF-normalise; section bodies by heading prefix (any level, until the next heading at
   the same or higher level); bullets `- (function|name|literal) \`x\``, or `- none`; anything else starting `- ` is
   a parse error. Listed = backticked tokens in re-freeze sections with `:n` / `:a-b` stripped. Own = `ownFrozen`
   ∪ basename `mf-<num>-*`. Per line: function → `\bx\(` or whole-word inside an import statement (single or
   multi-line, until `from "…"`); name → `\bx\b`; literal → substring. Hits sorted by path, line; deduped.
2. **T2** `scripts/frozen-collisions.mjs`: root = `MF_ROOT` or repo root; validate the ID; exit 2 when the task
   folder is missing; read GOAL.md / LOOP-PLAN.md / own FROZEN.json; scan set = walk for `*.acceptance.test.*`
   (skip `node_modules` and dot-dirs) ∪ every `FROZEN.json` path that exists; print `path:line  <code>` per hit then
   the message; exit `code`.
3. **T3** `package.json` script; SKILL.md Stage 2 preflight item + Stage 3a paragraph; `references/templates.md`
   LOOP-PLAN shape gets `## Symbols changed`.

## Riskiest step

The silent pass: a plan whose symbols are written in a shape the parser skips would exit 0 and look clean. Mitigated by
SC-5 (an unparseable `- ` bullet is exit 2, a missing or empty section is exit 2, only an explicit `- none` passes).

## Rejected options

- AST parsing (TypeScript compiler API): catches aliases, but adds a heavy dependency for a planning aid; C-3 accepts
  the residual.
- Line-range listing: goes stale when a file shifts (decided in GOAL).
- Scanning only `builds_on` FROZEN.json: misses frozen files of tickets not named in `builds_on` (MF-0008 was not in
  MF-0032's `builds_on`, which is the proof case itself).

```json tasks
[
  { "id": "T1", "title": "checkCollisions lib", "agent": "inline", "owns": ["scripts/lib/frozen-collisions.mjs"], "depends_on": [], "closes": ["SC-3", "SC-4", "SC-5", "SC-6"], "done_when": "mf-0043 SC-3..SC-6 green", "context": "GOAL SC-3..SC-6" },
  { "id": "T2", "title": "CLI", "agent": "inline", "owns": ["scripts/frozen-collisions.mjs"], "depends_on": ["T1"], "closes": ["SC-1", "SC-2", "SC-5"], "done_when": "mf-0043 all green", "context": "GOAL SC-1, SC-2" },
  { "id": "T3", "title": "script + skill text", "agent": "inline", "owns": ["package.json", ".claude/skills/gsd-goal-loop/SKILL.md", ".claude/skills/gsd-goal-loop/references/templates.md"], "depends_on": ["T2"], "closes": ["SC-7"], "done_when": "SC-7 greps hit; pnpm ticket:collisions MF-0043 exits 0", "context": "C-1 approved" }
]
```

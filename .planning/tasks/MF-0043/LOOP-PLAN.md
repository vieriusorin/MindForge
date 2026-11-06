---
phase: 0-planning
ticket_id: MF-0043
status: executing
verdict: IN_PROGRESS
started_at: "2026-11-06"
resume_with: /gsd-goal-loop
---

# Loop Plan — Iteration 0

## Discovery summary

- Precedent for a planning check: MF-0028 (`scripts/check-planning.mjs` CLI over `scripts/lib/planning-check.mjs`,
  pure-ish lib imported by `src/test/__tests__/mf-0028-planning-check.acceptance.test.ts`). Same split here:
  `scripts/frozen-collisions.mjs` (argv, print, exit) over `scripts/lib/frozen-collisions.mjs`.
- FROZEN.json shape: `{ files: [{ path, sha256, first_failure }], history }` (MF-0032). `foreign-frozen.mjs` reads the
  same manifests, tolerating a missing or unreadable file; this check does the same for `builds_on` manifests.
- `builds_on` lives in GOAL.md front matter as `builds_on: [MF-0003, MF-0007]`.
- Re-freeze section shapes in shipped plans: table with `path:lines` (MF-0032), bullets (MF-0021, MF-0024), "holds"
  table (MF-0052), prose "None.", and the bullet form `- Frozen files this will re-freeze: …` (MF-0033, MF-0037…42).
- Role agents may not write `scripts/**` or `.claude/**` (`.claude/hooks/lib/agent-scopes.mjs` NEVER list), so every
  task runs inline.
- Gates the touched paths sit on: `pnpm lint` (biome covers `scripts/**`), `pnpm typecheck` (`allowJs`: JSDoc types
  in the `.mjs` must hold), `pnpm gate:planning` (this GOAL's preflight line).

## Symbols changed

None. This ticket only adds new code; no existing function, closed set or shared type changes.

## Frozen files this will re-freeze

None. Grep over every `*.acceptance.test.*` for `gsd-goal-loop`, `templates.md`, `SKILL.md`, `ticket:collisions`,
`frozen-collisions`, `package.json`, with each hit's assertions read:
- `src/server/http/__tests__/mf-0004-site-origin.acceptance.test.ts`: asserts `scripts.dev` only.
- `src/test/__tests__/mf-0028-planning-check.acceptance.test.ts`: asserts `scripts["gate:planning"]` only.
- `src/test/__tests__/mf-0053-design-preflight.acceptance.test.ts`: reads `package.json` from a fixed fixture sha.
- `src/engine/content/__tests__/mf-0039-agent-skills.acceptance.test.ts`: "SKILL.md" is pack content, unrelated.

## SC coverage

| SC | Steps | Proof |
|----|-------|-------|
| SC-1, SC-2 | 1 | frozen acceptance file, cases SC-1/SC-2 |
| SC-3 | 1 | frozen file SC-3 + inner test of the section parser |
| SC-4 | 1 | frozen file SC-4 |
| SC-5 | 1 | frozen file SC-5 |
| SC-6 | 3, 4 | `pnpm ticket:collisions MF-0043` → exit 0 (this plan says "None.") |
| SC-7 | 5, 6 | grep lines in LOOP-VERIFY + review |
| SC-8 | all | receipt |

## Steps

1. `scripts/lib/frozen-collisions.mjs`: replace the stub.
   - `parseSymbols(planText)` → names in backticks (identifier-shaped) under `## Symbols changed` (to the next heading);
     `null` when the heading is absent.
   - `parseListedPaths(planText)` → backticked paths (`:line` suffix stripped) inside every "Frozen files this will
     re-freeze" section: heading form to the next heading; bullet form over its indented continuation lines.
   - `parseBuildsOn(goalText)` → ids from the `builds_on:` front-matter list (`[]` when absent).
   - `findHits({ files, symbols })` over `{ path, content }[]` → `{ path, line, symbol }[]`; LF-normalised; a
     symbol matches on `(?<![\w$])name(?![\w$])` (so `myToPlayableQuestion` and `toPlayableQuestionX` don't match);
     sorted by path, then line, then symbol.
   - `checkFrozenCollisions({ root, ticket })`: the I/O shell. Order: ticket folder → LOOP-PLAN.md → heading (each
     missing one is `code: 2` naming the repo-relative path / heading). Scan set = walk for `*.acceptance.test.*`
     (skip `node_modules`, `.next`, dot-folders) ∪ builds_on FROZEN.json paths that exist; minus own FROZEN.json
     paths and basenames starting `mf-<own number>-`; minus listed paths. `code` 1 when hits, else 0.
2. `src/test/__tests__/frozen-collisions.test.ts`: inner unit tests per exported parser: `parseSymbols` (absent
   heading → null; "None." → []; non-identifier backticks like `` `pnpm x` `` skipped), `parseListedPaths` (both forms,
   `:124-133` stripped, section ends), `parseBuildsOn`, `findHits` (`$`-names, word boundaries, CRLF).
3. `scripts/frozen-collisions.mjs`: `node scripts/frozen-collisions.mjs <ID>`; no ID → usage on stderr, exit 2.
   Prints each hit as `path:line  symbol`, then a one-line summary; the message for code 2 on stderr.
4. `package.json`: `"ticket:collisions": "node scripts/frozen-collisions.mjs"` (C-1 approved).
5. `.claude/skills/gsd-goal-loop/SKILL.md`: Stage 3a "Contract-widening…" paragraph: replace the hand grep with
   "list the symbols under `## Symbols changed`, then run `pnpm ticket:collisions <ID>`; each line it prints goes
   under `## Frozen files this will re-freeze`" (keep the behaviour-change greps it does not cover: file name,
   tables written, keyed column). Stage 2 preflight: add a step to run it once the draft plan names its symbols.
6. `.claude/skills/gsd-goal-loop/references/templates.md`: LOOP-PLAN template gains `## Symbols changed` and
   `## Frozen files this will re-freeze` between Discovery summary and SC coverage.

## Riskiest step

Step 1's "already listed" rule. A path counted as listed when it is not (a too-wide section, a path mentioned in
Steps) hides exactly the collision this ticket exists to catch, and nothing downstream would notice. SC-3 pins both
section forms and their ends, including a path under `## Steps` and one in the next sibling bullet that must still
be reported. The second risk is a false "clean" when the plan has no Symbols section: SC-5 makes that exit 2, never 0.

## Rejected options

- **Derive symbols from the diff** (changed exported signatures): needs a TS parser, and the point is to know at
  DESIGN, before the diff exists. Out of Scope.
- **Run inside `gate:planning`**: the gate runs over every ticket with no plan-in-progress context; a hit needs a
  human to decide re-freeze vs. design change. Out of Scope.
- **Draft's `\bname\(` + imports only**: misses a function passed by reference and gives no rule for the type and
  closed-set names the draft lists. Whole-word match covers all three.
- **Reuse `foreignFrozenPaths`**: it reads every ticket's manifest; this needs only the builds_on ones. Shared shape
  is three lines; not worth coupling (hoist on a second consumer).

## Verify

- `pnpm typecheck && pnpm lint && pnpm test && pnpm gate:planning`; `pnpm ticket:collisions MF-0043` (SC-6);
  the replay of the proof case through the real CLI on `git archive da583a0` (same as the probe).
- No browser: nothing on screen. Show-it command: `pnpm ticket:collisions MF-0043`.
- Fresh-context `diff-reviewer` (high-risk).

## Tasks

```json tasks
[
  { "id": "T1", "title": "lib + inner tests", "agent": "inline",
    "owns": ["scripts/lib/frozen-collisions.mjs", "src/test/__tests__/frozen-collisions.test.ts"],
    "depends_on": [], "closes": ["SC-1", "SC-2", "SC-3", "SC-4", "SC-5"],
    "done_when": ["pnpm vitest run src/test/__tests__/mf-0043-frozen-collisions.acceptance.test.ts src/test/__tests__/frozen-collisions.test.ts", "pnpm typecheck"],
    "context": ["skill:typescript-strict", "skill:testing-strategy"] },
  { "id": "T2", "title": "CLI + package script", "agent": "inline",
    "owns": ["scripts/frozen-collisions.mjs", "package.json"],
    "depends_on": ["T1"], "closes": ["SC-6"],
    "done_when": ["pnpm ticket:collisions MF-0043"],
    "context": [] },
  { "id": "T3", "title": "skill + template wording", "agent": "inline",
    "owns": [".claude/skills/gsd-goal-loop/SKILL.md", ".claude/skills/gsd-goal-loop/references/templates.md"],
    "depends_on": ["T2"], "closes": ["SC-7"],
    "done_when": ["grep -n 'ticket:collisions' .claude/skills/gsd-goal-loop/SKILL.md", "grep -n 'Symbols changed' .claude/skills/gsd-goal-loop/references/templates.md"],
    "context": [] },
  { "id": "T4", "title": "verify + review", "agent": "inline",
    "owns": [".planning/tasks/MF-0043/**", ".planning/evidence/MF-0043.md"],
    "depends_on": ["T1", "T2", "T3"], "closes": ["SC-8"],
    "done_when": ["pnpm typecheck && pnpm lint && pnpm test && pnpm gate:planning"],
    "context": ["agent:diff-reviewer"] }
]
```

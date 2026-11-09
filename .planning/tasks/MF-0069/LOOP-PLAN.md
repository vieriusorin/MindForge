# MF-0069 LOOP-PLAN (iteration 0)

## Discovery

- `scripts/lib/planning-check.mjs` (525 lines): pure `check*(entries)` rules, each scoped by a cutoff
  (`PREFLIGHT_CUTOFF`, `SEE_IT_CUTOFF`, `OWNS_CUTOFF`). It already has the helpers this rule needs: `frontValue`,
  `sectionBody`, `PAST_DESIGN`. `checkPlanOwns` (`:404`) is the precedent for judging a LOOP-PLAN from `build` on, with
  tasks from MF-0048's `parsePlanTasks`.
- `scripts/check-planning.mjs` (112 lines) builds `entries` with `planText` and concatenates every rule's lines. CI
  runs it (`pnpm gate:planning`), and so does the Stop gate.
- Frozen tests that run the CLI on fixtures: `mf-0028-planning-check.acceptance.test.ts` (SC-4) and
  `mf-0053-design-preflight.acceptance.test.ts` (SC-5). Their fixtures write no LOOP-PLAN.md, so the new rule reports
  nothing for them. Their "exits 0 on this repo" cases include MF-0069's own plan, which must pass the rule.
- Template: `.claude/skills/gsd-goal-loop/references/templates.md:116-124`, `## Parsers` as one prose paragraph.

## SC → steps

| SC | Steps | Proof |
|---|---|---|
| SC-1..SC-4 | 1 | `src/test/__tests__/mf-0069-plan-parsers.acceptance.test.ts` SC-1..SC-4; inner `src/test/__tests__/plan-parsers.test.ts` |
| SC-5 | 2 | acceptance SC-5; `pnpm gate:planning` exit 0 on this repo |
| SC-6 | 3 | acceptance SC-6 |

## Steps

1. `scripts/lib/planning-check.mjs`: replace the stub with `checkPlanParsers(entries)` and its readers (Parsers below).
   `PARSERS_CUTOFF = "MF-0068"`. Lines are prefixed `<dir>: `. Inner tests go in
   `src/test/__tests__/plan-parsers.test.ts`: heading variants, a table that is not right after the label, a
   separator-only table, `None:` plus a block, a `### ` inside a fenced code block, and owns that are not strings.
2. `scripts/check-planning.mjs`: import it and add `...checkPlanParsers(entries)` to `problems`. Add one header-comment
   line for MF-0069.
3. `templates.md`: rewrite the `## Parsers` template as `None: <reason>` or `### <name>` blocks with the three labels
   (`verification.md` §4 traps kept), with the example between `<!-- parsers-example -->` markers.

## Parsers

### Trigger (task owns)

Accepted grammar: the tasks come from `parsePlanTasks` (unchanged). A task's `owns` counts when it is an array. Each string element is brace-expanded with the gate's `expandOwns`, and leading `./` is dropped. The element triggers when any alternative overlaps `scripts/**`, `.claude/hooks/**` or `src/engine/**` (MF-0048 `globsOverlap`, exact) and has no `__tests__/` path segment. An element whose braces cannot be expanded triggers (fail closed, review B-2). The first triggering element in task order is the one named. Non-string elements and a non-array `owns` are left to `validatePlan`.

Rejected inputs:

| Input | Expected |
|---|---|
| owns `["src/engine/x/__tests__/a.test.ts"]` | not triggered (test-only segment) |
| owns `["src/features/x/**"]` | not triggered (outside the three trees) |
| owns `["**/*.mjs"]`, `[".claude/**"]`, `["./scripts/x.mjs"]`, `["{scripts,docs}/x.mjs"]` | triggered (review B-2) |
| owns `["src/{a,{b,c}}.ts"]` (nested braces) | triggered (cannot expand: fail closed) |
| owns `["scripts/my__tests__/x.mjs"]` | triggered (not a whole `__tests__` segment) |

Exempt-path test: none: no item is exempt. Out-of-scope tickets (cutoff, reserved, before `build`) are skipped
before any read, as every gate:planning rule does, and SC-4 asserts each one.

### Parsers section and its blocks

Accepted grammar: the section is the body of the first `##<space(s)>Parsers` heading (a suffix such as `:` or `(none)` is allowed), read up to the next `#` or `##` heading. Fenced lines (``` or ~~~, closed only by the same character with a run at least as long) are never headings and never count. The section is valid when (a) it has no `###` block and its first non-blank line, with bold removed, is `None:` followed by a reason that does not start with `<`, or (b) it has one or more `### <name>` blocks, each running to the next `###` or the end of the section. Inside a block, each label must open its own line (an optional list marker and bold are allowed), and a mention inside prose does not count. The block needs `Accepted grammar:` followed by text, and `Exempt-path test:` followed by text. It also needs `Rejected inputs` followed by a Markdown table of 3 or more data rows (header and `|---|` separator excluded), and that table must come before the next block label (`Accepted grammar`, `Exempt-path test`, `Cross-check`). Everything else is a problem naming the ticket and, for a block, its name.

Rejected inputs:

| Input | Expected |
|---|---|
| no `## Parsers` heading | `<dir>: LOOP-PLAN owns <glob> but has no "## Parsers" section (…)` |
| `None:` with nothing after it | `<dir>: Parsers section says "None:" without a reason` |
| prose only, no `None:` and no `###` | `<dir>: Parsers section has neither "None: <reason>" nor a ### block` |
| a block without `Accepted grammar:` | `<dir>: Parsers block "<name>" has no "Accepted grammar:" line` |
| a 2-row table, or a table with no `Rejected inputs` label | `<dir>: Parsers block "<name>" has no Rejected inputs table with 3 or more rows` |
| a block without `Exempt-path test:` | `<dir>: Parsers block "<name>" has no "Exempt-path test:" line` |
| `### ` with an empty name | `<dir>: Parsers block "" …` (named as empty, still judged) |
| `None: <reason>` (placeholder) | `<dir>: Parsers section says "None:" without a reason` |
| `Rejected inputs: see GOAL` + a table under `Cross-check:` | no Rejected inputs table (review B-1) |
| labels and table only inside a fence, or a label mid-sentence | each label missing (review B-1) |

Exempt-path test: `None:` placed in a section that also has `###` blocks does not exempt those blocks; each block is
still judged (inner test).

## Riskiest step

Step 1's section reader. A reader that is too strict reddens the next contributor's honest plan in CI. One that is
too loose lets a blocked shape through, the MF-0048 trap. The acceptance file pins the user-facing shapes, the inner
tests pin the edges above, and SC-6 ties the template to the rule so the documented shape cannot drift from the
checked one.

## Rejected options

- The drafted plan-text regex trigger: it fires on 45 of 54 shipped plans and misses the proof case (GOAL Facts).
- A separate `ticket:plan-lint` CLI: nothing would run it (user, 2026-11-09).
- Section-level label checks: a second parser block could omit them (user, 2026-11-09).

## Symbols changed

None. (checkPlanParsers is a new export. check-planning.mjs gains one rule, and the frozen CLI fixtures in
mf-0028 / mf-0053 write no LOOP-PLAN, so the rule reports nothing there; their assertions were read.)

## Frozen files this will re-freeze

- None.

```json tasks
[
  { "id": "T1", "agent": "inline", "owns": ["scripts/lib/planning-check.mjs", "src/test/__tests__/plan-parsers.test.ts"], "depends_on": [], "closes": ["SC-1", "SC-2", "SC-3", "SC-4"], "done_when": "acceptance SC-1..SC-4 green; inner tests green", "context": "step 1" },
  { "id": "T2", "agent": "inline", "owns": ["scripts/check-planning.mjs"], "depends_on": ["T1"], "closes": ["SC-5"], "done_when": "acceptance SC-5 green; pnpm gate:planning exit 0", "context": "step 2" },
  { "id": "T3", "agent": "inline", "owns": [".claude/skills/gsd-goal-loop/references/templates.md"], "depends_on": ["T1"], "closes": ["SC-6"], "done_when": "acceptance SC-6 green", "context": "step 3" }
]
```

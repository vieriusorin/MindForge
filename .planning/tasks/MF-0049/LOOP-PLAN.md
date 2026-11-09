# MF-0049 LOOP-PLAN (iteration 0)

## Discovery

- Precedent: `scripts/frozen-collisions.mjs` + `scripts/lib/frozen-collisions.mjs` (MF-0043): an ID-scoped
  `ticket:` CLI with a pure lib and a `rejected` list. `scripts/check-pack-grounding.mjs`: env override for fixture
  dirs.
- `successCriteria()` in `scripts/lib/ticket-eval.mjs` ends an SC at its first sub-bullet. It is shared, so it stays
  unchanged, and this check gets its own block reader (Parsers below).
- Guarded: `scripts/check-*.mjs`, `package.json`, `.claude/skills/**`.

## SC → steps

| SC | Step | Proof |
|---|---|---|
| SC-1..SC-4 | T1 `scripts/lib/goal-proofs.mjs` (pure: `checkGoalProofs({ goalText, planText, verifyText, frozenText, scripts, exists, isTrackedBasename })` → `{ problems }`), plus CLI `scripts/check-goal-proofs.mjs <ID>` (`MF_TASKS_DIR` override; disk and `git ls-files` at the edge) | `src/test/__tests__/mf-0049-goal-proofs.acceptance.test.ts` (frozen) + `goal-proofs.test.ts` (inner) |
| SC-5 | T2 `package.json` `"check:goal-proofs": "node scripts/check-goal-proofs.mjs"`; SKILL.md Stage 4 step | the diff; running it on MF-0049 at TEST |

## Parsers

**SC block reader.** Inside `## Success Criteria…` (up to the next `## ` heading), a block starts at
`^- \[[ xX]\] (\*\*)?SC-\d+` and runs until the next SC start, the next `## ` heading, or a column-0 non-blank line
that is not an SC start. Indented lines and blank lines inside a block belong to it.
- Accepted grammar: the SC start line above, then indented continuation and sub-bullets.
- A file with no SC block → error "no Success Criteria found".
- A duplicate SC id → error.

**Proof part.** The text after the last `Proof:` that is not inside backticks (backtick spans are removed before
searching). No such `Proof:` → error "SC-n has no Proof:" (SC-4, C-2).

**Token rules.** For each backtick span in the Proof part:
- whitespace, `<`, `>`, `*`, `{` or `}` → not a path (skipped, as prose or a placeholder);
- a `pnpm (run )?<name>` span → `<name>` must be a script or in `exec | dlx | install | vitest`;
- a path under `src/`, `scripts/`, `supabase/`, `packs/` or `e2e/` (an optional `:line` is stripped) → must exist;
- a bare `*.test.ts(x)` → must be a basename in `git ls-files`.

**FROZEN.json.** Read as JSON with `files` an array of objects whose `path` is a string. Anything else → error naming
the file. A missing FROZEN.json means no rule (b).

Rejected inputs (tests):

| Input | Expected |
|---|---|
| no GOAL.md | `cannot read …/GOAL.md` |
| `FROZEN.json` = `{` | `FROZEN.json is not valid JSON` |
| `files: [{ "sha256": "x" }]` | `FROZEN.json files[0] has no path` |
| SC without Proof: | `SC-2 has no Proof:` |
| `Proof:` only inside backticks | `SC-1 has no Proof:` |
| a duplicate `SC-1` | `SC-1 appears twice` |
| a GOAL with no SC | `no Success Criteria found` |

Exempt-path test: none. No item is exempt; placeholders are not paths by rule, so the test asserts that `<slug>` and
`*` tokens are skipped and a real missing path next to them is still reported.

Cross-check: the probe over the 48 shipped GOALs at handoff, recorded in the evidence. Expected hits: MF-0016 SC-1
(a), 10 frozen files (b), and the SCs without Proof:.

## Riskiest step

The block reader dropping a wrapped `Proof:` (the `successCriteria` trap). This would read as "no Proof:", which is
fail-closed (noisy, never a silent pass). The worse case is a `Proof:` part read short, so a missing path goes
unchecked. Mitigation: a test where SC-1's `Proof:` sits after sub-bullets and a blank line, as in this GOAL's own
SC-1, with a missing path at the end.

Nothing writes or deletes.

## Rejected options

- Widening `successCriteria()`: it is shared by ticket-eval and ticket-retro, and its callers' tests would move.
- A `gate:` script for all tickets: the user chose CLI + skill step (C-3), and it would overlap MF-0060.

## Symbols changed

None.

## Frozen files this will re-freeze

None.

```json tasks
[
  {"id": "T1", "agent": "orchestrator", "owns": ["scripts/lib/goal-proofs.mjs", "scripts/check-goal-proofs.mjs", "src/test/__tests__/goal-proofs.test.ts"], "depends_on": [], "closes": ["SC-1", "SC-2", "SC-3", "SC-4"], "done_when": "acceptance SC-1..4 green", "context": "guarded gate script"},
  {"id": "T2", "agent": "orchestrator", "owns": ["package.json", ".claude/skills/gsd-goal-loop/SKILL.md"], "depends_on": ["T1"], "closes": ["SC-5"], "done_when": "pnpm check:goal-proofs MF-0049 exit 0", "context": "guarded"}
]
```

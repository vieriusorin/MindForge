---
verdict: approve
reviewed_hash: 51c23327a1a9f6138b03355d79df94179a7dd4fb934dfb06dfd794ffcf26967c
reviewed_at: 2026-11-09T09:34:27Z
---
Round 2: a re-review of the delta after round 1 (tree `e8f343f7…`, changes-requested, B-1 and B-2). Base `HEAD`
(6efdf88). The tree hash is `git diff HEAD | sha256sum`.

Untracked files I read, with sha256 of the file bytes:
- `src/test/__tests__/plan-parsers.test.ts` ef0d189a19de1ee4bdd46496b68e3f5c0722abfb7938d0582ed96900086a599e
- `src/test/__tests__/mf-0069-plan-parsers.acceptance.test.ts` 894d950b939ccb2ed85ba43637e66a871881cd7237a3d4dfd741205cd468a0fb.
  This matches FROZEN.json, so the frozen test is unchanged.
- `LOOP-PLAN.md` e470e9a571788d5ba7d89f10f987a5c2456a1327433a61f099a56ddb8af44728
- `LOOP-VERIFY.md` f09db368…
- `FROZEN.json` 2c9e852d…

Checks:
- `pnpm gate:planning` exits 0 (71 folders).
- The two MF-0069 test files pass, 30/30.
- The changed files are the same four as in round 1, all inside the plan's `owns`.
- The LOOP-PLAN `## Parsers` grammar and its tables now describe the code as written.
- GOAL.md Constraints no longer claims `sectionBody` reuse.

## Round-1 blockers

- **B-1 is closed** (`scripts/lib/planning-check.mjs`: `parsersSection`, `labelText`, `hasRejectedTable`). I re-ran my
  round-1 probes:
  - Labels and a table only inside a fence: all three parts are now reported missing.
  - Labels only in table cells: all three reported missing.
  - `Rejected inputs: see GOAL` with the table under `Cross-check:`: reported as having no Rejected inputs table.
  - A label mid-sentence: all three reported missing.
  - A `~~~` inside a ```` ``` ```` fence followed by a real `### P` block: the block is judged again.
- **B-2 is closed** (`parserTerritoryGlob`). These owns now trigger: `{scripts,docs}/x.mjs`, `./scripts/x.mjs`,
  `.claude/**`, `**/*.mjs`, `{a,{b,scripts}}/x` (cannot expand, so fail closed) and `scripts/my__tests__/x.mjs`.
  `src/features/**`, `packs/**`, `supabase/**` and `.claude/skills/**` still do not trigger. Some forms still evade
  the trigger: a backslash path, a leading `/`, a bare `scripts` or `.claude/hooks`, `SCRIPTS/` and
  `scripts/__tests__/../lib/x.mjs`. None of these globs matches a real changed file path in the scope dialect, so
  each one leaves the file unowned, and MF-0060 rule 2 (`checkChangedFilesOwned`) reports it at hand-off. That is
  not an escape.

## Findings

- [note] `scripts/lib/planning-check.mjs` `hasRejectedTable`: the table search stops only at the four block labels.
  `Rejected inputs: see GOAL.` followed by `Notes:` and a 3-row table still passes (probe 1). This matches the
  declared grammar, which allows prose between the label and its table. Stopping at any other `Label:` line would
  close it.
- [note] `scripts/lib/planning-check.mjs` `parsersSection`, the fence opener `/^\s*(`{3,}|~{3,})/`: a line that
  starts with inline code such as ```` ```x``` is inline ```` opens a fence. Under CommonMark it does not, because a
  backtick fence's info string cannot contain a backtick. The probe placed such a line before `## Parsers` and got a
  false "no Parsers section". Placed inside the section, the same line would hide later `###` blocks until a bare
  ```` ``` ```` appears. This is rare in plans. Fix: require the info string of a backtick opener to be free of
  backticks.
- [note] `parsersSection`: an unclosed fence inside the section runs to the end of the document. That matches
  CommonMark and the rendered view, but `None: ok.` followed by an unclosed fence and a `### P` block passes
  (probe 3). §4 would call an unclosed fence unparseable input, which should be reported.
- [note] Rare false positives, each failing closed with a clear line:
  - `- None: reason` as a list item.
  - A reason that starts with `<`, e.g. `None: <br> tags only`.
  - A label written as a `####` heading.
- [note] Left as they were by decision, and acceptable: the stage allowlist (it mirrors `checkPlanOwns`, and a quoted
  or capitalised `stage:` still skips the rule) and `####` inside a block.

No blocking findings.

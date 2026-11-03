---
ticket: MF-0006
outcome: pass
causes: tooling, missing-context
actions: gate, skill-edit
lesson_keys: windows-crlf-line-endings, design-spike-settles-concern, hand-run-ticket-scripts
---
## Numbers
- Tier normal, iteration 0, handed off 2026-11-03 (no `ticket:retro` script; facts read by hand).
- Receipt tree `c9f72edd...`: typecheck, 24-file lint, 76/76 tests, build PASS; all 7 frozen hashes match.
- Froze 2 acceptance files, 10 tests red on stubs; MF-0003 got a rename-only re-freeze (`status`->`origin`).
- Unverified: `test:db` (cannot run on Windows, `src/test/local-stack.ts` execs the `.bin/supabase` shim).
- Baseline: `pnpm lint` fails repo-wide on CRLF `format` errors.

## Went right
- The Mermaid spike (C-1) settled the concern with evidence (mermaid 11.17.2 and @mermaid-js/parser both fail without a DOM) before SC-2 was frozen. SC-2 was amended to a test-time jsdom check instead of an impossible engine check. Zero iterations. — keep: already is, GOAL.md C-1 row. Add one line to the design stage reference: "a concern whose answer depends on a library's runtime behaviour gets a 10-minute spike before the SC is frozen".
- Every user-owned collision (C-1..C-4) was resolved in design, so BUILD did not stop. The rename-only MF-0003 re-freeze was recorded in FROZEN.json history. — keep: already is, GOAL.md Concerns table.
- The migration diff line count (153 vs 103 expected) caught a bad script before any test ran. — keep: already is in the Iteration Log.

## Went wrong
- One root cause, three symptoms: no `.gitattributes` and `core.autocrlf=true`, so the Windows working copy is CRLF while the repo's tools assume LF. (1) The `^(\s+)` with `m` flag migration regex captured `\n` and put a blank line before 50 `author:` lines. (2) The first MF-0003 re-freeze hash was computed on CRLF and had to be corrected to the LF hash. (3) `pnpm lint` fails at baseline on CRLF `format` errors, so lint passing on "24 files" is a scoped run, not the repo gate. cause: tooling
- There are no `ticket:freeze` / `ticket:verify` / `ticket:eval` scripts, only `scripts/lib/ticket-*.mjs`, so the skill defaults were run by hand, which is where the CRLF hash mistake could happen. cause: missing-context (the skill names commands that do not exist here)

## Actions (at most two)
1. gate: add `C:\Users\Vlad-StefanParvana\Desktop\ccdv-f\MindForge\.gitattributes` with the single line `* text=auto eol=lf` (the owner then runs `git add --renormalize .`). With it, CRLF checkouts stop being produced, so the lint `format` baseline failure, the FROZEN.json hash mismatch and the `\r` regex trap cannot happen. Would have saved: the CRLF re-hash round, the redone migration, and the broken repo-wide lint gate.
2. skill-edit: `.claude/skills/gsd-goal-loop/references/retro.md` and the freeze section of `SKILL.md` — add: "If `pnpm ticket:freeze|verify|eval` is missing from package.json, hash frozen files over LF-normalised content (`content.replace(/\r\n/g, '\n')`) using `scripts/lib/ticket-*.mjs`; one-off migration regexes use `[ \t]+`, never `\s`, for indentation." Would have saved: the wrong first hash and the migration redo.

## Not worth changing
- `test:db` not runnable on Windows (`local-stack.ts` shim): known from commit 185663c for scripts; a separate fix ticket, listed unverified here.
- SC-8 "replay" met by the duel page and action rather than `replayMemory`: a planned divergence, recorded in LOOP-PLAN.
- Assumed Sorin's sign-in email = his git email: a one-time data assumption, logged in the Iteration Log. (Moot: the user later took authorship of every item.)

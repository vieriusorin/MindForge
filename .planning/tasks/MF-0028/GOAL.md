---
ticket_id: MF-0028
tier: normal                      # dev tooling: a planning check wired as a gate; no app code, no DB
stage: handoff
branch: MF-0028
builds_on: []
last_iteration: 1
goal_status: complete-pending-manual-commit
depends_on: []
---

> Reserved by the MF-0014 retro (2026-11-04, lesson `ticket-number-collision-across-branches`). Picked up
> 2026-11-05.

## Objective

**Today.** Two sessions on separate branches reserved MF-0022 and MF-0023 at the same time, and merge
`71ac090` concatenated two tickets into each GOAL.md. Nothing checked the merged result; MF-0014 found
it by chance in DESIGN, which cost a user question and renumbering MF-0012's tickets (MF-0026/MF-0027).

**End state.** `scripts/check-planning.mjs` (logic in `scripts/lib/planning-check.mjs`) fails, naming the
folder, when a `.planning/tasks/*/GOAL.md` has more than one `ticket_id:` line, none, a `ticket_id` that
differs from its directory name, or any of `tier:` / `stage:` / `goal_status:` at column 0 more than once (the
shape merge `71ac090` actually produced: it kept one `ticket_id:` line and the second ticket's other keys). It runs as `pnpm gate:planning`, so the Stop gate's GATES step picks it up
with no hook edit, and as a step in CI's `checks` job on every PR (C-1).

## Affected

- **Roles:** developers and agent sessions; no app user sees a change.
- **Surfaces:** `scripts/check-planning.mjs` (new), `scripts/lib/planning-check.mjs` (new), `package.json`
  (`gate:planning`), `.github/workflows/ci.yml` (one step, C-1). No `src/` app code, no DB.

## Constraints

- Gate scripts are guarded config (`gate-core.mjs` PROTECTED: `scripts/check-*.mjs`, `.github/`) → creating
  `scripts/check-planning.mjs` and any `ci.yml` edit go through the guard's ask prompt; the user approves each.
- The Stop gate hook is guarded → not edited. It already runs every `gate:*` script
  (`.claude/hooks/stop-gate.mjs:155-157`), so a `gate:planning` script is the whole wiring.
- Pure decision, I/O at the edge (engineering-principles §1) → `checkPlanning(entries)` takes
  `{ dir, goalText | null }[]` and returns problems; the CLI reads the disk. Same split as MF-0036
  (`scripts/lib/cuckoo-grounding.mjs` + `scripts/check-pack-grounding.mjs`).
- CRLF checkouts (MF-0006 retro) → text is LF-normalised before matching.
- Fast: the Stop gate has a 120 s per-gate budget; 49 small files read in well under 1 s.

## Decided without a question

- A ticket folder with no GOAL.md passes: Stage 0 creates the folder first as a claim
  (`.claude/skills/gsd-goal-loop/SKILL.md` Stage 0), so an empty claim folder is a legal state.
- Every line starting at column 0 with `ticket_id:` counts, anywhere in the file, not only the front matter:
  a concatenating merge puts the second ticket's front matter in the body, which is the case this exists for
  (MF-0014 RETRO action 1).
- The value is read like `parseGoalFrontmatter` reads keys (`gate-core.mjs:98-105`): trim, strip one pair of
  quotes; a trailing ` # comment` is stripped too, because GOAL front matter carries comments on other keys.
- Non-directory entries under `.planning/tasks/` are ignored.
- Exit code 1 on any problem, 0 otherwise, one line per problem naming the folder: the convention of
  `check-hooks.mjs` and `check-pack-grounding.mjs`.
- A test-only env override `MF_TASKS_DIR` points the CLI at a fixture tree, like `MF_PACKS_DIR` in
  `check-pack-grounding.mjs:16`.
- Read-only probe of today's tree (2026-11-05): 49 GOAL.md files, every one has exactly one `ticket_id:` line
  matching its folder; MF-0035 has no folder. So the first run is green and reviews no existing content.

### Edge inputs (SC-1…SC-4)

| Input | Result | Decided by |
|---|---|---|
| `MF-0042/GOAL.md` with one `ticket_id: MF-0042` | pass | brief |
| two `ticket_id:` lines (concatenated merge, same or different ids) | fail: "MF-0042: 2 ticket_id lines" | brief |
| no `ticket_id:` line | fail: "MF-0042: no ticket_id line" | this GOAL (a GOAL that names no ticket can't be checked) |
| `ticket_id: MF-0043` in folder `MF-0042` | fail: names both | brief |
| `ticket_id: "MF-0042"` / `ticket_id: MF-0042   # note` | pass | this GOAL (matches parseGoalFrontmatter) |
| CRLF line endings | same result as LF | MF-0006 retro |
| `  ticket_id: X` indented, or `ticket_id:` mid-line in prose | not counted | this GOAL (column 0 only) |
| `ticket_id:` at column 0 inside a fenced code block in the body | counted → fail | this GOAL (C-2) |
| one `ticket_id:`, but `tier:` / `stage:` / `goal_status:` twice at column 0 (the real `71ac090` shape) | fail: names the repeated keys | user (C-3) |
| `last_iteration:` twice, or absent | not checked (5 GOALs omit it) | this GOAL (probe) |
| folder with no GOAL.md | pass | Stage 0 claim |
| a file (not a folder) in `.planning/tasks/` | ignored | this GOAL |
| `.planning/tasks/` missing | pass, prints that nothing was checked | this GOAL (fresh clone tooling) |

## Success Criteria

- [x] SC-1: `checkPlanning` reports one problem naming the folder for a GOAL.md with 2 `ticket_id:` lines, for
  one with none, and for one with a single `ticket_id:` but `tier:` / `stage:` / `goal_status:` repeated at
  column 0 (the MF-0022 file at `71ac090`, line for line in the seam); and `node scripts/check-planning.mjs`
  exits 1 on `git archive 71ac090 .planning/tasks`, naming MF-0022 and MF-0023. Proof: `src/test/__tests__/mf-0028-planning-check.acceptance.test.ts`.
- [x] SC-2: it reports a problem naming the folder and the id for a `ticket_id` that differs from the folder.
  Proof: same file.
- [x] SC-3: it reports nothing for: a valid GOAL, a quoted value, a trailing comment, CRLF text, an indented
  or mid-line `ticket_id:`, a folder with no GOAL.md. Proof: same file.
- [x] SC-4: `node scripts/check-planning.mjs` exits 1 and prints each bad folder on a fixture tree
  (`MF_TASKS_DIR`), and exits 0 on this repo's `.planning/tasks`. Proof: same file (spawns the script).
- [x] SC-5: `package.json` has `"gate:planning": "node scripts/check-planning.mjs"`, so the Stop gate's GATES
  step runs it. Proof: same file reads `package.json`; plus one observed Stop gate line listing the gate.
- [ ] SC-6: `.github/workflows/ci.yml` `checks` job runs `pnpm gate:planning`. Proof: the
  PR's CI run shows the step green (observed after push; listed as not verified locally).
- [x] SC-7: `pnpm typecheck && pnpm lint && pnpm test` green; `node scripts/check-hooks.mjs` green; evidence file.

## Concerns

| # | Collision | Owner | Status |
|---|-----------|-------|--------|
| C-1 | The brief puts the check in the Stop gate, but the Stop gate runs only after a session edits a source file outside `.planning/` (`gate-core.mjs:38-39`, `stop-gate.mjs:121`). A merge on GitHub, or a session that only writes GOAL.md files, never triggers it, which is exactly when the collision appears. CI on the PR runs on the merge result and would have caught `71ac090` before it landed. Adding the step edits guarded `ci.yml`. | user | resolved 2026-11-05: Stop gate + CI (user) |
| C-3 | The retro's proof case did not turn RED: replaying the gate on `git archive 71ac090 .planning/tasks` passed, because the merge dropped the second `ticket_id:` line and kept `tier:`/`stage:`/`goal_status:`/`last_iteration:`/`## Objective` twice. Found in TEST, after the freeze. | user | resolved 2026-11-05: also fail on repeated `tier:`/`stage:`/`goal_status:`; re-freeze (user) |
| C-2 | A GOAL that quotes a `ticket_id:` line at column 0 inside a fenced block fails the check. None does today; the fix is to indent the quote. Accept, or skip fenced blocks (more code, and a concatenation inside a fence is impossible anyway)? | user | resolved 2026-11-05: accept (user) |

## Decided by the user

- C-1 (2026-11-05): run the check in the Stop gate AND in CI; the user approves the guarded `ci.yml` edit.
- C-3 (2026-11-05): repeated `tier:` / `stage:` / `goal_status:` at column 0 is a problem too; the acceptance test
  is re-frozen with the real `71ac090` shape (FROZEN.json history).
- C-2 (2026-11-05): count column-0 `ticket_id:` lines inside fenced blocks too.
- No proof command wipes shared local state (no `db:reset`, no `supabase stop/start`): nothing to approve.

## Out of Scope

- Detecting a number reserved on another branch before merge (Stage 0 `git grep` already does that).
- Checking other GOAL fields (`stage`, `goal_status` sets); a separate ticket if wanted.
- Editing the Stop gate hook.

## Open questions

- none

## Iteration Log

<!-- append-only -->
- 2026-11-05 iteration 1 done: SC-1…SC-5, SC-7 PASS locally; SC-6 step in place, live CI run unverified. Hand-off.
- 2026-11-05 iteration 1: TEST replay of `71ac090` passed the gate (wrong signal). Back to DESIGN: C-3, SC-1
  widened, re-freeze. Lesson: the proof-case probe should have run before the freeze (SKILL Stage 2 says so).
- 2026-11-05 iteration 0: INTAKE + DESIGN drafted. Baseline: typecheck 0, lint 0, test 592/592, `main` CI
  success (7bec73e). Probe: 49/49 GOAL.md clean.

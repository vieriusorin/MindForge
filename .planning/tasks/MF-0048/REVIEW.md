---
verdict: approve
reviewed_hash: 32a1f79e570204a3e5007bf16cd5ea344a47e6f05c1d9640edd95d356f88d6ed
reviewed_at: 2026-11-06T13:12:12Z
---
<!-- Round 1: verdict changes-requested, reviewed_hash b3b7012f39f2eedeaf4cf07083823505f79f943098fb15e094eaffa3fac534a1, reviewed_at 2026-11-06T13:02:29Z -->
Hash recipe (run in the repo root; `pnpm ticket:verify` is not a script on this branch):
`{ git diff HEAD; git ls-files --others --exclude-standard -z ':!.planning/tasks/MF-0048/REVIEW.md' | xargs -0 sha256sum; } | sha256sum`

## Findings

- [blocking] scripts/lib/ticket-eval.mjs:136-148 — `ownsSyntaxProblem` is a blocklist. It rejects five listed shapes and
  passes everything else. GOAL Constraints cite verification.md §4, and §4 (MF-0046) requires an allowlist. Each of
  these is a role-agent `owns` entry that names or normalises to a NEVER path, and today `validatePlan` returns **no
  error** for it (`agent: "service-builder"`, checked by running it):
  - interior `..` / `.` segments: `src/../scripts/x.mjs`, `src/engine/../../package.json`,
    `src/./../.github/workflows/ci.yml`. The leading `../` is rejected but the same segment in the middle is not.
  - a drive-absolute path: `C:/Users/me/MindForge/scripts/x.mjs`. Only a leading `/` is rejected, and Windows is this
    repo's dev platform.
  - leading whitespace: ` scripts/x.mjs`.
  - a case variant on a case-insensitive filesystem (NTFS, default APFS): `Scripts/x.mjs`, `PACKAGE.JSON`,
    `.Claude/settings.json`.
  - brace and class syntax that a reader will take as a glob: `{scripts,src}/x.mjs`, `[s]cripts/x.mjs`, plus `~/x`.

  What it breaks: the plan check passes exactly the plan it exists to stop. The builder is then blocked at write time,
  or, for the case variants, gets past the hook (see the note below). Fix: accept a segment only if it matches an
  allowlist, e.g. `^(\*\*|[A-Za-z0-9._@+-]|\*|\?)+$` with `**` only as a whole segment, and reject `.` and `..` segments
  and any leading whitespace. Give each class above one rejecting test, and keep one test that locks the supported
  shapes.

- [blocking] scripts/lib/ticket-eval.mjs:156 + src/test/__tests__/ticket-eval-never.test.ts:100-112 — the exemption for
  main-session tasks returns before the syntax check. The inner test pins that behaviour: `owns: ["./anything/**"]`
  under `agent: "inline"` is expected to give `[]`. §4 (MF-0044) says: "it may skip only the one rule it exists for,
  and the structure and shape checks run first for every item, exempt or not. Add a plan test: the same malformed item
  inside an exempt set must still fail." What it breaks: a malformed main-session `owns` also feeds the `scope` check
  at line 376, which runs regexes over `owns` and can never match a git path such as `./x`. The NEVER exemption should
  skip only the NEVER overlap. Cost of the fix: across all 43 shipped plans, 0 main-session `owns` entries fail the
  current syntax rules, and SC-3's frozen fixtures are all well-formed, so moving the check before the exemption breaks
  nothing.

- [note] src/test/__tests__/mf-0048-plan-never.acceptance.test.ts (SC-3) — the frozen test does not cover the second
  half of SC-3: "A plan with main-session steps described outside the JSON graph also passes." No test builds such a
  plan. Leaving a main-session step out of the graph also leaves its SC unclosed, and `validatePlan` then reports
  `SC-n is closed by no task` (line ~236). So either the clause means something narrower, or it is unmet. The frozen
  test is not wrong, only incomplete: settle what the clause means and either test it in the inner suite or reword the
  SC.

- [note] SC-4 proof is weak. The frozen test compares `NEVER_GLOBS` to a literal list and checks that each entry
  produces one error. A copied list in ticket-eval would pass it too. The code does import the list
  (ticket-eval.mjs:10), so the intent is met, but no test proves one owner. The test is not wrong.

- [note] .claude/hooks/lib/agent-scopes.mjs:52 — `NEVER_GLOBS` is exported as a mutable array. `NEVER` is compiled
  from it once at load, so if a consumer calls `push` or `splice` on it, `validatePlan` changes but `scopeDecision`
  does not, and the two owners split. `Object.freeze([...])` closes this (engineering-principles §3, immutability by
  default).

- [note] pre-existing, outside this ticket: `scopeDecision` matches NEVER case-sensitively, and `toRel`
  (gate-io.mjs:27) keeps the caller's case. On Windows a role agent writing `Scripts/x.mjs` gets past the hook and NTFS
  writes `scripts/x.mjs`. Worth a ticket: hand it to MF-0060's owner or raise a new one.

- [note] scope and other agent names. The diff stays inside the plan's `owns`, and gate:planning is not wired in
  (MF-0060, C-1). Two other observations, also pre-existing and outside this ticket:
  - shipped plans also use `fork` (14), `general-purpose` (12), `verifier` (14), `human` and `human+orchestrator`. All
    are still `unknown agent`.
  - `verifier` is a hook-scoped role in `SCOPES` but not in `PLAN_AGENTS`.

## Verified (no finding)

- globsOverlap soundness against the hook's semantics (util.mjs `globToRegExp`, where `**/` is `(?:.*/)?`). Every
  glob of up to 4 tokens over {a, b, /, ., *, ?, **} (2,508 globs, 3,146,286 unordered pairs) was compared with an
  explicit witness search over all 87,381 paths of length up to 8 over {a, b, /, .}:
  - 0 false negatives, 0 asymmetries.
  - 0 cases where `globsOverlap` was true but no witness of length up to 8 exists under ticket-eval's looser regex.
    So the product search is exact for the looser semantics, which contain the hook's.

  A further 4,000 random pairs of up to 7 tokens (adding `**/` and `/**`), each with a sampled witness search, also
  gave 0 false negatives.
- Termination and performance: the state set is at most (|A|+1)(|B|+1) with a `seen` set, so the search always
  terminates. Timings:
  - a 150,000-char owns entry against all 8 NEVER globs: 308 ms
  - 9k chars of `**/`: 21 ms

  `queue.shift()` is O(n), but the NEVER side is at most about 30 tokens, so cost stays linear in the owns length.
- SC-1 and SC-2 are met in intent: MF-0013 gives exactly T1 and T6. SC-4 `scopeDecision` behaviour is unchanged:
  `NEVER` is the same `globToRegExp` map over the same 8 strings.
- Test and tool runs:
  - `vitest` on both test files: 33/33 pass
  - `node scripts/check-hooks.mjs`: PASS
  - `pnpm typecheck`: exit 0
  - `biome check` on the changed files: clean

## Round 2 (delta)

Hash recipe unchanged (run in the repo root, REVIEW.md excluded). Delta read: `scripts/lib/ticket-eval.mjs`
(`OWNS_SEGMENT`, `expandBraces`, `ownsSyntaxProblem`, `ownsNeverProblems`), `.claude/hooks/lib/agent-scopes.mjs`
(`Object.freeze`), and `src/test/__tests__/ticket-eval-never.test.ts`.

### Round-1 findings

- B1 (blocklist): **fixed.** `OWNS_SEGMENT` (ticket-eval.mjs:136) is now an allowlist of segment shapes, and `.` and `..`
  segments are rejected explicitly (:181). I re-ran every round-1 probe under `agent: "service-builder"`, and each one now
  gives an error:
  - `owns` syntax errors: `src/../scripts/x.mjs`, `C:/Users/x/scripts/x.mjs`, ` scripts/x.mjs`, `[s]cripts/x.mjs`, `~/x`.
  - NEVER errors (folded case): `Scripts/x.mjs`, `PACKAGE.JSON`, `.Claude/settings.json`.
  - NEVER error (every alternative checked): `{scripts,src}/x.mjs`.

  The inner suite has one rejecting test per class, plus a test that locks the supported shapes.
- B2 (exemption skipped syntax): **fixed.** The syntax check runs before `if (isMainSession) continue` (:211). Under both
  `inline` and `orchestrator`:
  - `./anything/**`, `src/../x`, `{a,{b,c}}`, `a b` and `42` are rejected.
  - `scripts/**` and `.claude/**` pass, as intended.

  The inner test now pins this, and no longer pins the old behaviour.
- Note (mutable NEVER_GLOBS): **fixed.** `NEVER_GLOBS.push("x")` throws `TypeError`, and a test covers it.
- Notes on the SC-3 second clause, the weak SC-4 proof, hook case-sensitivity, and the other agent names: not in this
  delta. They still stand as notes.

### Fail-open hunt (role agent, `validatePlan` gives no error, yet a reading reaches NEVER): none found

| Shape | Probes | Result |
|---|---|---|
| empty brace alternatives | `{,scripts}/x.mjs`, `src/{,x}`, `a/{b,}/c`, `{}`, `{,}` | rejected (empty segment) |
| commas outside braces | `scripts,src/x` | rejected (`,` not in allowlist) |
| unbalanced or inverted braces | `{scripts/x.mjs`, `scripts}/x`, `}{scripts,a}`, `}}{{a}}` | rejected: no brace char is in `OWNS_SEGMENT`, so any leftover `{`/`}` fails |
| nesting and blow-up | `{a,{b,c}}`; 7 sets x 2 alternatives (128) | rejected; 64 still passes |
| `**` next to braces | `**{scripts,x}` | rejected (`**scripts` is not whole-segment) |
|  | `{**,x}/y`, `{**}/x.mjs` | NEVER error |
| case folding, non-ASCII | Kelvin sign `K`, `İ`, ZWSP, NUL | rejected: `\w` has no `u` flag, so the allowlist is ASCII-only and `toLowerCase` (:212) only ever sees ASCII, where it matches NTFS/APFS folding |
| Next.js segments as regex | `(scripts)/x.mjs`, `[scripts]/x.mjs`, `[...scripts]/x` | pass, harmless: both `globToRegExp`s (ticket-eval.mjs:59, hooks util.mjs:10) escape `()[]`, so these are literal directory names. A `[x]` read as a char class would match one char, and no NEVER segment is one char long |
| dot runs | `...`, `scripts./x.mjs`, `package.json.`, `.claude./settings.json` | pass, but probed on this Windows box: Node `fs` does **not** strip trailing dots here. `scripts./a.mjs` gives ENOENT; `package.json.` and `...` are created as literal names; `package.json` is untouched. Bash behaves the same. So no reading reaches a NEVER path |

### Checks run

- `vitest` on `ticket-eval-never.test.ts` and the frozen `mf-0048-plan-never.acceptance.test.ts`: 47/47 pass.

### Notes (non-blocking)

- [note] scripts/lib/ticket-eval.mjs:178. `{}` and `{,}` expand to `""` and report `is not a non-empty string`. This fails
  closed, but the message points at the wrong cause (an empty brace set or alternative).
- [note] Fail-closed false rejections in shipped plans. MF-0039 T3–T5 use `…/D2.S1.yaml`; the inner test rejects this on
  purpose. Many historical role-agent tasks own `scripts/**`, `package.json` or evidence (for example MF-0004, MF-0017,
  MF-0028, MF-0058). That is expected, and harmless while gate:planning is not wired over old plans (MF-0060).
- [note] Pre-existing, outside this ticket: ticket-eval.mjs:424, the `scope` check, compiles raw `owns` with
  `globToRegExp`, which escapes `{}`. So a brace entry such as `src/features/{duel,walk}/**` matches no real path there.
  That is a false "outside owns", not a fail-open. Brace expansion now lives only in `ownsNeverProblems`; the scope
  check would need it too.
- [note] Pre-existing, outside this ticket: `.git/**` is not in `NEVER_GLOBS`, so `owns: [".git/hooks/pre-commit"]` passes
  for a role agent. The hook's per-agent `SCOPES` still confine role agents, so NEVER is the second line. Worth adding to
  NEVER in a follow-up.

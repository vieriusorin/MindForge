# MF-0048 LOOP-PLAN (iteration 0)

## Discovery

- `scripts/lib/ticket-eval.mjs`: `PLAN_AGENTS`, `globToRegExp`, `parsePlanTasks`, `validatePlan(tasks, scIds)` returning
  `string[]`. Its only caller is `evaluateTicket`, which nothing calls (F-1).
- `.claude/hooks/lib/agent-scopes.mjs`: `SCOPES` (exported), `NEVER` (private, regexes), `scopeDecision`. The PreToolUse
  hook `agent-scope.mjs` applies it.
- Both files are guarded (`PROTECTED` in gate-core: `scripts/lib/ticket-eval.mjs`; `.claude/hooks/**`).
- Precedent: MF-0043 (fail-closed parser plus a `rejected` list); verification.md §4 (MF-0046 retro: allowlist, not
  blocklist).

## SC → steps

| SC | Step | Proof |
|---|---|---|
| SC-4 | T1 `agent-scopes.mjs`: `export const NEVER_GLOBS` (the 8 strings); `NEVER = NEVER_GLOBS.map(globToRegExp)`; `scopeDecision` unchanged | acceptance SC-4, check-hooks |
| SC-1, SC-2, SC-3 | T2 `ticket-eval.mjs`: `MAIN_SESSION_AGENTS = ["inline", "orchestrator"]`; `validatePlan` accepts them; for every role-agent task × owns × NEVER glob, `globsOverlap` → error | acceptance SC-1..3 + inner tests `ticket-eval-never.test.ts` |

## The overlap rule (allowlist)

`globsOverlap(a, b)` says whether some repo-relative path matches both globs, under the same semantics as
`globToRegExp`: `*` is any run inside one segment, `?` is one non-`/` char, `**` as a whole segment is any number of
segments, and every other char is literal.

- Segment level: split on `/`, then a two-pointer DP where a `**` token may consume zero or more segments of the other
  side.
- Character level: a DP over two single-segment patterns, where `*` consumes any run of the other side and `?` matches
  one char.

Accepted owns syntax for a role agent: repo-relative POSIX segments of literals, `*` and `?`, plus whole-segment `**`.
Anything else is an error that names the task:
- an empty string or a non-string;
- a leading `/`, `./` or `../`, or a `\`;
- `**` inside a segment with other chars;
- an empty segment.

This is fail-closed (§4).

Error text: `T1: schema-builder may not own scripts/sync-question-keys.mjs: it can match NEVER glob scripts/** (role
agents never write it; agent-scopes.mjs)`.

## Riskiest step

The overlap DP answering "no overlap" for a pair that does overlap. That would be a false pass for exactly the plans
this ticket exists to stop. Mitigations:
- inner tests per case: exact path, glob inside, glob covering, `?`, `**` at the start, middle and end, a NEVER file
  glob `.planning/tasks/*/FROZEN.json` against `.planning/**`;
- a brute-force cross-check test that compares `globsOverlap` with enumerating sample paths through `globToRegExp`
  for the 8 NEVER globs × a set of owns globs.

Nothing writes or deletes, so there is no re-run state.

## Rejected options

- Testing only the owns string against the NEVER regexes: misses a covering glob (`**/*.json` covers `package.json`).
- Copying the NEVER list into ticket-eval: two owners (Constraint).
- Wiring into `gate:planning`: that is MF-0060 (C-1).

## Symbols changed

- `validatePlan`
- `PLAN_AGENTS` (unchanged; main-session names added beside it)
- `scopeDecision` (file changes, behaviour unchanged)

## Frozen files this will re-freeze

None (see the collisions line in the Iteration Log).

```json tasks
[
  {"id": "T1", "agent": "orchestrator", "owns": [".claude/hooks/lib/agent-scopes.mjs"], "depends_on": [], "closes": ["SC-4"], "done_when": "acceptance SC-4 green; check-hooks PASS", "context": "guarded hook lib"},
  {"id": "T2", "agent": "orchestrator", "owns": ["scripts/lib/ticket-eval.mjs", "src/test/__tests__/ticket-eval-never.test.ts"], "depends_on": ["T1"], "closes": ["SC-1", "SC-2", "SC-3"], "done_when": "acceptance SC-1..3 green", "context": "guarded gate lib"},
  {"id": "T3", "agent": "orchestrator", "owns": [".planning/evidence/MF-0048.md"], "depends_on": ["T2"], "closes": [], "done_when": "evidence written", "context": "records"}
]
```

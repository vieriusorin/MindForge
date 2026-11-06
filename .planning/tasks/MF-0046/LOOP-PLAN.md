# MF-0046 LOOP-PLAN (iteration 0)

## Discovery

- Precedent: MF-0044 `check:packs` key-length rule (fixture through an env var, spawns the real script) and
  `scripts/check-hooks.mjs` (node built-ins only, plain stdout summary, exit 1 with names).
- `.claude/hooks/stop-gate.mjs` ~line 156 runs every `gate:*` script except `gate:client-bundle`. Gates are triggered
  by `isRelevantSource` (`.claude/hooks/lib/gate-core.mjs` line 42).
- Guarded paths: `scripts/check-*.mjs`, `.claude/hooks/**`, `.github/workflows/ci.yml` (the PROTECTED list in
  gate-core).
- Before Install, CI has no `node_modules` (F-4), so only `node:` imports are allowed.

## SC → steps

| SC | Step | Proof |
|---|---|---|
| SC-1, SC-2, SC-3 | T1 `scripts/check-workspace.mjs`, plus `"gate:workspace"` in package.json | `src/test/__tests__/mf-0046-workspace-check.acceptance.test.ts` (frozen) |
| SC-4 | T2 ci.yml step `Workspace check` before `Install` in `checks` | the diff, plus the PR run (user) |
| SC-5 | T3 `isRelevantSource`: true for the exact path `pnpm-workspace.yaml` | same acceptance file (SC-5 case) + check-hooks |
| SC-6 | T0 split MF-0059 / MF-0061 (done) | `pnpm gate:planning`, mf-0028 SC-4, mf-0053 SC-5 |

## Parser (T1)

Read the file as text (CRLF → LF):
1. Any line matching `/set this to true or false/i` → problem `<file>:<n>: pnpm placeholder "…"`. This matches
   anywhere in the file, not only in `allowBuilds`.
2. Find the `allowBuilds:` line at column 0.
   - Nothing after the colon except a comment means block style.
   - Anything else (flow `{…}`, a scalar) → problem: `allowBuilds must be a block map`.
   - No `allowBuilds` key → ok, with 0 entries.
3. Block lines run until the next column-0 non-comment line. A blank line or a comment line is skipped. Each other
   line must match `^ {2,}(<key>):\s*(<value>)\s*(#.*)?$`.
   - `<key>` is a bare `[\w@./-]+`, or single- or double-quoted.
   - `<value>` must be exactly `true` or `false`. Otherwise → problem `allowBuilds.<key>: value "<v>" is not true or
     false`.
   - A line that does not match → problem `<file>:<n>: cannot read allowBuilds line`.
4. File missing → problem, exit 1. Problems go to stderr, one per line. The summary goes to stdout:
   `gate:workspace: <N> allowBuilds entries, ok`, or `gate:workspace: <K> problem(s)`.
5. `MF_WORKSPACE_FILE` overrides the path. An empty value means the default.

Rejected inputs (each one a test, verification.md §4): `yes`, quoted `"true"`, empty value, flow map, a nested line
(`esbuild:` followed by a deeper-indented child), a tab-indented line, the placeholder outside `allowBuilds`.

## Riskiest step

The parser silently accepting a shape it does not understand, which would be a false green for exactly the class of
merge edit it exists to catch. Mitigation: a whitelist line grammar. Any block line that is not blank, a comment or
`key: true|false` is a problem.

Nothing writes or deletes, so there is no re-run state and no versioned judgement.

## Rejected options

- The `yaml` package: it is unavailable before Install (F-4).
- Running `pnpm install --frozen-lockfile --lockfile-only` in the gate: needs the network and is slow in a Stop hook;
  CI already runs it.
- A `stop-gate.mjs` edit to call the script: the `gate:` prefix does it already (C-1).

## Symbols changed

- `isRelevantSource`: now true for pnpm-workspace.yaml (path grepped by hand: no acceptance test names it).

## Frozen files this will re-freeze

None (see the `pnpm ticket:collisions MF-0046` result in the Iteration Log).

```json tasks
[
  {"id": "T0", "agent": "orchestrator", "owns": [".planning/tasks/MF-0059/GOAL.md", ".planning/tasks/MF-0061/GOAL.md", "scripts/lib/key-length.mjs"], "depends_on": [], "closes": ["SC-6"], "done_when": "pnpm gate:planning exit 0", "context": "F-5"},
  {"id": "T1", "agent": "service-builder", "owns": ["scripts/check-workspace.mjs", "package.json"], "depends_on": [], "closes": ["SC-1", "SC-2", "SC-3"], "done_when": "acceptance SC-1..3 green", "context": "Parser section"},
  {"id": "T2", "agent": "orchestrator", "owns": [".github/workflows/ci.yml"], "depends_on": ["T1"], "closes": ["SC-4"], "done_when": "step before Install in checks", "context": "guarded edit"},
  {"id": "T3", "agent": "orchestrator", "owns": [".claude/hooks/lib/gate-core.mjs"], "depends_on": [], "closes": ["SC-5"], "done_when": "acceptance SC-5 green; check-hooks PASS", "context": "guarded edit"}
]
```

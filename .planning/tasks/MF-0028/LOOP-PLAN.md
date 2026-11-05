# MF-0028 LOOP-PLAN — iteration 1 (C-3: also flag repeated tier/stage/goal_status)

## Discovery

- Precedent: MF-0036 (`scripts/lib/cuckoo-grounding.mjs` pure + `scripts/check-pack-grounding.mjs` CLI,
  tested from `src/test/__tests__/` because vitest only includes `src/**/__tests__/**`).
- Stop gate: `stop-gate.mjs:155-157` runs every `gate:*` script except `gate:client-bundle`; there are none
  today. It only runs when the session touched a source file outside `.planning/` (`gate-core.mjs:38-39`).
- Guarded: `scripts/check-*.mjs`, `.github/`, `.claude/hooks/` (`gate-core.mjs:51-77`). Not guarded:
  `scripts/lib/planning-check.mjs`, `package.json`, `docs/runbook/ci.md`.
- CI `checks` job (`.github/workflows/ci.yml`): install → typecheck → lint → test → hooks check → build.
  Runbook mirrors it at `docs/runbook/ci.md:11` and `:57`.

## Frozen files this will re-freeze

- None. `mf-0005-ci.acceptance.test.ts` SC-1 asserts the listed commands appear in ascending order; a
  `pnpm gate:planning` step between the hooks check and build keeps it green. No frozen test asserts the
  `package.json` script set (`mf-0004` reads only `scripts.dev`).

## Steps

1. `scripts/lib/planning-check.mjs`: `checkPlanning(entries)`: per entry with text, LF-normalise, collect
   `/^ticket_id:(.*)$/gm`; 0 → `<dir>: no ticket_id line`; >1 → `<dir>: N ticket_id lines (…ids)`; 1 → strip
   ` # comment`, trim, strip one pair of quotes; ≠ dir → `<dir>: ticket_id <id> is not the folder name`.
   Iteration 1 (C-3): also any of `tier` / `stage` / `goal_status` at column 0 more than once; one line per
   folder, findings joined with `; `.
2. `package.json`: `"gate:planning": "node scripts/check-planning.mjs"`.
3. `.github/workflows/ci.yml`: step `Planning check` → `pnpm gate:planning` after `Hooks check` (guarded; user
   approved under C-1).
4. `docs/runbook/ci.md` lines 11 and 57: add the step.

## Riskiest step

Step 3: a CI edit that breaks MF-0005's frozen order test or the workflow itself. Mitigation: run the MF-0005
acceptance test after the edit; the step uses only `pnpm`, already set up in the job.
Re-run safety (seed/sync rule): not applicable, the check writes nothing.

## Rejected options

- Editing the Stop gate to run on `.planning/` changes: guarded hook, and it would still miss GitHub merges.
- Parsing YAML front matter properly: the collision puts the second ticket in the body, so a front-matter
  parser would miss exactly the case this exists for.
- Skipping fenced blocks: rejected by the user (C-2).

```json tasks
[
  { "id": "T1", "agent": "service-builder", "owns": ["scripts/lib/planning-check.mjs"], "depends_on": [], "closes": ["SC-1", "SC-2", "SC-3", "SC-4"], "done_when": "mf-0028 acceptance SC-1…SC-4 green", "context": "GOAL edge table" },
  { "id": "T2", "agent": "service-builder", "owns": ["package.json"], "depends_on": ["T1"], "closes": ["SC-5"], "done_when": "SC-5 green", "context": "" },
  { "id": "T3", "agent": "service-builder", "owns": [".github/workflows/ci.yml", "docs/runbook/ci.md"], "depends_on": ["T2"], "closes": ["SC-6"], "done_when": "mf-0005 acceptance green; step present", "context": "C-1" },
  { "id": "T4", "agent": "verifier", "owns": [], "depends_on": ["T3"], "closes": ["SC-7"], "done_when": "typecheck, lint, test, check-hooks, gate:planning green", "context": "" }
]
```

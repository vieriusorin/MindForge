# MF-0046 LOOP-VERIFY

## RED at freeze (2026-11-06)

`pnpm exec vitest run src/test/__tests__/mf-0046-workspace-check.acceptance.test.ts`, against the stub
`scripts/check-workspace.mjs` (exits 0, no output) and the unchanged `isRelevantSource`:

```
× SC-1 … AssertionError: expected +0 to be 1      (placeholder fixture exits 0: no check yet)
× SC-2 … AssertionError: packages: … expected +0 to be 1   (first bad shape, `esbuild: yes`, exits 0)
× SC-3 … AssertionError: expected +0 to be 1      (71ac090 proof case exits 0)
× SC-5 … AssertionError: expected false to be true (yaml is not a Stop-gate source)
Tests  4 failed (4)
```

Each red is the SC's own: exit status / predicate, not a missing file or import (typecheck 0, lint 0). Full
`pnpm test`: 1 file failed (this one) | 175 passed; 4 failed | 928 passed.

## Review fixes: RED first (round 1, changes-requested)

`src/test/__tests__/check-workspace.test.ts` written against the round-1 script, before any fix:

```
× B1: a # with no space before it is part of the value, not a comment       expected +0 to be 1
× B2: finds the block behind a BOM or a quoted key, never reads it as none found   (BOM case) exit 0
× B2: any other top-level line naming allowBuilds fails closed              expected +0 to be 1
× B3: a second allowBuilds block and a document marker fail                 expected +0 to be 1
× minor: a consistent four-space indent is valid; a deeper line under an entry is not   expected 1 to be +0
× nit: a directory path is a named problem, not a stack trace               stderr 'node:fs:440 … return binding.rea…'
Tests  6 failed (6)
```

After the parser rewrite: 10 passed (6 regression + 4 frozen). The frozen file's sha256 is unchanged (`36f70636…`).

## Review rounds 2-3: RED first

- Round 2 (4 blocking + 1 minor): 5 new cases in `check-workspace.test.ts` RED 5/5 against the round-1 fix
  (`expected +0 to be 1` ×4, JSON-style case exit 0), then green.
- Round 3 (R3-B1, 11 inputs: anchored/tagged/indented/explicit-key roots, escaped and line-folded keys, duplicate
  top-level key): `R3-B1` case RED (`&a {"x #": 1, allowBuilds: {esbuild: maybe}}` exit 0), then the parser became an
  allowlist of line shapes; a supported-shapes lock (`R3`) was added and kept green.
- Round 4: approve, reviewed_hash `ea4e6383…`. Later changes are records only (GOAL, LOOP-VERIFY, evidence, RETRO).

## SC table

| SC | Verdict | Evidence |
|---|---|---|
| SC-1 | PASS | frozen SC-1 green: placeholder fixture exit 1, stderr names `esbuild` and the file |
| SC-2 | PASS | frozen SC-2 green: 7 bad shapes and a missing file exit 1; a valid file gives `4 allowBuilds entries, ok` |
| SC-3 | PASS | frozen SC-3 green; CLI: `proof.yaml:5: allowBuilds.esbuild: value "set this to true or false" is not true or false`, exit 1; repo `gate:workspace: 4 allowBuilds entries, ok` |
| SC-4 | PASS (diff); live run pending push | ci.yml parsed: `checkout · action-setup · setup-node · Workspace check · Install · …` |
| SC-5 | PASS | frozen SC-5 green; `check-hooks: PASS` |
| SC-6 | PASS | `gate:planning: 60 ticket folders checked, ok`; mf-0028 / mf-0053 green in the full run |

## Receipt (2026-11-06, after round 3 fixes; round 4 approved this tree)

`pnpm typecheck` exit 0 · `pnpm lint` exit 0 · `gate:planning` PASS · `gate:workspace` PASS ·
`node scripts/check-hooks.mjs` PASS · `pnpm test`: Test Files 177 passed (177), Tests 945 passed (945) ·
`pnpm install --frozen-lockfile --offline` exit 0. No `ticket:verify` script: run by hand.

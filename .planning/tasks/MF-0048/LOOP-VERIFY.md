# MF-0048 LOOP-VERIFY

## RED at freeze (2026-11-06)

`pnpm exec vitest run src/test/__tests__/mf-0048-plan-never.acceptance.test.ts` against the unchanged `validatePlan`
and the stub `export const NEVER_GLOBS = []`:

```
× SC-1 … AssertionError: expected [] to deeply equal [ Array(1) ]
× SC-2 … AssertionError: expected [] to have a length of 2 but got +0
× SC-3 … AssertionError: expected [ 'T1: unknown agent "inline"', …(1) ] to deeply equal []
× SC-4 … AssertionError: expected [] to deeply equal [ '.planning/evidence/**', …(7) ]
Tests  4 failed (4)
```

Each is the SC's own red (no rule, main-session agents rejected, stub list); typecheck 0, lint 0, check-hooks PASS.
Full `pnpm test`: 1 failed (this file) | 177 passed; 4 failed | 945 passed.

## Review fixes: RED first

- Round 1 (changes-requested): `ticket-eval-never.test.ts` gained 11 cases (interior `..`, `./`, drive path, leading
  space, braces, class, space, case variants, main-session syntax, frozen list): RED 11/11 against the round-1 code,
  then green after the allowlist rewrite.
- Brace sets: 1 case RED (`{questions,cards,diagrams}` rejected), then green after `expandBraces`.
- Round 2: approve, reviewed_hash `32a1f79e…`. Later changes are records only.

## SC table

| SC | Verdict | Evidence |
|---|---|---|
| SC-1 | PASS | frozen SC-1 green: exact, inside and covering globs flagged with task, agent, path |
| SC-2 | PASS | frozen SC-2 green; CLI on the MF-0013 plan prints exactly T1 and T6 |
| SC-3 | PASS | frozen SC-3 green: `inline`/`orchestrator` own NEVER paths, no errors (still held to syntax) |
| SC-4 | PASS | frozen SC-4 green; `NEVER_GLOBS` frozen and imported by ticket-eval; `check-hooks: PASS` |

## Receipt (2026-11-06; round 2 approved this tree)

`pnpm typecheck` exit 0 · `pnpm lint` exit 0 · `gate:planning` PASS · `gate:workspace` PASS ·
`node scripts/check-hooks.mjs` PASS · `pnpm test`: Test Files 179 passed (179), Tests 992 passed (992). Frozen sha
unchanged (`ddf97c77…`). No `ticket:verify` script: run by hand.

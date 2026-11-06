---
ticket_id: MF-0043
iteration: 0
---

# LOOP-VERIFY — MF-0043

## Baseline (2026-11-06, before any change)

`pnpm typecheck` exit 0 · `pnpm lint` exit 0 · `pnpm test` 154 files / 766 passed · `pnpm gate:planning` ok
(56 folders) · `main` CI last 3 runs `success`.

## Proof-case replay (before freeze)

Throwaway probe of the drafted rule over `git archive da583a0` (pre-MF-0032 tree), builds_on
MF-0003, MF-0007, MF-0009, MF-0016:
- plan without the MF-0008 row → `mf-0008-schema.acceptance.test.ts:10` and `:70`, exit 1 (RED);
- plan with the MF-0008 row → no hits, exit 0 (GREEN).

## RED at freeze (2026-11-06)

- `src/test/__tests__/mf-0043-frozen-collisions.acceptance.test.ts`: 5/5 fail with `Error: not implemented`
  (the `checkFrozenCollisions` stub in `scripts/lib/frozen-collisions.mjs`); identical on a 2nd run.
- `pnpm typecheck` exit 0 and `pnpm lint` exit 0 with the stub in place (one `noTemplateCurlyInString` warning on
  the verbatim MF-0032 row, suppressed with a reason before hashing).
- Whole `pnpm test`: the only reds are these 5 cases (`Tests 5 failed | 766 passed`).

## Review rounds (fresh-context `diff-reviewer`, REVIEW.md)

- Round 1 (changes-requested, 3 blocking): unusable symbol tokens dropped silently → exit 0; a `###` subheading
  emptied the Symbols section; skill text lost the "as literals" grep. Minor: own-ticket exclusion hid a foreign
  re-frozen file (MF-0021/MF-0011), trigger wording, per-file listing, receipts.
- Regression tests RED before the fixes (`frozen-collisions.test.ts`, 9 cases): `expected +0 to be 2` (×2, unusable
  tokens), `expected [] to deeply equal [ {…} ]` (call form; foreign file), 2 hits instead of 1 for `x-not-in-pack`,
  plus the new parseSymbols shape. The first B2 fix turned frozen SC-1/SC-2 to exit 2 (MF-0032 layout puts
  `### Frozen files…` under `## Symbols changed`); the rule, not the frozen file, was changed.
- Round 2 (changes-requested, 1 blocking): `Promise<PackContent>` kept only `Promise`. RED: `symbols: ['Promise', …]`;
  re-freeze section over `### Steps` listed a path (`['src/a/x.acceptance.test.ts']`). Fixed: generics and name-indexes
  rejected (exit 2), call form `\([^()]*\)`, re-freeze section ends at any heading.
- Round 3: **approve**, `reviewed_hash: d6db2267…490b265d`. Post-review changes: `.planning/` records only.

## Receipt (2026-11-06, the reviewed code tree)

| Check | Result |
|---|---|
| `pnpm typecheck` | exit 0 |
| `pnpm lint` | exit 0 (639 files) |
| `pnpm test` | 156 files / 792 passed |
| `pnpm gate:planning` | ok (56 folders) |
| frozen file hash | `95773a9b…` = FROZEN.json (unedited) |

## Success Criteria

| SC | Proof | Result |
|---|---|---|
| SC-1 | frozen file case SC-1; real lib on `git archive da583a0` + MF-0032 plan without the MF-0008 row: `mf-0008-schema.acceptance.test.ts:10`, `:70`, code 1 | pass |
| SC-2 | frozen case SC-2; same replay with the MF-0008 row: code 0, `no unlisted collisions for toPlayableQuestion across 37 file(s)` | pass |
| SC-3 | frozen case SC-3 + inner `parseListedPaths` cases | pass |
| SC-4 | frozen case SC-4 + inner `findHits` cases (`$`, CRLF, hyphenated literal) + foreign re-frozen file case | pass |
| SC-5 | frozen case SC-5 + inner input-error cases (rejected token, no backticks without "None.", unfilled template → 2) | pass |
| SC-6 | `pnpm ticket:collisions MF-0043` → `Symbols changed says None.`, exit 0. Note: it scans nothing (this plan changes no existing symbol); the scanning path through real files is the SC-1/SC-2 replay | pass |
| SC-7 | `SKILL.md:251` (Stage 2 step 6) and `SKILL.md:344` (Stage 3a) name `pnpm ticket:collisions <ID>`; `templates.md:94` `## Symbols changed`, `:102` `## Frozen files this will re-freeze`; reviewed | pass |
| SC-8 | receipt above | pass |

## Not verified

- `LABEL["not-in-pack"]` is searched as `LABEL` only (reviewer note, non-blocking): list a member you change on its
  own (`not-in-pack`).
- `pnpm ticket:github` (claim and status sync) not run: the `gh` token lacks `read:project`.

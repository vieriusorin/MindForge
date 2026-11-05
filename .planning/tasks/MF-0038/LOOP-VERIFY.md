# MF-0038 LOOP-VERIFY

## RED at freeze (2026-11-04)

`pnpm exec vitest run --project unit src/engine/content/__tests__/mf-0038-platform-foundations.acceptance.test.ts`
(TYPECHECK green for the file; biome check clean before hashing)

```
× SC-1: pack.yaml follows the blueprint
× SC-2: content loads and every citation is one of its skill's sources
× SC-3: per skill ≥ 6 questions (≥ 2 per level), ≥ 1 card, ≥ 1 diagram; provenance, level and id prefix on every item
× SC-4: ≥ 54 questions, options A–D, select 1, distinct texts, no answer letter keys more than 40%
× SC-5: every diagram has ≥ 4 nodes and every node is on an edge
× SC-6: a D2.S1 capstone diagram links the four decisions in order, with a loop back from context
× SC-7: every skill has ≥ 1 expert question citing a platform.claude.com page
Error: ENOENT: no such file or directory, open '…/packs/platform-foundations/pack.yaml'
Error: ENOENT: no such file or directory, scandir '…/packs/platform-foundations/questions'
Error: ENOENT: no such file or directory, scandir '…/packs/platform-foundations/diagrams'
Tests  7 failed (7)
```

Each red is the SC's own: the pack does not exist yet. No typo or fixture red.

## Iteration 0 — receipt (2026-11-04, 15:14Z)

`ticket:verify` is not in package.json; defaults run by hand. Scope hash = sha256 over the 30 MF-0038 files
(`packs/platform-foundations/**`, `docs/plan/platform-foundations-validation.md`, the acceptance test), sorted:
`6ef7f475effc5349de9108aad136809fb96682cfa05c8360e3fe22ace6de7231`. Frozen file hash unchanged: `893b0db7…f144` (= FROZEN.json).

| Check | Command | Result |
|---|---|---|
| Acceptance | vitest unit mf-0038 | 7 passed (7) |
| TYPECHECK | `pnpm typecheck` | exit 0 |
| LINT | `pnpm lint` | exit 0, "Checked 461 files … No fixes applied." |
| TEST | `pnpm test` | exit 0, "Test Files 97 passed (97) · Tests 416 passed (416)" (baseline reds of MF-0032/0037 resolved by their sessions) |
| BUILD | `pnpm build` | exit 0 |
| GATE | `pnpm check:packs` | exit 0, "7 cuckoo file(s), 0 problem(s)" (no cuckoos in this pack) |

| SC | Verdict | Evidence |
|---|---|---|
| SC-1…SC-7 | PASS | frozen acceptance 7/7 |
| SC-8 | PASS | overlap check vs `Associate_M1_vF2.html` text: `files=28 n=12 overlaps=0` (also n=8: 0); positive control on a planted course sentence: 8 hits |
| SC-9 | PASS | 3 fresh verifiers: G1 16/7/2, G2 14/8/2, G3 12/6/4 (OK/NOTE/FIX); all 8 FIX rewritten, keys unchanged; reports in `verify/` |
| SC-10 | PASS | sync: `platform-foundations: 54 key(s) synced · 73 item(s) registered`; read-back keys 54 (md5 6cd24f58…), items 73 (content md5 ea3ea2ac…); after re-run identical, `hash_synced_at` unchanged (only `updated_at` moves, existing upsert) |
| SC-11 | PASS | `Seeded "Demo study group · Claude Platform & Model Foundations": 861 answers, 5 reviews`; read-back group d2f7a67d…, 6 members, 861 attempts over 54 questions, 0 on unknown keys; dev-seed db tests 13/13 before the run |
| SC-12 | PARTIAL | shared browser held ("browser is already running"); HTTP render as steady@mindforge-demo.test: `/review/platform-foundations` 200, "70 in your queue", D4.S1 nature card rendered in full (simply / in nature / where it breaks / contrast / sources); group page lists the 5 domains with weights. React Flow drawing NOT seen |
| SC-13 | PASS | `docs/plan/platform-foundations-validation.md` |
| SC-14 | PASS | receipt above |

Verdict: DONE for this tree, with SC-12 partial (diagram drawing unverified).

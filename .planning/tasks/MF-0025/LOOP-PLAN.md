---
ticket_id: MF-0025
iteration: 1
---

# LOOP-PLAN — MF-0025 orphaned keys of a removed pack

## Discovery

- `scripts/sync-question-keys.mjs`: transaction 1 upserts `private.packs` and deletes unregistered
  slugs (`pack_skills` cascades by FK). Per-pack transactions then replace keys + items **scoped to the
  pack** (`where pack_slug = ${pack}`), so rows of a slug with no folder are never visited.
- No FK from `question_keys` / `items` to `packs`. `item_reviews`, `flag_resolutions`,
  `analogy_approvals` cascade from `items` (MF-0007). `attempts` / `storms` hold ids by value.
- Callers that run the sync with a fixture folder (MF-0012, MF-0016, MF-0024, MF-0025 tests) copy every
  real pack into it, so no real pack becomes an orphan under test. MF-0003 / MF-0007 tests sync the real
  folder.
- No gate lists this script. No closed set or shared shape widens → no frozen file re-freezes
  (grep of `*.acceptance.test.*` for `pack_slug = any`/orphan: none assert orphan rows survive).

## SC → steps

| SC | Step | Proof |
|---|---|---|
| SC-1, SC-2, SC-5 | S1 | `mf-0025-orphan-keys.db.acceptance.test.ts` |
| SC-3 | S1 (only rows with an unregistered slug are touched) | same file, regression lock |
| SC-4 | S1 places both deletes in the registry `sql.begin` | code read in LOOP-VERIFY |
| SC-6 | — | VERIFY receipt |

## Steps

**S1** `scripts/sync-question-keys.mjs`, inside the first `sql.begin` right after
`delete from private.packs where not (slug = any(${packs}))`:

```js
// MF-0025: a removed pack's keys and items go with its registry row (reviews cascade, C-1 = A).
await tx`delete from private.question_keys where not (pack_slug = any(${packs}))`;
await tx`delete from private.items where not (pack_slug = any(${packs}))`;
```

Update the header comment (MF-0025 line) and the MF-0007 comment "packs without a folder here are never
touched" (now false for removed packs). Log `removed N key(s), M item(s) of unregistered packs` so an
operator sees the cascade on a hosted run.

## Riskiest step

S1 deletes on every run, including a hosted `pnpm db:sync-keys`. State this run does NOT own that survives:
(a) review verdicts / flag resolutions / analogy approvals made by maintainers on a removed pack's items:
deleted by cascade — decided by the user (C-1 = A); tested by SC-5.
(b) attempts / storms of learners: not touched (no FK); tested by SC-2 (attempt kept).
(c) failure order: the validator runs over ALL packs before the connection, unchanged (frozen MF-0012
SC-5, MF-0024 SC-3 assert a refused run changes no row, including no orphan delete). The orphan deletes
sit in transaction 1, before any per-pack write; a later per-pack failure leaves them committed, which is
correct (those packs are removed regardless of other packs).
Remote: the existing guard (main + clean `packs/`) is what keeps a partial folder from orphaning a real
pack on a hosted DB; unchanged.

## Rejected options

- FK `pack_slug → private.packs on delete cascade` (migration): same result, makes the ticket high-risk
  (schema) and the insert order matters for every future writer.
- Deleting in the per-pack loop: never visits a removed pack.
- Option B / C of C-1: user chose A.

```json tasks
[
  {
    "id": "T1",
    "agent": "service-builder",
    "owns": ["scripts/sync-question-keys.mjs"],
    "depends_on": [],
    "closes": ["SC-1", "SC-2", "SC-3", "SC-4", "SC-5"],
    "done_when": "mf-0025-orphan-keys.db.acceptance.test.ts green; pnpm test:db green",
    "context": "Step S1 above"
  },
  {
    "id": "T2",
    "agent": "verifier",
    "owns": [".planning/tasks/MF-0025/LOOP-VERIFY.md"],
    "depends_on": ["T1"],
    "closes": ["SC-6"],
    "done_when": "typecheck, lint, test, test:db exit 0 on the current tree",
    "context": "receipt bound to git diff hash"
  }
]
```

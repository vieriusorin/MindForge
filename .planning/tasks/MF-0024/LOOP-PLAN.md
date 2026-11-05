# MF-0024 LOOP-PLAN (iteration 0)

## Discovery

- Ids: zod pattern `^[a-z0-9-]+\.[A-Za-z0-9.]+\.[a-z0-9-]+$` in `src/engine/questions/schema.ts:22` and
  `src/engine/content/schema.ts:14`. A slug is `^[a-z0-9]+(-[a-z0-9]+)*$` (no dot), so "first segment = slug" and
  "starts with `<slug>.`" are the same rule, and distinct slugs give disjoint ids.
- Pack-wide uniqueness: `parseContent` `claim` (`load-content.ts:70`), `parseQuestionFiles` (`load-questions.ts:55`).
- Sync: `scripts/sync-question-keys.mjs` takes `pack_slug` from the folder name (`readdirSync(PACKS_DIR)`),
  validates all packs first via `scripts/lib/validate-packs.mjs` (MF-0012), then one `sql.begin` for all packs.
- Grading RPCs take pack and skill from the key row (MF-0032 `record_attempt`, MF-0013 storms): no RPC change.
- Precedent shape: MF-0012 (validator in the sync; DB test drives the script with `MINDFORGE_PACKS_DIR`).
- Gates: none for these paths (`check:packs` is grounding only). Migration path: `supabase/migrations/`.

## SC → steps

| SC | Steps | Proof |
|---|---|---|
| SC-1, SC-2 | 1, 2 | `mf-0024-id-prefix.acceptance.test.ts` |
| SC-3 | 1, 2, 3 | `mf-0024-id-prefix.db.acceptance.test.ts` (SC-3 cases) |
| SC-4 | 1, 2 | SC-4 lock + `pnpm check:packs` |
| SC-5 | 4 | `mf-0024-id-prefix.db.acceptance.test.ts` (SC-5 cases); MF-0017 DB file green |

## Steps

1. `src/engine/pack/id-prefix.ts`: `export function idPrefixIssue(id: string, slug: string): string | null` →
   `id "<id>" must start with "<slug>."` or null. Export from `src/engine/pack/index.ts`. Inner test
   `src/engine/pack/__tests__/id-prefix.test.ts` (match, other slug, slug-that-shares-a-prefix `a-b.` vs `a`, empty).
2. Loaders call it before the duplicate check: `parseContent` `claim` pushes `${file}: ${path}: ${issue}` and
   skips the item; `parseQuestionFiles` the same with `questions.${i}.id`.
3. `scripts/lib/validate-packs.mjs`: after `loadPackFile`, if `pack.slug !== slug` push
   `${slug}: folder "${slug}" holds pack.yaml slug "${pack.slug}"; rename the folder to its slug` (and skip content).
4. Migration `supabase/migrations/20261105120000_mf0024_id_prefix_check.sql`:
   `alter table private.question_keys add constraint question_keys_id_prefix_check check (split_part(question_id, '.', 1) = pack_slug);`
   and `items_id_prefix_check` on `private.items (item_id)`. Apply with `supabase migration up --local`;
   `pnpm db:types` (expect no diff: CHECKs are not in the types).
5. TEST stage: full `pnpm typecheck && pnpm lint && pnpm test && pnpm test:db`, `pnpm check:packs`,
   `pnpm db:sync-keys` once against the real packs (real command, real input), fresh-context diff review.

## Riskiest step

Step 4 on the **hosted** DB. `add constraint` validates every existing row and aborts the migration on the first
mismatch. Hosted rows come only from the sync of shipped packs (0 mismatches), but a stray test or hand row would
block the deploy. Hand-off runbook: run
`select question_id, pack_slug from private.question_keys where split_part(question_id,'.',1) <> pack_slug union all select item_id, pack_slug from private.items where split_part(item_id,'.',1) <> pack_slug;`
first; it must return 0 rows. The lock is ACCESS EXCLUSIVE for one scan of two small tables.

Re-run state (skill rule): the sync's writes are unchanged. (a) No ids stored on disk. (b) No other actor's
decisions are touched. (c) Failure order: the new checks run in `validatePacks` for ALL packs before connecting, and
the CHECK runs inside the single transaction, so a bad pack can't follow a delete. SC-3 proves "no row changes"
with the real packs present.

Versioned-content rule: not applicable (no judgement write).

## Rejected

- Composite `(pack_slug, question_id)` keys: wide blast radius, no gain (GOAL option C).
- `<slug>.<skill>.` rule: would force id changes (and lost history) when a question moves skill.
- Dropping `set pack_slug = excluded.pack_slug` from the sync's `on conflict`: the CHECK + prefix rule make it a
  same-value write; changing the sync's SQL buys nothing and widens the diff.
- `not valid` constraint: it would leave a mismatched hosted row in place silently; failing loudly is wanted.

## Frozen files this will re-freeze

- `src/server/db/__tests__/mf-0017-expedition.db.acceptance.test.ts`: fixture ids re-prefixed (done at freeze,
  approved with option B; `FROZEN.json` history). No other frozen file inserts into `question_keys` / `items`
  with an unprefixed id (grep: mf-0007 ×2, mf-0032 use `${PACK}.…`).

```json tasks
[
  {"id": "T1", "agent": "service-builder", "owns": ["src/engine/pack/id-prefix.ts", "src/engine/pack/index.ts", "src/engine/pack/__tests__/id-prefix.test.ts", "src/engine/content/load-content.ts", "src/engine/questions/load-questions.ts"], "depends_on": [], "closes": ["SC-1", "SC-2", "SC-4"], "done_when": "mf-0024-id-prefix.acceptance.test.ts green; pnpm test green", "context": "steps 1-2"},
  {"id": "T2", "agent": "orchestrator", "owns": ["scripts/lib/validate-packs.mjs"], "depends_on": ["T1"], "closes": ["SC-3"], "done_when": "SC-3 cases green", "context": "step 3; scripts/** is outside builder scopes"},
  {"id": "T3", "agent": "schema-builder", "owns": ["supabase/migrations/20261105120000_mf0024_id_prefix_check.sql", "src/server/db/database.types.ts"], "depends_on": [], "closes": ["SC-5"], "done_when": "SC-5 cases green; mf-0017 DB file green", "context": "step 4; local stack only"}
]
```

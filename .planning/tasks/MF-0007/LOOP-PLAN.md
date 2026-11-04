# MF-0007 — LOOP-PLAN (iteration 0) · HIGH-RISK: needs the user's approval before BUILD

## Discovery summary

- Precedent: MF-0003 `record_attempt` — `private.*` SECURITY DEFINER with `set search_path = ''`
  and an `auth.uid()` check, behind a `public.*` security-invoker shim; `revoke execute … from public,
  anon` and grant to `authenticated` (`supabase/migrations/20261103083446_mf0003_attempts.sql:45-96`).
- MF-0005 grants gate (`src/server/db/__tests__/mf-0005-grants.db.acceptance.test.ts`, frozen):
  relation and column privileges of anon/authenticated/PUBLIC in `public` + `private` must EQUAL an
  allow-list; no `public` function executable by anon/PUBLIC. ⇒ this plan adds **zero** table grants.
- Membership: `public.group_members (group_id, user_id, role)` + `public.groups.pack_slug`
  (MF-0002). Packs registry `private.packs` and the sync's remote-DB guard (MF-0004,
  `scripts/sync-question-keys.mjs:59-88`).
- Attempts are replayed in three places — `app/(app)/today/page.tsx:34`,
  `app/(app)/groups/[groupId]/page.tsx:37`, and the duel via `pickSessionQuestions`
  (`engine/memory/select.ts:27`). All three must apply the same filter (calculation parity).
- `getReviewContext` (MF-0006) is called by the duel page and duel action; its signature stays.
- Content hash: `src/engine/content/hash.ts` (sorted-key canonical JSON → sha256).
- Latest migration on `main`: `20261103150000_mf0004_create_group_guards.sql`.

## Schema sketch (for approval)

New migration `supabase/migrations/20261103160000_mf0007_reviews.sql`. Every table: `private`,
RLS on, `revoke all … from public, anon, authenticated`, **no grants, no policies**.

```
private.items                 one row per item in packs/<slug>/{questions,cards,diagrams}, written by the sync
  item_id text pk · pack_slug text · skill_code text · item_type ('question'|'card'|'diagram')
  content_hash text · origin ('official'|'human'|'ai') · author_email text null
  hash_synced_at timestamptz   -- set when this content_hash first appears; the 48 h clock (C-3)
  updated_at timestamptz

private.content_maintainers   edited by SQL, seeded empty
  pack_slug text · email text (lower) · is_analogy_owner bool · pk (pack_slug, email)

private.item_reviews          one approve or flag, bound to a version
  id bigint identity pk · item_id → items on delete cascade · content_hash text
  reviewer_id uuid → auth.users on delete cascade · verdict ('approve'|'flag')
  comment text (required, 1–2000 chars, when verdict = 'flag') · created_at
  unique (item_id, content_hash, reviewer_id, verdict)   -- approving twice counts once

private.flag_resolutions      maintainer decisions, bound to a version
  id · item_id → items cascade · content_hash · action ('dismiss'|'reject')
  comment text (1–2000, required) · resolved_by uuid → auth.users · created_at

private.analogy_approvals     the analogy owner's (or 48 h fallback) approval of a card version
  item_id → items cascade · content_hash · approved_by uuid · created_at · pk (item_id, content_hash)
```

State, computed (never stored) by `private.item_state(item_id)` for the item's **current** hash:
1. a `reject` resolution → `rejected`
2. a flag newer than the latest `dismiss` → `flagged`
3. `origin = 'official'` → `approved`
4. ≥ 2 approvals from distinct reviewers (+ an analogy approval if `card`) → `approved`
5. otherwise `unreviewed`

Functions — each `private.*` SECURITY DEFINER (`search_path = ''`, `auth.uid()` required) behind a
`public.*` invoker shim; EXECUTE for `authenticated` only:

| Function | Who | Refuses with |
|---|---|---|
| `review_item(item_id, verdict, comment)` | member of a group for the item's pack | 42501 not a member / author approving own item · 22023 flag without comment · P0002 unknown item |
| `resolve_flags(item_id, action, comment)` | content maintainer of the pack | 42501 otherwise · 22023 blank comment |
| `approve_analogy(item_id)` | analogy owner; any maintainer once `now() ≥ hash_synced_at + 48 h` | 42501 otherwise · 22023 not a card |
| `review_states(pack)` → (item_id, state, reviewed_at) | any signed-in user (states aren't secret) | — ; `reviewed_at` = the caller's first review of the item, for spoiled |
| `list_reviewable(pack)` → (item_id, skill_code, item_type) | member | items not authored by me, not reviewed by me on the current hash, not flagged/rejected |
| `list_open_flags(pack)` → (item_id, flag_id, comment, reviewer, created_at) | maintainer | 42501 otherwise — the only place a flagger's identity is returned |

The caller's email (for author and maintainer checks) is read from `auth.users` inside the definer
functions only (C-1).

## SC coverage

| SC | Steps | Proof |
|---|---|---|
| SC-1 | 1, 2 | frozen DB SC-1 |
| SC-2…SC-6 | 1 | frozen DB SC-2…SC-6 |
| SC-7 | 1, 3, 5 | frozen DB SC-7 + typecheck/build of the duel wiring |
| SC-8 | 3, 5 | frozen engine SC-8 |
| SC-9 | 4, 6 | browser, local stack, two test users |
| SC-10 | all | MF-0005 gate green unchanged, `supabase db advisors --local`, lint/typecheck/test/build |

## Steps

1. **Migration** (above). `supabase migration up --local`; `pnpm db:types`.
2. **Sync**: `scripts/sync-question-keys.mjs` also upserts `private.items` for every pack it owns
   (questions, cards, diagrams), `hash_synced_at` unchanged unless the hash changed, deletes rows of
   *its own* packs that left the files. Hash: a 15-line canonical-JSON sha256 in
   `scripts/lib/content-hash.mjs` mirroring `engine/content/hash.ts`; SC-1 compares the two on
   every item, so drift fails a test.
3. **Engine**: `reviewContextFromRows`, `countableAttempts`; `emptyReviewContext` gains
   `spoiledAt`; `pickNextReview(candidates, pack)` (heavy skills first, pack order on ties) in
   `engine/content/review-queue.ts` + unit test.
4. **Server**: body of `server/content/get-review-context.ts` (rpc `review_states`); new
   `server/review/{list-reviewable,list-open-flags}.ts`; `features/review/actions.ts`
   (`approveItem`, `flagItem`, `resolveFlags`, `approveAnalogy` → `ActionResult`, schemas in
   `features/review/schemas.ts`).
5. **Parity**: today, groups/[id] and duel pages replay `countableAttempts(attempts, review)`.
6. **UI**: `/review/[packSlug]` (next item with the full question: key + rationales, or the card /
   diagram; Approve; Flag with a required comment — RHF + zod + `Field`), `/review/[packSlug]/flags`
   (maintainers; dismiss / reject with comment; non-maintainers get 404). Sidebar "Review" entry.
   shadcn + tokens only.
7. **Verify**: test:db (incl. MF-0002/0003/0005 suites), advisors, lint, typecheck, test, build,
   browser with two local users; fresh-context reviewer (high-risk).

## Riskiest step

Step 1's definer functions: every authorization rule (member, author, maintainer, 48 h) lives in
SQL that runs as the table owner. Guard: each refusal has a frozen DB test with real tokens, and the
fresh-context review reads the SQL against this table.

## Rejected options

- Table grants + RLS policies — would need new lines in MF-0005's frozen allow-list (a gate edit).
- A stored `state` column — ADR 0001 says derived; a cached copy can drift from the reviews.
- Hashing in the sync by importing the TS engine — the sync is plain `node` (MF-0003/0018 contract,
  deploy runbook); a mirrored helper + SC-1's equality check is simpler.
- Membership required for `review_states` — the duel serves any signed-in learner, member or not.

## Tasks

```json tasks
[
  { "id": "T1", "title": "migration: registry, reviews, resolutions, analogy approvals, definer functions", "agent": "schema-builder",
    "owns": ["supabase/migrations/20261103160000_mf0007_reviews.sql", "src/server/db/database.types.ts"],
    "depends_on": [], "closes": ["SC-2", "SC-3", "SC-4", "SC-5", "SC-6"],
    "done_when": ["supabase migration up --local", "pnpm test:db"], "context": ["skill:supabase", "skill:supabase-postgres-best-practices"] },
  { "id": "T2", "title": "sync registers items with content hash", "agent": "service-builder",
    "owns": ["scripts/sync-question-keys.mjs", "scripts/lib/content-hash.mjs"],
    "depends_on": ["T1"], "closes": ["SC-1"], "done_when": ["pnpm test:db -t SC-1"], "context": [] },
  { "id": "T3", "title": "engine: review context, countable attempts, review queue order", "agent": "service-builder",
    "owns": ["src/engine/content/**", "src/engine/memory/**"],
    "depends_on": [], "closes": ["SC-8"], "done_when": ["pnpm test"], "context": [] },
  { "id": "T4", "title": "server reads + review actions + getReviewContext body + attempt parity", "agent": "service-builder",
    "owns": ["src/server/content/**", "src/server/review/**", "src/features/review/actions.ts", "src/features/review/schemas.ts", "src/app/(app)/today/page.tsx", "src/app/(app)/groups/[groupId]/page.tsx", "src/app/(app)/play/[packSlug]/duel/page.tsx"],
    "depends_on": ["T1", "T3"], "closes": ["SC-7"], "done_when": ["pnpm typecheck", "pnpm test:db -t SC-7"], "context": ["skill:nextjs-data", "skill:server-client-components"] },
  { "id": "T5", "title": "review queue + flags pages", "agent": "ui-builder",
    "owns": ["src/features/review/components/**", "src/app/(app)/review/**", "src/features/app-shell/**"],
    "depends_on": ["T4"], "closes": ["SC-9"], "done_when": ["pnpm build", "browser SC-9"], "context": ["skill:forms-rhf-zod", "skill:ui-shadcn", "skill:react-client-patterns"] },
  { "id": "T6", "title": "verify, advisors, fresh-context review, evidence", "agent": "verifier",
    "owns": [".planning/tasks/MF-0007/**", ".planning/evidence/MF-0007.md"],
    "depends_on": ["T1", "T2", "T3", "T4", "T5"], "closes": ["SC-10"],
    "done_when": ["receipt PASS for the current tree", "REVIEW.md approve"], "context": [] }
]
```

## Divergences recorded during BUILD (2026-11-04)

Recorded after the fact, not before continuing as the loop asks. Each one stays inside an owned path
and changes no SC.

- **7th definer function `list_pending_analogies(pack)`** (maintainers only): without it,
  `approve_analogy` had no screen, so a card could be approved only by SQL. Same pattern and grants
  as the other six; MF-0005 gate green unchanged.
- **Engine additions:** `find-item.ts` (`findPackItem`, `itemTitle`, `itemTitles`, `itemSkillCode`)
  and `nextReviewItem` (queue order + skip registry rows the files no longer hold), with unit tests.
  `REVIEW_STATES` / `ITEM_TYPES` became `as const` arrays so the server parses RPC rows with zod.
- **Server:** `server/content/get-pack-content.ts` (cached file read of cards + diagrams +
  questions, like `getPackQuestions`); `server/review/types.ts` holds the zod row schemas + DTOs.
- **UI:** shadcn `textarea` added by CLI; `review/[packSlug]/error.tsx` with `retry` (client-side.md §6).
  Sidebar "Review" entry under Workspace (`reviewHref` prop).
- **Spoiled items are still served**: CONTEXT.md Spoiled only stops attempts counting, so the
  duel's candidate filter stays `isPlayable` (no spoiled filter).
- **Files outside `owns`, needed by owned work:** `src/app/(app)/layout.tsx` (passes `reviewHref`),
  `src/features/review/types.ts`, `src/features/review/utils/**` (rpc-errors, format-date),
  `src/server/content/get-pack-content.ts`, `src/server/content/get-item-hashes.ts`,
  `src/engine/content/load-content.ts` (`readPackFiles` extracted, behaviour unchanged).

## Review iteration (REVIEW.md, changes-requested → fix, 2026-11-04)

- **Blocking — verdicts bind to the version read.** `review_item` / `resolve_flags` /
  `approve_analogy` take `p_content_hash text default null` and refuse `55000` when it differs from
  the registry (`null` = SQL callers and the frozen 3-arg tests; the app always sends it).
  `list_reviewable` returns `content_hash`. The app hashes the DEPLOYED raw YAML (`itemHashes`, same
  as the sync), `nextReviewItem` skips candidates whose file is another version, and every action
  sends `contentHash`. Proof: `mf-0007-content-hash.db.test.ts`, RED first (PGRST202 / missing
  `content_hash`), then GREEN.
- **Note — flag vs dismiss ordering:** both functions lock the item row (`for update`) and stamp
  `clock_timestamp()`. Not unit-provable without concurrent sessions; recorded unverified.
- **Note — sync author guard:** a human/ai item without `author` now fails the sync.
- **Not changed (handed to the user):** soft-retire instead of cascade-delete; a way to flag
  approved/official items; hosted "Confirm email" runbook line.

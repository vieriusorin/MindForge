---
ticket_id: MF-0017
iteration: 1
tier: high-risk
---

# Loop Plan — Iteration 1

## Discovery summary

- Precedent: MF-0011 (group aggregate, `private` definer + `public` invoker shim, membership on a passed
  viewer) and MF-0002 (`private.create_group` / `rotate_invite_code`: definer on `auth.uid()`,
  `private.is_admin`, `public` invoker shim, EXECUTE granted to `authenticated` on both).
- Skill → domain map exists in SQL: `private.pack_skills(pack_slug, skill_code, domain_code)` (MF-0013,
  synced by `scripts/sync-question-keys.mjs`). Rejected = `private.item_state(item_id) = 'rejected'`;
  spoiled = that member's `min(private.item_reviews.created_at)` on the item (same as
  `private.group_attempts`, MF-0011).
- `attempts` rows of every mode (practice, duel, cuckoo, storm via `storm_id`) live in one table with
  `correct` and `answered_at`, so one count covers all modes.
- No leave/remove-member path exists, so a group's size only grows; the ≥ 4 check still runs at read time.
- Grants gate `mf-0005-grants.db.acceptance.test.ts` lists relation/column privileges of
  anon/authenticated/PUBLIC and EXECUTE of anon/PUBLIC on `public` functions. Giving the table no grant
  and the functions EXECUTE for `authenticated` only keeps it unedited.
- Secret-key lock (`secret-client-importers.test.ts`, ADR 0004) untouched: all reads use the user's
  RLS client.
- `Progress` is not installed: `pnpm dlx shadcn@latest add progress`.
- Group page `src/app/(app)/groups/[groupId]/page.tsx` composes slots under `<Suspense>`; members and
  `isAdmin` are already computed there.

## Frozen files this will re-freeze

- none (grep for `expedition` over `**/*.acceptance.test.*` and builds_on FROZEN.json: no hits; the
  MF-0005 allow-lists need no line, see above).

## SC coverage

| SC | Steps | Proof |
|---|---|---|
| SC-1 | T1, T3 | `mf-0017-expedition.db.acceptance.test.ts` SC-1 |
| SC-2 | T1 | DB acceptance SC-2 (literals + parity with `countableAttempts`) |
| SC-3 | T1 | DB acceptance SC-3 |
| SC-4 | T2 | `mf-0017-expedition.acceptance.test.ts` |
| SC-5 | T3, T4, T5 | `mf-0017-start-expedition-form.acceptance.test.tsx` + browser, 4 local users |
| SC-6 | T6 | receipt |

## Steps

1. **T1 migration** `supabase/migrations/20261105100000_mf0017_expeditions.sql`:
   - `create extension if not exists btree_gist with schema extensions;`
   - `public.expeditions(id uuid pk default gen_random_uuid(), group_id uuid not null references
     public.groups on delete cascade, domain_code text not null check (char_length between 1 and 32),
     target integer not null check (target between 10 and 1000), starts_at timestamptz not null,
     ends_at timestamptz not null, created_by uuid not null references auth.users on delete cascade,
     check (ends_at = starts_at + interval '7 days'),
     constraint expeditions_one_active exclude using gist (group_id with =, tstzrange(starts_at, ends_at) with &&))`.
     RLS on, no policy; `revoke all … from public, anon, authenticated`. Index on `(group_id, starts_at desc)`
     comes with the gist index's leading column; add a btree only if EXPLAIN needs it.
   - `private.start_expedition(p_group_id, p_domain_code, p_target) returns uuid` definer, `search_path=''`:
     uid null or not `private.is_admin` → 42501 (`is_admin` false for a non-member too); member count < 4
     → `raise exception … using errcode = 'P0001'`; target out of 10–1000 or domain not in
     `private.pack_skills` for the group's pack → 22023; insert with `now()` / `now() + 7 days`;
     the exclusion constraint raises 23P01 on overlap (race-safe; no pre-check needed, but a pre-check
     with the same code gives a clean message).
   - `private.latest_expedition(p_group_id)` definer stable: non-member → 42501; `order by starts_at desc limit 1`.
   - `private.expedition_progress(p_expedition_id)` definer stable: unknown id or non-member → 42501;
     member count < 4 → P0001; `count(*)` of `public.attempts a join public.group_members m on m.user_id = a.user_id
     and m.group_id = e.group_id join private.pack_skills ps on (ps.pack_slug, ps.skill_code) = (a.pack_slug, a.skill_code)`
     where `a.pack_slug = g.pack_slug and ps.domain_code = e.domain_code and a.correct and a.answered_at >= e.starts_at
     and a.answered_at < e.ends_at and private.item_state(a.question_id) <> 'rejected' and not exists (select 1 from
     private.item_reviews v where v.item_id = a.question_id and v.reviewer_id = a.user_id and v.created_at <= a.answered_at)`.
     (`<=`: attempts AT the first review are spoiled, matching `countableAttempts` `answeredAt < spoiledAt`.)
   - `public` invoker shims for the three; `revoke execute … from public, anon`; `grant execute … to authenticated`
     on private + public (as MF-0002). `pnpm db:types`.
   - Apply: `pnpm exec supabase migration up --local` (no reset). Advisors: `supabase db lint` / MCP advisors.
2. **T2 engine** `src/engine/expedition/summarize-expedition.ts` (stub exists) — `summarizeExpedition`,
   `isExpeditionAllowed`; percent = `Math.floor(min(progress/target,1)*100)`; status from `progress >= target`
   and `now >= endsAt`; time left: ms = endsAt − now; ≤ 0 ended; ≥ 24 h floor days; ≥ 1 h floor hours;
   else under an hour. Inner unit tests where the acceptance file leaves gaps.
3. **T3 server + action**: `src/server/expeditions/get-latest-expedition.ts` (`getLatestExpedition(groupId)` →
   `Expedition | null`, camelCase DTO with Date-free ISO strings), `get-expedition-progress.ts`
   (`getExpeditionProgress(expeditionId)` → number), `types.ts` (zod row parse). Both `import "server-only"`,
   user client from `src/server/supabase/*`, throw on error. `src/features/expeditions/actions.ts`
   `startExpedition`: `getCurrentUser` → `StartExpeditionInput.safeParse` → `formErrorFromZod` → rpc
   `start_expedition` → map codes to a root message (`23P01` "An expedition is already running.",
   `42501` "Only the group admin can start an expedition.", `P0001` "Expeditions need at least 4
   members.", `22023` field errors on domain/target) → `{ ok: true, expeditionId }`. No redirect.
4. **T4 start form** `src/features/expeditions/components/start-expedition-form/` (stub exists): hook
   `hooks/use-start-expedition-form.ts` (useForm + zodResolver, defaults first domain / 100, `useMutation`
   over the action, `applyFormError`, `router.refresh()` on success), view with `Field`, `Select`
   (`Controller`), `Input type=number`, root `FieldError`, disabled while pending.
5. **T5 card + page**: `src/features/expeditions/components/expedition-card/` (server-renderable, no
   hooks): `types.ts`, `utils.ts` (`statusLabel`, `timeLeftLabel`, `progressLine` — pure, unit-tested),
   view with `Card`, shadcn `Progress` (value = `summary.percent`, `aria-label`), words + numbers +
   `tabular-nums`, a `startForm` slot, states: too-small group, none yet, active, ended.
   Page: `ExpeditionSlot` under its own `<Suspense>` (Skeleton) between the heatmap and the forest:
   `isExpeditionAllowed(members.length)` → else card "Expeditions need at least 4 members."; else
   `getLatestExpedition` → `getExpeditionProgress` → `summarizeExpedition({…, now})`; `startForm` only
   when `isAdmin && (!latest || !summary.isActive)`. Domain name from `pack.domains`.
   `CONTEXT.md`: add **Expedition**.
6. **T6 verify**: full ladder (verification.md), browser with 4 local users (admin starts, member sees it,
   correct recall moves the bar), fresh-context diff-reviewer.

## Riskiest step

T1's count. It re-states `countableAttempts` in SQL (user decision C-1), so the two can drift: the parity
case in SC-2 runs the same fixture through both. Boundary traps: half-open window at both ends; the
spoiled comparison must be `created_at <= answered_at` (an attempt AT the review time is spoiled); the
member join must use CURRENT membership of the expedition's group, not any group sharing the user.

Versioned content (DESIGN rule): the expedition records no judgement about versioned content, it only
counts attempts that MF-0032 already graded against a content hash, so no version check applies.

Re-run state: none. The migration creates only its own objects and runs once; no seed, sync or backfill.

Privacy (MF-0011 rule): the functions return one row / one integer; `latest_expedition` exposes
`created_by`? **No** — not in the return type (the admin is already visible as `AvatarBadge`, but the DTO
carries only what the card shows). Gate ≥ 4 members in both start and progress.

## Rejected options

- Secret-key reuse of `group_attempts` + TS count: one owner of the rule, but a second RLS-bypassing
  importer and a new ADR (user chose the SQL count, C-1).
- SELECT grant + members policy on `expeditions`: needs a new line in the frozen MF-0005 allow-list.
- Partial unique index for "one active": cannot reference `now()`; the exclusion constraint is race-safe.
- Storing progress (`progress_json` from MINDFORGE §data): a derived figure kept in two places; counted on read.
- TanStack polling for live progress: not needed; the page is per-request and refreshes after the admin's start.

## Verify

`pnpm typecheck && pnpm lint && pnpm test`, `pnpm test:db`, `pnpm build`, advisors, browser on :3001
with 4 local users. Receipt = scoped `git diff HEAD` sha256 over the hand-off paths + new files.

```json tasks
[
  { "id": "T1", "title": "migration: expeditions table, start/latest/progress functions", "agent": "schema-builder",
    "owns": ["supabase/migrations/20261105100000_mf0017_expeditions.sql", "src/server/db/database.types.ts"],
    "depends_on": [], "closes": ["SC-1", "SC-2", "SC-3"],
    "done_when": ["supabase migration up --local", "pnpm test:db src/server/db/__tests__/mf-0017-expedition.db.acceptance.test.ts src/server/db/__tests__/mf-0005-grants.db.acceptance.test.ts"],
    "context": ["skill:supabase", "skill:supabase-postgres-best-practices"] },
  { "id": "T2", "title": "engine: summarizeExpedition, isExpeditionAllowed", "agent": "service-builder",
    "owns": ["src/engine/expedition/**"],
    "depends_on": [], "closes": ["SC-4"],
    "done_when": ["pnpm exec vitest run src/engine/expedition"],
    "context": ["skill:typescript-strict", "skill:tdd"] },
  { "id": "T3", "title": "server reads + startExpedition action", "agent": "service-builder",
    "owns": ["src/server/expeditions/**", "src/features/expeditions/actions.ts", "src/features/expeditions/types.ts", "src/features/expeditions/schemas.ts"],
    "depends_on": ["T1"], "closes": ["SC-1"],
    "done_when": ["pnpm typecheck", "pnpm exec vitest run src/server/expeditions src/features/expeditions"],
    "context": ["skill:nextjs-data", "skill:forms-rhf-zod"] },
  { "id": "T4", "title": "start-expedition-form (hook + view)", "agent": "ui-builder",
    "owns": ["src/features/expeditions/components/start-expedition-form/**"],
    "depends_on": ["T3"], "closes": ["SC-5"],
    "done_when": ["pnpm exec vitest run src/features/expeditions"],
    "context": ["skill:forms-rhf-zod", "skill:ui-shadcn", "skill:react-client-patterns"] },
  { "id": "T5", "title": "expedition-card + group page slot + Progress + CONTEXT.md", "agent": "ui-builder",
    "owns": ["src/features/expeditions/components/expedition-card/**", "src/components/ui/progress.tsx", "src/app/(app)/groups/[groupId]/page.tsx", "CONTEXT.md", "package.json", "pnpm-lock.yaml"],
    "depends_on": ["T2", "T3", "T4"], "closes": ["SC-5"],
    "done_when": ["pnpm build", "browser :3001 with 4 local users"],
    "context": ["skill:server-client-components", "skill:ui-shadcn", ".claude/rules/ui-design.md"] },
  { "id": "T6", "title": "verify + fresh-context review", "agent": "verifier",
    "owns": [".planning/tasks/MF-0017/LOOP-VERIFY.md", ".planning/evidence/MF-0017.md"],
    "depends_on": ["T1", "T2", "T3", "T4", "T5"], "closes": ["SC-6"],
    "done_when": ["receipt PASS for the current tree", "REVIEW.md approve on the same hash"],
    "context": ["references/verification.md"] }
]
```

---
phase: 1-planning
ticket_id: MF-0054
status: executing
verdict: IN_PROGRESS
started_at: "2026-11-06"
resume_with: /gsd-goal-loop
---

# Loop Plan — Iteration 1

## Discovery summary

- **Fake pins today.** `pinnedGroups = groups.slice(0, 3)` (`src/features/app-shell/components/app-sidebar/utils.ts:22-26`), rendered under
  a hard-coded "Pinned" label (`app-sidebar.tsx:170-190`). `primaryPackSlug(groups)` = `groups[0]` (`src/server/packs/primary-pack.ts`),
  called by the layout's `Sidebar` (`src/app/(app)/layout.tsx:28`) and Today (`today/page.tsx:35`).
- **Precedent for privileged writes: MF-0002.** A table in a gated schema, SECURITY DEFINER functions in `private` with
  `set search_path = ''`, SECURITY INVOKER wrappers in `public`, then `revoke` before any `grant`. Precedent for the action
  shape and its test is MF-0004 `rotateInviteCode` plus `utils/rpc-errors.ts`. Precedent for the client mutation is
  `create-group-form` / `invite-link` (hook + `useMutation`).
- **Seed.** `seedDemoWorlds` inserts your memberships with planned, backdated `joined_at` inside one `sql.begin`
  (`src/dev-seed/seed-demo-world.ts:314-362`). MF-0052 made ccdv-f your newest join. Pins added in that same transaction need
  distinct times, so `pinned_at` defaults to **`clock_timestamp()`**, not `now()` (`now()` is constant inside a transaction).
- **UI.** `/groups` rows are a `Link` wrapping a `Card` (`group-list.tsx`), so the toggle must sit beside the link
  (a button inside an `<a>` is invalid). The group page header is `<header>` + `h1` (`groups/[groupId]/page.tsx:150-156`).
  Installed shadcn: `button`, `tooltip`. No toast is installed, so the eviction message is an inline `role="status"`.
- **Gates the paths sit on:** MF-0005 grants gate (relations and columns in `public`/`private`, and anon/PUBLIC EXECUTE on `public`
  functions), MF-0002 SC-6 (no `private` function executable by anon), `gate:planning`, and the Stop hook's fast gate.

## Frozen files this will re-freeze

None. Checked by reading the assertions:
- `mf-0052-storm-link.acceptance.test.tsx`: its literal `AppSidebarProps` has no `groupsLabel`, and the prop is optional.
  It asserts nav links only, never the group section.
- `mf-0052-seed.db.acceptance.test.ts` SC-1: asserts your groups by `joined_at desc` = `["ccdv-f","prod-prompting"]`, and every
  join precedes the first answer. Pins do not change `joined_at`.
- `mf-0005-grants.db.acceptance.test.ts`: `private.group_pins` gets `revoke all` and no grant, so it adds no line. The new `public`
  functions are revoked from `public, anon`, so the anon/PUBLIC function list stays empty.
- `mf-0002-rls.db.acceptance.test.ts` SC-6: every `private` function must be non-executable by anon, so each new function
  revokes from `public, anon`.
- Not frozen, updated in the step that changes them: `src/server/packs/__tests__/primary-pack.test.ts` (new signature,
  already adapted at freeze) and `app-sidebar/__tests__/utils.test.ts` (the `pinnedGroups` cases go with the function).

## SC coverage

| SC | Steps | Proof |
|----|-------|-------|
| SC-1 | 3 | `src/server/groups/__tests__/mf-0054-sidebar-section.acceptance.test.ts` E1–E6 |
| SC-2 | 3, 7 | same file, E1–E7 + parity (layout and Today call `listMyPins(` and pass the pins) |
| SC-3 | 1, 2 | `src/server/db/__tests__/mf-0054-group-pins.db.acceptance.test.ts` (SC-3 block) |
| SC-4 | 1, 2 | same file (SC-4 block) + the lock-removed variant run, recorded in LOOP-VERIFY |
| SC-5 | 4 | `src/features/groups/__tests__/mf-0054-pin-actions.acceptance.test.ts` + `rpc-errors` unit test |
| SC-6 | 6, 7 | `pin-toggle/__tests__/mf-0054-pin-toggle.acceptance.test.tsx` + `utils.test.ts` + browser |
| SC-7 | 5 | `app-sidebar/__tests__/mf-0054-sidebar-label.acceptance.test.tsx` + MF-0052 storm-link green |
| SC-8 | 8 | `src/dev-seed/__tests__/mf-0054-seed-pins.db.acceptance.test.ts` + MF-0052 seed files green |
| SC-9 | 0, 9, 10 | `CONTEXT.md` grep, all gates, browser check |

## Steps

0. **T0 (separate hunk, C-2):** `.github/workflows/ci.yml` (the `checks` job's `actions/checkout`) gets `with: fetch-depth: 0`,
   so MF-0053's frozen `git show 8b1aa89:…` resolves in CI.
1. `supabase/migrations/20261106100000_mf0054_group_pins.sql`:
   - `private.group_pins (user_id uuid, group_id uuid, pinned_at timestamptz not null default clock_timestamp(),
     primary key (user_id, group_id), foreign key (group_id, user_id) references public.group_members (group_id, user_id) on delete cascade)`,
     index `(user_id, pinned_at)`, `enable row level security`, `revoke all … from public, anon, authenticated`. No policies:
     only the definer functions touch it.
   - `private.pin_group_for(p_user_id uuid, p_group_id uuid) returns table (evicted_id uuid, evicted_name text)`, SECURITY DEFINER,
     `search_path = ''`. In order: `pg_advisory_xact_lock(hashtextextended('mf0054:pins:' || p_user_id, 0))`; not a member →
     `raise … errcode '42501'`; already pinned → return no row; if 3 pins exist, `delete` the least `(pinned_at, group_id)` row
     `returning group_id`, and look up its name; `insert`; return the evicted row, if any. **Not granted to `authenticated`**
     (only the seed, as postgres, and the definer below call it).
   - `private.pin_group(p_group_id)`: `auth.uid()` null → 42501; `return query select * from private.pin_group_for(auth.uid(), p_group_id)`.
   - `private.unpin_group(p_group_id) returns void`: `delete … where user_id = auth.uid() and group_id = p_group_id`.
   - `private.list_my_pins() returns table (group_id uuid, pinned_at timestamptz)`: own rows, `order by pinned_at desc, group_id desc`.
   - `public.pin_group`, `public.unpin_group`, `public.list_my_pins`: SECURITY INVOKER wrappers.
   - Grants: revoke execute on every new function from `public, anon` (and from `authenticated` for `pin_group_for`). Grant
     execute on the 3 public wrappers and the 3 private targets to `authenticated`.
2. Apply with `supabase migration up` (C-4; no reset), then `pnpm db:types`. Then the **lock-removed variant**: in the local DB only,
   `create or replace` `private.pin_group_for` without the `pg_advisory_xact_lock` line, run the SC-4 concurrency case, and paste its
   result (expected RED: 4 pins, or the witness order broken) under "RED at freeze" as a recorded deviation (the function did not
   exist at freeze). Restore by re-running the function's `create or replace` from the migration file, and re-run the case green.
3. `src/server/groups/sidebar-group-section.ts` (constant `RECENT_GROUPS = 3`) and `src/server/packs/primary-pack.ts`: a shared
   pure helper orders the pins by `(pinnedAt, groupId)` desc and keeps only those in `groups`. Put it in
   `src/server/groups/order-pinned-groups.ts` with its own `__tests__/order-pinned-groups.test.ts`. `primaryPackSlug` =
   first pinned group's pack ?? `groups[0]` ?? default. Rewrite `primary-pack.test.ts` to the new cases (it already compiles).
4. `src/server/groups/list-my-pins.ts` (`server-only`, `rpc("list_my_pins")`, zod-parse the rows, map to `GroupPin[]`, throw
   `listMyPins: …` on error). `src/features/groups/actions.ts`: `pinGroup` / `unpinGroup` (auth → `redirect("/sign-in?next=/groups")`,
   `GroupId.safeParse`, rpc, zod-parse `pin_group`'s rows `.max(1)`, return `{ ok: true, evicted }`). Add
   `pinRpcError` in `utils/rpc-errors.ts` (42501 → "You can only pin groups you belong to.", otherwise
   "Could not update your pins. Try again.") + a case in its existing unit test.
5. `app-sidebar`: render `groupsLabel ?? "Pinned"` and the given `groups` as they are, with no slicing. Delete `pinnedGroups` and
   `MAX_PINNED_GROUPS` and their test cases.
6. `src/features/groups/components/pin-toggle/`: `pin-toggle.tsx` (view: `Tooltip` + `Button` `variant="ghost"`, touch size ≥ 40px,
   `aria-pressed`, `aria-label="Pin <name> to sidebar"`, `Pin`/`PinOff`, disabled while pending; `<p role="status">` for the
   eviction message and `<p role="alert">` for an error), `hooks/use-pin-toggle.ts` (`useMutation` over `pinGroup`/`unpinGroup`;
   on `ok` → `router.refresh()` + message from utils; on `!ok` → error), `utils.ts` `evictionMessage(evicted)` →
   `Unpinned "<name>" to make room.` / `null`, `__tests__/utils.test.ts`, `types.ts` (props + `UsePinToggleReturn`).
7. Pages: the layout and Today add `listMyPins()` to their `Promise.all`, and the layout passes `sidebarGroupSection(...)`'s
   label and groups. `/groups` passes `pinnedGroupIds` to `GroupList`, which renders `PinToggle` beside each row link
   (`GroupListProps.pinnedGroupIds: readonly string[]`). The group page puts `PinToggle` in the header beside the `h1`.
8. `src/dev-seed/seed-demo-world.ts`: after the world loop, inside the same transaction, pin your demo groups in ascending order
   of your planned `joinedAt` via `select * from private.pin_group_for(youId, groupId)`, so ccdv-f (your newest join) ends up the
   newest pin. The cap and the membership check are the DB's.
9. `CONTEXT.md`: **Pinned group**: a study group a learner chose for the sidebar (at most 3; the newest pin sets the pack for
   Today, Play and Review; the 3 newest-joined show as "Recent" when nothing is pinned).
10. TEST: full gates, `pnpm test:db`, `pnpm build`, one `pnpm dev:seed` (C-4), browser on :3001, fresh-context `diff-reviewer`.

## Riskiest step

**Step 1, the cap under concurrency.** Two tabs pinning at once, or a double click, must not leave 4 pins. A row lock on
the oldest pin is not enough: the second transaction re-checks after the first COMMITs, deletes nothing and inserts, which
leaves 4. Hence the per-user advisory xact lock, taken first. Proof: the SC-4 concurrency case with an ordering witness, plus
the lock-removed variant shown RED.
**Server refusals behind UI predicates.** The toggle only offers "pin" on unpinned groups. When that is bypassed (stale tab,
direct action call, RPC from the console), the DB refuses a non-member (42501, SC-3), re-pinning is a no-op (SC-4), and the cap
holds for any caller including the seed (SC-4, SC-8). No write records a judgement about versioned content, so no content-hash
binding applies.
**Re-run state (seed):** see GOAL "Re-run state". Your own pins may be evicted (accepted, named in the hand-off). The SC-8 file
asserts it. The seed's existing guards run before its deletes, and pinning adds no destructive step before them.

## Rejected options

- `group_members.pinned_at`: co-members would read your pin times, and it needs a column UPDATE grant (MF-0005 re-freeze). C-3.
- Cap in a BEFORE INSERT trigger: it cannot return the evicted group to the caller, and the function already serialises
  per user. The seed uses the same function, so there is still one owner.
- Pins through TanStack Query: pins are first-render data (sidebar, Today), so RSC reads plus `router.refresh()` cover it.
- A separate "favourites" list: decided at intake (one concept).

## Verify

- VERIFY (default, by hand): typecheck · lint · test · test:db · build · gate:planning, plus `git diff HEAD | shasum -a 256`
  as the receipt in LOOP-VERIFY.
- EVAL (by hand): graph acyclic, every SC closed, review hash = current tree.
- browser (:3001, seeded you): sidebar "Pinned" with Demo ccdv-f on top; `/groups` toggles; a 4th pin shows
  `Unpinned "…" to make room.`; unpin all → "Recent"; Today/Play follow the newest pin.

```json tasks
[
  { "id": "T0", "title": "CI fetch-depth for MF-0053's git show (separate hunk)", "agent": "inline",
    "owns": [".github/workflows/**"], "depends_on": [], "closes": [],
    "done_when": ["grep -n 'fetch-depth: 0' .github/workflows/*.yml"], "context": ["GOAL C-2"] },
  { "id": "T1", "title": "migration: private.group_pins + pin functions; db types; lock-removed variant", "agent": "inline",
    "owns": ["supabase/migrations/**", "src/server/db/database.types.ts"], "depends_on": [], "closes": ["SC-3", "SC-4"],
    "done_when": ["pnpm exec vitest run --project db src/server/db/__tests__/mf-0054-group-pins.db.acceptance.test.ts", "pnpm test:db", "pnpm typecheck"],
    "context": ["skill:supabase-postgres-best-practices", "supabase/migrations/20261103064106_mf0002_groups.sql"] },
  { "id": "T2", "title": "pure section/primary-pack, listMyPins, pin actions", "agent": "inline",
    "owns": ["src/server/groups/**", "src/server/packs/**", "src/features/groups/actions.ts", "src/features/groups/types.ts", "src/features/groups/utils/**"],
    "depends_on": ["T1"], "closes": ["SC-1", "SC-5"],
    "done_when": ["pnpm exec vitest run src/server/groups src/server/packs src/features/groups/__tests__ src/features/groups/utils", "pnpm typecheck"],
    "context": ["skill:typescript-strict", "skill:nextjs-data"] },
  { "id": "T3", "title": "seed pins ccdv-f last", "agent": "inline",
    "owns": ["src/dev-seed/seed-demo-world.ts"], "depends_on": ["T1", "T2"], "closes": ["SC-8"],
    "done_when": ["pnpm exec vitest run --project db src/dev-seed"], "context": ["MF-0052 GOAL"] },
  { "id": "T4", "title": "PinToggle, group list, group page, layout, Today, sidebar label", "agent": "inline",
    "owns": ["src/features/groups/components/**", "src/features/app-shell/components/app-sidebar/**", "src/app/(app)/**"],
    "depends_on": ["T2"], "closes": ["SC-2", "SC-6", "SC-7"],
    "done_when": ["pnpm test", "pnpm build"],
    "context": ["skill:client-data-tanstack-query", "skill:react-client-patterns", "skill:ui-shadcn", "skill:accessibility"] },
  { "id": "T5", "title": "CONTEXT.md term, gates, dev:seed, browser, review", "agent": "inline",
    "owns": ["CONTEXT.md", ".planning/**"], "depends_on": ["T0", "T3", "T4"], "closes": ["SC-9"],
    "done_when": ["grep -n 'Pinned group' CONTEXT.md", "pnpm typecheck && pnpm lint && pnpm test && pnpm test:db && pnpm build && pnpm gate:planning"],
    "context": [] }
]
```

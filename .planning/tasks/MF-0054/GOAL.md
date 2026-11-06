---
ticket_id: MF-0054
tier: high-risk                   # new table + RLS + SECURITY DEFINER functions + a Server Action writing per-user state
stage: handoff
branch: feat/MF-0054
builds_on: [MF-0002, MF-0052]
last_iteration: 0
goal_status: complete-pending-manual-commit
---

> User, 2026-11-05: "open a ticket for real pinning and maybe have something favorites, possibility to add to
> favorite (pin, unpin) i don't know think".

## Objective

**Today.** The sidebar's "Pinned" section is not pinning: `pinnedGroups` = `groups.slice(0, 3)`
(`src/features/app-shell/components/app-sidebar/utils.ts:22-25`) over `listMyGroups`, ordered by `joined_at desc`.
So the "pins" are your 3 newest memberships, and you can't choose, add or remove one. The label promises a choice
the app doesn't offer.

**End state.** A learner pins and unpins their own study groups. The sidebar shows the pinned ones; everything else
stays on `/groups`.

## Recommendation (to confirm at DESIGN)

**One concept, called "pin". No separate "favorites".** Pinning and favoriting would answer the same question
("which groups do I want one click away?"). Two lists would need two rules for what the sidebar shows, and they
would drift. The control is a pin toggle (lucide `Pin` / `PinOff`, with the words "Pin to sidebar" / "Unpin"),
so it reads as "favourite" without a second term. Add **Pinned group** to `CONTEXT.md` when this is built.

Draft shape:
- **Storage:** `group_members.pinned_at timestamptz null`. The pin is per member, so it disappears when you leave
  the group, and no new table is needed. RLS: a member updates only their own row's `pinned_at` (a narrow
  column grant, or a SECURITY DEFINER function in `private`, per the migration rules).
- **Actions:** `pinGroup(groupId)` / `unpinGroup(groupId)` in `src/features/groups/actions.ts`: auth → zod →
  membership check → write → `ActionResult`, called via `useMutation`, then `router.refresh()`.
- **UI:** a toggle on each `/groups` row and on the group page header (shadcn `Button` + `Tooltip`, with an
  `aria-pressed` toggle and an accessible name). The sidebar lists pinned groups ordered by `pinned_at`.
- **Limit:** keep at most 3 pinned (`.claude/rules/ui-design.md`: "Pinned (≤ 3 groups)"). Pinning a 4th replaces
  the oldest pin (user decision 2 below), and the server enforces it.

## Open questions (asked at intake, answered below)

1. **No pins yet:** should the sidebar fall back to the 3 newest groups (today's behaviour, perhaps labelled "Recent"),
   or show an empty "Pinned" hint?
2. **At the limit (3):** refuse the 4th pin, or replace the oldest pin?
3. **Primary pack:** today Today, the sidebar's Play links and Review follow the *newest-joined* group
   (`primaryPackSlug`). Should the first pinned group become the primary pack? That would also give users a way to
   switch which pack the sidebar plays, but it changes MF-0052's seed guarantee: the seed should then pin the ccdv-f
   group.
4. **Name:** "pin" as recommended, or "favourite" (star) if that reads better to users?
5. **Seed:** should `dev:seed` pin groups for you (e.g. ccdv-f + two others) so the feature shows data?

## Decided by the user (2026-11-05)

1. **No pins:** the sidebar shows the 3 newest-joined groups, under the label **"Recent"**. With at least one pin,
   the section is **"Pinned"** and shows only pins.
2. **At the limit:** pinning a 4th group **replaces the oldest pin** (smallest `pinned_at`), in the same write, on the
   server. The UI says which group was unpinned.
3. **Primary pack follows pins:** with pins, Today / Play / Review follow the pinned groups' pack; with none, the
   newest-joined group as today (`primaryPackSlug`). Which pin counts is still to be confirmed (see below).
4. **Name:** "pin". Add **Pinned group** to `CONTEXT.md`.
5. **Seed:** `dev:seed` pins groups for you, with ccdv-f as the one that drives the primary pack, so MF-0052's
   guarantee (ccdv-f primary, Storm visible) still holds.

## Still open

- **Which pin drives the primary pack?** Recommended: the **most recently pinned** group, so pinning a group switches
  Today and Play to its pack. The alternative is the oldest pin, which stays stable. To confirm at DESIGN.

## Out of Scope

- Pinning anything other than study groups (packs, skills, storms).
- Reordering pins by drag.

---

# DESIGN (2026-11-06)

## Facts (re-derived from source at pickup)

- The "Pinned" section is `pinnedGroups(groups)` = `groups.slice(0, 3)` (`src/features/app-shell/components/app-sidebar/utils.ts:22-26`)
  over `listMyGroups`, which orders by `joined_at desc` (`src/server/groups/list-my-groups.ts:12`). Confirmed.
- `primaryPackSlug(groups)` = `groups[0]?.packSlug ?? "ccdv-f"` (`src/server/packs/primary-pack.ts`). Callers: the app
  layout's sidebar (`src/app/(app)/layout.tsx:28`) and Today (`src/app/(app)/today/page.tsx:35`). Review takes its pack
  from the URL and only checks membership (`review/[packSlug]/page.tsx:70-73`), so it follows pins through the sidebar's
  `reviewHref` and needs no change of its own.
- `group_members` is readable by every co-member (policy "group_members: members read", MF-0002 migration) with a
  table-wide `SELECT` grant. **A `pinned_at` column there would show co-members when you pinned or unpinned their
  group.** It would also need a column `UPDATE` grant plus an update policy, and that changes the frozen MF-0005 grants
  allow-list (`src/server/db/__tests__/mf-0005-grants.db.acceptance.test.ts`, COLUMN_ALLOW_LIST).
- There is no "leave group" feature (no `leave_group` in `src`/`supabase`). A membership row disappears only when a
  group or user is deleted.
- MF-0004 caps a learner at 10 groups, so the "Recent" fallback reads at most 10 rows.
- Frozen tests that touch the changed surfaces: MF-0052 `mf-0052-storm-link.acceptance.test.tsx` builds a literal
  `AppSidebarProps` (`groups: [{ id, name }]`, no other group field), and MF-0052 `mf-0052-seed.db.acceptance.test.ts`
  SC-1 asserts your groups by `joined_at desc` are `["ccdv-f", "prod-prompting"]`. Neither has to change if (a) every
  new `AppSidebarProps` field is optional, with the old shape still rendering, and (b) the seed keeps its join order.
  `primary-pack.test.ts` and `app-sidebar/__tests__/utils.test.ts` are not frozen and change with the code.
- No `ticket:verify` / `ticket:freeze` / `ticket:eval` scripts exist: the defaults (by hand, LF-normalised hashes) apply.

## Affected

- **Roles:** every signed-in learner, for their own pins only. Admins have no extra power over pins. Co-members see nothing.
- **Surfaces:** `supabase/migrations/<new>_mf0054_group_pins.sql`; `src/server/db/database.types.ts`;
  `src/server/groups/` (a pins read); `src/server/packs/primary-pack.ts`; `src/app/(app)/layout.tsx`, `today/page.tsx`,
  `groups/page.tsx`, `groups/[groupId]/page.tsx`; `src/features/groups/{actions,schemas,types}.ts` + a pin toggle
  component; `src/features/app-shell/components/app-sidebar/**`; `src/dev-seed/**`; `CONTEXT.md`.

## Constraints → how met

- Least privilege; the pin is private to its owner → pins live in **`private.group_pins (user_id, group_id, pinned_at)`**,
  RLS on, `revoke all` from `public, anon, authenticated`, no table grants at all. Reads and writes go through
  SECURITY DEFINER functions in `private` behind SECURITY INVOKER wrappers in `public` (the MF-0002 pattern), each
  scoped to `auth.uid()`. The MF-0005 relation and column allow-lists stay unchanged, so that frozen test is not re-frozen.
- A pin exists only while you are a member → FK `(group_id, user_id) references public.group_members on delete cascade`.
- At most 3 pins, for every writer (the action, the seed, a direct RPC call, two tabs at once) → the DB owns the cap.
  Pinning takes a per-user transaction lock, and if 3 pins exist it deletes the oldest (`pinned_at`, tie broken by
  `group_id`) in the same transaction, returning the evicted group's id. The seed calls the same SQL path, so it does
  not restate the rule.
- Server Actions authorize, re-parse `unknown` with zod, and return `ActionResult` → `pinGroup` / `unpinGroup` in
  `src/features/groups/actions.ts`. No redirect on success; the hook calls `router.refresh()`.
- One owner per fact → which groups the sidebar shows, its label and the primary pack are pure functions over
  `(groups, pins)` in one server-side helper module (the existing `primary-pack.ts` grows into it). The layout and
  Today both call it, so they cannot disagree (parity test).
- Frozen MF-0052 contracts → see Facts; new sidebar props are optional and the seed keeps `joined_at` order.
- shadcn only, lucide icons, no emoji → the toggle is shadcn `Button` (`aria-pressed`, accessible name) + `Tooltip`
  with `Pin` / `PinOff`. The "which group was unpinned" message uses an installed shadcn primitive, or one added with the CLI.
- Privacy over other people's data: not applicable. No figure is computed over co-members, and a pin is never visible to
  anyone but its owner (SC-3 proves it).

## Decided without a question

- **Storage is a private table, not `group_members.pinned_at`** — follows from the Facts above (co-member visibility,
  MF-0005 grants lock) and from engineering-principles §3 "least privilege". This reverses the intake draft's shape; the
  user decisions 1–5 are unchanged. *(Shown at the checkpoint.)*
- **Pinning an already-pinned group is a no-op** (its `pinned_at` is kept, nothing is evicted). **Unpinning a group that is
  not pinned is a no-op success.** Both arise only from a stale tab or a double click; failing them would show an error
  for a state the user already wanted.
- **The sidebar lists pins newest-pin first** (`pinned_at desc`), and "Recent" lists newest-joined first. Both read
  top-down as "most recent first", and the first row is the group whose pack drives the dashboard (if C-1 is answered as recommended).
- **Pinning a group you are not a member of is refused by the DB** (42501), and the action maps that refusal to a message. A bad uuid is
  refused by zod before any DB call.
- **The toggle's accessible name is constant** (`Pin <group name> to sidebar`) and its state is `aria-pressed`: a name
  that flips to "Unpin" while also announcing "pressed" reads the state twice (WAI-ARIA toggle-button pattern). The group
  name makes each row's button unique on `/groups` (`accessibility` skill; client-side.md §8).
- **Contracts the frozen tests bind to:** RPCs `public.pin_group(p_group_id uuid)` → `table(evicted_id uuid, evicted_name text)`
  (0 or 1 row), `public.unpin_group(p_group_id uuid)` → void, `public.list_my_pins()` → `table(group_id uuid, pinned_at timestamptz)`;
  the seed path `private.pin_group_for(p_user_id uuid, p_group_id uuid)` (no grant to `authenticated`). TypeScript:
  `GroupPin { groupId; pinnedAt }` (ISO string) in `src/server/groups/types.ts`; `sidebarGroupSection({ groups, pins })` in
  `src/server/groups/sidebar-group-section.ts`; `primaryPackSlug({ groups, pins })` in `src/server/packs/primary-pack.ts`;
  `pinGroup` / `unpinGroup` in `src/features/groups/actions.ts`; `PinToggle { groupId, groupName, isPinned }` in
  `src/features/groups/components/pin-toggle/`; optional `groupsLabel?: "Pinned" | "Recent"` on `AppSidebarProps`.
  Total order of pins: `(pinned_at, group_id)`; newest = greatest, shown first; evicted = least.
- **No groups at all:** the section is hidden (today's behaviour), and the primary pack is `DEFAULT_PACK_SLUG` (unchanged).

## Success Criteria

- [x] SC-1: **Section shape.** A pure function over `(groups by joined_at desc, pins)` returns the sidebar section:
  no groups → none; groups, no pins → `"Recent"` + the 3 newest-joined; ≥1 pin → `"Pinned"` + only the pinned groups,
  by `pinned_at desc`. Proof: oracle test, edge table rows E1–E6.
- [x] SC-2: **Primary pack.** The same module returns the primary pack slug: no groups → `ccdv-f`; no pins → the
  newest-joined group's pack; with pins → the **most recently pinned** group's pack (C-1). Layout and Today both use it
  (parity test: both call sites import the one function; a grep-level test or a shared container). Proof: oracle test
  rows E1–E7, plus a parity test.
- [x] SC-3: **Private and member-only (DB).** As learner A: pin a group A belongs to → it appears in A's pins; pin a
  group A is not in → refused (42501), no row; co-member B calls the pins read → sees none of A's pins; `anon` cannot
  execute any pin function; no table grant exists on `private.group_pins` for `anon`/`authenticated`/`PUBLIC`. Deleting A's
  membership row removes A's pin (cascade). Proof: `*.db.acceptance.test.ts` (`pnpm test:db`).
- [x] SC-4: **Cap of 3, replace the oldest (DB).** With pins on G1 < G2 < G3 (by `pinned_at`), pinning G4 leaves
  exactly {G2, G3, G4} and returns G1 as evicted. Re-pinning G3 evicts nothing and keeps its `pinned_at`. Two concurrent
  `pin` calls for G4 and G5 from the same user (separate connections, one held open inside its transaction) leave exactly 3
  pins, with an ordering witness that the second call waited for the first one's COMMIT. Also run once against a variant with the lock removed and record the result (RED at freeze). Proof: `*.db.acceptance.test.ts`.
- [x] SC-5: **Actions.** `pinGroup(input: unknown)` / `unpinGroup(input: unknown)`: signed out → redirect to sign-in;
  non-uuid → `{ ok: false }` with no DB call; DB refusal → `{ ok: false, error: <message> }`; success →
  `{ ok: true, evicted: { id, name } | null }`. Proof: unit tests with the Supabase facade mocked.
- [x] SC-6: **Toggle UI.** On each `/groups` row (beside the row link, never nested in it) and on the group page header,
  a button with the constant accessible name `Pin <group name> to sidebar` and `aria-pressed` = pinned; its tooltip says
  "Pin to sidebar" / "Unpin". Clicking it calls the action through `useMutation` and then
  `router.refresh()`. When a pin evicted another group, a `role="status"` message names the evicted group; a failure
  shows its error. While pending, the button is disabled. Proof: RTL `ui` tests per outcome (pin, unpin, eviction message,
  error, pending), plus a browser check on :3001.
- [x] SC-7: **Sidebar renders the section.** `AppSidebar` shows the label it is given ("Pinned"/"Recent") over its
  groups; with the MF-0052 literal props (no new fields) it still renders exactly as before (the frozen storm-link test stays green
  untouched). Proof: RTL test + the frozen MF-0052 file green.
- [x] SC-8: **Seed.** `dev:seed` pins your demo groups so that ccdv-f is the most recent pin (prod-prompting pinned
  earlier), through the same DB path as the action (the cap applies). After the seed, SC-2's function returns `ccdv-f` for
  you, and MF-0052's frozen seed tests stay green untouched. Proof: a seed `*.db.acceptance.test.ts`, plus the
  MF-0052 files.
- [x] SC-9: `CONTEXT.md` defines **Pinned group**. Every gate passes: `pnpm typecheck && pnpm lint && pnpm test`,
  `pnpm test:db`, `pnpm build`, `pnpm gate:planning`. Browser check on :3001: pin, unpin, a 4th pin with its message,
  the sidebar label switching Recent ↔ Pinned, and Today/Play following the newest pin.

### Edge-input table (SC-1, SC-2)

| # | Input | Section | Primary pack | Decided by |
|---|---|---|---|---|
| E1 | no groups | none (hidden) | `ccdv-f` | today's code; kept |
| E2 | 1–10 groups, no pins | "Recent", ≤3 newest-joined | newest-joined's pack | user decision 1 / today's code |
| E3 | 1 pin | "Pinned", that one group only | its pack | user decisions 1, 3 |
| E4 | 3 pins, 10 groups | "Pinned", 3 by `pinned_at desc` | newest pin's pack | user 1, 3 + **C-1** |
| E5 | pins tie on `pinned_at` | ordered by `group_id` | the first in that order | agent (determinism) |
| E6 | a pin whose group is not in `groups` (cannot happen with the FK; defensive) | ignored | ignored | agent: fail-safe |
| E7 | newest pin's pack ≠ newest-joined's pack | — | the pin's pack | user 3 + **C-1** |

### Re-run state (seed: SC-8)

The seed re-creates the demo groups with new ids on each run, so their pins are re-created by the cascade plus the re-pin.
State the seed does not own: (a) **your pins on your own non-demo groups**. Pinning 2 demo groups may evict up to 2 of
them (the cap applies to every writer). Accepted for a local dev seed and named in the hand-off. (b) **Unpinning a demo
group by hand is undone by the next seed**, because the group itself is re-created. Test: the SC-8 file runs the seed
with a pre-existing own pin and asserts the outcome.

## Concerns

| # | Collision | Owner | Status |
|---|---|---|---|
| C-1 | Which pin drives the primary pack: the most recent pin (pinning switches Today/Play) or the oldest pin (stable) | user | resolved 2026-11-06: **most recent pin** |
| C-2 | `main` CI is red on 121ca49. MF-0053's frozen test runs `git show 8b1aa89:…`, but `actions/checkout` is shallow (no `fetch-depth`), so the commit is missing in CI. Locally it passes (705/705). | user | resolved 2026-11-06: **fix as T0** (`fetch-depth: 0` on the `checks` job checkout; separate hunk) |
| C-3 | Storage shape changed from the intake draft (`group_members.pinned_at` → `private.group_pins`) | user | resolved 2026-11-06: **private table approved** |
| C-4 | Proof commands that touch shared local state: applying the migration (`supabase migration up`, non-destructive, preferred over `pnpm db:reset`) and one `pnpm dev:seed` run for the browser check (re-creates your demo world) | user | resolved 2026-11-06: **both approved**; `db:reset` not approved |

## Decided by the user (2026-11-06, DESIGN checkpoint)

- C-1: the most recent pin drives the primary pack.
- C-2: fix the `main` CI red as T0, a separate hunk (`fetch-depth: 0`).
- C-3: pins live in `private.group_pins`, not `group_members.pinned_at`.
- C-4: `supabase migration up` and one `pnpm dev:seed` are approved; `pnpm db:reset` is not.

## Iteration Log

<!-- append-only -->
- 2026-11-06 design preflight: `pnpm typecheck && pnpm lint && pnpm test` exit 0 (705 tests, 146 files); `pnpm test:db` exit 0 (109 tests, 25 files); `pnpm build` exit 0; `pnpm gate:planning` exit 0; `pnpm dev:seed` not run: browser-check step, approval asked (C-4); `pnpm db:reset` not run: not needed, migration applied with `supabase migration up` (C-4). `main` CI: failure on 121ca49 (C-2).
- 2026-11-06 checkpoint: C-1..C-4 answered by the user (see "Decided by the user (2026-11-06)"). SC-6 amended before freeze: constant accessible name + `aria-pressed`.
- 2026-11-06 freeze: 6 acceptance files frozen RED (FROZEN.json); DB files red identically on two runs. Deviation: the SC-4 lock-removed variant cannot run before the migration exists; it is LOOP-PLAN step 2, recorded in LOOP-VERIFY.
- 2026-11-06 plan: LOOP-PLAN iteration 1 written; no frozen file re-freezes; awaiting the user's plan approval (high-risk).
- 2026-11-06 build: T0 CI fetch-depth; T1 migration applied (`supabase migration up`), db types; lock-removed variant RED (`expected [ …(4) ] to deeply equal [ …(3) ]`), restored green; T2 section/primary pack/listMyPins/actions; T3 seed pins (2 ms apart: JS reads pinned_at at ms precision); T4 PinToggle, group list, group page, layout, Today, sidebar label; T5 CONTEXT.md.
- 2026-11-06 test: typecheck 0 · lint 0 · test 742/742 · test:db 120/120 · build 0 · gate:planning 0; frozen hashes intact. Reviewer: approve, 0 blocking, 3 notes. Browser on :3001 found the inline message squeezing the row (note 2), fixed (wrap + zero-height live region) and re-checked; that CSS-only change was not re-read by the reviewer. Receipt PASS, tree 9ffe0b3764d4.
- 2026-11-06 handoff: complete-pending-manual-commit.

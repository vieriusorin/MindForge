---
ticket_id: MF-0017
tier: high-risk                   # new table + cross-member aggregate
stage: handoff
branch: feat/MF-0017
builds_on: [MF-0002, MF-0003, MF-0007, MF-0011]
last_iteration: 1
goal_status: complete-pending-manual-commit
track: S                          # seat Coder E
week: W4 (stretch: only if W3 is green; after MF-0016)
depends_on: [MF-0006]             # count goal only; no dependency on the heatmap figures
---

> Drafted 2026-11-03 from the planning grill (Q5, Q14). Claimed 2026-11-05 on `feat/MF-0017` (from
> `main` @ 02471d7). Baseline 2026-11-05: `pnpm typecheck` 0, `pnpm lint` 0 (540 files), `pnpm test`
> 119 files / 522 tests green. `pnpm test:db` not run: Docker is not running.

## Objective

Groups can see their weak regions (MF-0011) but have no shared goal to act on.

End state: **Group Expedition.** A group admin starts a 7-day goal ("Together, make 200 correct
recalls in Security & Safety"). Every member's countable correct recalls in that domain, inside the
window, count. The group page shows one shared progress bar with words and numbers, and the time left.
Only the group total is ever shown or returned.

## Affected

- **Roles:** group admin (starts), group member (contributes, sees the total). Non-members: nothing.
- **Surfaces:** new migration (table `public.expeditions`, a `private` start function + `public` shim,
  the progress read, see C-1); `src/engine/expedition/` (progress, percent, status word, time left);
  `src/server/expeditions/**` (reads); `src/features/expeditions/**` (start form, expedition card,
  action, schema); `src/app/(app)/groups/[groupId]/page.tsx` (card under `<Suspense>`); `CONTEXT.md`
  (term **Expedition**).

## Constraints

- Group totals only; no per-member contribution shown or returned (Q5, D-4).
- Progress counts only measured recalls: correct attempts that are countable under MF-0007
  (`countableAttempts`: not on a rejected question, not at/after that member reviewed it). Nothing for
  time or clicks.
- Revoke-all-first, `auth.uid()` membership/admin check, grants gate (MF-0005) green and unedited;
  migration only creates its own objects (ROADMAP §4.2).
- Figures come from `src/engine/**` with the clock passed in; per-user/group reads never `use cache`.
- Words + number, never colour alone (ui-design §5); shadcn only (`Progress` added via CLI if needed).

## Constraints → how met

- Group totals only → the progress read returns one integer per expedition; DTO keys asserted (SC-3).
- Countable recalls → (C-1, user) a definer SQL function `private.expedition_progress(p_expedition_id)`
  + `public` shim, EXECUTE for `authenticated`, membership checked on `auth.uid()`, returns one integer.
  It re-states the 2-condition MF-0007 rule (not rejected via `private.item_state`; `answered_at` before
  that member's first `private.item_reviews.created_at` on the item). `countableAttempts` stays the
  owner; a DB parity test runs the same fixture through both and asserts equal counts (SC-2).
- Revoke-all-first → `revoke all on public.expeditions from public, anon, authenticated` and NO grant
  back (a SELECT grant would need a line in the frozen MF-0005 allow-list). Members read through the
  definer `public.latest_expedition(p_group_id)` (membership on `auth.uid()`); inserts only through the
  definer `public.start_expedition`. RLS is on with no policy (defence in depth).
- One active per group → an exclusion constraint on `(group_id, tstzrange(starts_at, ends_at))`
  (`btree_gist`), so two concurrent starts cannot both succeed; times are set by the database
  (`starts_at = now()`, `ends_at = starts_at + 7 days`), never by the client.
- **What a viewer can deduce (MF-0011 retro rule):** the viewer knows their own count, so
  total − own = the sum of every other member's countable correct recalls in the window.
  (a) Worked example, 2-member group: total 37, mine 30 → the one other member made exactly 7.
  That is a per-member figure, against Q5. (b) The figure moves in steps of 1, so watching it reveals
  when someone played. (c) The member list is already visible to members. Mitigation (C-2, user):
  expeditions exist only in groups of ≥ 4 members, i.e. ≥ 3 besides any viewer. Worked example at the
  minimum, 4 members: total 37, mine 30 → the other three made 7 between them; no single member's
  figure is derivable without outside knowledge. The gate counts members (already visible), not
  contributors, so passing it discloses nothing new. Residual accepted: the others' sum, and its
  step-of-1 movement over time. (d) A join is visible to members, so recalls count only from each
  member's `joined_at` (review B1). (e) Accepted residual (user 2026-11-05, follow-up beside MF-0021):
  anyone can create a group, so 2 alt accounts + the viewer + one target pass the gate and
  total − own − 0 − 0 = the target's figure; MF-0011's heatmap shares this.

## Decided without a question

- One active expedition per group; window `[starts_at, starts_at + 7 days)`; one goal kind:
  correct-recall count in one domain of the group's pack. ("Healthy share" goals would depend on the
  MF-0011 figures; after Dec 7.) Source: draft 2026-11-03, Q14.
- Target: a whole number from 10 to 1000, chosen by the admin (form default 100). Source: KISS; open to
  change at this checkpoint.
- Counted attempts: every `attempts` row of the group's pack (practice, duel, cuckoo, storm), by anyone
  who is a member **at read time**, with `answered_at` in the window **and at or after that member's
  `joined_at`** (review B1, user 2026-11-05: otherwise a join makes the total jump by exactly the
  joiner's own count). A member who leaves stops counting.
- After the window ends the card keeps showing the last expedition's result until the admin starts a new
  one; starting is allowed once no expedition is active. No cancel, no edit (Out of Scope).
- Not cached: group-scoped, a function of `now` (nextjs-data; MF-0011 C-1).
- Migration applied with `supabase migration up --local` (no reset, no wipe).

## Edge inputs (shown result)

| Input state | Shown | Decided by |
|---|---|---|
| no expedition ever | member: "No expedition yet." admin: the start form | agent (draft) |
| active, 0 counted | "0 of 200 correct recalls · 0%", "On the way", time left | agent |
| progress 199 / 200 (99.5%) | "199 of 200 · 99%" (percent is floored, never shows 100 before reached) | agent |
| progress ≥ target while active | "Goal reached", bar full, figure keeps counting ("212 of 200 · 100%") | agent |
| ended, reached | "Goal reached", "Ended" | agent |
| ended, not reached | "Ended: 140 of 200 · 70%", "Not reached" | agent |
| time left ≥ 24 h | "N days left" (floored, "1 day left" singular) | agent |
| 1 h ≤ time left < 24 h | "N hours left" | agent |
| 0 < time left < 1 h | "Less than an hour left" | agent |
| now = ends_at exactly | "Ended" (window is half-open) | agent |
| attempt at starts_at / at ends_at | counts / does not count | agent |
| attempt on a rejected question, or at/after the member reviewed it | does not count | MF-0007 |
| incorrect attempt | does not count | Q5 / draft |
| group of 1–3 members | everyone: "Expeditions need at least 4 members." No start form; start refused by the DB; progress read refused | **user** (C-2) |
| group of exactly 4 members | expedition allowed | **user** (C-2) |

## Success Criteria (frozen 2026-11-05)

- [x] SC-1: Only the group admin can start an expedition: a member and a non-member are refused (42501);
  a group with fewer than 4 members is refused; a second start while one is active is refused, also when
  two starts race; the times come from the database; a domain not in the group's pack or a target
  outside 10–1000 is refused (DB) and shown as a field error (action). Proof: DB acceptance test with
  real tokens.
- [x] SC-2: Progress = count of countable correct attempts by current members since they joined, on the
  group's pack, on a skill of the expedition's domain, with `answered_at` in `[starts_at, ends_at)`; boundaries and every
  filter row of the edge table hold, and the SQL count equals `countableAttempts` over the same fixture
  (parity). Proof: DB acceptance test (literals from the fixture).
- [x] SC-3: Non-members read nothing (table and progress); the progress read is refused for a group of
  fewer than 4 members; no API path a member can call returns a per-member number or another member's
  attempts (the progress function returns a single integer; attempts RLS still own-rows only); `anon`
  reads nothing. Proof: DB acceptance test.
- [x] SC-4: Percent, status word and time left follow the edge table. Proof: engine acceptance test.
- [x] SC-5: The admin starts an expedition from the group page (domain select + target, field errors
  shown); every member sees the goal, progress in words and numbers, and time left; a member sees no
  start control. Proof: UI acceptance test (form) + browser with 3 local users.
- [x] SC-6: Advisors clean, grants gate green and unedited, component split, typecheck, lint, test,
  test:db, build. Proof: receipt.

## Concerns

| # | Collision | Owner | Status |
|---|-----------|-------|--------|
| C-1 | Progress needs every member's attempts with the MF-0007 filters. The only path today is `group_attempts` via the secret key, and ADR 0004 locks it to ONE importer (a second needs a new ADR). Alternative: a SQL count callable by `authenticated` that re-states the 2-condition filter rule in SQL (a second copy, locked by a parity test) and returns one integer. | user | resolved 2026-11-05: SQL count RPC + parity test; ADR 0004 untouched |
| C-2 | Total − own = the others' sum; in small groups that is one named member's figure (worked example above). | user | resolved 2026-11-05: expeditions only in groups of ≥ 4 members; residual (others' sum) accepted |
| C-3 | `pnpm test:db` and the migration need the local stack; Docker is not running. | user | resolved 2026-11-05: user starts Docker; `migration up --local` only, no `db:reset` |

## Out of Scope

- Rewards, cross-group competitions, notifications, cancel/edit an expedition, "healthy share" goals,
  per-member contribution views, expedition history list.

## Decided by the user

- 2026-11-05: C-1 → SQL count RPC callable by members, parity test against `countableAttempts`.
- 2026-11-05: C-2 → expeditions require ≥ 4 group members (start and progress read).
- 2026-11-05: C-3 → user starts Docker; the migration applies with `supabase migration up --local`;
  no proof command wipes shared local state (`db:reset` not approved).
- 2026-11-05: defaults in "Decided without a question" kept as drafted; SCs frozen.
- 2026-11-05 (after review): B1 → count only recalls made since joining; SC-2 wording + DB acceptance
  re-freeze approved. Alt-account gate bypass accepted, follow-up filed. "6 days left" right after a
  start: floor rule kept.

## Open questions

- none.

## Iteration Log

<!-- append-only -->
- 2026-11-05 it-1: DESIGN closed at checkpoint (C-1..C-3 resolved by the user); SCs frozen.
- 2026-11-05 it-1: acceptance frozen red by hand (no `ticket:freeze` script): 3 files, 29 cases
  (1 green regression lock: attempts RLS), FROZEN.json. LOOP-PLAN written; awaiting plan approval.
- 2026-11-05 it-1: plan approved; BUILD T1–T5; receipt green except pre-existing MF-0016 sync tests.
- 2026-11-05 it-1: review changes-requested (B1 join leak). User chose join-time cut; regression RED
  (`expected 8 to be 7` ×2), migration edited in place + re-applied, DB acceptance re-frozen (history).
- 2026-11-05 it-1 close: re-review approve on b7a1fb53…; final tree 11b2794d… (post-review migration comment only). Receipt DONE (pre-existing MF-0016 sync tests excepted). Hand-off.

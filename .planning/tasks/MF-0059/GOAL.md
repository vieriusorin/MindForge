---
ticket_id: MF-0059
title: "Groups follow a path: joining a group enrolls you in its path"
tier: high-risk                   # group model + RLS/definer functions; join flow; possibly figures over other members' data
stage: handoff
branch: feat/MF-0059
builds_on: [MF-0058]
last_iteration: 1
goal_status: complete-pending-manual-commit
---

> Split out of MF-0058 on 2026-11-06. The user's answer to "should a group follow a path?" was "yes, we assume that
> if you enter a group you expect to follow a path, there can be discussions and so on".

## Objective

**Today.** A group follows one pack (`public.groups.pack_slug`). Its heatmap, expedition and review membership all key
on that pack. MF-0058 adds per-learner paths, but a group knows nothing about them.

**End state.** A group can follow a path. Joining it means the member is following that path: they are enrolled
(MF-0058 `path_enrollments`) on join, and the group page shows the path and the group's current course. Discussion
around the path is a later step, but the model leaves room for it.

## Facts (re-derived 2026-11-06 at pickup, branch feat/MF-0059 off main cc79c34)

- **F1. There is no "leave group".** No RPC, action or grant deletes from `group_members` (MF-0002: "no direct
  INSERT/DELETE grants at all"). The draft's "on leaving the group" question has nothing to hook into today.
- **F2. `groups.pack_slug` is fixed at creation.** `authenticated` may update `name` only, and no RPC changes the pack.
  It drives: the heatmap (`mf0011_group_heatmap.sql:38`), expeditions (`mf0017_expeditions.sql:62`), review membership
  (`private.is_pack_member`, `mf0007_reviews.sql:113`), the group page's reads and play links (`page.tsx:119-200`) and
  Today's pack via `primaryPackSlug` (`src/server/packs/primary-pack.ts`). Keeping it as "the group's current course"
  leaves all of them working unchanged.
- **F3. Paths are files, not DB rows.** `paths/claude-developer.yaml` (5 course packs); the DB has a pack registry
  (`private.packs`, written by `db:sync-keys`) but no path registry. A DB function cannot check "this pack is in this
  path" unless a registry is added, the same way MF-0004 added `private.packs`.
- **F4. Enrolling is already allowed.** `path_enrollments` grants `insert` to `authenticated` for its own row, and the
  primary key makes a repeat a no-op.
- **F5. A joiner can't read the group before joining.** `groups: members read` (RLS) means the join page shows no
  group name or pack today. The notice needs a new invite-code lookup (a definer function returning name + path).
- **F6. `joinGroup` is a redirect-style action** bound into `JoinCard` (pre-`state-and-data.md`). Touching it means
  migrating it to `useMutation` (rule's Migration section).
- **F7. Main CI is red** on cc79c34: `mf-0028` SC-4 and `mf-0053` SC-5 (`gate:planning` over the repo) fail with
  "MF-0059: tier, stage, goal_status repeated at column 0, likely two tickets merged". Replayed read-only on
  `git archive cc79c34 .planning`: exit 1; on this tree after the split: exit 0.

## Affected

- **Roles:** group admin (creates a group for a path, moves it to the next course), member (enrolled on join). No
  maintainer change. Enrollment stays private (MF-0058): no member sees another's.
- **Surfaces:**
  - DB (new migration): `public.groups.path_slug text null` (no new grant); `private.path_courses(path_slug, position,
    pack_slug)` registry, written by `db:sync-keys` from `paths/*.yaml` (like `private.packs`, MF-0004);
    new `private/public.create_path_group(p_name, p_path_slug)`; `create or replace private.join_group` (same
    signature) enrolls on a new membership; new `private/public.advance_group_course(p_group_id)`; new
    `private/public.group_invite_preview(p_code)` returning the group's name and `path_slug` only
  - `scripts/sync-question-keys.mjs` (writes the registry)
  - `src/features/groups`: create-group form gains "Pack or Path"; join card shows the path notice and moves to
    `useMutation` (F6); group page gains a Path card with "Move to next course" for the admin
  - `src/server/groups/get-group.ts` DTO gains `pathSlug`; new `get-invite-preview.ts`
  - `src/engine/path`: `groupCourseStep({ path, currentPack })` (position n of N, next course or null)
  - `CONTEXT.md`: Group path, Current course

## Decided by the user (2026-11-06, intake)

- **Q1:** the path sits **beside** `pack_slug`; `pack_slug` becomes the group's **current course**, always a course of
  the path. The **admin** moves the group to the next course.
- **Q2:** existing groups **stay pack-only** (`path_slug` null). No data migration.
- **Q3:** joining **auto-enrolls**, and the join page says so before the button ("This group follows the {path}
  path. Joining starts it for you."). Leaving the path on the path page keeps the group membership.
- **Q4:** the group page shows the path, its courses in order and the current course. **No figure about other
  members.** Discussion is reserved as its own ticket (**MF-0063**).

## Decided by the user (2026-11-06, DESIGN checkpoint)

- **C-1: Move ends a running expedition** (not refuse, not keep running). Consequences, decided without a further
  question because each is the only way to keep MF-0017's figures right and its frozen tests unedited:
  - `public.expeditions` gains `pack_slug`, filled at insert from the group (a `before insert` trigger, so MF-0017's
    direct-SQL fixtures stay valid) and backfilled for existing rows; `expedition_progress` counts in the
    expedition's own pack. Without it a finished expedition would be re-counted in the new course after a move.
  - The move sets `ends_at = now()` on the running one, which frees the exclusion slot for a new expedition in the
    new course.
  - `latest_expedition` keeps its exact columns (frozen MF-0017 SC-3 lists them). The page names the domain from a
    new `expedition_pack(p_expedition_id)` read (same membership check): domain codes like `D1` repeat across packs.
  - The card says "Ended. The group has since moved to the next course." when an ended expedition's pack differs from the
    group's current pack (derived from `expedition_pack` and `GroupDetail`, no reason column).
  - Race: `advance_group_course` locks the group row (`for update`); `start_expedition` re-reads the pack under
    `for share` of the same row, so a start can't validate a domain against a pack that is being replaced.
- **C-2: accept.** Review follows the group's current course (`is_pack_member` unchanged).
- **C-3: keeps working as a pack group.** The registry follows the file; Move is refused with a message.
- **C-4: yes.** BUILD runs `supabase migration up` and `pnpm db:sync-keys` on the local stack only; no `db:reset`.
- **Expeditions at your own pace (user, 2026-11-06, after the checkpoint):** "expeditions should not be 7 days, we
  can do it at our own pace". Answers: an expedition is **open until the target is reached or it is ended**, and the
  change lives **inside MF-0059**. Decided without a further question, each from that answer:
  - `start_expedition` sets `ends_at = null` (open). The CHECK `expeditions_seven_days` becomes
    `ends_at is null or ends_at > starts_at`. The one-running-per-group exclusion constraint stays
    (`tstzrange(starts_at, null)` is unbounded).
  - Running = `ends_at is null`. Ways to end: the admin presses **End expedition** (new
    `end_expedition(p_group_id)`, admin only, 42501 otherwise); the course moves (C-1); or a start of the next one
    when the running one has reached its target (closed at the start time in the same transaction). A start while
    an unreached one runs is still refused (23P01, MF-0017 SC-1).
  - Reaching the target doesn't end it by itself: progress is computed on read, and the card shows "Reached" with a
    full bar until the admin ends it or starts the next one.
  - Migration: rows still running at migration time (`ends_at > now()`) become open (`ends_at = null`); ended rows
    keep their dates. `expedition_progress` counts up to `coalesce(ends_at, 'infinity')`.
  - Engine: `summarizeExpedition` takes `endsAt: Date | null` and returns `timeLeft: { kind: "open" }` and
    `isActive = startsAt <= now` when it is null. Bounded inputs behave as today (frozen MF-0017 engine tests
    unchanged).
  - Screens: the start form drops any 7-day wording; the card drops "N days left" for an open expedition and the
    admin sees **End expedition**; `CONTEXT.md` Expedition loses "7-day".
  - Privacy (MF-0017 C-2, tenure B1) is unchanged: same ≥ 4 members, one integer, recalls since joining.
- **T0: yes.** The GOAL.md split (MF-0061) and the `key-length.mjs` comment ship as a separate hunk and commit.

## Decided without a question

- **Creating a path group enrolls the creator too.** Creating = joining as admin (Q3's rule), with the same
  notice on the form. Source: user's Q3 + "if you enter a group you expect to follow a path".
- **A path group starts on the path's first course** (`pack_slug` = position 1). Source: Q1 (admin advances; nothing
  else picks a start).
- **Enroll only on a new membership.** A member who already left the path and opens the invite link again is not
  re-enrolled. Source: MF-0058 "a learner can leave a path" (leaving must stick).
- **Already enrolled before joining:** no change, `started_at` kept (PK no-op). Source: MF-0058 SC-5 idempotence.
- **"Move to next course" is one step forward only.** No skipping, no going back. Source: Q1 wording; YAGNI.
- **The registry is the DB's truth for "pack is in path".** A file check alone would let a direct RPC set any pack
  (server-side.md §4: authorization twice-checked). It is fully owned by `db:sync-keys` (delete + re-insert per
  path in one transaction); nothing else writes it, so re-runs and `db:reset` lose no one else's decision.
- **Additive RPCs, not new signatures.** `create_group(text, text)` and `join_group(text)` keep their signatures, so
  the frozen MF-0002 / MF-0004 tests are untouched; `groups.path_slug` gets no grant, so the MF-0005 allow-list is
  unchanged. New functions revoke `anon`/`PUBLIC` (MF-0005 SC-3).
- **Main CI red fixed as T0** (separate hunk): the merged GOAL.md split (MF-0061), see the Iteration Log.

## Success Criteria

- [x] SC-1: Registry. After `db:sync-keys`, `private.path_courses` holds `claude-developer` positions 1–5 =
  `ai-capabilities, platform-foundations, claude-code-in-action, agent-skills, subagents`, unreadable by
  `authenticated` and `anon`. A second run leaves the same 5 rows. Proof: `*.db.test.ts` + a sync run.
- [x] SC-2: `create_path_group('G', 'claude-developer')` makes a group with `path_slug = claude-developer`,
  `pack_slug = ai-capabilities`, the caller as admin **and enrolled**. An unknown path → 22023. It shares
  `create_group`'s cap of 10 per creator (the 11th → 54000). Proof: `*.db.test.ts`.
- [x] SC-3: `join_group` on a path group adds the member **and** a `path_enrollments` row; on a pack-only group no
  enrollment row. Joining twice: still one membership, one enrollment. Joined, left the path, joins again: still
  not enrolled. Already enrolled before: `started_at` unchanged. Proof: `*.db.test.ts`.
- [x] SC-4: `advance_group_course`: a non-admin → 42501; a pack-only group → refused; at position n < N the pack
  becomes position n+1; at the last course → refused, pack unchanged; the group's current pack not in the registry (path file changed) → refused. Proof: `*.db.test.ts`.
- [x] SC-9: Moving ends the expedition (C-1). With a running (open) expedition, `advance_group_course` sets its
  `ends_at` to the move time and changes the pack in one transaction; `expedition_progress` of that expedition
  still counts only its own pack's domain recalls in `[starts_at, ends_at)` (a recall in the new course after the
  move adds 0); the admin can start a new expedition in the new course right away; `expedition_pack` returns the
  old pack to members and refuses non-members (42501). The group card shows "Ended: the group moved to the next
  course" with the old domain's name. Proof: `*.db.test.ts` + browser.
- [x] SC-10: Own pace. `start_expedition` makes an open expedition (`ends_at` null), and a recall weeks later still
  counts. `end_expedition`: a member → 42501; the admin → `ends_at` set, progress frozen at that point, a new start
  allowed. Starting while an unreached one runs → 23P01; while a reached one runs → the old one is closed and the
  new one starts. `summarizeExpedition` with `endsAt: null` → `timeLeft: { kind: "open" }`, active, status by
  progress; bounded inputs unchanged. Proof: `*.db.test.ts` + engine oracle test + the re-frozen MF-0017 SC-1 and
  MF-0052 SC-5 (see below) + browser.
- [x] SC-5: `group_invite_preview(code)`: signed in → the group's `name` and `path_slug` (null for pack-only) and
  nothing else; unknown code → no row; `anon` → no execute. Proof: `*.db.test.ts` + the MF-0005 suite unchanged.
- [x] SC-6: `groupCourseStep({ path, currentPack })` returns `{ position, total, next }` per the edge table. Proof:
  oracle unit test, literals from the table.
- [x] SC-7: Screens (local stack, light, dark, 375px, screenshots in `.planning/evidence/MF-0059/`):
  - create form: "Pack" or "Path"; choosing a path shows the enroll notice; submitting lands on the new group;
  - join page for a path group: the notice with the path name before Join; pack-only group: no notice;
  - group page of a path group: Path card (courses in order, current one marked, "Course n of N"), admin sees
    "Move to next course" (disabled with a reason at the last course); member doesn't; pack-only group: no card.
  - Proof: browser + `ui` tests for the create form and join card (valid submit, server error, pending).
- [x] SC-8: Nothing else moves: MF-0002, MF-0004, MF-0005, MF-0011, MF-0054 acceptance files pass with no edit;
  MF-0017 and MF-0052 pass with only the two re-frozen assertions (SC-10). `CONTEXT.md` defines Group path and Current course. `pnpm typecheck && pnpm lint && pnpm test`,
  `pnpm test:db`, `pnpm check:packs`, `pnpm gate:planning`, `pnpm build` exit 0. Evidence has "See it yourself".

### Edge-input table (SC-4, SC-6)

| Input | Shown / result | Decided by |
|---|---|---|
| pack-only group (`path_slug` null) | no Path card; advance refused | user (Q2) |
| current = position 1 of 5 | "Course 1 of 5", next = platform-foundations | user (Q1) |
| current = position 5 of 5 | "Course 5 of 5", next = null, Move disabled "Last course of the path" | draft |
| current pack no longer in the path file | card shows the path, no current mark, "Course ? " never shown: text "This group's course isn't in the path any more"; advance refused | draft (C-3) |
| path file removed entirely | treated as pack-only on screen; advance refused | draft (C-3) |
| active expedition | Move allowed; confirm text "This ends the running expedition"; it ends at the move | user (C-1) |
| running expedition (`ends_at` null) | "On the way" or "Reached", no time left; admin sees End expedition | user (own pace) |
| ended, pack = group's current pack | "Ended" (reached / not reached as today) | MF-0017 |
| ended, pack ≠ group's current pack | "Ended. The group has since moved to the next course." | user (C-1) |
| reached, still running, admin starts the next | old one closed at the start time, new one open | draft (own pace) |
| legacy row with a 7-day end in the past | shown as today | migration |

## Constraints → how met

- Privacy (Q4): the group page shows the path and the admin-set current course only; no member counts, no
  enrollment state of others. Enrollment rows stay own-only (MF-0058 RLS untouched). The invite preview returns
  name + path only, to a signed-in caller holding the code (the code already grants joining).
- Migrations: RLS on the registry with no policy, `revoke all` before grants, definer functions in `private`,
  invoker wrappers in `public`, `revoke execute … from public, anon`.
- Server Actions: `createPathGroup`, `joinGroup` (migrated), `advanceGroupCourse`: auth → zod → RPC →
  `ActionResult`, through `useMutation`; `refresh()` after advance.
- Expedition figures over other members (MF-0017 privacy): unchanged rules (≥ 4 members, tenure, one integer).
  Ending early only shortens the window; it adds no per-member figure. The move time is visible to members and is
  an admin act, not member data.
- Figures: "Course n of N" comes from `groupCourseStep` in `src/engine/path`, never page arithmetic.
- shadcn only: `Card`, `Badge`, `Button`, `RadioGroup` (pack/path choice), `Select`; status words, not colour.

## Concerns

| # | Collision | Owner | Status |
|---|-----------|-------|--------|
| C-1 | Expedition progress reads `groups.pack_slug` at query time (`mf0017_expeditions.sql:62,144`) with a domain code of the old pack. Moving the course mid-expedition would count recalls in the wrong pack. Recommendation: **refuse "Move to next course" while an expedition is active** (admin can wait ≤ 7 days). | user | resolved 2026-11-06 (Decided by the user) |
| C-2 | Review access (`private.is_pack_member`) follows the group's current pack. After a move, members of that group lose Review on the previous course (unless another group gives it). Recommendation: **accept** — Review follows the current course, like Today; the path page still links every course's Walk. | user | resolved 2026-11-06 (Decided by the user) |
| C-3 | The path file can change after groups use it (a course removed or reordered). Recommendation: the registry follows the file; a group whose current pack left the path keeps working as a pack group, and Move is refused with a message. | user | resolved 2026-11-06 (Decided by the user) |
| C-4 | `pnpm test:db` needs the registry rows, written by `db:sync-keys` (local, no reset). DB tests seed their own fixture path rows where possible. `pnpm db:reset` is **not** needed. | user | resolved 2026-11-06 (Decided by the user) |

## Out of Scope

- Discussion (MF-0063). A "leave group" feature (F1). Any figure over other members' path progress (Q4).
- Expedition deadlines of any kind (own pace: none). Attaching a path to an existing group (Q2). Moving back or skipping courses.

## Iteration Log

<!-- append-only -->
- 2026-11-06 pickup: `.planning/tasks/MF-0059/GOAL.md` held two tickets (merge of #93 and #95 both reserved MF-0059).
  This folder keeps the groups ticket (issue #91); the key-length retrofit moved to **MF-0061** (issue #96),
  `scripts/lib/key-length.mjs:15` comment repointed. Claimed #91 (In Progress · Intake). Facts F1–F6 re-derived.
- 2026-11-06 intake → design: user answered Q1 beside + admin advances · Q2 old groups stay pack-only · Q3 auto-enroll
  with a notice · Q4 path + course only, discussion reserved (**MF-0063**, issue #98; MF-0062 was taken by #97 meanwhile).
- 2026-11-06 design preflight: `pnpm typecheck` 0 · `pnpm lint` 0 · `pnpm test` 0 (175 files, 928 tests) · `pnpm test:db` 0 (30 files, 134 tests) · `pnpm check:packs` 0 · `pnpm gate:planning` 0 on this tree (1 on main cc79c34, F7: fixed by the split, T0) · `pnpm build` 0 · `pnpm db:sync-keys` not run: BUILD step, local only, no reset (C-4) · `pnpm db:reset` not needed. Main CI `failure` on cc79c34 (F7). `pnpm ticket:collisions MF-0059` exit 0 after listing 10 frozen files whose assertions were read (none re-freezes; LOOP-PLAN draft).
- 2026-11-06 design checkpoint: user answered C-1 **move ends the expedition** · C-2 accept · C-3 pack group · C-4 local
  only · T0 yes. C-1 widened the ticket into MF-0017 additively (expedition stores its pack, CHECK relaxed to ≤ 7 days,
  new `expedition_pack` read, SC-9). `pnpm ticket:collisions MF-0059` exit 0 (11 frozen files read, none re-freezes).
  SCs SC-1…SC-9 ready to freeze as text; next: Stage 2b RED after the user confirms the SC set.
- 2026-11-06 design (after checkpoint): user: "expeditions should not be 7 days, we can do it at our own pace" →
  open until reached-and-replaced or ended, inside MF-0059. SC-9 rewritten (no 7-day / ended-early helper), SC-10
  added, SC-8 narrowed. Re-freeze needed (approval at plan): MF-0017 SC-1 (`seven_days`) and MF-0052 SC-5
  (`endsAt > now`, per-domain window). `pnpm ticket:collisions MF-0059` exit 0. The acceptance-writer was told
  mid-run to drop the 7-day asserts and the ended-early file; it gets SC-10 next.
- 2026-11-06 freeze: acceptance-writer wrote 3 files (DB: SC-1–5, 9, 10; engine: SC-6; engine: SC-10) + typed stubs
  (`group-course-step.ts` throws; `summarizeExpedition` widened to `endsAt: Date | null`, throws on null; bounded
  unchanged). Re-checked by the orchestrator: typecheck 0, lint 0, `pnpm test` 12 red / 928 green (reds only in the 2
  new engine files), hashes in FROZEN.json match (LF-normalised sha256, written by hand: no `ticket:freeze`). DB file
  red twice for the expected reason, no leftovers; full `pnpm test:db` 14 red only in the new file. Writer's
  interpretations (error codes unnamed in SC-4, row-shaped preview, text `expedition_pack`, closed-at = new
  starts_at) are listed in LOOP-VERIFY for plan approval. Seen once: `mf-0017` SC-1 concurrent starts gave 40P01
  instead of 23P01, green on re-run (pre-existing flake, not touched). Other session's MF-0064–MF-0068 and an
  `[ELIFECYCLE] …` folder appeared in `.planning/tasks/`; MF-0068 (seed path groups) builds on this ticket.
- 2026-11-06 plan: ticket-planner wrote LOOP-PLAN iteration 1 (15 tasks: T0, TF, T1–T10, TR, T13, T14; draft "Symbols changed" / "Frozen files this will re-freeze" kept verbatim, 8 symbols appended). Graph checked with `validatePlan` (acyclic, every SC closed), every current and planned file in exactly one task's owns, non-orchestrator owns inside agent scopes. `node scripts/frozen-collisions.mjs MF-0059` exit 0 (20 symbols, 76 files). 10 approval items for the user, incl. the MF-0017 SC-1 / MF-0052 SC-5 re-freeze, `for no key update` instead of `for share`, and a stale-tab `p_from_pack` guard on Move. Stage stays `plan` until the user approves.
- 2026-11-06 plan approval (user: "approve"): plan approved as written, incl. the re-freeze of MF-0017 SC-1 and
  MF-0052 SC-5 (exact lines in LOOP-PLAN), lock mode `for no key update` on start/end/advance (supersedes "for share"
  above), stale-tab guard `p_from_pack` (40001), separate `createPathGroup`, end-with-nothing-running → P0002, join
  enrolls only when the path is in the registry, copy ("No end date", dialogs), and the acceptance-writer's
  interpretations in LOOP-VERIFY. Stage → build.
- 2026-11-06 build baseline: typecheck 0, lint 0, `pnpm test` 12 red (only the 2 frozen MF-0059 engine files) / 928
  green, `pnpm test:db` 14 red (only the frozen MF-0059 DB file) / 134 green. Pre-existing flake: mf-0017 SC-1
  concurrent starts (40P01 once). Wave 1 dispatched: T1 schema-builder, T4 service-builder; T3 by the orchestrator.
- 2026-11-06 build: T4 done (service-builder; frozen SC-6 6/6, typecheck 0). T3 done by the orchestrator: tests first
  (3 new engine test files + card utils expectations, 19 red), then `isExpeditionActive`, `canStartExpedition`,
  `isEndedByCourseMove`, the `"open"` kind and "No end date" / moved-on / no-7-day copy: 33/33 green incl. frozen
  MF-0017 engine and MF-0059 SC-10 engine files; typecheck 0. Waiting on T1 (schema-builder).
- 2026-11-06 build: T1 done (schema-builder; migration applied with `migration up`, lock test 5/5 + vacuity reds,
  frozen MF-0059 DB file 34/34 with the registry). Plan defect fixed: T1's MF-0017 `-t` filter skipped the fixture case;
  done_when now runs the whole file. T2 done by the orchestrator (test first, 5 red → green; `pnpm db:sync-keys` writes
  claude-developer 1–5; 6 frozen sync suites + frozen MF-0059 DB file 56/56). T5 done (seed open, `pnpm test
  src/dev-seed` 34/34). TR done (user-approved): MF-0017 SC-1 and MF-0052 SC-5 re-frozen, red-before pasted in
  LOOP-VERIFY, FROZEN.json history written; MF-0017 13/13. T6 dispatched.
- 2026-11-06 build: T13 done by the orchestrator (CONTEXT.md Expedition own pace, Group path, Current course, Group
  admin; MINDFORGE.md co-op wording; runbook B3 covers `paths/`). done_when greps pass. Waiting on T6.
- 2026-11-06 build: T6 done (service-builder; `to-expedition` test red → green; MF-0052 seed 5/5). Scope deviation
  recorded for T10: `src/app/(app)/groups/[groupId]/page.tsx:71` = LOOP-PLAN 10.4's nullable-end line, applied in T6 to
  keep typecheck green. Orchestrator removed the T5-orphaned `DAY` const in `plan-units.test.ts`. Tree: typecheck 0,
  lint 0 warnings, `pnpm test` 953/953. T7 dispatched.
- 2026-11-06 build: T7 done (ui-builder; 24 red → 39 green; full `pnpm test` 980). Its OPEN 1 fixed by the
  orchestrator: `InviteCode` moved from `src/server/groups/types.ts` to `src/lib/invite-code.ts` (+ test, red first)
  because the client-imported `groups/schemas.ts` must not import `src/server/**` (state-and-data.md §2); plan
  deviation (new lib file outside every owns) logged here. `pnpm test` 983, typecheck 0, lint 0. T8 + T9 next.
- 2026-11-06 build: T9 done (service-builder; `endExpedition` auth → zod → `end_expedition` → refresh → ActionResult;
  typecheck 0, lint 0, `pnpm test src/features/expeditions` 19/19). T8 running.
- 2026-11-06 build: T8 done (ui-builder; join card via useMutation, tests 6 red → 11 green; `pnpm test` 994, typecheck,
  lint, `pnpm build` 0; join page checked over HTTP with a session cookie: path notice / no notice / invalid / no join on
  GET). Deviations: card takes `notice` text (page builds it), extra `join-ready.tsx` child, invalid input returns the
  invalid-link message. No real browser click yet → T14. T10 dispatched.
- 2026-11-06 build: T10 done (ui-builder; tests first; `pnpm test` 1021, typecheck, lint, build 0). Deviations logged:
  existing create-form tests edited in setup only (mock exports `createPathGroup`, `paths` prop), hook arg `paths`,
  new non-approved copy (Move dialog body "The group's heatmap and review follow the new course. The group can't move
  back.", radio legend, path select label, Cancel/Move, "/groups" error copy). Stage → test.
- 2026-11-06 test: fresh-context review approve-with-fixes (0 blockers, 4 should-fix, 4 nits; REVIEW.md). Should-fix 1
  (close time before start) and 2 (move onto an unregistered pack) dispatched to schema-builder with RED-first regressions.
  Should-fix 3: browser proofs captured (End clicked, last course disabled, pack-only group, pack-only invite). Browser
  finding → user chose neutral copy: `movedOnLine` = "Ended. The group has since moved to the next course." (test red
  first, 24/24). Should-fix 4 goes to the hand-off (B2/B3 right after merge).
- 2026-11-06 test → hand-off: review round 2 approve-with-fixes, should-fix 1–3 resolved (REVIEW.md reviewed_hash
  ec1295e7…, equal to the final tree's diff hash); should-fix 4 = rollout note in the evidence and hand-off; 4 nits listed
  as follow-ups. Receipt PASS (LOOP-VERIFY): typecheck, lint, test 1021, test:db 181, check:packs, build, gate:planning,
  collisions, frozen 95/0. goal_status → complete-pending-manual-commit.

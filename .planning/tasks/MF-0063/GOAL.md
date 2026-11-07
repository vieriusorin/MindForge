---
ticket_id: MF-0063
title: "Group path discussion: the smallest way for a group to talk about its current course"
tier: high-risk                   # schema + RLS + a definer write; a link other members open
stage: handoff
branch: MF-0063
builds_on: [MF-0059]
last_iteration: 0
goal_status: complete-pending-manual-commit
---

> Reserved 2026-11-06 from MF-0059 (user answer Q4 at intake: "Path + course only; discussion reserved as its own
> ticket"). Origin: the user's brief for groups following a path, "there can be discussions and so on".

## Objective

**Today.** After MF-0059 a group can follow a path and has a current course, but members have nowhere in MindForge
to talk about it, and nowhere to find where the group talks.

**End state.** The group admin can set one external chat link for the group (a Slack channel, a Teams chat, a
Discord thread) on the group page, change it or remove it. Every member sees it next to the group's current course
as **Discuss this course**, with the link's host shown, and opens it in a new tab. Nothing a member writes is stored
in MindForge, so there is nothing to moderate.

## Facts (re-derived 2026-11-06 at pickup, branch MF-0063 off main 660f1c1)

- **F1. Group ↔ course.** `public.groups.pack_slug` is the group's current course; `groups.path_slug` (nullable) is
  the path a path group follows (`20261106140000_mf0059_path_groups.sql` §1.1, CONTEXT.md "Current course"). A
  pack-only group's current course is its pack. So one link per group always has a current course to sit next to.
- **F2. Who reads a group row.** `groups: members read` (RLS, `mf0002_groups.sql`) lets members only read a group;
  the table-level `SELECT` grant covers any new column. Non-members get no row.
- **F3. Who writes a group row.** `authenticated` holds `update (name)` only (column grant, MF-0002) and the policy
  `groups: admin updates`. Any other column is written only by a definer function (e.g. `advance_group_course`).
- **F4. The grants gate** (`src/server/db/__tests__/mf-0005-grants.db.acceptance.test.ts`, frozen) lists every
  relation and column privilege of `anon` / `authenticated` / `PUBLIC`, and every `public` function `anon`/`PUBLIC`
  can execute. A new column with no grant and a new function with `revoke execute … from public, anon` leave all
  three lists unchanged.
- **F5. The invite preview** (`group_invite_preview`) returns name + `path_slug` only, so a non-member holding a code
  cannot read the link before joining.
- **F6. `getGroup`** (`src/server/groups/get-group.ts`) is the group page's only `from("groups")` read; no frozen
  test names `GroupDetail` or `getGroup` (grep of `*acceptance*`, 2026-11-06).
- **F7.** Main CI on 660f1c1: `success`.

## Affected

- **Roles:** group admin (sets, changes, removes the link), member (sees and opens it), non-member (sees nothing).
- **Surfaces:**
  - DB (new migration `20261106160000_mf0063_discussion_link.sql`): `public.groups.discussion_url text null` with a
    CHECK; `private.set_group_discussion_url(p_group_id uuid, p_url text)` (definer, admin only) and its invoker
    shim `public.set_group_discussion_url`.
  - `src/server/groups/get-group.ts` + `types.ts`: `GroupDetail.discussionUrl`.
  - `src/features/groups/schemas.ts` (`DiscussionUrl`, `DiscussionLinkFormInput`, `SetDiscussionLinkInput`),
    `actions.ts` (`setGroupDiscussionLink`), `types.ts`, `utils/rpc-errors.ts`.
  - New components `discussion-link-card/` (view) and `discussion-link-form/` (admin form).
  - `src/app/(app)/groups/[groupId]/page.tsx`: the Discussion card under the path card.
  - `src/server/db/database.types.ts` (regenerated), `CONTEXT.md` (Discussion link).

## Decided by the user (2026-11-06)

- **U-1 Merge:** the orchestrator commits, pushes, opens the PR and merges. This ticket never commits.
- **U-2 Approvals:** the orchestrator approves the high-risk plan; a fresh-context diff-reviewer runs before merge.
  `pnpm db:reset` on the LOCAL stack is allowed, under the shared db lock. No hosted project is touched.
- **U-3 Shape:** an admin-set external chat link. No user posts stored in MindForge, no moderation.

## Decided without a question (orchestrator dispatch, 2026-11-06; the user can overturn each)

- **One link per group, not per course.** Shown next to the group's current course (F1), labelled "Discuss this
  course" with the link's host visible. Source: orchestrator decision; YAGNI (a per-course table is a later ticket).
- **Only the group admin sets or clears it; members read it; non-members see nothing.** Server Action: auth → zod
  re-parse → RPC → `ActionResult`; react-hook-form form after `create-group-form`. Source: orchestrator; F2, F3.
- **https only, length-capped, validated twice**: the shared zod schema AND a DB CHECK; opened with
  `target="_blank" rel="noopener noreferrer"`. Source: orchestrator.
- **The rule.** A link is `https://`, then a host of ASCII letters, digits, dots and hyphens, an optional port, then
  optionally `/`, `?` or `#` followed by characters that are neither whitespace nor control characters; at most
  **500** characters. No user-info (`https://a@b`): it would make the shown host lie. Lower-case scheme only.
  Source: this ticket (the cap and the user-info rule are the agent's choice; the orchestrator asked for "https
  only, length-capped").
- **Empty input clears the link** (one action for set and clear; the form's Remove button sends ""). Source: KISS.
- **The shown host is `new URL(url).host`.** Source: the dispatch ("link host visible").
- **Placement:** a "Discussion" card right after the path card (or where it would be, for a pack-only group), its
  description naming the current course. **Members don't see the card while no link is set**; the admin always
  sees it, with the form. Source: agent choice, nothing to act on for a member.
- **No audit column** (who set it, when). Source: YAGNI; nothing reads it.
- **Inline role work.** The acceptance tests, plan and builds are written in this session (role agents are optional
  per the skill); the orchestrator dispatches the fresh-context reviewer (U-2).

## Success Criteria

- [x] SC-1: Schema rule. `DiscussionUrl` (in `src/features/groups/schemas.ts`) accepts
  `https://chat.example.com/c/1`, `https://example.com`, `https://example.com:8443/x?y=1#z`, and `""` (→ `null`,
  clear), trimming surrounding spaces; it rejects `http://example.com`, `javascript:alert(1)`, `HTTPS://example.com`,
  `https://user@evil.example`, `https://exa mple.com`, `https://example.com/a b`, `ftp://example.com`, `example.com`,
  and any value over 500 characters, each with the message "Use an https:// link, up to 500 characters." Proof:
  `src/features/groups/__tests__/mf-0063-discussion-link.acceptance.test.ts`.
- [x] SC-2: Action. `setGroupDiscussionLink(input: unknown)`: signed out → redirect to sign-in, no DB call; malformed
  input (bad uuid, bad url, extra key) → `{ ok: false }`, no DB call (a bad url carries the url field error); valid →
  `rpc("set_group_discussion_url", { p_group_id, p_url })` with the trimmed url (or `null` for ""), then `refresh()`,
  `{ ok: true }`; DB 42501 → "Only the group admin can change the discussion link."; DB 23514 → the url field error;
  any other DB error → "Could not save the link. Try again." Proof: same acceptance file.
- [x] SC-3: DB access (local stack). The admin sets the link through `set_group_discussion_url` and a member reads
  it from `public.groups`; a non-member reads no row of the group; a member (non-admin) calling the function →
  42501 and the value is unchanged; a signed-in non-member → 42501; `anon` cannot execute the function; the admin
  cannot write the column by a direct `update` (no column grant); `null` and `''` clear it. Proof:
  `src/server/db/__tests__/mf-0063-discussion-link.db.acceptance.test.ts`.
- [x] SC-4: DB CHECK. Even as the table owner (direct SQL), `discussion_url` refuses `http://…`, `javascript:…`,
  `https://user@host`, a value with a space, and 501 characters (23514), and accepts the SC-1 valid values. Proof:
  same DB acceptance file.
- [x] SC-5: Form (`ui` test). The admin form: a valid url submits `{ groupId, url }` and refreshes the page; an
  invalid url shows the field error and calls nothing; a server field error lands on the field; a server message
  shows under the form; while pending the Save button reads "Saving…" and is disabled; Remove sends `url: ""`.
  Proof: `src/features/groups/components/discussion-link-form/__tests__/mf-0063-discussion-link-form.acceptance.test.tsx`.
- [x] SC-6: Screen (local stack, `pnpm dev`, light + dark + 375px, screenshots in `.planning/evidence/MF-0063/`). As
  the admin: the Discussion card with the form; saving shows "Discuss this course" with the host; removing hides it.
  As a member: the link with the host opens in a new tab (`target="_blank"`, `rel="noopener noreferrer"`), no form;
  with no link, no card. The card shows no figure about any member. Proof: browser.
- [x] SC-7: Nothing else moves. `mf-0005-grants.db.acceptance` and every other frozen file pass unedited;
  `CONTEXT.md` defines Discussion link. `pnpm typecheck && pnpm lint && pnpm test`, `pnpm test:db`, `pnpm build`,
  `pnpm gate:planning`, `pnpm gate:workspace` exit 0. Evidence has "See it yourself".

### Edge-input table (SC-1, SC-6)

| Input | Result | Decided by |
|---|---|---|
| no link set, member | no Discussion card | agent |
| no link set, admin | card with an empty form, "No discussion link yet." | agent |
| link set | "Discuss this course" + "on {host}" + "(opens in a new tab)" for screen readers | orchestrator |
| `""` or only spaces submitted | clears the link | agent (KISS) |
| `http://`, `javascript:`, `data:`, upper-case scheme, user-info, whitespace inside, > 500 chars | field error, nothing saved; the DB refuses too | orchestrator + agent |
| an IDN host typed in Unicode | refused (ASCII host only; paste the `xn--` form) | agent |
| admin saves while a member has the page open | the member sees the new link on the next load | n/a: RSC read |

## Constraints → how met

- Privacy (CONTEXT.md: "No per-member figures are ever shown to other members"): the card shows the course name and
  the link's host only; the link is an admin act, not member data. No figure is added.
- Migrations: the column has no grant (F4); the function is definer in `private`, invoker shim in `public`,
  `revoke execute … from public, anon`; RLS already on `groups`. Local stack only, under the db lock.
- Server Action shape: auth → zod re-parse of `unknown` → RPC → `ActionResult`; called through `useMutation`;
  `refresh()` in the action and `router.refresh()` in the hook (RSC data).
- Validation is never client-only: zod in the form and the action, a CHECK in the DB (SC-4).
- shadcn only: `Card`, `Button`, `Field`, `Input`; `ExternalLink` / `MessagesSquare` icons from lucide.

## Concerns

| # | Collision | Owner | Status |
|---|-----------|-------|--------|
| C-1 | The link points outside MindForge: what members say there is outside this product's privacy rules. | user | resolved: U-3 chose an external link knowingly |
| C-2 | A malicious admin could link a phishing page. The host is shown and the link opens with `noopener noreferrer`; members trust their own admin. | user | resolved: accepted under U-3 (no moderation) |

## Out of Scope

- In-app posts, comments, moderation, retention (U-3). A link per course. Notifications when the link changes.
  A "leave group" feature (MF-0059 F1).

## Open questions

- None.

## Iteration Log

<!-- append-only -->
- 2026-11-06 pickup: claimed by the orchestrator (issue #98, In Progress, branch MF-0063). Facts F1–F7 re-derived.
- 2026-11-06 design preflight: `pnpm typecheck` 0 · `pnpm lint` 0 · `pnpm test` 0 (195 files, 1085 tests) · `pnpm test:db` 0 (34 files, 181 tests, after `pnpm db:reset` 0 under the db lock) · `pnpm build` 0 · `pnpm gate:planning` 0 · `pnpm gate:workspace` 0. Main CI `success` on 660f1c1. `pnpm db:reset` approved by U-2 (local, db lock).
- 2026-11-06 design: `pnpm ticket:collisions MF-0063` exit 0 (`GroupDetail`, `getGroup` across 94 files; nothing re-freezes; `mf-0005-grants` read: holds unchanged). SCs need no user answer (U-1..U-3 + orchestrator decisions).
- 2026-11-06 freeze: 3 acceptance files (unit SC-1/2, DB SC-3/4, ui SC-5) + typed stubs (schema transform throws, action throws, form renders null). `pnpm test` 20 red only in the 2 frozen unit/ui files / 1086 green; typecheck 0; lint 0. DB file red twice (PGRST202 / 42703), no leftovers. FROZEN.json hashes LF-normalised sha256 (no `ticket:freeze` script).
- 2026-11-06 plan: LOOP-PLAN iteration 1 (T1 migration, T2 read/schema/action, T3 UI). Plan approval: covered by the orchestrator's dispatch decisions (U-2); no re-freeze, no shared-contract change. Listed for the orchestrator's sign-off in the hand-off.
- 2026-11-06 build: T1 migration applied by `pnpm db:reset` (db lock), DB acceptance 10/10 + grants 3/3; `pnpm db:types`. Deviation: generated RPC args are never nullable, so `p_url: null` carries one `@ts-expect-error` with a reason (`actions.ts`). T2 `discussionLinkRpcError` test red first (3 "not a function") → green; SC-1/2 13/13. T3 card `utils.test.ts` red first (module missing) → 4/4; form SC-5 8/8; page + CONTEXT.md. Stage → test.
- 2026-11-06 design preflight addendum (found by `pnpm gate:planning` in TEST): `pnpm dev` (named by SC-6) not run at design: it is the browser step, run in TEST under the web lock.
- 2026-11-07 test: `pnpm test --maxWorkers=4` 0 (198 files, 1113 tests), `pnpm test:db` 0 (35 files, 191 tests, after `pnpm db:reset`), typecheck 0, lint 0, `pnpm build` 0, gates ok. Browser check (SC-6) on `next dev -p 3003` (3001 = the user's server, 3002 held by another main-checkout server): admin invalid → field error; save → "Discuss this course" on chat.example.com, `_blank` + `noopener noreferrer`; member sees the link, no form; remove → member sees no card; light, dark, 375px. LOOP-PLAN tasks updated for the MF-0060 plan rules (T0 acceptance, T4 verify, `inline`/`orchestrator`). Stage → handoff, goal_status → complete-pending-manual-commit; fresh-context review left to the orchestrator (U-2).
- 2026-11-07 review: approve with one should-fix (REVIEW.md). Finding 1: regression `discussion-url.test.ts` RED first (4 failed: port 99999 / 80800, IPv4 999.1.1.1 / 1.2.3.4.5 accepted) → `URL.canParse` added to the `DiscussionUrl` refine → 5/5. Finding 4: new `mf-0063-cross-group-admin.db.test.ts` green. Owns updated (T1, T2). Ladder: test 1118, test:db 192, typecheck, lint, build, gates 0. Review-recipe hash e0f121e4….

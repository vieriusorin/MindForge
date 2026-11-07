---
phase: 1-planning
ticket_id: MF-0063
status: executing
verdict: IN_PROGRESS
started_at: "2026-11-06"
resume_with: /gsd-goal-loop
---

# Loop Plan — Iteration 1

## Discovery summary

- Group ↔ course (MF-0059): `public.groups.pack_slug` = current course, `path_slug` = followed path
  (`supabase/migrations/20261106140000_mf0059_path_groups.sql` §1.1). The group page
  (`src/app/(app)/groups/[groupId]/page.tsx`) reads the group through `getGroup` and streams the path card in
  `GroupPathSlot` under `<Suspense>`.
- Precedent for an admin-only write to a `groups` column: `advance_group_course` (definer in `private`, invoker shim
  in `public`, `revoke execute … from public, anon`, grant to `authenticated`), and `rotate_invite_code` (MF-0002),
  whose check is `auth.uid() is null or not private.is_admin(p_group_id)` → 42501.
- Precedent for the form: `src/features/groups/components/create-group-form/` (RHF + `zodResolver` + `useMutation`
  + `applyFormError`); for an action test: `src/features/groups/__tests__/mf-0054-pin-actions.acceptance.test.ts`
  (mocks `server-only`, `next/cache`, `next/navigation`, `getCurrentUser`, `createServerSupabase`).
- Gates the touched paths sit on: `mf-0005-grants.db.acceptance` (relation, column and anon-function allow-lists:
  unchanged, F4), `gate:planning`, `gate:workspace`, Biome.

## Symbols changed

- `GroupDetail` gains `GroupDetail.discussionUrl` (string or null, additive field).
- `getGroup` selects one more column (same signature).

## Frozen files this will re-freeze

None. `pnpm ticket:collisions MF-0063` result recorded in GOAL's Iteration Log. Read for this plan: 
`src/server/db/__tests__/mf-0005-grants.db.acceptance.test.ts` (holds: no new relation/column grant, the new
public function revokes `public, anon`), `src/server/db/__tests__/mf-0059-path-groups.db.acceptance.test.ts`
(reads `groups` by named columns; unaffected by a new nullable column).

## Parsers

`DiscussionUrl` (zod) and the DB CHECK `groups_discussion_url_check` share one grammar:

- Accepted: `^https://[A-Za-z0-9.-]+(:[0-9]{1,5})?([/?#][^\s<control>]*)?$`, length ≤ 500, after trim (zod only);
  `""` → `null` (zod only; the DB function maps `''` to null).
- Rejected inputs, each in SC-1 (zod) and SC-4 (DB): `http://example.com`, `javascript:alert(1)`,
  `HTTPS://example.com`, `https://user@evil.example`, `https://exa mple.com`, `https://example.com/a b`,
  `ftp://example.com`, `example.com`, 501 characters.
- Cross-check: the DB test runs the same accept/reject literals against the CHECK, so the two rules can't drift
  silently.

## SC coverage

| SC | Steps | Proof |
|----|-------|-------|
| SC-1 | 3 | `src/features/groups/__tests__/mf-0063-discussion-link.acceptance.test.ts` (schema block) |
| SC-2 | 3, 4 | same file (action block) |
| SC-3 | 1 | `src/server/db/__tests__/mf-0063-discussion-link.db.acceptance.test.ts` |
| SC-4 | 1 | same DB file |
| SC-5 | 6 | `src/features/groups/components/discussion-link-form/__tests__/mf-0063-discussion-link-form.acceptance.test.tsx` |
| SC-6 | 5, 6, 7 | browser, screenshots in `.planning/evidence/MF-0063/` |
| SC-7 | 8 | full ladder + gates |

## Steps

1. `supabase/migrations/20261106160000_mf0063_discussion_link.sql`:
   - `alter table public.groups add column discussion_url text constraint groups_discussion_url_check check
     (discussion_url is null or (char_length(discussion_url) <= 500 and discussion_url ~
     '^https://[A-Za-z0-9.-]+(:[0-9]{1,5})?([/?#][^[:space:][:cntrl:]]*)?$'))`. No grant (table SELECT covers read).
   - `private.set_group_discussion_url(p_group_id uuid, p_url text) returns void`, definer, `search_path = ''`:
     `auth.uid()` null or `not private.is_admin(p_group_id)` → 42501 (one message, no existence oracle);
     `update public.groups set discussion_url = nullif(btrim(p_url), '') where id = p_group_id` (CHECK → 23514).
   - `public.set_group_discussion_url` invoker shim; `revoke execute on function private.… from public, anon,
     authenticated` then grant `authenticated`; `revoke execute on function public.… from public, anon`, grant
     `authenticated`.
   - Apply with `supabase migration up` on the local stack (db lock), then `pnpm db:types`.
2. `src/server/groups/types.ts` (`GroupDetail.discussionUrl`), `src/server/groups/get-group.ts` (select
   `discussion_url`).
3. `src/features/groups/schemas.ts`: `DISCUSSION_URL_MAX = 500`, `DiscussionUrl` (trim → length/regex refine with
   "Use an https:// link, up to 500 characters." → `""` becomes `null`), `DiscussionLinkFormInput = strictObject({
   url })`, `SetDiscussionLinkInput = strictObject({ groupId: uuid, url })`; types `DiscussionLinkFormValues`.
   Inner test: none beyond the frozen SC-1 block (the schema is the SC).
4. `src/features/groups/actions.ts` `setGroupDiscussionLink(input: unknown): Promise<SetDiscussionLinkResult>`;
   `types.ts` `SetDiscussionLinkResult = FormActionResult<NoData, DiscussionLinkFormValues>`;
   `utils/rpc-errors.ts` `discussionLinkRpcError(error)` (42501 / 23514 / default) + its inner unit test in
   `utils/__tests__/rpc-errors.test.ts` (existing file, new cases).
5. `src/features/groups/components/discussion-link-card/`: `index.ts`, `discussion-link-card.tsx` (view, no hooks:
   title "Discussion", description "Current course: {courseName}", the link as a `Button asChild` `<a>` with
   `target="_blank" rel="noopener noreferrer"`, text "Discuss this course", muted "on {host}", sr-only "(opens in a
   new tab)"; "No discussion link yet." when null; `form` slot), `types.ts`, `utils.ts`
   (`discussionLinkView(url) → { href, host } | null`), `__tests__/utils.test.ts`.
6. `src/features/groups/components/discussion-link-form/`: `index.ts`, `discussion-link-form.tsx` (`Field` +
   `FieldLabel htmlFor="discussion-url"` "Chat link" + `Input type="url"` + `FieldError`, root error, Save /
   Remove), `types.ts`, `hooks/use-discussion-link-form.ts` (RHF + `zodResolver(DiscussionLinkFormInput)`,
   `useMutation(setGroupDiscussionLink)`, `applyFormError`, `router.refresh()` on success, network error → root
   "Could not reach the server. Try again."; returns `register`, `errors`, `onSubmit`, `onRemove`, `isSubmitting`,
   `hasLink`). No `utils.ts` (no pure decision beyond the schema).
7. `src/app/(app)/groups/[groupId]/page.tsx`: after the path slot, render `DiscussionLinkCard` when
   `isAdmin || group.discussionUrl`, with `courseName={pack.name}` and, for the admin, `<DiscussionLinkForm
   key={group.discussionUrl ?? ""} groupId currentUrl />`.
8. `CONTEXT.md`: **Discussion link**. Full ladder, browser check (admin + member, light, dark, 375px), evidence.

## Riskiest step

Step 1: the write path. The UI hides the form from members, but the refusal that holds when the UI is bypassed is
`private.set_group_discussion_url`'s `is_admin` check (42501) plus the absent column grant (a direct `update` fails
with 42501 permission denied). SC-3 calls the function as a member and as a non-member and asserts the stored value
is unchanged, and tries the direct `update` as the admin. The second risk is a drifted URL rule: SC-4 runs the SC-1
literals against the CHECK as the table owner, so a javascript: link can't land even through a future definer bug.
Not a versioned-content judgement and not re-runnable state (no seed or sync touches the column): no stale-version
or re-run section needed. Two concurrent saves: last write wins; both are admin acts on one column (acceptable).

## Rejected options

- A `group_discussion_links` table (per course) — the orchestrator chose one link per group; a new table would also
  add relation grants to the frozen MF-0005 allow-list (a re-freeze).
- `update (discussion_url)` column grant to `authenticated` with the existing admin policy — adds a line to the frozen
  column allow-list (re-freeze) and splits validation of the clear case across RLS and client; the definer function
  keeps the allow-list unchanged.
- `z.url()` — accepts `javascript:` and user-info and is looser than the CHECK; one regex shared by both is checkable.

## Verify

- No `ticket:verify` script: run typecheck, lint, test, test:db, build, gate:planning, gate:workspace and append the
  receipt (`git diff HEAD | shasum -a 256` + untracked files) to LOOP-VERIFY.md.
- browser: `/groups/<id>` as the admin (form, save, link, remove) and as a member (link, no form; no card when unset).

## Tasks — the graph the orchestrator dispatches; exactly one block

```json tasks
[
  { "id": "T0", "title": "RED acceptance tests (Stage 2b)", "agent": "inline",
    "owns": ["src/features/groups/__tests__/mf-0063-discussion-link.acceptance.test.ts", "src/server/db/__tests__/mf-0063-discussion-link.db.acceptance.test.ts", "src/features/groups/components/discussion-link-form/__tests__/mf-0063-discussion-link-form.acceptance.test.tsx"],
    "depends_on": [], "closes": ["SC-1", "SC-2", "SC-3", "SC-4", "SC-5"],
    "done_when": ["pnpm test (only the frozen files red)", "pnpm typecheck"],
    "context": ["skill:testing-strategy"] },
  { "id": "T1", "title": "migration + types", "agent": "inline",
    "owns": ["supabase/migrations/20261106160000_mf0063_discussion_link.sql", "src/server/db/database.types.ts", "src/server/db/__tests__/mf-0063-cross-group-admin.db.test.ts"],
    "depends_on": ["T0"], "closes": ["SC-3", "SC-4"],
    "done_when": ["pnpm test:db src/server/db/__tests__/mf-0063-discussion-link.db.acceptance.test.ts", "pnpm test:db src/server/db/__tests__/mf-0005-grants.db.acceptance.test.ts"],
    "context": ["skill:supabase-postgres-best-practices"] },
  { "id": "T2", "title": "read, schema, action", "agent": "inline",
    "owns": ["src/server/groups/get-group.ts", "src/server/groups/types.ts", "src/features/groups/schemas.ts", "src/features/groups/actions.ts", "src/features/groups/types.ts", "src/features/groups/utils/rpc-errors.ts", "src/features/groups/utils/__tests__/rpc-errors.test.ts", "src/features/groups/__tests__/discussion-url.test.ts"],
    "depends_on": ["T1"], "closes": ["SC-1", "SC-2"],
    "done_when": ["pnpm test src/features/groups", "pnpm typecheck"],
    "context": ["skill:forms-rhf-zod", "skill:nextjs-data"] },
  { "id": "T3", "title": "card, form, page", "agent": "inline",
    "owns": ["src/features/groups/components/discussion-link-card/**", "src/features/groups/components/discussion-link-form/**", "src/app/(app)/groups/[groupId]/page.tsx", "CONTEXT.md"],
    "depends_on": ["T2"], "closes": ["SC-5", "SC-6", "SC-7"],
    "done_when": ["pnpm test", "pnpm build", "pnpm lint"],
    "context": ["skill:ui-shadcn", "skill:react-client-patterns"] },
  { "id": "T4", "title": "verify: ladder, browser check, evidence", "agent": "orchestrator",
    "owns": [".planning/tasks/MF-0063/LOOP-VERIFY.md", ".planning/evidence/MF-0063.md", ".planning/evidence/MF-0063/**"],
    "depends_on": ["T3"], "closes": ["SC-6", "SC-7"],
    "done_when": ["pnpm typecheck", "pnpm lint", "pnpm test", "pnpm test:db", "pnpm build", "pnpm gate:planning", "pnpm gate:workspace"],
    "context": [] }
]
```

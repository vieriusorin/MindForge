---
verdict: approve
verdict_detail: "No blocking finding. The write path is closed to everyone except the target group's admin, the link is rendered safely, and non-members can't read it. One should-fix: links the zod rule and the CHECK accept but `new URL` rejects are saved and then silently not shown."
reviewed_hash: e0f121e493e2ce0b29e2ff249d8658ddc35c9363879a5438f1e76ab32ac067a4
reviewed_at: 2026-11-07T09:59:22Z
---

# MF-0063 fresh-context diff review

Scope: `git diff HEAD -- . ':!.planning'` plus untracked files (base 660f1c1), read against GOAL.md, LOOP-PLAN.md,
FROZEN.json, `.claude/rules/*.md` and the supabase migration rules.

## What I ran

- Frozen hashes: all 3 files match FROZEN.json (`335d3a60…`, `fa865e3e…`, `70435770…`).
- `pnpm exec vitest run` on the SC-1/2 unit acceptance file, the SC-5 form acceptance file, the card `utils.test.ts`
  and `utils/__tests__/rpc-errors.test.ts`: 5 files, 46/46 passed.
- Under the db lock (acquired, then released): `pnpm db:reset` exit 0, then
  `vitest run --project db mf-0063-discussion-link.db.acceptance.test.ts mf-0005-grants.db.acceptance.test.ts`: 2 files, 13/13 passed.
- Live catalog probe on the local DB: `has_column_privilege('authenticated','public.groups','discussion_url','UPDATE') = f`;
  anon can't execute `private.set_group_discussion_url`; the public shim is not definer; the private function has
  `search_path=""`.
- A JS-vs-Postgres probe of the regex over unicode and edge inputs (results in findings 1 and 3).
- MF-0060 plan check (`check-planning.mjs` against this worktree): `69 ticket folders checked, ok`. Every changed file is
  matched by a task's `owns` (T1 migration + types, T2 server/schema/action/rpc-errors, T3 components/page/CONTEXT.md).

## Authorization: who can set or clear the link

- **Public wrapper:** `private.set_group_discussion_url` raises 42501 unless `auth.uid()` is set and
  `private.is_admin(p_group_id)`. That checks a `group_members` row for **the target group** with role `admin`
  (`mf0002_groups.sql:61-72`). So a member, an outsider, someone who left (their row is gone), anon (no execute) and
  an admin of a *different* group are all refused. A nonexistent group gets the same 42501, so the error tells an
  attacker nothing about which group ids exist.
- **Direct UPDATE / PostgREST / pg_graphql:** the column has no UPDATE grant (only `update (name)` from MF-0002, confirmed
  live). `private` is not in the PostgREST `schemas` (`config.toml:13`), so the private function can't be called
  directly over REST.
- **Race:** the check and the update run in one statement sequence with no read-then-write state carried between them.
  The only race would be a concurrent demotion of the admin, and no such flow exists. No row lock or
  `clock_timestamp()` is needed, since there's no timestamp.
- **Reads:** `getGroup` is the only `from("groups")` read in `src/`. RLS "groups: members read" keeps non-members off the row
  (SC-3 tests this). `group_invite_preview` returns name + path_slug only (F5), and no definer function returns a
  `public.groups` row type.
- **Privacy:** the card shows the course name and the link host only. No per-member data.

## Rendering safety

The `href` is the stored value, so only `https://` + an ASCII host can ever reach it, and React escapes attributes. The
link uses `target="_blank" rel="noopener noreferrer"`. The shown host is `new URL(url).host` behind `URL.canParse`:
- `https://evil.com\@good.com`: refused by both rules, because `\` can't follow the host.
- `https://evil.com#@good.com` and `https://evil.com/@good.com`: accepted, and the shown host is `evil.com`. That is truthful.
- `https://good.com.evil.com`: shown as `good.com.evil.com`, the real host.
- Cyrillic lookalike `https://аpple.com`: refused (ASCII host only). The `xn--` form is accepted and shown as punycode,
  which is truthful.
- `https://0x7f.1`: shown as `127.0.0.1`. That is the host the browser actually opens.

## Findings

1. **[should-fix]** `src/features/groups/schemas.ts:69-81` + `supabase/migrations/20261106160000_mf0063_discussion_link.sql:19`
   + `src/features/groups/components/discussion-link-card/utils.ts:11`: both rules accept links that WHATWG `URL` can't
   parse. Examples: `https://example.com:99999` (port over 65535), `https://999.1.1.1` and `https://1.2.3.4.5` (an
   invalid IPv4 when the last label is numeric). Both are confirmed true in JS and in Postgres, and `URL.canParse`
   is false for each.
   - **Failure scenario:** the admin pastes `https://chat.example.com:80800/c`. Save succeeds (`{ ok: true }`, refresh)
     and the value is stored. `discussionLinkView` then returns null, so the admin sees "No discussion link yet." next
     to a form showing the stored value with a **Remove link** button. Members see no card at all
     (`page.tsx:278`). Nothing errors, so the admin can't tell why members never see the link.
   - **Impact:** SC-6 ("saving shows Discuss this course") fails for an input SC-1 accepts. Not a security hole: the
     failure is safe and the link is never rendered.
   - **Fix:** add `URL.canParse(url)` to the zod refine (the DB CHECK can't express it, so document it as a zod-only
     tightening, the same direction as the trim). Or cap the port at `[0-9]{1,5}` and still canParse-check.
     SC-1 literals still pass either way.
2. **[note]** `src/features/groups/actions.ts:251`: the `@ts-expect-error` has a reason, as code-conventions requires, and
   it is forced by the frozen SC-2 test asserting `p_url: null`.
   - Sending `""` would avoid the directive, because the DB already maps `''` to null via `nullif(btrim(p_url), '')`,
     but that would break the frozen literal. Acceptable as written.
   - If `supabase gen types` ever starts emitting `p_url: string | null`, the directive turns into a compile error
     and has to be removed. That is the intended behaviour of `@ts-expect-error`.
3. **[note]** Regex drift between zod and the CHECK, measured. Every case where the two disagree has Postgres accepting
   more than zod (only reachable by an admin calling the RPC directly, past the action). There is no case where zod
   accepts and the DB rejects, except that path also surfaces cleanly as 23514 → the field error.
   - U+FEFF in the path: JS `\s` matches it and rejects. Postgres `[:space:]` doesn't, so it accepts.
   - Length: zod counts UTF-16 units and `char_length` counts code points, so an astral-heavy path of 300 code points
     passes the DB and fails zod.
   - Trim: zod `.trim()` strips all unicode whitespace, while `btrim` strips only `' '`. A tab-padded value via direct
     RPC gets 23514.
   - Zero-width and bidi characters (U+200B, U+202E, U+180E) in the path/query pass both rules. Harmless here, because
     only the ASCII host is displayed.
   - The LOOP-PLAN "Parsers" claim "share one grammar" holds for ASCII. The unicode edges are worth one sentence in the
     schema comment.
4. **[note]** `src/server/db/__tests__/mf-0063-discussion-link.db.acceptance.test.ts`: no case calls the function as an
   admin of a *different* group. That is the "admin of another group" vector. It is covered by construction:
   `is_admin(p_group_id)` is keyed on the target group, and the outsider case exercises the same predicate. A future
   refactor to a role-only check would not be caught by SC-3, though. Worth adding when this file is next re-frozen.
   It isn't a reason to re-freeze now.
5. **[note]** The LOOP-VERIFY receipt tree hash (`051c1242…`) differs from this review's hash (`91915747…`). The receipt's
   recipe includes `.planning/**` and untracked evidence, while the hash requested for this review excludes
   `.planning`. Not a code change. The orchestrator should compare like with like.

## Checked and clean

- **Migration:** RLS is already on `groups`. The new column has no grant. The function is `SECURITY DEFINER` in `private`
  only, with an invoker shim in `public`. Both have `search_path = ''`. Execute is revoked from `public, anon`
  (and `authenticated` on the private function) before the grants. MF-0005 grants gate 3/3 unchanged.
- **Action:** auth comes first (`redirect` for the guard only), then the input is re-parsed from `unknown` with
  `strictObject`, then the RPC, then `ActionResult` / `FormActionResult`, with no redirect on success. `refresh()` runs in
  the action and `router.refresh()` in the hook.
- **Form:** react-hook-form + `zodResolver` + the `Field` family, with `FieldLabel htmlFor` matching the input `id`.
  The hook returns `register, errors, onSubmit, onRemove, isSubmitting, hasLink`; `handleSubmit` and setters are not
  exposed. Errors go back through `applyFormError`. A network failure shows the root error.
- **Component split:** the view holds no behaviour, props live in `types.ts`, and `utils.ts` is fully tested.
- **Tests:** they use the GOAL literals verbatim ("Use an https:// link, up to 500 characters.", the 42501/23514/default
  messages, and the 9 refused + 3 accepted URLs shared by SC-1 and SC-4).
- **Out-of-scope guard:** no posts or moderation are stored, and there's no extra column or table.

## Delta re-review (orchestrator, 2026-11-07, tree e0f121e493e2ce0b29e2ff249d8658ddc35c9363879a5438f1e76ab32ac067a4)
- Finding 1: `URL.canParse` added to the shared `DiscussionUrl` refine (form + action both use it); regression test
  `discussion-url.test.ts` shown RED on the unfixed code (`Tests 4 failed | 1 passed (5)`), green now. Only refuses more
  input; no auth, delete or privileged-client path changed. Resolved.
- Finding 4: `mf-0063-cross-group-admin.db.test.ts` (admin of A sets/clears B → 42501, B unchanged), green; locks the
  target-group admin check. Notes 2, 3, 5 accepted. Verdict: APPROVE.

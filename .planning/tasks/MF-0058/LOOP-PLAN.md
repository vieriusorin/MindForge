---
phase: 1-planning
ticket_id: MF-0058
status: executing
verdict: IN_PROGRESS
started_at: "2026-11-06"
resume_with: /gsd-goal-loop
---

# Loop Plan — Iteration 1

Written by `ticket-planner` (2026-11-06) from GOAL.md (C-1…C-5 resolved), FROZEN.json (9 files, all read whole),
LOOP-VERIFY.md (RED at freeze). High-risk: the user approves this plan before BUILD.

## Discovery summary

**What exists (typed stubs from the freeze).** `src/engine/path/{types,parse-path,check-path,is-course-complete,path-progress,index}.ts`
(all `throw new Error("not implemented")`), `src/server/paths/record-course-completion.ts` (stub, `server-only`),
`src/features/paths/actions.ts` (`startPath`, `leavePath` stubs returning `Promise<ActionResult>`). No `paths/` folder, no
migration, no routes, no components.

**Grading paths (fact (d), re-read whole).**
- `src/server/attempts/grade-answer.ts:57-66`: `record_attempt` through the learner's client; `data` is the boolean grade.
  Shared by duel, walk and seed-planting actions.
- `src/server/attempts/grade-cuckoo.ts:57-66`: same shape for cuckoo.
- Storm: `src/features/storm/actions.ts` `finishStorm` (`finish_storm` RPC grades the storm and writes its attempts with
  `attempts.storm_id`, migration `20261104130000_mf0013_storms.sql:85`). Lazy grading also happens in
  `src/server/storm/finalize-expired-storms.ts`, which pages call. Storms exist only for packs with an `exam:` block (ccdv-f).
- The frozen `src/features/__tests__/mf-0032-changed-message.acceptance.test.ts:59-67` mocks `gradeAnswer` whole and asserts
  `gradeAnswer` was called with `{ userId: "u1", ...INPUT }`. So the recorder goes **inside** `gradeAnswer` / `gradeCuckoo`,
  never in the duel/walk/seed actions, and `gradeAnswer`'s signature stays as it is.
- Non-frozen `src/server/attempts/__tests__/grade-answer.test.ts` / `grade-cuckoo.test.ts` mock `server-only`, the Supabase
  server client and the content reads. They don't mock the recorder, so after this change they'd reach the real `getPack` and
  secret client. Both get a `vi.mock("@/server/paths/record-course-completion")` (step 9).

**Forest recipe (one owner needed).** Today builds a learner's forest inline (`src/app/(app)/today/page.tsx:41-56`):
`countableAttempts(attempts, review)`, `stormProof(stormResults, review.rejected)`, `memoryBySkill(countable, now, proof)`,
then `buildForest(pack, …)`. The reads are `getPack` (`"use cache"`), `listMyAttempts`, `getReviewContext`,
`listMyStormResults` (all RLS-bound, per user, uncached). The recorder and both path surfaces need the same recipe for
course packs, so it becomes one pure engine function plus one server read (steps 3, 7).

**Privileged client.** `src/server/supabase/secret.ts` (`createSecretSupabase`, ADR 0004) has one importer,
`get-group-heatmap.ts`, locked by the non-frozen `src/server/supabase/__tests__/secret-client-importers.test.ts:32` and now
also by the frozen `mf-0058-recorder-wiring.acceptance.test.ts` (two importers). `docs/adr/0004-server-only-secret-key-for-group-aggregates.md`
says "A second use of the key needs a new ADR". Plan approval (2026-11-06): the user chose a **new ADR 0006** that
references 0004 and leaves it unchanged.

**Packs and the check script.** `getPack` reads `packs/<slug>/pack.yaml` at runtime. `next.config.ts:5` ships `./packs/**/*`
with the server output, so `./paths/**/*` must be added there too, or `getPath` breaks on Vercel. `scripts/check-pack-grounding.mjs`
runs the structural flaw-key rule, then **exits early when `.cache/corpus` is missing (CI)**. The path check must run before
that early exit, or CI never runs it. The script imports TS engine code through `scripts/lib/ts-resolve.mjs` (`register`, as
`scripts/lib/validate-packs.mjs` does). That needs relative imports and `import type` only. `@/` aliases don't resolve under
plain node.

**Baseline red (C-4, re-run read-only today):** `node scripts/check-pack-grounding.mjs` prints exactly the 7 GOAL problems, exit 1.
Escape forms (`scripts/lib/item-grounding.mjs:29-30,93-110`): `# framing: <term> — <reason>` (a reason is required) and
`# example-name: <token>`. Both are YAML comments, so the content hash (`scripts/lib/content-hash.mjs`, parsed item only)
doesn't change. Rewording an item's text does change its hash.

**Precedents.**
- MF-0054 (`supabase/migrations/20261106100000_mf0054_group_pins.sql`, `pin-toggle/`): a private, own-row learner table;
  a button `useMutation` plus `router.refresh()`; the sidebar change with frozen sidebar tests left unedited.
- MF-0013 (`20261104130000_mf0013_storms.sql:91-106`): a `public` table, `revoke all`, `grant select to authenticated`, a
  "read own" policy, and the MF-0005 grants allow-list re-freeze (C-5, `.planning/tasks/MF-0005/FROZEN.json` history).
- MF-0011: the secret client, ADR 0004, the importer lock.
- MF-0017 (`expedition-card` + `src/components/ui/progress.tsx`): shadcn `Progress` is installed.
- create-group-form / pin-toggle: Server Action through `useMutation`.

**Gates the touched paths sit on.**
- `COMPONENT_SPLIT_MIGRATED_PATHS` / `I18N_MIGRATED_PATHS`: not in this repo (grep `scripts/`, `.claude/`). No allowlist is touched.
- **MF-0005 grants gate** (`src/server/db/__tests__/mf-0005-grants.db.acceptance.test.ts`, frozen green): it enumerates every
  `anon`/`authenticated`/PUBLIC privilege in `public` and `private`. The two new tables add 4 lines. This is a **re-freeze**,
  listed below and needing approval. Nothing else in the plan needs an allowlist.
- MF-0002 SC-6 (no `private` function executable by anon): this ticket adds no function.
- `pnpm check:packs` (SC-10), `gate:planning`, and the Stop hook's fast gate.
- **Scope hook** (`.claude/hooks/lib/agent-scopes.mjs`): `scripts/**`, `.planning/evidence/**`, `*/FROZEN.json` are NEVER
  writable by a role agent. No role agent may write `paths/**`, `docs/**`, `CONTEXT.md` or `next.config.ts`. Tasks T1R, T3,
  T5 and T7 carry a valid role label for `ticket:eval`, but **the orchestrator runs them in the main session** (MF-0052 note).
- `.planning/PROJECT.md` does not exist (no Key Decisions file). Decisions come from GOAL.md and ADR 0004.
- Other sessions: `git status` shows only `.planning/tasks/MF-0059/GOAL.md` from another ticket. No shared source files.

## Symbols changed

- `gradeAnswer`: body only (calls the recorder after a correct, recorded grade). Signature and return unchanged.
- `gradeCuckoo`: body only, same as above.
- `finishStorm`: body only (records after a successful finish_storm RPC). Return unchanged.
- `createSecretSupabase`: unchanged code, a second importer (doc comment and ADR updated).
- `AppSidebar`: gains a Workspace **Paths** item. Its props type is unchanged.
- `PathProgress`: gains nextPosition, completedPercent, completedAt (additive). It's this ticket's own stub type.
- Grepped by hand instead (not whole-word symbols, so no backticks): the MF-0005 grants allow-list constant (a test constant,
  1 frozen file: the re-freeze below), and the new tables public.course_completions / public.path_enrollments (hits only in
  this ticket's own frozen files: a grep for course_completions or path_enrollments over every acceptance test returns
  only mf-0058 files).

## Frozen files this will re-freeze

| File:line | Change (new expected value) | Reason |
|---|---|---|
| `src/server/db/__tests__/mf-0005-grants.db.acceptance.test.ts:17-24` | `RELATION_ALLOW_LIST` gains, in sorted position: `"public.course_completions authenticated SELECT"` (after `public.attempts`), and `"public.path_enrollments authenticated DELETE"`, `"public.path_enrollments authenticated INSERT"`, `"public.path_enrollments authenticated SELECT"` (after `public.groups`, before `public.profiles`), each with the trailing comment `// MF-0058 SC-5, approved <date>`. The assertion `expect(rows.map((r) => r.line)).toEqual(RELATION_ALLOW_LIST)` (line 52) is otherwise unchanged. Column and function lists unchanged. | GOAL Constraints + SC-5: learners read own completions, and read/insert/delete own enrollments. These grants are the ticket. Precedent: MF-0013 C-5. **Needs user approval at this checkpoint.** Record in `.planning/tasks/MF-0005/FROZEN.json` `history` and this ticket's `also_refrozen`. |

Read, and they still hold (no edit):
- `src/features/__tests__/mf-0032-changed-message.acceptance.test.ts:59-67`: `gradeAnswer` is mocked, so the recorder inside it
  is never reached. The call shape `{ userId, ...INPUT }` is unchanged.
- `src/features/app-shell/components/app-sidebar/__tests__/mf-0052-storm-link.acceptance.test.tsx:54-73` and
  `src/features/app-shell/components/app-sidebar/__tests__/mf-0054-sidebar-label.acceptance.test.tsx:58-95`: they assert links by name and `/groups/` hrefs, never a full link list. A new
  `/paths` link matches none of them.
- `src/features/cuckoo/components/cuckoo-session/__tests__/mf-0016-cuckoo-session.acceptance.test.tsx`: mocks the cuckoo action.
- `src/test/__tests__/mf-0033-item-grounding.acceptance.test.ts:157,207,214`: `log-summarizer` is an inline fixture string,
  not read from `packs/`. T0 doesn't affect it.
- Own frozen `src/engine/path/__tests__/mf-0058-path-progress.acceptance.test.ts`: uses `toMatchObject` and named fields, so the
  additive `PathProgress` fields hold.
- Not frozen, updated in the step that changes them: `src/server/supabase/__tests__/secret-client-importers.test.ts` (two
  importers, C-2), `src/server/attempts/__tests__/grade-answer.test.ts`, `grade-cuckoo.test.ts`.

## SC coverage

| SC | Steps | Proof |
|----|-------|-------|
| SC-1 | 4, 5, 6 | `src/engine/path/__tests__/mf-0058-path-file.acceptance.test.ts` (schema, check, yaml, script cases) |
| SC-2 | 2 | `src/engine/path/__tests__/mf-0058-course-complete.acceptance.test.ts` (9 rows) + inner 0-skill case |
| SC-3 | 2 | `src/engine/path/__tests__/mf-0058-path-progress.acceptance.test.ts` (9 rows) + inner cases for the added fields |
| SC-4 | 1, 7, 8 | `src/server/paths/__tests__/mf-0058-course-completion.db.acceptance.test.ts` |
| SC-5 | 1, 1R, 8, 10 | `src/server/db/__tests__/mf-0058-paths-rls.db.acceptance.test.ts`; `mf-0058-recorder-wiring` (importer half); re-frozen `mf-0005-grants` |
| SC-6 | 9 | `src/features/__tests__/mf-0058-recorder-failure.db.acceptance.test.ts`; `mf-0058-recorder-wiring` (3 call sites); grade-answer/grade-cuckoo unit cases |
| SC-7 | 11, 12, 15 | browser on the local stack, light, dark and 375px, screenshots in `.planning/evidence/MF-0058/`. Utils unit tests |
| SC-8 | 11, 13 | `src/features/paths/__tests__/mf-0058-path-parity.acceptance.test.ts` + browser (card absent when not enrolled) |
| SC-9 | 14 | `app-sidebar/__tests__/mf-0058-paths-link.acceptance.test.tsx`; MF-0052/MF-0054 sidebar files green unedited |
| SC-10 | 0, 6, 16, 17 | `CONTEXT.md` grep; `pnpm typecheck && pnpm lint && pnpm test`, `pnpm test:db`, `pnpm check:packs`, `pnpm build` all 0; evidence "See it yourself" |

## Steps

**0. T0 (content, separate hunk; C-4): clear the 7 baseline `check:packs` problems.** For each item, read the cached cited page
(`.cache/corpus/<sha256(url)>.json`, the same lookup the script does) and pick the fix in this order: (a) cite or quote what the
page says; (b) an escape comment with a real reason. Never reword just to dodge the matcher.
- `packs/platform-foundations/questions/D2.S1.yaml` q5, `D3.S2.yaml` q6, `D3.S3.yaml` q5. The stem contrasts an API tool with the
  consumer app ("like claude.ai does", "In claude.ai, …", "as memory does in claude.ai"). The cited platform pages don't name
  claude.ai. Add inside each item's block `# framing: claude.ai — the stem sets the consumer-app behaviour against the API tool
  on the cited page; the graded fact is the API behaviour only`. Read each stem first: if the claude.ai clause is load-bearing
  for the answer, cut the clause instead (MF-0038 rule: a fact from a sibling page is cut, not cited).
- `packs/platform-foundations/questions/D5.S1.yaml` q2, `D5.S2.yaml` q3. These cite support.claude.com articles about the Claude
  apps ("on the web, Claude Desktop, and Claude Mobile apps"), and the page never writes "claude.ai". Add
  `# framing: claude.ai — the cited support article documents the Claude apps, of which claude.ai is the web app`.
- `packs/subagents/cards/D2.S2.yaml` `card-tune-the-worker`: `log-summarizer` is an invented example subagent name. Add
  `# example-name: log-summarizer`.
- `packs/subagents/cards/D2.S1.yaml` `card-file-and-scope`: "a misspelled field such as `max_turns` is ignored without an error"
  is **not grounded**. The page lists `maxTurns`, and says only that "`color` and `experimental` aren't accepted here and are
  ignored rather than rejected" (in the Agent SDK context). Replace the clause with the page's own statement, keeping its scope
  (SDK vs file), or cut it. `# example-name: max_turns` would hide an ungrounded claim, so it's rejected. This changes the card's
  content hash, so the orchestrator runs `pnpm db:sync-keys` on the local stack after T1 (no reset), and the hand-off names the
  re-sync.
- Done when `node scripts/check-pack-grounding.mjs` prints 0 problems and exits 0, with the same checked/skipped counts as the
  baseline (485 checked, 5 skipped).

**1. T1 migration `supabase/migrations/20261106120000_mf0058_paths.sql`** (copy the header comment style of MF-0054):
```sql
create table public.path_enrollments (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  path_slug text not null check (path_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  started_at timestamptz not null default now(),
  primary key (user_id, path_slug)
);
create table public.course_completions (
  user_id uuid not null references auth.users (id) on delete cascade,
  pack_slug text not null check (pack_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  completed_at timestamptz not null default now(),
  pack_version integer not null check (pack_version > 0),
  primary key (user_id, pack_slug)
);
alter table public.path_enrollments enable row level security;
alter table public.course_completions enable row level security;
revoke all on public.path_enrollments from public, anon, authenticated, service_role;
revoke all on public.course_completions from public, anon, authenticated, service_role;
grant select, insert, delete on public.path_enrollments to authenticated;
grant select on public.course_completions to authenticated;
-- MF-0058 C-2: the recorder (secret key) may add a row and read it, never change or remove one
grant select, insert on public.course_completions to service_role;
create policy "path_enrollments: read own" on public.path_enrollments for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "path_enrollments: enroll self" on public.path_enrollments for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "path_enrollments: leave own" on public.path_enrollments for delete to authenticated
  using ((select auth.uid()) = user_id);
create policy "course_completions: read own" on public.course_completions for select to authenticated
  using ((select auth.uid()) = user_id);
```
- No FK from `pack_slug` to `private.packs`: the SC-4 fixture pack `mf0058-course` isn't registered, and paths are files, so
  `path_slug` has no table to reference. The slug checks keep junk out.
- `service_role` is revoked and re-granted explicitly. The local stack has `auto_expose_new_tables = false` (memory rule 4), and
  "written once, never changed" becomes a DB fact, not only code.
- The PKs serve every read (`user_id` leading), so no extra index.
- Apply with **`supabase migration up --local` only** (C-3; never `pnpm db:reset`), then `pnpm db:types` (writes
  `src/server/db/database.types.ts`). If the file needs a fix after it's applied, use memory rule 5 (drop the objects, delete the
  `supabase_migrations.schema_migrations` row, `migration up` again).

**1R. T1R re-freeze `mf-0005-grants` (orchestrator, after approval).** Edit `RELATION_ALLOW_LIST` exactly as in the table above.
Recompute the LF-normalised sha256. Append a `history` entry to `.planning/tasks/MF-0005/FROZEN.json` (shape of the MF-0013 entry:
`at`, `reason`, `previous[{path, sha256}]`). Add an `also_refrozen` entry to `.planning/tasks/MF-0058/FROZEN.json`. Green after T1.

**2. T2 engine `src/engine/path/`** (relative imports and `import type` only. The node script imports `check-path.ts`):
- `schema.ts`: `PathFileSchema = z.object({ slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/), name: z.string().min(1),
  source: z.url() /* https */, courses: z.array(slugRegex).min(1) }).strict()`. `types.ts`: `PathContent = z.infer<…>` with
  `courses` readonly (keep the exported name). Keep `CourseCompletion`, `CourseProgress`. Add to `PathProgress`:
  `nextPosition: number | null` (1-based position of `next` in path order; the "Course n of N" figure),
  `completedPercent: number` (whole number, `Math.round(100 * completedCount / total)`, for `Progress`),
  `completedAt: string | null` (path-complete date = the latest course `completedAt`, else null).
- `parse-path.ts`: `YAML.parse` then `safeParse`. On failure, throw `Error(\`${source}: ${firstIssue.path.join(".")} ${message}\`)`.
  The message must contain `source` (frozen test `/paths\/p\.yaml/`).
- `check-path.ts`: try `parsePath(text, file)`, and on throw return `[error.message]` (the file name carries the path slug).
  Then, with `path "${slug}"` in every line: one line per duplicated slug (once per slug, not per repeat):
  `${file}: path "${slug}" lists pack "${pack}" twice`; unknown: `… lists unknown pack "${pack}"`; zero skills:
  `… lists pack "${pack}" with 0 skills (a course needs at least one skill)`. An unknown pack yields only the unknown line. An
  empty list fails the schema (`.min(1)`), so the message names the file.
- `is-course-complete.ts`: every tree of every region has a stage in `GROWN = ["sapling","tree","ancient"] as const`. **A forest
  with 0 trees is not complete** (inner test). Wilting is ignored (C-1).
- `path-progress.ts`: map completions by `packSlug`, ignoring packs outside the path. Per course in path order:
  `complete` + `completedAt` when recorded (whatever the live forest says); else `in-progress` when any tree's stage isn't `seed`;
  else `not-started`. A course missing from `forests` counts as `not-started`. Then `completedCount`, `total`, `next`,
  `nextPosition`, `completedPercent`, `isPathComplete = completedCount === total`, `completedAt` (max ISO string when complete).
- `course-forest.ts` (new, the one owner of the replay recipe Today runs inline): `courseForest({ pack, attempts, review,
  stormResults, now }): ForestView` = `buildForest(pack, memoryBySkill(countableAttempts(attempts, review), now,
  stormProof(stormResults, review.rejected)))`. Relative imports from `../forest`, `../memory`, `../storm`, `../content`. Export
  from `index.ts`.
- `__tests__/path-progress.test.ts`, `is-course-complete.test.ts`, `course-forest.test.ts`, `check-path.test.ts` (inner, not frozen):
  the 0-skill forest → false; `nextPosition` 1 with no completions, 3 with courses 1 and 2 complete, null when all are complete;
  `completedPercent` 0 / 40 / 100 for 0 / 2 / 5 of 5; `completedAt` = the later of two dates, null when incomplete; two
  duplicates of one slug → exactly one line; `courseForest` on fixture attempts equals Today's inline recipe (same literals).

**3.** (part of step 2) `course-forest.ts`. Today's own inline recipe is **not** refactored in this ticket (rejected options).

**4–6. T3 path file, script, tracing (orchestrator; `scripts/**` and `paths/**` are outside role scopes).**
- `paths/claude-developer.yaml`: `slug: claude-developer`, `name: Claude Developer`,
  `source: https://anthropic-partners.skilljar.com/path/claude-developer`, and `courses` = `ai-capabilities, platform-foundations,
  claude-code-in-action, agent-skills, subagents`. Add a header comment naming the four Anthropic courses without a pack
  (AI Fluency for Builders, Claude Platform 101, Claude Code 101, Introduction to MCP) as future pack tickets.
- `scripts/check-pack-grounding.mjs`: `register("./lib/ts-resolve.mjs", import.meta.url)`, then
  `const { checkPath } = await import(pathToFileURL(join(ROOT, "src/engine/path/check-path.ts")).href)` and
  `loadPackFile` from `src/engine/pack/index.ts`. `PATHS = process.env.MF_PATHS_DIR ? resolve(…) : join(ROOT, "paths")`.
  Build `packSkillCounts` from every `PACKS/<dir>/pack.yaml` (sum of `domains[].skills.length`; a pack.yaml that fails to load is
  absent, so it reads as unknown). Run `checkPath` for every `*.yaml` in PATHS (sorted; `file` = `relative(ROOT, path)`), and
  push its lines into `problems` **right after the flaw-key rule, before the `.cache/corpus` early exit**. Add a path count to both
  summary lines. Everything goes to stderr via the existing `console.error(p.message)` loop, so wrap strings as `{ message }`.
- `next.config.ts`: `outputFileTracingIncludes: { "/": ["./packs/**/*", "./paths/**/*"] }`.

**7. T4 server reads `src/server/paths/`** (`server-only` except where noted; DTOs in `types.ts`; zod-parse rows at the edge):
- `get-path.ts`: `getPath(slug): Promise<PathContent | null>`. `"use cache"` + `cacheLife("days")` like `getPack`. Validate the
  slug regex, read `paths/<slug>.yaml` (ENOENT → null), `parsePath`. **Not `server-only`** (file-backed cached read, server-side.md §2
  exception, like `get-pack.ts`).
- `list-paths.ts`: `listPaths(): Promise<PathContent[]>`, every `paths/*.yaml` sorted by slug, cached.
- `get-path-enrollment.ts`: `getPathEnrollment(userId, pathSlug): Promise<{ startedAt: string } | null>` through
  `createServerSupabase()`, `.select("started_at").eq("user_id", userId).eq("path_slug", pathSlug).maybeSingle()`. Throws
  `getPathEnrollment: …` on error.
- `list-course-completions.ts`: `listCourseCompletions(userId): Promise<CourseCompletion[]>`, `select("pack_slug, completed_at,
  pack_version")`, own rows (RLS), ordered by `pack_slug`. `completedAt` stays as the ISO string.
- `get-my-course-forest.ts`: `getMyCourseForest({ userId, packSlug, now }): Promise<ForestView>`. `Promise.all` of `getPack`
  (import from `@/server/packs/get-pack`, the module SC-4 mocks), `listMyAttempts`, `getReviewContext`, `listMyStormResults`, then
  `courseForest`. Used by the recorder and both pages.

**8. T4 recorder `src/server/paths/record-course-completion.ts`** (keep the stub's export and input):
1. `const pack = await getPack(packSlug)`. If `pack.kind !== "course"`, return (exam and onboarding packs never complete).
2. Already recorded? `createServerSupabase().from("course_completions").select("pack_slug").eq("user_id", userId)
   .eq("pack_slug", packSlug).maybeSingle()` (RLS own). If there's a row, return. This makes the call a no-op after the first
   completion, and SC-4 case 3 holds.
3. `const forest = await getMyCourseForest({ userId, packSlug, now })`. If `!isCourseComplete(forest)`, return.
4. `createSecretSupabase().from("course_completions").insert({ user_id: userId, pack_slug: pack.slug, pack_version: pack.version })`
   (`completed_at` = DB default `now()`, the DB clock). An error with code `23505` (a concurrent first write won) → return. Any
   other error → `throw new Error(\`recordCourseCompletion: ${error.message}\`)`.
- It throws on infrastructure errors (server-read convention). The callers swallow (step 9).
- Doc comment: reads run as the learner (RLS), so `userId` must be the session user, and a mismatched id reads no attempts and
  writes nothing. The secret client is used for this one insert only and never leaves the function.

**9. T4 call sites (SC-6).**
- `grade-answer.ts` and `grade-cuckoo.ts`: after the `record_attempt` success branch and before the return, **only when
  `data === true`** (only a correct answer can raise stability; a lapse never completes a course):
  ```ts
  if (data) {
    try {
      await recordCourseCompletion({ userId, packSlug, now: new Date() });
    } catch (error) {
      // MF-0058 SC-6: completion is a side effect of a committed attempt; it never fails the answer
      console.error("recordCourseCompletion:", error instanceof Error ? error.message : "unknown error");
    }
  }
  ```
  The call must stay a literal `recordCourseCompletion(` in each file (frozen wiring regex), so there's **no** shared
  "safe" wrapper. Log the message only, never the row or the key.
- `src/features/storm/actions.ts` `finishStorm`: after `finish_storm` succeeds, the same try/catch around
  `const storm = await getStorm(parsed.data.stormId); if (storm) await recordCourseCompletion({ userId: user.id, packSlug: storm.packSlug, now: new Date() })`.
  Return `{ ok: true }` regardless.
- `console.error` outside route handlers and error boundaries breaks `.claude/rules/code-conventions.md` "Errors and logging".
  This plan asks the user to approve a named exception (see Approval items). A silent `catch {}` is worse: it breaks "fail loud"
  and `client-side.md` §5.
- Tests (not frozen): `grade-answer.test.ts` and `grade-cuckoo.test.ts` add
  `vi.mock("@/server/paths/record-course-completion", () => ({ recordCourseCompletion }))` with a hoisted `vi.fn()`, plus cases:
  a correct answer calls it with `{ userId, packSlug, now: expect.any(Date) }`; a wrong answer doesn't; a `changed` / RPC error
  doesn't; the recorder rejecting still returns the same `ok: true` feedback.
- `src/server/supabase/secret.ts` doc comment → "one read (heatmap) and one write (course completions, MF-0058)".
  `secret-client-importers.test.ts`: `toEqual(["src/server/groups/get-group-heatmap.ts",
  "src/server/paths/record-course-completion.ts"])` with `.sort()`. Update its header comment to cite ADR 0006.

**10. T4 actions `src/features/paths/`.** `schemas.ts`: `PathSlugInput = z.object({ pathSlug: z.string().regex(slugRe) })`.
`types.ts`: `StartPathResult = ActionResult`, `LeavePathResult = ActionResult`. `actions.ts`:
- `startPath(input: unknown)`: `getCurrentUser()` → `redirect("/sign-in?next=/paths")`. `PathSlugInput.safeParse` →
  `{ ok: false, error: "This path doesn't exist." }`. `getPath(slug)` null → same error (never trust the id).
  `createServerSupabase().from("path_enrollments").insert({ user_id: user.id, path_slug })`. Code `23505` → `{ ok: true }`
  (repeat Start = one row). Other errors → `"Could not start the path. Try again."`. Success → `{ ok: true }`.
- `leavePath(input)`: same auth and parse. `.delete().eq("user_id", user.id).eq("path_slug", slug)`. Deleting nothing is ok.
  Completions are untouched (a different table). No `redirect` on success, and no `refresh()`: the hook refreshes.

**11. T6 UI `src/features/paths/components/`** (folder per component; `react-client-patterns.md`):
- `path-view/` (Server Component, presentational): header (uppercase muted "Path" line, `h1` name, a source link in Geist Mono),
  the completion rule sentence *"A course is complete when every skill in it reaches Sapling. MindForge records the date once;
  live health below can still fade."*, and an `actions` slot (ReactNode). When enrolled: "Course {nextPosition} of {total}",
  `Progress value={completedPercent}` with an `aria-label`, and a Continue `Button asChild` → `Link` to `/play/{next}/walk`.
  When `isPathComplete`: a `Trophy` line "Path complete · {date}" (never "certified"). Then one `Card` with rows split by
  `Separator`: position, `StageIcon`, the course name (bold), a meta line with a status `Badge` *word* (`Complete` / `In progress`
  / `Not started`), the skill count, "Complete · {date}", and live health: stage counts with their names, plus "{k} skills fading"
  from `summarizeForest(forest).wiltingSkills`. `utils.ts`: `STATUS_LABEL` (`as const satisfies Record<CourseProgress["status"], string>`),
  `formatCompletedDate(iso)` (`Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" })`), `fadingLabel(k)`
  (null for 0, "1 skill fading", "k skills fading"). `__tests__/utils.test.ts` imports every export. `types.ts` holds props.
- `start-path-button/` (client): `Button` "Start path", disabled + "Starting…" while pending, error in `<p role="alert">`.
  `hooks/use-start-path-button.ts`: `useMutation(() => startPath({ pathSlug }))`, and on `ok` → `router.refresh()`.
- `path-menu/` (client): `DropdownMenu` (trigger: `Button variant="ghost" size="icon"`, `aria-label="Path options"`, `Ellipsis`)
  with the item "Leave path" and the hint "Your completed courses stay." `hooks/use-path-menu.ts`: `useMutation` over `leavePath`
  → `router.refresh()`, errors shown as `role="alert"`. Touch target ≥ 40px.
- `path-card/` (Server Component, presentational, for Today): `Card` with the path name, "Course {n} of {N}", `Progress`, and a
  Continue link (or the trophy line), plus a link "View path" → `/paths/{slug}`.
- `path-list/` (Server Component): one row per path (name, "{total} courses", an `Enrolled` `Badge` when enrolled) → `/paths/{slug}`.
- `__tests__/` for each client hook/component: `use-start-path-button.test.tsx` / `start-path-button.test.tsx` and the menu
  equivalents with `renderWithProviders`, `vi.mock("@/features/paths/actions")`, `vi.mock("next/navigation")`. One test per
  outcome: ok → refresh; `{ ok: false }` → alert text; rejection → network message; pending → disabled.
- Every figure (n, N, percent, stage counts, fading count, skill count) comes from `pathProgress` / `summarizeForest` props.
  There's no arithmetic in a `.tsx`.

**12. T6 routes `src/app/(app)/paths/`.**
- `paths/[pathSlug]/page.tsx`: the default export renders `<div className="w-full px-4 pb-10 md:px-8"><Suspense fallback={<PathSkeleton/>}><PathSlot params={params}/></Suspense></div>`
  (shape of `groups/[groupId]/page.tsx:101-214`). `PathSlot`: `await params`, then `getPath` → `notFound()`, then
  `getCurrentUser()` → `redirect("/sign-in?next=/paths/<slug>")`. In parallel: `getPathEnrollment`, `listCourseCompletions`,
  and `getMyCourseForest` per course. Then `const now = new Date()` after the auth read, `pathProgress({ path, completions,
  forests })` (imported from `@/engine/path`; the frozen parity regex needs this exact import), and `summarizeForest` per course.
  Render `PathView` with `actions={enrolled ? <PathMenu pathSlug/> : <StartPathButton pathSlug/>}`. Pass DTOs only (ISO strings,
  no `Date`).
- `paths/page.tsx`: `listPaths()` + per-user enrollment under `<Suspense>` → `PathList`.
- `paths/error.tsx` (client-side.md §6: a new segment gets an error boundary with retry). `paths/loading.tsx` isn't needed
  (Suspense fallbacks).

**13. T6 Today `src/app/(app)/today/page.tsx`.** Inside `TodaySlot`, after the existing JSX header and briefing, render
`<Suspense fallback={<Skeleton className="h-40 w-full rounded-xl" />}><TodayPathCards userId={user.id} /></Suspense>` in the
grid. `TodayPathCards` (async, same file) runs `listPaths()` and `getPathEnrollment` per path. For the enrolled paths only, it
reads `listCourseCompletions` + `getMyCourseForest` per course, calls `pathProgress(` (imported `{ pathProgress } from "@/engine/path"`)
and renders `PathCard`. When nothing is enrolled it returns `null` and does no course reads. The pack-selection code (`primaryPackSlug`,
pins) isn't touched (pin rule stays).

**14. T6a sidebar `app-sidebar.tsx`.** A Workspace item after Today: `SidebarMenuButton asChild isActive={isActivePath(pathname, "/paths")}
tooltip="Paths"` → `<Link href="/paths"><Route /><span>Paths</span></Link>` (`Route` from lucide-react). No prop change.

**15. Browser data (orchestrator, local stack only).** A fresh local test learner (`createTestUser`). Backdate `public.attempts`
as the frozen SC-4 fixture does, enough to put every `ai-capabilities` skill at Sapling except one. Then answer that skill's
question right in the app, so the real recorder writes the row. This is a local write for the proof, recorded in evidence and
deleted after. Not `db:reset`, not `dev:seed` without asking.

**16. T5 docs (orchestrator).**
- `CONTEXT.md` (new `## Paths` section): **Path**: an ordered list of course packs, declared in `paths/<slug>.yaml`, following
  Anthropic's order when one exists; order is recommended, not locked. **Enrolled**: a learner pressed Start path; leaving deletes
  the enrollment and keeps completions. **Course complete**: every skill of a course pack at Sapling or above (wilting counts),
  recorded once with its date and pack version, kept even if memory later fades. **Path complete**: every course in the path is
  Course complete, derived and not stored, dated by its latest course. It's a trophy, never a certification.
- `docs/adr/0006-server-only-secret-key-for-course-completions.md` (new, replaces the amendment; user 2026-11-06), cross-referencing 0004. Was: append "Amended 2026-11-06 (MF-0058, C-2/C-5)": the second and
  only other use is the course-completion recorder. Explain why it can't be a learner-callable RPC (forgeable), that it's
  insert-only (grants: service_role select+insert, no update/delete), that the reads run as the learner, and that the lock now
  lists two importers. Keep "a third use needs a new ADR".

**17. T7 verify (orchestrator).** `pnpm typecheck && pnpm lint && pnpm test`, `pnpm test:db`, `pnpm check:packs`, `pnpm build`,
`pnpm gate:planning`, `pnpm ticket:collisions MF-0058`. Browser on :3001 (or `next start -p 3002` after build if :3001 caches stale
files): `/paths`, `/paths/claude-developer` not enrolled → Start → enrolled → Leave → Start (same progress), and Today with and
without the card. Light, dark, 375px. Screenshots go in `.planning/evidence/MF-0058/`, plus the evidence file with "See it yourself".
Then a fresh-context `diff-reviewer`.

## Riskiest step

**Step 8–9, the privileged write on the attempt path.**

- **Version written.** `pack_version` = `pack.version` of the pack file the recorder just built the forest from, in the same call
  (`getPack`, the deployed file). The attempt that triggered it was graded by `record_attempt` against the content hash the learner's
  page rendered (MF-0032: a stale hash is refused as `changed`, so the recorder never runs for it, because `data` isn't `true`). The
  completion is a judgement about the pack's skill list, not about one item's text, so it binds to the pack version it evaluated.
  There's no stored version to compare against: the row is written once and never re-judged ("recorded once"). A later version
  bump leaves the old row with its older `pack_version`, and the live health shows the change. That's the decided behaviour, and
  `pathProgress` treats a recorded row as complete (frozen SC-3 cases 5–6).
- **Idempotency.** The PK is `(user_id, pack_slug)`. The recorder returns early when the row exists (own RLS read). Two concurrent
  qualifying answers both insert, one gets `23505` and returns. Grants (`service_role` select+insert only) make UPDATE/DELETE
  impossible even for the secret client. Proof: frozen SC-4 case 3 (second qualifying attempt: same row, same values) and SC-5
  (learner can't insert/update/delete).
- **Re-run / `db:reset` state.** Rows are keyed on the `auth.users` uuid with `on delete cascade`: a reset or a user delete removes
  them with the user. There's no on-disk manifest, no serial id, and no seed writes these tables. After `dev:seed` (which isn't run),
  a seeded learner whose forest already qualifies has no row until their next correct answer in that pack. `pathProgress` then
  shows `in-progress`, which is honest (nothing was recorded) and not a false "complete". Named in the hand-off as a follow-up, not
  a bug. The frozen DB tests seed and delete their own rows child-first.
- **Privileged-client scope.** One importer (`record-course-completion.ts`), one statement (insert of three columns), with values
  computed server-side: `user_id` from the session-derived `userId`, `pack_slug`/`pack_version` from the deployed pack file. Every
  read that decides the rule runs through the learner's RLS client, so a wrong `userId` reads no attempts, can't complete, and
  writes nothing. The client never leaves the function. Locks: the frozen `mf-0058-recorder-wiring` (exactly two importers) plus
  the updated `secret-client-importers.test.ts` (and the key named in `secret.ts` only).
- **Failure isolation.** The recorder runs after `record_attempt` committed, and its throw is caught in the caller. Proof: the
  frozen SC-6 DB test (the recorder stubbed to throw, `ok` + attempt row + the recorder reached) and the unit cases in step 9.
  Cost: one cached file read plus one indexed select per correct answer once recorded. Before that, the replay reads (attempts
  paged, review states, storm results) for course packs only. Exam packs return after the `kind` check, with no DB read.
- **Server refusals behind UI predicates.** Start is shown only when not enrolled. Bypassed (stale tab, double click, direct
  call), the PK makes a repeat insert `23505` → `ok` with one row (frozen SC-5 "startPath twice"). The RLS `with check` refuses
  enrolling another user (frozen SC-5 "can't enroll someone else"). Leave on a missing row deletes nothing and returns ok.
  "Complete" has no UI predicate: learners have no write grant on `course_completions` at all (frozen SC-5).

## Rejected options

- **A learner-callable RPC (SECURITY DEFINER) that records completion**: any signed-in learner could call it through PostgREST
  and forge "Complete", because the rule needs the TS replay the DB can't run (C-5).
- **A DB trigger on `attempts`**: memory is replayed in TypeScript (`memoryBySkill`), so a trigger can't decide Sapling (Facts).
- **Recording on page view**: a render with a side effect, and a learner who never opens the page gets a late date (C-2).
- **Calling the recorder in the duel/walk/seed actions**: the frozen `mf-0032-changed-message` mocks `gradeAnswer`, and three
  copies would drift. Inside `gradeAnswer` covers all three modes.
- **`after()` from `next/server` to record after the response**: it throws outside a request scope (Vitest), would fail the
  frozen SC-6 assertion that the recorder was reached, and session cookies inside `after()` are not guaranteed.
- **A shared `recordCourseCompletionSafely` wrapper**: the frozen wiring test greps a literal `recordCourseCompletion(` in each
  grading file, and the SC-6 test mocks only the recorder module.
- **Calling the recorder on wrong answers too**: a lapse lowers stability and can't complete a course. It would double the cost.
- **Upsert (`onConflict` + `ignoreDuplicates`) for enrollments**: PostgREST upsert can require UPDATE privileges and the table
  grants none. A plain insert with `23505` → ok is certain.
- **`# example-name: max_turns`**: it would silence the token while leaving an ungrounded claim in the card (T0 step 0).
- **Refactoring Today's inline forest recipe onto `courseForest`**: correct but outside the ticket, and it touches the pin-rule
  page body. Follow-up.
- **Keeping the path order locked**: every pack is playable by URL, so a lock would be cosmetic (GOAL).
- **`public` tables without the MF-0005 re-freeze** (e.g. tables in `private` + definer functions): the frozen MF-0058 RLS test
  reads `public.course_completions` and `public.path_enrollments` through PostgREST. The contract fixes the schema.

## Approval items (bring to the plan checkpoint as one batch)

1. **Re-freeze `src/server/db/__tests__/mf-0005-grants.db.acceptance.test.ts:17-24`**: 4 allow-list lines (table above).
2. **`console.error` in `grade-answer.ts`, `grade-cuckoo.ts`, `features/storm/actions.ts`**: a named exception in
   `.claude/rules/code-conventions.md` "Errors and logging" ("the catch around a best-effort side effect after a committed write,
   MF-0058 recorder; message only"). `.claude/**` is protected: the user or the orchestrator edits it with consent.
3. **Edit `scripts/check-pack-grounding.mjs`** (a gate script, guarded) as the frozen SC-1 script cases require, and
   **`next.config.ts`** (tracing `paths/`). Both are run by the orchestrator.
4. **ADR 0004 amended in place** (the user's C-2 wording), although its own text says "a second use needs a new ADR". Confirm
   the amendment rather than ADR 0006.
5. **T0 card reword (`subagents.D2.S1.card-file-and-scope`)** changes its content hash: `pnpm db:sync-keys` on the local stack,
   and the deploy's sync re-registers it.
6. **"Course n of N" = the position of the Continue course** (`nextPosition`), shown beside "{completed} of {N} complete" via the
   `Progress` label. If the user meant n = completed count, only the label changes.

## Verify

- VERIFY `MF-0058`: the receipt must say DONE for this tree (typecheck, lint, test, test:db, check:packs, build, gate:planning).
- EVAL `MF-0058`: graph acyclic, every SC closed, scope = the union of `owns`.
- `pnpm ticket:collisions MF-0058`: run at PLAN 2026-11-06, exit 0, "no unlisted collisions for gradeAnswer, gradeCuckoo,
  finishStorm, createSecretSupabase, AppSidebar, PathProgress across 76 file(s)". The MF-0005 grants re-freeze is a catalog
  enumeration the symbol grep can't see; it was found by reading the gates and is listed above.
- browser: `/paths/claude-developer` as a local learner (not enrolled: Start, 5 courses with skill counts 8/9/11/9/8 and the rule
  sentence; enrolled: "Course n of 5", Continue → `/play/<next>/walk`, status words, "Complete · {date}", live health and
  fading). Leave is in the menu. Today shows the card only when enrolled. Light, dark, 375px.

## Tasks — the graph the orchestrator dispatches; exactly one block

T1R, T3, T5 and T7 are run by the **orchestrator in the main session** (scope hook NEVER globs / no role scope for `scripts/**`,
`paths/**`, `next.config.ts`, `docs/**`, `CONTEXT.md`, `FROZEN.json`, `.planning/evidence/**`). Their `agent` is the role label
`ticket:eval` requires.

```json tasks
[
  {
    "id": "T0",
    "title": "content: clear the 7 baseline check:packs problems (separate hunk, C-4)",
    "agent": "service-builder",
    "owns": [
      "packs/platform-foundations/questions/D2.S1.yaml",
      "packs/platform-foundations/questions/D3.S2.yaml",
      "packs/platform-foundations/questions/D3.S3.yaml",
      "packs/platform-foundations/questions/D5.S1.yaml",
      "packs/platform-foundations/questions/D5.S2.yaml",
      "packs/subagents/cards/D2.S1.yaml",
      "packs/subagents/cards/D2.S2.yaml"
    ],
    "depends_on": [],
    "closes": ["SC-10"],
    "done_when": ["node scripts/check-pack-grounding.mjs"],
    "context": ["file:.planning/tasks/MF-0058/LOOP-PLAN.md#Steps step 0", "file:scripts/lib/item-grounding.mjs", "file:CONTEXT.md#Source", "memory:feedback-verify-derived-facts"]
  },
  {
    "id": "T1",
    "title": "migration: path_enrollments + course_completions, RLS, grants; migration up (no reset); db types",
    "agent": "schema-builder",
    "owns": ["supabase/migrations/20261106120000_mf0058_paths.sql", "src/server/db/database.types.ts"],
    "depends_on": [],
    "closes": ["SC-4", "SC-5"],
    "done_when": [
      "pnpm test:db src/server/db/__tests__/mf-0058-paths-rls.db.acceptance.test.ts -t \"SC-5: (RLS on|a learner)\"",
      "pnpm typecheck"
    ],
    "context": ["skill:supabase", "skill:supabase-postgres-best-practices", "memory:project-supabase-migration-rules", "file:supabase/migrations/20261104130000_mf0013_storms.sql", "file:supabase/migrations/20261106100000_mf0054_group_pins.sql"]
  },
  {
    "id": "T1R",
    "title": "re-freeze MF-0005 grants allow-list (+4 lines) after user approval (orchestrator)",
    "agent": "acceptance-writer",
    "owns": ["src/server/db/__tests__/mf-0005-grants.db.acceptance.test.ts", ".planning/tasks/MF-0005/FROZEN.json", ".planning/tasks/MF-0058/FROZEN.json"],
    "depends_on": ["T1"],
    "closes": ["SC-5"],
    "done_when": ["pnpm test:db src/server/db/__tests__/mf-0005-grants.db.acceptance.test.ts"],
    "context": ["file:.planning/tasks/MF-0005/FROZEN.json", "file:.planning/tasks/MF-0013/FROZEN.json"]
  },
  {
    "id": "T2",
    "title": "engine: path schema, parse/check, isCourseComplete, pathProgress, courseForest + inner tests",
    "agent": "service-builder",
    "owns": ["src/engine/path/**"],
    "depends_on": [],
    "closes": ["SC-1", "SC-2", "SC-3"],
    "done_when": [
      "pnpm test src/engine/path/__tests__/mf-0058-course-complete.acceptance.test.ts src/engine/path/__tests__/mf-0058-path-progress.acceptance.test.ts",
      "pnpm test src/engine/path/__tests__/mf-0058-path-file.acceptance.test.ts -t \"SC-1: (a path |an unknown|a duplicate|an empty|a pack with 0)\"",
      "pnpm test src/engine/path",
      "pnpm typecheck"
    ],
    "context": ["skill:typescript-strict", "skill:tdd", "skill:testing-strategy", "file:src/engine/forest/build-forest.ts", "file:src/engine/forest/tree-stage.ts", "file:src/engine/pack/schema.ts", "file:scripts/lib/ts-resolve.mjs"]
  },
  {
    "id": "T3",
    "title": "paths/claude-developer.yaml, path check in check:packs (before the corpus exit), next.config tracing (orchestrator)",
    "agent": "service-builder",
    "owns": ["paths/**", "scripts/check-pack-grounding.mjs", "next.config.ts"],
    "depends_on": ["T0", "T2"],
    "closes": ["SC-1", "SC-10"],
    "done_when": [
      "pnpm test src/engine/path/__tests__/mf-0058-path-file.acceptance.test.ts",
      "pnpm check:packs"
    ],
    "context": ["file:scripts/lib/validate-packs.mjs", "file:scripts/lib/ts-resolve.mjs", "file:.planning/tasks/MF-0033/LOOP-PLAN.md"]
  },
  {
    "id": "T4",
    "title": "server reads, recorder (secret client), grading call sites, startPath/leavePath, importer lock",
    "agent": "service-builder",
    "owns": [
      "src/server/paths/**",
      "src/server/attempts/**",
      "src/server/supabase/secret.ts",
      "src/server/supabase/__tests__/secret-client-importers.test.ts",
      "src/features/storm/actions.ts",
      "src/features/paths/actions.ts",
      "src/features/paths/schemas.ts",
      "src/features/paths/types.ts"
    ],
    "depends_on": ["T1", "T2", "T3"],
    "closes": ["SC-4", "SC-5", "SC-6"],
    "done_when": [
      "pnpm test:db src/server/paths/__tests__/mf-0058-course-completion.db.acceptance.test.ts src/server/db/__tests__/mf-0058-paths-rls.db.acceptance.test.ts src/features/__tests__/mf-0058-recorder-failure.db.acceptance.test.ts",
      "pnpm test src/server/paths src/server/attempts src/server/supabase src/features/__tests__/mf-0032-changed-message.acceptance.test.ts",
      "pnpm typecheck"
    ],
    "context": ["skill:nextjs-data", "skill:react-feature-architecture", "skill:typescript-strict", "skill:supabase", "skill:testing-strategy", "file:docs/adr/0004-server-only-secret-key-for-group-aggregates.md", "file:src/features/groups/actions.ts", "file:src/server/groups/get-group-heatmap.ts"]
  },
  {
    "id": "T5",
    "title": "CONTEXT.md terms + ADR 0006 (orchestrator)",
    "agent": "service-builder",
    "owns": ["CONTEXT.md", "docs/adr/0006-server-only-secret-key-for-course-completions.md"],
    "depends_on": ["T4"],
    "closes": ["SC-10"],
    "done_when": ["grep -nE '\\*\\*(Path|Enrolled|Course complete|Path complete)\\*\\*' CONTEXT.md", "grep -n 'MF-0058' docs/adr/0006-server-only-secret-key-for-course-completions.md"],
    "context": ["skill:grill-with-docs", "file:CONTEXT.md"]
  },
  {
    "id": "T6a",
    "title": "sidebar Workspace: Paths item with tooltip",
    "agent": "ui-builder",
    "owns": ["src/features/app-shell/components/app-sidebar/**"],
    "depends_on": [],
    "closes": ["SC-9"],
    "done_when": ["pnpm test src/features/app-shell/components/app-sidebar", "pnpm typecheck"],
    "context": ["skill:ui-shadcn", "skill:react-client-patterns", "file:.claude/rules/ui-design.md"]
  },
  {
    "id": "T6",
    "title": "path page, Paths list, Today Path card, Start/Leave via useMutation, error boundary",
    "agent": "ui-builder",
    "owns": ["src/features/paths/components/**", "src/features/paths/__tests__/**", "src/app/(app)/paths/**", "src/app/(app)/today/page.tsx"],
    "depends_on": ["T4"],
    "closes": ["SC-7", "SC-8"],
    "done_when": [
      "pnpm test src/features/paths",
      "pnpm typecheck",
      "pnpm lint",
      "pnpm build"
    ],
    "context": ["skill:server-client-components", "skill:client-data-tanstack-query", "skill:nextjs-data", "skill:react-client-patterns", "skill:react-component-split", "skill:ui-shadcn", "skill:accessibility", "file:.claude/rules/ui-design.md", "file:src/features/groups/components/pin-toggle/hooks/use-pin-toggle.ts", "file:src/app/(app)/groups/[groupId]/page.tsx"]
  },
  {
    "id": "T7",
    "title": "full gates, local browser data + proof (light/dark/375px), evidence, fresh-context review (orchestrator)",
    "agent": "ui-builder",
    "owns": [".planning/evidence/MF-0058.md", ".planning/evidence/MF-0058/**"],
    "depends_on": ["T1R", "T3", "T5", "T6", "T6a"],
    "closes": ["SC-7", "SC-10"],
    "done_when": [
      "pnpm typecheck && pnpm lint && pnpm test",
      "pnpm test:db",
      "pnpm check:packs",
      "pnpm build",
      "pnpm gate:planning",
      "pnpm ticket:collisions MF-0058"
    ],
    "context": ["memory:feedback-browser-verification", "memory:feedback-local-first", "memory:feedback-no-keys-in-logs"]
  }
]
```

## Plan approval (user, 2026-11-06)

1. Plan approved as written, including the MF-0005 grants re-freeze (4 lines + FROZEN.json history), the gate script
   `scripts/check-pack-grounding.mjs` and `next.config.ts` edits, and a local `pnpm db:sync-keys` after the card reword.
2. Logging: a named exception in `.claude/rules/code-conventions.md` — the course-completion recorder catches may
   `console.error` the message only (no row, no secret).
3. ADR: a new ADR 0006 referencing 0004 (0004 unchanged), not an amendment.
4. "Course n of N" = the position of the Continue course, with "{completed} of {N} complete" beside it.

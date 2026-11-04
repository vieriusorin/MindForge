---
verdict: approve
reviewed_hash: b0023f12468b9ff1868ab7aa9e7fb200fd168b79490c90f211381f3a16c70f01
reviewed_at: 2026-11-04T14:00:20Z
---
<!-- frontmatter = latest review (Review 2). Review 1: changes-requested, hash 4c3243a3e0de9cde1744f6fe4d1d62e726814c9996b232b9c4ae718070151818, 2026-11-04T13:38:57Z. hash = sha256( git diff HEAD -- . ':!.planning'  ++  contents of the sorted untracked files outside .planning ) -->

## Findings

- [blocking] src/features/storm/components/storm-session/hooks/use-storm-session.ts:73-86 — the client's wall clock ends the storm. When `remainingSeconds(endsAt, Date.now())` reaches 0, the hook calls `finishStorm`. `private.finish_storm` accepts a call before `ends_at`, and `finalize_storm` then grades the storm and sets `finished_at = least(now(), ends_at)`. Failure scenario: a learner's laptop clock runs 4 minutes fast. At DB time `ends_at − 4 min` their countdown reads 0, the storm is graded and closed for good, and they lose 4 minutes. This breaks the Constraint "The deadline is enforced by the DB (`ends_at`, DB clock)". The UI-predicate table assumes 0 s only *locks* the options. Fix: at 0, lock the options and `router.refresh()`. Do not call `finish_storm`: lazy `finalizeExpiredStorms` already grades the storm once DB `now() >= ends_at`, and it is a no-op before then. Alternatively, correct the countdown by a server time offset.

- [blocking] src/server/storm/to-storm-session-question.ts:14 (fed by src/app/(app)/storms/[id]/page.tsx:38-40) — the answer sends `row.contentHash`, which is the hash stored at start. It is not the hash of the question the page renders. The page renders `getPackQuestions` (the deployed files), and `getItemHashes` gives that version's hash, as the review pages use it (MF-0007). So the client just echoes the DB's own value back, and the "stored" half of the `answer_storm_question` check can never fail. The GOAL Constraint is "it names the content hash the learner READ". Failure scenario: a deploy changes question Q mid-storm, and `db:sync-keys` has not run yet. The learner reads the new text and sends the old stored hash. The registry still holds the old hash, so the answer is accepted. If they finish before the sync, the DB grades it against the old key and writes an attempt, so a judgement about content they never saw grows their forest. Fix: in the running branch, pass `getItemHashes(packSlug)[id]` as `contentHash`. The DB then refuses with 55000 when the deployed version differs from the stored one.

- [note] src/server/storm/start-storm.ts:83 — `domainCode as string` is not one of the named `as` exceptions in code-conventions.md. The Divergence argues it cannot be avoided, but that is not correct. Giving both trailing parameters defaults (`p_domain_code text default null, p_questions jsonb default null`) leaves the signature `public.start_storm(text,text,text,jsonb)` unchanged, so the frozen `to_regprocedure` check still passes. `start_storm` already raises on a null `p_questions`. `gen types` then marks `p_domain_code` optional, and a Full Storm omits it. No runtime fault today (the DB validates kind and domain), so this is non-blocking. Remove the cast when the migration is next touched (it is not merged yet).

- [note] src/features/storm/components/storm-session/hooks/use-storm-session.ts:111-117 — when a learner deselects an option of a saved multi-select answer, the DB is never told. Scenario: a `select: 2` question is saved as [A,B], and the learner unticks B. The navigator and the Finish dialog say "Not answered … counts as wrong" (`utils.ts:62-66`). The DB still grades [A,B], and a reload shows [A,B] again. The screen and the stored answer disagree.

- [note] src/app/(app)/storms/[id]/page.tsx:129-133 — `questionOf` throws when a storm question is no longer in the pack files. The migration handles exactly this case ("item or key is gone" → voided, line ~150), but the page does not. Scenario: a question is removed in a later deploy, and every report of an older storm that held it now returns 500 for good. The report and review should render a voided placeholder instead.

- [note] supabase/migrations/20261104130000_mf0013_storms.sql:220 — a Full Storm accepts any n from 1 to `exam_questions`, with any domain mix. A hand-made RPC call can start a "full" storm of 2 known questions of one skill, and that skill becomes Full-Storm-proven (Ancient). This falls inside the accepted Start-trust residual (only the learner's own forest; the heatmap ignores Tree). Recorded so the residual is explicit: it covers Ancient as well as Tree.

- [note] src/features/storm/components/storm-report/storm-report.tsx:120 — the voided line says "Their content changed during the storm", but `finalize_storm` also voids a question whose item or key was removed. The wording is narrower than the rule. It is not a NEVER-list claim.

Checked with no finding:
- Every SECURITY DEFINER function has `search_path = ''`. Revoke-all comes first, and the grants are only `authenticated` SELECT on the two tables plus EXECUTE on the entry points.
- Every RPC checks `auth.uid()` ownership.
- `finalize_storm` locks the storm row FOR UPDATE and returns early if it is already finished. `answer_storm_question` takes the same lock and re-checks `finished_at` and `now() >= ends_at`, and the unique `(storm_id, question_id)` index backs this up against double attempts.
- Running-storm guard: an advisory lock plus a partial unique index. Lazy finalisation only touches storms where `ends_at <= now()`.
- `start_storm` checks every Start-trust item.
- `correct` and the attempts are written only inside the finishing transaction. The running RSC payload carries only `toPlayableQuestion` output, and the actions return no grade.
- Storm proof is derived, drops rejected and voided questions, and matches CONTEXT.md. Tree and Ancient in `tree-stage.ts` match CONTEXT.md.
- Report figures come from `scoreStorm` and `stormShortfall`.
- No `use cache` on per-user reads, and every route has `<Suspense>`.
- `gate-io.mjs` `isAbsolute` fix and its test.
- The sync script's exam timing and `pack_skills` upserts.

## Review 2

verdict: approve · reviewed_hash: `b0023f12468b9ff1868ab7aa9e7fb200fd168b79490c90f211381f3a16c70f01` · reviewed_at: 2026-11-04T14:00:20Z
(The hash is computed the same way as for review 1. `pnpm ticket:verify` does not exist in this repo, and `.planning/evidence/MF-0013.receipts.jsonl` is absent, so there was no receipt to compare against.)

### Review 1 findings re-checked

- B1 is fixed. `src/features/storm/components/storm-session/hooks/use-storm-session.ts:86-94`: at 0 s the hook locks and calls `router.refresh()` every 5 s. It never calls `finishStorm`. `finishStorm` is now reached only through the Finish button or a DB MF013 refusal (`:64-71`). The loop stops because `StormSession` unmounts when the page renders `FinishedStorm` (`page.tsx:166-170`). The page's `finalizeExpiredStorms()` (`page.tsx:137`) grades the storm once DB `now() >= ends_at`. A slow client clock never reaches the loop, and the DB's MF013 refusal covers it.
- B2 is fixed. `page.tsx:141-149` and `:45-51` pass `getItemHashes` (the deployed files) as `readHash`. `to-storm-session-question.ts:11-21` no longer reads the stored hash. A test proves it (`to-storm-session-question.test.ts:64`).
- N1 is fixed. `start-storm.ts:82` spreads the domain argument away for a Full Storm, and no `as` is left. The migration's `:176-178`/`:405-407` trailing defaults keep the `(text,text,text,jsonb)` signature. `database.types.ts:317-323` makes `p_domain_code` optional, and `p_questions: null` is still refused (`:218`).
- N2 is fixed. `storedAnswerChange` (`storm-session/utils.ts`) sends `[]` once a saved answer drops below `select`, and `answer_storm_question` stores null/null on an empty array (`migration:355-358`). The `chosen_at` check holds. DB test (g) and hook test `:172` cover it.
- N3 is fixed. `page.tsx:45-51` and `:87-98` skip a missing question instead of throwing.
- N5 is fixed. `storm-report.tsx:120` reads "changed or were removed during or after the storm", which matches step (a) of `finalize_storm`.
- N4 is a residual, put to the user. Not re-judged.

### Clear path (`[]`) abuse

The checks run in order. Ownership comes first, under FOR UPDATE (`migration:321-326`, 42501). The MF013 deadline/finished check is next (`:327-329`). Shape (`:332-337`), membership (`:339-343`) and the hash (`:346-353`, 55000) follow. Only then does the update run (`:355`). So a clear after `ends_at`, on another learner's storm, or with a stale hash is refused exactly like a store. Clearing cannot write an attempt either: `finalize_storm` (c) skips `chosen is null`.

### Key leak on the running page

None. `RunningStorm` passes only `toStormSessionQuestion` output: the playable allow-list, the deployed hash, the stored `chosen` and `unreviewed`. `correct` is still null before finish, and no row object crosses to the client.

### Findings

- [non-blocking] `src/app/(app)/storms/[id]/page.tsx:44-51`: a question missing from the deployed files is hidden. The DB only voids it once `db:sync-keys` deletes its key (`scripts/sync-question-keys.mjs:187,213`). If the storm finishes in the deploy-to-sync window, the hidden question is not voided. When unanswered, it is scored as wrong, and a stored answer given before the deploy (on content the learner did read) is graded. The learner cannot be graded on content they never read. But in that window, `finishWarning` (`storm-session/utils.ts:76-82`) counts only visible questions, so it can say "Every question has an answer." while a hidden one counts as wrong. The comment at `page.tsx:86` ("reported as voided above") holds only after the sync. Operational window only. Either run the sync as part of the deploy, or exclude the hidden questions in `scoreStorm` input.
- [non-blocking] `src/features/storm/utils/rpc-errors.ts:270` with `use-storm-session.ts:119-132`: on 55000 the message says "it will not count". In the same deploy-to-sync window, an unanswered changed question is not voided (the registry hash still equals the stored one), so it counts as wrong. A pre-deploy stored answer is graded instead. Also, `toggle` sets the local `choices` before the save, so after a 55000 the navigator shows the refused pick as "Answered" while the DB holds the old answer or none. This screen/DB disagreement was unreachable before B2 (the echoed hash always matched) and is now reachable. Fix: revert the local choice on a 55000, and word the message without the future claim (for example "This question changed during the storm; your answer was not saved.").
- [non-blocking] `use-storm-session.ts:89-94` (residual of the B1 fix): a fast client clock still locks the options early, by the size of the skew, while polling `router.refresh()` every 5 s until DB `ends_at`. The storm is no longer cut short in the DB, and saved answers stand. But the learner cannot answer during the skew. Review 1's alternative, a server-time offset (pass the server's `now` with `endsAt` and derive the countdown from the offset), would remove this. Acceptable as is, against the "within 2 s" check in SC-7 for honest clocks.
- [non-blocking] `src/server/db/__tests__/mf-0013-storm-finalize.db.test.ts:258-314`: no DB test pins the clear path's refusal after `ends_at` (MF013), on another learner's storm (42501), or with a stale hash (55000). The SQL order is correct by reading (above). A regression test would hold the order if `answer_storm_question` is edited.
- [non-blocking] `use-storm-session.ts:103-104`: if every question of a running storm is missing from the deployed files, `questions` is empty and the hook throws. `storms/[id]/error.tsx` then offers a retry that throws again until the deadline passes. Unlikely, since it needs the whole storm deleted in one deploy.

### Rule compliance (touched files)

The view holds no behaviour, so the hooks/state live in `hooks/use-storm-session.ts`. Props are in `types.ts`. Every `utils.ts` export (`storedAnswerChange` included) is tested. `schemas.ts` uses zod 4 `strictObject`/`z.uuid()`, and the actions authorize, re-parse `unknown` and return `ActionResult`. The two `error.tsx` files follow the repo's existing `{ retry }` boundary shape (`groups/[groupId]/error.tsx:13`) and use shadcn primitives and tokens only. The page keeps per-user reads under `<Suspense>`, and no figure is computed outside `src/engine/storm`. No unnamed `as` casts remain in `src/server/storm`, `src/features/storm` or the storm routes.

Zero blocking findings.

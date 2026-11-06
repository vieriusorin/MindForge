# The server-only secret key also writes Course complete

Decided 2026-11-06 by the user (MF-0058, concerns C-2 / C-5 and plan approval). A learner's Course complete record
(`public.course_completions`) is a fact the learner must not be able to forge, because later tickets may show it to
others (MF-0059, groups following a path). Whether a course is complete is decided by replaying the learner's memory
in TypeScript (FSRS in `src/engine/memory`, the stage rule in `src/engine/forest`), so no database function or trigger
can decide it, the same reason as ADR 0004. Any function a signed-in learner can call to write the row would let them
write it by hand through the Data API.

So `course_completions` grants `authenticated` SELECT on its own rows only, and grants INSERT (and SELECT) to
`service_role` only; nobody holds UPDATE or DELETE. One server-only file, `src/server/paths/record-course-completion.ts`,
computes the rule on the server from the learner's own RLS-scoped reads and then inserts the row through
`createSecretSupabase` (`src/server/supabase/secret.ts`, introduced by ADR 0004).

This is a second use of the key, which ADR 0004 says needs a new ADR; ADR 0004 itself is unchanged and still governs
the heatmap read. We rejected a SECURITY DEFINER RPC callable by the learner (forgeable), and recording on page view
(a render with a side effect, and a late date for a learner who never opens the page).

**Consequences:** the importer lock (`src/server/supabase/__tests__/secret-client-importers.test.ts`, and the frozen
MF-0058 SC-5 wiring test) lists exactly two importers: `get-group-heatmap.ts` and `record-course-completion.ts`. A third
use needs another ADR. The recorder's secret client is used for that one three-column insert and never leaves the
function. Its reads run as the learner, so it must be given the verified session user's id (`getCurrentUser`); a wrong
id reads no attempts and writes nothing. The row is written once (primary key `(user_id, pack_slug)`, no UPDATE grant)
and is never re-judged. A failure to record never fails the attempt: callers catch it and log only its message
(`.claude/rules/code-conventions.md`, named exception).

---
ticket: MF-0058
outcome: pass
causes: known-trap-repeated, missing-context
actions: gate, skill-edit
lesson_keys: plan-assigns-forbidden-paths, reserved-ticket-premise-recheck, lib-helper-not-reached-ui-builder
applied: 2026-11-06
---
## Numbers
(`pnpm ticket:retro` is not wired; counts taken by hand from GOAL.md, LOOP-VERIFY.md, FROZEN.json, REVIEW.md, evidence.)
- Tier high-risk, `last_iteration: 1`, receipt PASS on tree 39a17990fea4: typecheck 0, lint 0, test 912, test:db 134, check:packs 0, gate:planning ok, build 0.
- Freeze: 9 acceptance files RED (37 unit/ui red, 14 db red, all in the new files). One later re-freeze, planned and approved: MF-0005 grants allow-list +4 lines (T1R). Own FROZEN hashes: 0 mismatches.
- Review: approve, 0 blockers, 3 should-fix (source-note juxtaposition, `timeZone: "UTC"` with no zone marker duplicating `src/lib/format-utc-date.ts`, 3 files outside any task's `owns`).
- Size: GOAL.md 25.6 KB, LOOP-PLAN.md 50 KB (10 tasks), 26 files / +726 lines in the diff.
- Baseline was red (`check:packs` 7 problems) and was fixed as T0 on the user's decision.

## Went right
- The draft GOAL claimed a "service-role client" for the write; the pickup fact re-derivation found only `createSecretSupabase` (ADR 0004, one importer) and turned it into C-2/C-5, a user decision, ADR 0006 and a 2-importer lock test, before any SC was frozen. Without it the RLS design (`course_completions` write-only for the server) would have been built on a client that did not exist. — keep: already is: `gsd-goal-loop/SKILL.md` ("Any reserved ticket drafted from a review note ... re-derive each factual claim", MF-0027) and the `## Facts` section.
- The planner read the gates and found the MF-0005 grants allow-list collision, the `check-pack-grounding.mjs` early corpus exit, the `next.config.ts` tracing and the `console.error` convention exception at PLAN, as one approval batch. A new table would otherwise have turned `test:db` red at BUILD. — keep: already is: SKILL "list the frozen tests it will break before the plan is approved".
- Baseline-red rule (SKILL: "put it in the checkpoint ... fix it as T0") worked: 7 `check:packs` problems became a separate T0 hunk, no BUILD surprise.
- The orchestrator re-verified the planner's T0 claim about `max_turns` against the cached page before the builder acted, and logged the deviation. — keep: already is: "the orchestrator re-runs; the builder's word is not used".
- `gate:planning` rejected the wrapped `design preflight:` entry the first time; it did its job (one re-run) — keep: already is.

## Went wrong
- The plan gave T4 (`service-builder`) `owns` of `src/features/paths/schemas.ts` and `types.ts`. The scope hook allows that agent only `src/features/*/actions.ts` and `actions/**` (`.claude/hooks/lib/agent-scopes.mjs`), so the write was refused and the files were handed to T6 mid-BUILD (Iteration Log, T4 line). Same family as MF-0013's `plan-assigns-forbidden-paths`; the written rule (`templates.md:132`) covers only the NEVER globs, not each role's allow-list. Cause: known-trap-repeated.
- Three files were changed outside every task's `owns`: `src/features/paths/utils/path-display.ts` (+ test) and `.claude/rules/code-conventions.md` (REVIEW should-fix 3; logged as deviations). The plan listed the convention exception as an approved item but not in any `owns`. Cause: known-trap-repeated (same rule, "scope = union of owns").
- `path-display.ts` re-implemented UTC date formatting with `timeZone: "UTC"` and no zone label, duplicating `src/lib/format-utc-date.ts` (REVIEW should-fix 2; a learner in UTC+10 would see a day early). T6's `context` list had skills and two files but nothing pointing at `src/lib/`; `ls src/lib` is not in any builder brief. Cause: missing-context.
- `pnpm ticket:collisions` exit 2 at DESIGN (it reads LOOP-PLAN.md only; the GOAL's `## Symbols changed` is not parsed) and the MF-0005 grants collision is a new-table-vs-allow-list collision, not a symbol collision, so the tool could not have found it. Documented tool behaviour, caught at PLAN, no cost beyond one line. Cause: none (see below).
- The draft GOAL's premise (a service-role write client existed) was an intake-time claim with no probe. Caught at pickup by the existing rule, so no cost. Cause: none.

## Actions (at most two)
1. gate: new check in `scripts/lib/planning-check.mjs` (wired from `scripts/check-planning.mjs`, run by `pnpm gate:planning`), `checkPlanOwns`: for every ticket past `plan` with a LOOP-PLAN.md, parse the fenced JSON task array and fail when (a) an `owns` glob of a task is not matched by `SCOPES[task.agent]` or is matched by `NEVER` (import both from `.claude/hooks/lib/agent-scopes.mjs`, export `NEVER` as `isNeverWritable(rel)`; compare by expanding each `owns` glob to a representative path such as the glob with `**`/`*` replaced by `x`), skipping tasks whose `agent` is not a role in `SCOPES`; or (b) a file in `git diff main --name-only` is matched by no task's `owns` (only when the ticket's `goal_status` is `complete*`, with `.planning/**` and `package.json` excluded). Real file it would have caught: `.planning/tasks/MF-0058/LOOP-PLAN.md` T4 (`service-builder`, owns `src/features/paths/schemas.ts`, not in `src/features/*/actions.ts`) at PLAN, plus `src/features/paths/utils/path-display.ts` and `.claude/rules/code-conventions.md` at hand-off. Draft as a new reserved ticket (touches a gate script, so hold per the policy); state hit count by a read-only run over MF-0040..MF-0058 plans in the GOAL, or write `yield: unmeasured`. Second occurrence of `plan-assigns-forbidden-paths` (MF-0013, MF-0058): a lesson learned twice is the case for a gate. Would have saved: one mid-BUILD handoff and one reviewer should-fix (about one builder round-trip).
2. skill-edit: `/Users/sorinvieriu/Projects/mind-forge/.claude/skills/gsd-goal-loop/references/templates.md` line 132 (the sentence "Every task's `owns` avoids the role agents' NEVER globs ..."). Append after "those steps belong to the orchestrator.": ` Each `owns` glob must also fall inside the task agent's allow-list in the same file (`service-builder` writes `src/features/*/actions.ts` but not a feature's `schemas.ts` or `types.ts`: give those to the `ui-builder` task or to the orchestrator), and every file the plan's approved items change (a rules file, a shared helper) appears in some task's `owns` (MF-0058: T4 was refused `schemas.ts`/`types.ts`; `.claude/rules/code-conventions.md` and `path-display.ts` sat in no `owns`).` And in `/Users/sorinvieriu/Projects/mind-forge/.claude/agents/ticket-planner.md` under the `owns` bullet (line ~50) add: ` Before finishing, check each glob against `SCOPES` in `.claude/hooks/lib/agent-scopes.mjs`.` Then, in the same templates.md paragraph, add one sentence for UI tasks: ` A UI task's `context` lists `file:src/lib/format-utc-date.ts` (dates) and `file:src/lib/forest-display.ts` when it shows a date or a stage, so the builder reuses the owner instead of formatting inline (MF-0058: `path-display.ts` re-formatted UTC dates without a zone marker).` Would have saved: the T4 handoff and the date-helper should-fix.

## Not worth changing
- Wrapped `design preflight:` entry failed `gate:planning` once: the gate worked, the SKILL already says "ONE Iteration Log line", one re-run. Not a pattern yet (if it recurs, make `checkDesignPreflight` join continuation lines of a bullet).
- Planner's wrong T0 analysis of the `max_turns` card (the page grounds the claim): the orchestrator verified it against the cached page before building, single instance, cost zero.
- `ticket:collisions` exit 2 at DESIGN: documented (it reads LOOP-PLAN.md); the MF-0005 allow-list collision is a new-table case no name grep finds, and PLAN caught it as intended.
- Source-note juxtaposition should-fix (the page implying completion of Anthropic's own path): a one-off copy judgement, fixed in the review loop.
- Token cost: LOOP-PLAN.md at 50 KB is the real size of a 10-task high-risk ticket (migration, recorder, three call sites, UI); no single repeated read or repeated failure stands out.
- Memory: checked `MEMORY.md` entries (`feedback-verify-derived-facts`, `project-supabase-migration-rules`, `feedback-no-keys-in-logs`); none is stale or duplicated by this ticket, and none needs adding.

## Applied

- 2026-11-06 action 2 (skill-edit, additive): applied. `.claude/skills/gsd-goal-loop/references/templates.md` (LOOP-PLAN
  shape: owns inside each agent's `SCOPES`, every changed file owned, UI `context` names `src/lib/format-utc-date.ts`
  and `src/lib/forest-display.ts`); `.claude/agents/ticket-planner.md` (`owns` bullet: check globs against `SCOPES`).
- 2026-11-06 action 1 (gate): drafted as reserved ticket **MF-0060** (`.planning/tasks/MF-0060/GOAL.md`, issue #94,
  sub-issue of MF-0058). Not built; held for the user.
- No memory action proposed; none applied.

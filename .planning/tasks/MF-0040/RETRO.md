---
ticket: MF-0040
outcome: pass
causes: known-trap-repeated, missing-context, tooling
actions: skill-edit
lesson_keys: key-length-tell, ai-content-claims-outrun-source, stale-listpacks-cache, shared-devtools-browser, course-pack-ticket-template, scratch-file-clobber, retro-applied-after-spawn
applied: 2026-11-04
---
## Numbers
`pnpm ticket:retro` does not exist, so these were counted by hand from `LOOP-VERIFY.md`, `verify/D1-D2.md`, `verify/D3-D4.md`, `evidence/MF-0040.md` and `GOAL.md`. There are no session token metrics, so no token verdict is possible.
- Pack: 4 domains, 8 skills, 65 items (48 questions, 8 cards, 9 diagrams), all `origin: ai`. Iteration 0 only; FROZEN.json `history: []`. Freeze: 7/7 red with ENOENT on the missing pack, then 7/7 green.
- Verifiers (2 fresh-context, D1-D2 and D3-D4): 28 FIX of 65 = 43% (MF-0037 34%, MF-0042 36%, MF-0031 26%). 0 wrong keys, 28 applied, 0 rejected.
- FIX by type: questions 11/48 (8 key-length cues, 3 distractors refuted only by silence), cards 8/8 (nature claims, plus two doc misreads: Explore skips CLAUDE.md and git status; `AgentDefinition` has no `isolation`), diagrams 9/9 (documented branches missing).
- Receipt: typecheck 0, lint 0, `pnpm test` 0 (97 files / 416 tests), `check:packs` 0, build 0. SC-12 PARTIAL: HTTP render, "62 in your queue", diagram drawing unseen.
- SC-8 first run read the wrong scratch file: `shared=26` (791-word course page expected; the file was the public Agent SDK page). Re-run in its own folder: `shared=0`.

## Went right
- Per-domain grounding notes plus fresh verifiers found 28 real defects with 0 wrong keys, and each FIX was re-checked against the cached text before it was applied (0 rejected). The verifier also caught two real doc misreads (`isolation`, Explore context) that a token check would not. — keep: already is, `.claude/skills/gsd-goal-loop/references/templates.md` "Course-pack ticket".
- The SC-8 mistake was caught only because the word count changed (791 expected). The check printed its input size, so a wrong input was visible. — keep: folded into the action below (make the printed word count an assertion).
- The `/agents` drift (the course teaches a wizard the docs now say only prints a reminder) was found during grounding and recorded under GOAL C-1 ("docs win") instead of being taught as the course says. — keep: already is, GOAL Concerns / evidence "Drift".
- The browser fallback was decided at DESIGN, SC-12 was marked `[~]` with the unseen drawing named. — keep: already is, memory `feedback-browser-verification`.

## Went wrong
- Key-length cue was the largest question-FIX class again: 8 of 11 question FIX (`verify/D3-D4.md` lines 34-44: D4.S1.q2, q5, q6, D4.S2.q1, q2, q3, q5, q6; "key is the longest option in 12 of 24"). The rule is written in `docs/plan/subagents-validation.md` line 98 ("not the longest by habit") and nothing enforced it. Cause: known-trap-repeated. MF-0042's retro (`.planning/tasks/MF-0042/RETRO.md`, written 17:21, after this ticket's verifiers at 17:16-17:17) already proposes the gate in `scripts/check-pack-grounding.mjs`; not re-proposed here. This pack measured 0 hits in MF-0042's read-only run only because the fixes were already applied.
- The new pack 404'd on the shared :3001 dev server (`listPacks()` is `"use cache"` + `cacheLife("days")`; the server predated `packs/subagents/`). The fact is recorded in this ticket's evidence only. Cause: missing-context, the same as MF-0042 (`stale-listpacks-cache`). MF-0042's action 2(a) already writes it into the template with the `next start -p 3002` recipe; not re-proposed. The orchestrator also needed a hand-built auth cookie for the HTTP render while the browser was held; the template names "HTTP render as a seeded learner" but no cookie recipe. One occurrence of a recipe gap, listed below, not an action.
- Cards 8/8 and diagrams 9/9 were FIX even though the brief carried the MF-0031/MF-0037 lessons. The grounding notes in `grounding/D*.md` have one row per item with key, passage and source, plus free-text "Branches documented" in some diagram rows and "Analogy fact ... is general biology" in some card rows. There is no per-distractor refutation cell and no per-`whereItBreaks` mechanism cell, because the drafters were spawned from the LOOP-PLAN brief before the MF-0037 retro's grounding-form edit landed (retro applied 17:08; MF-0040 drafts at 16:5x-17:1x). Cause: missing-context. The same timing gap is on record: MF-0037's retro noted that MF-0039's four checks landed after MF-0037's drafts; MF-0042's retro says T2-T5 "were briefed from LOOP-PLAN, not from the template". Third ticket in a row. I cannot show that the cells would have cut the diagram FIX count (some MF-0040 diagram rows did list branches and still came back FIX), so I do not claim a number for it. The action below fixes the timing, not the cell design.
- A drafting fork overwrote the scratch file the orchestrator used for SC-8. LOOP-PLAN T7 says "course page text in scratchpad", a path shared with the drafting forks; the first post-fix run showed `shared=26` against a public Agent SDK page. Only the changed word count exposed it. Cause: tooling (a shared scratch path and an SC-8 check with no input assertion). Cost: one re-extract and re-run here; had the count not changed, SC-8 would have passed against the wrong text, or failed for the wrong reason.
- SC-12 PARTIAL again (fourth pack ticket) because the shared browser was held. Cause: tooling, `shared-devtools-browser`; the user owns the browser.

## Actions (at most two)
1. skill-edit: `/Users/sorinvieriu/Projects/mind-forge/.claude/skills/gsd-goal-loop/references/templates.md`, "Course-pack ticket". Replace the line `- a source-copy SC: 12-word overlap against any saved course page, run after the verifier fixes;` with:
   "- a source-copy SC: 12-word overlap against any saved course page, run after the verifier fixes. Extract the course text into a folder only the orchestrator writes (`<scratchpad>/mf-<id>-sc8/`), never a path a drafting fork is told about, and tell the forks to write only under `packs/<slug>/` and `.planning/tasks/<id>/`. The check prints the course file's word count and the run asserts it equals the count recorded when the page was saved (MF-0040: a fork overwrote the shared scratch file, the run showed `shared=26` against the wrong page, and only the changed word count exposed it);"
   Would have saved: one wrong SC-8 run and a re-extract here, and the risk of a false pass on the next pack ticket.
2. skill-edit: same file, same section, append one final bullet (it does not overlap MF-0042's action 2, which edits the screen-proof bullet and adds the key-letter plan bullet):
   "- before spawning the drafters, open the previous pack ticket's `RETRO.md`. If it has no `applied:` front-matter line yet, copy its Actions text into this ticket's drafting brief and say so under 'Decided without a question' (MF-0037, MF-0039 and MF-0040 were each drafted before the prior retro was applied, so the lesson reached the next pack as a brief line at best, or not at all)."
   Would have saved: the drafting rounds in which MF-0037's grounding-cell form and MF-0042's key-length and screen-proof lessons were missing; the effect on the FIX count is not measured.

## Not worth changing
- Key-length gate: MF-0042 action 1 (already proposed, owner applying).
- `listPacks()` 404 and the `next start -p 3002` recipe: MF-0042 action 2(a) (already proposed).
- Hand-built auth cookie for the HTTP render: one occurrence; the template already says "HTTP render as a seeded learner". If it recurs, add the cookie helper's name to the memory entry `feedback-browser-verification`.
- 43% FIX rate: the highest so far (26, 34, 36, 43) but the verifier pass stays in every pack plan; it is working as the net. Not a reason to loosen SC-8 or drop the verifiers.
- SC-12 diagram drawing unverified: covered for the component by `mf-0010-diagram-figure.acceptance.test.tsx`; the remaining gap needs the user's browser.
- `pnpm dev:seed` replacing the local demo world: user-approved (C-2), already in the template bullet.
- No token judgement: no session metrics. Likely cost is the four drafting forks plus two verifier contexts, which is the planned shape.

## Applied
- Action 1 (skill-edit, additive): applied. `.claude/skills/gsd-goal-loop/references/templates.md`, Course-pack
  ticket: the source-copy SC bullet now requires an orchestrator-only extraction folder and a word-count assert.
- Action 2 (skill-edit, additive): applied. Same section, new final bullet: copy an unapplied previous pack retro's
  Actions into the drafting brief.
- Applied after MF-0042's owner session applied its own edits to the same section (`applied: 2026-11-04` there), so
  the two sets of edits don't collide.
- Held: nothing.

---
ticket: MF-0037
outcome: pass
causes: known-trap-repeated, tooling
actions: skill-edit, gate
applied: 2026-11-04
lesson_keys: ai-content-claims-outrun-source, diagram-branch-omissions, analogy-nature-claims, shared-devtools-browser, parallel-session-coordination, course-pack-ticket-template
---
## Numbers
`pnpm ticket:retro` does not exist, so these were counted by hand from `verify/D*.md`, `LOOP-VERIFY.md` and `GOAL.md`. There are no session token metrics, so no token verdict is possible.
- Pack: 3 domains, 8 skills, 64 items (48 questions, 8 cards, 8 diagrams), all `origin: ai`. Iteration 0 only; FROZEN.json `history: []`. Freeze: 6 acceptance tests all red for their own reason (ENOENT on the missing pack), then 6/6 green.
- Verifiers (3 fresh-context, one per domain): 22 FIX of 64 items = 34% (MF-0031: 19 of 72 = 26%). All 22 resolved, 0 wrong keys.
- FIX by item type: questions 9/48 (19%), cards 7/8, diagrams 6/8. MF-0031 was questions 7/54, cards 6/9, diagrams 6/9.
- FIX by pattern: 6 diagrams (5 missing or misordered branches: D1.S1, D2.S2, D2.S3, D2.S4, D3.S1; D3.S2 hardened an optional step); 6 of 7 card FIXes are an unsupported or false nature claim in an analogy (lyrebird, songbird, bird routes, sheepdog, "same bed same channel", a whereItBreaks line that contradicts the card's own analogy); 4 distractors refuted only by silence or an inference (D1.S1.q4 D, D1.S1.q6 B, D2.S1.q3 D, D2.S4.q5 C); 2 stem cues (D1.S2.q6, D2.S4.q6); 1 level mismatch (D1.S2.q5); 3 rationale or quantifier slips.
- Receipt: typecheck 0, lint 0, build 0. Full `pnpm test` 3 files / 16 tests red, all other sessions' in-flight frozen reds (MF-0038 4, MF-0040 6, MF-0042 6); 94 files / 400 tests pass. SC-11 PARTIAL (browser held; HTTP render showed "62 in your queue" and the first item; no diagram drawn).

## Went right
- The per-domain grounding note plus a fresh-context verifier worked again: 22 real errors found, no wrong key, every FIX resolved by the orchestrator from the report's replacement text. — keep: already is, `.claude/skills/gsd-goal-loop/references/templates.md` "Course-pack ticket".
- The acceptance file caught an orchestrator edit that broke YAML quoting (unescaped inner double quotes in a replacement) within one run, so no broken pack reached sync. — keep: already is, the frozen acceptance run is the gate.
- The browser fallback was decided at DESIGN ("browser check, or HTTP render if the shared browser is held") and SC-11 was marked `[~]` with the unseen part named, not promoted to a pass. The MF-0031 memory bullet did its job. — keep: already is, memory `feedback-browser-verification`.
- Sync ran twice with identical read-backs (64 items, 48 keys), the n-gram source-copy check ran after the fixes (0 hits of 783 grams), and the reds were attributed by file to MF-0038/0040/0042 against a recorded baseline. — keep: already is, templates.md Course-pack bullets.

## Went wrong
- Diagram branch omissions recurred: 6 of 8 diagrams (MF-0031: 6 of 9). MF-0031's retro said a second ticket with the same rate would warrant a fork-brief line. The line was already there: GOAL "Decided without a question" says "each diagram lists every branch the cited page documents", and LOOP-PLAN Discovery repeats it. It did not change the drafts. The grounding rows (`grounding/D2.md` lines 30, 43, 56, 69) list sources and passages per diagram, never the branches, so nothing forced the enumeration. Cause: known-trap-repeated. The rule was written in the place that does not bind (a brief) and not in the deliverable the drafter fills.
- Analogy claims about nature were wrong in 6 of 8 cards (see Numbers). MF-0031's cards had 6 of 9 FIX with the same family (D2.S1 card "almost entirely", D3.S3 card absolute). The `analogy owner` rung in the validation doc exists for the learner-facing fit, but nobody checks that the animal or plant behaviour is true or that the three whereItBreaks lines differ in mechanism. Cause: known-trap-repeated (`ai-content-claims-outrun-source`), no deliverable cell for it.
- Distractors refuted only by the source's silence: 4 items (MF-0031: D1.S3.q6 D, D3.S2.q4 A, same family). The verifier is the only net. Cause: known-trap-repeated.
- Timing, not a defect: the four drafter checks that MF-0039's retro put in `SKILL.md` Stage 2 (strictest rule first, find the flag that removes "always", diagram table rows as branches, the page's reason) landed at 17:02, after MF-0037's drafts (plan 16:38, verifiers 16:52). MF-0037 only had the two lines from the MF-0031 retro. The next pack ticket gets them, but they are brief text too, the same kind of rule that failed here.
- The MF-0031 retro predicted that about 8 of 19 FIX would be mechanical (unsupported backticked identifier, absolute quantifier) and built the reserved MF-0033 gate on that. In MF-0037 there are 0 unsupported-identifier cases and at most 3 quantifier slips of 22 (D3.S1 card "Most", D2.S4 card "gives consistent ones", D1.S2 card "cannot remember"), and none of those words is on MF-0033's list. The gate as specced would have caught about 0 of 22. Cause: wrong-plan, in the reserved gate's scope. MF-0036 already found the same shape for its quantifier rule (the page said "never" 12 times).
- SC-11 was PARTIAL for the second pack ticket in a row, because the review queue shows one item at a time, so HTTP cannot reach a diagram that is not first. Cause: tooling (`shared-devtools-browser`); the remaining gap needs a browser, which the user owns.
- The full suite was red from other sessions' frozen RED tests (16 tests), as in MF-0031 and MF-0039. Handled by attribution. Cause: tooling (`parallel-session-coordination`).

## Actions (at most two)
1. skill-edit: `/Users/sorinvieriu/Projects/mind-forge/.claude/skills/gsd-goal-loop/references/templates.md`, "Course-pack ticket (precedent: MF-0039)". Replace the bullet "- 3 drafters by domain, then 3 fresh verifiers; the drafter brief carries the four semantic checks in SKILL.md;" with:
   "- 3 drafters by domain, then 3 fresh verifiers; the drafter brief carries the four semantic checks in SKILL.md. The grounding note (`grounding/<D>.md`) is a form the drafter must fill, and each verifier checks its cells first (MF-0031 and MF-0037 both put 'list every branch' in the brief and still got 6 of 9 and 6 of 8 diagrams back as FIX; a brief line does not change what is written, an empty cell does): per diagram, a `branches` cell listing every branch, table row or conditional the cited page documents next to the node or edge id that draws it ('left out: <reason>' is allowed, silence is not); per card, an `analogy` cell naming the real-world behaviour that `inNature` and each `whereItBreaks` line asserts, its source or `[GK]` (a `[GK]` claim about animals or plants is dropped unless it is textbook-safe), and a note of how each `whereItBreaks` line differs in mechanism, not only in size; per question, one quoted passage that refutes each distractor (silence in the page is not a refutation);"
   Would have saved: most of the 22 verifier FIX (6 diagrams, 6 analogy cards, 4 distractors are all enumeration gaps the cells expose), the fix pass after it, and a third verifier re-read.
2. gate: `/Users/sorinvieriu/Projects/mind-forge/.planning/tasks/MF-0033/GOAL.md` (reserved, unbuilt). Append under "Open questions" a new bullet: "- Yield evidence (MF-0037 retro, 2026-11-04): of 22 FIX in a 64-item AI pack, 0 were an unsupported backticked identifier and at most 3 were absolute-quantifier slips, none using a word on this list ('Most', 'consistent', 'cannot'). MF-0031 predicted about 8 of 19. The rule as written would have caught about 0 of 22. Before building, run the drafted rule read-only over `packs/ai-capabilities/`, `packs/prod-prompting/` and `packs/agent-skills/` (SKILL.md Stage 3: the first run of a new check reviews shipped content) and list the hits; build only if it finds a real defect. The larger classes (missing diagram branches, false analogy claims, distractors refuted by silence) are not checkable by token match, so a verifier pass stays in every pack plan (see `references/templates.md` Course-pack ticket, grounding-note cells)."
   Would have saved: building a gate ticket whose expected yield is near zero, ahead of work that would find defects.

## Not worth changing
- Stem-cue gate: a probe (key option is the only one sharing a 7+ letter word with the stem) hit 15 of 48 questions in `ai-capabilities` and 13 of 54 in `prod-prompting`, mostly noise ("context", "document"), so it is not a usable static check. The two real cues (D1.S2.q6, D2.S4.q6) stay with the verifier.
- YAML quoting broken by an orchestrator edit: caught by the first acceptance run; the gate did its job. One occurrence.
- SC-11 diagram drawing unverified over HTTP: covered by `mf-0010-diagram-figure.acceptance.test.tsx` for the component; the remaining gap needs a human browser session. Do not change the SC to hide it.
- The other sessions' pack-ticket reds in `pnpm test`: attributed per file against a baseline; isolating them in the suite would loosen the full-suite rule.
- Lessons 2-7 of the course not saved (C-1): a stated Concern with the user as owner.
- No token judgement: no session metrics. Likely cost is the three drafting forks plus three verifier contexts, which is the planned shape.

## Applied
- Action 1 (skill-edit, additive): applied. `.claude/skills/gsd-goal-loop/references/templates.md`, Course-pack ticket bullet replaced by the grounding-note form (branches / analogy / distractor-refutation cells, checked first by each verifier).
- Action 2 (gate): applied as a note on the existing reserved ticket `.planning/tasks/MF-0033/GOAL.md` (Open questions, yield evidence + read-only dry run before building). Not built.

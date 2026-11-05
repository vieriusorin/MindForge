# MF-0042 LOOP-PLAN (iteration 0)

## Discovery

- Precedent: MF-0037 (`packs/ai-capabilities/`) and MF-0039/0040 (Claude Code course packs on code.claude.com
  sources): course pack, `level` on every item, drafting forks + fresh-context verifiers, a validation doc in
  `docs/plan/`, grounding notes per item in `.planning/tasks/<ID>/grounding/`.
- Loader: `src/engine/pack/load-pack.ts` (`loadPackFile`), `src/engine/content/load-content.ts`
  (`loadPackContent`); `level` optional since MF-0031. Weight sums validated by `src/engine/pack/schema.ts`.
- Corpus: `pnpm generate:corpus --pack claude-code-in-action` → `.cache/corpus/<sha256(url)>.json`.
- DB: `scripts/sync-question-keys.mjs` registers every `packs/<slug>/` and its keys after `validate-packs.mjs`;
  `pnpm dev:seed` (MF-0034) seeds a demo group per pack with questions.
- No gate lists pack paths. No `ticket:*` scripts: freeze/verify/eval run by hand (skill defaults).
- Frozen files this will re-freeze: none. No closed set or shared shape is widened; `grep -rl
  claude-code-in-action **/*.acceptance.test.*` hits only this ticket's file.

## SC → steps

| SC | Step |
|---|---|
| SC-1 | T1 pack.yaml |
| SC-2…SC-5 | T2–T5 drafting forks |
| SC-6 | T5 (D4.S1 capstone) |
| SC-7 | T4 (D3.S1 diagram, D3 expert questions) + T5 (D3.S3) |
| SC-8 | T6 fresh-context verifiers → fixes by the orchestrator |
| SC-9, SC-10, SC-11 | T7 local sync, seed, browser/HTTP |
| SC-12 | T8 `docs/plan/claude-code-in-action-validation.md` |
| SC-13 | T9 receipt |

## Riskiest step

Literal correctness (GOAL Riskiest step): commands, flags, hook events, file paths and exit codes that are easy
to get stale. Mitigations: every backticked token must occur in the cached cited page (drafter checks, verifier
re-checks with `grep -F`); grounding note per item quotes the passage.

Re-run state: no deletes, no ids or manifests on disk, no destructive writes by this ticket. `dev:seed` replaces
the local demo world, approved by the user at the checkpoint.

**Contract trap (SC-6):** `nodeMatching` takes the first node whose label matches, so in the D4.S1 capstone only
the code step may contain "code" or "implement", only the verify step "verify" or "test", only the plan step
"plan", only the explore step "explore". Labels like "Explore the codebase" would make SC-6 match the wrong node.
Drafter T5 gets this verbatim.

## Rejected options

- One drafter for all 66 items: the context gets too long to keep each item tied to its exact passage.
- Fetching the course lessons: CONTEXT.md *Source*.
- Following the course where it has drifted (custom commands, Claude Code SDK): items would teach stale names.
- A chart item type: out of scope (user decision C-3).

## Key-letter plan (SC-4: no letter > 40%)

Answer letter for q1…q6 per skill:
D1.S1 B D A C D A · D2.S1 C A D B B C · D2.S2 A C B D C B · D2.S3 D B C A A D · D2.S4 B A D C A C ·
D2.S5 C D A B D B · D2.S6 A B C D B A · D3.S1 D C B A C D · D3.S2 B D A C D A · D3.S3 C A D B B C ·
D4.S1 A C B D C B. Levels: q1–q2 foundation, q3–q4 practitioner, q5–q6 expert.

## Drafting brief (every fork)

- Read the GOAL, this plan, `packs/ai-capabilities/{questions,cards,diagrams}/D2.S3.yaml` for the exact shape,
  and the cached text of your skills' sources (`.cache/corpus/`). Course text is never used.
- Each item cites one of its skill's `sources`; every claim, backticked token and absolute quantifier occurs in
  that page; each option has a rationale; distractors are plausible and of similar length to the key.
- Where the course has drifted, follow today's page and add the old name to a "drift" line in the grounding note.
- Write one grounding row per item in `.planning/tasks/MF-0042/grounding/<group>.md` (key, quoted passage, source).
- Diagrams: ≥ 4 nodes, every node on an edge, every branch the cited page documents.
- Run `pnpm exec vitest run src/engine/content/__tests__/mf-0042-claude-code-in-action.acceptance.test.ts`
  and leave no failure that names one of your items. Do not edit the test.

```json tasks
[
  {"id":"T1","agent":"inline","owns":["packs/claude-code-in-action/pack.yaml"],"depends_on":[],"closes":["SC-1"],"done_when":"SC-1 green","context":"Blueprint in GOAL.md"},
  {"id":"T2","agent":"fork","owns":["packs/claude-code-in-action/*/{D1.S1,D2.S1,D2.S2}.yaml",".planning/tasks/MF-0042/grounding/G1.md"],"depends_on":["T1"],"closes":["SC-2","SC-3","SC-4","SC-5"],"done_when":"no SC-2..5 failure names these skills","context":"drafting brief"},
  {"id":"T3","agent":"fork","owns":["packs/claude-code-in-action/*/{D2.S3,D2.S4,D2.S5}.yaml",".planning/tasks/MF-0042/grounding/G2.md"],"depends_on":["T1"],"closes":["SC-2","SC-3","SC-4","SC-5"],"done_when":"no SC-2..5 failure names these skills","context":"drafting brief"},
  {"id":"T4","agent":"fork","owns":["packs/claude-code-in-action/*/{D2.S6,D3.S1,D3.S2}.yaml",".planning/tasks/MF-0042/grounding/G3.md"],"depends_on":["T1"],"closes":["SC-2","SC-3","SC-4","SC-5","SC-7"],"done_when":"no SC-2..5 failure names these skills; SC-7 diagram part green","context":"drafting brief"},
  {"id":"T5","agent":"fork","owns":["packs/claude-code-in-action/*/{D3.S3,D4.S1}.yaml",".planning/tasks/MF-0042/grounding/G4.md"],"depends_on":["T1"],"closes":["SC-2","SC-3","SC-4","SC-5","SC-6","SC-7"],"done_when":"SC-6 and SC-7 green","context":"drafting brief + SC-6 contract trap"},
  {"id":"T6","agent":"general-purpose","owns":[".planning/tasks/MF-0042/verify/G1.md",".planning/tasks/MF-0042/verify/G2.md",".planning/tasks/MF-0042/verify/G3.md",".planning/tasks/MF-0042/verify/G4.md"],"depends_on":["T2","T3","T4","T5"],"closes":["SC-8"],"done_when":"every FIX resolved by the orchestrator","context":"fresh context: item files + cached sources only"},
  {"id":"T7","agent":"inline","owns":[],"depends_on":["T6"],"closes":["SC-9","SC-10","SC-11"],"done_when":"read-backs pasted","context":"local stack only"},
  {"id":"T8","agent":"inline","owns":["docs/plan/claude-code-in-action-validation.md"],"depends_on":["T2","T3","T4","T5"],"closes":["SC-12"],"done_when":"study order, drift table, ladder, signers, follow-ups","context":"docs/plan/ai-capabilities-validation.md as template"},
  {"id":"T9","agent":"inline","owns":[".planning/tasks/MF-0042/LOOP-VERIFY.md",".planning/evidence/MF-0042.md"],"depends_on":["T6","T7","T8"],"closes":["SC-13"],"done_when":"receipt DONE for the current tree","context":""}
]
```

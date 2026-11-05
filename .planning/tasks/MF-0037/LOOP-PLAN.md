# MF-0037 LOOP-PLAN (iteration 0)

## Discovery

- Precedent: MF-0031 (`packs/prod-prompting/`), same shape: course pack, `level` on every item, 3 drafting forks
  + 3 fresh-context verifiers, validation doc in `docs/plan/`. Its retro: check backticked tokens and absolute
  quantifiers against the cited text (MF-0033 gate reserved, not built) and list every branch a diagram's source
  documents.
- Loader: `src/engine/pack/load-pack.ts` (`loadPackFile`), `src/engine/content/load-content.ts`
  (`loadPackContent`); `level` optional since MF-0031. Weight sums validated by `src/engine/pack/schema.ts`.
- Corpus: `pnpm generate:corpus --pack ai-capabilities` → `.cache/corpus/<sha256(url)>.json`, 16/16 cached.
- DB: `scripts/sync-question-keys.mjs` registers every `packs/<slug>/` and its keys after `validate-packs.mjs`;
  `pnpm dev:seed` (MF-0034) seeds a demo group per pack with questions.
- No gate lists pack paths. No `ticket:*` scripts: freeze/verify/eval run by hand (skill defaults).
- Frozen files this will re-freeze: none (no closed set or shared shape widened; grep for `ai-capabilities` in
  `**/*.acceptance.test.*` hits only this ticket's file).

## SC → steps

| SC | Step |
|---|---|
| SC-1 | T1 pack.yaml (done at freeze time) |
| SC-2…SC-6 | T2–T4 drafting forks per domain |
| SC-7 | T6 scratch n-gram check vs the saved course page |
| SC-8 | T5 fresh-context verifiers per domain → fixes |
| SC-9, SC-10, SC-11 | T7 local sync, seed, browser/HTTP |
| SC-12 | T8 docs/plan/ai-capabilities-validation.md |
| SC-13 | T9 receipt |

## Riskiest step

Content correctness on conceptual claims (see GOAL Riskiest step). Mitigated by grounding notes per item, the
verifier pass on cached text, and the review rungs after hand-off. No deletes, no ids on disk, no destructive
writes by this ticket; `dev:seed` replaces the local demo world, approved by the user at the checkpoint.

## Rejected options

- One drafter for all 64 items: the context gets too long to keep each item tied to its exact passage.
- Fetching the remaining course lessons: CONTEXT.md *Source* (user decision).
- A chart item type: out of scope (user decision); follow-up ticket.

## Key-letter plan (SC-4: no letter > 40%)

Answer letter for q1…q6 per skill:
D1.S1 B D A C D A · D1.S2 C A D B B C · D2.S1 A C B D C B · D2.S2 D B C A A D ·
D2.S3 B A D C A C · D2.S4 C D A B D B · D3.S1 A B C D B A · D3.S2 D C B A C D
(12 each across 48.)

```json tasks
[
  {"id":"T1","agent":"inline","owns":["packs/ai-capabilities/pack.yaml"],"depends_on":[],"closes":["SC-1"],"done_when":"SC-1 green","context":"Blueprint in GOAL.md"},
  {"id":"T2","agent":"fork","owns":["packs/ai-capabilities/*/D1.*.yaml",".planning/tasks/MF-0037/grounding/D1.md"],"depends_on":["T1"],"closes":["SC-2","SC-3","SC-4","SC-5"],"done_when":"D1 items load; no SC-2..5 failure names a D1 item","context":"drafting brief"},
  {"id":"T3","agent":"fork","owns":["packs/ai-capabilities/*/D2.*.yaml",".planning/tasks/MF-0037/grounding/D2.md"],"depends_on":["T1"],"closes":["SC-2","SC-3","SC-4","SC-5"],"done_when":"D2 items load; no SC-2..5 failure names a D2 item","context":"drafting brief"},
  {"id":"T4","agent":"fork","owns":["packs/ai-capabilities/*/D3.*.yaml",".planning/tasks/MF-0037/grounding/D3.md"],"depends_on":["T1"],"closes":["SC-2","SC-3","SC-4","SC-5","SC-6"],"done_when":"D3 items load; SC-6 green","context":"drafting brief"},
  {"id":"T5","agent":"general-purpose","owns":[".planning/tasks/MF-0037/verify/D1.md",".planning/tasks/MF-0037/verify/D2.md",".planning/tasks/MF-0037/verify/D3.md"],"depends_on":["T2","T3","T4"],"closes":["SC-8"],"done_when":"every FIX resolved by the orchestrator","context":"fresh context: item files + cached sources only"},
  {"id":"T6","agent":"inline","owns":[],"depends_on":["T2","T3","T4"],"closes":["SC-7"],"done_when":"0 shared 12-grams","context":"scratch script, course page in scratchpad"},
  {"id":"T7","agent":"inline","owns":[],"depends_on":["T5"],"closes":["SC-9","SC-10","SC-11"],"done_when":"read-backs pasted","context":"local stack only"},
  {"id":"T8","agent":"inline","owns":["docs/plan/ai-capabilities-validation.md"],"depends_on":["T2","T3","T4"],"closes":["SC-12"],"done_when":"file covers study order, ladder, signers, follow-ups","context":"MF-0031 validation doc as template"},
  {"id":"T9","agent":"inline","owns":[".planning/tasks/MF-0037/LOOP-VERIFY.md",".planning/evidence/MF-0037.md"],"depends_on":["T5","T6","T7","T8"],"closes":["SC-13"],"done_when":"receipt DONE for the current tree","context":""}
]
```

# MF-0040 LOOP-PLAN (iteration 0)

## Discovery

- Precedent: MF-0037 (`packs/ai-capabilities/`) and MF-0038 (`packs/platform-foundations/`): same shape, same
  acceptance-test structure (copied, values from this GOAL), drafting forks + fresh-context verifiers, validation doc
  in `docs/plan/`. MF-0031 retro: backticked tokens and absolute quantifiers must occur in the cited text; diagrams
  list every branch the source documents.
- Loader: `src/engine/pack/load-pack.ts` (`loadPackFile`), `src/engine/content/load-content.ts` (`loadPackContent`);
  `level` optional since MF-0031. Item shapes: see `packs/ai-capabilities/{questions,cards,diagrams}/D1.S1.yaml`.
- Corpus: `pnpm generate:corpus --pack subagents` → 13/13 cached in `.cache/corpus/<sha256(url)>.json` (`text` field).
- DB: `scripts/sync-question-keys.mjs` registers every `packs/<slug>/`; `pnpm dev:seed` (MF-0034) seeds a demo group
  per pack with questions.
- No `ticket:*` scripts: freeze/verify/eval by hand (skill defaults). `pnpm check:packs` exists (MF-0036, cuckoos).
- Frozen files this will re-freeze: none. No closed set or shared shape is widened; `grep -l subagents` over
  `**/*.acceptance.test.*` hits only this ticket's file.

## SC → steps

| SC | Step |
|---|---|
| SC-1 | T1 pack.yaml (done: green) |
| SC-2…SC-7 | T2–T5 drafting forks, one per domain |
| SC-8 | T7 scratch 12-gram check vs the saved course page |
| SC-9 | T6 fresh-context verifiers (one per two domains) → fixes |
| SC-10, SC-11, SC-12 | T8 local sync, seed, browser/HTTP |
| SC-13 | T9 `docs/plan/subagents-validation.md` |
| SC-14 | T10 receipt |

## Riskiest step

Exact frontmatter field names, defaults and version-gated behaviour on `sub-agents` (see GOAL). Items avoid version
numbers and provider-specific defaults; verifiers check every field name and default against the cached page. No
deletes, no ids on disk; `dev:seed` replaces the local demo world (user-approved, C-2).

## Rejected options

- One drafter for all 64 items: too much source text (sub-agents alone is 117 kB) to keep each item tied to its passage.
- Reading the course video/lessons: CONTEXT.md *Source* (user decision).
- A chart item type: user decision C-3, follow-up ticket.

## Key-letter plan (SC-4: no letter > 40%)

Levels: q1, q2 foundation · q3, q4 practitioner · q5, q6 expert (≥ 1 of q5/q6 cites a senior source: SC-7).
Answer letter for q1…q6:
D1.S1 B D A C D A · D1.S2 C A D B B C · D2.S1 A C B D C B · D2.S2 D B C A A D ·
D3.S1 B A D C A C · D3.S2 C D A B D B · D4.S1 A B C D B A · D4.S2 D C B A C D (12 each across 48).

```json tasks
[
  {"id":"T1","agent":"inline","owns":["packs/subagents/pack.yaml"],"depends_on":[],"closes":["SC-1"],"done_when":"SC-1 green","context":"Blueprint in GOAL.md"},
  {"id":"T2","agent":"fork","owns":["packs/subagents/*/D1.*.yaml",".planning/tasks/MF-0040/grounding/D1.md"],"depends_on":["T1"],"closes":["SC-2","SC-3","SC-4","SC-5","SC-6","SC-7"],"done_when":"D1 items load; SC-6 green; no failure names a D1 item","context":"drafting brief"},
  {"id":"T3","agent":"fork","owns":["packs/subagents/*/D2.*.yaml",".planning/tasks/MF-0040/grounding/D2.md"],"depends_on":["T1"],"closes":["SC-2","SC-3","SC-4","SC-5","SC-7"],"done_when":"no failure names a D2 item","context":"drafting brief"},
  {"id":"T4","agent":"fork","owns":["packs/subagents/*/D3.*.yaml",".planning/tasks/MF-0040/grounding/D3.md"],"depends_on":["T1"],"closes":["SC-2","SC-3","SC-4","SC-5","SC-7"],"done_when":"no failure names a D3 item","context":"drafting brief"},
  {"id":"T5","agent":"fork","owns":["packs/subagents/*/D4.*.yaml",".planning/tasks/MF-0040/grounding/D4.md"],"depends_on":["T1"],"closes":["SC-2","SC-3","SC-4","SC-5","SC-7"],"done_when":"no failure names a D4 item","context":"drafting brief"},
  {"id":"T6","agent":"general-purpose","owns":[".planning/tasks/MF-0040/verify/D1-D2.md",".planning/tasks/MF-0040/verify/D3-D4.md"],"depends_on":["T2","T3","T4","T5"],"closes":["SC-9"],"done_when":"every FIX resolved by the orchestrator","context":"fresh context: item files + cached sources only"},
  {"id":"T7","agent":"inline","owns":[],"depends_on":["T2","T3","T4","T5"],"closes":["SC-8"],"done_when":"0 shared 12-grams","context":"scratch script, course page text in scratchpad"},
  {"id":"T8","agent":"inline","owns":[],"depends_on":["T6"],"closes":["SC-10","SC-11","SC-12"],"done_when":"read-backs pasted","context":"local stack only"},
  {"id":"T9","agent":"inline","owns":["docs/plan/subagents-validation.md"],"depends_on":["T2","T3","T4","T5"],"closes":["SC-13"],"done_when":"study order, ladder, signers, drift list, follow-ups","context":"docs/plan/ai-capabilities-validation.md as template"},
  {"id":"T10","agent":"inline","owns":[".planning/tasks/MF-0040/LOOP-VERIFY.md",".planning/evidence/MF-0040.md"],"depends_on":["T6","T7","T8","T9"],"closes":["SC-14"],"done_when":"receipt: no failure outside the baseline for the current tree","context":""}
]
```

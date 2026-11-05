# MF-0039 LOOP-PLAN (iteration 0)

## Discovery

- Precedent: MF-0037 (`packs/ai-capabilities/**`, same item shapes, same acceptance-test shape) and MF-0038.
- Item shapes: `packs/ai-capabilities/{questions,cards,diagrams}/D1.S1.yaml` (question: A–D options with
  `rationale` each, `source {title,url}`; card: `concept/simply/inNature/whereItBreaks[]/contrast/diagram/sources`;
  diagram: `direction/nodes[{id,label,shape?}]/edges[{from,to,label?}]/sources`).
- Loader: `src/engine/pack/load-pack.ts` (`loadPackFile`), `src/engine/content/load-content.ts`.
- Corpus: `pnpm generate:corpus --pack <slug>` caches each skill source into `.cache/corpus/` (refuses skilljar).
- Sync: `pnpm db:sync-keys` (validates every pack before writing). Seed: `pnpm dev:seed --pack <slug>` (MF-0034).
- Gates on these paths: frozen MF-0039 acceptance test; `pnpm check:packs` (cuckoos only; this pack has none).
- No frozen file elsewhere names `agent-skills`; no closed set widened → no re-freeze of other tickets.

## SC → steps

| SC | Step |
|---|---|
| SC-1 | T1 pack.yaml |
| SC-2…SC-7 | T3–T5 drafting, against T2 corpus |
| SC-8 | T7 12-word overlap check vs the saved lesson |
| SC-9 | T6 fresh-context verifier per domain group |
| SC-10, SC-11 | T8 sync-keys ×2, dev:seed once (approved) |
| SC-12 | T9 browser / HTTP check on :3001 |
| SC-13 | T10 guide doc |
| SC-14 | T11 full gate + receipt |

## Riskiest step

Exact Claude Code facts (field names, paths, who invokes, what loads when) drafted by an agent. Mitigation:
drafters read the cached `.md` of each cited page, every backticked token and absolute quantifier must occur in it,
and an independent verifier re-checks every item (SC-9). Re-run state: none owned (see GOAL).

## Rejected options

- One drafter for all 9 skills: too long a context, drift between early and late items. Three drafters by domain.
- Citing the course page: forbidden (CONTEXT.md Source).
- Citing `code.claude.com/docs/en/slash-commands`: serves the skills page; one URL per page.

```json tasks
[
  {"id":"T1","agent":"inline","owns":["packs/agent-skills/pack.yaml"],"depends_on":[],"closes":["SC-1"],"done_when":"SC-1 green"},
  {"id":"T2","agent":"inline","owns":[".cache/corpus/**"],"depends_on":["T1"],"closes":[],"done_when":"every source cached"},
  {"id":"T3","agent":"general-purpose","owns":["packs/agent-skills/{questions,cards,diagrams}/D1.S1.yaml","…/D2.S1.yaml","…/D2.S2.yaml"],"depends_on":["T2"],"closes":["SC-6"],"done_when":"files load"},
  {"id":"T4","agent":"general-purpose","owns":["…/D3.S1.yaml","…/D3.S2.yaml","…/D4.S1.yaml"],"depends_on":["T2"],"closes":["SC-7"],"done_when":"files load"},
  {"id":"T5","agent":"general-purpose","owns":["…/D5.S1.yaml","…/D6.S1.yaml","…/D6.S2.yaml"],"depends_on":["T2"],"closes":[],"done_when":"files load"},
  {"id":"T6","agent":"general-purpose","owns":[".planning/tasks/MF-0039/verify/**"],"depends_on":["T3","T4","T5"],"closes":["SC-9"],"done_when":"every finding fixed or answered"},
  {"id":"T7","agent":"inline","owns":[],"depends_on":["T6"],"closes":["SC-8"],"done_when":"0 overlaps"},
  {"id":"T8","agent":"inline","owns":[],"depends_on":["T6"],"closes":["SC-10","SC-11"],"done_when":"read-backs pasted"},
  {"id":"T9","agent":"inline","owns":[],"depends_on":["T8"],"closes":["SC-12"],"done_when":"screen observed"},
  {"id":"T10","agent":"inline","owns":["docs/plan/agent-skills-validation.md"],"depends_on":["T6"],"closes":["SC-13"],"done_when":"file written"},
  {"id":"T11","agent":"inline","owns":[".planning/tasks/MF-0039/LOOP-VERIFY.md",".planning/evidence/MF-0039.md"],"depends_on":["T7","T8","T9","T10"],"closes":["SC-2","SC-3","SC-4","SC-5","SC-14"],"done_when":"receipt PASS for current tree"}
]
```

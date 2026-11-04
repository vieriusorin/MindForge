# MF-0031 LOOP-PLAN (iteration 0)

## Discovery

- Packs are discovered by folder (`scripts/sync-question-keys.mjs` reads `packs/*/`), so a new pack needs no code.
- Loader: `loadPackFile` + `loadPackContent` (`src/engine/content/load-content.ts`) validate schemas, skill codes,
  pack-wide ids and card → diagram links. The loader does NOT check that a question's citation is in its skill's
  `sources`; SC-3 checks it for this pack.
- Item schemas are `strictObject`, so `level` must be added to question, card and diagram schemas + types.
- Grounding: all 15 source URLs are in `.cache/corpus/<sha256(url)>.json` (MF-0008 corpus), so items can be checked
  offline against the exact text they cite.
- Precedent: MF-0006 (card/diagram contract), MF-0014 (optional item field `generatedBy`).
- Concurrency: an MF-0016 session is editing `src/engine/content/{schema,types,load-content,index}.ts` in this
  worktree. MF-0031 hunks there are additive (`level`) and flagged in the hand-off.

## Steps

1. T1 `level` field: `src/engine/content/level.ts` (`ITEM_LEVELS`, `LevelSchema`), wired into the three schemas and
   the `Question`, `NatureCard`, `Diagram` types. Closes SC-2.
2. T2 `packs/prod-prompting/pack.yaml` per the Blueprint. Closes SC-1.
3. T3–T5 content, one fork per domain, in parallel: per skill `questions/<skill>.yaml` (6: q1–q2 foundation,
   q3–q4 practitioner, q5–q6 expert), `cards/<skill>.yaml` (1, foundation), `diagrams/<skill>.yaml` (1,
   practitioner), plus `.planning/tasks/MF-0031/grounding/<domain>.md` (item → supporting passage).
   Closes SC-3–SC-6.
4. T6 verification: three fresh-context agents, one per domain, check every item against the cached text it cites;
   fix findings. Closes SC-7.
5. T7 `pnpm db:sync-keys` twice, read back. Closes SC-8. T8 browser check. Closes SC-9.
6. T9 `docs/plan/prod-prompting-validation.md`. Closes SC-10. T10 gates + build. Closes SC-11.

## Riskiest step

T3–T5: plausible but wrong facts. Mitigation: grounding notes per item, and an independent verifier (T6) that did
not write the items. Re-run state: none kept on disk; key sync is idempotent; reviews are keyed by content hash.

## Rejected options

- Running the paid MF-0008/MF-0014 pipeline: needs the API key MF-0022 owns.
- A `level` table in the DB: ADR 0001 keeps content in files.
- Writing all 72 items in one context: the 15 source pages are ~1 MB of text; per-domain forks keep each one focused.

```json tasks
[
  {"id":"T1","agent":"service-builder","owns":["src/engine/content/level.ts","src/engine/content/schema.ts","src/engine/content/types.ts","src/engine/questions/schema.ts","src/engine/questions/types.ts"],"depends_on":[],"closes":["SC-2"],"done_when":"SC-2 green","context":"optional level on all item types"},
  {"id":"T2","agent":"service-builder","owns":["packs/prod-prompting/pack.yaml"],"depends_on":[],"closes":["SC-1"],"done_when":"SC-1 green","context":"Blueprint table"},
  {"id":"T3","agent":"fork","owns":["packs/prod-prompting/*/D1.*.yaml"],"depends_on":["T1","T2"],"closes":["SC-3","SC-4","SC-5","SC-6"],"done_when":"D1 items load","context":"domain D1"},
  {"id":"T4","agent":"fork","owns":["packs/prod-prompting/*/D2.*.yaml"],"depends_on":["T1","T2"],"closes":["SC-3","SC-4","SC-5","SC-6"],"done_when":"D2 items load","context":"domain D2"},
  {"id":"T5","agent":"fork","owns":["packs/prod-prompting/*/D3.*.yaml"],"depends_on":["T1","T2"],"closes":["SC-3","SC-4","SC-5","SC-6"],"done_when":"D3 items load","context":"domain D3"},
  {"id":"T6","agent":"general-purpose","owns":[".planning/tasks/MF-0031/verify/*"],"depends_on":["T3","T4","T5"],"closes":["SC-7"],"done_when":"every finding fixed or answered","context":"fresh context"},
  {"id":"T7","agent":"service-builder","owns":[],"depends_on":["T6"],"closes":["SC-8","SC-9"],"done_when":"read-back + browser","context":"local stack"},
  {"id":"T8","agent":"service-builder","owns":["docs/plan/prod-prompting-validation.md"],"depends_on":[],"closes":["SC-10"],"done_when":"file exists","context":"proof ladder"},
  {"id":"T9","agent":"verifier","owns":[],"depends_on":["T7","T8"],"closes":["SC-11"],"done_when":"receipt PASS","context":"gates"}
]
```

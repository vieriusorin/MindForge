---
ticket_id: MF-0010
iteration: 1
written: 2026-11-04
---

# LOOP-PLAN — MF-0010 Seed Planting

## Discovery

- Content engine (MF-0006): `src/engine/content/` — `PackContent {questions, cards, diagrams}`,
  `loadPackContent(pack, dir)` (fs, used by tests), `reviewStateOf`, `isPlayable`, `playableQuestions`.
  Only questions have a server read (`src/server/questions/get-pack-questions.ts`, `"use cache"` days).
  MF-0006 LOOP-PLAN:75 deferred `getPackContent` to this ticket.
- Review seam: `src/server/content/get-review-context.ts` (per-user, never cached).
- Grading: `src/server/attempts/grade-answer.ts` (MF-0009 C-3) → `record_attempt`; walk action is the
  precedent (`src/features/walk/actions.ts`).
- Walk: `src/app/(app)/play/[packSlug]/walk/page.tsx` + `features/walk/components/walk-session/`; the
  "new" slot is `reason === "new"` (`plan-walk.ts:91`), ≤ 1 per walk.
- Forest tiles: `features/forest/components/forest/forest.tsx`, rendered on `/groups/[groupId]` (own
  forest) and `/` (anonymous, no links). Not on `/today`.
- Sprout: `treeStage` → `sprout` at `successfulRecalls ≥ 1` (`tree-stage.ts:27`); no engine change.
- Mermaid 11.17 is installed (MF-0006). `themeCSS` is emitted **before** Mermaid's own rules and
  both get namespaced under `#<svgId>` (`mermaid.core.mjs:1140`, `compileCSS`), so overrides need
  `!important`. Tokens in `globals.css` are hex in `:root` and `.dark`.
- Shared answer helpers `toggleChoice`, `canSubmit`, `feedbackMessage` live in
  `walk-session/utils.ts`; Seed Planting is the second consumer in another feature → hoist to
  `src/components/question-card/utils.ts` (react-client-patterns rule 9). `AnswerWalkInput` likewise
  → `src/lib/answer-input.ts` (`AnswerInput`), walk's `schemas.ts` re-exports it under its old name.
- Gates: none beyond typecheck / lint / test / build (no `gate:*` scripts; no `ticket:*` scripts →
  default VERIFY/FREEZE per gsd-goal-loop).

## SC → steps

| SC | Steps | Proof |
|---|---|---|
| SC-1 | 3, 5, 6, 7 | browser `/play/ccdv-f/plant/D5.S1` |
| SC-2 | 4 | browser both themes + network list + page HTML `<script>` tags |
| SC-3 | 4 | frozen `mf-0010-diagram-figure.acceptance.test.tsx` + a11y snapshot |
| SC-4 | 5, 6, 7, 8 | browser + DB row count, local test user |
| SC-6 | 1 | frozen `mf-0010-seed-planting.acceptance.test.ts` |
| SC-7 | all | receipt |
| SC-8 | 9 | browser + walk `ui` test |

## Steps

1. **Engine** `src/engine/content/plan-seed-planting.ts`: `planSeedPlanting({content, review, skill})`.
   Rank = approved 0, unreviewed 1; unplayable dropped. Cards: rank, then id. Diagram: the card's
   linked diagram if playable, else skill diagrams by rank then id. Checks: playable questions of the
   skill, stable-sorted by rank (file order kept), first `SEED_CHECK_COUNT`.
   Plus `src/engine/content/plantable-skills.ts`: `plantableSkills({content, review})` → `Set<string>`
   of skills where the plan has a card, a diagram or a check; unit test.
2. **Hoists** (no behaviour change): walk utils → question-card utils (+ tests move); `AnswerInput`
   → `src/lib/answer-input.ts`.
3. **Server read** `src/server/content/get-pack-content.ts`: `"use cache"`, `cacheLife("days")`,
   `loadPackContent(getPack(slug), packs/<slug>)` (precedent `get-pack-questions.ts`).
4. **Diagram** (iteration 1, ADR 0003 — React Flow replaced Mermaid at the user's request):
   - Content format: `schema.ts` diagram = `direction`, `nodes[{id,label,shape?}]`, `edges[{from,to,label?}]`
     with duplicate-id / dangling-edge checks; both `packs/ccdv-f/diagrams/*.yaml` converted; `mermaid`
     dependency, `src/test/mermaid-check.ts` and `mf-0006-mermaid.acceptance.test.ts` removed.
   - `src/components/flow-diagram/` (`"use client"`): `utils.ts` `layoutDiagram` (dagre, `NODE_WIDTH`,
     `nodeHeight`) + test; `components/diagram-node.tsx` on the registry `BaseNode` (`tabIndex -1`), decision =
     violet tint; `flow-diagram.tsx` read-only `ReactFlow` (every interaction off), token CSS vars, aspect from
     the layout's extent.
   - `src/components/flow-diagram-lazy.tsx`: `next/dynamic(..., {ssr:false, loading: Skeleton})`.
   - `src/components/diagram-figure/`: `figure` named by `figcaption`; drawing `aria-hidden`; `sr-only` lists
     "Steps" and "Connections" (`connectionSentences` in `utils.ts` + test).
5. **Feature** `src/features/seed-planting/`:
   - `components/nature-card/` (presentational, server-safe): concept heading; Simply; In nature;
     Where it breaks (always-open `ul`); Contrast; Why the name (optional); Sources (external links).
     Props `Pick<NatureCard, …>` without `author` (PII).
   - `components/seed-primer/`: nature card (if any) + `DiagramFigure` (if any); used by page + walk.
   - `components/seed-checks/` (`"use client"`): checks with `QuestionCard`, hook
     `use-seed-checks.ts` (`useMutation(answerSeedCheck)`, focus + live region as the walk), utils
     `plantingOutcome({wasSeed, correctCount, total})` → `"sprouted" | "still-seed" | "recorded"`
     + test; `ui` test for submit → feedback → finish message.
   - `actions.ts` `answerSeedCheck` (auth → `AnswerInput.safeParse` → `gradeAnswer` → result);
     `types.ts`.
6. **Page** `src/app/(app)/play/[packSlug]/plant/[skill]/page.tsx` (+ `error.tsx`): Suspense slot;
   auth redirect; pack/skill validated (`notFound`); `Promise.all(getPack, getPackContent,
   getReviewContext, listMyAttempts)`; `planSeedPlanting`; `wasSeed` from `treeStage` of
   `memoryBySkill`; header (pack name / skill name); `SeedPrimer`; `SeedChecks` (playable DTOs via
   `toPlayableQuestion`). Nothing to plant at all → a plain Card saying so.
7. **Forest tiles**: `ForestProps.plantHrefs?: Readonly<Record<string, string>>`; a seed tile with an
   href gets a `Button asChild` `Link` "Plant this seed". Group page builds hrefs from
   `plantableSkills` ∩ seed trees.
8. Browser proofs SC-1/2/3/4 on the local stack, both themes; DB row count for the test user.
9. **Walk slot (SC-8)**: `WalkSessionProps.newSeedPrimer?: ReactNode`; the walk page renders
   `SeedPrimer` for the new step's skill and passes it; the view shows it above the `QuestionCard`
   only when `reason === "new"`. Walk `ui` test gains one case.

## Riskiest step

Step 4: the layout (node heights are estimated before React measures them, so long labels may
overflow) and the `ssr:false` split keeping React Flow out of the initial JS. Both are browser-only
proofs; fallback for overflow: measure with React Flow's `useNodesInitialized` and re-run dagre.

## Rejected options

- Rendering Mermaid on the server (needs a DOM/headless browser; the constraint says client).
- (iteration 1) Keeping Mermaid text and parsing it into a graph for React Flow: a hand-written parser
  for a subset, two sources of truth for the Diagram Builder (user chose the graph format).
- Re-rendering per theme as the primary approach: more moving parts than CSS variables.
- Reusing `answerWalkQuestion` from the seed feature: a cross-feature action import.
- Padding checks from other skills (user, C-3). Full 3-check step inside the walk (user, C-4).
- Linking every forest tile (re-plant is allowed by URL, but the link promises a first encounter).

```json tasks
[
  {"id":"T1","agent":"service-builder","owns":["src/engine/content/plan-seed-planting.ts","src/engine/content/plantable-skills.ts","src/engine/content/index.ts","src/engine/content/types.ts","src/engine/content/__tests__/plantable-skills.test.ts"],"depends_on":[],"closes":["SC-6"],"done_when":"frozen SC-6 file green; plantable-skills test green","context":"Step 1"},
  {"id":"T2","agent":"service-builder","owns":["src/server/content/get-pack-content.ts","src/lib/answer-input.ts","src/features/walk/schemas.ts","src/components/question-card/utils.ts","src/components/question-card/__tests__/utils.test.ts","src/features/walk/components/walk-session/utils.ts","src/features/walk/components/walk-session/__tests__/utils.test.ts","src/features/walk/components/walk-session/hooks/use-walk-session.ts"],"depends_on":[],"closes":[],"done_when":"existing tests green after hoists","context":"Steps 2-3"},
  {"id":"T3","agent":"ui-builder","owns":["src/components/flow-diagram/**","src/components/flow-diagram-lazy.tsx","src/components/diagram-figure/**","src/components/ui/base-node.tsx","src/engine/content/schema.ts","packs/*/diagrams/**","docs/adr/0003-diagrams-as-graphs-react-flow.md"],"depends_on":[],"closes":["SC-2","SC-3"],"done_when":"frozen SC-3 file green; browser both themes","context":"Step 4"},
  {"id":"T4","agent":"ui-builder","owns":["src/features/seed-planting/**","src/app/(app)/play/[packSlug]/plant/**"],"depends_on":["T1","T2","T3"],"closes":["SC-1"],"done_when":"page renders D5.S1 card+diagram+checks","context":"Steps 5-6"},
  {"id":"T5","agent":"ui-builder","owns":["src/features/forest/components/forest/**","src/app/(app)/groups/[groupId]/page.tsx"],"depends_on":["T1","T4"],"closes":["SC-4"],"done_when":"seed tile links; sprout after a correct check (browser + DB)","context":"Steps 7-8"},
  {"id":"T6","agent":"ui-builder","owns":["src/features/walk/components/walk-session/**","src/app/(app)/play/[packSlug]/walk/page.tsx"],"depends_on":["T4"],"closes":["SC-8"],"done_when":"walk ui test case green; browser shows primer on the new slot","context":"Step 9"},
  {"id":"T7","agent":"verifier","owns":[],"depends_on":["T1","T2","T3","T4","T5","T6"],"closes":["SC-7"],"done_when":"typecheck, lint, test, build pass; receipt for current tree","context":"Stage 4"}
]
```

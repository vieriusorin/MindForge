# MF-0006 — LOOP-PLAN (iteration 0)

Tier: normal (pure engine + content files + one server stub; no schema, no RLS). Proceeds without
a plan approval checkpoint.

## Discovery summary

- `src/engine/questions/schema.ts:18` — `status: z.enum(["official","unreviewed"])` is the only
  place the field is defined; `types.ts` (Question + PlayableQuestion), `playable.ts:8` copy it.
- Readers of `status`: `duel-session.tsx:134-137` (badge), MF-0003 frozen
  `mf-0003-questions.acceptance.test.ts:27,86,110-111,130`, inner tests `schema.test.ts:23`,
  `select.test.ts:23`. `scripts/sync-question-keys.mjs` never reads it (keys only) — unaffected.
- `parseQuestionFiles` (`load-questions.ts:19`) already reports `<file>: <path>: <msg>`; the
  content loader reuses that shape and adds cross-type id uniqueness.
- Duel: `play/[packSlug]/duel/page.tsx:23` reads pack + questions + attempts, then
  `pickSessionQuestions`. Questions passed in are only *candidates* (`select.ts:46`); memory comes
  from attempts, so filtering candidates by review state can't change a forest figure.
- Duel action `features/duel/actions.ts:32` grades any question of the pack.
- MF-0001 SC-4: engine source must not mention a pack slug (`ccdv`, `team-onboarding`).
- Mermaid (spike, GOAL C-1): only `mermaid.parse` under a jsdom window validates flowcharts.
- No `ticket:*` scripts: skill-default VERIFY/FREEZE/EVAL (see LOOP-VERIFY.md).

## SC coverage

| SC | Steps | Proof |
|---|---|---|
| SC-1 | 2, 3 | frozen `mf-0006-content` SC-1 |
| SC-2 | 2, 3, 6 | frozen `mf-0006-content` SC-2 + `mf-0006-mermaid` |
| SC-3 | 1, 3, 4 | frozen SC-3 ×2 + re-frozen MF-0003 file |
| SC-4 | 3 | frozen SC-4 |
| SC-5 | 2 | frozen SC-5 |
| SC-6 | 3, 5 | frozen SC-6 |
| SC-8 | 2, 7 | frozen SC-8 + duel page/action wiring (typecheck + build) |
| SC-7 | 8 | receipt: typecheck, lint, test, build; MF-0001/0003 frozen suites green |

## Steps

1. **Question origin/author** — `src/engine/questions/{schema,types,playable}.ts`: replace `status`
   with `origin: official|human|ai` + `author?` (email; required for human/ai, forbidden for
   official); a present `status` key fails at `questions.N.status` with "renamed to origin".
   `PlayableQuestion` gets `origin`, **not** `author`. Same commit: rename-only re-freeze of
   `mf-0003-questions.acceptance.test.ts` (C-2) + FROZEN.json history; inner tests' fixtures.
2. **Content engine** — `src/engine/content/{schema,hash,review}.ts`: card + diagram zod schemas
   (whereItBreaks ≥1 trimmed non-empty; sources ≥1 https; mermaid first token ∈ flowchart, graph,
   sequenceDiagram, stateDiagram, stateDiagram-v2, mindmap); `contentHash` = sha256 of
   key-sorted JSON via `node:crypto`; `emptyReviewContext` / `reviewStateOf` / `isPlayable`.
3. **Loader** — `load-content.ts`: one pass collecting issues over questions → diagrams → cards;
   pack-wide id map across types; unknown skill; card → missing diagram. `parseQuestionFiles` is
   rebuilt on a shared collector so its own behaviour (and MF-0003 SC-1) is unchanged.
   `PackContent.questions: Question[]`; `ContentQuestion` alias removed once Question has origin.
4. **Migrate 53 questions** — `packs/ccdv-f/questions/*.yaml`: `status: official` →
   `origin: official`; `status: unreviewed` → `origin: ai` + `author: sorinvieriu@gmail.com` (later changed to `vlad.parvana@ddroidd.com` at the user's request).
5. **Content files** — `packs/ccdv-f/cards/D5.S1.yaml` (Temperature, §2.4 verbatim),
   `packs/ccdv-f/diagrams/D5.S1.yaml` (§2.4 flowchart), `packs/ccdv-f/diagrams/D1.S3.yaml` (§2.5
   bee loop), `nodes` from each flowchart. Pack: `exam.date: 2026-12-07`, optional per-skill
   `sources` in the schema.
6. **Mermaid check** — `mermaid` added as a dependency (MF-0010 renders it); `src/test/mermaid-check.ts`
   parses each diagram, collects failures as `<id>: <first line>`, throws once.
7. **Review seam wiring** — `src/server/content/get-review-context.ts` returns the empty context;
   duel page filters candidates with `isPlayable(reviewStateOf(ctx, q), "practice")`; duel action
   refuses a non-playable question; badge reads `origin`.
8. **Verify** — typecheck, lint, `pnpm test`, `pnpm build`; evidence.

## Riskiest step

Step 1 + its re-freeze: it edits a frozen contract of another ticket. Guard: the diff of
`mf-0003-questions.acceptance.test.ts` must contain only the `status`→`origin` rename (and the
fixture's `author` line); every DTO-key and rationale assertion stays byte-identical.

## Rejected options

- Mermaid parsing in the engine/loader with jsdom at runtime — puts a DOM into the server (user, C-1).
- `@mermaid-js/parser` — has no flowchart grammar (spike).
- Keeping a derived `status` in the DTO — two names for one idea (user, C-2).
- A `getPackContent` server read now — no SC needs cards on a screen yet; MF-0010 adds it.
- Wiring `getReviewContext` into `replayMemory` — replay reads attempts, not items; an empty
  context is a no-op there and MF-0007 owns what "spoiled" does to memory. SC-8's "replay" is met
  by the duel page + duel action (the only two places items are served/graded). Flagged in hand-off.

## Tasks

```json tasks
[
  { "id": "T1", "title": "question origin/author + MF-0003 rename re-freeze", "agent": "inline",
    "owns": ["src/engine/questions/**", "src/engine/memory/__tests__/select.test.ts", ".planning/tasks/MF-0003/FROZEN.json"],
    "depends_on": [], "closes": ["SC-3"],
    "done_when": ["pnpm typecheck", "pnpm exec vitest run --project unit src/engine/questions"], "context": ["skill:typescript-strict"] },
  { "id": "T2", "title": "content schemas, hash, review seam, loader", "agent": "inline",
    "owns": ["src/engine/content/**", "src/engine/pack/schema.ts"],
    "depends_on": ["T1"], "closes": ["SC-1", "SC-2", "SC-4", "SC-5", "SC-8"],
    "done_when": ["pnpm exec vitest run --project unit src/engine/content/__tests__/mf-0006-content.acceptance.test.ts -t 'SC-1|SC-2|SC-4|SC-5'"], "context": [] },
  { "id": "T3", "title": "migrate 53 questions; ship card + 2 diagrams; exam.date", "agent": "inline",
    "owns": ["packs/ccdv-f/**"],
    "depends_on": ["T2"], "closes": ["SC-3", "SC-6"],
    "done_when": ["pnpm exec vitest run --project unit src/engine"], "context": [] },
  { "id": "T4", "title": "mermaid dependency + test-time check", "agent": "inline",
    "owns": ["src/test/mermaid-check.ts", "package.json", "pnpm-lock.yaml"],
    "depends_on": ["T3"], "closes": ["SC-2"],
    "done_when": ["pnpm exec vitest run --project unit src/engine/content"], "context": [] },
  { "id": "T5", "title": "getReviewContext + duel wiring + origin badge", "agent": "inline",
    "owns": ["src/server/content/**", "src/app/(app)/play/[packSlug]/duel/page.tsx", "src/features/duel/**"],
    "depends_on": ["T2"], "closes": ["SC-8"],
    "done_when": ["pnpm typecheck", "pnpm build"], "context": ["skill:nextjs-data"] },
  { "id": "T6", "title": "verify + evidence", "agent": "inline",
    "owns": [".planning/tasks/MF-0006/**", ".planning/evidence/MF-0006.md"],
    "depends_on": ["T1", "T2", "T3", "T4", "T5"], "closes": ["SC-7"],
    "done_when": ["receipt PASS for the current tree"], "context": [] }
]
```

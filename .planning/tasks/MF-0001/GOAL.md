---
ticket_id: MF-0001
tier: normal                      # no schema, no auth, no money; pure engine + static page
stage: handoff
branch: main
builds_on: []
last_iteration: 1
goal_status: complete-pending-manual-commit
---

## Objective

Today the repository holds only a spec (`docs/MINDFORGE.md`). Nothing runs, and the central product
claim — *a pack-agnostic engine where the forest reflects measured memory* — is untested.

End state: a Next.js 16 app whose home page renders the **CCDV-F Knowledge Forest** from a
**pack file**, not from code: 8 regions (domains) with their blueprint weights and 25 seed trees
(skills). The pack format is schema-validated, a second non-exam pack loads through the same loader
with zero engine changes (spec G6), and the pure function that maps a skill's memory state to a
tree stage exists with oracle tests. This is the walking skeleton every later slice (DB, auth, FSRS,
AI writers, game modes) plugs into.

Maps to spec slices **B1 (scaffold, minus auth)**, **B2 (pack format + loader + CCDV-F pack)**,
part of **B6 (forest model, pure)**, and **B9 (second pack)**.

## Affected

- **Roles:** none yet (no auth). Anonymous viewer sees the forest.
- **Surfaces:** `.claude/hooks/**`, `.claude/settings.json`; `/` page; `src/engine/pack/*` (schema + loader); `src/engine/forest/*` (stage
  model); `packs/ccdv-f/pack.yaml`; `packs/<second>/pack.yaml`.

## Constraints

- Engine is pack-agnostic (spec §1.2 principle 4) → `src/engine/**` must not mention any pack slug; enforced by a check in SC-4.
- Game state = memory state (spec §1.2 principle 1) → the stage function takes only measured inputs (stability, retrievability, recall/Feynman/storm flags); no time-in-app inputs exist in its signature.
- Exam facts are not invented → every weight in `packs/ccdv-f/pack.yaml` is copied from the Exam Guide v1.0 §6; the pack records the guide as its source.
- Next.js 16 has breaking changes (AGENTS.md) → read `node_modules/next/dist/docs/` before writing pages.
- TypeScript strict, no `any`, no `enum` (typescript-strict skill).

## Decided without a question

- Package manager **pnpm**, Next.js **16.4.x** App Router, Tailwind, **Vitest**, **Zod** for pack validation, **YAML** for packs — spec §2.8 / §3.2 and the installed toolchain (pnpm 12.3.4, node 24.20).
- Skill codes are assigned by us (`D<domain>.S<n>`, in Exam Guide order); the guide gives names only.
- Tree stage thresholds = spec §2.2 table, verbatim: seed (never recalled) · sprout (≥1 successful recall) · sapling (stability ≥ 3 d) · tree (stability ≥ 14 d AND Feynman passed) · ancient (stability ≥ 45 d AND storm survived); `wilting` is an overlay when retrievability < 0.85 for any stage above seed. "Never dies" → no stage below seed.
- Weight tolerance for sum checks: ±0.05 (the guide rounds to one decimal).
- Forest page is a simple SVG/CSS grid (spec §1.8: animations later).

## Success Criteria

- [x] SC-1: Loading `packs/ccdv-f/pack.yaml` returns 8 domains and 25 skills; domain weights sum to 100.0 (±0.05); each domain's skill weights sum to that domain's weight (±0.05); domain 2 "Applications and Integration" has weight 33.1 and 6 skills. Proof: acceptance test `src/engine/pack/__tests__/mf-0001-pack.acceptance.test.ts`.
- [x] SC-2: The loader rejects an invalid pack with an error naming the offending path for each of: missing skill weight, duplicate skill code, skill weights not summing to the domain weight. Proof: same acceptance file, 3 cases with inline fixtures.
- [x] SC-3: A second pack (`packs/team-onboarding-sample/pack.yaml`, kind `onboarding`, 2 domains, 5 skills, no exam meta) loads through the same loader. Proof: acceptance test.
- [x] SC-4: `src/engine/**` contains no pack slug (`ccdv`, `team-onboarding`). Proof: acceptance test that greps the engine directory.
- [x] SC-5: `treeStage(state)` returns the spec §2.2 stage for literal cases: no state → seed; 1 recall, stability 1 → sprout; stability 3 → sapling; stability 14 without Feynman → sapling; stability 14 with Feynman → tree; stability 45 with Feynman, no storm → tree; stability 45 + Feynman + storm → ancient; and `wilting: true` when retrievability 0.84 on a sapling, `false` at 0.85, never on a seed. Proof: acceptance test `src/engine/forest/__tests__/mf-0001-stage.acceptance.test.ts`.
- [x] SC-6: `/` renders the CCDV-F forest: 8 region headings with name + weight %, 25 seed tiles each showing the skill name and weight. Proof: browser check (chrome-devtools snapshot, counts pasted) on `pnpm dev`.
- [x] SC-7: typecheck, lint, full test suite green; `pnpm build` succeeds; evidence file written. Proof: VERIFY receipt.
- [x] SC-8: The `.claude/` hooks copied from P4T work in this repo: every hook command in `.claude/settings.json` exits 0 with no stderr on a sample input and imports no path missing from the repo; the Stop gate runs this repo's typecheck / biome / vitest (no test-DB lock, no `env-run`); rule digests in `inject-rule-context.mjs` describe MindForge paths (`src/engine`, `packs`, `src/app`) instead of P4T ones. Proof: `scripts/check-hooks.mjs` run log pasted in LOOP-VERIFY.

## Concerns

| # | Collision | Owner | Status |
|---|-----------|-------|--------|
| C-1 | `.claude/` hooks were copied from P4T and import scripts absent here. | user | resolved 2026-11-02: adapt to MindForge inside MF-0001 (SC-8) |
| C-2 | Spec ❓Q-1 (Supabase vs Drizzle+Turso) is unresolved. This ticket avoids it by having no DB; the next ticket (auth + schema, high-risk) cannot start without it. | user | open (not blocking MF-0001) |
| C-3 | Second pack content (spec ❓Q-7 open). | user | resolved 2026-11-02: placeholder "Team onboarding sample" pack |

## Out of Scope

- Database, auth, groups, invites (next ticket MF-0002, high-risk, needs ❓Q-1).
- FSRS scheduling and persistence (MF-0003). Only the pure stage mapping is here.
- AI writers, docs corpus, questions, cards, diagrams (later tickets).
- Any game mode; visual polish of the forest (❓Q-9).
- Deployment / hosting (❓Q-3).

## Open questions

- none blocking. C-2 carried to MF-0002.

## Iteration Log

<!-- append-only -->

### Iteration 1

```yaml
phase: 1-complete
verdict: PASS
started_at: "2026-11-02"
completed_at: "2026-11-02"
```

**Result:** PASS: SC-1..SC-8. SC-1's literal was corrected from 27 to 25 skills with the user's approval (spec counting error; the Exam Guide lists 25). The frozen files were re-formatted with the user's approval.
**Suggested commit message:** `MF-0001 feat: walking skeleton: pack format + CCDV-F pack, tree-stage engine, seed forest page, hooks adapted to MindForge`

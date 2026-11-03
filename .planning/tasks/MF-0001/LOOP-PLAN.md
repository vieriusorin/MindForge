---
phase: 1-planning
ticket_id: MF-0001
status: executing
verdict: IN_PROGRESS
started_at: "2026-11-02"
resume_with: /gsd-goal-loop
---

# Loop Plan — Iteration 1

## Discovery summary

- Greenfield. Scaffold from `create-next-app@16.4.4` (`--ts --tailwind --biome --app --src-dir --cache-components`): Next 16.4.4, React 19.3, Biome 2.4.2, Cache Components + Partial Prefetching on (`next.config.ts`). Added zod 4.6.7, yaml 2.9.1, vitest 5.0.5. `typecheck` = `next typegen && tsc --noEmit` (needed for the global `LayoutProps` type, `src/app/layout.tsx:20`).
- Next 16 docs (`node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md`): uncached async work outside `<Suspense>` blocks the route. Pack files are static → a data-level `"use cache"` + `cacheLife` read keeps `/` in the static shell.
- No precedent ticket. Hooks in `.claude/` are copied from P4T: `stop-gate.mjs:31` imports `scripts/lib/test-db-lock.mjs`, `lib/agent-scopes.mjs:13` and `retro-trigger.mjs:15` import `scripts/lib/ticket-eval.mjs`, and `settings.json` SessionEnd calls `scripts/session-metrics.mjs`. None of these exist. `stop-gate.mjs` also runs `scripts/env-run.mjs`.
- Gates: none defined (`gate:*` absent). VERIFY has no script → default receipt (typecheck, lint, test, build + `git diff HEAD | shasum -a 256`). Note: the repo has one commit and most files are untracked, so the receipt also hashes `git ls-files -o --exclude-standard` contents.

## SC coverage

| SC | Steps | Proof |
|----|-------|-------|
| SC-1 | 1, 2, 3 | frozen `src/engine/pack/__tests__/mf-0001-pack.acceptance.test.ts` SC-1 |
| SC-2 | 1, 2 | same file SC-2a/b/c + inner `load-pack.test.ts` |
| SC-3 | 4 | same file SC-3 |
| SC-4 | 1, 2 | same file SC-4 |
| SC-5 | 5 | frozen `src/engine/forest/__tests__/mf-0001-stage.acceptance.test.ts` |
| SC-6 | 6, 7 | browser snapshot of `/` on `pnpm dev`: 8 region headings, 25 tiles |
| SC-7 | all | receipt in LOOP-VERIFY.md |
| SC-8 | 8, 9 | `node scripts/check-hooks.mjs` log |

## Steps

1. `src/engine/pack/schema.ts`: Zod schema (`slug`, `name`, `kind` ∈ exam|course|onboarding, `version`, optional `source`, optional `exam`, `domains[].skills[]`, weights > 0) with `superRefine`: unique domain codes, unique skill codes across the pack (issue path = the duplicate's `domains.i.skills.j.code`), Σ skill weights = domain weight ±0.05 (path `domains.i.skills`), Σ domain weights = 100 ±0.05 (path `domains`). `types.ts` stays the hand-written interface; the schema is checked against it with `satisfies z.ZodType<Pack>`.
2. `src/engine/pack/load-pack.ts`: `parsePack` = `YAML.parse` → `safeParse` → throws `PackValidationError` whose message lists `path: message` per issue; `loadPackFile` = `readFile` + `parsePack`. Inner test `src/engine/pack/__tests__/load-pack.test.ts`: YAML syntax error → PackValidationError; domain sum ≠ 100 → path `domains`; duplicate domain code.
3. `packs/ccdv-f/pack.yaml`: 8 domains / 25 skills, names and weights copied from Exam Guide v1.0 §6, codes `D<n>.S<m>` in guide order, one-line descriptions from the guide, `exam: {code: CCDV-F, questions: 53, minutes: 120, passScaled: 720, scaleMin: 100, scaleMax: 1000}`, `source` = the guide.
4. `packs/team-onboarding-sample/pack.yaml`: kind onboarding, 2 domains (60/40), 5 skills, no exam.
5. `src/engine/forest/tree-stage.ts`: implement spec §2.2. Rules in order: `null` or `successfulRecalls < 1` → seed (never wilting); ancient if stability ≥ 45 ∧ feynman ∧ storm; tree if stability ≥ 14 ∧ feynman; sapling if stability ≥ 3; else sprout. `wilting = stage ≠ seed ∧ retrievability < 0.85`. Thresholds as one exported `as const` object.
6. `src/server/packs/get-pack.ts`: `getPack(slug)` with `"use cache"` + `cacheLife("days")`, reads `packs/<slug>/pack.yaml` from `process.cwd()`. `next.config.ts`: `outputFileTracingIncludes: { "/": ["./packs/**/*"] }` so the files ship with a deployment.
7. `src/app/page.tsx` (container: reads the pack, passes data) + `src/features/forest/components/forest/` (`forest.tsx` presentational, `types.ts`, `utils.ts` formatting weights, `index.ts`): one `<section>` per domain with `<h2>` "<name> · <weight>%", a grid of tiles each showing 🌰, the skill name and "<weight>%". Every tile is a seed because there's no memory yet: the page calls `treeStage(null)`, so the engine decides the stage, not the UI. Replace scaffold `page.tsx` content, keep `layout.tsx` and set metadata title "MindForge".
8. Hooks: add `.claude/hooks/lib/util.mjs` (`globToRegExp`, `frontmatter`) and point `agent-scopes.mjs` and `retro-trigger.mjs` at it. `stop-gate.mjs`: drop the test-db-lock import and `env-run`, run `vitest` directly, run eslint only if installed, rename the off switch to `MF_STOP_GATE` (P4T name still honoured). `settings.json`: remove the SessionEnd `session-metrics` hook and rename the status messages. `inject-rule-context.mjs`: replace the P4T rules with MindForge digests (`src/app` pages under Cache Components, `src/engine` pure + pack-agnostic, `packs/*.yaml` sourced facts, tests). `agent-scopes.mjs`: add `src/engine/**`, `src/server/**`, `packs/**` to service-builder, and `src/features/**` to ui-builder.
9. `scripts/check-hooks.mjs`: for each command in `settings.json` hooks, run it with a sample JSON stdin; assert exit 0, empty stderr, and that every relative import in `.claude/hooks/**` resolves to an existing file.

## Riskiest step

Step 8: editing the Stop gate can turn a red into a green without anyone noticing, or block every turn. Guard: `check-hooks.mjs` proves the hooks load and exit 0, and one deliberate type error in a scratch `.ts` is run through the adapted stop-gate's typecheck branch by hand to see it go RED (logged in LOOP-VERIFY). There are no write gates in this ticket: no DB, no actions.

## Rejected options

- JSON packs instead of YAML: harder for non-developers to write by hand and to review in PRs.
- Putting the CCDV-F blueprint in TS constants: violates the pack-agnostic principle (G6).
- Rendering the forest with a client canvas now: the spec says a simple SVG/CSS grid first (§1.8). No client JS is needed.
- Deleting the P4T hooks: the user chose to adapt them.

## Verify

- Default VERIFY (no script): `pnpm typecheck` · `pnpm lint` · `pnpm test` · `pnpm build` + tree hash → receipt line in LOOP-VERIFY.md
- EVAL by hand: graph acyclic, every SC closed, frozen hashes unchanged
- browser: `/` on `pnpm dev`, anonymous: 8 `h2`, 25 tiles

## Tasks — the graph the orchestrator dispatches; exactly one block

```json tasks
[
  { "id": "T1", "title": "pack schema + loader + inner tests", "agent": "inline",
    "owns": ["src/engine/pack/**"], "depends_on": [], "closes": ["SC-2", "SC-4"],
    "done_when": ["pnpm vitest run src/engine/pack", "pnpm typecheck"], "context": ["skill:typescript-strict"] },
  { "id": "T2", "title": "CCDV-F + sample packs", "agent": "inline",
    "owns": ["packs/**"], "depends_on": ["T1"], "closes": ["SC-1", "SC-3"],
    "done_when": ["pnpm vitest run src/engine/pack"], "context": ["docs/MINDFORGE.md §1.3"] },
  { "id": "T3", "title": "tree stage", "agent": "inline",
    "owns": ["src/engine/forest/**"], "depends_on": [], "closes": ["SC-5"],
    "done_when": ["pnpm vitest run src/engine/forest"], "context": ["docs/MINDFORGE.md §2.2"] },
  { "id": "T4", "title": "forest page", "agent": "inline",
    "owns": ["src/server/packs/**", "src/app/**", "src/features/forest/**", "next.config.ts"],
    "depends_on": ["T2", "T3"], "closes": ["SC-6"],
    "done_when": ["pnpm build", "browser: / shows 8 regions, 25 seeds"], "context": ["skill:nextjs-data", "skill:react-client-patterns"] },
  { "id": "T5", "title": "adapt hooks", "agent": "inline",
    "owns": [".claude/hooks/**", ".claude/settings.json", "scripts/check-hooks.mjs"],
    "depends_on": [], "closes": ["SC-8"],
    "done_when": ["node scripts/check-hooks.mjs"], "context": [] },
  { "id": "T6", "title": "verify + evidence", "agent": "inline",
    "owns": [".planning/tasks/MF-0001/**", ".planning/evidence/MF-0001.md"],
    "depends_on": ["T1", "T2", "T3", "T4", "T5"], "closes": ["SC-7"],
    "done_when": ["pnpm typecheck && pnpm lint && pnpm test && pnpm build"], "context": [] }
]
```

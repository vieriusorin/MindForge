---
phase: 1-planning
ticket_id: MF-0016
status: executing
verdict: IN_PROGRESS
started_at: "2026-11-04"
resume_with: /gsd-goal-loop MF-0016
---

# Loop Plan — Iteration 1

## Discovery summary

- **Item kinds** live in `src/engine/content/`: `schema.ts` (zod per kind), `load-content.ts`
  `parseContent` (pack-wide id `claim`, questions → diagrams → cards), `readPackFiles` (dirs
  `questions|cards|diagrams`), `item-hashes.ts` (raw-YAML hash = the sync's hash), `find-item.ts`
  (`PackItem` union, `itemTitle(s)`, `itemSkillCode`). Precedent: MF-0014 added `generatedBy` to cards
  and diagrams the same way; MF-0007 added the registry.
- **Grading** (`supabase/migrations/20261103083446_mf0003_attempts.sql`): `record_attempt(id, text[])`
  looks up `private.question_keys` by id, bounds option ids to 1–8 chars, set-equality grade, inserts
  `attempts` with pack/skill from the key. A cuckoo key `['<flawLine>']` needs **no change** here.
- **Registry** (`…mf0007_reviews.sql:34`): `item_type check in ('question','card','diagram')` → the one
  migration. `review_states` / `list_reviewable` are type-agnostic except the card-only analogy rule
  (`item_type <> 'card'`), which leaves cuckoos on the plain two-approver rule.
- **Sync** (`scripts/sync-question-keys.mjs`): `readKeys` reads `questions/` only; `ITEM_KINDS` lists
  three kinds; it validates with the app's loader first (MF-0012), so a cuckoo schema error blocks the
  whole sync.
- **Mode precedent:** the Duel — `src/app/(app)/play/[packSlug]/duel/page.tsx` (auth, `isPlayable`,
  `countableAttempts`, `pickSessionQuestions`, `toPlayableQuestion`), `src/server/attempts/grade-answer.ts`
  (shared grading), `src/features/duel/{actions,types}.ts`, `components/duel-session/` (hook with
  `useMutation`, `isInFlight` ref, focus refs, `status` live region; MF-0012 acceptance shape).
- **Session picker** `src/engine/memory/select.ts` + `least-recently-seen.ts` are typed on `Question`
  but only use `id`/`skillCode`.
- **Review UI** `src/features/review/components/review-item/` dispatches on `PackItem.kind`
  (`item-body.tsx`, `KIND_LABEL`); stubbed for `cuckoo` at freeze.
- **Shared-contract consumers:** `mf-0003-attempts.db.acceptance.test.ts` SC-5 counts
  `question_keys` per question (K-3 re-freeze, T3). `PackContent` literals in frozen MF-0010/0014 tests
  → `cuckoos` is optional on `PackContent`. Dev seed (`src/dev-seed/load-seed-inputs.ts`) builds items
  from questions/cards/diagrams only, so cuckoos are not seeded (fine; out of scope).
- **Gates on touched paths:** `pnpm lint` (biome), MF-0005 grants test (`mf-0005-grants.db.acceptance`,
  a new migration must not grant on `private`), the Stop hook's fast gate.

## SC coverage

| SC | Steps | Proof |
|----|-------|-------|
| SC-1 | 2 | `mf-0016-cuckoo.acceptance.test.ts` SC-1 ×10 |
| SC-2 | 1, 3 | `mf-0016-cuckoo-keys.db.acceptance.test.ts` (×3) |
| SC-3 | 2, 5 | acceptance SC-3 + `curl` of signed-in `/play/ccdv-f/cuckoo` HTML |
| SC-4 | 2, 4 | acceptance SC-4 ×10 |
| SC-5 | 2 | `mf-0016-session.acceptance.test.ts` ×4 + existing Duel tests |
| SC-6 | 5 | `mf-0016-cuckoo-session.acceptance.test.tsx` ×5 |
| SC-7 | 5, 6, 7 | browser on :3001 + `attempts` read-back + `/today` |
| SC-8 | 6 | `mf-0016-cuckoo-content.acceptance.test.ts` |
| SC-9 | 2, 5 | acceptance SC-9 + browser `/review/ccdv-f` approve + flag |
| SC-10 | 7 | receipt: typecheck, lint, test, test:db, build |

## Steps

1. **Migration** `supabase/migrations/20261104120000_mf0016_cuckoo_items.sql`: `alter table private.items
   drop constraint items_item_type_check, add constraint items_item_type_check check (item_type in
   ('question','card','diagram','cuckoo'));` (constraint name read from the local DB first). No grants
   change. Apply locally with `supabase migration up`. `pnpm db:types` is a no-op (private schema).
2. **Engine** (`src/engine/content/`):
   - `schema.ts`: `CuckooSchema` (strictObject: `id` ItemId, `title`, `origin`/`author`/`generatedBy` +
     refines, `snippetKind` enum, `lines` `string[]` 3–20, `flawLine` int ≥ 1, `flawKind` enum,
     `explanation` non-empty, `sources` https ≥ 1) + `superRefine`: `flawLine ≤ lines.length` and the line
     is non-blank (path `flawLine`). `CuckooFileSchema { skill, cuckoos[] ≥ 1 }`.
   - `load-content.ts`: read `cuckoos/` in `readPackFiles`; `parseContent` claims cuckoo ids after cards
     and returns `cuckoos`. `item-hashes.ts`: include `cuckoos`.
   - `playable-cuckoo.ts`: explicit field pick (never spread). `check-cuckoo-answer.ts`: order
     not-in-pack → withdrawn (`!isPlayable(state,"practice")`) → changed (`fileHash !== sentHash`) →
     invalid-line (`!Number.isInteger(line) || line < 1 || line > lines.length`) → ok.
   - `find-item.ts`: cuckoo branch in `findPackItem`, `itemTitles` adds `content.cuckoos ?? []`,
     `itemSkillCode` unchanged (`.skill`).
   - `src/engine/memory/select.ts`: `pickSessionItems<T extends SessionItem>` holds the rule;
     `pickSessionQuestions` delegates to it; `least-recently-seen.ts` generic over `SessionItem`.
   - Inner tests: `__tests__/item-hashes.test.ts` (cuckoo hash), `find-item.test.ts` (itemTitles).
3. **Sync** `scripts/sync-question-keys.mjs`: `readKeys` also reads `cuckoos/` → `correct_options:
   [String(c.flawLine)]`; `ITEM_KINDS` adds `{ kind: "cuckoos", type: "cuckoo" }`. Then K-3: change the
   MF-0003 SC-5 count to questions + cuckoos, re-hash, append to `MF-0003/FROZEN.json` `history`
   (reason: "MF-0016 K-3, user-approved 2026-11-04: cuckoo keys share question_keys").
4. **Server + action**:
   - `src/server/attempts/grade-cuckoo.ts` (`server-only`): `getPackContent` + `getItemHashes` +
     `getReviewContext` → `checkCuckooAnswer` → `rpc("record_attempt", { p_question_id, p_chosen:
     [String(line)] })` → `{ correct, flawLine, flawKind, explanation }`; `not-gradable` on RPC error.
   - `src/features/cuckoo/schemas.ts`: `CuckooAnswerInput` strictObject `{ packSlug, cuckooId (1–128),
     line int 1–20, contentHash (1–128) }`.
   - `src/features/cuckoo/actions.ts` `answerCuckoo(input: unknown)`: `getCurrentUser` → `safeParse` →
     `gradeCuckoo` → `ActionResult`, messages per error (edge table wording).
5. **UI**:
   - `src/features/cuckoo/components/cuckoo-session/`: `hooks/use-cuckoo-session.ts` (Duel hook shape:
     `useMutation(answerCuckoo)`, `isInFlight` ref, focus refs, `choose(line)`, `submit`, `next`),
     `utils.ts` (`verdictMessage(feedback)`, `FLAW_KIND_LABEL` as const satisfies Record, `canCheck`) +
     `__tests__/utils.test.ts`, view `cuckoo-session.tsx`, children `components/snippet-lines.tsx`
     (shadcn `RadioGroup`; each item `id=line-n`, label "Line n" + the line text in `<code>`; after
     grading a `Badge` "Cuckoo" on the flawed line), `components/cuckoo-feedback.tsx`, finish screen.
   - `src/app/(app)/play/[packSlug]/cuckoo/page.tsx` (+ `error.tsx`): Duel page shape; filters
     `content.cuckoos` by `isPlayable(..., "practice")`, `countableAttempts`, `pickSessionItems`,
     `toPlayableCuckoo(c, hashes[c.id])`; empty state when none.
   - Sidebar: "Spot the Cuckoo" entry (lucide `Bird`, tooltip) in the Play group; `cuckooHref` passed from
     `src/app/(app)/layout.tsx` like `duelHref` (BUILD divergence: layout not in the first owns list).
   - `src/components/question-card/index.ts` exports `originBadge` (reused for the origin badge).
   - Review: `review-item/components/cuckoo-body.tsx` (numbered lines, flaw line, kind, explanation,
     sources) replaces the stub; `KIND_LABEL.cuckoo`.
6. **Content** `packs/ccdv-f/cuckoos/{D6.S1,D6.S2,D6.S3,D7.S1,D7.S2,D7.S3,D7.S4}.yaml`, 2 each (14),
   `origin: ai`, `author: sorin.vieriu@ddroidd.com`, `generatedBy: { model: claude-opus-5-5, prompt:
   mf0016-hand-session }`, sources copied from the skill's `sources` in pack.yaml. Then
   `pnpm db:sync-keys` (local).
7. **Verify**: full ladder (`verification.md`), `pnpm test:db`, `pnpm build`, browser on :3001.

## Riskiest step

**Step 4/5 — the key leaking or a stale page being graded.** The page holds full `Cuckoo` objects
server-side (`getPackContent`); only `toPlayableCuckoo` output may cross into `CuckooSession`.
Caught by: SC-3 exact-shape test (an extra key fails `toEqual`) and a signed-in `curl` of the HTML
(RSC payload included) grepping for each served cuckoo's `explanation` and `"flawLine"`.

**Version binding (C-4).** The answer names `contentHash`; `checkCuckooAnswer` refuses `changed` when it
differs from the deployed file's hash (SC-4 test). Residual: the DB key can lag the deployed file
between deploy and sync (K-4, raised at plan approval).

**UI predicates that gate a write, and the server refusal behind each:**

| UI predicate | Bypass | Server refusal | Test |
|---|---|---|---|
| Check answer disabled until a line is picked | direct action call with no/invalid line | `CuckooAnswerInput` zod + `invalid-line` | SC-4 `invalid-line` ×3 |
| item shown only if playable | stale tab after a flag | `withdrawn` in `checkCuckooAnswer` | SC-4 flagged/rejected |
| page rendered from version X | deploy between load and answer | `changed` | SC-4 `changed` |
| disabled while pending + `isInFlight` ref | direct second call / two concurrent requests | **none**: each call records an attempt, exactly as the Duel and Walk do today | K-5 (raised at plan approval) |

## Rejected options

- **`item_type='question'` for cuckoos.** No migration, but the registry would mislabel the kind. Rejected by the user (K-1).
- **`private.cuckoo_keys` + a second grading function.** Duplicates the security-definer grading path. Rejected by the user (K-3).
- **Cuckoos as `Question` with options "1".."n".** Re-uses the question card, but `stem`/`rationale` per option don't fit, and options would need line text duplicated. It also breaks the "snippet as code block" constraint (C-3).
- **Registry-hash check in the action.** Needs a new public RPC to read `private.items.content_hash`; deferred to K-4's follow-up.

## Verify

- VERIFY by hand (no `ticket:verify` script in package.json): typecheck, lint, test, test:db, build;
  receipt = outputs + `git diff HEAD | shasum -a 256` (+ untracked files) in LOOP-VERIFY.md.
- EVAL: `scripts/lib/ticket-eval.mjs` checks, by hand where no CLI exists.
- browser: `/play/ccdv-f/cuckoo` signed in as a dev-seed learner. Play 5 → finish screen; `attempts` rows
  with D6/D7 codes; `/today` stage/memory change; `/review/ccdv-f` shows a cuckoo; approve + flag.
- fresh-context `diff-reviewer` (high-risk).

All tasks are executed inline by the orchestrator in this session. `agent` names the role scope.

```json tasks
[
  { "id": "T1", "title": "migration: item_type += cuckoo", "agent": "schema-builder",
    "owns": ["supabase/migrations/20261104120000_mf0016_cuckoo_items.sql"],
    "depends_on": [], "closes": ["SC-2"],
    "done_when": ["supabase migration up (local)", "pnpm test:db src/server/db/__tests__/mf-0005-grants.db.acceptance.test.ts"],
    "context": ["skill:supabase", "skill:supabase-postgres-best-practices"] },
  { "id": "T2", "title": "engine: cuckoo schema, loader, playable, grading decision, picker", "agent": "service-builder",
    "owns": ["src/engine/content/**", "src/engine/memory/**"],
    "depends_on": [], "closes": ["SC-1", "SC-3", "SC-4", "SC-5", "SC-9"],
    "done_when": ["pnpm exec vitest run src/engine", "pnpm typecheck"],
    "context": ["skill:typescript-strict", "skill:tdd"] },
  { "id": "T3", "title": "sync cuckoo keys + registry; MF-0003 SC-5 re-freeze (K-3)", "agent": "service-builder",
    "owns": ["scripts/sync-question-keys.mjs", "src/server/db/__tests__/mf-0003-attempts.db.acceptance.test.ts", ".planning/tasks/MF-0003/FROZEN.json"],
    "depends_on": ["T1", "T2"], "closes": ["SC-2"],
    "done_when": ["pnpm test:db src/server/db/__tests__/mf-0016-cuckoo-keys.db.acceptance.test.ts src/server/db/__tests__/mf-0003-attempts.db.acceptance.test.ts"],
    "context": ["grep -rln question_keys src scripts"] },
  { "id": "T4", "title": "server grading + answerCuckoo action", "agent": "service-builder",
    "owns": ["src/server/attempts/grade-cuckoo.ts", "src/features/cuckoo/actions.ts", "src/features/cuckoo/schemas.ts", "src/features/cuckoo/types.ts", "src/server/content/get-pack-content.ts"],
    "depends_on": ["T2"], "closes": ["SC-4"],
    "done_when": ["pnpm typecheck", "pnpm lint"],
    "context": ["skill:nextjs-data", "skill:forms-rhf-zod"] },
  { "id": "T5", "title": "play screen, route, sidebar, review body", "agent": "ui-builder",
    "owns": ["src/features/cuckoo/components/**", "src/app/(app)/play/[packSlug]/cuckoo/**", "src/features/app-shell/components/app-sidebar/**", "src/app/(app)/layout.tsx", "src/components/question-card/index.ts", "src/features/review/components/review-item/**"],
    "depends_on": ["T4"], "closes": ["SC-6", "SC-7", "SC-9"],
    "done_when": ["pnpm exec vitest run src/features/cuckoo", "pnpm build"],
    "context": ["skill:server-client-components", "skill:client-data-tanstack-query", "skill:ui-shadcn", "skill:react-client-patterns", "skill:accessibility"] },
  { "id": "T6", "title": "14 cuckoos for D6/D7", "agent": "service-builder",
    "owns": ["packs/ccdv-f/cuckoos/**"],
    "depends_on": ["T2"], "closes": ["SC-8"],
    "done_when": ["pnpm exec vitest run src/engine/content/__tests__/mf-0016-cuckoo-content.acceptance.test.ts", "pnpm db:sync-keys"],
    "context": ["packs/ccdv-f/pack.yaml D6/D7 sources"] },
  { "id": "T7", "title": "verify ladder, browser, receipt", "agent": "service-builder",
    "owns": [".planning/tasks/MF-0016/**", ".planning/evidence/MF-0016.md"],
    "depends_on": ["T3", "T5", "T6"], "closes": ["SC-7", "SC-10"],
    "done_when": ["pnpm typecheck && pnpm lint && pnpm test && pnpm test:db && pnpm build"],
    "context": ["references/verification.md"] }
]
```

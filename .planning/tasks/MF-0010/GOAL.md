---
ticket_id: MF-0010
tier: normal                      # UI + read of file content; no schema
stage: handoff
branch: feat/MF-0010
builds_on: []
last_iteration: 2
goal_status: complete-pending-manual-commit
track: G                          # seat Coder D
week: W2
depends_on: [MF-0006]
---

> Drafted 2026-11-03 from the planning grill (Q7, Q11). Needed for the Nov 15 release gate.
> SCs are proposals; the claimant confirms and freezes them. Claimed 2026-11-04 (Coder D seat, this
> session); SCs refined in DESIGN, every change listed under "Decided without a question".

## Objective

Today a new skill is met cold, with an exam question. The product promise is "associate before you
memorise": a nature card, a diagram, then a few quick checks.

End state: **Seed Planting.** From a seed tile ("Plant this seed") or the walk's new-skill slot, the
learner sees the skill's best nature card (approved first, then unreviewed), its diagram (a graph drawn
with React Flow, ADR 0003), then 3 quick-check questions from that skill. A correct check gives the first sprout.

## Affected

- **Roles:** learner.
- **Surfaces:** `src/features/seed-planting/**` (shared component, embedded by MF-0009), `src/components/{diagram-figure,flow-diagram}` + `flow-diagram-lazy.tsx`; content format (ADR 0003): `src/engine/content/schema.ts`, `packs/*/diagrams/*.yaml`, `src/app/(app)/play/[packSlug]/plant/[skill]/page.tsx`, forest seed tiles.

## Constraints

- shadcn + tokens only; the diagram follows the theme (light and dark) without per-component `dark:` overrides.
- The diagram renderer (React Flow, ADR 0003; Mermaid until 2026-11-04) is loaded lazily on the client (`*-lazy.tsx` exemption), never in the initial bundle.
- A diagram always has a text alternative (its node list / title) for screen readers (ui-design §5).
- "Where it breaks" is always visible, never collapsed (accuracy over entertainment).
- Quick checks are normal attempts via `record_attempt`.

## Decided without a question

- Card choice per skill: approved first, then unreviewed, then by item id; flagged/rejected never shown (CONTEXT.md Playable).
- A skill without any card skips straight to its diagram, or to the checks if it has neither.
- 3 checks, approved questions first.
- Diagram choice: the chosen card's `diagram` link when that diagram is playable; otherwise the skill's own best
  playable diagram by the same order (D1.S3 has a diagram and no card: it shows the diagram, then checks).
- One pure engine function owns the whole choice (card, diagram, checks) so the page, the walk slot and the test
  read the same decision (code-conventions: figures and decisions from `src/engine/**`). Checks are the skill's
  playable questions, approved first, then pack-file order (precedent: `playableQuestions` keeps order).
- Sprout = `treeStage` already returns `sprout` at the first successful recall (`tree-stage.ts:27`); this ticket
  adds no reward rule. Game honesty (MINDFORGE §4): the sprout comes only from a DB-graded correct attempt.
- Checks grade through the shared `gradeAnswer` (`src/server/attempts/grade-answer.ts`, MF-0009 C-3) behind a
  thin `seed-planting/actions.ts` action; no new grading path, no schema change.
- Card and diagram files are read on the server by a new cacheable read (identical for everyone, versioned with
  the code, precedent `getPackQuestions`); review state still comes only through `getReviewContext` (per-user,
  never cached).
- Forest tiles render only on `/groups/[groupId]` (the learner's own forest) and the public landing page
  (anonymous). "Plant this seed" goes on seed-stage tiles of the group page only; the landing page has no user.
  A tile links only when the skill has something to plant (a playable card, diagram or question).
- The plant page works for any skill of the pack (re-reading a card is harmless); only seed tiles link to it.
- Diagram theming: React Flow nodes are the shadcn-registry `BaseNode` on `bg-card`/`bg-secondary`, edges use
  `--xy-edge-stroke: var(--muted-foreground)`; the tokens switch light/dark, no `dark:` override (ui-design §2).
- Text alternative (SC-3): a `figure` whose caption is the diagram title, the drawing hidden from AT and
  non-focusable, and two lists for screen readers: the steps (node labels) and every connection in words.
- Baseline at DESIGN (2026-11-04, this branch): `pnpm typecheck` 0, `pnpm lint` 0, `pnpm test` 36 files / 133
  tests pass. No proof needs `db:reset` or `supabase stop/start`: SC-4 writes attempts for a dedicated local
  test user only.
- Hosted target check (read-only, 2026-11-04): `vercel project ls` lists no MindForge project; `supabase projects
  list` lists only `p4t-staging`. The hosted release gate cannot be proved from this ticket (see C-2).

## Success Criteria

- [x] SC-1: `/play/ccdv-f/plant/D5.S1` shows the Temperature card (simply, in nature, every "where it breaks"
  line visible without interaction, contrast, sources as links) and its diagram, then the checks. Proof: browser
  on the local stack.
- [x] SC-2: The diagram (React Flow, ADR 0003) renders client-side and is readable in light and dark; React Flow's
  code is not in the initial JS of `/today` or of the plant page (it loads only after hydration, through
  `flow-diagram-lazy.tsx`). Proof: browser in both themes + the plant page HTML's `<script>` chunks contain no
  React Flow code, and `/today`'s none either. *(amended 2026-11-04, user: React Flow replaces Mermaid)*
- [x] SC-3: The diagram exposes its title, every node label and every connection (in words, with its label) to
  assistive tech; the drawing itself is hidden from it. Proof: frozen `ui` acceptance test + a11y snapshot in the
  browser. *(amended 2026-11-04 with the format change)*
- [x] SC-4: On the local stack, a seed-stage skill's tile on the group page says "Plant this seed"; answering its
  checks with ≥ 1 correct records one attempt per check (row count grows by the number of checks) and the tile
  shows a sprout afterwards. With 0 correct it stays a seed. Proof: browser + DB row count, dedicated test user.
- [ ] ~~SC-5~~: moved to MF-0020 (C-2).
- [x] SC-6: Choosing what to plant is one pure function with a frozen test: approved card > unreviewed card >
  none, ties by id, flagged/rejected never chosen; diagram from the card's link, else the skill's best playable
  diagram; ≤ 3 checks, approved first, never flagged/rejected. Proof:
  `src/engine/content/__tests__/mf-0010-seed-planting.acceptance.test.ts`.
- [x] SC-7: Component-split rules, typecheck, lint, tests, build pass. Proof: receipt in LOOP-VERIFY.md.
- [x] SC-8: The walk's "new" slot shows the skill's card and diagram before its question (MF-0009 C-1: this
  ticket merges second, so it wires the slot). Proof: browser on the local stack + the walk's `ui` test.

## Constraints → how met

- shadcn + tokens only → Card/Badge/Separator/Button; diagram nodes on the registry `BaseNode` (added with the shadcn CLI).
- Renderer lazy → `flow-diagram-lazy.tsx` (`next/dynamic`, `ssr: false`) sibling of `flow-diagram/`; SC-2 chunk proof.
- Text alternative → SC-3.
- "Where it breaks" always visible → SC-1 (plain list, no accordion/collapsible).
- Checks are normal attempts → shared `gradeAnswer` → `record_attempt`; SC-4 row count.

## Concerns

| # | Collision | Owner | Status |
|---|-----------|-------|--------|
| C-1 | Only 1–3 skills have cards before MF-0014 / H-2; the gate needs 3 planted seeds, so H-2 must deliver ≥ 3 cards by Nov 13. | Coder F | moved to MF-0020 with the release gate (2026-11-04); does not block this ticket (a skill without a card still plants). |
| C-2 | Draft SC-5 (release gate on the hosted URL) needs a hosted MindForge project that does not exist (2026-11-04 check above) and MF-0004's manual deploy steps. | user | resolved 2026-11-04 (user): SC-5 moves to reserved **MF-0020**, user-owned, runbook as deliverable. |
| C-3 | "3 quick checks", but 22 of 25 skills have 2 questions (D5.S1 and D1.S3 included); only D2.S3, D7.S1, D8.S3 have 3. | user | resolved 2026-11-04 (user): **up to 3** — every playable question of the skill, capped at 3; no padding from other skills. |
| C-4 | The walk's "new" slot is one question (MF-0009 SC-3: rows grow by the walk length). Seed Planting is card → diagram → 3 checks. Embedding the full step changes the walk's length. | user | resolved 2026-11-04 (user): the slot shows **card + diagram above its one walk question**; walk length and attempt count stay as MF-0009 defined them. |

## Out of Scope

- Diagram Builder (after Dec 7), illustrated scenes, animations.

## Decided by the user (DESIGN checkpoint, 2026-11-04)

- C-2 → SC-5 to reserved MF-0020. C-3 → up to 3 checks. C-4 → walk slot = card + diagram + its one question.
- Freeze SC-6 (engine) and SC-3 (`ui`) acceptance tests now; SC-1, SC-2, SC-4, SC-8 keep browser proof.
- No proof wipes or restarts shared local state (no `db:reset`, `supabase stop/start`).
- 2026-11-04, mid-BUILD: **diagrams switch from Mermaid to React Flow, stored as graphs** (user: "do it now and
  update documentation … update tasks also"; then chose the graph format over parsing Mermaid). Recorded in
  ADR 0003. The user approved editing MF-0006's frozen diagram tests (re-freeze + retirement of the Mermaid
  check, MF-0006 FROZEN.json history); MF-0010's two frozen files follow the same decision (FROZEN.json
  history). SC-2 and SC-3 amended. Docs updated: CONTEXT.md, MINDFORGE.md §2.5, ROADMAP, KICKOFF, ui-design
  rule, CLAUDE.md; MF-0014 GOAL (writer output + verifier check).

## Open questions

- none.

## Iteration Log

<!-- append-only -->
- 2026-11-04 · intake→design · Claimed (Coder D seat). Refined SCs; user resolved C-2 (SC-5 → MF-0020), C-3 (up
  to 3 checks), C-4 (walk slot = card + diagram + its one question). Froze 2 files red (15 tests, `not
  implemented`). → plan → build.
- 2026-11-04 · build · Plan change (iteration 0 → 1): user switched diagrams to React Flow + graph format (ADR
  0003). Mermaid renderer removed; content format, 2 pack diagrams, MF-0006 + MF-0010 frozen tests re-frozen with
  recorded reasons, each new assertion seen red. LOOP-PLAN T3 rewritten.
- 2026-11-06 · build→verify→handoff · All of T1–T6 were already on `main` (5f706e2 and later); this pass ran T7 and the
  browser proofs on a seeded local stack (prod build for SC-2). Two defects found and fixed: (1) edge labels drew as black
  boxes in dark mode: Tailwind 4 reads `_` in an arbitrary variant as a space, so `[&_.react-flow__edge-text]` matched
  nothing (escaped `\_\_` in `flow-diagram.tsx`; browser proof both themes); (2) React Flow's attribution link stayed
  focusable inside the `aria-hidden` drawing (SC-3 "non-focusable"): the wrapper is now `inert`, new ui test seen red
  first. Added the walk `ui` test case SC-8 named. Receipt: LOOP-VERIFY.md § "Receipt 2026-11-06".

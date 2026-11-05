---
ticket_id: MF-0016
tier: high-risk                   # was normal; a migration widens private.items.item_type (HIGH_RISK: schema)
stage: handoff
branch: feat/MF-0016
builds_on: [MF-0003, MF-0006, MF-0007, MF-0009, MF-0012, MF-0014]
last_iteration: 0
goal_status: complete-pending-manual-commit
track: G                          # seat Coder C
week: W4 (stretch: only if W3 is green; ahead of MF-0017)
depends_on: [MF-0006]
---

> Drafted 2026-11-03 from the planning grill (Q14). DESIGN pass 2026-11-04 (this session): SCs
> rewritten against the code; checkpoint questions listed under Concerns.

## Objective

Security & Safety is 8.1% of the exam and is about spotting what's wrong in realistic text. No mode
trains that today.

End state: **Spot the Cuckoo.** The learner sees a short snippet (a prompt, a tool result, a config
or a hook), picks the line that holds the planted flaw (an injected instruction, a false claim, an
unsafe setting, an exposed secret), and then sees why. It is a question variant: the options are
line numbers, graded by the DB through the same `record_attempt` and feeding the same FSRS replay.

## Affected

- **Roles:** learner (plays), reviewer (reviews a new item type), content maintainer (resolves flags).
- **Surfaces:**
  - engine: `src/engine/content/` (cuckoo schema, loader, `findPackItem`/`itemTitle`, playable DTO),
    `src/engine/memory/select.ts` (session picker generalised over item type)
  - content: `packs/ccdv-f/cuckoos/<skill>.yaml`
  - DB: migration widening `private.items.item_type` to include `cuckoo`; `scripts/sync-question-keys.mjs`
    (keys + registry for cuckoos)
  - server: `src/server/attempts/` (cuckoo grading), `src/server/content/get-pack-content.ts`
  - UI: `src/features/cuckoo/**`, route `/play/[packSlug]/cuckoo`, sidebar Play entry,
    `src/features/review/components/review-item/components/cuckoo-body.tsx`

## Constraints

- C-1 Same item rules as every item: origin, author, content hash, review state, playable filter (CONTEXT.md Item, Playable).
- C-2 The key (flawed line, flaw kind, explanation) never reaches the browser before the DB graded the answer.
- C-3 Snippets are shown as inert text (React text nodes inside `<code>`, whitespace preserved), never as HTML (`dangerouslySetInnerHTML` is forbidden). Wording aligned at review (finding 5): one radio per line rules out a single `<pre>` block.
- C-4 An attempt records a judgement on versioned content: the answer names the content hash the learner read, and grading refuses when it differs from the deployed file's hash (gsd-goal-loop DESIGN rule, MF-0007 retro). The registry hash is not readable by the app without a new RPC; see K-4.
- C-5 Every item cites one of its skill's sources (CONTEXT.md Citation).

### Constraints → how met

| Constraint | How met | Proof |
|---|---|---|
| C-1 | cuckoos join `PackContent`, the pack-wide id check, `itemHashes`, the registry (`item_type='cuckoo'`) and `isPlayable(..., "practice")` on serve and on grade | SC-1, SC-2, SC-4 |
| C-2 | `toPlayableCuckoo` strips `flawLine`, `flawKind`, `explanation`, `author`, `generatedBy`; feedback only from the action after `record_attempt` returns | SC-3 |
| C-3 | lines rendered as text children; a fixture line `<script>alert(1)</script>` shows literally | SC-6 (ui test) |
| C-4 | `answerCuckoo` input carries `contentHash`; a pure `checkCuckooAnswer` refuses `changed` when it ≠ the deployed file hash | SC-4 |
| C-5 | content acceptance test: every cuckoo's `sources` ⊆ its skill's `sources` | SC-8 |

## Decided without a question

- **Item kind, not a question.** A cuckoo has its own file kind (`cuckoos/`), schema and review body; it
  shares the *grading* path with questions (`question_keys`, `record_attempt`, `attempts`). Source: the
  GOAL's "question variant: options are line numbers, graded by the DB"; CONTEXT.md Item lists kinds.
- **No change to `record_attempt` or `question_keys`.** A cuckoo key row is `correct_options = ['<flawLine>']`;
  the function bounds option ids to 1–8 chars, which a line number fits. Ids are pack-wide unique across
  item types (`parseContent` claim), so `question_id` cannot collide. Source: mf0003 migration.
- **Line ids are 1-based decimal strings** (`"1"`…`"20"`), validated by a separate `CuckooAnswerInput`;
  `AnswerInput` (`^[A-Z]$`) is untouched.
- **Snippet shape:** `lines: string[]`, 3–20 lines; blank lines allowed; `flawLine` must point at a
  non-blank line. `snippetKind ∈ {prompt, tool-result, config, hook}` (the four in the Objective).
  `flawKind ∈ {injected-instruction, false-claim, unsafe-setting, exposed-secret}` (`exposed-secret`
  added for D7.S4 Identity, Secrets and Key Management).
- **Session picking** reuses the Duel's rule (MF-0003/0009): one item per skill for the 5 skills with the
  highest `weight × (1 − retrievability)`, least recently seen within a skill. `pickSessionQuestions`
  is generalised to any `{ id, skillCode }` item; the Duel's behaviour and tests are unchanged.
- **Feedback:** after grading, show the verdict, highlight the flawed line with the word "Cuckoo" (not
  colour alone), the flaw kind in words, and the explanation. No per-line rationale (Out of Scope).
- **Attempts feed FSRS like any question** (grow trees): `countableAttempts` is keyed by item id already.
- **Spoiling** (reviewing shows the key) applies to cuckoos unchanged: `spoiledAt` is keyed by item id.
- **Content count:** "≥ 2 per skill in D6 and D7" (Decided in the 2026-11-03 draft) = 7 skills × 2 = **14**,
  which supersedes the draft's SC-4 "≥ 10".
- **Route** `/play/[packSlug]/cuckoo`, sidebar Play group entry "Spot the Cuckoo" (lucide `Bird`).
- Preflight (2026-11-04): `pnpm typecheck` OK, `pnpm lint` OK, `pnpm test` 73 files / 286 tests green.
  No proof needs `db:reset` / `supabase stop|start`: the migration is applied with `supabase migration up`
  and the sync DB test copies the real packs into a temp dir (MF-0012 precedent), so nothing is unregistered.

## Edge inputs (session + grading)

| Input state | Shown result | Decided by |
|---|---|---|
| pack has no cuckoo file | `/play/<slug>/cuckoo` shows "No cuckoos to spot in this pack yet" + link back to Today; no round | agent (mirrors Duel empty) |
| cuckoos exist, all flagged/rejected | same empty state | CONTEXT.md Playable |
| 1–4 playable skills with cuckoos | a shorter round (one per skill); finish screen counts what was played | Duel rule |
| ≥ 5 playable skills | 5 cuckoos | Duel rule |
| item flagged between load and answer | "This cuckoo was withdrawn for review. Start a new round." No attempt | MF-0006 SC-8 |
| deployed file hash ≠ sent hash | "This cuckoo changed since you opened it. Start a new round." No attempt | C-4 |
| no key row synced | "Not available for grading yet. Ask an admin to sync the answer keys." | MF-0009 wording |
| line id 0, > line count, or non-numeric | refused by zod / `checkCuckooAnswer` as invalid; no attempt | agent |

## Success Criteria

- [x] SC-1: **Schema.** `parseContent` loads `cuckoos/<skill>.yaml` (`skill`, `cuckoos[]` of `id`, `title`,
  `snippetKind`, `lines`, `flawLine`, `flawKind`, `explanation`, `origin`, `author?`, `generatedBy?`, `sources`).
  It rejects: `flawLine` 0, `flawLine` > `lines.length`, `flawLine` on a blank line, fewer than 3 or more than
  20 lines, an unknown `flawKind`/`snippetKind`, a non-https source, and an id already used by any other item.
  Proof: `src/engine/content/__tests__/mf-0016-cuckoo-schema.acceptance.test.ts`.
- [x] SC-2: **Keys + registry.** `pnpm db:sync-keys` writes, for each cuckoo, `private.question_keys`
  (`correct_options = ['<flawLine>']`, skill from the file) and `private.items` (`item_type = 'cuckoo'`,
  its content hash); removing the cuckoo from the files deletes both rows. `record_attempt(<id>, ['<flawLine>'])`
  returns true, another line returns false, and the attempt row's `skill_code` is the cuckoo's skill.
  Proof: `src/server/db/__tests__/mf-0016-cuckoo-keys.db.acceptance.test.ts` (local stack, temp copy of packs).
- [x] SC-3: **No key before answering.** `toPlayableCuckoo` returns only `id`, `skillCode`, `origin`, `title`,
  `snippetKind`, `lines`, `contentHash`. Proof: acceptance unit test; plus `curl` of the served
  `/play/ccdv-f/cuckoo` HTML (signed in) contains no served cuckoo's `explanation` and no `flawLine`.
- [x] SC-4: **Grading decision.** `checkCuckooAnswer` (pure) returns `not-in-pack`, `withdrawn`
  (flagged/rejected), `changed` (sent hash ≠ deployed file hash), `invalid-line`
  (outside 1…lines.length), else `ok`; `answerCuckoo` calls `record_attempt` only on `ok` and then returns
  `{ correct, flawLine, flawKind, explanation }`. Proof: acceptance unit test of `checkCuckooAnswer`
  (one `it` per row of the edge table's grading rows).
- [x] SC-5: **Session.** The cuckoo round picks one playable cuckoo per skill for up to 5 skills by the Duel
  rule; 0 playable → empty state. The Duel's picks for the same input are unchanged.
  Proof: engine acceptance test (cuckoo + question fixtures) + existing Duel tests green.
- [x] SC-6: **Play screen.** Lines are numbered and choosable with a RadioGroup (keyboard + accessible name
  "Line n"); Check answer is disabled until a line is picked and while pending; the answer sends
  `{ packSlug, cuckooId, line, contentHash }`; the verdict is announced in a `status` region and focused —
  "Correct! You spotted the cuckoo." or "Not quite. The cuckoo was on line <n>."; the flawed line is then
  marked with the word "Cuckoo", the flaw kind is shown in words ("Injected instruction", "False claim",
  "Unsafe setting", "Exposed secret") with the explanation; a server error's message is shown; a line
  `<script>alert(1)</script>` renders as literal text and adds no `<script>` element.
  Proof: `src/features/cuckoo/components/cuckoo-session/__tests__/` ui tests (valid answer, wrong answer,
  server error, pending/disabled, literal text).
- [x] SC-7: **Playable end to end.** On the local stack, a signed-in learner plays a 5-cuckoo round at
  `/play/ccdv-f/cuckoo` from the sidebar, 5 `attempts` rows land with D6/D7 skill codes, and `/today` shows
  the change in those skills' trees. Proof: browser + DB read-back.
- [x] SC-8: **Content.** `packs/ccdv-f/cuckoos/` holds ≥ 2 valid cuckoos for each of D6.S1–S3 and D7.S1–S4
  (≥ 14), each citing one of its skill's sources. Proof: `mf-0016-cuckoo-content.acceptance.test.ts`
  (loader count per skill + citation check).
- [x] SC-9: **Review.** A cuckoo appears in `/review/ccdv-f` and renders with its numbered lines, flaw line,
  flaw kind and explanation; approving and flagging it work. Proof: unit test for `findPackItem`/`itemTitle`
  on a cuckoo + browser.
- [x] SC-10: **Receipt.** Component split rules, `pnpm typecheck && pnpm lint && pnpm test && pnpm test:db &&
  pnpm build` pass on the final tree. Proof: LOOP-VERIFY receipt.

## Decided by the user (2026-11-04 checkpoint)

- K-1 → **migrate**: add `cuckoo` to `private.items.item_type`; tier high-risk (plan approval + fresh-context review).
- K-2 → **Claude drafts** the ≥ 14 cuckoos as `origin: ai`, `author: sorin.vieriu@ddroidd.com`, `generatedBy: { model: claude-opus-5-5, prompt: mf0016-hand-session }`; unreviewed until two non-authors approve.
- K-3 → **re-freeze MF-0003 SC-5**: `mf-0003-attempts.db.acceptance.test.ts` counts `question_keys` rows per question; it is changed to count questions + cuckoos (intent: "sync copies every key"), reason recorded in `MF-0003/FROZEN.json` `history`. Done in the BUILD task that changes the sync, never to get green otherwise.
- K-4 → **accept** for MF-0016 (answer bound to the deployed file hash); follow-up reserved as **MF-0032** (bind `record_attempt` to `content_hash`).
- K-5 → **accept parity** with the Duel/Walk (no server-side repeat refusal); noted in the hand-off.
- Plan approved by the user 2026-11-04 (high-risk checkpoint).
- No proof needs a reset or stack restart (preflight above); nothing to approve there.

## Concerns

- K-1 (owner: user) **Tier / migration.** A `cuckoo` registry type needs one migration (widen the
  `private.items.item_type` check). That makes the ticket high-risk (plan approval + fresh-context review).
  Alternative: register cuckoos as `item_type='question'` — no migration, but the registry lies about the
  kind and the review page cannot tell which body to render. Recommended: migrate.
- K-2 (owner: user) **Who writes the 14 cuckoos.** Recommended: this session drafts them as `origin: ai`,
  `author: <your sign-in email>` (the person who ran the generation, CONTEXT.md Author), `generatedBy:
  { model: claude-opus-5-5, prompt: mf0016-hand-session }`. They are then *unreviewed* (playable with a
  badge) until two non-author reviewers approve. Alternative: you write them (`origin: human`).

- K-4 (owner: user, raised at plan approval) **Key lag.** If `db:sync-keys` runs before or after the deploy
  that changed a cuckoo's `flawLine`, the DB grades against the other version for that window. Questions
  have the same gap today (keys carry no hash). Proposed: accept for MF-0016 (runbook order: deploy, then
  sync) and reserve a follow-up ticket to bind `record_attempt` to `content_hash`.

- K-5 (owner: user, raised at plan approval) **Repeat answers.** Nothing server-side stops a second
  `answerCuckoo` call for the same cuckoo (a direct call or two concurrent requests): each records an
  attempt, as the Duel and Walk do today. Proposed: accept parity for MF-0016.

## Out of Scope

- Multi-flaw snippets, free-text explanations, per-line rationales.
- Cuckoos inside the Duel, Walk, Seed Planting or storms.
- A CuckooWriter prompt in the MF-0008 pipeline (later ticket).
- Binding content hashes for ordinary question attempts (MF-0024 territory).

## Open questions

- none (K-1, K-2 resolved).

## Iteration Log

<!-- append-only -->
- 2026-11-04 DESIGN: SCs rewritten against the code (10 SCs); tier raised to high-risk (migration); checkpoint: K-1 migrate, K-2 Claude drafts as ai. SCs frozen.
- 2026-11-04 FREEZE: 5 acceptance files frozen RED (FROZEN.json); LOOP-PLAN iteration 1 written; awaiting plan approval (high-risk), K-4, K-5.
- 2026-11-04 PLAN approved; K-4 accept (MF-0032 reserved), K-5 accept. BUILD started.
- 2026-11-04 TEST: full gate green; fresh-context review changes-requested (1 blocking content defect D7.S2 line 3, + notes) → fixed (F1–F3 content, F6 skip-after-refusal with RED-first test, nextLabel to utils) → approve at 12b277e5. Re-freezes (user-approved): MF-0006 SC-6, MF-0007 SC-1, MF-0016 SC-5, MF-0003 SC-5 (K-3). HANDOFF.

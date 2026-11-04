---
ticket_id: MF-0006
tier: normal                      # pure engine schemas + content files; no DB
stage: handoff
branch: feat/MF-0006
builds_on: []
last_iteration: 0
goal_status: complete-pending-manual-commit
track: E                          # seat Owner (Sorin) → taken over by Vlad 2026-11-03 (C-4)
week: W1
depends_on: [Phase 0]
blocks: [MF-0007, MF-0008, MF-0010, MF-0014]
---

> Drafted 2026-11-03 from the planning grill (Q1, Q7, Q9). **This is the content contract and the only
> blocking ticket: the owner lands it on Nov 4, then every other ticket runs in parallel.** SCs are proposals; the claimant confirms and freezes them.

## Objective

Today a pack has only questions, and their `status` field mixes up where an item came from with
whether it's trusted. There is no format for nature cards or diagrams, so the writers (MF-0008/0014)
and the UI (MF-0010) can't start.

End state: one pure engine module defines every item type (question, nature card, diagram) with
**origin** + **author**, a stable item id and a **content hash**; the 53 existing questions are
migrated; two hand-written items (the Temperature card and the agent-loop diagram from
`MINDFORGE.md` §2.4–2.5) load as real content.

## Affected

- **Roles:** content authors, AI pipeline, reviewers (via MF-0007).
- **Surfaces:** `src/engine/{questions,content}/**`, `src/engine/pack/schema.ts`, `packs/ccdv-f/{questions,cards,diagrams}/*.yaml`, `packs/ccdv-f/pack.yaml`.

## Constraints

- Terms follow `CONTEXT.md` (Origin, Author, Nature card, Diagram, Content hash).
- Engine stays pure and pack-agnostic (MF-0001 SC-4 stays green).
- Answer keys still never reach the browser (MF-0003 playable DTO unchanged).
- Files are the source of truth; nothing about review state goes in a file (ADR 0001).

### Constraints → how met (draft, 2026-11-03)

- CONTEXT.md terms → types and fields are named `origin`, `author`, `NatureCard`, `Diagram`, `contentHash`; no `status`, no `Concept` type.
- Engine pure → schemas, `contentHash`, `isPlayable` live in `src/engine/{content,questions}` with no DOM, DB or clock; hashing uses `node:crypto` (already allowed: the loader uses `node:fs`). Full Mermaid syntax checking needs a DOM (spike, C-1), so it does **not** run in the engine.
- Keys never reach the browser → `toPlayableQuestion` stays an allow-list; `author` (a sign-in email, PII) is **not** added to it. MF-0003 SC-6 keeps asserting no `correct`/`rationale` in the DTO.
- ADR 0001 → no `reviewed`/`approved` field in any schema; `ReviewContext` is computed server-side and starts empty.

## Decided without a question

- `status: official | unreviewed` → `origin: official | human | ai`; the 3 official questions keep `official`, the other 50 become `ai` with author = Sorin (they were drafted by Claude in MF-0003). **Superseded 2026-11-03 by the user:** every item (50 questions, the card, both diagrams) is authored by `vlad.parvana@ddroidd.com`.
- `author` = the author's sign-in email; required for `human`/`ai`, absent for `official`.
- No Concept entity: cards carry a free-text `concept` and attach to a skill; several per skill (Q7).
- Files: `packs/<slug>/cards/<skill>.yaml`, `packs/<slug>/diagrams/<skill>.yaml`. Item ids are unique pack-wide across all types.
- Content hash = SHA-256 of the item's canonical JSON (sorted keys, all fields).
- Pack gains `exam.date` (CCDV-F: 2026-12-07) for readiness (MF-0015) and optional per-skill `sources` (official URLs) for the corpus (MF-0008).
- `author` never enters a browser DTO: it's a sign-in email (CONTEXT.md People), and the playable DTO is an allow-list (MF-0003 SC-6). 2026-11-03.
- Duel badge until MF-0007: `origin === "official"` → "Official sample", otherwise "Unreviewed" — C-2's own fallback; same two labels as today (`duel-session.tsx:137`).
- Allowed diagram types in the schema: `flowchart`/`graph`, `sequenceDiagram`, `stateDiagram`/`stateDiagram-v2`, `mindmap` — MINDFORGE §2.5 lists exactly these four kinds.
- Card and diagram content is copied from MINDFORGE §2.4 (Temperature card + its flowchart) and §2.5 (bee-foraging loop), not rewritten. The Temperature card's `sources` URL is checked against the current Claude API docs during BUILD (§2.4 says "to be verified").
- The `docs/temperature-seed-dispersal-analogy` branch only edits `docs/MINDFORGE.md` (31 lines); the card text on `main` §2.4 is the one used.

## Success Criteria

- [x] SC-1: Nature card schema: `id, skill, concept, origin, author?, simply, inNature, whereItBreaks (≥ 1 non-empty entry), contrast?, whyTheName?, diagram? (diagram id), sources (≥ 1 https URL)`. Missing `whereItBreaks` fails with a path-named error. Proof: acceptance test.
- [x] SC-2: Diagram schema: `id, skill, title, origin, author?, mermaid, nodes? [{id,label}], sources`; a `mermaid` whose first token isn't an allowed diagram type fails the schema with a path-named error; Mermaid text that does not parse fails a jsdom-backed content check with the item id in the error, and that check runs over every diagram in every pack in `pnpm test`. Proof: acceptance test with one valid and one broken fixture + the all-packs check. *(amended 2026-11-03, C-1)*
- [x] SC-3: Questions use `origin` + `author`; all 53 migrate; a file still using `status` fails with a clear message. Proof: acceptance test + loader over `packs/ccdv-f`.
- [x] SC-4: Duplicate item id across types, unknown skill code, card pointing to a missing diagram → each fails with a path-named error. Proof: acceptance test.
- [x] SC-5: `contentHash(item)` is stable across key order and changes when any field changes. Proof: unit test.
- [x] SC-6: `packs/ccdv-f` ships the Temperature card (D5.S1) pointing to its own Temperature diagram (D5.S1, MINDFORGE §2.4), and the bee-foraging agent-loop diagram (D1.S3); `team-onboarding-sample` still loads with zero code changes. Proof: loader test. *(amended 2026-11-03, C-3)*
- [x] SC-8: **Review seam** (lets every other ticket run in parallel): engine type `ReviewContext = { states: Map<itemId, ReviewState>, rejected: Set<itemId>, spoiledBy: Set<itemId> }`, pure `isPlayable(state, mode)`, and server `getReviewContext(userId, packSlug)` returning an empty context (everything `unreviewed`, nothing rejected or spoiled). Duel and replay already call it. MF-0007 replaces only the body of `getReviewContext`. Proof: unit test of `isPlayable`; Duel still serves all 53.
- [x] SC-7: typecheck, lint, unit tests, build all pass; MF-0001/0003 frozen suites green (re-freeze of the `status` field approved in this ticket). Proof: receipt.

## Concerns

| # | Collision | Owner | Status |
|---|-----------|-------|--------|
| C-1 | Mermaid parsing in Node may need a DOM. Check `mermaid.parse` vs `@mermaid-js/parser` before choosing; whichever works server-side without jsdom. **Spike 2026-11-03 (mermaid 11.17.2, @mermaid-js/parser 2.0.1): neither works without a DOM.** `@mermaid-js/parser` rejects `flowchart` ("Unknown diagram type"); plain-Node `mermaid.parse` throws `DOMPurify.addHook is not a function` on *valid* text; with a jsdom window it returns `flowchart-v2` for valid and "Parse error on line 2" for broken. SC-2 as written can't hold inside the pure engine. | user | resolved 2026-11-03 (user): test-time check — schema checks structure, a jsdom-backed test parses every diagram in every pack; runtime stays DOM-free. SC-2 amended. |
| C-2 | Renaming `status` touches MF-0003 frozen tests and the duel "unreviewed" badge (badge then depends on review state from MF-0007; until then: origin ≠ official → badge). Concretely: MF-0003 SC-2 filters on `q.status`, and SC-6 asserts the DTO key list includes `"status"` — both frozen (`MF-0003/FROZEN.json`). | user | resolved 2026-11-03 (user): approved a rename-only re-freeze of `mf-0003-questions.acceptance.test.ts` (`status`→`origin`, `unreviewed`→`ai`); every key/rationale assertion unchanged; recorded in MF-0003 FROZEN.json history. |
| C-3 | MF-0010 SC-1 needs "the Temperature card **and its diagram**" for D5.S1, but SC-6 here ships only the card plus the D1.S3 bee diagram. Without a D5.S1 diagram, MF-0010 SC-1 can't pass. | user | resolved 2026-11-03 (user): SC-6 adds the D5.S1 Temperature diagram from §2.4. |
| C-4 | Frontmatter seats this ticket with the Owner (Sorin), "lands it on Nov 4". Taking it in this session could collide with their work. | user / Owner | resolved 2026-11-03 (user): taken over in this session on `feat/MF-0006`; the user tells the Owner. |

## Out of Scope

- Review state, DB registry of items (MF-0007); rendering (MF-0010); AI writers (MF-0008/0014); cuckoo item type (MF-0016).

## Open questions

- none.

## Iteration Log

<!-- append-only -->

- 2026-11-03 · design · Taken over from the Owner seat by the user on `feat/MF-0006` (C-4). Mermaid spike settled C-1 (no DOM-free parser; test-time jsdom check). User resolved C-1…C-4; SC-2 and SC-6 amended. Assumed Sorin's sign-in email = his git email `sorinvieriu@gmail.com` (author of the 50 ai questions). Added to SC-8: with an empty context, official items read as `approved` (CONTEXT.md "Official items start as approved"). Froze 2 acceptance files, 10 tests red on the stubs (FROZEN.json, LOOP-VERIFY.md). → PLAN.
- 2026-11-03 · plan→build→test→handoff · Iteration 0. Built T1–T5 per LOOP-PLAN; one divergence: SC-8 "replay" met by duel page + duel action, not `replayMemory` (rejected option, LOOP-PLAN). Migration script bug (JS `\s` crossing CRLF lines) caught by diff count and redone before any test ran. Receipt tree `c9f72edd…`: typecheck, 24-file lint, 76/76 tests, build PASS; all 7 frozen hashes match; `test:db` not runnable on Windows (`src/test/local-stack.ts`), listed unverified. MF-0003 rename-only re-freeze recorded. → hand-off.
- 2026-11-03 · handoff · User asked that every item be authored by them: 53 `author` lines → `vlad.parvana@ddroidd.com` (50 questions, 1 card, 2 diagrams); re-froze `mf-0006-content.acceptance.test.ts` (author literal only, FROZEN.json history). 76/76 tests, lint clean.
- 2026-11-04 · (from MF-0010) · **Diagram format changed by the user**: graphs (direction, nodes, edges) drawn with
  React Flow replace Mermaid text (ADR 0003). SC-2's Mermaid clauses are superseded: the schema now checks
  direction, unique node ids and that every edge points at a known node; the jsdom Mermaid check and
  `mermaid-check.ts` are retired. Both pack diagrams converted. Recorded in this ticket's FROZEN.json history.

---
ticket_id: MF-0006
tier: normal                      # pure engine schemas + content files; no DB
stage: design
branch: main
builds_on: []
last_iteration: 0
goal_status: reserved
track: E                          # seat Owner (Sorin)
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

## Decided without a question

- `status: official | unreviewed` → `origin: official | human | ai`; the 3 official questions keep `official`, the other 50 become `ai` with author = Sorin (they were drafted by Claude in MF-0003).
- `author` = the author's sign-in email; required for `human`/`ai`, absent for `official`.
- No Concept entity: cards carry a free-text `concept` and attach to a skill; several per skill (Q7).
- Files: `packs/<slug>/cards/<skill>.yaml`, `packs/<slug>/diagrams/<skill>.yaml`. Item ids are unique pack-wide across all types.
- Content hash = SHA-256 of the item's canonical JSON (sorted keys, all fields).
- Pack gains `exam.date` (CCDV-F: 2026-12-07) for readiness (MF-0015) and optional per-skill `sources` (official URLs) for the corpus (MF-0008).

## Success Criteria

- [ ] SC-1: Nature card schema: `id, skill, concept, origin, author?, simply, inNature, whereItBreaks (≥ 1 non-empty entry), contrast?, whyTheName?, diagram? (diagram id), sources (≥ 1 https URL)`. Missing `whereItBreaks` fails with a path-named error. Proof: acceptance test.
- [ ] SC-2: Diagram schema: `id, skill, title, origin, author?, mermaid, nodes? [{id,label}], sources`; Mermaid text that does not parse fails with the item id in the error. Proof: acceptance test with one valid and one broken fixture.
- [ ] SC-3: Questions use `origin` + `author`; all 53 migrate; a file still using `status` fails with a clear message. Proof: acceptance test + loader over `packs/ccdv-f`.
- [ ] SC-4: Duplicate item id across types, unknown skill code, card pointing to a missing diagram → each fails with a path-named error. Proof: acceptance test.
- [ ] SC-5: `contentHash(item)` is stable across key order and changes when any field changes. Proof: unit test.
- [ ] SC-6: `packs/ccdv-f` ships the Temperature card (D5.S1) and the bee-foraging agent-loop diagram (D1.S3); `team-onboarding-sample` still loads with zero code changes. Proof: loader test.
- [ ] SC-8: **Review seam** (lets every other ticket run in parallel): engine type `ReviewContext = { states: Map<itemId, ReviewState>, rejected: Set<itemId>, spoiledBy: Set<itemId> }`, pure `isPlayable(state, mode)`, and server `getReviewContext(userId, packSlug)` returning an empty context (everything `unreviewed`, nothing rejected or spoiled). Duel and replay already call it. MF-0007 replaces only the body of `getReviewContext`. Proof: unit test of `isPlayable`; Duel still serves all 53.
- [ ] SC-7: typecheck, lint, unit tests, build all pass; MF-0001/0003 frozen suites green (re-freeze of the `status` field approved in this ticket). Proof: receipt.

## Concerns

| # | Collision | Owner | Status |
|---|-----------|-------|--------|
| C-1 | Mermaid parsing in Node may need a DOM. Check `mermaid.parse` vs `@mermaid-js/parser` before choosing; whichever works server-side without jsdom. | Owner | open |
| C-2 | Renaming `status` touches MF-0003 frozen tests and the duel "unreviewed" badge (badge then depends on review state from MF-0007; until then: origin ≠ official → badge). | Owner | open |

## Out of Scope

- Review state, DB registry of items (MF-0007); rendering (MF-0010); AI writers (MF-0008/0014); cuckoo item type (MF-0016).

## Open questions

- none.

## Iteration Log

<!-- append-only -->

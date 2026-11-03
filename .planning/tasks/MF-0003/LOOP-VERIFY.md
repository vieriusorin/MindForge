---
phase: 1-verification
ticket_id: MF-0003
status: complete
verdict: PASS
started_at: "2026-11-03"
completed_at: "2026-11-03"
resume_with: /gsd-goal-loop
---

# Verification — Iteration 1

## RED at freeze (Stage 2b)

| SC | Acceptance test | Red reason at freeze (pasted) |
|----|-----------------|-------------------------------|
| SC-1, SC-2, SC-6 | `mf-0003-questions.acceptance.test.ts` | `Error: not implemented` (load-questions.ts / playable.ts stubs) |
| SC-3, SC-7 | `mf-0003-replay.acceptance.test.ts` | `Error: not implemented` (replay.ts / select.ts stubs) |
| SC-5 | `mf-0003-attempts.db.acceptance.test.ts` | `Error: Cannot find module '…/scripts/sync-question-keys.mjs'` |
| SC-4a/b | same | `AssertionError: expected null to be true` (record_attempt absent); identical on a 2nd run |

Before freezing, SC-3's thresholds were checked against the real ts-fsrs 5.4.2 (fuzz off). One Good → stability 2.307 (sprout); R at 60 days = 0.603 (wilting); Good at days 0/3/10/25 → stability 87.04 (sapling, since there's no Feynman pass yet); one Again → stability 0.212. No re-freezes.

| SC | Verdict | Evidence |
|----|---------|----------|
| SC-1 | PASS | frozen SC-1 green: select≠#correct → `questions.0.select`; duplicate option → `questions.0.options.1.id`; unknown skill → `skill`; empty rationale → `questions.0.options.0.rationale`; missing url → `questions.0.source.url`; duplicate id across files → `S2.yaml: questions.0.id` |
| SC-2 | PASS | frozen SC-2 green: 53 questions in 25 files; official ids D2.S3/D7.S1/D8.S3 with keys B/B/B; every skill ≥ 2; the 50 others are `unreviewed` |
| SC-3 | PASS | frozen SC-3 green |
| SC-4 | PASS | frozen SC-4a/b green: exact key → true; wrong → false; superset → false; forged insert refused; `update correct` leaves rows unchanged; B sees 0 of A's; unknown id raises; anon refused |
| SC-5 | PASS | frozen SC-5 green: 53 keys equal the files; re-sync idempotent; `has_table_privilege` authenticated/anon on `private.question_keys` = false/false |
| SC-6 | PASS | frozen SC-6 green on all 53 questions. Browser: the duel page HTML (fetched with the learner's cookies) contains the question stems, but none of the 217 rationale snippets, no `rationale` key, no `"correct":true` and no `correctOptionIds` (`.planning/tasks/MF-0003/logs/leak-check.js` → `{"checked":217,"hits":[],"hasStem":true}`) |
| SC-7 | PASS | frozen SC-7 green; in the browser, question 1 of a fresh learner's duel was D2.S5 (weight 8.6) |
| SC-8 | PASS | Browser :3001, local stack, dana@mindforge.test (magic link via Mailpit) → created "Duel Cohort" → "Play Scenario Duel" → 5 questions: D2.S5 (B ✓), D2.S4 (C ✓), D2.S3 official (B ✓, "Official sample" badge, exam-guide source), D5.S2 (B ✗, key A shown), D1.S2 (A ✗, key D shown). Every option showed its rationale, plus the source link and "Unreviewed"/"Official" badge. "Duel finished: 3 / 5 correct". Group forest: `nonSeed` = Claude API Mechanics, Software Engineering Foundations, Claude Application Design (all `sprout`, not wilting); Technical Fundamentals and Agent Construction stayed `seed`. DB rows: 5 attempts, `correct` = t,t,t,f,f |
| SC-9 | PASS | receipt below; advisors (warn+) none; MF-0001/0002 suites green; REVIEW.md approve (round 2) |

## Found during verification

- **Tab jumps during the browser run were the test harness, not the app.** Twice the tab left the duel (to `/today`, then `/groups`). Instrumented with a `sessionStorage` navigation log (init script): the only navigation was a `pushState('/groups')` 1 s after load, coinciding with my MCP click on option B while the sidebar was still streaming in (layout shift → the click hit the sidebar link). With no interaction for 10 s after the sidebar loaded, the log stayed empty. Clicks made after the sidebar settled worked for the whole run.
- Advisor INFO `rls_enabled_no_policy` on `private.question_keys` is intended (deny-all; only the definer function reads it). No WARN or ERROR findings.

## Review round 1 → fixes (each shown RED before the fix)

| Finding | Fix | RED before fix (pasted) |
|---|---|---|
| [blocking] attempts read capped at 1000 rows (max_rows) → newest answers silently dropped | `src/server/memory/fetch-attempts.ts`: paged `.range()` (500), ordered `(answered_at, id)`; `listMyAttempts` delegates | `fetch-attempts.db.test.ts` (1205 seeded): `AssertionError: expected [ Array(1000) ] to have a length of 1205 but got 1000` |
| `javascript:`/`data:` source URLs accepted (rendered as href) | `z.url({ protocol: /^https?$/ })` | `schema.test.ts`: `javascript:alert(1): expected [Function] to throw an error` |
| unbounded `chosen` elements via direct RPC | `private.record_attempt` raises 22023 when an element is null or its length is outside 1..8 | `mf-0003-review.db.test.ts`: `expected null not to be null` |
| `db:reset` could sync to a remote `$SUPABASE_DB_URL` | script pins `SUPABASE_DB_URL=` (local) | config; no test |
| sync swallowed every read error → deleted the pack's keys | only ENOENT means no questions; other errors throw | defensive; no test |
| "This tree grows" overclaims | copy: "Correct! Recalled and recorded." | copy |

Deferred to a hardening ticket: learn-key-then-answer (sprout only), stale file-vs-DB key mismatch check, validator in the sync script, cross-pack `question_id` PK, rate limit, duel double-submit/live-region/focus/aria-labelledby/FieldSet, back link to the originating group.

## Gates and suite

db:reset 0 (2 migrations, 53 keys synced) · typecheck 0 · gates 0/0 · lint 0 · unit 49/49 · db 12/12 · build 0 · check-hooks PASS · frozen MF-0001/0002/0003 match.

## Receipt (default; no VERIFY script)

```
2026-11-03T08:43:51Z · tree a2ee89bac03a… · … · PASS
2026-11-03T08:44:01Z · tree 44a6fc1763a5… · README.md only · PASS          (reviewed round 1: changes requested)
2026-11-03T08:50:33Z · tree 0293104946228b321e631d731cfcb37bc74f7e30d5b8ee3af1596e6c5471a6cb · typecheck 0 · lint 0 · test 49 · test:db 12 · build 0 · check-hooks 0 · advisors none · frozen ok · PASS (after review fixes)
```

The tree also contains a parallel UI session's uncommitted work, which is not part of this ticket.

## Not verified

- Multiple-response (`select: 2`) questions in the browser: covered by the frozen grading test (superset → false), but no checkbox question appeared in the browser run.
- Light theme / phone width of the duel. Only the default theme at desktop width was observed.
- Accuracy of the 50 drafted questions beyond the agent's self-check, the reviewer's spot-checks, and the 5 seen in the browser: they are badged "Unreviewed" by design (C-1).
- Wilting over real time (proven only by the oracle test with a 60-day clock).

## Verdict: PASS

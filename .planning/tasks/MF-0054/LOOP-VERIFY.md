---
phase: 1-verification
ticket_id: MF-0054
status: complete
verdict: PASS
started_at: "2026-11-06"
completed_at: "2026-11-06"
resume_with: /gsd-goal-loop
---

# Verification — Iteration 1

## RED at freeze (Stage 2b)

| SC | Acceptance test | Red reason at freeze (pasted) |
|----|-----------------|-------------------------------|
| SC-1, SC-2 | `src/server/groups/__tests__/mf-0054-sidebar-section.acceptance.test.ts` | `Error: not implemented` (stubs `sidebarGroupSection`, `primaryPackSlug`); parity: `AssertionError: src/app/(app)/layout.tsx: expected 'import { redirect } from "next/naviga…' to match /listMyPins\(/` |
| SC-3, SC-4 | `src/server/db/__tests__/mf-0054-group-pins.db.acceptance.test.ts` | `PostgresError: relation "private.group_pins" does not exist`; identical on a 2nd run |
| SC-5 | `src/features/groups/__tests__/mf-0054-pin-actions.acceptance.test.ts` | `Error: not implemented`; `expected [Function] to throw error matching /redirect \/sign-in/ but got 'not implemented'` |
| SC-6 | `src/features/groups/components/pin-toggle/__tests__/mf-0054-pin-toggle.acceptance.test.tsx` | `Error: not implemented` (stub `PinToggle`) |
| SC-7 | `src/features/app-shell/components/app-sidebar/__tests__/mf-0054-sidebar-label.acceptance.test.tsx` | `TestingLibraryElementError: Unable to find an element with the text: Recent` (3 regression-lock cases green by design) |
| SC-8 | `src/dev-seed/__tests__/mf-0054-seed-pins.db.acceptance.test.ts` | `Error: pin_group: Could not find the function public.pin_group(p_group_id) in the schema cache`; identical on a 2nd run |

**Interleaving variant (SC-4), recorded deviation.** At freeze the function did not exist, so the opposite-behaviour run
happened in BUILD (LOOP-PLAN step 2), right after the migration and before any other code. `private.pin_group_for` was
replaced in the LOCAL DB by a copy whose `pg_advisory_xact_lock` line was commented out. The concurrency case gave
`× two concurrent pins from one user end with exactly 3 pins; the second waited for the first's COMMIT` with
`AssertionError: expected [ …(4) ] to deeply equal [ …(3) ]`, so without the lock two concurrent pins leave 4. After the
migration's definition was restored, `has_lock true` and the file passed 9/9. The case is not vacuous.

## Results

| SC | Verdict | Evidence |
|----|---------|----------|
| SC-1 | PASS | sidebar-section acceptance E1–E6 green; `order-pinned-groups.test.ts` 3/3 |
| SC-2 | PASS | same file E1–E7 + parity green (layout and Today import `@/server/packs/primary-pack`, call `listMyPins(`, never `pins: []`); browser: Play/Review links followed each newest pin (prod-prompting → agent-skills → ccdv-f → subagents → claude-code-in-action) and returned to the newest-joined group with no pins |
| SC-3 | PASS | group-pins DB acceptance 6/6 SC-3 cases |
| SC-4 | PASS | group-pins DB acceptance 3/3 SC-4 cases + the lock-removed variant RED above |
| SC-5 | PASS | pin-actions acceptance 9/9; `rpc-errors.test.ts` pinRpcError 2/2 |
| SC-6 | PASS | pin-toggle acceptance 6/6; `utils.test.ts` 2/2; browser: name `Pin <group> to sidebar`, `pressed` toggles, message `Unpinned "Demo study group · Production-Grade Prompting, Agents & Tool use" to make room.` |
| SC-7 | PASS | sidebar-label acceptance 4/4; MF-0052 `mf-0052-storm-link.acceptance.test.tsx` green, hash unchanged |
| SC-8 | PASS | seed-pins DB acceptance 2/2; MF-0052 seed files green (src/dev-seed 28/28); real `pnpm dev:seed`: your pins newest first = ccdv-f, subagents, prod-prompting |
| SC-9 | PASS | `CONTEXT.md` "Pinned group"; every gate below exit 0; browser check below |

## Gates and suite

Final tree: typecheck 0 · lint 0 (631 files) · test 742/742 (152 files) · test:db 120/120 (27 files) · build 0 ·
gate:planning 0 (53 ticket folders). Frozen hashes for MF-0054, MF-0052, MF-0005 and MF-0002: 0 mismatches. The baseline
before the change was all green (Iteration Log, design preflight), so this ticket adds no failure and none was pre-existing.

## Browser (local :3001, demo learner Ana Steady, after one `pnpm dev:seed`)

- No pins: sidebar "Recent" with the 3 newest-joined groups; the header pack is the newest-joined group's.
- Pinning from the group header: the sidebar switches to "Pinned" with that one group; the Play/Review links switch pack; the toggle reads `pressed`.
- `/groups`: pins 2 and 3 are listed newest first; Storm appears when the newest pin is ccdv-f (it has an exam).
- 4th pin: the oldest pin is replaced and the message names it.
- Unpinning all three: back to "Recent".
- **Found in the browser, fixed:** the inline message squeezed the row link (reviewer note 2). The message now wraps to
  its own line, and the empty live region stays in the a11y tree at zero height; re-checked with a fresh eviction.

## Review

`REVIEW.md`: approve, 0 blocking, 3 notes, `reviewed_hash` e5c404f0… (tree including `.planning`). **Post-review change to
`src/features/groups/components/pin-toggle/pin-toggle.tsx`, `group-list/group-list.tsx` and `src/app/(app)/groups/[groupId]/page.tsx`
(CSS layout of the message only) was not re-read by the reviewer.** It touches no delete, auth or privileged-client path.

## Receipt

`2026-11-06T06:51:31Z · tree 9ffe0b3764d4 (code, excl. .planning) · typecheck 0 · gates 1/1 (gate:planning) · lint 0 · test 742/742 · test:db 120/120 · build 0 · PASS`

## Not verified

- Today page in the browser: it follows the pin by the same function as the sidebar (parity test), but it was not opened.
- Mobile width (sidebar as a Sheet) was not checked in the browser.
- Sub-millisecond pin ordering (reviewer note 1): TS reads `pinned_at` at ms precision, the DB at µs. Only reachable when two pins are under 1 ms apart; the seed spaces its pins by 2 ms.
- CI: the T0 `fetch-depth: 0` change is only proven by the next CI run.
- Hosted environments: the migration is applied to the LOCAL stack only.

## Verdict: PASS

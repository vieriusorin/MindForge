---
ticket_id: MF-0012
iteration: 0
---

## RED at freeze (2026-11-04)

Pre-freeze stubs (typecheck green, behaviour unchanged): `src/features/duel/utils/back-link.ts` throws
`not implemented`; `DuelSessionProps.back: DuelBackLink` replaces `backHref` (page passes the old
`/groups` link); `scripts/sync-question-keys.mjs` honours `MINDFORGE_PACKS_DIR` (refused with
`SUPABASE_DB_URL`).

Bindings: no `ticket:freeze` / `ticket:verify` / `ticket:eval` scripts in `package.json` → defaults by hand,
hashes over LF-normalised content.

```
× SC-1: two submits before a re-render record one attempt
  AssertionError: expected "vi.fn()" to be called 1 times, but got 2 times
× SC-2: the live region is mounted empty, then holds the verdict; focus goes to it, then to the next stem
  TestingLibraryElementError: Unable to find an accessible element with the role "status"
× SC-3: the card is a group named by its stem, holding a group named Options
  TestingLibraryElementError: Unable to find an accessible element with the role "group" and name "Stem of p.S1.1"
× SC-4 (3/3): Error: not implemented
× SC-5: a schema-invalid question file exits non-zero and changes no row
  AssertionError: pack registry: ccdv-f, mf0012-broken, team-onboarding-sample   (exit 0; same on 2nd run)
```

Each red is the SC's own: SC-1 is the double call itself; SC-2/3 are the missing region and group
names, not a render error; SC-5 is the script syncing a file the app's schema rejects. After both SC-5
runs, `private.packs|question_keys|items` hold 0 `mf0012-broken` rows; registry = `ccdv-f,team-onboarding-sample`.

## Iteration 1 — receipt (2026-11-04)

Baseline (pre-change, a5da410): typecheck 0 · lint 0 · test 56 files / 213 passed. No pre-existing reds.

| Check | Command | Result |
|---|---|---|
| Frozen hashes | sha256 (LF) vs FROZEN.json | `frozen ok` × 3 |
| Typecheck | `pnpm typecheck` | exit 0 |
| Lint | `pnpm lint` | exit 0 — `Checked 353 files … No fixes applied.` |
| Unit + UI | `pnpm test` | exit 0 — `Test Files 58 passed (58)` · `Tests 219 passed (219)` |
| DB | `pnpm test:db` | exit 0 — `Test Files 10 passed (10)` · `Tests 32 passed (32)` |
| Build | `pnpm build` | exit 0 — `✓ Compiled successfully` · `/play/[packSlug]/duel` and `/groups/[groupId]` ◐ (partial prerender) |
| Real sync | `pnpm db:sync-keys` (local) | `ccdv-f: 53 key(s) synced` · `ccdv-f: 56 item(s) registered` |
| Env guard | `MINDFORGE_PACKS_DIR=… SUPABASE_DB_URL=x node scripts/sync-question-keys.mjs` | `Refusing MINDFORGE_PACKS_DIR together with SUPABASE_DB_URL.` exit 1 |

Tree hash (`git diff HEAD -- src scripts` + untracked files under src/ scripts/):
`db086d6ac41ccfb402e82eece2bd39e3630ad10193f1a85bea0b1bb6ac82446f`

**Verdict: DONE** for that tree.

## SC verdicts

| SC | Verdict | Evidence |
|---|---|---|
| SC-1 | PASS | frozen `SC-1` green; browser: fixture user 0 → 1 row for `ccdv-f.D2.S5.q1` after a double click; all 13 attempts over 3 duels are n = 1 |
| SC-2 | PASS | frozen `SC-2` green; browser: `status` mounted empty, focused + "Correct! Recalled and recorded." after grading; after Next, focus on the `H2` of question 2, region empty; finish heading focused |
| SC-3 | PASS | frozen `SC-3` green; DOM: `DIV role=group aria-labelledby=question-ccdv-f.D2.S5.q1` → stem; `FIELDSET` legend "Options" |
| SC-4 | PASS | frozen `SC-4` green (3); browser: group link `…/duel?from=1b0a4cb5-…`, finish link "Back to the group" → `/groups/1b0a4cb5-…`; `?from=../admin` → "Back to your forest" → `/today` |
| SC-5 | PASS | frozen `SC-5` green (non-zero exit, three tables byte-identical) |
| SC-6 | WITHDRAWN | user, 2026-11-04 (server-side.md §2 exception) |
| SC-7 | PASS | receipt above |

Not run: fresh-context reviewer (normal tier; required only for high-risk). Screen-reader audio not
checked; jsdom + DOM inspection only.

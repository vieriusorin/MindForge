---
ticket_id: MF-0011
tier: high-risk                   # cross-user read through SECURITY DEFINER; privacy of learners; privileged DB client
stage: handoff
branch: main
builds_on: [MF-0002, MF-0003, MF-0007]
last_iteration: 2
goal_status: complete-pending-manual-commit
track: S                          # seat Coder E
week: W2
depends_on: [MF-0006]             # review filters via the getReviewContext seam
---

> Drafted 2026-11-03 from the planning grill (Q5). Claimed 2026-11-04 (this session); SCs refined in
> DESIGN. Baseline 2026-11-04: typecheck, lint, `pnpm test` (195) and `pnpm test:db` (27) green.

## Objective

Today a group page shows only the viewer's own forest; nobody can see where the group as a whole is
weak (MINDFORGE §1.1, "learn together"; D-4).

End state: the group page shows a **group heatmap**: per region, the members' average retrievability
and the share of healthy trees, in words and numbers, under the member avatars. It appears only when at
least 3 members OTHER than the viewer have countable attempts, and never says how many have. No individual forest, score or attempt of another member is
ever readable, by the page or by any API a member can call.

## Affected

- **Roles:** group member and group admin (same view). Non-members: nothing.
- **Surfaces:** new migration (a `private` SECURITY DEFINER read + `public` shim, EXECUTE for
  `service_role` only); `src/server/groups/**` (one server-only service); `src/engine/forest/**` (the
  aggregate); `src/features/groups/components/group-heatmap/`; `src/app/(app)/groups/[groupId]/page.tsx`
  (also touched by MF-0010: seed tiles, merged on main).

## Constraints

- Terms: Group heatmap (CONTEXT.md). Aggregates only; minimum 3 contributing members, else "not enough data yet".
- Memory is computed by the engine replay (MF-0003), not re-implemented in SQL. The cross-user read
  happens inside one server-only service that returns aggregates only.
- Revoke-all-first; the viewer must be a member of the group; grants gate (MF-0005) stays green and unedited.
- Heatmap colour is never the only signal: each region shows words and a number (ui-design §5).
- Figures come from `src/engine/**` (code-conventions), with the clock passed in.

## Constraints → how met

- Aggregates only → the DB function's rows never leave `src/server/**`; the service returns a DTO with
  per-region figures only, no count (SC-2 asserts its keys).
- Engine replay → the service builds each member's `ReviewContext`, then calls `countableAttempts` +
  `memoryBySkill` + `buildForest`, and the new engine `summarizeGroupHeatmap` aggregates the forests (SC-4).
- Revoke-all-first / grants gate → the function is revoked from `public, anon, authenticated`; the
  MF-0005 allow-list needs no line (it gates anon/PUBLIC EXECUTE on `public` functions).
- Words + number → each region renders a status word, a percent and a legend (SC-5).

## Decided without a question

- Visibility rule = aggregate only, ≥ 3 members, avatars list; individual sharing after Dec 7 (D-4, Q5).
- Attempt filters from MF-0007 apply per member: rejected questions (global) and that member's own
  spoiled questions (their first review time), via the same `countableAttempts` (CONTEXT.md Spoiled).
- **Contributing member** = a member with ≥ 1 countable attempt on the group's pack. The gate counts
  contributors other than the viewer (≥ 3, user 2026-11-04); the figures pool every contributor,
  the viewer included.
- **Healthy tree** = a tree past seed that is not wilting (`treeStage`, FOREST_THRESHOLDS).
- Per region, over contributing members C and the region's skills S:
  - healthy share = healthy (member, skill) pairs ÷ (|C| × |S|), whole percent;
  - average retrievability = mean retrievability over the (member, skill) pairs that have memory,
    whole percent; none → "No data yet";
  - word: "Holding" when the shown average retrievability (whole percent) ≥ 85 (`wiltBelowRetrievability`),
    else "Fading" (decided on the rounded figure so the word never contradicts the number, review N1);
    "No data yet" when none.
- The card shows no member count in either state (user 2026-11-04). The avatars are the existing member list.
- C-1 resolved: not cached. A group-scoped read is access-controlled and a function of `now`
  (nextjs-data: role-scoped reads are never `use cache`); 6 members × hundreds of attempts replays in ms.
- Applying the migration uses `supabase migration up --local` (no reset, no wipe of shared local state).

## Success Criteria

- [x] SC-1: Non-members get nothing. A signed-in non-member calling `public.group_attempts` directly is
  refused (no EXECUTE), and the service call with a non-member viewer is refused (42501). Proof: DB
  acceptance test with real tokens.
- [x] SC-2: With fewer than 3 contributing members other than the viewer the heatmap is exactly
  `{ status: "not-enough-data" }` (no count); with 3 others it returns per-region figures, and the result
  carries no count, member id, name or per-member figure. Proof: engine acceptance test (shape + values)
  + DB test of the read (the viewer's row is told apart from the others).
- [x] SC-3: No API path a member can call returns another member's attempts or per-skill memory:
  `anon` and `authenticated` cannot execute the new functions; attempts RLS still returns own rows only.
  Proof: DB acceptance test.
- [x] SC-4: Figures equal the definition above computed from each member's engine replay
  (`countableAttempts` → `memoryBySkill` → `buildForest`) for the same fixtures, with literals from the
  fixture. Proof: engine acceptance test.
- [x] SC-5: The group page shows the heatmap with region names, a word, numbers and a legend, plus member
  avatars; with fewer than 3 contributors it says "not enough data yet". Proof: browser with 3 local users.
- [x] SC-6: Advisors clean, grants gate green and unedited, component split, typecheck, lint, test,
  test:db, build. Proof: receipt.

## Concerns

| # | Collision | Owner | Status |
|---|-----------|-------|--------|
| C-1 | Replaying every member's attempts per page view vs caching | Coder E | resolved: not cached (see above) |
| C-2 | "Replay in TS, aggregates only" vs "no API path returns another member's attempts": a SECURITY DEFINER read callable by `authenticated` hands any member the others' raw attempts through the Data API. Keeping the replay in TS needs a read that only the server can call, i.e. a server-only secret Supabase key — and `.env.example` says the app never holds one. | user | resolved 2026-11-04 (user): scoped server-only `SUPABASE_SECRET_KEY`, one importer, RPC executable by `service_role` only. Supersedes MF-0004 SC-8 for this one key; recorded in ADR 0004. |

| C-3 | Review: with exactly 3 contributors a viewer can infer the other two named members' trees (single-skill regions read 0/33/67/100 %), and "N of 3 have played" reveals whether a named member has played. Contradicts "no individual forest ever readable". | user | resolved 2026-11-04 (user): ≥ 3 other members, no count shown. Residual: with 3 others a 100 % single-skill region still says all of them are healthy (a group fact, not one member's). Re-review residual: in groups of 5+ the number who have played can be inferred from single-skill regions (never memory); accepted for v1 by the user 2026-11-04 → follow-up **MF-0021** (reserved). |

## Out of Scope

- Individual forest sharing, leaderboards, Expedition (MF-0017).

## Decided by the user

- 2026-11-04: C-2 → scoped server-only secret key (option "Secret key, scoped").
- 2026-11-04: figure definitions kept as drafted (pooled over (member, skill) pairs).
- 2026-11-04 (after review, C-3): gate on ≥ 3 contributors OTHER than the viewer and show no count; the
  SC-2 contract changes and the acceptance files are re-frozen (user approved the re-freeze).
- No proof command wipes shared local state: the migration applies with `supabase migration up --local`.

## Open questions

- none.

## Iteration Log

<!-- append-only -->
- 2026-11-04 it-2: review PASS-WITH-NITS; C-3 (inference with 3 contributors) → user: gate on 3 OTHER members, no count. SC-2 changed, re-freeze; nits N1, N4–N8, N10 fixed in the same iteration.
- 2026-11-04 it-2 close: re-review PASS-WITH-NITS on tree 3a9b867f…; count-inference residual accepted (user) → MF-0021. Receipt 2 PASS. Hand-off.
- 2026-11-04 it-1: DESIGN closed; acceptance frozen red (FROZEN.json, 2 files); LOOP-PLAN written.

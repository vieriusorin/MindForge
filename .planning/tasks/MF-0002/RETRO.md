---
ticket_id: MF-0002
outcome: complete
causes: [tooling, plan-gap]
actions: [memory-add]
lesson_keys: [truncate-bypasses-rls, connection-before-supabase-auth]
applied: yes
written_by: main session (inline; no separate retro agent was run)
---

## Right

- The DB acceptance tests ran with real user tokens against the local stack and were frozen red before any SQL. The migration passed them on the first apply, and the advisors were clean.
- `auto_expose_new_tables = false` locally made the explicit-grant model testable before hosted Supabase enforces it.
- The browser walkthrough found a real defect the tests couldn't: a Partial Prefetching "blocking route" from `getClaims()`'s `Date.now()`.
- The fresh-context reviewer found the load-bearing `revoke all` (TRUNCATE bypasses RLS) and four hardening notes.

## Wrong

- **tooling:** a `python str.replace` edit failed silently on a Biome-reformatted function signature (the `connection()` insert). It was caught by grepping right after, so no harm done, but it's the second silent-edit miss in two tickets.
- **plan-gap:** the plan's `owns` lists missed 7 files the build needed (layout header, origin helper, generated types, test harness, config). They were all legitimate, but the plan didn't predict them. Recorded after the review.
- Evidence (LOOP-VERIFY / evidence file) was written after the reviewer started, so the reviewer flagged it as missing.

## Cause

`tooling`: replacing text that a formatter may have re-wrapped. `plan-gap`: shared helpers and generated files weren't anticipated in the plan.

## Actions

1. memory-add `project-supabase-migration-rules`: every new public table needs `revoke all … from anon, authenticated` before grants (otherwise TRUNCATE is granted and bypasses RLS); Supabase auth calls in RSC need `await connection()` under Partial Prefetching. *(applied)*
2. Proposed for a future ticket, not applied: a DB gate test that asserts that no `public` table grants TRUNCATE/INSERT/DELETE to `anon`/`authenticated` unless allow-listed. It would turn lesson 1 into a check.

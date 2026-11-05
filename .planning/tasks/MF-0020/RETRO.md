---
ticket: MF-0020
outcome: parked
causes: tooling
actions: none
applied: 2026-11-05
lesson_keys: hosted-scs-split-from-code, design-preflight-sc-preconditions, ci-red-unobserved, runbook-command-verbatim
---
## Numbers
No `ticket:retro` script exists; facts read by hand from GOAL.md, `.planning/evidence/MF-0020.md` and `git diff HEAD`.
- Iterations: 0 (`last_iteration: 0`); `goal_status: blocked-on-user`, `stage: design`. No LOOP-PLAN, FROZEN.json, receipt, REVIEW.md or token metrics (so no median comparison).
- Diff: `docs/runbook/deploy.md` +57 lines (§E0-E3) and GOAL.md; the only agent deliverable (SC-1).
- SC-1 ticked: the E2 read-back query ran on the local DB (`docker exec supabase_db_mind-forge psql`) inside `begin read only ... rollback`: `1 | t | 90 | 55 | 25` for a seeded learner, `0 | f | 0 | 0 | 0` for an unknown email. Counts only, no email or uuid.
- SC-2...SC-6 open (user-owned). Blocked on C-1: `vercel project ls` and `supabase projects list` show no MindForge hosted project on 2026-11-05, so the 2026-11-04 preconditions were still unmet one day later.
- Concerns: C-2 (1 of 3 `ccdv-f` cards; user chose to wait for H-2 by Nov 13) and C-3 ("wins a Duel" undefined; user chose score >= ceil(N/2)) decided; C-1 and C-4 (`main` CI red at Install on `02471d7`, `c944a3e`) open.

## Went right
- The preconditions were re-checked read-only at intake (CLI lists, `git log main`, `ls packs/ccdv-f/cards`, GitHub API) and recorded as a table with sources, before any design. The park cost one pass and no BUILD. Keep: already is, SKILL.md Stage 2 hosted-infra check (MF-0004 retro) and preflight item (4) (MF-0019 retro).
- The `main` CI red (MF-0019's blind window) was read from the API and turned into concern C-4 plus a runbook E0 line ("Don't run the gate on a red `main`"). The rule applied the day it was written. Keep: already is, SKILL.md Stage 2 preflight (4).
- The ticket split the work correctly: the agent wrote the runbook and proved its query locally, with no writes to a hosted DB; every production step stayed with the user. PII was designed out: the query prints counts only, the evidence says "colleague A". Keep: already is, GOAL Constraints plus runbook E3.
- "Wins a Scenario Duel" (docs/MINDFORGE.md line 384 only; absent from CONTEXT.md and the engine) was surfaced as a Concern with two proposals before the checkpoint, and the user decided it with "no code change". That is the `grill-with-docs` step in Stage 2 working. Keep: already is, SKILL.md Stage 2. The decision is also in runbook E1 step 5, which is where the next session loads it.
- The evidence file separates "Not verified" (hosted, `psql` over TLS, CI) from what ran. No overclaim. Keep: already is, SKILL.md Stage 5 and `references/verification.md`.

## Went wrong
- `psql` is not installed locally, so E2 was run through `docker exec supabase_db_mind-forge psql -U postgres ... -f -`, not as the runbook writes it (`psql "$(DB_URL)" ...`). The SQL was extracted verbatim, but the connection path and the E0 fallback (`docker run --rm -i postgres:17 psql`) were never exercised. The evidence says so under "Not verified", so this is disclosed, not hidden. cause: tooling (a missing client on the dev machine). This is the same gap `verification.md` "run runbook commands as written" covers; it was followed as far as the machine allowed.
- MF-0010's GOAL still says `stage: build` / `goal_status: in-progress` although PR #9 (`4fc1b12`) is on `main`. The session noticed it (a Preconditions row) and correctly did not edit another ticket's record. Of the 12 GOALs sampled (MF-0004...MF-0019) it is the only one out of step, so it is not yet a pattern. cause: tooling (nothing compares a GOAL's status with `git log main`).
- The ticket was reserved on 2026-11-04 with C-1 already known to be unmet, and picked up on 2026-11-05. The agent work is small (a runbook section), so the cost was low, and the reserve-then-wait shape is the one the MF-0004 / MF-0019 retros prescribed. Not a defect; the open risk is the same one MF-0019 named: a `reserved` user-owned ticket has no date for its first live run. Here C-2 gives one (Nov 13) and the roadmap gate is Nov 15.

## Actions (at most two)
None. Every lesson here is already written where it is loaded at the moment it matters:
- hosted-infra precondition check and park -> SKILL.md Stage 2 (MF-0004 retro);
- `main` CI conclusion read at DESIGN -> SKILL.md Stage 2 preflight (4) (MF-0019 retro), which fired and worked;
- run runbook commands as written -> `references/verification.md`, followed within the machine's limits;
- an undefined spec term becomes a Concern -> `grill-with-docs` in Stage 2, which fired and worked.
Memory checked: `feedback-verify-derived-facts.md`, `feedback-local-first.md`, `feedback-no-keys-in-logs.md`, `project-supabase-migration-rules.md`. None needs an edit, and none is stale or duplicated by this ticket.

## Not worth changing
- Stale MF-0010 GOAL status: one record out of 12 sampled. A gate (GOAL `in-progress` while a `Merge pull request ... feat/<ID>` commit is on `main`) is possible but fragile and unproven; re-propose if a second stale record turns up. The user can set MF-0010 to `complete-pending-manual-commit` / `stage: handoff` by hand.
- `psql` missing locally: the E0 line already names a Docker fallback. When the user first runs E2 on production, they may confirm that the fallback works; add it to MF-0020's SC-6 evidence if it needs a fix. No skill change.
- Defining "wins a Duel" in CONTEXT.md: the decision (score >= ceil(N/2)) is in GOAL "Decided by the user" and runbook E1 step 5. Add it to CONTEXT.md only if a later ticket builds a win state in the UI (the GOAL's Out of Scope names that).
- No token-waste signal: zero iterations, three small reads, no subagents.

## Applied

2026-11-05 · No actions proposed, so there was nothing to apply or hold. Noted for the user: MF-0010 GOAL.md is stale (`stage: build`, merged in PR #9), and I left it unedited.

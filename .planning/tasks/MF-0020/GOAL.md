---
ticket_id: MF-0020
tier: normal                      # a manual run on hosted infra; the only code-side deliverable is a runbook section
stage: design
branch: MF-0020
builds_on: [MF-0004, MF-0010]
last_iteration: 0
goal_status: blocked-on-user      # C-1: hosted infra (deploy.md §A) not set up; then the user runs §E
owner: user
week: W2
depends_on: [MF-0004, MF-0010]
---

> Reserved 2026-11-04 from MF-0010 C-2 (user decision): the hosted release gate is not a code SC.
> Picked up 2026-11-05 (`/gsd-goal-loop MF-0020`). Intake + design drafted by the agent; the run itself
> is the user's: it writes to the production DB, which is past the gate.

## Objective

**Today:** MindForge runs only on the local stack. Nobody outside the team has used it, and there is no
hosted URL to send.

**End state (release gate, ROADMAP §W1–W2, Nov 15):** a colleague who has never seen the app joins from an
invite on the hosted URL, plants 3 seeds, wins a Scenario Duel, and sees their trees grow. The run is
recorded once, and the runbook lets the platform owner repeat it.

## Affected users and surfaces

- **Colleague** (new learner, no account): `/join/[code]` → `/sign-in` (magic link) → `/play/ccdv-f/plant/[skill]`
  ×3 → `/play/ccdv-f/duel` → dashboard forest.
- **Platform owner** (user): runs `docs/runbook/deploy.md` §A + §B, creates the group, sends the invite, runs §E.
- Tables touched by the run (through the app only): `auth.users`, `public.profiles`, `public.group_members`,
  `public.attempts` (via `record_attempt`).

## Deliverable

1. `docs/runbook/deploy.md` §E "Release gate run": steps, what to capture, the read-only DB read-back query.
   **Agent, this session.**
2. One recorded run on production, logged in §D and `.planning/evidence/MF-0020.md`: screenshots + the
   colleague's attempt rows. **User.**

## Constraints

- No agent writes to the hosted DB or deploys. Every §A/§B/§E step is run by the user (deploy.md header).
- The hosted DB URL never lands in a file, log or the repo (deploy.md secrets rule; memory: no keys in logs).
- The colleague's email and uuid do not go into committed evidence. Use a role ("colleague A") and
  aggregate counts.
- The run uses `main` as deployed. No hot-fix during the run. A failure becomes a new ticket (Stage 6 rule).

## Out of Scope

- Creating the hosted infra (that is MF-0004 §A, the user's manual steps).
- Writing nature cards (H-2 / MF-0014).
- Adding a "win" state to the Duel (would be a new ticket if C-3 decides a threshold the UI should show).

## Preconditions (re-checked 2026-11-05, read-only)

| Precondition | State | Source |
|---|---|---|
| Hosted Vercel project for MindForge | **missing.** `vercel project ls` lists superb-ai, p4t-staging, p4-t, feedinar | CLI, 2026-11-05 |
| Hosted Supabase `mindforge-prod` | **missing.** `supabase projects list` lists only `p4t-staging` | CLI, 2026-11-05 |
| MF-0004 deploy runbook | present, `docs/runbook/deploy.md` §A–§D | repo |
| MF-0010 Seed Planting on `main` | **merged** (PR #9, `4fc1b12`). Its GOAL still says `stage: build`, which is stale | `git log main` |
| ≥ 3 `ccdv-f` nature cards | **1** (`packs/ccdv-f/cards/D5.S1.yaml`) | `ls packs/ccdv-f/cards` |
| `main` CI | `02471d7`, `c944a3e`: **failure** at `checks / Install` and `db / Install`. `5cd6bac` in progress | GitHub API, 2026-11-05 |

## Success Criteria (draft, frozen after the checkpoint)

- [x] **SC-1** (agent, done 2026-11-05, evidence `.planning/evidence/MF-0020.md`): `docs/runbook/deploy.md` has §E with: preconditions, numbered steps, a capture list, and a
  read-only read-back query that returns counts only (no email, no uuid in its output). Proof: the section
  exists, and the query runs on the **local** stack against a seeded learner and returns the expected columns.
- [ ] **SC-2** (user): invite → join. A colleague with no prior account opens the invite link on `https://<prod-origin>`,
  signs in by magic link (email via production SMTP), and lands as a member of the group. Proof: screenshot of
  the group page showing the colleague's avatar + read-back `is_member = true`.
- [ ] **SC-3** (user): 3 seeds planted. The colleague completes Seed Planting for 3 distinct `ccdv-f` skills.
  Proof: screenshots of each plant screen showing a card (see C-2), and read-back `distinct_skills_attempted ≥ 3`
  before the Duel.
- [ ] **SC-4** (user): Duel won. The colleague finishes one Scenario Duel and the end screen meets the C-3
  definition. Proof: screenshot of "Duel finished: X / N correct".
- [ ] **SC-5** (user): trees grow. The dashboard forest after the run shows the planted skills beyond "Not yet",
  with figures from `summarizeForest`. Proof: dashboard screenshot before (empty forest) and after.
- [ ] **SC-6** (user): logged. §D gets a row; `.planning/evidence/MF-0020.md` holds the screenshots + read-back
  output with no PII.

## Constraints → how met

- No agent DB writes → SC-2…SC-6 are user-owned. The agent only edits the runbook and checks its query locally.
- Secrets → the read-back uses `psql "$(DB_URL)"` inline, like §B3.
- PII → the query takes the email as a psql variable and prints counts only.
- Viewer deduction (group aggregates): not applicable. The read-back reads one consenting colleague's own
  rows, run by the platform owner, and outputs nothing to other members.

## Concerns

| # | Concern | Owner | State |
|---|---|---|---|
| C-1 | No hosted Vercel project and no `mindforge-prod`. §A of the deploy runbook has not been run, so nothing past SC-1 can start. | user | open |
| C-2 | `ccdv-f` has 1 nature card. MF-0010 lets a skill without a card still plant, so the gate passes in letter with 1 card but not in intent ("the 3 planted seeds show a card"). Options: (a) wait for H-2 to deliver ≥ 3 cards by Nov 13; (b) accept card-less planting for 2 of 3; (c) run the gate on a pack that already has ≥ 3 cards. | user / Coder F (H-2) | **decided 2026-11-05: (a)**. The gate needs ≥ 3 `ccdv-f` cards. If H-2 misses Nov 13, the gate slips. |
| C-3 | "Wins a Scenario Duel" is undefined. The Duel end screen shows only "X / N correct". Proposed definition: score ≥ ⌈N/2⌉ (a majority), or "finishes a Duel" with any score. | user | **decided 2026-11-05: score ≥ ⌈N/2⌉** on one Duel, read from the end screen. No code change. |
| C-4 | `main` CI failed at Install on the last two completed runs (MF-0019 retro shape). A release from a red `main` breaks the hand-off rule. Re-check `5cd6bac` before the run. | user | open (check before run) |

## Decided without a question

- The gate pack is `ccdv-f` (ROADMAP: first pack; MF-0010 SC-1 uses it), unless C-2 (c) is chosen.
- Both plant and Duel answers go through `public.record_attempt` → `public.attempts` (migration `20261103083446`),
  so one query over `attempts` covers SC-3 and the Duel read-back.
- "Trees grow" is shown by the dashboard forest (`summarizeForest`); no new figure is computed for the gate.
- MF-0010's stale `stage: build` is noted here, not edited (another ticket's record).

## Decided by the user

- 2026-11-05 · C-3: "wins a Scenario Duel" = score ≥ ⌈N/2⌉ on one Duel (SC-4 proof: the end-screen screenshot).
- 2026-11-05 · C-2: the gate waits for ≥ 3 `ccdv-f` nature cards from H-2 (Coder F) by Nov 13. E0's card check enforces it.
- No proof step wipes shared local state: SC-1 used a read-only transaction on the existing local DB.

## Iteration Log

- 2026-11-05 · intake + design draft; preconditions re-checked; C-1…C-4 raised; runbook §E drafted (SC-1).

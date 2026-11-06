---
ticket_id: MF-0055
title: Ticket progress on GitHub + "See it yourself" hand-off
tier: normal                      # dev tooling: a script, a skill edit, a gate rule; no app code, no DB
stage: handoff
branch: main                      # applied onto main 3d1f5ed at close-out (was feat/MF-0055)
builds_on: [MF-0028, MF-0053]
last_iteration: 1
goal_status: complete-pending-manual-commit
---

> Requested by the user, 2026-11-06: "update gsd-goal-loop when we start a ticket assign it to the person,
> change the status, in progress, done etc. If it will be more tickets assigned from a ticket should be added
> automatic in Issues. We need to make automation and see the progress. Also i want to have a check in web for
> functionality that is created and i don't see when i run this skill."

## Objective

**Today.** Every ticket lives only in `.planning/tasks/<ID>/`. On 2026-11-05/06 the 53 existing tickets were
imported once into GitHub issues #32–#84 and the MindForge project (user project 2), but nothing keeps them in
step: a claimed ticket shows nobody assigned, a stage move shows nothing, a follow-up ticket reserved by a
retro or a DESIGN split has no issue at all, and two contributors can reserve the same number on two branches
(MF-0014 retro, `ticket-number-collision-across-branches`). The hand-off lists files and a commit message, so
the user never sees the feature in a browser unless they go looking.

**End state.** `pnpm ticket:github` mirrors each GOAL.md onto its issue and the project: it creates the issue
for a new ticket, assigns whoever claims or starts it, and keeps the status label, project Status
(Todo / In Progress / Blocked / In Review / Done), project Stage, milestone, parent and "blocked by" links in
step, commenting on each stage or status move. gsd-goal-loop calls it at Stage 0, at every status or stage
change, and for every ticket a ticket spawns. A Stop hook syncs changed GOALs in the background. Every hand-off
after MF-0054 carries a "See it yourself" walkthrough (URL, account, clicks, screenshots per SC), enforced by
`pnpm gate:planning`.

## Success Criteria

- [x] SC-1: GOAL status maps to GitHub as: reserved → Todo + `status: backlog`; in-progress → In Progress +
  `status: in progress` + assign the runner when nobody is assigned; blocked-on-* → Blocked;
  complete-pending-manual-commit → In Review; withdrawn → closed as not planned; a closed issue stays closed
  and Done. Proof: `src/test/__tests__/mf-0055-ticket-github.test.ts` (syncPlan).
- [x] SC-2: `--claim` refuses a ticket assigned to someone else unless `--force`. Proof: same file (claimDecision).
- [x] SC-3: a ticket spawned from another ("Split out of / Reserved … from|by / Drafted … by <ID>") gets that
  ticket as its parent; `depends_on` ∪ `builds_on` become "blocked by". Proof: same file (parseGoal), and a live
  run of `pnpm ticket:github MF-0055` creating its issue.
- [x] SC-4: `pnpm ticket:github next` returns one past the highest id in local folders (with or without a
  GOAL.md), every branch, and every issue title. Proof: same file (nextTicketId) and a live run.
- [x] SC-5: `pnpm gate:planning` fails a ticket after MF-0054 at hand-off whose evidence is missing or has no
  `## See it yourself` section; earlier tickets and tickets before hand-off pass. Proof: same file
  (checkSeeItYourself) and `pnpm gate:planning` on this tree.
- [x] SC-6: gsd-goal-loop (SKILL.md, templates.md, retro.md) states when to run the sync, the claim step,
  the issue for every spawned ticket, `Closes #N` in the hand-off, the mandatory browser walkthrough and the
  "See it yourself" block. Proof: the diff.

## Out of Scope

- A GitHub Action that syncs on push: a user-owned project needs a PAT with `project` scope as a repo secret;
  a later ticket if wanted.
- Rewriting the bodies of the 53 imported issues.

## Also in the diff (recorded at close-out)

- Records of MF-0001, MF-0010, MF-0018 and MF-0020 (GOAL, LOOP-*, RETRO, evidence) have other projects' names replaced
  with neutral wording ("another project", "an unrelated project"). The repo is public and the sync publishes ticket
  text, so the names would have gone public. The fix is sensible, but the building session did not record it here.

## Decided by the user

- The Stop hook entry in `.claude/settings.json` (the auto-mode classifier refused the agent's edit to Claude's
  own config): the user adds it, or approves the edit (hand-off).

## Iteration Log

- design preflight: `pnpm typecheck` ok · `pnpm lint` ok · `pnpm test` ok · `pnpm gate:planning` ok · `pnpm ticket:github` ok (dry-run on MF-0019/0026/0041, then live) (MF-0055 worktree, 2026-11-06).

### Iteration 1

```yaml
phase: 1-complete
verdict: PASS
started_at: "2026-11-06"
completed_at: "2026-11-06"
```

**Result:** PASS: SC-1…SC-6. The project's Status options were replaced to add In Review, which cleared the 53
items' Status; `pnpm ticket:github --all` restored them.
**Suggested commit message:** `MF-0055 feat: sync tickets to GitHub issues + project, See it yourself hand-off`

### Close-out (2026-11-06, by the MF-0054 session, at the user's request)

- Applied the `feat/MF-0055` worktree's uncommitted work onto `main` (3d1f5ed, after MF-0054 / PR #86) in the main worktree,
  uncommitted. `ci.yml` conflicted with MF-0054's identical `fetch-depth: 0` and was resolved to `main`'s version.
- Gates on the combined tree: typecheck 0 · lint 0 · test 764/764 · gate:planning 0. The ticket's test file is 22/22
  (the evidence's "25/25" was wrong).
- Missing records written: LOOP-VERIFY.md (no frozen RED: not done by the building session) and RETRO.md.
- `goal_status` stays `complete-pending-manual-commit`: the developer commits. The issue (#85) closes when a commit or PR
  with `Closes #85` merges.

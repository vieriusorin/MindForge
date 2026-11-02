---
name: gsd-goal-loop
description: P4T's ticket lifecycle, modelled on the AI-native SDLC (Plan → Design → Build → Test → Deploy → Maintain → Retro). Takes one PT-#### ticket from intent to a verified, uncommitted hand-off under .planning/tasks/<ID>/ (GOAL.md, LOOP-PLAN.md, LOOP-VERIFY.md) plus .planning/evidence/<ID>.md, looping Build↔Test until `pnpm ticket:verify` writes a PASS receipt for the current tree, and escalating instead of guessing. Flags: --research (evidence answers questions before the user does), --autonomous (unattended; role agents, park instead of ask — what `pnpm agents:night` runs). Use for "/gsd-goal-loop <ID> <brief>", "/gsd-goal-loop" (resume), or any Normal / High-risk ticket. Not for spikes.
---

# GSD Goal Loop — the P4T ticket lifecycle

One ticket, six stages, one rule above all of them: **pontaj must be trustworthy**, and a green
suite is not proof that it is. The stages follow Anthropic's *AI-native SDLC playbook*
(academy.claude.com/courses/ai-native-sdlc-playbook), mapped onto what this repo actually has:

| Playbook stage | Here | Artifact | Human checkpoint |
|---|---|---|---|
| 1 Plan — capture intent | **INTAKE** | `GOAL.md` (Objective, Constraints, Open questions) | user confirms the intent |
| 2 Design — requirements + design | **DESIGN** | `GOAL.md` Success Criteria + Concerns, grilled | concerns resolved by their owner |
| 3 Build — plan mode, then code | **PLAN**, **BUILD** | `LOOP-PLAN.md`, the diff | High-risk: user approves the plan |
| 4 Test — feedback loop | **TEST** | `LOOP-VERIFY.md`, `.planning/evidence/<ID>.md` | none — evidence is toolchain output |
| 5 Deploy — gated | **HAND-OFF** | changed files + suggested commit | developer commits, pushes, migrates |
| 6 Maintain — close the loop | **WATCH** (optional) | a new ticket's `GOAL.md`, never an in-place fix | user triages |
| — Learn — improve the loop | **RETRO** | `RETRO.md`; memory / skill edits, reserved gate tickets | none — automatic; the diff is the review |

The playbook's principle holds verbatim: *the agent may act up to the gate and cannot pass it.*
Here the gate is `git commit` (`.claude/rules/no-commit.md`) and any write to a shared database.

**References — read the one for the stage you are in:**

- `references/templates.md` — GOAL / LOOP-PLAN / LOOP-VERIFY / evidence / hand-off, exact shapes
- `references/verification.md` — the proof ladder, the commands, and the traps that fake a green
- `references/escalation.md` — when to stop and ask, who owns the answer, how to phrase it
- `references/research.md` — `--research`: triage questions, researcher → interpreter agents
- `references/autonomous.md` — `--autonomous`: the unattended orchestration, parking, the night
- `references/retro.md` — Stage 7: the fresh-context retrospective and where its lessons land
- `docs/autonomous-loop.md` — the whole system with diagrams (receipts, agents, runner, metrics)

**Done is a receipt, not a sentence.** `pnpm ticket:verify <ID>` runs the checks and
appends a hash-chained receipt bound to the diff; `--status` says DONE only when the latest one
is PASS *for this exact tree*. `pnpm ticket:eval <ID>` checks the lifecycle itself was followed.
Nobody — this skill, a subagent, you — writes "green" anywhere else.

**Role agents:** `ticket-planner`, `acceptance-writer`, `schema-builder`,
`service-builder`, `ui-builder`, `verifier`, `diff-reviewer`, `researcher`,
`research-interpreter`, `retro`. Each writes only inside its scope — `.claude/hooks/agent-scope.mjs`
denies the rest. Interactive runs may use them; `--autonomous` must.

Related loops: `feature-loop` / `ralph-loop` fan out specialist agents; this skill is the
single-thread lifecycle and may call them as reviewers. `p4t-ticket-invariant` owns the tier
rules; this skill applies them.

---

## Stage 0 — Bootstrap

**With an ID and brief** (`/gsd-goal-loop PT-0310 propose …`):
- Check the number is free before anything else — sessions share one worktree and tickets are
  reserved inside other GOALs: `grep -rn "PT-0310" .planning src e2e`. Taken → pick the next and
  say so.
- `mkdir -p .planning/tasks/<ID>` **immediately**, so a parallel session sees the claim.

**With a brief and no ID:** take the next free number the same way. New tickets are `PT-####`;
`LS-####` is the legacy series, kept on resume.

**Flags:** `--research` → `references/research.md` for every open question. `--autonomous` →
`references/autonomous.md` governs every stage; it implies `--research` and requires
`autonomy: ready` (the runner checks it). Without `--autonomous` the human checkpoints below stand.

**With no args (resume):** list `GOAL.md` files with `goal_status: in-progress` newest-first by
mtime (there are stale ones), show the top few with their `stage:`, and ask which. Resume at the
recorded `stage:`, re-reading GOAL and the last LOOP-* files — never from memory.

---

## Stage 1 — INTAKE (Plan: capture intent)

Write `GOAL.md` from the brief using the template. The intent half answers *what is wanted, why,
under which constraints*: Objective (problem today → end state), Affected users and surfaces
(roles from `RBAC-MATRIX.md`, routes, tables), Constraints, Out of Scope, Open questions.

Read before drafting, not after: `.planning/PROJECT.md` (Active / **Out of Scope** / **Key
Decisions**), the GOALs of the tickets this one builds on, and `memory/` entries on the area.
A brief that walks into an Out-of-Scope fence is an escalation, not an Objective.

Set `tier:` (spike / normal / high-risk, per `p4t-ticket-invariant`). High-risk here means:
`src/server/db/schema/` or a migration, `src/server/authz/`, RLS, Supabase auth wiring,
`getServiceDb` / unscoped `db` callers, anything the RBAC matrix governs, and **any pontaj,
diurnă, cost-engine or money figure**. A spike does not use this loop — say so and stop.

## Stage 2 — DESIGN (requirements + design in one session)

Turn intent into **numbered, falsifiable Success Criteria** (SC-1…), each naming the proof that
will close it (an oracle test, a DB test, a gate, a browser observation). An SC that cannot name
its proof is not finished. Add a **Constraints → how met** line per constraint, and a
**Concerns** list: every point where two rules or two readings collide, each with an owner.

Decide what follows from existing decisions and record it under "Decided without a question",
with the ticket it follows from. Ask only what does not — see `references/escalation.md`.
Two defensible business answers → an Administrator-chosen setting, not a guess (P4T may be sold).

Then run `grill-with-docs` against the draft and fold the answers back. With `--research`, triage
each question the grill raises (`references/research.md`) before putting it to the user: facts
go to the researcher → interpreter pipeline and come back as answers to confirm, decisions come
to the user with the evidence attached. **Checkpoint:** show the
user the SCs and open concerns; Build does not start while a concern with a non-agent owner is
open. The SCs are now frozen — changing one later goes through the user.

### Stage 2b — RED: the acceptance tests, written before the code (PT-0315)

Every SC whose proof is a test gets that test **now**, from the requirement, in a dedicated file
(`__tests__/<id>-<topic>.acceptance.test.ts`, e.g. `pt0316-overtime.acceptance.test.ts`), one
`it("SC-n: …")` per SC. Expected values are literal numbers from the SC, never the output of code.
The red must be a RUNTIME failure: `pnpm typecheck` stays green, or the Stop gate blocks on it.
For a module the plan will create, add a typed stub that throws `new Error("not implemented")`
first; read a data file the plan will create with `readFileSync`, never `import` (PT-0316: a
missing `.json` import was TS2732 in the tests layer, which has no `resolveJsonModule`).

```bash
pnpm ticket:freeze PT-#### <acceptance test files...>
```

`scripts/freeze-tests.mjs` runs them on the test stack and **refuses a file that is already
green** — a test that passes before the change proves nothing about it. It writes
`.planning/tasks/<ID>/FROZEN.json` (sha256 per file + the first failure). Paste each RED line into
LOOP-VERIFY.md under "RED at freeze": that is the proof each test fails *for the expected reason*;
a red caused by a typo or a missing fixture is not the SC's red — fix the test and freeze again.
A red at the authz or service layer can hide a fixture that is wrong one layer down. When an SC's
happy path crosses RLS (an INSERT or UPDATE by a non-Administrator, scoped by
`app.is_employee_in_my_managed_scope` or another posting-based policy), write the fixture's
posting (`santier_allocations` in force on `current_date`) and the actor's session before
freezing. Check it by temporarily running the SC against a stub that bypasses authz, so the red
you freeze is the SC's own, not just the first layer's (PT-0364 retro).

A DB acceptance test's fixture and teardown must also survive the freeze, not just the SC bodies.
Seed only rows the real schema accepts (a person on two sites the same day needs non-overlapping
shifts: `pontaj_entries_no_overlap_closed`), and make `afterAll` delete in child-first order and
tolerate a table the ticket has not migrated yet. At freeze run the file twice: a second run that
fails on rows the first left behind is a fixture defect, not the SC's red (PT-0381 retro).

From here the harness enforces what used to be an instruction:
- an Edit/Write to a frozen file **asks the user** (`.claude/hooks/guard-protected.mjs`);
- the Stop gate treats those files' red as expected while `stage:` is intake…build, and as a
  blocking failure from `stage: test` on (`.claude/hooks/stop-gate.mjs`);
- changing the contract is `pnpm ticket:freeze <ID> --refreeze --reason "<what the user agreed>"`,
  recorded in the manifest's `history`. Only after the user agreed — never to get green.

SCs proved by a gate, a DB read-back or a screen are not frozen; they keep their named proof.
`--allow-green "<why>"` is for a regression lock (an SC that says "X must keep working").

## Stage 3a — PLAN (plan mode: read, don't write)

Discovery is reading, not editing: grep case-insensitively, read the files whole, find the
precedent ticket that solved the same shape, and list which `gate:*` paths the files sit on
(`COMPONENT_SPLIT_MIGRATED_PATHS`, `I18N_MIGRATED_PATHS`, the allowlists). Load the per-path
skill from the `CLAUDE.md` table before planning a file it governs.

**Delegate the wide reads, keep the deep ones.** Every file read here stays in this context for
the rest of the ticket, and cache reads — calls × context size — are most of a ticket's tokens.
"How does the repo do X today", "which ticket solved this shape", "every caller of Y" go to
`researcher` (`kind: code`, `references/research.md` §5): its findings arrive as file:line
claims, not file dumps. The files the plan will **change**, and anything on the high-risk list,
are read here whole — a summary drops exactly the detail those need.

Write `LOOP-PLAN.md` (or dispatch `ticket-planner` to): discovery summary, SC → steps coverage,
ordered steps with exact paths, the tests that prove each SC, **the riskiest step**, **rejected
options** with why, and the ```` ```json tasks ```` graph — one task per builder dispatch, each
with `agent`, `owns`, `depends_on`, `closes`, `done_when`, `context` (`references/templates.md`).
`pnpm ticket:eval <ID>`'s `plan` row validates it: acyclic, known agents, every SC closed. Done when
an engineer who never saw this conversation could implement from the plan alone.

High-risk: present the plan and wait for approval. Normal: proceed.

## Stage 3b — BUILD

First, once per ticket: `pnpm ticket:verify <ID> --baseline` — the red that exists before any
change, so later receipts count only NEW failures. (`agents:night` does this for you.)

Order: schema/types → pure logic + its oracle tests → service → action → UI → strings (ro + en).
- **Inside the frozen frame, small red-green steps** (`tdd` skill): one inner unit test → the
  code that passes it → repeat. Inner tests live in normal `*.test.ts` files and may change; the
  frozen acceptance files may not. Work the SCs one at a time until each acceptance test turns
  green — do not write all the code and then look.
- **Bug fix = test first.** Write the failing test, run it, confirm it fails *for the expected
  reason*, then fix without touching the test.
- **Never edit a test or a gate allowlist to go green.** An allowlist addition needs a Key
  Decisions entry — escalate. Gate scripts, CI, lint/test config and these hooks are guarded:
  editing them asks the user.
- Migrations: `pnpm drizzle-kit generate`, read the SQL, then the **test** stack only
  (`pnpm db:test:migrate`). Never `push`; never migrate dev/staging/prod yourself.
- Diverged from the plan? Update `LOOP-PLAN.md` before continuing, not after.
- Stay inside the ticket. Pre-existing breakage you trip over is noted, not fixed.
- `biome check --write` only on your own paths. Never commit.

## Stage 4 — TEST (the feedback loop)

Set `stage: test` in GOAL.md **first**: from that moment the Stop gate runs the FULL related
test set (not just the co-located tier) and a red acceptance test blocks the turn.

Climb `references/verification.md` from the bottom: oracle unit → DB tests via `pnpm test
<paths>` → `pnpm typecheck` → every `gate:*` enumerated from `package.json` → `pnpm lint:all` →
full `pnpm test` to a log → browser check on the test stack for anything a user sees.
Then `pnpm ticket:verify <ID>` — the receipt is the evidence; the Stop gate banner is only the
per-turn cheap tier. `pnpm ticket:verify <ID> --status` must print DONE before Stage 5; quote
its output, never paraphrase it. `~ preexisting` rows were red in the baseline and are not yours.
High-risk adds a **fresh-context reviewer** (a subagent, or `/code-review`) that reads the diff
against GOAL + LOOP-PLAN — the agent that wrote the code does not sign it off.

Write `LOOP-VERIFY.md` (one row per SC: verdict + literal evidence) and the evidence bundle
`.planning/evidence/<ID>.md`. Evidence is pasted toolchain output and observed screens, never
"should work". Anything unverified is listed as unverified. A bug the fresh-context reviewer finds gets its
regression test shown RED first: add the test, run it against the unfixed code (stash the fix or
revert the hunk), paste the failing line into LOOP-VERIFY.md, then restore the fix. A test written
after the fix and never seen red does not count (PT-0381 retro).

**Decision** (the receipt's `stop rule:` line computes the first, third and fourth for you):
- `--status` DONE and `pnpm ticket:eval <ID>` HEALTHY → Stage 5.
- A step's code is wrong → back to BUILD, same iteration plan.
- The plan is wrong → back to PLAN, increment `last_iteration`, overwrite LOOP-PLAN/VERIFY,
  append to the Iteration Log.
- The SC itself is wrong, or **the same SC fails twice** → stop and escalate.

## Stage 5 — HAND-OFF (deploy gate: the developer passes it)

Set `goal_status: complete-pending-manual-commit`, tick the SCs, append the Iteration Log entry,
then give the user the hand-off from the template: changed files (flag hunks in files other
sessions also touch), suggested commit `PT-#### <type>: <description>`, ordering against
uncommitted sibling tickets, every manual step left (dev-clone migration, staging migration,
env var, client question), and what was **not** verified. Then Stage 7.

## Stage 6 — WATCH (optional, read-only)

Only when the user says it is pushed. Read the Vercel deployment state and runtime errors for
`p4t-staging` (Vercel MCP, read tools only), and the staging DB through read-only queries. A
problem found here is **not** patched in place: draft a new ticket's `GOAL.md` (Stage 1 format:
evidence, proposed outcome, open questions) and hand it to the user to triage. When a failure is
fixed, its regression test is part of that fix. A lesson from it feeds the ticket's RETRO.md.

## Stage 7 — RETRO (learn: the next ticket starts smarter and cheaper)

After HAND-OFF, and after a PARK. `pnpm ticket:retro <ID>` gathers the facts (receipts, freeze
history, research classes, review, tokens vs the median ticket); the `retro` agent, in a fresh
context, writes `RETRO.md` — what went right, what went wrong, a cause from a closed set, and **at
most two actions**, each landing in a gate, a skill, or memory, in that order of preference.
Update or delete a memory entry before adding one. **It is automatic:** the `retro-trigger.mjs`
Stop hook will not let the turn end until a finished-with-evidence or parked ticket has an applied
RETRO.md; the actions are applied by a closed policy without asking (removals and loosenings are
held; a gate becomes a reserved ticket, never built in place; night lanes defer to the next
interactive session). Every ~10 tickets, `pnpm ticket:retro --across` finds lessons learned
twice — those become gates. Full procedure: `references/retro.md`.

---

## GOAL.md status and stage — closed sets

`autonomy: ready` (optional) — set by the user after the freeze; the only way into `agents:night`.

`stage:` intake · design · plan · build · test · handoff · watch — RETRO does not set a stage
(it reads a finished ticket; `RETRO.md` existing is the record). The Stop gate reads it: red
acceptance tests are expected up to `build`, block from `test`, and `test`+ runs the full related set.

`goal_status:` `reserved` (number claimed, nothing yet) · `in-progress` · `blocked-on-<owner>`
(user / client / infra / PT-####) · `complete-pending-manual-commit` · `withdrawn`. Older GOALs carry
free-form values; on resume, map them to this set and say which you assumed.

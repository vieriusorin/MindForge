---
name: gsd-goal-loop
description: A ticket lifecycle modelled on the AI-native SDLC (Plan → Design → Build → Test → Deploy → Maintain → Retro). Takes one ticket from intent to a verified, uncommitted hand-off under .planning/tasks/<ID>/ (GOAL.md, LOOP-PLAN.md, LOOP-VERIFY.md) plus .planning/evidence/<ID>.md, freezing acceptance tests red before code, looping Build↔Test until the project's verify command records a PASS for the current tree, and escalating instead of guessing. Flags: --research (evidence answers questions before the user does), --autonomous (unattended; role agents, park instead of ask). Use for "/gsd-goal-loop <ID> <brief>", "/gsd-goal-loop" (resume), "take this ticket end to end", or any Normal / High-risk ticket. Not for spikes.
---

# GSD Goal Loop — a ticket lifecycle

One ticket, six stages, one rule above all of them: **the figures and records users rely on must
be trustworthy**, and a green suite is not proof that they are. The stages follow Anthropic's
*AI-native SDLC playbook* (academy.claude.com/courses/ai-native-sdlc-playbook):

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
The gate is `git commit` and any write to a shared database.

## Project bindings — resolve once per session

Read `package.json` scripts, `CLAUDE.md` / `AGENTS.md` and `.planning/` before Stage 0. Use the
project's own value when it exists; otherwise use the default and say so in the evidence.

| Binding | What to look for | Default if absent |
|---|---|---|
| `PREFIX` — ticket ID series | existing `.planning/tasks/*`, commit messages, CLAUDE.md | `T` → `T-0001` |
| `VERIFY` — verify + receipt | a `ticket:verify`-style script | run TYPECHECK, GATES, LINT, TEST; append outputs + `git diff HEAD \| shasum -a 256` to LOOP-VERIFY.md as the receipt |
| `FREEZE` — freeze acceptance tests | a `ticket:freeze`-style script | run each file, confirm it is red, write `FROZEN.json` with `shasum -a 256` per file + first failure line |
| `EVAL` — process check | a `ticket:eval`-style script | check by hand: plan graph acyclic, every SC closed, review hash = current tree |
| `RETRO_FACTS` | a `ticket:retro`-style script | gather receipts, iterations, research classes, review from `.planning/tasks/<ID>/` |
| `TYPECHECK` · `TEST` · `LINT` · `GATES` | `typecheck`, `test`, `lint*`, `gate:*` scripts | `tsc --noEmit`, the test runner, the linter; no gates |
| `TEST_DB` | a test-stack DB + migrate command | none: DB-backed proof is unavailable — say so |
| `PROJECT_DOC` | `.planning/PROJECT.md` (Out of Scope, Key Decisions) | CLAUDE.md |
| `ACCESS_DOC` | a roles / permissions matrix | none — every access question is `decision` |
| `NIGHT_RUNNER` | an unattended runner script | none — `--autonomous` runs in the current session |
| `HIGH_RISK` | high-risk paths in CLAUDE.md / `ticket-traceability` | schema + migrations, authz / access policy, auth wiring, privileged DB clients, money and other derived figures |

**References — read the one for the stage you are in:**

- `references/templates.md` — GOAL / LOOP-PLAN / LOOP-VERIFY / evidence / hand-off, exact shapes
- `references/verification.md` — the proof ladder, the commands, and the traps that fake a green
- `references/escalation.md` — when to stop and ask, who owns the answer, how to phrase it
- `references/research.md` — `--research`: triage questions, researcher → interpreter agents
- `references/autonomous.md` — `--autonomous`: the unattended orchestration, parking
- `references/retro.md` — Stage 7: the fresh-context retrospective and where its lessons land

**Done is a receipt, not a sentence.** VERIFY records the checks bound to the diff; DONE means the
latest receipt is PASS *for this exact tree*. EVAL checks the lifecycle itself was followed.
Nobody — this skill, a subagent, you — writes "green" anywhere else.

**Role agents (optional — if the project defines them; otherwise run the role inline):**
`ticket-planner`, `acceptance-writer`, `schema-builder`, `service-builder`, `ui-builder`,
`verifier`, `diff-reviewer`, `researcher`, `research-interpreter`, `retro`. Each writes only inside
its scope (enforce with a scope hook if the project has one). `--autonomous` should use them.

Related: `feature-loop` / `ralph-loop` fan out specialist agents; this skill is the single-thread
lifecycle and may call them as reviewers. `ticket-traceability` owns the tier rules; this applies them.

---

## Stage 0 — Bootstrap

**With an ID and brief** (`/gsd-goal-loop <PREFIX>-0042 add …`):
- Check the number is free first — sessions may share one worktree and tickets get reserved inside
  other GOALs: `grep -rn "<PREFIX>-0042" .planning src`. Taken → pick the next and say so.
- `mkdir -p .planning/tasks/<ID>` **immediately**, so a parallel session sees the claim.

**With a brief and no ID:** take the next free number the same way.

**Flags:** `--research` → `references/research.md` for every open question. `--autonomous` →
`references/autonomous.md` governs every stage; it implies `--research` and requires
`autonomy: ready`. Without `--autonomous` the human checkpoints below stand.

**With no args (resume):** list `GOAL.md` files with `goal_status: in-progress` newest-first by
mtime (some are stale), show the top few with their `stage:`, and ask which. Resume at the
recorded `stage:`, re-reading GOAL and the last LOOP-* files — never from memory.

---

## Stage 1 — INTAKE (Plan: capture intent)

Write `GOAL.md` from the template. The intent half answers *what is wanted, why, under which
constraints*: Objective (problem today → end state), Affected users and surfaces (roles from
ACCESS_DOC, routes, tables), Constraints, Out of Scope, Open questions.

Read before drafting, not after: PROJECT_DOC (Active / **Out of Scope** / **Key Decisions**), the
GOALs of the tickets this one builds on, and memory entries on the area. A brief that walks into
an Out-of-Scope fence is an escalation, not an Objective.

Set `tier:` (spike / normal / high-risk, per `ticket-traceability`). High-risk = anything in the
HIGH_RISK binding, and **any figure users are paid, billed or audited from**. A spike does not use
this loop — say so and stop.

## Stage 2 — DESIGN (requirements + design in one session)

Turn intent into **numbered, falsifiable Success Criteria** (SC-1…), each naming the proof that
will close it (an oracle test, a DB test, a gate, a browser observation). An SC that cannot name
its proof is not finished. Add a **Constraints → how met** line per constraint, and a
**Concerns** list: every point where two rules or two readings collide, each with an owner.

Any write that records a judgement about versioned or synced content (review verdict, approval,
flag resolution, attempt) must name the version the actor read and refuse when it differs from the
stored version. State this in the PLAN's riskiest-step section; a plan without it is not ready for
approval (MF-0007 retro: a sync that ran ahead of a deploy let verdicts land on unread content).

Before writing any SC that names an external API's wire format, id pattern, limit or model id, load
the matching skill (for example `claude-api`) and read the live reference. Paste the constraint into
the SC. Before hand-off, run the real command once against real input, because mocks do not prove
input shape (MF-0008 retro: a Batches `custom_id` with dots, and a PDF stored as text).

Decide what follows from existing decisions and record it under "Decided without a question",
with its source. Ask only what does not — see `references/escalation.md`. Two defensible business
answers → a configurable setting chosen by an admin, not a guess.

An SC whose proof needs infrastructure or an account that does not exist yet (a hosted project, a
deploy target, DNS, a third-party sender) is not a code SC. At DESIGN, check read-only that its target
exists (e.g. `supabase projects list`, `vercel ls`, `vercel project ls`) and record the result. If it
does not, move those SCs to their own `reserved` ticket owned by the user, with the runbook as its
deliverable, and keep this ticket to what the local stack can prove. Do not carry them as a `T8 human`
task inside the code ticket.

Before the checkpoint, preflight each SC's proof. (1) Run `pnpm typecheck && pnpm lint && pnpm test`
read-only. If any of them is red and an SC's proof is "that command exits 0", the baseline red is part of
this ticket's scope question: put it in the checkpoint with the file named, as either "fix it as task T0
(listed in the hand-off as a separate hunk)" or "park until its owner fixes it". Do not leave it for BUILD.
(2) List every proof command that wipes or restarts shared local state (`pnpm db:reset`, `supabase stop`,
`supabase start`, `supabase db reset`). For each, either get the user's approval at the checkpoint, or write
the SC's proof so it does not need it (an in-place revert, a scratch schema, a separate worktree). Record
both outcomes under "Decided by the user". Nothing here is asked mid-BUILD.

Then run `grill-with-docs` against the draft and fold the answers back. With `--research`, triage
each question (`references/research.md`) before putting it to the user: facts go to the researcher
→ interpreter pipeline and come back as answers to confirm; decisions come to the user with the
evidence attached. **Checkpoint:** show the user the SCs and open concerns; Build does not start
while a concern with a non-agent owner is open. The SCs are now frozen — changing one later goes
through the user.

### Stage 2b — RED: the acceptance tests, written before the code

Every SC whose proof is a test gets that test **now**, from the requirement, in a dedicated file
(`__tests__/<id>-<topic>.acceptance.test.ts`), one `it("SC-n: …")` per SC. Expected values are
literals from the SC, never the output of code. The red must be a RUNTIME failure: TYPECHECK stays
green. For a module the plan will create, add a typed stub that throws `new Error("not
implemented")`; read a data file the plan will create at runtime, never `import` it (a missing
import is a compile error, not the SC's red).

Before FREEZE, format and lint the acceptance files you wrote (`pnpm exec biome check --write <those
files, listed explicitly>`, then `pnpm lint`). A hash taken before formatting turns the first lint run
into a re-freeze that needs the user.

Run FREEZE on the files. It **refuses a file that is already green** — a test that passes before
the change proves nothing about it — and records a hash per file plus the first failure in
`.planning/tasks/<ID>/FROZEN.json`. Paste each RED line into LOOP-VERIFY.md under "RED at
freeze": proof each test fails *for the expected reason*. A red from a typo or missing fixture is
not the SC's red — fix and freeze again. A red at the access/service layer can hide a fixture that
is wrong one layer down: when the happy path crosses an access policy, seed the actor's
permissions first, and check by running the SC against a stub that bypasses authz, so the red you
freeze is the SC's own.

A DB acceptance test's fixture and teardown must survive the freeze too: seed only rows the real
schema accepts (respect its constraints), delete child-first in `afterAll`, tolerate a table the
ticket has not migrated yet. Run the file twice at freeze: a second run that fails on leftovers is
a fixture defect, not the SC's red.

From here, frozen files are a contract:
- edits to a frozen file **ask the user** (a guard hook, if the project has one; otherwise you ask);
- their red is expected while `stage:` is intake…build, and blocking from `stage: test` on;
- changing the contract is a re-freeze with a recorded reason (`history` in FROZEN.json) — only
  after the user agreed, never to get green.

SCs proved by a gate, a DB read-back or a screen are not frozen; they keep their named proof. A
regression lock ("X must keep working") may be frozen green with a stated reason.

## Stage 3a — PLAN (plan mode: read, don't write)

Discovery is reading, not editing: grep case-insensitively, read the files whole, find the
precedent ticket that solved the same shape, and list which GATES the files sit on (migrated-path
lists, allowlists). Load the per-path skill from CLAUDE.md before planning a file it governs.

**Delegate the wide reads, keep the deep ones.** Every file read here stays in context for the
rest of the ticket, and cache reads dominate a ticket's tokens. "How does the repo do X today",
"which ticket solved this shape", "every caller of Y" go to `researcher` (`kind: code`,
`references/research.md` §5): findings arrive as file:line claims, not dumps. Files the plan will
**change**, and anything HIGH_RISK, are read here whole — a summary drops exactly what they need.

Write `LOOP-PLAN.md` (or dispatch `ticket-planner`): discovery summary, SC → steps coverage,
ordered steps with exact paths, the tests that prove each SC, **the riskiest step**, **rejected
options** with why, and the ```` ```json tasks ```` graph — one task per builder dispatch, each
with `agent`, `owns`, `depends_on`, `closes`, `done_when`, `context` (`references/templates.md`).
EVAL validates it: acyclic, known agents, every SC closed. Done when an engineer who never saw
this conversation could implement from the plan alone.

High-risk: present the plan and wait for approval. Normal: proceed.

## Stage 3b — BUILD

First, once per ticket: a **baseline** VERIFY run — the red that exists before any change, so later
receipts count only NEW failures.

Order: schema/types → pure logic + its oracle tests → service → action → UI → strings (every locale).
- **Inside the frozen frame, small red-green steps** (`tdd` skill): one inner unit test → the code
  that passes it → repeat. Inner tests may change; frozen acceptance files may not. Work the SCs
  one at a time until each acceptance test turns green.
- **Bug fix = test first.** Write the failing test, confirm it fails *for the expected reason*,
  then fix without touching the test.
- **Never edit a test or a gate allowlist to go green.** An allowlist addition needs a Key
  Decisions entry — escalate. Gate scripts, CI, lint/test config and hooks are guarded: ask.
- Migrations: generate, read the SQL, apply to TEST_DB only. Never push schema directly; never
  migrate dev/staging/prod yourself.
- Diverged from the plan? Update `LOOP-PLAN.md` before continuing, not after.
- Stay inside the ticket. Pre-existing breakage you trip over is noted, not fixed.
- Format/fix only your own paths. Never commit.
- One-off content migrations: match indentation with `[ \t]+`, never `\s` — with the `m` flag JS
  treats `\r` as a line end, so `^\s+` swallows the newline in CRLF files. Check the diff's line
  count against the expected count before running tests (MF-0006 retro).

## Stage 4 — TEST (the feedback loop)

Set `stage: test` in GOAL.md **first**: from then on run the FULL related test set, and a red
acceptance test blocks.

Climb `references/verification.md` from the bottom: oracle unit → DB tests → TYPECHECK → every
GATE enumerated from `package.json` → LINT → full TEST to a log → browser check for anything a user
sees. Then VERIFY — the receipt is the evidence. It must say DONE for the current tree before
Stage 5; quote it, never paraphrase. Failures present in the baseline are pre-existing, not yours.
High-risk adds a **fresh-context reviewer** (a subagent, or `/code-review`) reading the diff against
GOAL + LOOP-PLAN — the agent that wrote the code does not sign it off.

Write `LOOP-VERIFY.md` (one row per SC: verdict + literal evidence) and `.planning/evidence/<ID>.md`.
Evidence is pasted toolchain output and observed screens, never "should work"; anything unverified
is listed as unverified. A bug the reviewer finds gets its regression test shown RED first: add the
test, run it against the unfixed code (stash the fix), paste the failing line, then restore the
fix. A test written after the fix and never seen red does not count.

**Decision:**
- VERIFY DONE and EVAL healthy → Stage 5.
- A step's code is wrong → back to BUILD, same iteration plan.
- The plan is wrong → back to PLAN, increment `last_iteration`, overwrite LOOP-PLAN/VERIFY,
  append to the Iteration Log.
- The SC itself is wrong, or **the same SC fails twice** → stop and escalate. Cap iterations
  (default 6).

## Stage 5 — HAND-OFF (deploy gate: the developer passes it)

Set `goal_status: complete-pending-manual-commit`, tick the SCs, append the Iteration Log entry,
then give the hand-off from the template: changed files (flag hunks in files other sessions also
touch), suggested commit `<ID> <type>: <description>`, ordering against uncommitted sibling
tickets, every manual step left (migrations per environment, env vars, stakeholder questions), and
what was **not** verified. Then Stage 7.

## Stage 6 — WATCH (optional, read-only)

Only when the user says it is pushed. Read the deployment state, runtime errors and logs of the
pre-production environment with read-only tools, and its DB through read-only queries. A problem
found here is **not** patched in place: draft a new ticket's `GOAL.md` (evidence, proposed outcome,
open questions) and hand it to the user to triage. A fix carries its regression test. A lesson
from it feeds the ticket's RETRO.md.

## Stage 7 — RETRO (learn: the next ticket starts smarter and cheaper)

After HAND-OFF, and after a PARK. Gather RETRO_FACTS; a `retro` agent in a fresh context writes
`RETRO.md` — what went right, what went wrong, a cause from a closed set, and **at most two
actions**, each landing in a gate, a skill, or memory, in that order of preference. Update or
delete a memory entry before adding one. Ideally automatic (a Stop hook that will not end the turn
until a finished or parked ticket has an applied RETRO.md); actions apply by a closed policy
without asking. Every ~10 tickets, look across retros for lessons learned twice — those become
gates. Full procedure: `references/retro.md`.

---

## GOAL.md status and stage — closed sets

`autonomy: ready` (optional) — set by the user after the freeze; the only way into an unattended run.

`stage:` intake · design · plan · build · test · handoff · watch — RETRO does not set a stage
(`RETRO.md` existing is the record). Red acceptance tests are expected up to `build`, block from
`test`, and `test`+ runs the full related set.

`goal_status:` `reserved` (number claimed, nothing yet) · `in-progress` · `blocked-on-<owner>`
(user / stakeholder / infra / `<ID>`) · `complete-pending-manual-commit` · `withdrawn`. Older GOALs
may carry free-form values; on resume, map them to this set and say which you assumed.

# Templates

Shapes for every artifact this loop writes. Field names are what resume reads — keep them.
Prose in these files is English; quote UI strings and domain nouns as they appear in the product.
`<ID>` below is `<PREFIX>-####` from the Project bindings.

---

## GOAL.md — `.planning/tasks/<ID>/GOAL.md`

Written in INTAKE, completed in DESIGN, frozen before PLAN. The Iteration Log is append-only.

```markdown
---
ticket_id: <PREFIX>-0042
tier: normal                      # spike | normal | high-risk
stage: design                     # intake | design | plan | build | test | handoff | watch
branch: main                      # the branch the work sits on; this loop never creates one
builds_on: [<PREFIX>-0040]        # tickets whose uncommitted work this depends on, or []
last_iteration: 0
goal_status: in-progress          # reserved | in-progress | blocked-on-<owner> |
                                  # complete-pending-manual-commit | withdrawn
autonomy: ready                   # optional: set by the USER after the freeze; admits
                                  # the ticket to an unattended run
---

## Objective

<the problem today, in the user's terms → the end state, concretely. One or two paragraphs.>

## Affected

- **Roles:** <from ACCESS_DOC — who sees / does what differently>
- **Surfaces:** <routes, components, services, tables>

## Constraints

- <a rule this must respect> → <how it is met>
- Derived figures come from the one domain service that owns them (calculation parity).

## Decided without a question

- <decision> — follows from <ticket / Key Decision / code fact at file:line>.

## Success Criteria

- [ ] SC-1: <falsifiable outcome>. Proof: <oracle test in X | DB test | gate | browser: …>
- [ ] SC-2: …
- [ ] SC-n: strings in every locale; evidence file; every gate; browser check of <screen>.

## Concerns

| # | Collision | Owner | Status |
|---|-----------|-------|--------|
| C-1 | <rule A vs rule B, or two readings of the brief> | user / stakeholder / <ticket> | open / resolved: … |

## Out of Scope

- <explicit exclusion, with the reason or the ticket that will own it>

## Open questions

- <unanswered, with the owner> (empty before PLAN unless carried forward as a Concern)

## Iteration Log

<!-- append-only -->
```

---

## LOOP-PLAN.md — overwritten each iteration

```markdown
---
phase: <N>-planning
ticket_id: <ID>
status: executing                 # executing | superseded
verdict: IN_PROGRESS
started_at: "<YYYY-MM-DD>"
resume_with: /gsd-goal-loop
---

# Loop Plan — Iteration <N>

## Discovery summary

<what exists, with file:line; the precedent ticket and the pattern it set; current vs required
behaviour; which gates the touched paths sit on>

## SC coverage

| SC | Steps | Proof |
|----|-------|-------|
| SC-1 | 2, 3 | `<path>/__tests__/x.test.ts` — oracle cases a, b, c |

## Steps

1. `<path>/x.ts` — <exact change>
2. `<path>/__tests__/x.test.ts` — <cases, with the expected values written out>
3. …

## Riskiest step

<which one, why, and how the proof catches it going wrong>
For every UI predicate that gates a write (a disabled button, a canX() helper), name the SERVER refusal that holds when the UI is bypassed (stale tab, double click, direct action call, two concurrent requests) and the test that calls the service twice and expects the second refused. "Only the UI stops it" is a blocking plan defect.

## Rejected options

- <option> — <why not>

## Verify

- VERIFY `<ID>` — the receipt must say DONE for this tree
- EVAL `<ID>` — the process read back from these files
- browser: <screen, role, what must be seen>

## Tasks — the graph the orchestrator dispatches; exactly one block

```json tasks
[
  { "id": "T1", "title": "discount rule + inner tests", "agent": "service-builder",
    "owns": ["src/<services>/billing/discount/**"],
    "depends_on": [], "closes": ["SC-1", "SC-2"],
    "done_when": ["<TEST> src/<services>/billing/discount/__tests__/<id>-discount.acceptance.test.ts", "<TYPECHECK>"],
    "context": ["skill:typescript-strict"] },
  { "id": "T2", "title": "settings screen", "agent": "ui-builder",
    "owns": ["src/<features>/settings/**", "<i18n dictionaries>"],
    "depends_on": ["T1"], "closes": ["SC-3"],
    "done_when": ["<GATES>", "<TYPECHECK>"],
    "context": ["skill:ui-shadcn"] }
]
```
```

`agent` ∈ schema-builder · service-builder · ui-builder · acceptance-writer (or `inline` when the
project has no role agents). `owns` are globs; EVAL's scope check compares the diff against them
(a scope hook, if any, enforces coarser per-role limits). Tasks that may run in parallel need
disjoint `owns`. `done_when` are commands the orchestrator re-runs itself — a builder's STATUS
line is a claim.

Two plan-time checks:

1. **Shared-contract consumers.** A task that replaces an existing DB function / view, or changes
   a column's type or shape, lists its consumers in `context`. `grep -rln '<name>' src e2e scripts`
   and put every test hit into that task's `owns`, or a named "update existing assertion" step. An
   output shape is a contract; a test outside every `owns` is otherwise caught only by VERIFY.
2. **Key Decisions written up front.** When a step justifies a protected edit or a behaviour
   change by citing a Key Decision, that entry is a `done_when` of the task making the change
   (`grep -n '<ID>' <PROJECT_DOC>` must hit). Do not defer it to a final step; the reviewer will
   find it missing.

---

## REVIEW.md — `.planning/tasks/<ID>/REVIEW.md` (diff reviewer only)

```markdown
---
verdict: approve                  # approve | changes-requested
reviewed_hash: <tree hash from the latest VERIFY receipt>
reviewed_at: <ISO timestamp>
---
## Findings
- [blocking] src/x.ts:42 — <what is wrong> — <what it breaks>
- [note] …
```

A review whose `reviewed_hash` is not the current tree is void.

---

## LOOP-VERIFY.md — overwritten each iteration

```markdown
---
phase: <N>-verification
ticket_id: <ID>
status: complete                  # complete | needs-iteration | blocked
verdict: PASS                     # PASS | FAIL
started_at: "<YYYY-MM-DD>"
completed_at: "<YYYY-MM-DD>"
resume_with: /gsd-goal-loop
---

# Verification — Iteration <N>

## RED at freeze (Stage 2b)

| SC | Acceptance test | Red reason at freeze (pasted) |
|----|-----------------|-------------------------------|
| SC-1 | `<id>-x.acceptance.test.ts` | `AssertionError: expected 0 to be 1234_00` — the figure does not exist yet |

| SC | Verdict | Evidence |
|----|---------|----------|
| SC-1 | PASS | `x.test.ts` 17/17 (5 new, literal expectations) |
| SC-2 | FAIL | expected <…>, observed <…> at file:line |

## Gates and suite

Last gate output, verbatim (or the RED one). typecheck <result> · gates <n>/<n> · lint <result> ·
full suite <pass>/<total>; failures outside this ticket named, with why they are not this diff's.

## Receipt (when VERIFY has no script)

`<UTC timestamp> · tree <sha256 of git diff HEAD> · typecheck <exit> · gates <n>/<n> · lint <exit> · test <pass>/<total> · PASS|FAIL` — append-only, one line per run.

## Not verified

- <anything not proven, and why>

## Verdict: PASS | FAIL
```

---

## Evidence bundle — `.planning/evidence/<ID>.md`

The durable record; the LOOP files are working copies.

```markdown
# <ID> — <title in plain English>

**Tier:** normal (<one-line why>). **Date:** <YYYY-MM-DD>. **Goal:** `.planning/tasks/<ID>/GOAL.md`.

| Proof | Result |
|-------|--------|
| <test file — what its cases assert> | 17/17 |
| <DB test on the test stack> | 3/3 |
| Gates / types / lint | <n>/<n>, typecheck, 0 lint errors |
| Browser (test stack, role <x>) | <what was seen> |
| Reviewer (high-risk only) | passed / failed / waived: <reason> |
| Receipt (VERIFY) | DONE — <verdict>, tree <first 12 of hash>, <n> receipts |
| Process eval (EVAL) | healthy / the failing rows |

## Notes for the committer

- <ordering against sibling tickets; files shared with other sessions — stage by hunk>

## Files

New: …
Modified (<ID> hunks): …
```

---

## Iteration Log entry — appended to GOAL.md

~~~markdown
### Iteration <N>

```yaml
phase: <N>-complete               # or <N>-failed
verdict: PASS                     # or FAIL
started_at: "<YYYY-MM-DD>"
completed_at: "<YYYY-MM-DD>"
```

**Result:** <PASS: all SCs. FAIL: which SC, what was observed, what the next iteration changes.>
**Suggested commit message:** `<ID> feat: <description>`
~~~

---

## Hand-off message (to the user, Stage 5)

```
<ID> — <title>: all <n> Success Criteria pass.

Changed files
  new       src/…
  modified  src/…            (also holds <OTHER-ID> hunks — stage by hunk)

Suggested commit
  <ID> feat: <description>

Before / after committing
  - commit <OTHER-ID> first (this builds on its uncommitted changes)
  - run migration <n> on the dev database
  - staging: run migrations after the push

Not verified
  - <e.g. the e-mail send, which needs a real provider key>
```

---

## RETRO.md — `.planning/tasks/<ID>/RETRO.md`

If the project has a `retro` agent, its definition owns the shape. Otherwise: front matter with
`causes` (closed set: none · plan-gap · sc-wrong · fixture · tooling · scope · research-late ·
other), `actions` (memory-add/update/delete · skill-edit · gate), `lesson_keys`, `applied`; then
Right / Wrong / Cause / Actions sections.

---

## Escalation message — see `escalation.md`

```
Blocked on <ID> SC-<n>: <one sentence>.
What I found: <fact, file:line or command output>.
Options: A) <…> — consequence. B) <…> — consequence.
I recommend <A>, because <reason>. Nothing has been changed for this yet.
```

# Templates

Shapes for every artifact this loop writes. Field names are what resume reads — keep them.
Prose in these files is English; quote Romanian UI strings and domain nouns as they appear.

---

## GOAL.md — `.planning/tasks/<ID>/GOAL.md`

Written in INTAKE, completed in DESIGN, frozen before PLAN. The Iteration Log is append-only.

```markdown
---
ticket_id: PT-0310
tier: normal                      # spike | normal | high-risk
stage: design                     # intake | design | plan | build | test | handoff | watch
branch: staging                   # the branch the work sits on; this loop never creates one
builds_on: [PT-0308, PT-0309]     # tickets whose uncommitted work this depends on, or []
last_iteration: 0
goal_status: in-progress          # reserved | in-progress | blocked-on-<owner> |
                                  # complete-pending-manual-commit | withdrawn
autonomy: ready                   # optional: set by the USER after the freeze; admits
                                  # the ticket to `pnpm agents:night`
---

## Objective

<the problem today, in the user's terms → the end state, concretely. One or two paragraphs.>

## Affected

- **Roles:** <from RBAC-MATRIX.md — who sees / does what differently>
- **Surfaces:** <routes, components, services, tables>

## Constraints

- <a rule this must respect> → <how it is met>
- Pontaj / money / diurnă figures come from `server/services/cost-engine/` (calculation parity).

## Decided without a question

- <decision> — follows from <PT-#### / Key Decision / code fact at file:line>.

## Success Criteria

- [ ] SC-1: <falsifiable outcome>. Proof: <oracle test in X | DB test | gate | browser: …>
- [ ] SC-2: …
- [ ] SC-n: ro + en strings; evidence file; every gate; browser check of <screen>.

## Concerns

| # | Collision | Owner | Status |
|---|-----------|-------|--------|
| C-1 | <rule A vs rule B, or two readings of the brief> | user / client / <ticket> | open / resolved: … |

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
ticket_id: PT-0310
status: executing                 # executing | superseded
verdict: IN_PROGRESS
started_at: "<YYYY-MM-DD>"
resume_with: /gsd-goal-loop
---

# Loop Plan — Iteration <N>

## Discovery summary

<what exists, with file:line; the precedent ticket and the pattern it set; current vs required
behaviour; which gates the touched paths sit on (component-split, i18n, allowlists)>

## SC coverage

| SC | Steps | Proof |
|----|-------|-------|
| SC-1 | 2, 3 | `src/…/__tests__/x.test.ts` — oracle cases a, b, c |

## Steps

1. `src/server/…/x.ts` — <exact change>
2. `src/server/…/__tests__/x.test.ts` — <cases, with the expected values written out>
3. …

## Riskiest step

<which one, why, and how the proof catches it going wrong>
For every UI predicate that gates a write (a disabled button, a canX() helper), name the SERVER refusal that holds when the UI is bypassed (stale tab, double click, direct action call, two concurrent requests) and the test that calls the service twice and expects the second refused. "Only the UI stops it" is a blocking plan defect (PT-0382 retro).

## Rejected options

- <option> — <why not>

## Verify

- `pnpm ticket:verify PT-0310` — the receipt; `--status` must say DONE
- `pnpm ticket:eval PT-0310` — the process read back from these files
- browser: <screen, role, what must be seen>

## Tasks — the graph the orchestrator dispatches; exactly one block

```json tasks
[
  { "id": "T1", "title": "overtime rule + inner tests", "agent": "service-builder",
    "owns": ["src/server/services/pontaj/overtime/**", "src/lib/overtime*.ts"],
    "depends_on": [], "closes": ["SC-1", "SC-2"],
    "done_when": ["pnpm test src/server/services/pontaj/overtime/__tests__/pt0310-overtime.acceptance.test.ts", "pnpm typecheck"],
    "context": ["skill:p4t-typescript", "memory:pt0310-0311-norm-and-overtime"] },
  { "id": "T2", "title": "settings screen", "agent": "ui-builder",
    "owns": ["src/modules/setari/**", "src/i18n/dictionaries/*.ts"],
    "depends_on": ["T1"], "closes": ["SC-3"],
    "done_when": ["pnpm gate:component-split", "pnpm gate:i18n", "pnpm typecheck"],
    "context": ["skill:p4t-ui-shadcn"] }
]
```
```

`agent` ∈ schema-builder · service-builder · ui-builder · acceptance-writer. `owns` are globs the
`ticket:eval`'s `scope` row enforces (the scope HOOK enforces the coarser per-role table in
`.claude/hooks/lib/agent-scopes.mjs`, not `owns`); tasks that may run in parallel need disjoint `owns`.
`done_when` are commands the orchestrator re-runs itself — a builder's STATUS line is a claim.

Two plan-time checks (PT-0384 retro):

1. **Definer consumers.** A task whose migration does `create or replace function` on an existing `app.*` / `public.*` definer, or changes a column's type or shape, lists the function's consumers in its `context`. Run `grep -rln '<function_name>' src e2e scripts` and put every test hit into that task's `owns`, or into a named "update existing assertion" step. A definer's output shape is a contract; a test outside every `owns` is otherwise caught only by `ticket:verify`.
2. **Key Decisions written up front.** When a step justifies a protected edit or a behaviour change by citing a Key Decision, that entry is a `done_when` of the task that makes the change: `grep -n '<PT-####>' .planning/PROJECT.md` must hit. Do not defer it to a final "orchestrator only" step, because the reviewer will find it missing.

---

## REVIEW.md — `.planning/tasks/<ID>/REVIEW.md` (diff-reviewer only)

```markdown
---
verdict: approve                  # approve | changes-requested
reviewed_hash: <64-char tree hash from `pnpm ticket:verify <ID> --status`>
reviewed_at: 2026-10-24T23:10:00Z
---
## Findings
- [blocking] src/x.ts:42 — <what is wrong> — <what it breaks>
- [note] …
```

A review whose `reviewed_hash` is not the current tree is void (`ticket:eval` → review ✗).

---

## LOOP-VERIFY.md — overwritten each iteration

```markdown
---
phase: <N>-verification
ticket_id: PT-0310
status: complete                  # complete | needs-iteration | blocked
verdict: PASS                     # PASS | FAIL
started_at: "<YYYY-MM-DD>"
completed_at: "<YYYY-MM-DD>"
resume_with: /gsd-goal-loop
---

# Verification — Iteration <N>

## RED at freeze (Stage 2b, from `pnpm ticket:freeze`)

| SC | Acceptance test | Red reason at freeze (pasted) |
|----|-----------------|-------------------------------|
| SC-1 | `pt0310-x.acceptance.test.ts` | `AssertionError: expected 0 to be 1234_00` — the figure does not exist yet |

| SC | Verdict | Evidence |
|----|---------|----------|
| SC-1 | PASS | `x.test.ts` 17/17 (5 new, literal expectations) |
| SC-2 | FAIL | expected <…>, observed <…> at file:line |

## Gates and suite

Last Stop gate banner, verbatim: `✓ Stop gate green: typecheck · 11 gates · …` (or the RED one).
typecheck <result> · gates <n>/<n> · lint <result> · full suite <pass>/<total>; failures outside
this ticket named, with why they are not this diff's.

## Not verified

- <anything not proven, and why>

## Verdict: PASS | FAIL
```

---

## Evidence bundle — `.planning/evidence/<ID>.md`

The durable record; the LOOP files are working copies.

```markdown
# PT-0310 — <title in plain English>

**Tier:** normal (<one-line why>). **Date:** <YYYY-MM-DD>. **Goal:** `.planning/tasks/PT-0310/GOAL.md`.

| Proof | Result |
|-------|--------|
| <test file — what its cases assert> | 17/17 |
| <DB test on the test stack> | 3/3 |
| Gates / types / lint | <n>/<n>, typecheck, ESLint 0 errors |
| Browser (:3100, test stack, role <x>) | <what was seen> |
| Reviewer (high-risk only) | passed / failed / waived: <reason> |
| Receipt (`pnpm ticket:verify <ID> --status`) | DONE — <verdict>, tree <first 12 of hash>, <n> receipts, chain intact |
| Process eval (`pnpm ticket:eval <ID>`) | HEALTHY / the failing rows |

## Notes for the committer

- <ordering against sibling tickets; files shared with other sessions — stage by hunk>

## Files

New: …
Modified (PT-0310 hunks): …
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
**Suggested commit message:** `PT-0310 feat: <description>`
~~~

---

## Hand-off message (to the user, Stage 5)

```
PT-0310 — <title>: all <n> Success Criteria pass.

Changed files
  new       src/…
  modified  src/…            (also holds PT-0308 hunks — stage by hunk)

Suggested commit
  PT-0310 feat: <description>

Before / after committing
  - commit PT-0308 first (this builds on its uncommitted proposal changes)
  - `pnpm db:migrate` on the dev clone (migration 0322)
  - staging: `pnpm db:migrate:staging:run` after the push

Not verified
  - <e.g. the e-mail send, which needs a real RESEND key>
```

---

## RETRO.md — `.planning/tasks/<ID>/RETRO.md`

The shape is owned by `.claude/agents/retro.md` (front matter with the closed `causes` /
`actions` sets that `pnpm ticket:retro --across` counts). Do not restate it here.

---

## Escalation message — see `escalation.md`

```
Blocked on <ID> SC-<n>: <one sentence>.
What I found: <fact, file:line or command output>.
Options: A) <…> — consequence. B) <…> — consequence.
I recommend <A>, because <reason>. Nothing has been changed for this yet.
```

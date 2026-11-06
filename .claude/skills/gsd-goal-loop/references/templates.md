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
title: <short plain-English name>  # the GitHub issue title (`pnpm ticket:github`), e.g. "Real group pinning"
tier: normal                      # spike | normal | high-risk
stage: design                     # intake | design | plan | build | test | handoff | watch
branch: <PREFIX>-0042             # the branch the work sits on; Stage 0 creates `<ID>` when started on main
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

<!-- A ticket that replaces a hand procedure with a script, or rewrites a skill step: list every clause of the old
procedure as its own SC row, or mark it dropped on purpose in Concerns, and run the new rule over every shipped layout
before freezing (MF-0043 retro: the "as literals" clause was lost in the skill rewrite, and the first parser fix broke
the MF-0032 layout). -->

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
- <YYYY-MM-DD> design preflight: `pnpm typecheck && pnpm lint && pnpm test` exit 0 (<n> tests); `pnpm test:db` <result>; `pnpm db:reset` not run: <reason>
  <!-- one line naming EVERY `pnpm <script>` the Success Criteria name; `pnpm gate:planning` enforces it past DESIGN (MF-0053) -->
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

## Symbols changed

<each existing name the change reaches, in backticks: a function whose signature changes (`name` or `name(q)`), a
closed set and its members as literals (`'card'`, `not-in-pack`), a shared type (`Type` or `Type.field`; for
`Promise<Type>` list `Type`). "None." when
nothing existing changes; backticks here mean "changed". `pnpm ticket:collisions <ID>` reads this list and exits 2 on
a token it cannot match, so this unfilled placeholder fails it (MF-0043)>

## Frozen files this will re-freeze

<one row per frozen file the change breaks, or that you read and found still holds; "None." otherwise. Re-run
`pnpm ticket:collisions <ID>` until it exits 0.>

| File:line | Change (new expected value) | Reason |
|---|---|---|
| `<path>/__tests__/<id>-x.acceptance.test.ts:<line>` | <the assertion that breaks → its new value> | <why; approval> |

## SC coverage

| SC | Steps | Proof |
|----|-------|-------|
| SC-1 | 2, 3 | `<path>/__tests__/x.test.ts` — oracle cases a, b, c |

## Symbols changed

<input to `pnpm ticket:collisions <ID>` (MF-0043); write it in GOAL.md at DESIGN, carry it here at PLAN.
One bullet per symbol, or exactly `- none`. A bullet in any other shape is an error, not a skip.>

- function `toPlayableQuestion`      <a function whose signature or behaviour changes: flags `name(` and imports>
- name `ITEM_TYPES`                  <a closed set, shared type or constant: flags the whole word>
- literal `'question'`               <a sibling member or output literal: flags the exact text>

### Frozen files this will re-freeze

| File | Change | Reason |
|---|---|---|
| `<path>.acceptance.test.ts:<line>` | <the assertion line that breaks → its new expected value> | <why; who approved> |

## Steps

1. `<path>/x.ts` — <exact change>
2. `<path>/__tests__/x.test.ts` — <cases, with the expected values written out>
3. …

## Riskiest step

<which one, why, and how the proof catches it going wrong>
For every UI predicate that gates a write (a disabled button, a canX() helper), name the SERVER refusal that holds when the UI is bypassed (stale tab, double click, direct action call, two concurrent requests) and the test that calls the service twice and expects the second refused. "Only the UI stops it" is a blocking plan defect.
Server-owned facts (MF-0013 retro): a deadline is decided by the DB clock, never by the client's (a client at 0 only locks and refreshes), and a write that binds to content sends the hash of the version the page RENDERS, never the stored one echoed back. Counts that feed a fixture or a split come from a parsed structure (YAML/JSON), never `grep -c`. Every task's `owns` avoids the role agents' NEVER globs (`.claude/hooks/lib/agent-scopes.mjs`: `scripts/**`, `.planning/evidence/**`, …); those steps belong to the orchestrator. Builders never run `git stash`.

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

## See it yourself

Local stack + `pnpm dev` on http://localhost:3001. Sign in as `<demo account from pnpm dev:seed>`
(magic link in Mailpit, http://127.0.0.1:54324).

| SC | Open | Do | You should see |
|----|------|----|----------------|
| SC-1 | http://localhost:3001/<route> | <clicks / keys, in order> | <what appears; the figure, label or state> |
| SC-2 | … | … | … |

Screenshots: `.planning/evidence/<ID>/sc-1-<what>.png`, … (taken in this run, light and dark where it matters).

<!-- A ticket with nothing on screen keeps the heading and says why: "n/a: <script/DB only; run `pnpm …` to see it>".
     `pnpm gate:planning` fails a hand-off after MF-0054 without this section (MF-0055). -->

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

  Closes #<issue number from `pnpm ticket:github <ID>`>   ← in the PR description too; the merge closes
                                                            the issue and the project moves it to Done

See it yourself (also in .planning/evidence/<ID>.md)
  http://localhost:3001/<route> as <demo account> → <clicks> → <what you see>   (SC-1)
  screenshots: .planning/evidence/<ID>/
  The page is left open in the browser on the last screen checked.

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

## Course-pack ticket (precedent: MF-0039)

For a new `packs/<slug>/` ticket, copy the shape of `.planning/tasks/MF-0039/GOAL.md` and `LOOP-PLAN.md` instead of
re-deriving it:
- SCs per loader (`loadPackFile`, `loadPackContent`), counts per skill and level, answer-key spread, diagram
  connectivity and the named capstone, all in one frozen acceptance file;
- a source-copy SC: 12-word overlap against any saved course page, run after the verifier fixes. Extract the
  course text into a folder only the orchestrator writes (`<scratchpad>/mf-<id>-sc8/`), never a path a drafting
  fork is told about, and tell the forks to write only under `packs/<slug>/` and `.planning/tasks/<id>/`. The check
  prints the course file's word count, and the run asserts it equals the count recorded when the page was saved
  (MF-0040: a fork overwrote the shared scratch file, the run showed `shared=26` against the wrong page, and only
  the changed word count exposed it);
- an SC-9 verifier SC with `verify/<domains>.md` tables (item, severity, claim, page says with file:line, fix);
- 3 drafters by domain, then 3 fresh verifiers; the drafter brief carries the four semantic checks in SKILL.md. The grounding note (`grounding/<D>.md`) is a form the drafter must fill, and each verifier checks its cells first (MF-0031 and MF-0037 both put 'list every branch' in the brief and still got 6 of 9 and 6 of 8 diagrams back as FIX; a brief line does not change what is written, an empty cell does): per diagram, a `branches` cell listing every branch, table row or conditional the cited page documents next to the node or edge id that draws it ('left out: <reason>' is allowed, silence is not); per card, an `analogy` cell naming the real-world behaviour that `inNature` and each `whereItBreaks` line asserts, its source or `[GK]` (a `[GK]` claim about animals or plants is dropped unless it is textbook-safe), and a note of how each `whereItBreaks` line differs in mechanism, not only in size; per question, one quoted passage that refutes each distractor (silence in the page is not a refutation); every quoted passage, and every clause of the stem, carries the short name of the page it comes from, and that page must be the item's `source.url`: when an expert item bridges a claude.ai feature and its API counterpart, either cite the page that holds both facts, split the item, or cut the clause (MF-0038: 3 of 8 FIX opened a stem or rationale with a fact from the sibling page, with 0 matches on the cited one); when a page documents two product versions (current and legacy), the stem names the version it asks about;
- `pnpm db:sync-keys` twice (the second run changes nothing); `pnpm dev:seed` once. `dev:seed` without `--pack`
  refuses before any delete if any pack in the tree is incomplete (another session's in-progress pack), and with
  `--pack` it replaces the whole demo world, so name every pack whose demo group must survive and record which
  groups are gone;
- screen proof: browser, or HTTP render as a seeded learner when the shared browser is held (memory
  `feedback-browser-verification`). Do not prove it on the shared :3001 dev server: it returns 404 for a pack added
  after it started, because `listPacks()` is `"use cache"` with `cacheLife("days")` (MF-0042). Run
  `pnpm build && pnpm exec next start -p 3002` and render `/review/<slug>` and one `/play/<slug>/plant/<skill>`
  page there, and tell the user the :3001 server needs a restart;
- `pnpm check:packs` stays green.
- the LOOP-PLAN drafting brief is these bullets plus a per-skill answer-key letter plan (so the 40% key-letter SC
  passes first time) and, where an SC reads nodes by label (a capstone diagram), the label trap spelled out
  verbatim; copy `.planning/tasks/MF-0042/LOOP-PLAN.md` "Key-letter plan" and "Contract trap (SC-6)". Drafters run
  `pnpm check:packs` in their own loop, not only at TEST.
- before spawning the drafters, open the previous pack ticket's `RETRO.md`. If it has no `applied:` front-matter
  line yet, copy its Actions text into this ticket's drafting brief and say so under "Decided without a question"
  (MF-0037, MF-0039 and MF-0040 were each drafted before the prior retro was applied, so the lesson reached the
  next pack as a brief line at best, or not at all).

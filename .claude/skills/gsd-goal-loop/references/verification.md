# Verification — the proof ladder

The playbook's rule: *always give Claude a way to verify its own work, and make verification part
of "done".* The feedback loop usually exists; what fails is reading it wrong. Every trap below is a
known way to produce a false green.

Climb from the bottom. A rung that fails stops the climb — fix, then restart from that rung.
Commands are the Project bindings in SKILL.md; never invent one the project does not have.

## 0. What a harness can do for you (optional, if the project has hooks)

Claude Code hooks can turn part of this ladder into something that runs whether or not the agent
remembers it:

| Hook | Does |
|---|---|
| change tracker (Pre/Post tool) | records the files THIS session changed — Edit/Write paths plus a `git status` diff around Bash calls (sessions may share the worktree) |
| protected-file guard (PreToolUse) | Edit/Write to a frozen acceptance test, `FROZEN.json`, a gate script, CI, lint/test/tsc config or the hooks → **asks the user** |
| stop gate (Stop) | when source changed since the last green: TYPECHECK · GATES · lint on changed files · co-located tests (full related set at `stage: test`+) · frozen-hash integrity; red blocks the turn a bounded number of times |

Without hooks, you run these checks yourself at the end of every BUILD step. A gate banner is
evidence; a release is not a pass. It does NOT replace rungs 2, 6, 7, 8: it never runs the full
suite, a browser or a production build. If you disabled a gate, say so in the evidence.

## 1. Oracle tests for the decision

The SC-level oracles were already written and frozen RED in Stage 2b; this rung is the inner unit
tests that build up to them.

Pure logic lives in pure modules (utils, lib, domain compute functions) and is tested in a
co-located `__tests__/`. Write the **expected value from the requirement**, not from running the
code: `expect(total).toBe(1234_00)`, never `expect(total).toBe(compute(x))`. One case per branch
of the decision, plus the empty case and the boundary (period end, DST day, 0, null).

If the project has no component-test toolchain, logic left inside a `.tsx` cannot be tested — that
is why the component split exists (`react-client-patterns`).

## 2. DB-backed tests on the test stack

A service read or write is proven against the real database, with access policies on, as the role
that will run it. Skip only when TEST_DB is absent — and list it as not verified.

- **Only through the project's test command.** A bare runner may load the wrong env file and hit
  a non-test database. Check which env the test command loads before trusting it.
- Schema change: migrate TEST_DB first. A migration that dies silently is usually a journal lagging
  the schema — backfill, never reset a shared stack.
- Read the row back. A new nullable column passes typecheck, every gate and the suite while never
  reaching the INSERT.
- Fixtures: respect audit triggers and session settings the schema requires; set them
  transaction-local, never session-wide (it sticks to a pooled connection).
- Access policy: keep DB/policy-level tests distinct from E2E; know which command runs them.

## 3. Types

Run TYPECHECK. An upward import (shared/server layer → a UI feature or route) is a layering
error — move the code down, do not re-route the import.

## 4. Every gate, enumerated — never from memory

```bash
node -e "for (const k of Object.keys(require('./package.json').scripts)) if (k.startsWith('gate:')) console.log(k)" \
  | xargs -I{} sh -c 'printf "%-22s " {}; npm run -s {} >/dev/null 2>&1 && echo PASS || echo FAIL'
```

(Use the project's package manager.) Re-run a FAIL bare to read it. A gate failing on a file you
did not touch is still reported, as pre-existing, with the file named.

**Writing a gate or check script: its parser fails closed (MF-0043 retro).** Any token, section, heading level or
syntax it cannot parse is an error (non-zero exit, naming the input), never dropped and never read as "none found".
Do not `filter()` unparseable input away: collect a result plus a `rejected` list and fail when that list is
non-empty. In the plan, list the inputs the parser must reject, each with a test: an unparseable token, a nested
subheading inside the section, a generic or qualified name, and an empty section that is not the literal "None".
The same holds for an exemption, grandfather list or allowlist: it may skip only the one rule it exists for, and the
structure and shape checks run first for every item, exempt or not. Add a plan test: the same malformed item inside
an exempt set must still fail (MF-0044: the grandfather skip came before the structure checks, so 156 questions went
unchecked until review minor 1).
MF-0043 shipped all four as exit 0, and review found them over 3 rounds.

## 5. Lint

Run LINT bare. Diagnostic limits and your own `| tail` both hide violations.

## 6. Full suite, to a log

```bash
# LOG = a file in the session scratchpad, never the repo
<TEST> > "$LOG" 2>&1; echo "exit $?"; grep -E "FAIL|Test Files|Tests " "$LOG"
```

Never pipe a suite to `tail` — you get tail's exit 0 and lose the failing names. Other sessions may
leave failures in a shared tree: for each failure, show it is outside this diff (the file is not in
your change set, and it fails the same way without your change) or treat it as yours. Watch for
calendar-dependent and load-sensitive tests; name them, don't hide them.

## 7. The screen — required for anything a user sees

A green suite is not validation. Look at the screen, as the role the SC names, against the **test
stack**, on a separate port from the user's dev server (copy the tree to the scratchpad if the dev
server holds a lock).

- Prefer `localhost` over `127.0.0.1` if the dev server restricts origins (forms then look
  unhydrated).
- Reuse a saved auth state; repeated fresh logins trip rate limiters.
- If the browser MCP is locked by another session, script Playwright from the scratchpad copy.
- A new page that redirects away is often missing from the route-access config — fails closed.
- Record what was seen in words in the evidence file. If a screenshot helps, save it under
  `.planning/evidence/screenshots/<ID>-<topic>.png` (create the directory). The chrome-devtools
  MCP refuses any `filePath` outside the repo (it rejects the session scratchpad: "not within any
  of the configured workspace roots"), so do not point it at the scratchpad; without a repo path,
  take it inline and say so in the evidence file.
- Keyboard proofs on Radix controls: under jsdom, `RadioGroup` arrow-key selection does nothing
  (Space works). Test Space/Tab/Enter in the `ui` test and check arrow keys in the browser, and
  say so in LOOP-VERIFY "Not verified" or the SC row (MF-0009).

## 8. Production-only traps

Dev mode hides build-time errors. Run a production build (against non-production env) when the
change touches caching directives, a new client import chain, the framework config, or anything
that only resolves at build. Never run a build that reads production env files locally.

## 9. Fresh-context review — high-risk always, normal when the diff is large

The agent that wrote the code does not approve it. Launch a subagent (or `/code-review`) with
only: GOAL.md, LOOP-PLAN.md, and the diff paths. Ask it to check the diff against each SC and
Constraint, and for the three passes the playbook names — **bugs**, **security** (authz, access
policy, PII and sensitive fields in DTOs, privileged DB client use), **compliance** (the plan,
CLAUDE.md invariants such as calculation parity, integer money, time zones). Its findings go in
the evidence file with their disposition. Add domain reviewers the project defines (e.g. a
state-machine auditor via `state-machine-design`, an accessibility auditor for a new interactive
surface).

## What counts as evidence

| Counts | Does not |
|---|---|
| `17/17` with the test file named | "tests pass" |
| the gate table above, pasted | "gates green" |
| "the dialog lists *Item A · 10 units · no price*" | "UI works" |
| "not verified: the e-mail send" | silence about it |

- A runbook or doc is verified by copy-pasting its commands from the file and running them as written.
  The only allowed edit is a documented substitution (e.g. `--linked` to `--local`). Record the log of the
  pasted command. A command typed from memory in the dry run does not count.

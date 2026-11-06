---
ticket: MF-0046
outcome: pass
causes: known-trap-repeated, wrong-plan, tooling
actions: skill-edit, memory-update
lesson_keys: gate-parser-fail-closed, reserved-ticket-premise-recheck, review-fix-delta-reread, bash-expands-unicode-escapes
applied: 2026-11-06
---
## Numbers
(No `pnpm ticket:retro` script exists; counted by hand.)
- REVIEW.md: 4 rounds. Blocking findings: round 1 = 3, round 2 = 4 (R2-B1..B4), round 3 = 1 class (R3-B1), round 4 = none after rewrite to an allowlist of line shapes.
- Every blocking finding was a fail-open input to `scripts/check-workspace.mjs` (no yaml lib, runs before Install).
- T0: red main CI from a merge that concatenated two GOAL.md files (MF-0059 reserved twice).
- Bash tool expanded `\u` escapes and put a literal U+FEFF in source twice.
- Changed set: gate-core.mjs, ci.yml, package.json, key-length.mjs, check-workspace.mjs + 2 test files.

## Went right
- The fresh reviewer probed the parser by class and kept 30 fixtures across rounds; round 4 replayed all of them. — keep: already is: `review-fix-delta-reread` practice.
- T0 repaired the red main CI before building on it. — keep: already is: `ci-red-unobserved`.

## Went wrong
- The parser shipped as a blocklist (reject known-bad shapes, accept the rest). Review found fail-open inputs in rounds 1, 2 and 3 (3, 4, 1 class) and only a rewrite to an allowlist of accepted line shapes ended it. verification.md §4 already says "parser fails closed" (from the MF-0043 and MF-0044 retros), and lesson key `gate-parser-fail-closed` is already on two retros. The rule reads as "reject what you cannot parse", and a blocklist satisfies that wording, so the plan did not force the allowlist design. cause: known-trap-repeated (and wrong-plan: the plan listed rejected inputs, not the accepted grammar).
- MF-0059 was reserved by this contributor and collided with another contributor's MF-0059. The merge concatenated two GOAL.md files and main CI went red. This is the MF-0022/0023 failure again (`reserved-ticket-premise-recheck`, `ticket-number-collision-across-branches`). cause: known-trap-repeated. Note: `pnpm ticket:collisions` (MF-0043) covers frozen shapes, not reservation numbers. Not proposed as an action here because the cap is two.
- Literal U+FEFF reached source twice because the Bash tool expands `\u` escapes in strings. cause: tooling.

## Actions (at most two)
1. skill-edit: `.claude/skills/gsd-goal-loop/references/verification.md` — append after the line "MF-0043 shipped all four as exit 0, and review found them over 3 rounds." this paragraph:
   "**Parsing a structured format (YAML, TOML, a table) without a library: write an allowlist, not a blocklist (MF-0046).** Define the accepted line shapes as a short grammar in the plan, accept only lines that match one of them, and treat every other line as an error naming the line. Do not write a parser that rejects listed bad shapes and passes the rest: MF-0046 shipped that way and review found fail-open inputs in rounds 1, 2 and 3 (duplicate entry, block sequence at column 0, a `#` without whitespace, opaque keys) until the parser was rewritten as an allowlist of line shapes. The plan's test list must contain a fuzz-style fixture per shape class (duplicate keys, repeated blocks, comments, quoting, indentation variants, BOM), each expected to exit non-zero."
   Would have saved: about 3 review rounds and the round-4 rewrite (roughly half of the ticket's iterations).
2. memory-update: `windows-dev-environment.md` (memory entry; the index line already lists "heredoc apostrophes") — add: "The Bash tool expands `\uXXXX` escapes inside strings and heredocs, so `the U+FEFF escape` writes a real BOM into the file (MF-0046, twice). To write or test a BOM, build it from a code point at run time (`String.fromCharCode(0xFEFF)` in a node script) and never type the escape through Bash." Would have saved: two debugging detours.

## Not worth changing
- Reservation collisions: already recorded under `reserved-ticket-premise-recheck`. A gate that checks the reserved ID against `origin/main` GOAL.md files would be the right fix, but it belongs in its own ticket (cap of two actions).
- Review round 4 notes (narrowing PLAIN's first character): minor, documented in the parser header.

## Applied

- 2026-11-06 skill-edit (additive) → `.claude/skills/gsd-goal-loop/references/verification.md` §4: allowlist, not
  blocklist, for a library-free parser of a structured format, with one fixture per shape class and a supported-shapes lock.
- 2026-11-06 memory-update → `windows-dev-environment.md`: the Bash tool expands backslash-u escapes; build a BOM from a
  code point in a node script.
- Held: nothing.

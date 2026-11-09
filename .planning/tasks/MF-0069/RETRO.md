---
ticket: MF-0069
outcome: pass
causes: known-trap-repeated, wrong-plan, tooling
actions: skill-edit
applied: 2026-11-09
lesson_keys: gate-parser-fail-closed, reserved-ticket-premise-recheck
---
## Numbers
(No `ticket:retro` CLI; counted by hand.)
- FROZEN.json: 1 frozen file, `history: []`, no re-freeze. RED at freeze 6/6 (LOOP-VERIFY.md).
- REVIEW.md: 2 rounds. Round 1 changes-requested with B-1 (substring/fenced label matching, table under another label) and B-2 (prefix-only glob trigger, fail open). Round 2 approve. Remaining findings are notes only.
- LOOP-VERIFY.md: B-1/B-2 regressions shown RED (12 failed | 12 passed) before the fix. Final `pnpm test` shows only the baseline `mf-0065` SC-8 failure. `pnpm gate:planning` 71 folders ok.
- GOAL.md Iteration Log: pickup probe showed the reserved text-regex trigger firing on 45 of 54 shipped plans and missing its own proof case. The user redesigned it before freeze.
- Tickets with `gate-parser-fail-closed`: MF-0043, MF-0044, MF-0046, MF-0048, now MF-0069 (5th ticket, 4th review-found repeat).

## Went right
- The pickup probe ran the drafted trigger over all shipped plans before freeze and replayed the MF-0048 proof case. It killed a bad design at no review cost — keep: already is, `GOAL.md` Iteration Log "proof-case replay"; reuse the pattern, no new text.
- The MF-0069 plan carried its own `## Parsers` section, and review blockers were fixed RED-first with the frozen file untouched — keep: already is (`templates.md` Parsers block, `verification.md` §4).

## Went wrong
- Review round 1 found 2 fail-open holes in the parser written for this very lesson. Both are shapes the plan's Rejected inputs table did not list: a label inside a code fence or table cell or mid-sentence, and a glob form (`{a,b}/`, `./`, `**/`) that a `scripts/` prefix test misses. The template asks for 3 or more rows but does not say which input classes a text-reading parser must cover, so the author picks easy rows. Cause: known-trap-repeated (the rule exists in §4 and the template, but the template gives no input-class checklist at the moment of writing the table).
- The "design preflight" Iteration Log line was wrapped onto a second line, so the MF-0053 single-line rule failed it. SKILL.md line 230 says "ONE Iteration Log line" but does not say a physical line, and the template at templates.md line 74 is a long line that invites wrapping. Cause: tooling (wording).
- Bash heredoc with an apostrophe failed again. It is already in `windows-dev-environment.md` line 18 and the index. Cause: known-trap-repeated, but it cost one retry only. See Not worth changing.

## Actions (at most two)
1. skill-edit: `.claude/skills/gsd-goal-loop/references/templates.md`, in the `## Parsers` guidance comment, immediately after the sentence ending "...as MF-0048 did with 3.1M pairs." insert:
   `Rejected inputs must cover these classes when they apply (MF-0069 review B-1/B-2: 4th gate-parser-fail-closed repeat): (a) for a parser that reads Markdown or text, the label or token inside a code fence (backtick and tilde), inside a table cell, mid-sentence and as a substring of a longer word, and the real block after an unclosed or nested fence; (b) for a path or glob trigger, the equivalent spellings: brace sets (\`{scripts,docs}/x\`), \`./\` prefix, \`**/\` prefix, a trailing-segment match (\`scripts/my__tests__/x\`), and whether an unparseable form fails closed rather than skipping; (c) a value present but placed under the wrong label. Write one row per class that applies, or a line \`n/a: <class>, <reason>\`.`
   Do not touch the text between the `parsers-example` markers (SC-6 reads it). Would have saved: review round 1 of MF-0069 (2 blockers, 12 regression cases, one full builder and reviewer pass), and the repeat loop that MF-0043, MF-0046, MF-0048 and now MF-0069 each paid.
2. skill-edit: `.claude/skills/gsd-goal-loop/SKILL.md` line 230, replace "Record it as ONE Iteration Log line containing `design preflight:`" with "Record it as ONE physical Iteration Log line (no wrapping, however long: MF-0053 reads a single line) containing `design preflight:`". Would have saved: one gate failure and one edit in MF-0069.

## Not worth changing
- Heredoc apostrophe failure: already in memory and the index. The workaround (Write tool, then run) is stated. A fourth entry or a gate cannot prevent it.
- Review notes (fence opener with inline code, unclosed fence after `None:`, `hasRejectedTable` stopping only at four labels): accepted as rare and fail-closed by the reviewer. If a later ticket touches `parsersSection`, fold them in then.
- Reserved-draft trigger firing on 45 of 54 plans: caught by the pickup probe and the existing `reserved-ticket-premise-recheck` practice, so the system worked.
- Token usage: the ticket's real size (parser plus two review rounds); no whole-file-read waste is visible in the records.

## Applied

- 2026-11-09 skill-edit 1 (additive): input-class checklist added to the `## Parsers` guidance in `.claude/skills/gsd-goal-loop/references/templates.md`, outside the `parsers-example` markers.
- 2026-11-09 skill-edit 2 (additive): "ONE physical Iteration Log line (no wrapping…)" in `.claude/skills/gsd-goal-loop/SKILL.md`.
- Held: none. Note: templates.md is part of the reviewed tree; this retro edit lands after review hash 51c23327 (text only, outside the SC-6 example).

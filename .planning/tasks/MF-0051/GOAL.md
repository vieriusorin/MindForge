---
ticket_id: MF-0051
tier: normal
stage: intake
builds_on: [MF-0023, MF-0027]
last_iteration: 0
goal_status: reserved
---

> Reserved 2026-11-05 by the MF-0027 retro (gate action). Not started.

## Objective

**Today.** The retro Stop hook tells the agent to run `pnpm ticket:retro <ID>`
(`.claude/hooks/lib/retro-trigger.mjs` ~line 78, header of `.claude/hooks/retro-trigger.mjs`), but `package.json`
has no `ticket:retro` script and `scripts/` has no `ticket-retro.mjs`. MF-0027's retro had to gather its facts by hand.

**End state.** `scripts/check-hooks.mjs` fails when `.claude/hooks/**/*.mjs`, `.claude/skills/**/*.md` or
`.claude/settings.json` name `pnpm <name>` where `<name>` is neither a `package.json` script nor a pnpm built-in
(`install`, `dlx`, `exec`, `run`, …). Proof case: today's `pnpm ticket:retro` reference turns it RED.

## Open questions

- Q-1 (owner: user): build `scripts/ticket-retro.mjs` + `ticket:retro` (RETRO_FACTS, `--across`), or rewrite the
  hook and skill text to match what exists? Hooks and `check-hooks.mjs` are guarded paths: the user reviews the diff.
- At pickup: run the drafted check read-only over every hook, skill and settings file first; list all hits as findings
  (`ticket:freeze` / `ticket:verify` / `ticket:eval` are likely named too).

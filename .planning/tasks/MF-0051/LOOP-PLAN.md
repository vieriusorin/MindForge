# MF-0051 LOOP-PLAN (iteration 0)

## Discovery

- `scripts/check-hooks.mjs` (95 lines, MF-0001 SC-8, MF-0023 Windows fix): step 1 resolves relative imports under
  `.claude/hooks`, step 2 runs every settings hook command on a sample input. `ROOT` is fixed to the repo. CI runs it
  at `.github/workflows/ci.yml:50`; no `package.json` script.
- Precedent shape: MF-0049 (`scripts/lib/goal-proofs.mjs` pure + `scripts/check-goal-proofs.mjs` CLI, tests in
  `src/test/__tests__/`, `MF_TASKS_DIR` root override for fixture runs).
- `scripts/lib/goal-proofs.mjs:12-14` owns `PNPM` regex and `PNPM_BUILTINS = new Set(["exec","dlx","install","vitest"])`.
- The 18 hits and what each becomes: GOAL.md Facts + step 4 below.
- Gates the touched files sit on: `gate-core.mjs` protects `scripts/check-*.mjs` and `scripts/lib/{ticket-receipts,
  ticket-eval,clean-room}.mjs` (asks the user); `.claude/hooks/**` and `.claude/agents/**` are guarded paths.

## SC → steps

| SC | Steps | Proof |
|---|---|---|
| SC-1 | 1 | acceptance SC-1 (3 cases) |
| SC-2 | 2 | acceptance SC-2 + LOOP-VERIFY replay of `node scripts/check-hooks.mjs` before step 4 (exit 1, 18 hits) |
| SC-3 | 4 | acceptance SC-3 + `node scripts/check-hooks.mjs` exit 0 |

## Steps

1. `scripts/lib/pnpm-refs.mjs`: `PNPM_BUILTINS` (GOAL "Decided without a question" list + `vitest`);
   `isPnpmRefFile(rel)` → `{ markdown }` for `.claude/hooks/**/*.mjs` (false), `.claude/settings.json` (false),
   `.claude/{agents,rules,skills}/**/*.md`, `CLAUDE.md`, `AGENTS.md` (true), else `null`;
   `unknownPnpmRefs({ text, markdown, scripts })`: split on `\r?\n`; Markdown keeps fenced lines (CommonMark
   fence: ``` or ~~~ run of ≥3, closed by the same char with a run ≥ the opener) and inline code spans only;
   match `/\bpnpm\s+(?:run\s+)?([a-z][\w:.-]*)/g`, strip trailing `[.:]+`, report when not in `scripts` and not a
   built-in. Inner unit tests: `src/test/__tests__/pnpm-refs.test.ts` (`isPnpmRefFile` table, `~~~` fence,
   unclosed fence runs to EOF, two refs on one line).
2. `scripts/check-hooks.mjs`: `ROOT = process.env.MF_CHECK_ROOT || <repo>`; step 3 walks `.claude/` plus
   `CLAUDE.md` / `AGENTS.md` under ROOT, filters with `isPnpmRefFile`, prints `pnpm refs: N files checked` and
   `FAIL <rel>:<line> pnpm <name> (not a package.json script)` per hit, pushes each to `failures`.
   Rel paths printed with `/`.
3. ~~`scripts/lib/goal-proofs.mjs` imports the shared set~~ — dropped with SC-4 (user, review N-6).
4. Rewrite the 18 hits (text only, no behaviour change):
   - `.claude/hooks/lib/retro-trigger.mjs:78` step 1 → gather the facts by hand (receipts, FROZEN.json history,
     research, REVIEW.md, LOOP-VERIFY under `.planning/tasks/<ID>/`), "no ticket:retro CLI yet, MF-0080".
   - `.claude/hooks/retro-trigger.mjs:11` → "…still shows as a finished ticket folder without RETRO.md";
     `:97` → "Run the retro agent for <ID> next session".
   - `.claude/hooks/lib/gate-core.mjs:68` reason → "a ticket's receipts — written by the ticket tooling (MF-0080),
     never by hand".
   - `.claude/hooks/stop-gate.mjs:276` → "(start Docker, then `pnpm dev:setup`)"; `:331` and
     `.claude/hooks/track-changes.mjs:14` → "`pnpm typecheck && pnpm lint && pnpm test`".
   - Agents: `verifier.md` runs the gsd-goal-loop VERIFY default (typecheck, `gate:*`, lint, test to a log; diff
     hash `git diff HEAD | sha256sum`) and reads LOOP-VERIFY; `diff-reviewer.md:15` tree hash from
     `git diff HEAD | sha256sum`; `acceptance-writer.md:33` prints the FREEZE default (hash per file over LF content
     into FROZEN.json) for the user's approval; `ticket-planner.md:10` "would the EVAL default (acyclic graph, known
     agents, every SC closed) find the graph valid"; `retro.md:3,18,65,87` read the facts from the ticket folder.
     Each names MF-0080.
   - `.claude/skills/typescript/SKILL.md:78` → "Manage packages with pnpm (faster, disk-efficient)".

## Riskiest step

Step 4 on the hooks: a broken template string in `retro-trigger.mjs` / `stop-gate.mjs` would silently disable a
Stop hook (they swallow errors by design). Mitigation: `node scripts/check-hooks.mjs` runs every hook command after
the edit (step 2 of the check), and `node --check` each edited `.mjs`.

## Rejected options

- Whole-text scan of Markdown (the draft): ~40 prose / built-in hits in third-party skills.
- Building `ticket:retro` now: user chose to reserve all CLIs to MF-0080.
- A new `package.json` script `check:hooks`: CI already runs the file directly; out of the ticket's need.

## Symbols changed

None. (SC-4 withdrawn: goal-proofs.mjs is unchanged; the PNPM_BUILTINS in pnpm-refs.mjs is a new name.)

## Frozen files this will re-freeze

- None (see `pnpm ticket:collisions MF-0051` in LOOP-VERIFY).

```json tasks
[
  { "id": "T1", "agent": "inline", "owns": ["scripts/lib/pnpm-refs.mjs", "src/test/__tests__/pnpm-refs.test.ts"], "depends_on": [], "closes": ["SC-1"], "done_when": "acceptance SC-1 green", "context": "step 1" },
  { "id": "T2", "agent": "inline", "owns": ["scripts/check-hooks.mjs"], "depends_on": ["T1"], "closes": ["SC-2"], "done_when": "acceptance SC-2 green; replay exit 1 with 18 hits", "context": "step 2" },
  { "id": "T4", "agent": "inline", "owns": [".claude/hooks/**", ".claude/agents/**", ".claude/skills/typescript/SKILL.md"], "depends_on": ["T2"], "closes": ["SC-3"], "done_when": "acceptance SC-3 green; check-hooks exit 0", "context": "step 4" }
]
```

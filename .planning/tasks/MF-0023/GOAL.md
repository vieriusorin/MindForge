---
ticket_id: MF-0023
tier: normal                      # dev tooling: a Claude Code hook; no app code
stage: intake
branch: main
builds_on: []
last_iteration: 0
goal_status: reserved             # created by the MF-0008 retro (gate action); never built automatically
track: P
week: W2
depends_on: []
---

> Reserved by the MF-0008 retro (2026-11-04, lesson `stop-hook-windows-spawn`). The MF-0007 retro said
> to open this gate if the Stop hook failed again on the next Windows ticket. It did, on every turn of MF-0008.

## Objective

Today `.claude/hooks/stop-gate.mjs` fails on Windows before checking anything (`spawn pnpm ENOENT`,
`spawn biome ENOENT`, `spawn vitest ENOENT`). Node won't spawn `.cmd` shims, so every turn shows a red
gate that hides real failures.

End state: on Windows the hook resolves its commands the way `scripts/lib/supabase-bin.mjs` does (or
spawns through the shell), and it reports the real typecheck, lint and test result.

## Success Criteria (draft)

- [ ] SC-1: On a clean tree on Windows, the Stop gate exits 0 and runs typecheck, lint and tests. Proof: hook run log.
- [ ] SC-2: With a deliberate type error in a changed file, the gate reports that error, not a spawn failure. Proof: hook run log.
- [ ] SC-3: Behaviour on macOS/Linux is unchanged. Proof: unit test of the command resolver per platform.

## Constraints

- Hooks are guarded config: the user approves the change.

## Open questions

- Shell spawn vs explicit `.cmd` resolution (the repo already uses explicit resolution in `supabase-bin.mjs`).

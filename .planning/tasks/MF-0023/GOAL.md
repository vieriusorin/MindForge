---
ticket_id: MF-0023
tier: normal
stage: intake
builds_on: [MF-0003, MF-0007]
last_iteration: 0
goal_status: reserved
---

> Drafted 2026-11-04 by MF-0012 (user decision C-3), from the MF-0003 review note "learn the key from
> the feedback, then answer it". Not started.

## Objective

**Today.** After a wrong answer the Duel reveals the key and every rationale. A learner who meets the
same question again can answer from memory of the reveal, not of the skill. MF-0003 review: this yields a
sprout only (stability ≈ 2.3), so the forest overstates little.

**End state.** A decision, recorded in `docs/adr/` or CONTEXT.md: accept it as recall (spaced retrieval
of the rationale is still learning), or discount a correct answer to a question whose key was revealed
within N days.

## Open questions

- Is this a product decision (owner: user / D-owner) before any code? Likely yes.
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

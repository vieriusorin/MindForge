# MF-0053 LOOP-PLAN — iteration 0

## Discovery
- `scripts/lib/planning-check.mjs` (pure, MF-0028) + `scripts/check-planning.mjs` (CLI, reads `.planning/tasks`,
  `MF_TASKS_DIR`). Wired: `gate:planning` in package.json → Stop gate (`gate:*`) and CI `ci.yml:48`.
- Precedent shape: MF-0028 (same files, same frozen-test style).
- Skill text: `.claude/skills/gsd-goal-loop/SKILL.md` Stage 2 preflight item (1); Iteration Log shape in
  `references/templates.md`. Neither mentions "design preflight" today.

## Frozen files this will re-freeze
- None. `checkPlanning` is unchanged; `mf-0028-planning-check.acceptance.test.ts` fixtures sit before the cutoff and its
  "exits 0 on this repo" case is satisfied as long as MF-0053's own GOAL carries a valid preflight line (it does).

## Steps
1. `planning-check.mjs`: implement `checkDesignPreflight(entries, scriptNames)` — normalise CRLF; skip null, dir `<= MF-0052`,
   `goal_status: reserved`, stage not in {plan,build,test,handoff,watch}; slice `## Success Criteria` and `## Iteration Log`
   sections (split on `^## `); collect `pnpm (run )?<name>` in SCs where name ∈ scriptNames, ordered by first mention;
   preflight lines = Iteration Log lines matching /design preflight/i; mention = `pnpm <name>` followed by a char not in
   `[\w:-]` or end. Emit SC-2 line when no preflight line, else SC-1 line when any missing. (SC-1…SC-4)
2. `check-planning.mjs`: read `package.json` scripts from ROOT, run both checks, print all problems. (SC-5)
3. Skill + template text. (SC-6)
4. VERIFY: typecheck, lint, test, gate:planning; hash check on both frozen files. (SC-7)

## Riskiest step
Step 1's mention matcher: a prefix match (`pnpm test` vs `pnpm test:db`) would silently pass a skipped DB run — exactly
the trap. Covered by two frozen whole-name cases. Not a re-runnable writer; no state outside the repo.

## Rejected options
- Widening `checkPlanning(entries, opts)`: touches the MF-0028 contract for no gain.
- Requiring a result token after each mention: rejected by the user (C-2).
- Retroactive scope / fixing old GOALs: 39 hits, out of scope.

```json tasks
[
  {"id":"T1","agent":"service-builder","owns":["scripts/lib/planning-check.mjs"],"depends_on":[],"closes":["SC-1","SC-2","SC-3","SC-4"],"done_when":"frozen SC-1..SC-4 green","context":"GOAL SC-1..SC-4"},
  {"id":"T2","agent":"service-builder","owns":["scripts/check-planning.mjs"],"depends_on":["T1"],"closes":["SC-5"],"done_when":"frozen SC-5 green","context":"read package.json scripts"},
  {"id":"T3","agent":"inline","owns":[".claude/skills/gsd-goal-loop/SKILL.md",".claude/skills/gsd-goal-loop/references/templates.md"],"depends_on":[],"closes":["SC-6"],"done_when":"grep finds 'design preflight' in both","context":"C-2/C-3 wording"},
  {"id":"T4","agent":"verifier","owns":[],"depends_on":["T1","T2","T3"],"closes":["SC-7"],"done_when":"receipt PASS","context":""}
]
```

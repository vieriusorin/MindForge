# MF-0034 LOOP-PLAN (iteration 0, approved by the user with the SCs)

## Discovery
- `scripts/dev-seed.ts` hard-codes `PACK_SLUG = "ccdv-f"`; `planDemoWorld` is already pack-parameterised;
  `seedDemoWorld` deletes all demo-domain users, then writes one group in one transaction.
- Frozen MF-0029 tests call `seedDemoWorld({ world })` and `planDemoWorld` without `groupName`; both must keep working.
- Precedent: MF-0029 (same files, same guard, same re-run rules).

## Steps
1. `resolve-seed-packs.ts`: pure selection (SC-1).
2. `plan-demo-world.ts`: `youSkillLimit`, `demoGroupName`, optional `groupName`; "you" uses
   `youSkillLimit(skills.length)` (SC-2, SC-3). ccdv-f: 25 → 20, unchanged.
3. `seed-demo-world.ts`: `seedDemoWorlds` = the MF-0029 body with steps (a)–(d) once and step (e) per world inside
   one transaction; it asserts every world has the same learners. `seedDemoWorld` = `seedDemoWorlds([world])` (SC-4, SC-5, SC-6).
4. `scripts/dev-seed.ts`: `--pack` (repeatable), discover `packs/*/` with question counts, plan one world per pack
   with `demoGroupName(pack.name)`, `seedDemoWorlds`, print per-pack summary + the narrowed-run note (SC-7).
5. Gates, `pnpm test:db`, the real run + read-back + render (SC-7, SC-8). Fresh-context review (high-risk).

## Riskiest step
Step 3, the privileged deletes. Unchanged rules: users only on the asserted demo domain; your attempts only by
manifest id AND your user id; all group writes in one transaction. Re-run state: see GOAL "Riskiest step".

## Rejected
- Per-pack demo domains (10 accounts, and the sidebar fills with demo people).
- Keeping other packs' groups on a narrowed run: needs non-deleted shared users, breaking MF-0029 SC-6.

```json tasks
[
  {"id":"T1","agent":"service-builder","owns":["src/dev-seed/resolve-seed-packs.ts"],"depends_on":[],"closes":["SC-1"],"done_when":"SC-1 green","context":"pure"},
  {"id":"T2","agent":"service-builder","owns":["src/dev-seed/plan-demo-world.ts"],"depends_on":[],"closes":["SC-2","SC-3"],"done_when":"SC-2, SC-3 green; MF-0029 plan acceptance green","context":"planner"},
  {"id":"T3","agent":"service-builder","owns":["src/dev-seed/seed-demo-world.ts"],"depends_on":["T2"],"closes":["SC-4","SC-5","SC-6"],"done_when":"db acceptance green","context":"privileged writes"},
  {"id":"T4","agent":"service-builder","owns":["scripts/dev-seed.ts"],"depends_on":["T1","T2","T3"],"closes":["SC-7"],"done_when":"real run + read-back","context":"CLI"},
  {"id":"T5","agent":"verifier","owns":[],"depends_on":["T4"],"closes":["SC-8"],"done_when":"receipt","context":"gates"}
]
```

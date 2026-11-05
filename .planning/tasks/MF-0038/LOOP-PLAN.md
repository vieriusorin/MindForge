# MF-0038 LOOP-PLAN — iteration 0

## Discovery

- Precedents: MF-0031 (`packs/prod-prompting`, same shape, retro lessons) and MF-0037 (`packs/ai-capabilities`,
  sibling session, same request shape). Item schema `src/engine/content/schema.ts`; pack schema
  `src/engine/pack/schema.ts` (weights sum per domain, ±0.05). `level` optional since MF-0031.
- Sources: 22 URLs, all cached by `pnpm generate:corpus --pack platform-foundations` (2026-11-04 14:43Z,
  fetched=17 unchanged=5 refused=0); every cached text is 3–75 kB of real text (Help Center pages are server-rendered).
- Gates on these paths: the frozen MF-0038 acceptance test; `pnpm check:packs` (MF-0036, now in
  `.claude/rules/testing.md` "Before hand-off"; today it checks cuckoos only, so this pack passes trivially);
  `db:sync-keys` → `validate-packs.mjs` before any write.
- Frozen files this will re-freeze: none. No closed set or shared shape widens (new pack directory only). Grep of
  `**/*.acceptance.test.*` for `platform-foundations`: no hits besides MF-0038's own.
- Baseline red (GOAL): MF-0032 ×3 files and MF-0037 ×1 file, other sessions' frozen reds.

## SC → steps

| SC | Step |
|---|---|
| SC-1 | S1 pack.yaml (done in PLAN: needed to cache sources) |
| SC-2…SC-7 | S2 three drafting agents write questions/cards/diagrams + grounding notes |
| SC-9 | S3 three fresh-context verifier agents (one per drafting group, never the drafter) → `verify/G*.md`; S4 fixes |
| SC-8 | S5 12-word overlap scratch check vs `_files/Associate_M1_vF2.html` text |
| SC-10, SC-11 | S6 `pnpm db:sync-keys` ×2, `pnpm dev:seed --pack platform-foundations` (approved), DB read-backs |
| SC-12 | S7 browser or HTTP render on :3001 |
| SC-13 | S8 `docs/plan/platform-foundations-validation.md` |
| SC-14 | S9 typecheck, lint, test, build, check:packs; receipt |

## Drafting groups and answer-key rotation

- G1: D1.S1, D2.S1 (+ capstone diagram, SC-6), D2.S2. G2: D3.S1, D3.S2, D3.S3. G3: D4.S1, D5.S1, D5.S2.
- Each group's 18 questions use the key sequence B D A C C A D B A C B D D B C A A C (each letter 4–5 of 18), so
  the pack sits at ≤ 28% per letter, well under SC-4's 40%.

## Riskiest step

Content correctness on a moving product surface (GOAL). Plausible claims about plan availability, defaults and
model lineup. Controls: the drafter writes a grounding note (item → supporting passage, quoted from the cached
text); a fresh-context verifier re-checks key, every rationale, every `whereItBreaks`, backticked tokens, absolute
quantifiers and diagram branches against the cited page; the C-1 drift rule (no item tests a point where course
and docs disagree; no "Opus is the top tier"; no claim that project chats never share context). Re-run state:
see GOAL (nothing owned on disk; sync validates first).

## Rejected options

- One fork per skill (9 drafters): more coordination, same quality; 3 groups match MF-0031.
- Generating with `pnpm generate:*` (MF-0022 pipeline): needs the paid API key and batches; out of scope.
- Putting the capstone in its own skill: SC-6 places it in D2.S1, where the entry-point decision starts the chain.

```json tasks
[
  {"id": "T1", "agent": "service-builder", "owns": ["packs/platform-foundations/pack.yaml"], "depends_on": [], "closes": ["SC-1"], "done_when": "SC-1 green", "context": "done in PLAN"},
  {"id": "T2", "agent": "general-purpose", "owns": ["packs/platform-foundations/{questions,cards,diagrams}/D1.S1.yaml", "packs/platform-foundations/{questions,cards,diagrams}/D2.S*.yaml", ".planning/tasks/MF-0038/grounding/G1.md"], "depends_on": ["T1"], "closes": ["SC-2", "SC-3", "SC-4", "SC-5", "SC-6", "SC-7"], "done_when": "files load; G1 grounding note complete", "context": "G1"},
  {"id": "T3", "agent": "general-purpose", "owns": ["packs/platform-foundations/{questions,cards,diagrams}/D3.S*.yaml", ".planning/tasks/MF-0038/grounding/G2.md"], "depends_on": ["T1"], "closes": ["SC-2", "SC-3", "SC-4", "SC-5", "SC-7"], "done_when": "files load; G2 note complete", "context": "G2"},
  {"id": "T4", "agent": "general-purpose", "owns": ["packs/platform-foundations/{questions,cards,diagrams}/D4.S1.yaml", "packs/platform-foundations/{questions,cards,diagrams}/D5.S*.yaml", ".planning/tasks/MF-0038/grounding/G3.md"], "depends_on": ["T1"], "closes": ["SC-2", "SC-3", "SC-4", "SC-5", "SC-7"], "done_when": "files load; G3 note complete", "context": "G3"},
  {"id": "T5", "agent": "general-purpose", "owns": [".planning/tasks/MF-0038/verify/G*.md"], "depends_on": ["T2", "T3", "T4"], "closes": ["SC-9"], "done_when": "one fresh verifier per group, report written", "context": "never the drafter"},
  {"id": "T6", "agent": "verifier", "owns": [".planning/tasks/MF-0038/LOOP-VERIFY.md", ".planning/evidence/MF-0038.md", "docs/plan/platform-foundations-validation.md"], "depends_on": ["T5"], "closes": ["SC-8", "SC-10", "SC-11", "SC-12", "SC-13", "SC-14"], "done_when": "receipt PASS for the tree", "context": "orchestrator runs inline"}
]
```

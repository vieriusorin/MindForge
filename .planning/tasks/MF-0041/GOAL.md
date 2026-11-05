---
ticket_id: MF-0041
tier: normal                      # dev tooling: an offline content check; no app code, no DB
stage: intake
goal_status: reserved             # created by the MF-0036 retro (gate action); never built automatically
builds_on: [MF-0016, MF-0036]
---

> Reserved 2026-11-04 by the MF-0036 retro (Action 2). Not built until the user picks it up.

## Objective

**Today.** `src/engine/content/schema.ts:161-172` only checks that `flawLine` is in range and not blank.
`ccdv-f.D6.S1.cuckoo-keep-every-tool-result` shipped with `flawLine: 3` keying `"2. Fetch files…"` (a true
line): the snippet's numbered-list labels ran one behind the 1-based line index, so a learner who found the
real flaw was graded wrong. MF-0016's tests and review missed it; the MF-0036 intake probe found it.

**End state.** `pnpm check:packs` (`scripts/check-pack-grounding.mjs` → `scripts/lib/cuckoo-grounding.mjs`)
gains a flaw-key rule: when two or more `lines` start with `/^\s*\d+[.)]\s/` and the label of
`lines[flawLine - 1]` is not equal to `flawLine`, the item fails unless it carries
`# flaw-line: <n> — <reason naming the offset>`. The rule does not fire when the flaw line has no label.

## Proof cases
- RED on the pre-fix D6.S1 shape (`flawLine: 3`, label `2.`).
- The fixed `flawLine: 4` (label `3.`) needs one `# flaw-line:` comment; comments leave `contentHash`
  unchanged (MF-0036 SC-7), so no reviews reset.
- Inline-YAML frozen test for both shapes.

## Open questions
- Per the MF-0036 retro skill edit: probe the drafted rule against its proof case and all shipped cuckoos
  at intake, before freezing.

---
ticket: MF-0036
outcome: pass
causes: wrong-plan, missing-context
actions: skill-edit, gate
applied: 2026-11-04
lesson_keys: draft-rule-vs-own-proof-case, new-check-reviews-shipped-content, ai-content-claims-outrun-source, parallel-session-coordination
---
## Numbers
`pnpm ticket:retro` is not in package.json, so these come from the artifacts by hand. There are no session token metrics, so no token verdict.
- Iteration 0 only; FROZEN.json `history: []` (no refreeze). One BUILD code fix (report the quantifier as its lower-case key, per SC-1/SC-2).
- Freeze: 20 acceptance tests, all RED with `Error: not implemented` (the stub, i.e. the SC). Then 20/20 green, frozen hash OK.
- Receipt DONE `02d8f4e3854a` (scoped to this ticket's paths). typecheck 0, lint clean, related set `Tests 44 passed (44)`, `check:packs: 7 cuckoo file(s), 0 problem(s)`.
- Full `pnpm test`: `23 failed | 362 passed`, all in MF-0032 (14), MF-0037 (2), MF-0038 (7) frozen RED files of other sessions. Not this ticket's.
- SC-1..SC-8 all PASS; SC-7: 14 cuckoo content hashes identical before/after the annotations.
- Intake probes (read-only) found two things the drafting session missed: the drafted rule did not catch its own proof case, and `D6.S1` `flawLine: 3` keyed a true line.

## Went right
- A read-only probe at intake ran the drafted rule against its own proof case before any design: the cited permissions page contains `never` 12 times, so "quantifier absent from the cited text" passes the pre-fix D7.S2 line 3. The ticket then redesigned to "always annotate" (U-3, D-1) instead of freezing 20 tests around a rule that could not go RED on its motivating case. Rejected option is recorded in LOOP-PLAN. — keep: not written as a rule yet, see Action 1.
- The same probe, run over the 14 shipped cuckoos, found the real `D6.S1` defect (1 quantifier hit on a line that was supposed to be true), and the user decided at once to fix it in MF-0016 with a RED-first regression test (`src/engine/content/__tests__/cuckoo-flaw-keys.test.ts`). — keep: Action 1.
- Pure checker in `scripts/lib/cuckoo-grounding.mjs`, CLI only does I/O, inline YAML and corpus fixtures so CI without `.cache/` runs the proof. Precedent `redact-secrets.mjs` named in PLAN Discovery. — keep: already is, in LOOP-PLAN Discovery for this ticket; no new text.
- Annotations as YAML comments, with SC-7 proving `contentHash` unchanged rather than assuming it, so no review reset. — keep: already is, GOAL D-4 and SC-7.
- The receipt hashed only this ticket's paths and attributed all 23 reds to other sessions by file name. — keep: already is, in the receipt format (MF-0031 precedent).

## Went wrong
- The reserved GOAL (written by the MF-0016 retro) carried a rule and a proof case that contradicted each other. It was caught only because the intake session happened to probe it. Nothing in INTAKE or DESIGN says to run a drafted rule over its own proof case, and the existing instruction for GOAL drafts from an earlier session covers contradictions with the user's later answers and `CONTEXT.md`, not with the GOAL's own example. The sibling reserved ticket MF-0033 states the same document-level rule ("when the cited text does not contain the same word", MF-0031 retro Action 1) and has the same weakness. Cause: wrong-plan (the draft), missing-context (the skill step that would have forced the probe).
- A shipped content defect, `ccdv-f.D6.S1.cuckoo-keep-every-tool-result` `flawLine: 3` keying a true line (list labels "2.", "3." one behind the 1-based line index), got through MF-0016's acceptance tests and review. The schema only checks `flawLine` is in range and not blank (`src/engine/content/schema.ts:161-172`), and the tests asserted the key exists, not that it points at the described line. The trap is repeatable on any numbered snippet. It was fixed only because a different ticket's rule happened to flag the true line. Cause: missing-context, `ai-content-claims-outrun-source` on a new item kind (the check that would catch it is the one this ticket just built, but it only fires when the false line carries an absolute word).
- Whole-suite red from MF-0032/0037/0038 for the entire ticket, attributed by hand again. Cause: parallel sessions on one worktree (`parallel-session-coordination`), already handled correctly.

## Actions (at most two)
1. skill-edit: `/Users/sorinvieriu/Projects/mind-forge/.claude/skills/gsd-goal-loop/SKILL.md`, Stage 2 DESIGN. In the paragraph that begins "Any SC that shows a computed figure", after the sentence "When the GOAL was drafted in an earlier session, also re-read each draft decision against the user's later answers and `CONTEXT.md` for contradictions.", add:
   "When the GOAL drafts a check or lint rule with a named proof case (a reserved gate ticket), run the drafted rule over that proof case with a read-only probe before freezing anything, then over every shipped item it will govern; the first run of a new check is a review of existing content, so list its hits as findings in the GOAL. A rule the proof case cannot turn RED on is a Concern for the user, not a build (MF-0036: 'quantifier absent from the cited page' passed its own proof line because the page said `never` 12 times; the same probe found a shipped `flawLine` pointing at a true line). A reserved sibling that states the same rule (MF-0033) gets the same probe when it is picked up."
   Would have saved: the reserved GOAL's contradiction being found by luck instead of by step, and the same wasted freeze risk on MF-0033.
2. gate: draft a new ticket (claim the next free MF number, `goal_status: reserved`, owned by the user), to extend `scripts/check-pack-grounding.mjs` / `scripts/lib/cuckoo-grounding.mjs` with a flaw-key rule and wire it into `pnpm check:packs`. Pattern: in a cuckoo item, when two or more entries of `lines` start with a numeric label (`/^\s*\d+[.)]\s/`) and the label of `lines[flawLine - 1]` is not equal to `flawLine`, the item fails unless it carries `# flaw-line: <flawLine> — <reason naming the offset, e.g. "line 1 is a heading, labels trail the index by 1">`; with no label on the flaw line the rule does not fire. Real file it would have caught: `packs/ccdv-f/cuckoos/D6.S1.yaml`, `ccdv-f.D6.S1.cuckoo-keep-every-tool-result`, pre-fix `flawLine: 3` keying `"2. Fetch files when you need them; …"` (label 2, index 3). The fixed `flawLine: 4` (label 3) would need one `# flaw-line:` comment, which is the human check the item should carry. Comments do not change `contentHash` (MF-0036 SC-7), so no review resets. The new ticket's proof is an inline-YAML frozen test for the pre-fix and fixed shapes. Would have saved: a shipped, wrong answer key that a learner who found the real flaw would have been graded wrong on, and the post-hand-off fix cycle in MF-0016.

## Not worth changing
- The BUILD one-line fix (quantifier reported as lower-case key): the SC text was exact, one correction, not a pattern.
- Whole-suite red from other sessions: handled by the scoped receipt hash and file-name attribution; isolating it would loosen the full-suite rule.
- The two exam-guide PDF cuckoos needing `# uncached:` forever (`corpus.ts` never stores PDFs): the exemption is deliberate (U-6), only the "source missing" case, and recorded.
- Free-text `# grounded:` reasons are a human judgement with no mechanical check (stated under "Not verified"): an inherent limit of the rule, not a defect. The over-claiming shape is caught, not every false sentence.
- No fresh-context review for a normal-tier dev-tool ticket: within the tier rules.

## Applied

- Action 1 (skill-edit, additive) **applied**: `.claude/skills/gsd-goal-loop/SKILL.md` Stage 2 DESIGN, the
  "probe the drafted rule against its own proof case" sentences appended after "…`CONTEXT.md` for contradictions."
- Action 2 (gate) **reserved, not built**: `.planning/tasks/MF-0041/GOAL.md` (flaw-key rule for `pnpm check:packs`).
  MF-0040 was already claimed by another session, so the next free number was used.
- Memory: none proposed; none changed.

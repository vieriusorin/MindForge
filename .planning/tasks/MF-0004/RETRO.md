---
applied: 2026-11-03
ticket: MF-0004
outcome: pass
causes: wrong-plan, missing-context, known-trap-repeated
actions: skill-edit
lesson_keys: format-before-freeze, runbook-command-verbatim, shared-devtools-browser, parallel-session-coordination, hosted-scs-split-from-code
---
## Numbers
No `ticket:retro` script exists; counts read by hand from the ticket's files.
- Iterations: 1 (`last_iteration: 1`). `goal_status: complete-pending-manual-commit`, closed by the user on 2026-11-03 after a park (`blocked-on-user`).
- Receipt: local slice PASS (85 unit/ui, 14 db, typecheck, lint, build, advisors clean). Tree `359c930e...`.
- Freeze: 5 acceptance files frozen red; 1 re-freeze (3 files, formatter only, user approved).
- Review: 2 rounds. 1st changes-requested (1 blocking: runbook B4 advisors command), 2nd approve at the receipt hash.
- SCs closed: SC-4 (code + local config, live), SC-5, SC-6, SC-9. Open and unticked, carried to `docs/runbook/deploy.md`: SC-1, SC-2, SC-3, SC-8 (Vercel env list), SC-4 hosted allowlist, SC-7 hosted dry run. That is 6 of 9 SCs' hosted halves still unproven at close.
- Closing discovery: read-only checks found no hosted Supabase project, no Vercel project and no committed MF-0004 code, so T8 could not be verified at all.

## Went right
- Concerns C-2..C-5 were decided by the user during DESIGN, so BUILD ran with no mid-build question. Keep: already is, GOAL.md "Concerns" table.
- Frozen reds were checked for the SC's own reason and a baseline run was recorded before any code. Keep: already is, SKILL.md Stage 2b and LOOP-VERIFY.md.
- The receipt said "PASS for the local slice ... NOT DONE for the ticket" and the close entry kept the hosted SCs unticked with a named carrier (the runbook). It did not overclaim, even when the user said "it works, continue". Keep: already is, SKILL.md Stage 5 ("tick the SCs") plus the GOAL.md close entry.
- When the browser stayed locked, the agent proved the invite-URL origin over live HTTP against the running dev server with hostile headers (throwaway user, real cookie, real group, deleted afterwards), and after a user-approved `supabase stop && supabase start` it proved Auth's redirect behaviour live. This also surfaced a real nuance: GoTrue accepts any port on `site_url`'s hostname. Evidence in `.planning/evidence/MF-0004.md`. Keep: already is in the evidence file. It is a one-off technique, not a rule.
- Both skill-edits proposed by the first retro were applied (see "## Applied").

## Went wrong
- Code SCs and human-gated infra SCs lived in one ticket. SC-1/2/3/7/8 and the hosted half of SC-4 need a Supabase project, a Vercel project, a DNS owner and Resend, none of which existed. The GOAL.md drafted them as the ticket's own SCs, the plan marked T8 `agent: human` from the start, and the user approved "continue locally" at the PLAN checkpoint. So the ticket could never reach all-green from code work: it parked, then was closed with 6 hosted items open, and the "does the hosted project exist?" fact was only found by read-only discovery at the very end. SKILL.md Stage 2 requires each SC to name its proof and each Concern an owner, but says nothing about checking that the target of a hosted proof exists, or about splitting such SCs into their own ticket. cause: wrong-plan (scope of the ticket), enabled by missing-context.
- Acceptance files were frozen before `biome format` ran, forcing a formatter-only re-freeze and a user approval. Fixed by action 1 of the first retro (applied). cause: missing-context.
- First review blocked on runbook step B4 (`supabase db advisors` without `--level warn --fail-on warn`); the dry run had used a different command than the runbook text. Fixed by action 2 of the first retro (applied). cause: missing-context.
- The browser check was impossible (shared chrome-devtools profile held by another session), and the live Auth check waited for a stack restart that needed user approval. Memory entries `feedback-browser-verification` and `feedback-local-first` already say to list other sessions at PLAN. The cost was an "Unverified" line plus extra work, not a defect. cause: known-trap-repeated.
- Skill and review reference scripts that do not exist (`ticket:verify`, `ticket:freeze`, `ticket:retro`). The process worked by hand. cause: tooling, no action.

## Actions (at most two)
1. skill-edit: `/Users/sorinvieriu/Projects/mind-forge/.claude/skills/gsd-goal-loop/SKILL.md`, Stage 2, immediately after the sentence ending "…Two defensible business answers → a configurable setting chosen by an admin, not a guess." Insert this paragraph:
   "An SC whose proof needs infrastructure or an account that does not exist yet (a hosted project, a deploy target, DNS, a third-party sender) is not a code SC. At DESIGN, check read-only that its target exists (e.g. `supabase projects list`, `vercel ls`, `vercel project ls`) and record the result. If it does not, move those SCs to their own `reserved` ticket owned by the user, with the runbook as its deliverable, and keep this ticket to what the local stack can prove. Do not carry them as a `T8 human` task inside the code ticket."
   Would have saved: a park, a second pass over the ticket at close, and a ticket that closes with 6 unticked SCs. The code slice would have closed as a clean pass.

## Applied
- 2026-11-03: action 1 (skill-edit, additive) applied: `.claude/skills/gsd-goal-loop/SKILL.md` Stage 2b, "format and lint before FREEZE" paragraph before "Run FREEZE on the files."
- 2026-11-03: action 2 (skill-edit, additive) applied: `.claude/skills/gsd-goal-loop/references/verification.md`, bullet appended to "What counts as evidence": run runbook commands as written.
- Held: none.
- 2026-11-03 (whole-ticket retro): new action (skill-edit, additive) applied: `.claude/skills/gsd-goal-loop/SKILL.md` Stage 2, the "hosted-proof SCs: check the target exists, else split into a user-owned ticket" paragraph after "Two defensible business answers…". Held: none.

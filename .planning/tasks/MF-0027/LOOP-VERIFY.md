# MF-0027 · LOOP-VERIFY

Docs-only ticket: no acceptance tests were frozen (no SC has a test proof). Tree hash
(`git diff HEAD` + untracked) at verify: `76fe8e8542b94a70afc079e426d938a2e9097d413d3a0ed1d58f1a72bbd88595`.

| SC | Verdict | Evidence |
|---|---|---|
| SC-1 | PASS | `docs/adr/0005-answers-after-a-reveal-count-as-recall.md` exists; first line: "Decided 2026-11-05 by the user (MF-0027, Q-1: \"Count it\")". It cites facts 1–6 and names the residual (key memorisation on small banks). |
| SC-2 | PASS | CONTEXT.md now has **Revealed** directly below **Spoiled**; Spoiled is unchanged, and Revealed states how it differs (key after a retrieval vs before). |
| SC-3 | PASS | Choice was "Count it", so no follow-up ticket; none created (`ls .planning/tasks/` unchanged apart from MF-0027). |

`pnpm lint`: `Checked 575 files in 118ms. No fixes applied.`

Verdict: DONE for the tree hash above.

---
ticket_id: MF-0057
tier: normal                      # dev tooling: a source lint for Tailwind class tokens; no app code, no DB
stage: intake
branch:
builds_on: [MF-0010]
last_iteration: 0
goal_status: reserved             # created by the MF-0010 retro (gate action); never built automatically
---

> Reserved 2026-11-06 by the MF-0010 retro (gate action). Not started.

## Objective

Tailwind 4 reads `_` inside an arbitrary variant as a space. `[&_.react-flow__edge-text]:fill-…` therefore compiles
to `.react-flow edge-text` and matches nothing; MF-0010's diagram edge labels drew as black boxes in dark mode and
no test could see it (jsdom does not compile Tailwind). A literal underscore must be written `\_`.

End state: a pure check `scripts/lib/tailwind-variant-check.mjs` (with a co-located test) scans `src/**/*.tsx`
(skipping `src/components/ui/**`) and flags class tokens matching `\[&[^\]]*_\.[A-Za-z0-9-]*__[A-Za-z0-9-]*`
(a bare `_` before a class name containing `__`), with the message
`<file>: Tailwind turns "_" into a space; write "\_\_" for a literal double underscore in <token>`.
It runs in the same Stop/CI gate as `gate:planning`.

## Success Criteria (proposed; the claimant confirms and freezes)

- [ ] SC-1: the pre-fix token `[&_.react-flow__edge-text]:fill-muted-foreground` is flagged; the escaped form
  `[&_.react-flow\_\_edge-text]:fill-muted-foreground` and `[&_.recharts-cartesian-axis-tick_text]` are clean.
  Proof: unit test.
- [ ] SC-2: the check passes on today's `src/` and is wired into the gate. Proof: gate run.

## Open questions

- CI and hook config are guarded (as MF-0046): the wiring step needs the user's approval.

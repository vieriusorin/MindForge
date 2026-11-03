---
ticket_id: MF-0003
outcome: complete
causes: [plan-gap, tooling, other]
actions: [memory-update, memory-add]
lesson_keys: [api-max-rows-paging, shared-devtools-browser, parallel-session-coordination]
applied: yes
written_by: main session (inline; no separate retro agent was run)
---

## Right

- The honesty boundary held under review: the DB grades, clients can't write attempts, and the browser never gets keys or rationales before grading (217 snippets grepped in the real HTML).
- Probing ts-fsrs 5.4.2 *before* freezing SC-3 confirmed the spec thresholds produce the stated stages. The MF-0001 lesson ("re-derive numbers from the source") was applied and paid off.
- Content was drafted by a background agent in parallel with the engine build; all 53 questions passed the real validator first time.
- A parallel UI session restructured the app mid-ticket. Messaging it (file ownership, URL shape, an overlay bug that was theirs) avoided overwrites and duplicated work.

## Wrong

- **plan-gap:** a single-query read of all a user's rows. The Data API's `max_rows` (1000) silently truncates. Only the fresh-context reviewer caught it.
- **tooling:** in the browser run, clicks made while the sidebar was still streaming landed on sidebar links (layout shift), sending the tab to /today and /groups. About 6 tool calls went on proving it wasn't an app bug (a navigation log via init script).
- **other:** plan paths went stale because another session moved `src/app` into route groups during the build.

## Actions

1. memory-update `project-supabase-migration-rules`: add "Data API reads are capped at max_rows = 1000: page any per-user read that can grow (`.range()`, stable order)". *(applied)*
2. memory-add `feedback-browser-verification`: in the shared chrome-devtools browser, wait for streamed content (e.g. "Sign out" in the sidebar) before clicking, and pass an explicit pageId; before planning, check `git status` / `ListAgents` for another MindForge session and agree file ownership. *(applied)*

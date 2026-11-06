# MF-0058 research — learning-path UX (2026-11-06)

Gathered by a researcher agent at intake. (V) = verified on the vendor's own page; (U) = unverified / third-party.
Khan Academy help pages returned 403; their rows rest on search snippets of the official pages.

## How products signal path state

| Product | Started | Next step | Course complete = | Path complete | Ordering |
|---|---|---|---|---|---|
| Duolingo | placed on one path (V) | current node highlighted; floating "back to current" arrow (V) | all levels gold; optional Legendary (V) | — | strict; "Jump here" test-out (U) |
| Khan Academy | mastery % from 0 | "Up next" (U) | % of skills ≥ Proficient; **mastery can drop** on a later test (V, snippet) | course challenge (V, snippet) | recommended, unlocked |
| Coursera | explicit enroll in the Specialization (V) | course list + Resume (U) | all graded work passed; video watching never counts (V) | certificate; capstone locked until rest done (V) | free, except capstone |
| edX | Programs tab (V) | program record | verified cert per course (V) | program cert + record (V) | recommended |
| Microsoft Learn | path header "N modules", trophy shown up front (V) | ordered modules with badges (V) | module badge = knowledge check passed (V) | trophy; credential is separate (V) | recommended |
| Anthropic Academy (Skilljar) | "Register" on path page, ordered courses with minutes (V) | per-course overview (V) | lessons navigated (+ optional quiz) (V) | not shown (U) | configurable (U) |
| Codecademy | enroll | per-lesson bar (V) | — | **now: pass all exams**, replaced 100%-completion cert (V) | sequential (U) |
| Brilliant | pick a topic (V) | practice checkpoints (V) | — | — | topics free; jump-ahead needs a level check (V) |
| Exercism | join a track | concept tree; locked concept says what to learn first (V) | learning exercise solved (V) | — | Learning mode locks / Practice unlocks (V) |

## Patterns worth adopting

1. Explicit **Start path** act — Coursera silo failure shows implicit enrollment confuses. https://community.deeplearning.ai/t/specilization-certificate/877967
2. One **Continue** target, always reachable. https://blog.duolingo.com/new-duolingo-home-screen-design/
3. Course done = **learned, not seen** (no time/views). https://support.khanacademy.org/hc/en-us/articles/115002552631
4. **Two figures**: permanent "Completed on {date}" + live health that can fade. (Khan mastery drop)
5. Path ends with an **assessment**, not 100% (Codecademy redesign). https://www.codecademy.com/resources/blog/career-path-redesign
6. Course badge + path trophy, visible before starting (MS Learn). https://learn.microsoft.com/en-us/training/support/faq
7. **Recommended order, not hard locks**; a lock says what unlocks it. https://exercism.org/docs/building/product/unlocking-exercises
8. "Course 2 of 4" step count, not only a %. https://www.nngroup.com/articles/progress-indicators/
9. Honest **endowed progress**: courses already done count at start. https://lawsofux.com/goal-gradient-effect/
10. Unfinished path card stays on Today (Zeigarnik). https://lawsofux.com/zeigarnik-effect/

## Pitfalls

- A permanent 100% next to a fading forest contradicts itself → separate labelled figures.
- Bars that move for time spent, or move backwards unexplained → any drop names its cause ("2 skills faded").
- Hard locks without test-out → quitting / skipping foundations.
- Course progress that does not count toward the path (Coursera) → count automatically once enrolled.
- Calling path completion "certified" → it is a trophy, not a credential.

## Unverified

MS Learn Start/Resume and time-left UI; Duolingo official "Jump here" rules; Skilljar path-level certificate; Coursera "Resume" wording.

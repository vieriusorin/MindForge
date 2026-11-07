# Confidence grades recall

Decided 2026-11-06 by the user (MF-0062 D-6), built in MF-0065. It sits beside ADR 0005, which made every graded answer count with no change to the FSRS rating. This ADR changes the rating, not what counts.

Before the key is revealed, a learner may tap **Sure** or **Not sure**. The tap is stored on the attempt (`attempts.confidence`) by the same `record_attempt` call that grades the answer, so it cannot be chosen after seeing the verdict. A retry with the same client attempt id and a different tap is refused (23505), like any other change to an answer. The database only stores and bounds the tap. The rating is decided in the engine, which replays the attempts as before (ADR 0004, D-4):

| Answer | Tap | FSRS rating |
|---|---|---|
| correct | Sure | Good |
| correct | Not sure | Hard |
| wrong | Sure or Not sure | Again |
| correct / wrong | none | Good / Again (as before) |

A correct answer tapped Not sure is still a successful recall. It just grows the tree more slowly: probed on ts-fsrs 5.4.2 with fuzz off, a first answer gives stability 2.31 days for Good, 1.29 for Hard and 0.21 for Again, and Good then Hard a day later gives 5.32 days against 7.32 for Good twice, so it still reaches Sapling.

**Confident miss.** A wrong answer tapped Sure means the learner believes something false. FSRS alone does not bring that skill back soon. A Sapling of 36 days that lapses keeps a retrievability of 1.0 for the first day, because elapsed days are floored, and it stays a non-wilting Sprout for several days. So while a confident miss is the skill's latest answer, the engine treats the skill as needing water: the Daily Walk includes it first, ahead of the walk's length cap, and the next review shown after a lesson is at most 24 hours after the miss. This is derived from the attempt each time, with no stored due date. It never changes the tree's stage or "Fading": forest figures stay pure FSRS.

**Never a group figure.** The tap is a private self-report. `group_attempts` does not return it, and the group heatmap strips it before replaying other members' attempts, so a member's taps cannot move a figure that others see. Expedition progress counts correct answers in SQL and never reads it.

**The tap is optional.** No tap grades as before. A required tap would add a forced step to every question, and it would void every existing answer-flow contract. Storms (exam conditions) and Spot the Cuckoo (a line pick) do not offer it.

We rejected four alternatives:
- A separate call that sets the tap after grading lets the learner choose it after seeing the verdict.
- A stored due date for the 24-hour rule would put the decision in the database and give one fact two owners.
- Discounting or dropping correct answers tapped Not sure would undo ADR 0005's rule that every graded answer counts.
- Rating a confident miss below Again is impossible, because Again is FSRS's floor; the 24-hour review is the stronger lever.

**Consequences:** two learners with the same answers can grow different forests, because their taps differ. That is intended. Group figures stay comparable because they ignore taps. Because no tap grades like Sure and an honest Not sure grades Hard, a learner who never taps grows trees fastest. Revisit this ADR if learners never tap or tap Sure on nearly everything (in both cases the tap adds nothing), or if confident misses crowd the Daily Walk.

# MindForge glossary

Canonical terms. When code, docs or tickets disagree with this file, this file wins (or gets fixed).

## Content

- **Pack**: a curriculum (exam, course, onboarding) shipped as files under `packs/<slug>/`. Shown as a biome.
- **Domain**: a weighted part of a pack. Shown as a region.
- **Skill**: a weighted part of a domain, the unit of memory. Shown as a tree.
- **Item**: one piece of learnable content attached to a skill: a question, nature card or diagram. Items live in pack files.
- **Nature card**: an item that explains one concept of a skill through a nature analogy, with a required "where it breaks". A skill can have several; each names its concept in free text. There is no separate Concept entity in v1.
- **Diagram**: a graph item (direction, nodes, edges; ADR 0003) attached to a skill, reviewed on its own; a card may point to one. Drawn with React Flow, read aloud as its steps and connections.
- **Source**: an official documentation page listed for a skill. A skill's sources are the material its items are written from. Course content behind a login is never a source.
- **Citation**: the source an item points to for its answer. It must be one of its skill's sources.
- **Covered skill**: a skill with at least 1 approved nature card, 1 approved diagram and 15 approved questions (goal G3).
- **Origin**: who wrote an item: `official` (copied verbatim from the exam guide), `human`, or `ai`. Fixed in the file; a review never changes it.
- **Review state**: how far the team trusts an item, computed from reviews: `unreviewed`, `approved` (2 approvals, no open flag), `flagged` (any open flag), `rejected`. Not stored in files. Official items start as approved but can still be flagged.
- **Rejected**: a review state meaning "do not play". A rejected item is removed from the file in a later PR; until then it is never served.
- **Playable**: an item a learner can be served. Practice modes serve approved and unreviewed items (unreviewed shows a badge); storms prefer approved and use unreviewed only to fill a short domain, labelled in the report. Flagged and rejected items are never served.
- **Attempt**: one graded answer by a learner to a question. The forest is replayed from attempts; attempts on a rejected question are left out of the replay, attempts on a flagged one still count.
## Game

- **Storm**: a timed exam-style test. A **Boss Storm** covers one domain; a **Full Storm** is a blueprint-weighted mock of the whole exam (CCDV-F: 53 questions, 120 minutes).
- **Storm-proven skill**: a skill whose questions in one storm were all answered correctly, with at least 2 of them. Needed for the Tree stage (or a passed Feynman, later); Full-Storm-proven is needed for Ancient.
- **Voided question**: a storm question whose content changed while the storm ran. It is not scored and makes no attempt; the report lists it.
- **Survived domain**: a domain scored at least 72% in a storm (mirrors the 720/1000 pass mark). Used in the readiness report, not for tree stages.

- **Memory forecast**: per domain, the skill-weighted average retrievability projected to the exam date. "If nothing changes, how much you will still remember on exam day."
- **Readiness weather**: per domain, from the lower of the memory forecast and the last storm score: sunny ≥ 85%, cloudy 72–85%, rain < 72%, fog when there is no data. Exam packs only. MindForge never shows an estimated scaled exam score.

## People

- **Learner**: a signed-in person who plays. Their forest is private to them.
- **Group**: a study group of a few learners (about 5–6) working on one pack. A learner can be in several groups; memory is per learner per pack, shared across those groups.
- **Group admin**: the member who created the group or was made admin; can rotate the invite code.
- **Group heatmap**: per-region aggregate of a group's memory (average retrievability, share of healthy trees). Shown only when at least 3 members have attempts. No per-member figures are ever shown to other members.
- **Expedition**: a group's shared 7-day goal, started by the group admin: a number of correct recalls in one domain. Every current member's countable correct attempts in that domain inside the window, made since they joined the group, count. Only the group total is shown, and only in groups of at least 4 members. One runs at a time.

## Content (continued)

- **Author**: the person responsible for an item. For `ai` items, the person who ran the generation. An author's own approval never counts.
- **Reviewer**: any learner who is in at least one group for the pack. Approves or flags items; two approvals from two non-authors make an item approved.
- **Flag**: a reviewer's claim, with a required comment, that an item is wrong. One open flag hides the item until a content maintainer resolves it.
- **Content maintainer**: a small fixed list of people per pack who resolve flags (fix the item in a PR, or dismiss with a comment) and who alone can reject. Not a group role.
- **Analogy owner**: the content maintainer whose approval a nature card needs, on top of the two reviewer approvals, before it counts as approved. If the owner hasn't acted within 48 hours, any content maintainer may give it.
- **Spoiled**: a question a learner has reviewed. Reviewing shows the key, so that learner's later attempts on it do not count toward their forest.
- **Content hash**: the fingerprint of an item's content. Reviews count only for the hash they were made against, so editing an item resets its review state.

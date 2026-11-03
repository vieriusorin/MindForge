# Content lives in pack files; only reviews live in the database

Decided 2026-11-03. Items (questions, nature cards, diagrams) stay in `packs/<slug>/` YAML as the single source of truth, written by humans or AI and changed only through PRs. The database holds just the answer keys (synced) and `item_reviews` keyed by item id + content hash; an item's review state is derived from those reviews and never written back to the file. We chose this over the `items` table in `MINDFORGE.md` §2.7 because packs-as-files already exists (MF-0001, MF-0003), PR review gives diffs and history for free, and there is no import job or duplicate copy to drift.

**Consequences:** editing an item resets its approvals; a rejected item is still in the file until someone removes it in a PR, so every reader must filter by review state; group-scoped drafts (§2.7 `group_id`) are not supported in v1.

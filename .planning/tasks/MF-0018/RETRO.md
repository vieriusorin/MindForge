---
ticket_id: MF-0018
outcome: complete
causes: [tooling]
actions: [memory-update]
lesson_keys: [scoped-formatter, zsh-word-splitting]
applied: yes
written_by: main session (inline)
---

## Right
- A peer session caught the `pnpm setup` built-in clash before it shipped.
- Non-destructive setup was proven with seeded data, not just on an empty DB.

## Wrong
- **tooling:** `biome check --write scripts` touched files outside the ticket (copied P4T scripts). Formatting-only was proven afterwards, but it should never have happened.
- **tooling (repeat):** zsh didn't word-split `$UNTOUCHED` (the same trap as in MF-0001), and a "clean PATH" still held Homebrew via pnpm. Both were caught by checking the output.

## Actions
1. memory-update `feedback-verify-derived-facts`: format/fix only files the ticket owns (list them explicitly); in zsh use arrays `("${A[@]}")`. *(applied)*

# MF-0066 — fresh-context verification of the order items (SC-10)

Each item was checked by a fresh-context verifier (general-purpose agent, read-only) against the cached text of
its cited page only (`.cache/corpus/<sha256(url)>.json`), with the five checks: every consecutive pair ordered by a
page sentence and no second defensible order; labels supported; title fair; explanation clauses supported, no
always/only or softened rule; each `orderedBy` quote really orders. Round 1: three verifiers (one per domain
group). Round 2: one verifier re-read the two fixed items and the replacement item.

| item | round | severity | claim | page says (verifier's quote) | fix | status |
|---|---|---|---|---|---|---|
| prod-prompting.D1.S3.order-criteria-first | 1 | FIX | step DR "Prompt plus output schema (output_config.format)" | define-success never says output_config, output schema or structured outputs; only "preliminary prompt" (flowchart alt text) | label is the diagram's (from the structured-outputs page); changing it would edit an approved-path diagram | **withdrawn**: item deleted, replaced by order-round-trip-start |
| prod-prompting.D2.S2.order-client-tool-turn | 1 | FIX | explanation "Only once it has run do you know whether it succeeded" | "If Claude's attempted use of a tool is invalid (for example, missing required parameters)… you can also continue the conversation forward with a tool_result that indicates the error" | "Once it has run you know whether it succeeded" | fixed |
| prod-prompting.D2.S2.order-client-tool-turn | 1 | FIX | orderedBy[0] only describes the response, orders nothing | ordering sentence is the lead-in "When you receive a tool use response for a client tool, you should:" | added that quote | fixed |
| prod-prompting.D2.S2.order-client-tool-turn | 1 | NOTE | title circular; "on an error the same block with is_error" firms up "can" | "you can return the error message in the content along with "is_error": true" | title reworded; "can carry the error message" | fixed |
| prod-prompting.D2.S2.order-client-tool-turn | 2 | NOTE | explanation omits "first in the user message" | "the tool_result blocks must come FIRST in the content array" | added "with the tool_result blocks first in its content" | fixed; verdict PASS |
| prod-prompting.D3.S2.order-to-compaction | 1 | FIX | Full → Kind not ordered by any quote | "…agents require specialized techniques to work around the context window size limitation." | quote added | superseded in round 2 |
| prod-prompting.D3.S2.order-to-compaction | 1 | FIX | explanation "then … depends on the task", "the one" | "a few techniques …: compaction, structured note-taking, and multi-agent architectures"; "The choice between these approaches depends on task characteristics." | explanation rewritten with the three techniques and the page's reason | fixed |
| prod-prompting.D3.S2.order-to-compaction | 2 | FIX | Turn, Kind, Full, Compact also defensible (choice by task reads as design-time) | "Compaction is the practice of taking a conversation nearing the context window limit…" | title states the agent picks a technique only once the window is filling up | fixed |
| prod-prompting.D3.S2.order-to-compaction | 2 | FIX | round-1 quote ties techniques to duration, not the window | "Long-horizon tasks require agents to maintain coherence … where the token count exceeds the LLM’s context window." | quote replaced | fixed |
| prod-prompting.D3.S2.order-to-compaction | 2 | FIX | explanation "outgrows the context window" vs "nearing the limit" | "nearing the context window limit" | "nears the context window limit" | fixed |
| prod-prompting.D3.S2.order-to-compaction | 1–2 | NOTE | label "keep decisions and open bugs" generalises Claude Code's example | "The model preserves architectural decisions, unresolved bugs, and implementation details…" | none (diagram label) | accepted |
| prod-prompting.D2.S2.order-round-trip-start | 2 | NOTE | RUN label's "(id, name, input)" only in code samples; title gives away step 1 (easy item, level foundation) | "Your code runs the operation"; code uses tool_use.name / .input / .id | none | verdict PASS |

## Iteration 2 (after the fresh-context review, 2026-11-07)

| item | round | severity | claim | page says (verifier's quote) | fix | status |
|---|---|---|---|---|---|---|
| prod-prompting.D3.S2.order-to-compaction | review | blocker | Full → Kind has no page sentence; the round-2 title fix put the order in the premise | "The choice between these approaches depends on task characteristics" frames a design-time choice | — | **withdrawn** (item deleted) |
| prod-prompting.D2.S2.order-tool-error (new) | 3 | FIX | STOP → RUN: no quoted sentence ties the response to stop_reason tool_use | "The response has a `stop_reason` of `tool_use` and one or more `tool_use` content blocks" | quote added first; title reworded to hint less | fixed |
| prod-prompting.D2.S2.order-tool-error | 4 (fresh) | OK / NOTE | every adjacent pair quoted (STOP→RUN, RUN→OK, OK→ERR, ERR→REQ); no second order; labels and explanation supported; title anchors start and end only | as cited | — | **PASS** |

Open FIX rows: **0**. Shipped orders: order-client-tool-turn (PASS round 2), order-round-trip-start (PASS round 2),
order-tool-error (PASS round 4, fresh verifier re-read after its fix). Every `orderedBy` quote is checked verbatim against the cited page by `pnpm check:packs`
(`check:packs: 3 order(s) checked against their cited page`, 0 problems).

The D2.S2 round-2 note (an added explanation clause) was applied verbatim and not re-read; D3.S2 is withdrawn.

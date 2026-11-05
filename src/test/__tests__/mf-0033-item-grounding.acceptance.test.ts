/**
 * MF-0033 acceptance (frozen): the token, leak and uncached-source rules that `pnpm check:packs` runs
 * over questions, cards and diagrams. Fixtures are inline YAML with inline corpus text, so the file
 * runs without `.cache/corpus`. Expected values come from GOAL.md SC-1…SC-3, not from the checker.
 * The proof cases are the MF-0031 D2.S2 diagram (`end_turn`, MF-0031 verify/D2.md:94) and the
 * MF-0038 D5.S2.q5 stem (`claude.ai` citing rate-limits, MF-0038 verify/G3.md:28).
 */
import { describe, expect, it } from "vitest";
import { checkItemFile } from "../../../scripts/lib/item-grounding.mjs";

const HANDLE = "https://example.com/tool-use/handle-tool-calls";
const OVERVIEW = "https://example.com/tool-use/overview";
const RATES = "https://example.com/api/rate-limits";
const SUBAGENTS = "https://example.com/sub-agents";
const UNCACHED = "https://example.com/not-in-the-corpus";

// Neither tool-use text contains `end_turn`, as on the real pages (MF-0031 verify/D2.md:95).
const CORPUS: Record<string, string> = {
  [HANDLE]:
    "Claude responds with stop_reason tool_use and one or more tool_use blocks. Your application runs the " +
    "tool and returns a tool_result block whose tool_use_id matches. On failure set is_error to true.",
  [OVERVIEW]:
    "Claude decides when to call a tool. Read the stop reasons page before treating a response as final.",
  [RATES]:
    "The API uses the token bucket algorithm. For most models only uncached input tokens count toward ITPM; " +
    "cache_read_input_tokens do not. The max_tokens parameter does not factor into OTPM.",
  [SUBAGENTS]:
    "A subagent file has a name and a description. The model field picks the model.",
};
const corpus = (url: string): string | null => CORPUS[url] ?? null;

const q = (s: string): string => JSON.stringify(s);

interface Edge {
  from: string;
  to: string;
  label?: string;
}

function diagramFile(edges: Edge[], sources = [HANDLE, OVERVIEW]): string {
  return [
    "skill: D2.S2",
    "diagrams:",
    "  - id: p.D2.S2.diagram-loop",
    `    title: ${q("The client tool-use loop")}`,
    "    origin: ai",
    "    author: a@example.com",
    "    direction: TB",
    "    nodes:",
    `      - { id: REQ, label: ${q("Request: messages + tools")} }`,
    `      - { id: STOP, label: ${q("stop_reason is tool_use?")}, shape: decision }`,
    `      - { id: RUN, label: ${q("Your app runs each tool_use")} }`,
    `      - { id: RES, label: ${q("tool_result with tool_use_id")} }`,
    `      - { id: DONE, label: ${q("Claude answers in text (check stop_reason before treating it as final)")} }`,
    "    edges:",
    ...edges.map(
      (e) =>
        `      - { from: ${e.from}, to: ${e.to}${e.label === undefined ? "" : `, label: ${q(e.label)}`} }`,
    ),
    "    sources:",
    ...sources.map((u) => `      - ${u}`),
    "",
  ].join("\n");
}

const LOOP_EDGES: Edge[] = [
  { from: "REQ", to: "STOP" },
  { from: "STOP", to: "RUN", label: "yes" },
  { from: "RUN", to: "RES" },
  { from: "RES", to: "REQ", label: "send back, loop" },
];
const PRE_FIX = [
  ...LOOP_EDGES,
  { from: "STOP", to: "DONE", label: "no (end_turn)" },
];
const POST_FIX = [...LOOP_EDGES, { from: "STOP", to: "DONE", label: "no" }];

interface Option {
  id: string;
  text: string;
  correct: boolean;
  rationale: string;
}

function questionFile(input: {
  stem: string;
  options: Option[];
  url: string;
  comments?: string[];
}): string {
  return [
    "skill: D5.S2",
    "questions:",
    "  - id: p.D5.S2.q5",
    ...(input.comments ?? []).map((c) => `    ${c}`),
    "    origin: ai",
    "    author: a@example.com",
    "    level: expert",
    `    stem: ${q(input.stem)}`,
    "    select: 1",
    "    options:",
    ...input.options.flatMap((o) => [
      `      - id: ${o.id}`,
      `        text: ${q(o.text)}`,
      `        correct: ${o.correct}`,
      `        rationale: ${q(o.rationale)}`,
    ]),
    "    source:",
    `      title: ${q("Rate limits")}`,
    `      url: ${q(input.url)}`,
    "",
  ].join("\n");
}

const RATE_OPTIONS: Option[] = [
  {
    id: "A",
    text: "Cache the repeated prefix, since cache reads don't count toward ITPM on most models.",
    correct: true,
    rationale:
      "For most models only uncached input tokens count toward ITPM; `cache_read_input_tokens` do not.",
  },
  {
    id: "B",
    text: "Wait for the counter to reset at the start of the next minute.",
    correct: false,
    rationale:
      "The API uses the token bucket algorithm: capacity is continuously replenished.",
  },
];
// MF-0038 D5.S2.q5: the pre-fix stem opened with a claude.ai fact the rate-limits page never mentions.
const STEM_PRE_FIX =
  "In claude.ai, project content that is reused counts less against usage limits. An API service sends the same long system prompt with every request and keeps hitting ITPM 429 errors. What does the rate limits page suggest?";
const STEM_POST_FIX =
  "An API service sends the same long system prompt with every request and keeps hitting ITPM 429 errors. What does the rate limits page suggest?";

function cardFile(input: { simply: string; comments?: string[] }): string {
  return [
    "skill: D2.S2",
    "cards:",
    "  - id: p.D2.S2.card-worker",
    ...(input.comments ?? []).map((c) => `    ${c}`),
    `    concept: ${q("Tune the worker")}`,
    "    origin: ai",
    "    author: a@example.com",
    `    simply: ${q(input.simply)}`,
    `    inNature: ${q("A worker bee with one job.")}`,
    "    whereItBreaks:",
    `      - ${q("A bee picks its own flowers.")}`,
    `    contrast: ${q("A subagent vs the main session.")}`,
    "    sources:",
    `      - ${SUBAGENTS}`,
    "",
  ].join("\n");
}
const WORKER =
  "A `log-summarizer` subagent that only reads test output gets a cheaper model.";

const run = (kind: "questions" | "cards" | "diagrams", text: string) =>
  checkItemFile({ file: `packs/p/${kind}/S.yaml`, kind, text, corpus });

describe("MF-0033 SC-1: tokens in rationales, card fields and diagram labels are on the cited page", () => {
  it("SC-1: the pre-fix D2.S2 diagram (`no (end_turn)`) fails on end_turn; the post-fix diagram passes", () => {
    const pre = run("diagrams", diagramFile(PRE_FIX));
    expect(pre.problems).toHaveLength(1);
    expect(pre.problems[0]).toMatchObject({
      id: "p.D2.S2.diagram-loop",
      rule: "token",
      word: "end_turn",
    });
    expect(pre.problems[0].message).toContain("p.D2.S2.diagram-loop");
    expect(pre.problems[0].message).toContain("end_turn");

    const post = run("diagrams", diagramFile(POST_FIX));
    expect(post.problems).toEqual([]);
    expect(post.checked).toBe(1);
  });

  it("SC-1: a backticked span passes when every word in it is on the page (`is_error: true`)", () => {
    const text = questionFile({
      stem: "A tool call fails. What should the client send back?",
      url: HANDLE,
      options: [
        {
          id: "A",
          text: "A tool result that marks the failure.",
          correct: true,
          rationale:
            "Return the tool_result with `is_error: true` so Claude can adapt.",
        },
        {
          id: "B",
          text: "Nothing.",
          correct: false,
          rationale: "Claude waits for a tool_result for every tool_use.",
        },
      ],
    });
    expect(run("questions", text).problems).toEqual([]);
  });

  it("SC-1: an illustrative name fails unless declared with # example-name", () => {
    const bare = run("cards", cardFile({ simply: WORKER }));
    expect(bare.problems).toHaveLength(1);
    expect(bare.problems[0]).toMatchObject({
      rule: "token",
      word: "log-summarizer",
    });

    const declared = run(
      "cards",
      cardFile({
        simply: WORKER,
        comments: ["# example-name: log-summarizer"],
      }),
    );
    expect(declared.problems).toEqual([]);
  });

  it("SC-1: a rationale token that also occurs in the stem or an option text is exempt", () => {
    const text = questionFile({
      stem: "A team sets `strict_mode_v2` in its config. What happens?",
      url: RATES,
      options: [
        {
          id: "A",
          text: "Nothing documented.",
          correct: true,
          rationale:
            "strict_mode_v2 is not a documented setting, so it has no effect.",
        },
        {
          id: "B",
          text: "Requests are rejected.",
          correct: false,
          rationale:
            "Nothing on the page says `strict_mode_v2` rejects requests.",
        },
      ],
    });
    expect(run("questions", text).problems).toEqual([]);
  });
});

describe("MF-0033 SC-2: product-surface terms are on the cited page", () => {
  it("SC-2: the pre-fix MF-0038 D5.S2.q5 stem fails on claude.ai; the post-fix item passes", () => {
    const pre = run(
      "questions",
      questionFile({ stem: STEM_PRE_FIX, options: RATE_OPTIONS, url: RATES }),
    );
    expect(pre.problems).toHaveLength(1);
    expect(pre.problems[0]).toMatchObject({
      id: "p.D5.S2.q5",
      rule: "leak",
      word: "claude.ai",
    });

    const post = run(
      "questions",
      questionFile({ stem: STEM_POST_FIX, options: RATE_OPTIONS, url: RATES }),
    );
    expect(post.problems).toEqual([]);
  });

  it("SC-2: # framing with a reason exempts the term; # framing without a reason is an annotation problem", () => {
    const framed = run(
      "questions",
      questionFile({
        stem: STEM_PRE_FIX,
        options: RATE_OPTIONS,
        url: RATES,
        comments: [
          "# framing: claude.ai — scenario framing; the key rests on the rate-limits page",
        ],
      }),
    );
    expect(framed.problems).toEqual([]);

    const bare = run(
      "questions",
      questionFile({
        stem: STEM_PRE_FIX,
        options: RATE_OPTIONS,
        url: RATES,
        comments: ["# framing: claude.ai"],
      }),
    );
    expect(bare.problems.map((p) => p.rule)).toContain("annotation");
  });
});

describe("MF-0033 SC-3: an item with an uncached source is skipped and counted", () => {
  it("SC-3: one cached and one uncached url with an end_turn label: no problem, skipped = 1", () => {
    const result = run("diagrams", diagramFile(PRE_FIX, [HANDLE, UNCACHED]));
    expect(result.problems).toEqual([]);
    expect(result.skipped).toBe(1);
    expect(result.checked).toBe(0);
  });
});

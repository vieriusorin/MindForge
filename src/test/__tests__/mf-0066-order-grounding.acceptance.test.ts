/**
 * MF-0066 acceptance (frozen): SC-6, the order rule of `pnpm check:packs`. Drafter check (3): an ordering
 * needs a page sentence that orders it, so every `orderedBy` quote must be on the cited page. Fixtures are
 * inline YAML and an inline corpus, so the file runs without `.cache/corpus`.
 */
import { describe, expect, it } from "vitest";
import YAML from "yaml";
import { checkOrderFile } from "../../../scripts/lib/order-grounding.mjs";

const PAGE = "https://example.com/handle-tool-calls";
const UNCACHED = "https://example.com/not-cached";

const CORPUS: Record<string, string> = {
  [PAGE]:
    "When you receive a tool use response for a client tool, you should:\n\n" +
    "1. Extract the `name`, `id`, and `input` from the `tool_use` block.\n\n" +
    "2. Run the actual tool in your code base corresponding to that tool name.",
};
const corpus = (url: string): string | null => CORPUS[url] ?? null;

const order = (over: Record<string, unknown> = {}) => ({
  id: "p.D2.S2.order-turn",
  title: "Put one turn in order",
  origin: "ai",
  author: "a@example.com",
  diagram: "p.D2.S2.diagram-loop",
  steps: [
    { node: "A", label: "a" },
    { node: "B", label: "b" },
    { node: "C", label: "c" },
  ],
  orderedBy: [
    // Case and whitespace differ from the page on purpose: matching is normalised.
    "1. Extract the `name`, `id`, and `input`   from the `tool_use` block.",
    "2. run the actual tool in your code base",
  ],
  explanation: "Because.",
  source: { title: "Handle tool calls", url: PAGE },
  ...over,
});

const text = (...orders: unknown[]) =>
  YAML.stringify({ skill: "D2.S2", orders });

describe("MF-0066 SC-6: order grounding", () => {
  it("SC-6: quotes found on the cited page pass", () => {
    expect(
      checkOrderFile({
        file: "orders/D2.S2.yaml",
        text: text(order()),
        corpus,
      }),
    ).toEqual({ problems: [], checked: 1 });
  });

  it("SC-6: a quote the cited page does not contain is a problem naming file, id and quote", () => {
    const { problems, checked } = checkOrderFile({
      file: "orders/D2.S2.yaml",
      text: text(
        order({
          orderedBy: [
            "2. Run the actual tool in your code base",
            "Then send the result before running the tool.",
          ],
        }),
      ),
      corpus,
    });
    expect(checked).toBe(1);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({
      file: "orders/D2.S2.yaml",
      id: "p.D2.S2.order-turn",
      rule: "ordered-by",
      quote: "Then send the result before running the tool.",
    });
    expect(problems[0].message).toContain("orders/D2.S2.yaml");
    expect(problems[0].message).toContain("p.D2.S2.order-turn");
    expect(problems[0].message).toContain(
      "Then send the result before running the tool.",
    );
  });

  it("SC-6: a quote from ANOTHER cached page does not count; only source.url's text does", () => {
    const other = "https://example.com/other";
    const { problems } = checkOrderFile({
      file: "orders/D2.S2.yaml",
      text: text(order({ orderedBy: ["Only on the other page."] })),
      corpus: (url) =>
        url === other ? "Only on the other page." : corpus(url),
    });
    expect(problems.map((p) => p.rule)).toEqual(["ordered-by"]);
  });

  it("SC-6: an uncached source is a problem (no exemption for orders)", () => {
    const { problems } = checkOrderFile({
      file: "orders/D2.S2.yaml",
      text: text(order({ source: { title: "Nowhere", url: UNCACHED } })),
      corpus,
    });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({
      id: "p.D2.S2.order-turn",
      rule: "source",
    });
    expect(problems[0].message).toContain(UNCACHED);
  });

  it("SC-6: each order of a file is checked; unparsable YAML is a parse problem", () => {
    const two = checkOrderFile({
      file: "orders/D2.S2.yaml",
      text: text(
        order(),
        order({ id: "p.D2.S2.order-two", orderedBy: ["Not there."] }),
      ),
      corpus,
    });
    expect(two.checked).toBe(2);
    expect(two.problems.map((p) => p.id)).toEqual(["p.D2.S2.order-two"]);

    const broken = checkOrderFile({
      file: "orders/D2.S2.yaml",
      text: "orders: [\n",
      corpus,
    });
    expect(broken.problems.map((p) => p.rule)).toEqual(["parse"]);
  });
});

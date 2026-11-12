// MF-0066 review note 7: check:packs needs one orderedBy quote per adjacent pair of steps (corpus-free floor).
import { describe, expect, it } from "vitest";
import YAML from "yaml";
import { checkOrderQuoteCount } from "../../../scripts/lib/order-grounding.mjs";

const order = (steps: number, quotes: number) => ({
  id: `p.S1.order-${steps}-${quotes}`,
  steps: Array.from({ length: steps }, (_, i) => ({
    node: `N${i}`,
    label: `n${i}`,
  })),
  orderedBy: Array.from({ length: quotes }, (_, i) => `quote ${i}`),
});

const text = (...orders: unknown[]) => YAML.stringify({ skill: "S1", orders });

describe("checkOrderQuoteCount", () => {
  it("passes at steps - 1 quotes and above", () => {
    expect(
      checkOrderQuoteCount({
        file: "f.yaml",
        text: text(order(4, 3), order(3, 5)),
      }),
    ).toEqual({
      problems: [],
      checked: 2,
    });
  });

  it("reports an order with fewer quotes than adjacent pairs, naming file, id and counts", () => {
    const { problems } = checkOrderQuoteCount({
      file: "f.yaml",
      text: text(order(4, 2), order(3, 2)),
    });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({
      file: "f.yaml",
      id: "p.S1.order-4-2",
      rule: "ordered-by",
    });
    expect(problems[0]?.message).toBe(
      "f.yaml: p.S1.order-4-2: 4 steps need at least 3 orderedBy quotes (one per adjacent pair); found 2",
    );
  });

  it("an order with no quotes at all is reported; broken YAML is a parse problem", () => {
    expect(
      checkOrderQuoteCount({ file: "f.yaml", text: text(order(3, 0)) })
        .problems,
    ).toHaveLength(1);
    expect(
      checkOrderQuoteCount({
        file: "f.yaml",
        text: "orders: [\n",
      }).problems.map((p) => p.rule),
    ).toEqual(["parse"]);
  });
});

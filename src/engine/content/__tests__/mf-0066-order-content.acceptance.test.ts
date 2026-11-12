/**
 * MF-0066 acceptance (frozen): SC-10, the shipped order items. `packs/prod-prompting/orders/` holds 3–6
 * orders, each loading through the real loaders, drawn from a prod-prompting diagram and citing one of its
 * skill's sources. Read at runtime, so a missing folder is this SC's red, not a compile error.
 */
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadPackFile } from "../../pack";
import { loadPackContent, loadPackOrders } from "..";

const DIR = join(process.cwd(), "packs", "prod-prompting");

async function load() {
  const pack = await loadPackFile(join(DIR, "pack.yaml"));
  const content = await loadPackContent(pack, DIR);
  const orders = await loadPackOrders(pack, DIR, content);
  return { pack, content, orders };
}

describe("MF-0066 SC-10: prod-prompting orders", () => {
  it("SC-10: 3 to 6 orders load", async () => {
    const { orders } = await load();
    expect(orders.length).toBeGreaterThanOrEqual(3);
    expect(orders.length).toBeLessThanOrEqual(6);
  });

  it("SC-10: each is drawn from a prod-prompting diagram of its own skill, its steps are that diagram's nodes", async () => {
    const { content, orders } = await load();
    for (const order of orders) {
      const diagram = content.diagrams.find((d) => d.id === order.diagram);
      expect(diagram, order.id).toBeDefined();
      expect(diagram?.skill, order.id).toBe(order.skill);
      const nodes = new Set(diagram?.nodes.map((n) => n.id));
      for (const step of order.steps)
        expect(nodes.has(step.node), `${order.id} ${step.node}`).toBe(true);
    }
  });

  it("SC-10: each cites one of its skill's sources, and carries at least one ordering sentence", async () => {
    const { pack, orders } = await load();
    const sources = new Map(
      pack.domains.flatMap((d) =>
        d.skills.map((s) => [s.code, s.sources ?? []]),
      ),
    );
    for (const order of orders) {
      expect(sources.get(order.skill), order.id).toContain(order.source.url);
      expect(order.orderedBy.length, order.id).toBeGreaterThan(0);
    }
  });

  it("SC-10: ai-written, with an author and the generation record", async () => {
    const { orders } = await load();
    for (const order of orders) {
      expect(order.origin, order.id).toBe("ai");
      expect(order.author, order.id).toBe("sorin.vieriu@ddroidd.com");
      expect(order.generatedBy, order.id).toEqual({
        model: "claude-opus-5-5",
        prompt: "mf0066-hand-session",
      });
    }
  });
});

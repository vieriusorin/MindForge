import { idPrefixIssue } from "../pack/id-prefix";
import type { Pack } from "../pack/types";
import { ContentValidationError, readFileData, readKind } from "./load-content";
import { OrderFileSchema } from "./schema";
import type { ContentFile, OrderItem, PackContent } from "./types";

export { ORDER_MAX_STEPS, ORDER_MIN_STEPS, ORDER_STEP_ID_MAX } from "./schema";

/** Every id the pack's other items already use, so an order cannot take one (pack-wide unique ids). */
function takenIds(content: PackContent): Set<string> {
  return new Set([
    ...content.questions.map((q) => q.id),
    ...content.cards.map((c) => c.id),
    ...content.diagrams.map((d) => d.id),
    ...(content.cuckoos ?? []).map((c) => c.id),
  ]);
}

/** Issues of one order against its diagram and skill; `at` prefixes each path. */
function crossCheck(
  order: Omit<OrderItem, "skill">,
  skill: string,
  skillSources: readonly string[],
  content: PackContent,
  at: string,
): string[] {
  const issues: string[] = [];
  const diagram = content.diagrams.find((d) => d.id === order.diagram);
  if (!diagram) return [`${at}.diagram: unknown diagram "${order.diagram}"`];
  if (diagram.skill !== skill)
    return [
      `${at}.diagram: diagram "${order.diagram}" belongs to skill ${diagram.skill}, not ${skill}`,
    ];

  const labels = new Map(diagram.nodes.map((n) => [n.id, n.label]));
  const edges = new Set(diagram.edges.map((e) => `${e.from}\u0000${e.to}`));
  const seen = new Set<string>();
  order.steps.forEach((step, i) => {
    const label = labels.get(step.node);
    if (label === undefined) {
      issues.push(
        `${at}.steps.${i}.node: node "${step.node}" is not in diagram "${diagram.id}"`,
      );
      return;
    }
    if (label !== step.label)
      issues.push(
        `${at}.steps.${i}.label: "${step.label}" is not the label of node ${step.node} ("${label}")`,
      );
    if (seen.has(step.node))
      issues.push(`${at}.steps.${i}: node ${step.node} is repeated`);
    seen.add(step.node);
    const prev = order.steps[i - 1];
    if (prev && !edges.has(`${prev.node}\u0000${step.node}`))
      issues.push(
        `${at}.steps.${i}: diagram "${diagram.id}" has no edge ${prev.node} → ${step.node}`,
      );
  });

  if (!skillSources.includes(order.source.url))
    issues.push(
      `${at}.source.url: ${order.source.url} is not a source of skill ${skill}`,
    );
  else if (!diagram.sources.includes(order.source.url))
    issues.push(
      `${at}.source.url: ${order.source.url} is not a source of diagram "${diagram.id}"`,
    );
  return issues;
}

/**
 * MF-0066 SC-1: validate every `orders/*.yaml` of a pack against the pack (skills, sources) and its
 * already-loaded content (diagrams; pack-wide unique ids). Throws ContentValidationError on any issue.
 */
export function parseOrders(
  files: readonly ContentFile[],
  pack: Pack,
  content: PackContent,
): OrderItem[] {
  const skills = pack.domains.flatMap((d) => d.skills);
  const skillCodes = new Set(skills.map((s) => s.code));
  const sourcesOf = new Map(skills.map((s) => [s.code, s.sources ?? []]));
  const taken = takenIds(content);
  const issues: string[] = [];
  const orders: OrderItem[] = [];

  for (const file of files) {
    const data = readFileData(
      file,
      OrderFileSchema,
      skillCodes,
      pack.slug,
      issues,
    );
    data?.orders.forEach((order, i) => {
      const at = `${file.name}: orders.${i}`;
      const foreign = idPrefixIssue(order.id, pack.slug);
      if (foreign) {
        issues.push(`${at}.id: ${foreign}`);
        return;
      }
      if (taken.has(order.id)) {
        issues.push(`${at}.id: duplicate item id "${order.id}"`);
        return;
      }
      taken.add(order.id);
      const found = crossCheck(
        order,
        data.skill,
        sourcesOf.get(data.skill) ?? [],
        content,
        at,
      );
      if (found.length) {
        issues.push(...found);
        return;
      }
      orders.push({ ...order, skill: data.skill });
    });
  }

  if (issues.length) throw new ContentValidationError(issues);
  return orders;
}

/** MF-0066: read `<packDir>/orders/*.yaml` and validate them. A missing dir means none. */
export async function loadPackOrders(
  pack: Pack,
  packDir: string,
  content: PackContent,
): Promise<OrderItem[]> {
  return parseOrders(await readKind(packDir, "orders"), pack, content);
}

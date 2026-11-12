import type { Question } from "../questions/types";
import type {
  Cuckoo,
  Diagram,
  ItemType,
  NatureCard,
  OrderItem,
  PackContent,
} from "./types";

/** MF-0007: one reviewable item, tagged with its kind. */
export type PackItem =
  | { kind: "question"; item: Question }
  | { kind: "card"; item: NatureCard }
  | { kind: "diagram"; item: Diagram }
  | { kind: "cuckoo"; item: Cuckoo }
  | { kind: "order"; item: OrderItem };

/** The item with this id and type in a pack's content, or null (e.g. the registry is ahead of the files). */
export function findPackItem(
  content: PackContent,
  type: ItemType,
  itemId: string,
): PackItem | null {
  if (type === "question") {
    const item = content.questions.find((q) => q.id === itemId);
    return item ? { kind: "question", item } : null;
  }
  if (type === "card") {
    const item = content.cards.find((c) => c.id === itemId);
    return item ? { kind: "card", item } : null;
  }
  if (type === "diagram") {
    const item = content.diagrams.find((d) => d.id === itemId);
    return item ? { kind: "diagram", item } : null;
  }
  if (type === "order") {
    const item = (content.orders ?? []).find((o) => o.id === itemId);
    return item ? { kind: "order", item } : null;
  }
  const item = (content.cuckoos ?? []).find((c) => c.id === itemId);
  return item ? { kind: "cuckoo", item } : null;
}

/** The one-line name a reviewer recognises an item by. */
export function itemTitle(packItem: PackItem): string {
  if (packItem.kind === "question") return packItem.item.stem;
  if (packItem.kind === "card") return packItem.item.concept;
  return packItem.item.title;
}

/** Every item's id → its title, for screens that list items by id. */
export function itemTitles(content: PackContent): Record<string, string> {
  return Object.fromEntries([
    ...content.questions.map((item) => [item.id, item.stem]),
    ...content.cards.map((item) => [item.id, item.concept]),
    ...content.diagrams.map((item) => [item.id, item.title]),
    ...(content.cuckoos ?? []).map((item) => [item.id, item.title]),
    ...(content.orders ?? []).map((item) => [item.id, item.title]),
  ]);
}

/** The code of the skill an item belongs to. */
export function itemSkillCode(packItem: PackItem): string {
  return packItem.kind === "question"
    ? packItem.item.skillCode
    : packItem.item.skill;
}

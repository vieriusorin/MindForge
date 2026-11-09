import { join } from "node:path";
import {
  itemHashes,
  loadPackContent,
  loadPackOrders,
  readPackFiles,
} from "@/engine/content";
import { loadPackFile, type Pack } from "@/engine/pack";
import type { SeedItem, SeedQuestion } from "./types";

/**
 * MF-0029: what the planner needs from a pack's files: every question with its options and key,
 * and every item with the content hash the review registry holds (same `itemHashes` as the sync).
 */
export async function loadSeedInputs(packDir: string): Promise<{
  pack: Pack;
  questions: SeedQuestion[];
  items: SeedItem[];
  /** MF-0066: the diagrams this pack's order items are drawn from (the seed approves them). */
  orderDiagramIds: string[];
}> {
  const pack = await loadPackFile(join(packDir, "pack.yaml"));
  const files = await readPackFiles(packDir);
  const content = await loadPackContent(pack, packDir);
  const hashes = itemHashes(files);
  const hashOf = (id: string): string => {
    const hash = hashes[id];
    if (!hash) throw new Error(`loadSeedInputs: no content hash for ${id}`);
    return hash;
  };
  const questions: SeedQuestion[] = content.questions.map((q) => ({
    questionId: q.id,
    skillCode: q.skillCode,
    packSlug: pack.slug,
    optionIds: q.options.map((o) => o.id),
    correctOptions: q.options.filter((o) => o.correct).map((o) => o.id),
  }));
  const items: SeedItem[] = [
    ...content.questions.map((q) => ({
      itemId: q.id,
      itemType: "question" as const,
      skillCode: q.skillCode,
      origin: q.origin,
      authorEmail: q.author ?? null,
      contentHash: hashOf(q.id),
    })),
    ...content.cards.map((c) => ({
      itemId: c.id,
      itemType: "card" as const,
      skillCode: c.skill,
      origin: c.origin,
      authorEmail: c.author ?? null,
      contentHash: hashOf(c.id),
    })),
    ...content.diagrams.map((d) => ({
      itemId: d.id,
      itemType: "diagram" as const,
      skillCode: d.skill,
      origin: d.origin,
      authorEmail: d.author ?? null,
      contentHash: hashOf(d.id),
    })),
  ];
  const orders = await loadPackOrders(pack, packDir, content);
  return {
    pack,
    questions,
    items,
    orderDiagramIds: [...new Set(orders.map((o) => o.diagram))].sort(),
  };
}

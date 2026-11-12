import { join } from "node:path";
import { cacheLife } from "next/cache";
import { loadPackOrders, type OrderItem } from "@/engine/content";
import { getPackContent } from "@/server/content/get-pack-content";
import { getPack } from "@/server/packs/get-pack";

/**
 * MF-0066: a pack's order items, validated against its diagrams (second-stage load). Versioned with the
 * code and identical for everyone, so cacheable. Holds answer keys (the step order): never pass an order to
 * a client component unmapped (`toPlayableOrder`).
 */
export async function getPackOrders(slug: string): Promise<OrderItem[]> {
  "use cache";
  cacheLife("days");
  const [pack, content] = await Promise.all([
    getPack(slug),
    getPackContent(slug),
  ]);
  return loadPackOrders(pack, join(process.cwd(), "packs", slug), content);
}

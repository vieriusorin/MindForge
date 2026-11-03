import { join } from "node:path";
import { cacheLife } from "next/cache";
import { loadPackQuestions, type Question } from "@/engine/questions";
import { getPack } from "@/server/packs/get-pack";

/** Question files are versioned with the code and identical for everyone: cacheable. */
export async function getPackQuestions(slug: string): Promise<Question[]> {
  "use cache";
  cacheLife("days");
  const pack = await getPack(slug);
  return loadPackQuestions(
    pack,
    join(process.cwd(), "packs", slug, "questions"),
  );
}

/**
 * MF-0029: fill the LOCAL stack with a demo world — 5 demo learners and you in "Demo study group",
 * three weeks of answers, a few reviews — so every screen has data. Safe to re-run: it replaces the
 * demo users and your previously seeded answers, nothing else. `pnpm db:reset` removes it all.
 *
 * Usage: MF_AUTHOR_EMAIL=you@example.com pnpm dev:seed [--seed 42]
 * Needs the local stack (`pnpm dev:setup`). Refuses SUPABASE_DB_URL and any non-local database.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { assertLocalSeedTarget } from "@/dev-seed/guard";
import { loadSeedInputs } from "@/dev-seed/load-seed-inputs";
import { planDemoWorld } from "@/dev-seed/plan-demo-world";
import { listResolvedItems, seedDemoWorld } from "@/dev-seed/seed-demo-world";
import type { SeedManifest } from "@/dev-seed/types";
import { adminClient, sql, stackEnv } from "@/test/local-stack";

const ROOT = process.cwd();
const DEMO_DOMAIN = "mindforge-demo.test";
const PACK_SLUG = "ccdv-f";
const MANIFEST = join(ROOT, ".cache", "dev-seed", "manifest.json");
const Manifest = z.strictObject({
  youEmail: z.string(),
  youId: z.string(),
  youAttemptIds: z.array(z.number().int()),
});

function readManifest(youEmail: string): SeedManifest | null {
  try {
    const parsed = Manifest.parse(JSON.parse(readFileSync(MANIFEST, "utf8")));
    return parsed.youEmail === youEmail
      ? { youId: parsed.youId, youAttemptIds: parsed.youAttemptIds }
      : null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    // An unreadable or older manifest only means no previously seeded rows are replaced.
    if (error instanceof z.ZodError || error instanceof SyntaxError)
      return null;
    throw error;
  }
}

function seedArg(argv: string[]): number {
  const i = argv.indexOf("--seed");
  if (i < 0) return 42;
  const value = Number(argv[i + 1]);
  if (!Number.isInteger(value)) throw new Error(`--seed must be an integer`);
  return value;
}

async function main(): Promise<void> {
  // The guard runs before the stack is even asked for its keys, so a refusal writes nothing.
  if (process.env.SUPABASE_DB_URL?.trim())
    assertLocalSeedTarget({ env: process.env, dbUrl: "" });
  const env = stackEnv();
  const { youEmail } = assertLocalSeedTarget({
    env: process.env,
    dbUrl: env.DB_URL,
    apiUrl: env.API_URL,
  });
  const inputs = await loadSeedInputs(join(ROOT, "packs", PACK_SLUG));
  const db = sql();
  // Resolutions are yours and survive a re-run: keep the demo reviews off resolved items.
  const excludeItemIds = await listResolvedItems(db);
  const world = planDemoWorld({
    now: new Date(),
    seed: seedArg(process.argv.slice(2)),
    packSlug: PACK_SLUG,
    youEmail,
    demoDomain: DEMO_DOMAIN,
    questions: inputs.questions,
    items: inputs.items,
    excludeItemIds,
  });

  try {
    const manifest = await seedDemoWorld({
      sql: db,
      admin: adminClient(),
      world,
      demoDomain: DEMO_DOMAIN,
      youEmail,
      previous: readManifest(youEmail),
    });
    mkdirSync(join(ROOT, ".cache", "dev-seed"), { recursive: true });
    writeFileSync(
      MANIFEST,
      `${JSON.stringify({ youEmail, ...manifest }, null, 2)}\n`,
    );
  } finally {
    await db.end();
  }

  console.log(
    `Seeded "${world.group.name}" (${PACK_SLUG}): ${world.learners.length} learners, ${world.attempts.length} answers, ${world.reviews.length} reviews.`,
  );
  console.log("Sign in at http://localhost:3001 as any of:");
  for (const l of world.learners)
    console.log(
      `  ${l.email}${l.persona === "you" ? "  (you, group admin)" : `  (${l.displayName})`}`,
    );
  console.log("Magic links arrive in Mailpit: http://127.0.0.1:54324");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

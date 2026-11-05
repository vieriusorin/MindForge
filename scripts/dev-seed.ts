/**
 * MF-0029: fill the LOCAL stack with a demo world — 5 demo learners and you, three weeks of answers,
 * a few reviews — so every screen has data. MF-0034: one demo group per pack (every pack with
 * questions, or the ones named with --pack). Safe to re-run: it replaces the whole demo world (all
 * packs' demo groups) and your previously seeded answers, nothing else. `pnpm db:reset` removes it all.
 *
 * Usage: MF_AUTHOR_EMAIL=you@example.com pnpm dev:seed [--pack <slug>]... [--seed 42]
 * Needs the local stack (`pnpm dev:setup`). Refuses SUPABASE_DB_URL and any non-local database.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { assertLocalSeedTarget } from "@/dev-seed/guard";
import { loadSeedInputs } from "@/dev-seed/load-seed-inputs";
import { demoGroupName, planDemoWorld } from "@/dev-seed/plan-demo-world";
import { resolveSeedPacks } from "@/dev-seed/resolve-seed-packs";
import { listResolvedItems, seedDemoWorlds } from "@/dev-seed/seed-demo-world";
import type { SeedManifest } from "@/dev-seed/types";
import { adminClient, sql, stackEnv } from "@/test/local-stack";

const ROOT = process.cwd();
const DEMO_DOMAIN = "mindforge-demo.test";
const PACKS_DIR = join(ROOT, "packs");
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

/** `--pack <slug>` (repeatable) and `--seed <n>`; anything else is refused, so a typo never seeds every pack. */
function parseArgs(argv: string[]): { packs: string[]; seed: number } {
  const packs: string[] = [];
  let seed = 42;
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag !== "--pack" && flag !== "--seed")
      throw new Error(
        `dev:seed: unknown argument "${flag}" (use --pack <slug> and --seed <n>)`,
      );
    if (value === undefined || value.startsWith("--"))
      throw new Error(`dev:seed: ${flag} needs a value`);
    if (flag === "--pack") packs.push(value);
    else {
      seed = Number(value);
      if (value.trim() === "" || !Number.isInteger(seed))
        throw new Error("dev:seed: --seed must be an integer");
    }
  }
  return { packs, seed };
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
  const { packs: requested, seed } = parseArgs(process.argv.slice(2));
  const slugs = readdirSync(PACKS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
  // A narrowed run loads only the named packs, so a broken pack elsewhere does not block it.
  const toLoad =
    requested.length > 0 ? slugs.filter((s) => requested.includes(s)) : slugs;
  const inputsOf = new Map(
    await Promise.all(
      toLoad.map(
        async (slug) =>
          [slug, await loadSeedInputs(join(PACKS_DIR, slug))] as const,
      ),
    ),
  );
  const selected = resolveSeedPacks({
    available: [...inputsOf].map(([slug, inputs]) => ({
      slug,
      questionCount: inputs.questions.length,
    })),
    requested,
  });

  const db = sql();
  // Resolutions are yours and survive a re-run: keep the demo reviews off resolved items.
  const excludeItemIds = await listResolvedItems(db);
  const now = new Date();
  const worlds = selected.map((slug) => {
    const inputs = inputsOf.get(slug);
    if (!inputs) throw new Error(`dev:seed: pack "${slug}" was not loaded`);
    return planDemoWorld({
      now,
      seed,
      packSlug: inputs.pack.slug,
      groupName: demoGroupName(inputs.pack.name),
      youEmail,
      demoDomain: DEMO_DOMAIN,
      questions: inputs.questions,
      items: inputs.items,
      excludeItemIds,
    });
  });

  try {
    const manifest = await seedDemoWorlds({
      sql: db,
      admin: adminClient(),
      worlds,
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

  for (const world of worlds)
    console.log(
      `Seeded "${world.group.name}" (${world.group.packSlug}): ${world.attempts.length} answers, ${world.reviews.length} reviews.`,
    );
  if (requested.length > 0) {
    const others = slugs.filter((slug) => !selected.includes(slug)).sort();
    if (others.length > 0)
      console.log(
        `Only the packs you named were seeded; a run replaces the whole demo world, so no other pack (${others.join(", ")}) has a demo group now. Run without --pack to seed every pack.`,
      );
  } else {
    const empty = slugs.filter((slug) => !selected.includes(slug)).sort();
    if (empty.length > 0)
      console.log(`Not seeded (no questions): ${empty.join(", ")}.`);
  }
  console.log("Sign in at http://localhost:3001 as any of:");
  for (const l of worlds[0]?.learners ?? [])
    console.log(
      `  ${l.email}${l.persona === "you" ? "  (you, group admin)" : `  (${l.displayName})`}`,
    );
  console.log("Magic links arrive in Mailpit: http://127.0.0.1:54324");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

/**
 * MF-0029: fill the LOCAL stack with a demo world — 5 demo learners and you, three weeks of answers,
 * a few reviews — so every screen has data. MF-0034: one demo group per pack (every pack with
 * questions, or the ones named with --pack). Safe to re-run: it replaces the whole demo world (all
 * packs' demo groups) and your previously seeded answers, nothing else. `pnpm db:reset` removes it all.
 *
 * MF-0052: also finished Storms (graded by the DB's own finalize_storm), an active Expedition per demo
 * group, backdated joins with the exam pack as your newest group (the sidebar's primary pack), and the
 * account with a non-empty review queue per pack in the closing output.
 *
 * MF-0068: also six path personas enrolled in the first learning path whose courses are all seeded, in
 * different path states, and two path groups (6 members; a trio whose heatmap says "not enough data").
 *
 * Usage: MF_AUTHOR_EMAIL=you@example.com pnpm dev:seed [--pack <slug>]... [--seed 42]
 * Needs the local stack (`pnpm dev:setup`). Refuses SUPABASE_DB_URL and any non-local database.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { assertLocalSeedTarget } from "@/dev-seed/guard";
import { loadSeedInputs } from "@/dev-seed/load-seed-inputs";
import { toSeedManifest } from "@/dev-seed/manifest";
import { demoGroupName } from "@/dev-seed/plan-demo-world";
import { withOrderApprovals } from "@/dev-seed/plan-order-approvals";
import { planSeed } from "@/dev-seed/plan-seed";
import { resolveSeedPacks } from "@/dev-seed/resolve-seed-packs";
import { reviewQueueOwners } from "@/dev-seed/review-queue-owners";
import {
  listSeedExcludedItems,
  seedDemoWorlds,
} from "@/dev-seed/seed-demo-world";
import type { SeedManifest } from "@/dev-seed/types";
import { parsePath } from "@/engine/path";
import { adminClient, sql, stackEnv } from "@/test/local-stack";

const ROOT = process.cwd();
const DEMO_DOMAIN = "mindforge-demo.test";
const PACKS_DIR = join(ROOT, "packs");
const PATHS_DIR = join(ROOT, "paths");
const MANIFEST = join(ROOT, ".cache", "dev-seed", "manifest.json");
function readManifest(youEmail: string): SeedManifest | null {
  try {
    return toSeedManifest(JSON.parse(readFileSync(MANIFEST, "utf8")), youEmail);
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
  // Your resolutions, your reviews and real users' flags survive a re-run: no demo review or seeded
  // storm question lands on those items.
  const excludeItemIds = await listSeedExcludedItems(db, {
    demoDomain: DEMO_DOMAIN,
    youEmail,
  });
  // MF-0068: every path file; planSeed takes the first whose courses were all loaded this run.
  const paths = readdirSync(PATHS_DIR)
    .filter((name) => name.endsWith(".yaml"))
    .sort()
    .map((name) =>
      parsePath(readFileSync(join(PATHS_DIR, name), "utf8"), `paths/${name}`),
    );
  const { worlds, pathScenario, skippedPaths, orderApprovals } = planSeed({
    now: new Date(),
    seed,
    youEmail,
    demoDomain: DEMO_DOMAIN,
    excludeItemIds,
    packs: selected.map((slug) => {
      const inputs = inputsOf.get(slug);
      if (!inputs) throw new Error(`dev:seed: pack "${slug}" was not loaded`);
      return { ...inputs, groupName: demoGroupName(inputs.pack.name) };
    }),
    paths,
  });

  let owners: Awaited<ReturnType<typeof reviewQueueOwners>> = [];
  try {
    const manifest = await seedDemoWorlds({
      sql: db,
      admin: adminClient(),
      // MF-0066: the order items' diagrams get two demo approvals, so the demo lessons show order steps.
      worlds: withOrderApprovals(worlds, orderApprovals.approvals),
      demoDomain: DEMO_DOMAIN,
      youEmail,
      previous: readManifest(youEmail),
      paths: pathScenario,
    });
    mkdirSync(join(ROOT, ".cache", "dev-seed"), { recursive: true });
    writeFileSync(
      MANIFEST,
      `${JSON.stringify({ youEmail, ...manifest }, null, 2)}\n`,
    );
    owners = await reviewQueueOwners(db, {
      packSlugs: worlds.map((w) => w.group.packSlug),
      // you first: your queue is the one the closing line should name when it has anything in it
      emails: [...(worlds[0]?.learners ?? [])]
        .sort(
          (x, y) => Number(y.persona === "you") - Number(x.persona === "you"),
        )
        .map((l) => l.email),
    });
  } finally {
    await db.end();
  }

  for (const world of worlds)
    console.log(
      `Seeded "${world.group.name}" (${world.group.packSlug}): ${world.attempts.length} answers, ${world.reviews.length} reviews, ${world.storms.length} finished storms, ${world.expedition ? "1 active expedition" : "no expedition"}.`,
    );
  console.log(
    `Order items: approved ${new Set(orderApprovals.approvals.map((a) => a.review.itemId)).size} diagram(s) they are drawn from${orderApprovals.skipped.length ? `; left as they are: ${orderApprovals.skipped.map((s) => `${s.itemId} (${s.reason})`).join(", ")}` : ""}.`,
  );
  console.log(
    "Review queue (your own items never appear in it; sign in as this account to review):",
  );
  for (const o of owners)
    console.log(`  ${o.packSlug}: ${o.email ?? "nothing left to review"}`);
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
  if (pathScenario) {
    console.log(
      `Learning path "${pathScenario.path.slug}": ${pathScenario.attempts.length} answers, ${pathScenario.completions.length} course completions. Sign in as a path persona (nothing path-related is on your account):`,
    );
    for (const l of pathScenario.learners)
      console.log(`  ${l.email}  (${l.displayName}, ${l.persona})`);
    for (const g of pathScenario.groups)
      console.log(
        `  group "${g.name}": ${g.members.length} members, on ${g.packSlug}`,
      );
  }
  if (skippedPaths.length > 0)
    console.log(
      `No path scenarios for ${skippedPaths.join(", ")}: one path per run, and only when every course of it is seeded.`,
    );
  console.log("Magic links arrive in Mailpit: http://127.0.0.1:54324");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

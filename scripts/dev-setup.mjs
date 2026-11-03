#!/usr/bin/env node
/**
 * MF-0018: one command for a contributor's LOCAL stack — the same functionality the maintainer has.
 *
 *   pnpm dev:setup      (not `pnpm setup`: that name is a pnpm built-in)
 *
 * 1. checks Node >= 24 and that Docker is running
 * 2. starts the local Supabase stack (Postgres, Auth, Studio, Mailpit) with the pinned CLI;
 *    the CLI's output is shown with every key and secret redacted
 * 3. applies PENDING migrations only (never resets: your local data is kept)
 * 4. syncs answer keys from packs/<slug>/questions into the local DB
 * 5. writes/updates the two public Supabase values in .env.local, keeping every other line
 * Safe to re-run. Never touches a hosted project.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { mergeEnv } from "./lib/env-file.mjs";
import { redactSecrets } from "./lib/redact-secrets.mjs";
import { supabaseBin } from "./lib/supabase-bin.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const SUPABASE = supabaseBin(ROOT);

const step = (msg) => console.log(`\n▸ ${msg}`);
const fail = (msg) => {
  console.error(`\n✗ ${msg}`);
  process.exit(1);
};
const run = (cmd, args, opts = {}) => {
  const r = spawnSync(cmd, args, { cwd: ROOT, stdio: "inherit", ...opts });
  if (r.error?.code === "ENOENT") fail(`'${cmd}' was not found.`);
  if (r.status !== 0)
    fail(`'${[cmd, ...args].join(" ")}' failed (exit ${r.status}).`);
  return r;
};
/** Like run(), but streams stdout/stderr line by line through redactSecrets: the CLI prints keys. */
const runRedacted = (cmd, args) =>
  new Promise((done) => {
    const child = spawn(cmd, args, {
      cwd: ROOT,
      stdio: ["inherit", "pipe", "pipe"],
    });
    for (const [src, out] of [
      [child.stdout, process.stdout],
      [child.stderr, process.stderr],
    ])
      createInterface({ input: src }).on("line", (l) =>
        out.write(`${redactSecrets(l)}\n`),
      );
    child.on("error", (e) =>
      fail(e.code === "ENOENT" ? `'${cmd}' was not found.` : e.message),
    );
    child.on("close", (code) => {
      if (code !== 0)
        fail(`'${[cmd, ...args].join(" ")}' failed (exit ${code}).`);
      done();
    });
  });

// 1. prerequisites ─────────────────────────────────────────────────────────────
step("Checking prerequisites");
const major = Number(process.versions.node.split(".")[0]);
if (major < 24)
  fail(
    `Node ${process.versions.node} found; MindForge needs Node 24 or newer.`,
  );
console.log(`  Node ${process.versions.node} ✓`);

const docker = spawnSync("docker", ["info", "--format", "{{.ServerVersion}}"], {
  encoding: "utf8",
});
if (docker.error?.code === "ENOENT") {
  fail(
    "Docker is not installed. The local Supabase stack runs in Docker.\n" +
      "  Install Docker Desktop (https://docs.docker.com/get-docker/), OrbStack or Colima, start it, then re-run `pnpm dev:setup`.",
  );
}
if (docker.status !== 0) {
  fail(
    "Docker is installed but not running. Start Docker Desktop / OrbStack / Colima, then re-run `pnpm dev:setup`.",
  );
}
console.log(`  Docker ${docker.stdout.trim()} ✓`);

if (SUPABASE === "supabase") {
  console.log(
    "  (node_modules/.bin/supabase missing — run `pnpm install` first; falling back to a global CLI)",
  );
}

// 2. stack ──────────────────────────────────────────────────────────────────────
step(
  "Starting the local Supabase stack (first run downloads images; this can take a few minutes)",
);
await runRedacted(SUPABASE, ["start"]); // keys are printed redacted; .env.local gets the public ones

// 3. migrations (pending only) ────────────────────────────────────────────────
step("Applying pending migrations (your local data is kept)");
run(SUPABASE, ["migration", "up", "--local"]);

// 4. answer keys ───────────────────────────────────────────────────────────────
step("Syncing answer keys from packs/*/questions");
run(process.execPath, [join(ROOT, "scripts/sync-question-keys.mjs")], {
  env: { ...process.env, SUPABASE_DB_URL: "" }, // always the local stack
});

// 5. .env.local ────────────────────────────────────────────────────────────────
step("Writing .env.local");
const status = spawnSync(SUPABASE, ["status", "-o", "json"], {
  cwd: ROOT,
  encoding: "utf8",
});
if (status.status !== 0) fail("Could not read `supabase status`.");
const env = JSON.parse(
  status.stdout.slice(
    status.stdout.indexOf("{"),
    status.stdout.lastIndexOf("}") + 1,
  ),
);
const envPath = join(ROOT, ".env.local");
const before = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
const after = mergeEnv(before, {
  NEXT_PUBLIC_SUPABASE_URL: env.API_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: env.PUBLISHABLE_KEY, // public by design; never the secret key
});
if (after !== before) writeFileSync(envPath, after);
console.log(
  `  ${after === before ? "already up to date" : before ? "updated" : "created"} (${envPath})`,
);

console.log(`
✓ Local stack ready.

  App        pnpm dev  →  http://localhost:3001
  Mailpit    ${env.MAILPIT_URL ?? env.INBUCKET_URL}   (sign-in links land here)
  Studio     ${env.STUDIO_URL}   (browse the local database)

  Checks: pnpm typecheck · pnpm lint · pnpm test · pnpm test:db · pnpm build
`);

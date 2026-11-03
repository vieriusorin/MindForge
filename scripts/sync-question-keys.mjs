#!/usr/bin/env node
/**
 * MF-0003: copy answer keys from packs/<slug>/questions/*.yaml into private.question_keys.
 * The database grades answers against this table; run after `supabase db reset` and after
 * editing questions. Idempotent: upserts every key and deletes keys no longer in the files.
 *
 * DB: $SUPABASE_DB_URL, else the LOCAL stack from `supabase status`.
 * Usage: node scripts/sync-question-keys.mjs
 */
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import postgres from "postgres";
import YAML from "yaml";
import { supabaseBin } from "./lib/supabase-bin.mjs";

const ROOT = resolve(import.meta.dirname, "..");

function dbUrl() {
  if (process.env.SUPABASE_DB_URL) return process.env.SUPABASE_DB_URL;
  const out = execFileSync(supabaseBin(ROOT), ["status", "-o", "json"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  return JSON.parse(out.slice(out.indexOf("{"), out.lastIndexOf("}") + 1))
    .DB_URL;
}

function readKeys(packSlug) {
  const dir = join(ROOT, "packs", packSlug, "questions");
  let names;
  try {
    names = readdirSync(dir).filter((n) => n.endsWith(".yaml"));
  } catch (error) {
    // Only "no questions folder" means no questions. Any other error must not delete the pack's keys.
    if (error.code === "ENOENT") return [];
    throw error;
  }
  return names.flatMap((name) => {
    const file = YAML.parse(readFileSync(join(dir, name), "utf8"));
    return file.questions.map((q) => {
      const correct = q.options.filter((o) => o.correct).map((o) => o.id);
      if (correct.length === 0)
        throw new Error(`${packSlug}/${name}: ${q.id} has no correct option`);
      return {
        question_id: q.id,
        pack_slug: packSlug,
        skill_code: file.skill,
        correct_options: correct,
      };
    });
  });
}

const packs = readdirSync(join(ROOT, "packs"), { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort();

const sql = postgres(dbUrl(), { max: 1, onnotice: () => {} });
try {
  for (const pack of packs) {
    const keys = readKeys(pack);
    await sql.begin(async (tx) => {
      for (const k of keys) {
        await tx`
          insert into private.question_keys (question_id, pack_slug, skill_code, correct_options)
          values (${k.question_id}, ${k.pack_slug}, ${k.skill_code}, ${k.correct_options})
          on conflict (question_id) do update
            set pack_slug = excluded.pack_slug,
                skill_code = excluded.skill_code,
                correct_options = excluded.correct_options,
                updated_at = now()`;
      }
      const ids = keys.map((k) => k.question_id);
      await tx`delete from private.question_keys where pack_slug = ${pack} and not (question_id = any(${ids}))`;
    });
    console.log(`${pack}: ${keys.length} key(s) synced`);
  }
} finally {
  await sql.end();
}

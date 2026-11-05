#!/usr/bin/env node
/**
 * MF-0003: copy answer keys from packs/<slug>/questions/*.yaml into private.question_keys.
 * The database grades answers against this table; run after `supabase db reset` and after
 * editing questions. Idempotent: upserts every key and deletes keys no longer in the files.
 * MF-0004: also registers every packs/<slug>/ folder in private.packs (create_group refuses
 * any other slug) and removes slugs whose folder is gone.
 * MF-0007: also registers every question, card and diagram in private.items with its content
 * hash, which the review state binds to.
 * MF-0013: also writes each pack's exam timing (private.packs.exam_questions / exam_minutes, null
 * without an `exam:` block) and its skill -> domain map (private.pack_skills): start_storm sets the
 * deadline and checks a Boss Storm's domain from these, never from the client.
 * MF-0012: first loads every pack with the app's own validator and exits 1, writing nothing, on any
 * problem.
 * MF-0016: cuckoos (packs/<slug>/cuckoos/*.yaml) are keyed like questions, with the flawed line's
 * number as the only correct option, and registered with item_type 'cuckoo'.
 * MF-0032: a pack's keys and items are written in ONE transaction (record_attempt binds the two).
 * MF-0025: keys and items of a pack whose folder is gone are deleted with its registry row.
 *
 * DB: $SUPABASE_DB_URL, else the LOCAL stack from `supabase status`.
 * Usage: node scripts/sync-question-keys.mjs
 * Hosted (docs/runbook/deploy.md): pass the URL inline from the password manager, never a file:
 *   SUPABASE_DB_URL="$(op read 'op://…/mindforge-prod/db-url')" pnpm db:sync-keys
 */
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import postgres from "postgres";
import YAML from "yaml";
import { contentHash } from "./lib/content-hash.mjs";
import { supabaseBin } from "./lib/supabase-bin.mjs";
import { validatePacks } from "./lib/validate-packs.mjs";

const ROOT = resolve(import.meta.dirname, "..");
// MF-0012: tests point the script at a fixture folder. Never against a remote DB: a partial
// folder would unregister the hosted packs that are missing from it.
const PACKS_DIR = process.env.MINDFORGE_PACKS_DIR || join(ROOT, "packs");
if (process.env.MINDFORGE_PACKS_DIR && process.env.SUPABASE_DB_URL) {
  console.error("Refusing MINDFORGE_PACKS_DIR together with SUPABASE_DB_URL.");
  process.exit(1);
}

function dbUrl() {
  if (process.env.SUPABASE_DB_URL) return process.env.SUPABASE_DB_URL;
  const out = execFileSync(supabaseBin(ROOT), ["status", "-o", "json"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  return JSON.parse(out.slice(out.indexOf("{"), out.lastIndexOf("}") + 1))
    .DB_URL;
}

/** Parsed YAML files of packs/<slug>/<kind>/*.yaml, with their names. */
function readFiles(packSlug, kind) {
  const dir = join(PACKS_DIR, packSlug, kind);
  let names;
  try {
    names = readdirSync(dir).filter((n) => n.endsWith(".yaml"));
  } catch (error) {
    // Only "no such folder" means no items. Any other error must not delete the pack's rows.
    if (error.code === "ENOENT") return [];
    throw error;
  }
  return names.map((name) => ({
    name,
    file: YAML.parse(readFileSync(join(dir, name), "utf8")),
  }));
}

function readKeys(packSlug) {
  const questions = readFiles(packSlug, "questions").flatMap(
    ({ name, file }) => {
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
    },
  );
  // MF-0016: record_attempt grades a cuckoo answer (a line number) by the same set equality.
  const cuckoos = readFiles(packSlug, "cuckoos").flatMap(({ file }) =>
    file.cuckoos.map((c) => ({
      question_id: c.id,
      pack_slug: packSlug,
      skill_code: file.skill,
      correct_options: [String(c.flawLine)],
    })),
  );
  return [...questions, ...cuckoos];
}

/** MF-0013: exam timing and skill -> domain map from packs/<slug>/pack.yaml. */
function readPackMeta(packSlug) {
  const pack = YAML.parse(
    readFileSync(join(PACKS_DIR, packSlug, "pack.yaml"), "utf8"),
  );
  const skills = (pack.domains ?? []).flatMap((d) =>
    (d.skills ?? []).map((s) => ({ skill_code: s.code, domain_code: d.code })),
  );
  return {
    exam_questions: pack.exam?.questions ?? null,
    exam_minutes: pack.exam?.minutes ?? null,
    skills,
  };
}

const ITEM_KINDS = [
  { kind: "questions", type: "question" },
  { kind: "cards", type: "card" },
  { kind: "diagrams", type: "diagram" },
  { kind: "cuckoos", type: "cuckoo" },
];
const ORIGINS = ["official", "human", "ai"];

/** MF-0007: one registry row per item; reviews bind to (item_id, content_hash). */
function readItems(packSlug) {
  return ITEM_KINDS.flatMap(({ kind, type }) =>
    readFiles(packSlug, kind).flatMap(({ name, file }) =>
      file[kind].map((item) => {
        if (!ORIGINS.includes(item.origin))
          throw new Error(
            `${packSlug}/${kind}/${name}: ${item.id} has no valid origin`,
          );
        // A human/ai item without an author would let its real author approve it (MF-0007 review).
        if (item.origin !== "official" && !item.author)
          throw new Error(
            `${packSlug}/${kind}/${name}: ${item.id} is ${item.origin} but has no author`,
          );
        return {
          item_id: item.id,
          pack_slug: packSlug,
          skill_code: file.skill,
          item_type: type,
          content_hash: contentHash(item),
          origin: item.origin,
          author_email: item.author ?? null,
        };
      }),
    ),
  );
}

// MF-0004: against a remote DB this unregisters packs whose folder is missing, so only sync
// from an up-to-date `main` with no local changes under packs/ (docs/runbook/deploy.md B3).
if (process.env.SUPABASE_DB_URL) {
  const git = (...args) =>
    execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
  const branch = git("rev-parse", "--abbrev-ref", "HEAD");
  const dirty = git("status", "--porcelain", "--", "packs");
  if (branch !== "main" || dirty) {
    console.error(
      `Refusing to sync a remote DB from branch "${branch}"${dirty ? " with local changes under packs/" : ""}. Check out an up-to-date main first.`,
    );
    process.exit(1);
  }
}

const packs = readdirSync(PACKS_DIR, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort();

// MF-0012: validate every pack before connecting, so a bad file changes no row in any pack.
const problems = await validatePacks(ROOT, PACKS_DIR, packs);
if (problems.length) {
  console.error(`Not syncing: invalid pack content.\n${problems.join("\n")}`);
  process.exit(1);
}

const sql = postgres(dbUrl(), { max: 1, onnotice: () => {} });
try {
  await sql.begin(async (tx) => {
    for (const pack of packs) {
      const meta = readPackMeta(pack);
      await tx`
        insert into private.packs (slug, exam_questions, exam_minutes)
        values (${pack}, ${meta.exam_questions}, ${meta.exam_minutes})
        on conflict (slug) do update
          set exam_questions = excluded.exam_questions,
              exam_minutes = excluded.exam_minutes,
              updated_at = now()`;
    }
    await tx`delete from private.packs where not (slug = any(${packs}))`;
    // MF-0025: a removed pack's keys and items leave with its registry row, so record_attempt and
    // review_item refuse them. Its reviews, flags and approvals cascade (user decision C-1 = A);
    // attempts and storms keep their history (ids by value, no FK).
    const keys = await tx`
      delete from private.question_keys where not (pack_slug = any(${packs}))`;
    const items = await tx`
      delete from private.items where not (pack_slug = any(${packs}))`;
    if (keys.count || items.count)
      console.log(
        `unregistered packs: removed ${keys.count} key(s), ${items.count} item(s)`,
      );
  });
  console.log(`pack registry: ${packs.join(", ")}`);
  for (const pack of packs) {
    // MF-0013: the skill -> domain map; only this pack's rows are replaced.
    const { skills } = readPackMeta(pack);
    await sql.begin(async (tx) => {
      for (const s of skills) {
        await tx`
          insert into private.pack_skills (pack_slug, skill_code, domain_code)
          values (${pack}, ${s.skill_code}, ${s.domain_code})
          on conflict (pack_slug, skill_code) do update
            set domain_code = excluded.domain_code`;
      }
      const codes = skills.map((s) => s.skill_code);
      await tx`delete from private.pack_skills where pack_slug = ${pack} and not (skill_code = any(${codes}))`;
    });
    console.log(`${pack}: ${skills.length} skill(s) mapped`);

    const keys = readKeys(pack);
    const items = readItems(pack);
    // MF-0032: keys and items commit together. record_attempt checks the answer's hash against
    // private.items and grades with private.question_keys in one snapshot, so both must be one version.
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
      const keyIds = keys.map((k) => k.question_id);
      await tx`delete from private.question_keys where pack_slug = ${pack} and not (question_id = any(${keyIds}))`;

      // MF-0007: hash_synced_at moves only when the hash changes (C-3: the 48 h analogy clock).
      // Only this pack's rows are deleted here; removed packs were cleared with the registry (MF-0025).
      for (const i of items) {
        await tx`
          insert into private.items as cur
            (item_id, pack_slug, skill_code, item_type, content_hash, origin, author_email)
          values (${i.item_id}, ${i.pack_slug}, ${i.skill_code}, ${i.item_type},
                  ${i.content_hash}, ${i.origin}, ${i.author_email})
          on conflict (item_id) do update
            set pack_slug = excluded.pack_slug,
                skill_code = excluded.skill_code,
                item_type = excluded.item_type,
                origin = excluded.origin,
                author_email = excluded.author_email,
                hash_synced_at = case when cur.content_hash = excluded.content_hash
                                      then cur.hash_synced_at else now() end,
                content_hash = excluded.content_hash,
                updated_at = now()`;
      }
      const itemIds = items.map((i) => i.item_id);
      await tx`delete from private.items where pack_slug = ${pack} and not (item_id = any(${itemIds}))`;
    });
    console.log(`${pack}: ${keys.length} key(s) synced`);
    console.log(`${pack}: ${items.length} item(s) registered`);
  }
} finally {
  await sql.end();
}

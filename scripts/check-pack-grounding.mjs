#!/usr/bin/env node
/**
 * MF-0036: `pnpm check:packs`, an offline grounding check over pack content and the cached text of
 * its cited sources (`.cache/corpus/<sha256(url)>.json`, written by `pnpm generate:corpus`).
 * It runs the cuckoo rule (scripts/lib/cuckoo-grounding.mjs) and, since MF-0033, the token and leak rules
 * for questions, cards and diagrams (scripts/lib/item-grounding.mjs). Since MF-0041 it also runs the
 * flaw-key rule (scripts/lib/cuckoo-flaw-key.mjs), which needs no corpus and so runs first. The
 * corpus rules skip when the corpus is absent (CI, fresh clones).
 * Exit 1 on any problem.
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { checkFlawKeys } from "./lib/cuckoo-flaw-key.mjs";
import { checkCuckooFile } from "./lib/cuckoo-grounding.mjs";
import { checkItemFile } from "./lib/item-grounding.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PACKS = process.env.MF_PACKS_DIR
  ? resolve(process.env.MF_PACKS_DIR)
  : join(ROOT, "packs");
const CORPUS = join(ROOT, ".cache", "corpus");

// Every cuckoo YAML file under PACKS/<pack>/cuckoos, sorted, as absolute paths.
function cuckooFiles() {
  const files = [];
  for (const pack of readdirSync(PACKS).sort()) {
    const dir = join(PACKS, pack, "cuckoos");
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir).sort()) {
      if (name.endsWith(".yaml")) files.push(join(dir, name));
    }
  }
  return files;
}

// MF-0041: structural, no corpus needed, so it runs before the corpus-absent skip (CI).
const problems = cuckooFiles().flatMap((path) =>
  checkFlawKeys({
    file: relative(ROOT, path),
    text: readFileSync(path, "utf8"),
  }),
);

if (!existsSync(CORPUS)) {
  for (const p of problems) console.error(p.message);
  console.log(
    `check:packs: .cache/corpus missing, corpus rules skipped (run pnpm generate:corpus); flaw-key: ${problems.length} problem(s)`,
  );
  process.exit(problems.length > 0 ? 1 : 0);
}

const texts = new Map();
/** @param {string} url */
function corpus(url) {
  if (!texts.has(url)) {
    const path = join(
      CORPUS,
      `${createHash("sha256").update(url).digest("hex")}.json`,
    );
    texts.set(
      url,
      existsSync(path) ? JSON.parse(readFileSync(path, "utf8")).text : null,
    );
  }
  return texts.get(url);
}

let checked = 0;
for (const path of cuckooFiles()) {
  checked++;
  problems.push(
    ...checkCuckooFile({
      file: relative(ROOT, path),
      text: readFileSync(path, "utf8"),
      corpus,
    }),
  );
}

let itemsChecked = 0;
let itemsSkipped = 0;
for (const pack of readdirSync(PACKS).sort()) {
  for (const kind of /** @type {const} */ ([
    "questions",
    "cards",
    "diagrams",
  ])) {
    const dir = join(PACKS, pack, kind);
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir).sort()) {
      if (!name.endsWith(".yaml")) continue;
      const path = join(dir, name);
      const result = checkItemFile({
        file: relative(ROOT, path),
        kind,
        text: readFileSync(path, "utf8"),
        corpus,
      });
      problems.push(...result.problems);
      itemsChecked += result.checked;
      itemsSkipped += result.skipped;
    }
  }
}

for (const p of problems) console.error(p.message);
console.log(
  `check:packs: ${checked} cuckoo file(s), ${itemsChecked} item(s) checked, ${itemsSkipped} skipped (source not cached), ${problems.length} problem(s)`,
);
process.exit(problems.length > 0 ? 1 : 0);

#!/usr/bin/env node
/**
 * MF-0008 SC-9 (one-off): seed `sources:` per skill in packs/<pack>/pack.yaml from the distinct
 * `source.url`s its questions already cite (C-4, user decision 2026-11-04). The Owner reviews and
 * extends the list before MF-0022's first real run. Skills that already have `sources:` are skipped.
 *
 * Usage: node scripts/generate/seed-sources.mjs ccdv-f
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import YAML from "yaml";

const ROOT = resolve(import.meta.dirname, "../..");
const pack = process.argv[2];
if (!pack || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(pack)) {
  console.error("usage: seed-sources.mjs <pack-slug>");
  process.exit(1);
}
const packDir = join(ROOT, "packs", pack);

const cited = new Map();
for (const name of readdirSync(join(packDir, "questions")).filter((n) =>
  n.endsWith(".yaml"),
)) {
  const file = YAML.parse(
    readFileSync(join(packDir, "questions", name), "utf8"),
  );
  for (const q of file.questions) {
    const urls = cited.get(file.skill) ?? new Set();
    urls.add(q.source.url);
    cited.set(file.skill, urls);
  }
}

const path = join(packDir, "pack.yaml");
const text = readFileSync(path, "utf8");
if (text.includes("\r"))
  throw new Error("pack.yaml is not LF-only; refusing a line-based edit");
const lines = text.split("\n");
const out = [];
let seeded = 0;
for (let i = 0; i < lines.length; i++) {
  out.push(lines[i]);
  const skill = /^[ \t]{6}- code: (\S+)$/.exec(lines[i] ?? "")?.[1];
  if (!skill) continue;
  // copy the rest of this skill's block (8-space keys), then append sources if absent
  const block = [];
  while (i + 1 < lines.length && /^[ \t]{8}\S/.test(lines[i + 1] ?? ""))
    block.push(lines[++i]);
  out.push(...block);
  if (block.some((l) => /^[ \t]{8}sources:/.test(l))) continue;
  const urls = [...(cited.get(skill) ?? [])].sort();
  if (urls.length === 0) {
    console.warn(`${skill}: no cited URL; left without sources`);
    continue;
  }
  out.push("        sources:", ...urls.map((u) => `          - ${u}`));
  seeded += 1;
}
writeFileSync(path, out.join("\n"));
console.log(`${pack}: seeded sources for ${seeded} skill(s)`);

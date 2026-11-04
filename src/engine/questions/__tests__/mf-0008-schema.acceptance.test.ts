/**
 * MF-0008 acceptance (frozen): `generatedBy` on questions (C-3) and `sources` per skill (C-4).
 * SC-9 reads the real pack files at runtime.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import YAML from "yaml";
import { loadPackFile } from "../../pack";
import { parseQuestionFiles, toPlayableQuestion } from "..";

const ROOT = process.cwd();
const PACK_DIR = join(ROOT, "packs/ccdv-f");

const fileWith = (question: Record<string, unknown>) => ({
  name: "D5.S3.test.yaml",
  text: YAML.stringify({ skill: "D5.S3", questions: [question] }),
});

const base = {
  id: "ccdv-f.D5.S3.gen-1",
  origin: "ai",
  author: "runner@example.com",
  stem: "Which field enables prompt caching?",
  select: 1,
  options: [
    {
      id: "A",
      text: "cache_control",
      correct: true,
      rationale: "It marks the breakpoint.",
    },
    {
      id: "B",
      text: "temperature",
      correct: false,
      rationale: "Sampling, not caching.",
    },
  ],
  source: {
    title: "Prompt caching",
    url: "https://platform.claude.com/docs/en/build-with-claude/prompt-caching",
  },
};

describe("MF-0008 question provenance and pack sources", () => {
  it("SC-8: optional generatedBy { model, prompt } on ai items only, never sent to the browser; existing questions still load", async () => {
    const pack = await loadPackFile(join(PACK_DIR, "pack.yaml"));
    const generatedBy = { model: "claude-sonnet-5-5", prompt: "writer@1" };

    const [q] = parseQuestionFiles([fileWith({ ...base, generatedBy })], pack);
    expect(q?.generatedBy).toEqual(generatedBy);
    expect(parseQuestionFiles([fileWith(base)], pack)).toHaveLength(1);

    const bad = (question: Record<string, unknown>) => () =>
      parseQuestionFiles([fileWith(question)], pack);
    expect(
      bad({ ...base, generatedBy: { model: "", prompt: "writer@1" } }),
    ).toThrow();
    expect(
      bad({ ...base, generatedBy: { model: "m", prompt: "p", extra: 1 } }),
    ).toThrow();
    expect(bad({ ...base, generatedBy: "claude-sonnet-5-5" })).toThrow();
    expect(bad({ ...base, unknownKey: true })).toThrow();
    expect(bad({ ...base, origin: "human", generatedBy })).toThrow();
    const { author: _author, ...official } = base;
    expect(bad({ ...official, origin: "official", generatedBy })).toThrow();

    if (!q) throw new Error("the generatedBy question did not load");
    const playable = toPlayableQuestion(q);
    expect(Object.keys(playable)).not.toContain("generatedBy");
    expect(Object.keys(playable)).not.toContain("author");

    const dir = join(PACK_DIR, "questions");
    const files = readdirSync(dir)
      .filter((n) => n.endsWith(".yaml"))
      .map((name) => ({ name, text: readFileSync(join(dir, name), "utf8") }));
    expect(parseQuestionFiles(files, pack)).toHaveLength(53);
  });

  it("SC-9: every skill lists at least one source, and every question cites one of its skill's sources", async () => {
    const pack = await loadPackFile(join(PACK_DIR, "pack.yaml"));
    const sources = new Map(
      pack.domains.flatMap((d) =>
        d.skills.map((s) => [s.code, s.sources ?? []] as const),
      ),
    );
    for (const [code, urls] of sources)
      expect(urls.length, `${code} has no sources`).toBeGreaterThanOrEqual(1);

    const dir = join(PACK_DIR, "questions");
    const files = readdirSync(dir)
      .filter((n) => n.endsWith(".yaml"))
      .map((name) => ({ name, text: readFileSync(join(dir, name), "utf8") }));
    for (const q of parseQuestionFiles(files, pack))
      expect(
        sources.get(q.skillCode),
        `${q.id} cites ${q.source.url}`,
      ).toContain(q.source.url);
  });
});

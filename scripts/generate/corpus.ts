/**
 * MF-0008 SC-1: fetch every skill's `sources` (pack.yaml) into `.cache/corpus/`, one JSON file per
 * URL, with a conditional GET so unchanged pages are not downloaded again. No API key needed.
 *
 * Usage: pnpm generate:corpus [--pack ccdv-f]
 */
import {
  appendFileSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { sha256, syncCorpus } from "@/content-pipeline/pipeline";
import type {
  CorpusEntry,
  CorpusStore,
  FetchPage,
} from "@/content-pipeline/types";
import { loadPackFile } from "@/engine/pack";

const ROOT = process.cwd();
export const CORPUS_DIR = join(ROOT, ".cache", "corpus");

const CorpusEntrySchema = z.strictObject({
  url: z.string(),
  skill: z.string(),
  fetchedAt: z.string(),
  hash: z.string(),
  etag: z.string().nullable(),
  text: z.string(),
}) satisfies z.ZodType<CorpusEntry>;

/** One JSON file per URL, named by the URL's hash. */
export function fileCorpusStore(dir: string): CorpusStore {
  mkdirSync(dir, { recursive: true });
  const pathOf = (url: string) => join(dir, `${sha256(url)}.json`);
  return {
    get(url) {
      try {
        return CorpusEntrySchema.parse(
          JSON.parse(readFileSync(pathOf(url), "utf8")),
        );
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT")
          return undefined;
        throw error;
      }
    },
    put(entry) {
      writeFileSync(pathOf(entry.url), `${JSON.stringify(entry, null, 2)}\n`);
    },
  };
}

/** Docs hosts that publish a Markdown copy of each page at `<url>.md` (their HTML embeds compiled MDX). */
const MARKDOWN_HOSTS = new Set([
  "platform.claude.com",
  "code.claude.com",
  "docs.claude.com",
]);

function markdownCopy(url: string): string | null {
  const parsed = new URL(url);
  if (!MARKDOWN_HOSTS.has(parsed.hostname) || parsed.pathname.endsWith(".md"))
    return null;
  parsed.pathname = `${parsed.pathname.replace(/\/$/, "")}.md`;
  return parsed.toString();
}

async function get(url: string, etag: string | null): Promise<Response> {
  return fetch(url, {
    headers: {
      "user-agent": "MindForge-corpus/1.0",
      ...(etag ? { "if-none-match": etag } : {}),
    },
    redirect: "follow",
  });
}

const fetchPage: FetchPage = async (url, { etag }) => {
  const markdown = markdownCopy(url);
  let response = markdown ? await get(markdown, etag) : await get(url, etag);
  if (markdown && response.status === 404) response = await get(url, etag);
  if (response.status === 304) return { status: 304 };
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return {
    status: 200,
    body: await response.text(),
    etag: response.headers.get("etag"),
    contentType: response.headers.get("content-type"),
  };
};

async function main(): Promise<void> {
  const packArg = process.argv.indexOf("--pack");
  const pack = packArg > 0 ? (process.argv[packArg + 1] ?? "") : "ccdv-f";
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(pack))
    throw new Error(`invalid pack "${pack}"`);

  const packFile = await loadPackFile(join(ROOT, "packs", pack, "pack.yaml"));
  const sources = packFile.domains
    .flatMap((d) => d.skills)
    .map((s) => ({ skill: s.code, urls: s.sources ?? [] }));
  const now = new Date();
  const report = await syncCorpus({
    sources,
    fetchPage,
    store: fileCorpusStore(CORPUS_DIR),
    now,
  });
  const line = `${now.toISOString()} pack=${pack} fetched=${report.fetched.length} unchanged=${report.unchanged.length} refused=${report.refused.length} unsupported=${report.unsupported.length}`;
  appendFileSync(join(CORPUS_DIR, "runs.log"), `${line}\n`);
  console.log(line);
  for (const url of report.refused) console.log(`refused: ${url}`);
  for (const url of report.unsupported)
    console.log(`unsupported (not stored): ${url}`);
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/generate/corpus.ts"))
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });

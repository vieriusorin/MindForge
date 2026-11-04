import { createHash } from "node:crypto";
import type {
  CorpusEntry,
  CorpusReport,
  CorpusStore,
  FetchPage,
  SkillSources,
} from "./types";

export function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

/** MINDFORGE §1.3: only public https pages; course content behind a login (Skilljar) is never fetched. */
export function isFetchableSource(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  return (
    parsed.protocol === "https:" &&
    !parsed.hostname.toLowerCase().includes("skilljar")
  );
}

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
};

/** Readable text of an HTML page: scripts, styles and tags removed, whitespace collapsed. */
export function pageText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (e) => ENTITIES[e] ?? e)
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** How a response body becomes corpus text: HTML is stripped, markdown/plain kept, anything else refused. */
export function textKind(
  contentType: string | null | undefined,
): "html" | "text" | null {
  const type =
    (contentType ?? "text/html").split(";")[0]?.trim().toLowerCase() ?? "";
  if (type === "text/html" || type === "application/xhtml+xml") return "html";
  if (
    type === "text/markdown" ||
    type === "text/plain" ||
    type === "text/x-markdown"
  )
    return "text";
  return null;
}

/**
 * SC-1: fetch each skill's sources with a conditional GET. Refused URLs never reach `fetchPage`.
 * A 304, or a 200 whose text hashes the same, leaves the stored entry untouched.
 */
export async function syncCorpus({
  sources,
  fetchPage,
  store,
  now,
}: {
  sources: SkillSources[];
  fetchPage: FetchPage;
  store: CorpusStore;
  now: Date;
}): Promise<CorpusReport> {
  const report: CorpusReport = {
    fetched: [],
    unchanged: [],
    refused: [],
    unsupported: [],
  };
  const seen = new Set<string>();
  for (const { skill, urls } of sources) {
    for (const url of urls) {
      if (seen.has(url)) continue;
      seen.add(url);
      if (!isFetchableSource(url)) {
        report.refused.push(url);
        continue;
      }
      const previous = store.get(url);
      const result = await fetchPage(url, { etag: previous?.etag ?? null });
      if (result.status === 304) {
        report.unchanged.push(url);
        continue;
      }
      const kind = textKind(result.contentType);
      if (kind === null) {
        report.unsupported.push(url);
        continue;
      }
      const text = kind === "html" ? pageText(result.body) : result.body.trim();
      const hash = sha256(text);
      if (previous && previous.hash === hash) {
        report.unchanged.push(url);
        continue;
      }
      const entry: CorpusEntry = {
        url,
        skill,
        fetchedAt: now.toISOString(),
        hash,
        etag: result.etag,
        text,
      };
      store.put(entry);
      report.fetched.push(url);
    }
  }
  return report;
}

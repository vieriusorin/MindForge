import { describe, expect, it } from "vitest";
import { isFetchableSource, pageText, syncCorpus, textKind } from "../corpus";
import { estimateBatchCost, estimateTokens } from "../cost";
import { promptBodyHash, promptRef, relockPrompts } from "../prompts";
import type { BatchRequest } from "../types";
import { verifierIdFor } from "../verifier";

describe("isFetchableSource", () => {
  it("accepts public https pages only", () => {
    expect(isFetchableSource("https://platform.claude.com/docs/en/api")).toBe(
      true,
    );
    expect(isFetchableSource("http://platform.claude.com/docs")).toBe(false);
    expect(isFetchableSource("https://anthropic.SKILLJAR.com/x")).toBe(false);
    expect(isFetchableSource("not a url")).toBe(false);
  });
});

describe("pageText", () => {
  it("drops scripts, styles and tags, decodes basic entities and keeps paragraph breaks", () => {
    const html =
      "<html><style>p{}</style><script>alert(1)</script><h1>Caching</h1><p>Use&nbsp;<code>cache_control</code> &amp; save.</p></html>";
    expect(pageText(html)).toBe("Caching\nUse cache_control & save.");
  });
});

describe("estimateTokens / estimateBatchCost", () => {
  it("rounds up at three characters per token", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("abcd")).toBe(2);
  });

  it("assumes every request writes the cache and uses all of max_tokens (an upper bound)", () => {
    const request: BatchRequest = {
      custom_id: "D1_S1-0",
      params: {
        model: "claude-sonnet-5-5",
        max_tokens: 1000,
        system: [
          { type: "text", text: "x".repeat(300) },
          {
            type: "text",
            text: "y".repeat(3000),
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [{ role: "user", content: "z".repeat(300) }],
        output_config: { format: { type: "json_schema", schema: {} } },
      },
    };
    // 200 input × $2 + 1000 cache write × $2.50 + 1000 output × $10, per MTok, × 0.5
    const one = ((200 * 2 + 1000 * 2.5 + 1000 * 10) / 1_000_000) * 0.5;
    expect(estimateBatchCost([request, request])).toBeCloseTo(2 * one, 10);
  });
});

describe("prompt lock", () => {
  const writer = { name: "writer", version: 1, body: "Write.\n" };

  it("hashes bodies with CRLF read as LF", () => {
    expect(promptBodyHash("a\r\nb")).toBe(promptBodyHash("a\nb"));
  });

  it("records new and bumped prompts, and refuses an unbumped body change", () => {
    const lock = relockPrompts([writer], {});
    expect(lock.writer).toEqual({
      version: 1,
      bodyHash: promptBodyHash("Write.\n"),
    });
    expect(() =>
      relockPrompts([{ ...writer, body: "Changed.\n" }], lock),
    ).toThrow(/bump/);
    expect(
      relockPrompts([{ ...writer, version: 2, body: "Changed.\n" }], lock)
        .writer?.version,
    ).toBe(2);
  });

  it("names a prompt version as name@version", () => {
    expect(promptRef(writer)).toBe("writer@1");
  });
});

describe("verifierIdFor", () => {
  it("is a Batch-safe id per item index", () => {
    expect(verifierIdFor(12)).toBe("v-12");
  });
});

describe("syncCorpus content types", () => {
  it("strips HTML, keeps markdown as written, and lists other types (PDF) as unsupported without storing them", async () => {
    const stored = new Map<string, string>();
    const store = {
      get: () => undefined,
      put: (e: { url: string; text: string }) => {
        stored.set(e.url, e.text);
      },
    };
    const pages: Record<string, { body: string; contentType: string }> = {
      "https://a.example/html": {
        body: "<p>Hello <b>docs</b></p>",
        contentType: "text/html; charset=utf-8",
      },
      "https://a.example/md": {
        body: "# Title\n\n<Note>keep</Note>",
        contentType: "text/markdown; charset=utf-8",
      },
      "https://a.example/guide.pdf": {
        body: "%PDF-1.7 \u0000\u0001",
        contentType: "application/pdf",
      },
    };
    const report = await syncCorpus({
      sources: [{ skill: "S1", urls: Object.keys(pages) }],
      fetchPage: async (url) => ({
        status: 200,
        etag: null,
        ...(pages[url] ?? { body: "", contentType: "" }),
      }),
      store,
      now: new Date("2026-11-04T00:00:00.000Z"),
    });
    expect(report.fetched).toEqual([
      "https://a.example/html",
      "https://a.example/md",
    ]);
    expect(report.unsupported).toEqual(["https://a.example/guide.pdf"]);
    expect(stored.get("https://a.example/html")).toBe("Hello docs");
    expect(stored.get("https://a.example/md")).toBe(
      "# Title\n\n<Note>keep</Note>",
    );
    expect(stored.has("https://a.example/guide.pdf")).toBe(false);
  });
});

describe("textKind", () => {
  it("treats a missing type as HTML, keeps markdown and plain text, refuses the rest", () => {
    expect(textKind(undefined)).toBe("html");
    expect(textKind("text/html; charset=utf-8")).toBe("html");
    expect(textKind("text/markdown; charset=utf-8")).toBe("text");
    expect(textKind("text/plain")).toBe("text");
    expect(textKind("application/pdf")).toBeNull();
  });
});

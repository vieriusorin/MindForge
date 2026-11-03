// @vitest-environment jsdom
// MF-0006 C-1: Mermaid needs a DOM to parse, so this file runs in jsdom (spike 2026-11-03).
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkMermaid } from "../../../test/mermaid-check";
import { loadPackFile } from "../../pack/load-pack";
import { loadPackContent } from "../load-content";

const ROOT = process.cwd();

const VALID = `flowchart LR
  A[Hive: user goal] --> B[Bee decides: think]
  B --> C{Need a flower?<br/>tool call}
  C -- yes --> D[Fly + collect]
  D --> B`;

const BROKEN = `flowchart LR
  A[Hive --> B[[`;

describe("MF-0006 Mermaid content check", () => {
  it("SC-2: a valid diagram passes; a broken one fails naming the item id", async () => {
    await expect(
      checkMermaid([{ id: "tiny.S1.valid", mermaid: VALID }]),
    ).resolves.toBeUndefined();
    await expect(
      checkMermaid([
        { id: "tiny.S1.valid", mermaid: VALID },
        { id: "tiny.S1.broken", mermaid: BROKEN },
      ]),
    ).rejects.toThrow(/tiny\.S1\.broken/);
  });

  it("SC-2: every diagram in every pack parses", async () => {
    const slugs = (await readdir(join(ROOT, "packs"), { withFileTypes: true }))
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
    let checked = 0;
    for (const slug of slugs) {
      const dir = join(ROOT, "packs", slug);
      const pack = await loadPackFile(join(dir, "pack.yaml"));
      const { diagrams } = await loadPackContent(pack, dir);
      await checkMermaid(diagrams);
      checked += diagrams.length;
    }
    // not vacuous: CCDV-F ships the Temperature and bee-loop diagrams (SC-6)
    expect(checked).toBeGreaterThanOrEqual(2);
  });
});

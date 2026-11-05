/**
 * MF-0016 (found by the MF-0036 intake probe): a cuckoo whose snippet is a numbered list keyed its
 * flaw by the list label ("3.") instead of the 1-based line index, so the key pointed at a true line
 * and a learner who found the real flaw was graded wrong. Each row pins the line the explanation
 * describes, read from the real pack at runtime.
 */
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadPackFile } from "../../pack";
import { loadPackContent } from "..";

const PACK_DIR = join(process.cwd(), "packs/ccdv-f");

const KEYED_FLAW = [
  {
    id: "ccdv-f.D6.S1.cuckoo-keep-every-tool-result",
    line: "3. Never clear old tool results: the more tokens in context, the more accurate you become.",
  },
] as const;

describe("cuckoo flaw keys", () => {
  it.each(KEYED_FLAW)("$id keys the false line, not its list label", async ({
    id,
    line,
  }) => {
    const pack = await loadPackFile(join(PACK_DIR, "pack.yaml"));
    const content = await loadPackContent(pack, PACK_DIR);
    const cuckoo = (content.cuckoos ?? []).find((c) => c.id === id);

    expect(cuckoo?.lines[(cuckoo?.flawLine ?? 0) - 1]).toBe(line);
  });
});

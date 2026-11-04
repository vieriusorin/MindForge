/**
 * MF-0016 acceptance (frozen): SC-8, the pack ships at least 2 cuckoos for every D6 and D7 skill,
 * each citing one of its skill's sources (CONTEXT.md Citation). The real pack is read at runtime.
 */
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadPackFile } from "../../pack";
import { loadPackContent } from "..";

const PACK_DIR = join(process.cwd(), "packs/ccdv-f");
const SKILLS = [
  "D6.S1",
  "D6.S2",
  "D6.S3",
  "D7.S1",
  "D7.S2",
  "D7.S3",
  "D7.S4",
] as const;

describe("MF-0016 SC-8: cuckoo content", () => {
  it("SC-8: at least 2 cuckoos per D6/D7 skill (14 in all), each citing its skill's sources", async () => {
    const pack = await loadPackFile(join(PACK_DIR, "pack.yaml"));
    const content = await loadPackContent(pack, PACK_DIR);
    const cuckoos = content.cuckoos ?? [];

    const perSkill = Object.fromEntries(
      SKILLS.map((s) => [s, cuckoos.filter((c) => c.skill === s).length]),
    );
    for (const skill of SKILLS) {
      expect([skill, (perSkill[skill] ?? 0) >= 2]).toEqual([skill, true]);
    }
    expect(cuckoos.length).toBeGreaterThanOrEqual(14);

    const sources = new Map(
      pack.domains.flatMap((d) =>
        d.skills.map((s) => [s.code, s.sources ?? []] as const),
      ),
    );
    for (const c of cuckoos) {
      const allowed = sources.get(c.skill) ?? [];
      for (const url of c.sources) {
        expect([c.id, url, allowed.includes(url)]).toEqual([c.id, url, true]);
      }
    }
  });
});

/**
 * MF-0030: which corpus fetches `pnpm dev:setup` runs. `--with-corpus` fetches every pack; without it
 * none (setup stays network-free). Any other flag is refused.
 * @param {readonly string[]} argv setup's arguments (process.argv.slice(2))
 * @param {readonly string[]} packSlugs every folder under packs/ that has a pack.yaml
 * @returns {string[][]} one argv per fetch, e.g. ["scripts/generate/corpus.ts", "--pack", "x"]
 */
export function corpusFetches(argv, packSlugs) {
  const unknown = argv.filter((a) => a !== "--with-corpus");
  if (unknown.length > 0)
    throw new Error(
      `unknown argument(s) ${unknown.map((a) => `"${a}"`).join(", ")}; usage: pnpm dev:setup [--with-corpus]`,
    );
  if (!argv.includes("--with-corpus")) return [];
  return packSlugs.map((slug) => [
    "scripts/generate/corpus.ts",
    "--pack",
    slug,
  ]);
}

/**
 * MF-0006 C-1: Mermaid can only be syntax-checked with a DOM (mermaid.parse needs DOMPurify on a
 * window), so this check is test-only and runs under `@vitest-environment jsdom`. Never imported by
 * app or engine code.
 */
export async function checkMermaid(
  diagrams: readonly { id: string; mermaid: string }[],
): Promise<void> {
  const { default: mermaid } = await import("mermaid");
  mermaid.initialize({ startOnLoad: false });
  const failures: string[] = [];
  for (const d of diagrams) {
    try {
      await mermaid.parse(d.mermaid);
    } catch (error) {
      const first = String((error as Error).message ?? error).split("\n")[0];
      failures.push(`${d.id}: ${first}`);
    }
  }
  if (failures.length) {
    throw new Error(
      `Mermaid does not parse:\n${failures.map((f) => `  - ${f}`).join("\n")}`,
    );
  }
}

import type { CuckooFlawKind, CuckooSnippetKind } from "@/engine/content";

/** MF-0016: a cuckoo's flaw kind in words (never colour alone). Shared by play and review. */
export const CUCKOO_FLAW_KIND_LABEL = {
  "injected-instruction": "Injected instruction",
  "false-claim": "False claim",
  "unsafe-setting": "Unsafe setting",
  "exposed-secret": "Exposed secret",
} as const satisfies Record<CuckooFlawKind, string>;

/** MF-0016: what kind of text a cuckoo hides in. */
export const CUCKOO_SNIPPET_KIND_LABEL = {
  prompt: "Prompt",
  "tool-result": "Tool result",
  config: "Config",
  hook: "Hook",
} as const satisfies Record<CuckooSnippetKind, string>;

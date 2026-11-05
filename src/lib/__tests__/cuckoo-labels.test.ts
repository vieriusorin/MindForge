import { describe, expect, it } from "vitest";
import {
  CUCKOO_FLAW_KIND_LABEL,
  CUCKOO_SNIPPET_KIND_LABEL,
} from "../cuckoo-labels";

describe("cuckoo labels", () => {
  it("words every flaw kind (MF-0016 SC-6 strings)", () => {
    expect(CUCKOO_FLAW_KIND_LABEL).toEqual({
      "injected-instruction": "Injected instruction",
      "false-claim": "False claim",
      "unsafe-setting": "Unsafe setting",
      "exposed-secret": "Exposed secret",
    });
  });

  it("words every snippet kind", () => {
    expect(CUCKOO_SNIPPET_KIND_LABEL).toEqual({
      prompt: "Prompt",
      "tool-result": "Tool result",
      config: "Config",
      hook: "Hook",
    });
  });
});

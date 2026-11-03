import { describe, expect, it } from "vitest";
import { mergeEnv } from "../../../scripts/lib/env-file.mjs";

const VALUES = {
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_local",
};

describe("MF-0018 mergeEnv", () => {
  it("SC-2a: an empty file gets exactly the given keys", () => {
    expect(mergeEnv("", VALUES)).toBe(
      "NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321\nNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_local\n",
    );
  });

  it("SC-2b: existing keys are updated in place; comments, blanks and other keys are kept in order", () => {
    const before = [
      "# my local settings",
      "MY_FLAG=on",
      "",
      "NEXT_PUBLIC_SUPABASE_URL=http://old.example",
      "OTHER=keep me",
      "",
    ].join("\n");
    expect(mergeEnv(before, VALUES)).toBe(
      [
        "# my local settings",
        "MY_FLAG=on",
        "",
        "NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321",
        "OTHER=keep me",
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_local",
        "",
      ].join("\n"),
    );
  });

  it("SC-2c: merging twice is a no-op the second time", () => {
    const once = mergeEnv("A=1\n", VALUES);
    expect(mergeEnv(once, VALUES)).toBe(once);
  });
});

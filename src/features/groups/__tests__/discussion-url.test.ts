/**
 * MF-0063 review finding 1: a link the regex and the DB CHECK accept but the WHATWG URL parser
 * rejects would save and then render nothing. The shared rule refuses it with the field error.
 */
import { describe, expect, it } from "vitest";
import { DiscussionUrl } from "../schemas";

const MESSAGE = "Use an https:// link, up to 500 characters.";

describe("DiscussionUrl refuses links the browser can't parse", () => {
  for (const url of [
    "https://example.com:99999",
    "https://chat.example.com:80800/c",
    "https://999.1.1.1",
    "https://1.2.3.4.5",
  ]) {
    it(url, () => {
      const result = DiscussionUrl.safeParse(url);
      expect(result.success).toBe(false);
      if (!result.success)
        expect(result.error.issues[0]?.message).toBe(MESSAGE);
    });
  }

  it("still accepts a port in range", () => {
    expect(DiscussionUrl.parse("https://example.com:65535/x")).toBe(
      "https://example.com:65535/x",
    );
  });
});

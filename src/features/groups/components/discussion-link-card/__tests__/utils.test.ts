import { describe, expect, it } from "vitest";
import { discussionLinkView } from "../utils";

describe("discussionLinkView", () => {
  it("no link → null (members see no card)", () => {
    expect(discussionLinkView(null)).toBeNull();
  });

  it("shows the host the link opens, port included", () => {
    expect(discussionLinkView("https://chat.example.com/c/1")).toEqual({
      href: "https://chat.example.com/c/1",
      host: "chat.example.com",
    });
    expect(discussionLinkView("https://example.com:8443/x?y=1#z")).toEqual({
      href: "https://example.com:8443/x?y=1#z",
      host: "example.com:8443",
    });
  });

  it("lower-cases the host as the browser will", () => {
    expect(discussionLinkView("https://Chat.Example.COM")?.host).toBe(
      "chat.example.com",
    );
  });

  it("a stored value that is not a URL → null, never a broken link", () => {
    expect(discussionLinkView("not a url")).toBeNull();
  });
});

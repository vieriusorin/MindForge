import { describe, expect, it } from "vitest";
import { InviteCode } from "@/lib/invite-code";

describe("InviteCode", () => {
  it("accepts the lowercase hex codes private.new_invite_code makes (32 chars)", () => {
    expect(
      InviteCode.safeParse("0123456789abcdef0123456789abcdef").success,
    ).toBe(true);
  });

  it("accepts 16 to 64 hex characters and nothing outside that", () => {
    expect(InviteCode.safeParse("a".repeat(16)).success).toBe(true);
    expect(InviteCode.safeParse("a".repeat(64)).success).toBe(true);
    expect(InviteCode.safeParse("a".repeat(15)).success).toBe(false);
    expect(InviteCode.safeParse("a".repeat(65)).success).toBe(false);
  });

  it("refuses uppercase, non-hex and anything that could reach a URL or query", () => {
    expect(InviteCode.safeParse("ABCDEF0123456789").success).toBe(false);
    expect(InviteCode.safeParse("zzzzzzzzzzzzzzzz").success).toBe(false);
    expect(InviteCode.safeParse("../../../etc/passwd").success).toBe(false);
  });
});

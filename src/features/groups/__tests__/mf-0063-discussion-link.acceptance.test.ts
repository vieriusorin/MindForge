/**
 * MF-0063 acceptance (frozen): the group's discussion link.
 * - SC-1: `DiscussionUrl` accepts https links (trimmed) and "" (→ null, clear); rejects every other
 *   scheme, user-info, whitespace and anything over 500 characters, with one message.
 * - SC-2: `setGroupDiscussionLink(input: unknown)` re-parses, authorizes, calls
 *   `set_group_discussion_url` and returns an ActionResult. Mocked at the facades (precedent:
 *   mf-0054-pin-actions).
 * Literals from .planning/tasks/MF-0063/GOAL.md.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const GROUP_ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const MESSAGE = "Use an https:// link, up to 500 characters.";
const NOT_ADMIN = "Only the group admin can change the discussion link.";
const FAILED = "Could not save the link. Try again.";

const { rpc, currentUser, refresh } = vi.hoisted(() => ({
  rpc: vi.fn(),
  currentUser: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ refresh }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirect ${to}`);
  },
}));
vi.mock("@/server/auth/current-user", () => ({
  getCurrentUser: currentUser,
}));
vi.mock("@/server/supabase/server", () => ({
  createServerSupabase: async () => ({ rpc }),
}));
vi.mock("@/server/packs/list-packs", () => ({ listPacks: async () => [] }));

async function schemas() {
  return import("@/features/groups/schemas");
}

async function actions() {
  return import("@/features/groups/actions");
}

const VALID = [
  "https://chat.example.com/c/1",
  "https://example.com",
  "https://example.com:8443/x?y=1#z",
];

const INVALID = [
  "http://example.com",
  "javascript:alert(1)",
  "HTTPS://example.com",
  "https://user@evil.example",
  "https://exa mple.com",
  "https://example.com/a b",
  "ftp://example.com",
  "example.com",
  `https://example.com/${"a".repeat(481)}`, // 501 characters
];

describe("MF-0063 SC-1: DiscussionUrl", () => {
  it("accepts https links as they are", async () => {
    const { DiscussionUrl } = await schemas();
    for (const url of VALID) expect(DiscussionUrl.parse(url)).toBe(url);
  });

  it("trims surrounding spaces", async () => {
    const { DiscussionUrl } = await schemas();
    expect(DiscussionUrl.parse("  https://example.com/c  ")).toBe(
      "https://example.com/c",
    );
  });

  it('turns "" and spaces into null (clear the link)', async () => {
    const { DiscussionUrl } = await schemas();
    expect(DiscussionUrl.parse("")).toBeNull();
    expect(DiscussionUrl.parse("   ")).toBeNull();
  });

  it("accepts exactly 500 characters", async () => {
    const { DiscussionUrl } = await schemas();
    const url = `https://example.com/${"a".repeat(480)}`;
    expect(url).toHaveLength(500);
    expect(DiscussionUrl.parse(url)).toBe(url);
  });

  it("rejects every other shape with the one message", async () => {
    const { DiscussionUrl } = await schemas();
    expect(INVALID.at(-1)).toHaveLength(501);
    for (const url of INVALID) {
      const result = DiscussionUrl.safeParse(url);
      expect(result.success, url).toBe(false);
      if (!result.success)
        expect(result.error.issues[0]?.message, url).toBe(MESSAGE);
    }
  });
});

beforeEach(() => {
  rpc.mockReset();
  refresh.mockReset();
  currentUser.mockReset();
  currentUser.mockResolvedValue({ id: "user-1", email: "a@example.com" });
});

describe("MF-0063 SC-2: setGroupDiscussionLink", () => {
  it("signed out → redirect to sign-in, no DB call", async () => {
    currentUser.mockResolvedValue(null);
    const { setGroupDiscussionLink } = await actions();
    await expect(
      setGroupDiscussionLink({ groupId: GROUP_ID, url: "https://example.com" }),
    ).rejects.toThrow(/redirect \/sign-in/);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("malformed input is refused without calling the database", async () => {
    const { setGroupDiscussionLink } = await actions();
    for (const bad of [
      { groupId: "not-a-uuid", url: "https://example.com" },
      { groupId: GROUP_ID, url: "https://example.com", extra: 1 },
      { groupId: GROUP_ID },
      null,
      "https://example.com",
    ]) {
      expect((await setGroupDiscussionLink(bad)).ok).toBe(false);
    }
    expect(rpc).not.toHaveBeenCalled();
  });

  it("a bad url comes back as the url field error", async () => {
    const { setGroupDiscussionLink } = await actions();
    const result = await setGroupDiscussionLink({
      groupId: GROUP_ID,
      url: "javascript:alert(1)",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.fieldErrors?.url).toBe(MESSAGE);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("saves the trimmed url, refreshes and returns ok", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    const { setGroupDiscussionLink } = await actions();
    const result = await setGroupDiscussionLink({
      groupId: GROUP_ID,
      url: "  https://chat.example.com/c/1 ",
    });
    expect(result).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("set_group_discussion_url", {
      p_group_id: GROUP_ID,
      p_url: "https://chat.example.com/c/1",
    });
    expect(refresh).toHaveBeenCalled();
  });

  it('"" clears the link (p_url null)', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    const { setGroupDiscussionLink } = await actions();
    expect(
      await setGroupDiscussionLink({ groupId: GROUP_ID, url: "" }),
    ).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("set_group_discussion_url", {
      p_group_id: GROUP_ID,
      p_url: null,
    });
  });

  it("DB 42501 (not the admin) → the admin-only message, no refresh", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: "42501", message: "only the group admin" },
    });
    const { setGroupDiscussionLink } = await actions();
    const result = await setGroupDiscussionLink({
      groupId: GROUP_ID,
      url: "https://example.com",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toBe(NOT_ADMIN);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("DB 23514 (CHECK) → the url field error", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: "23514", message: "check constraint" },
    });
    const { setGroupDiscussionLink } = await actions();
    const result = await setGroupDiscussionLink({
      groupId: GROUP_ID,
      url: "https://example.com",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.fieldErrors?.url).toBe(MESSAGE);
  });

  it("any other DB error → the generic message", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: "XX000", message: "boom" },
    });
    const { setGroupDiscussionLink } = await actions();
    const result = await setGroupDiscussionLink({
      groupId: GROUP_ID,
      url: "https://example.com",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toBe(FAILED);
  });
});

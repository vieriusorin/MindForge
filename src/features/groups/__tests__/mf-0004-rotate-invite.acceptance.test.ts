/**
 * MF-0004 acceptance (SC-9, action half): rotateInviteCode validates the group id and returns an
 * ActionResult, so a failed rotation is reported instead of looking like success.
 * Mocked at the facades: the session, the Supabase server client and next/cache.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const GROUP_ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirect ${to}`);
  },
}));
vi.mock("@/server/auth/current-user", () => ({
  getCurrentUser: async () => ({ id: "user-1", email: "a@example.com" }),
}));
vi.mock("@/server/supabase/server", () => ({
  createServerSupabase: async () => ({ rpc }),
}));
vi.mock("@/server/packs/list-packs", () => ({ listPacks: async () => [] }));

type Result = { ok: boolean; error?: unknown };

async function rotate(groupId: string): Promise<Result> {
  const { rotateInviteCode } = await import("@/features/groups/actions");
  return (await rotateInviteCode(groupId)) as unknown as Result;
}

beforeEach(() => {
  rpc.mockReset();
});

describe("MF-0004 rotateInviteCode", () => {
  it("SC-9: a refused rotation returns an error result with a message", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: "42501", message: "only the group admin can rotate" },
    });

    const result = await rotate(GROUP_ID);

    expect(result.ok).toBe(false);
    expect(typeof result.error).toBe("string");
    expect(String(result.error).length).toBeGreaterThan(0);
  });

  it("SC-9: a malformed group id is refused without calling the database", async () => {
    const result = await rotate("not-a-uuid");

    expect(result.ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("SC-9: a successful rotation returns ok", async () => {
    rpc.mockResolvedValue({ data: "a".repeat(32), error: null });

    const result = await rotate(GROUP_ID);

    expect(result.ok).toBe(true);
  });
});

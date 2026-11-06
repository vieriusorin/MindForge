/**
 * MF-0054 acceptance (frozen, SC-5): pinGroup / unpinGroup re-parse `unknown`, authorize, call the
 * DB's pin functions and return an ActionResult. Mocked at the facades: the session, the Supabase
 * server client, next/cache and next/navigation (precedent: mf-0004-rotate-invite).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const GROUP_ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const EVICTED_ID = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const { rpc, currentUser } = vi.hoisted(() => ({
  rpc: vi.fn(),
  currentUser: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
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

async function actions() {
  return import("@/features/groups/actions");
}

beforeEach(() => {
  rpc.mockReset();
  currentUser.mockReset();
  currentUser.mockResolvedValue({ id: "user-1", email: "a@example.com" });
});

describe("MF-0054 SC-5: pinGroup", () => {
  it("signed out → redirect to sign-in, no DB call", async () => {
    currentUser.mockResolvedValue(null);
    const { pinGroup } = await actions();
    await expect(pinGroup(GROUP_ID)).rejects.toThrow(/redirect \/sign-in/);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("a malformed id is refused without calling the database", async () => {
    const { pinGroup } = await actions();
    for (const bad of ["not-a-uuid", 42, null, { groupId: GROUP_ID }]) {
      const result = await pinGroup(bad);
      expect(result.ok).toBe(false);
    }
    expect(rpc).not.toHaveBeenCalled();
  });

  it("calls public.pin_group with the id and reports no eviction", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    const { pinGroup } = await actions();
    const result = await pinGroup(GROUP_ID);
    expect(rpc).toHaveBeenCalledWith("pin_group", { p_group_id: GROUP_ID });
    expect(result).toEqual({ ok: true, evicted: null });
  });

  it("reports the group whose pin was replaced", async () => {
    rpc.mockResolvedValue({
      data: [{ evicted_id: EVICTED_ID, evicted_name: "Night owls" }],
      error: null,
    });
    const { pinGroup } = await actions();
    expect(await pinGroup(GROUP_ID)).toEqual({
      ok: true,
      evicted: { id: EVICTED_ID, name: "Night owls" },
    });
  });

  it("a DB refusal (not a member) returns an error message, not ok", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: "42501", message: "not a member of this group" },
    });
    const { pinGroup } = await actions();
    const result = await pinGroup(GROUP_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.length).toBeGreaterThan(0);
  });
});

describe("MF-0054 SC-5: unpinGroup", () => {
  it("signed out → redirect to sign-in, no DB call", async () => {
    currentUser.mockResolvedValue(null);
    const { unpinGroup } = await actions();
    await expect(unpinGroup(GROUP_ID)).rejects.toThrow(/redirect \/sign-in/);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("a malformed id is refused without calling the database", async () => {
    const { unpinGroup } = await actions();
    expect((await unpinGroup("nope")).ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("calls public.unpin_group and returns ok", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    const { unpinGroup } = await actions();
    expect(await unpinGroup(GROUP_ID)).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("unpin_group", { p_group_id: GROUP_ID });
  });

  it("a DB error returns an error message, not ok", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: "XX000", message: "boom" },
    });
    const { unpinGroup } = await actions();
    const result = await unpinGroup(GROUP_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.length).toBeGreaterThan(0);
  });
});

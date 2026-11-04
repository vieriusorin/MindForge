import { describe, expect, it } from "vitest";
import { assertLocalSeedTarget } from "../guard";

const env = { MF_AUTHOR_EMAIL: "me@example.com" };

describe("assertLocalSeedTarget hosts", () => {
  it("accepts the IPv6 loopback", () => {
    expect(
      assertLocalSeedTarget({
        env,
        dbUrl: "postgresql://p:p@[::1]:54322/postgres",
      }).youEmail,
    ).toBe("me@example.com");
  });

  it("refuses 0.0.0.0 and a whitespace-only SUPABASE_DB_URL is treated as unset", () => {
    expect(() =>
      assertLocalSeedTarget({
        env,
        dbUrl: "postgresql://p:p@0.0.0.0:54322/postgres",
      }),
    ).toThrow(/local/i);
    expect(
      assertLocalSeedTarget({
        env: { ...env, SUPABASE_DB_URL: "  " },
        dbUrl: "postgresql://p:p@127.0.0.1:54322/postgres",
      }).youEmail,
    ).toBe("me@example.com");
  });
});

describe("assertLocalSeedTarget API URL (MF-0029 review note)", () => {
  it("refuses a remote Auth API even when the DB is local", () => {
    expect(() =>
      assertLocalSeedTarget({
        env,
        dbUrl: "postgresql://p:p@127.0.0.1:54322/postgres",
        apiUrl: "https://abcdefgh.supabase.co",
      }),
    ).toThrow(/local/i);
    expect(
      assertLocalSeedTarget({
        env,
        dbUrl: "postgresql://p:p@127.0.0.1:54322/postgres",
        apiUrl: "http://127.0.0.1:54321",
      }).youEmail,
    ).toBe("me@example.com");
  });
});

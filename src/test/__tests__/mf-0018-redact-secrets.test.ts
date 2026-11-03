import { describe, expect, it } from "vitest";
import { redactSecrets } from "../../../scripts/lib/redact-secrets.mjs";

const R = "<redacted>";

describe("MF-0018 redactSecrets", () => {
  it("redacts every key/secret field of a `supabase start` JSON line and keeps the URLs", () => {
    const line = JSON.stringify({
      API_URL: "http://127.0.0.1:54321",
      PUBLISHABLE_KEY: "sb_publishable_abcdefghijklmnop",
      SECRET_KEY: "sb_secret_abcdefghijklmnop",
      JWT_SECRET: "super-secret-jwt-token-with-at-least-32-characters-long",
      ANON_KEY: "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.c2lnbmF0dXJl",
      SERVICE_ROLE_KEY: "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic3IifQ.c2lnbmF0dXJl",
      S3_PROTOCOL_ACCESS_KEY_ID: "625729a08b95bf1b7ff351a663f3a23c",
      S3_PROTOCOL_ACCESS_KEY_SECRET: "850181e4652dd023b7a98c58ae0d2d34",
      S3_PROTOCOL_REGION: "local",
    });
    expect(JSON.parse(redactSecrets(line))).toEqual({
      API_URL: "http://127.0.0.1:54321",
      PUBLISHABLE_KEY: R,
      SECRET_KEY: R,
      JWT_SECRET: R,
      ANON_KEY: R,
      SERVICE_ROLE_KEY: R,
      S3_PROTOCOL_ACCESS_KEY_ID: R,
      S3_PROTOCOL_ACCESS_KEY_SECRET: R,
      S3_PROTOCOL_REGION: "local",
    });
  });

  it("redacts labelled values in the human-readable formats", () => {
    expect(redactSecrets("│ Secret      │ sb_secret_abcdefghijklmnop │")).toBe(
      `│ Secret      │ ${R} │`,
    );
    expect(
      redactSecrets(
        "service_role key: eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic3IifQ.c2ln",
      ),
    ).toBe(`service_role key: ${R}`);
    expect(
      redactSecrets(
        "        JWT secret: super-secret-jwt-token-with-at-least-32-characters-long",
      ),
    ).toBe(`        JWT secret: ${R}`);
    expect(
      redactSecrets("   S3 Secret Key: 850181e4652dd023b7a98c58ae0d2d34"),
    ).toBe(`   S3 Secret Key: ${R}`);
  });

  it("leaves lines without credentials untouched", () => {
    for (const line of [
      "Stopped services: [supabase_imgproxy_mind-forge supabase_pooler_mind-forge]",
      "         API URL: http://127.0.0.1:54321",
      "Pulling image public.ecr.aws/supabase/postgres:17.4.1.054...",
      "Started supabase local development setup.",
      "",
    ]) {
      expect(redactSecrets(line)).toBe(line);
    }
  });
});

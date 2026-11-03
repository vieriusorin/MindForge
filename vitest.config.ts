import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const DB_TESTS = "src/**/__tests__/**/*.db.*test.ts";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["src/**/__tests__/**/*.test.ts"],
          exclude: [DB_TESTS],
        },
      },
      {
        // MF-0002: needs the local Supabase stack (`supabase start`). Run with `pnpm test:db`.
        extends: true,
        test: {
          name: "db",
          include: [DB_TESTS],
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});

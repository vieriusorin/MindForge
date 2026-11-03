// PT-0353: which databases `pnpm report:planificare` may read (C-1, user 2026-10-24). Plain JS so
// the launcher can refuse a target BEFORE it spawns `env-run` — nothing connects to a refused one.
// `local` is the developer stack, a clone of production; staging and prod are never reachable.

/** @type {readonly ["test", "local"]} */
export const REPORT_ENV_TARGETS = Object.freeze(["test", "local"]);

/**
 * The `--env=` value of an argv, defaulting to the test stack.
 * @param {readonly string[]} argv
 * @returns {{ ok: true, env: "test" | "local" } | { ok: false, error: string }}
 */
export const reportEnvFrom = (argv) => {
  const flag = argv.find((arg) => arg.startsWith("--env="));
  const value = flag === undefined ? "test" : flag.slice("--env=".length);
  if (value === "test" || value === "local") return { ok: true, env: value };
  return {
    ok: false,
    error: `--env must be one of: ${REPORT_ENV_TARGETS.join(", ")} (got "${value}")`,
  };
};

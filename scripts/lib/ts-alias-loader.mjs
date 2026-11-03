// PT-0353: run the app's own TypeScript services from a terminal script without a bundler.
//
// Node 24 executes `.ts` natively (`--experimental-transform-types` — strip-only mode rejects the
// parameter property in `src/lib/temporal.ts`), but it resolves neither the `@/` alias nor the
// extensionless relative imports the app is written with; Next and Vitest do that for it. This
// resolve hook does exactly those three things and nothing else:
//   `@/x`            -> `<repo>/src/x(.ts|.tsx|/index.ts)`
//   `./x` from src   -> `./x(.ts|.tsx|/index.ts)`
//   bare `pkg/sub`   -> retried as `pkg/sub.js` (e.g. `next/navigation`, which has no exports map)
// Registered by `ts-alias-register.mjs`; used as `node --import <register> <script>.ts`.
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const SRC = path.join(REPO_ROOT, "src");

const fileFor = (base) => {
  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, "index.ts"),
  ]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
};

const within = (dir, file) => file === dir || file.startsWith(dir + path.sep);

// Only the repo's own sources get extension probing — never a package under node_modules.
const isRepoSource = (parentURL) => {
  if (!parentURL?.startsWith("file:")) return false;
  const file = fileURLToPath(parentURL);
  return (
    within(REPO_ROOT, file) &&
    !file.includes(`${path.sep}node_modules${path.sep}`)
  );
};

export async function resolve(specifier, context, nextResolve) {
  let base = null;
  if (specifier.startsWith("@/")) {
    base = path.resolve(SRC, specifier.slice(2));
    if (!within(SRC, base))
      throw new Error(`ts-alias-loader: "${specifier}" escapes src/`);
  } else if (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    isRepoSource(context.parentURL)
  ) {
    base = path.resolve(
      path.dirname(fileURLToPath(context.parentURL)),
      specifier,
    );
  }
  if (base) {
    const file = fileFor(base);
    if (file) return nextResolve(pathToFileURL(file).href, context);
  }
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    const bare =
      !specifier.startsWith(".") &&
      !specifier.startsWith("/") &&
      !specifier.includes(":");
    if (
      error?.code === "ERR_MODULE_NOT_FOUND" &&
      bare &&
      !specifier.endsWith(".js")
    ) {
      return nextResolve(`${specifier}.js`, context);
    }
    throw error;
  }
}

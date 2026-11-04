// MF-0012: lets the plain-node sync script import the app's TypeScript loaders (src/engine/**)
// with Node's built-in type stripping (engines.node >= 24), no extra dependency. The engine
// writes extensionless relative imports (`./schema`), which Node ESM won't resolve on its own.
// Registered with `module.register` from validate-packs.mjs.
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const EXTENSIONLESS_RELATIVE = /^\.{1,2}\/(?!.*\.[cm]?[jt]s$)/;

export async function resolve(specifier, context, nextResolve) {
  if (
    EXTENSIONLESS_RELATIVE.test(specifier) &&
    context.parentURL?.endsWith(".ts")
  ) {
    for (const suffix of [".ts", "/index.ts"]) {
      const url = new URL(specifier + suffix, context.parentURL);
      if (existsSync(fileURLToPath(url))) {
        return {
          url: url.href,
          format: "module-typescript",
          shortCircuit: true,
        };
      }
    }
  }
  const resolved = await nextResolve(specifier, context);
  // The package has no "type", so tell Node these are ES modules instead of letting it re-parse.
  return resolved.url.endsWith(".ts")
    ? { ...resolved, format: "module-typescript" }
    : resolved;
}

import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * MF-0018: the project-pinned Supabase CLI (devDependency `supabase`), so nobody needs a global
 * install. Falls back to `supabase` on PATH only if node_modules is missing.
 * @param {string} root repo root
 * @returns {string}
 */
export function supabaseBin(root) {
  const local = join(
    root,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "supabase.cmd" : "supabase",
  );
  return existsSync(local) ? local : "supabase";
}

import { existsSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

/**
 * MF-0018: the project-pinned Supabase CLI (devDependency `supabase`), so nobody needs a global
 * install. Falls back to `supabase` on PATH only if node_modules is missing.
 *
 * On Windows this returns the native `supabase.exe` from the `@supabase/cli-windows-*` package,
 * not the `.bin/supabase.cmd` shim: since the CVE-2024-27980 fix, Node refuses to spawn a
 * `.cmd`/`.bat` without `shell: true` (`spawn EINVAL`), and a shell would re-parse the args.
 * @param {string} root repo root
 * @returns {string}
 */
export function supabaseBin(root) {
  if (process.platform === "win32") {
    const pkg = join(root, "node_modules", "supabase", "package.json");
    if (existsSync(pkg)) {
      try {
        // realpath: under pnpm the platform package is a sibling inside .pnpm, not under root
        const cli = createRequire(realpathSync(pkg)).resolve(
          `@supabase/cli-windows-${process.arch}/package.json`,
        );
        const exe = join(dirname(cli), "bin", "supabase.exe");
        if (existsSync(exe)) return exe;
      } catch {
        // platform package not installed: fall through to PATH
      }
    }
    return "supabase";
  }
  const local = join(root, "node_modules", ".bin", "supabase");
  return existsSync(local) ? local : "supabase";
}

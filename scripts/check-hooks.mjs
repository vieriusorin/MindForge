#!/usr/bin/env node
/**
 * MF-0001 SC-8: every hook wired in .claude/settings.json loads and runs in THIS repo.
 *  1. every relative import under .claude/hooks resolves to an existing file;
 *  2. every hook command exits 0 with empty stderr on a sample input for its event.
 * Exit 1 on any failure. Usage: node scripts/check-hooks.mjs
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// MF-0023: `new URL(...).pathname` is `/C:/…` on Windows, which `resolve` turned into `C:\C:\…`.
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];

// 1. imports
const walk = (dir) =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith(".mjs") ? [p] : [];
  });
let importCount = 0;
for (const file of walk(join(ROOT, ".claude/hooks"))) {
  for (const m of readFileSync(file, "utf8").matchAll(
    /^\s*import[^"']*["'](\.{1,2}\/[^"']+)["']/gm,
  )) {
    importCount++;
    const target = resolve(dirname(file), m[1]);
    if (!existsSync(target))
      failures.push(`import ${m[1]} in ${relative(ROOT, file)} → missing`);
  }
}
console.log(`imports: ${importCount} relative imports checked`);

// 2. commands
const settings = JSON.parse(
  readFileSync(join(ROOT, ".claude/settings.json"), "utf8"),
);
const session = `check-hooks-${process.pid}`;
const sample = (event, matcher) => {
  if (event === "PreToolUse" || event === "PostToolUse") {
    const tool = (matcher ?? "Edit").split("|")[0];
    return tool === "Bash"
      ? {
          hook_event_name: event,
          session_id: session,
          tool_name: "Bash",
          tool_input: { command: "true" },
        }
      : {
          hook_event_name: event,
          session_id: session,
          tool_name: tool,
          tool_input: {
            file_path: join(ROOT, "src/engine/forest/tree-stage.ts"),
          },
        };
  }
  return {
    hook_event_name: event,
    session_id: session,
    stop_hook_active: false,
  };
};
let commandCount = 0;
for (const [event, groups] of Object.entries(settings.hooks ?? {})) {
  for (const group of groups) {
    for (const hook of group.hooks) {
      commandCount++;
      // biome-ignore lint/suspicious/noTemplateCurlyInString: the literal placeholder text used in settings.json
      const cmd = hook.command.replaceAll("${CLAUDE_PROJECT_DIR:-.}", ROOT);
      const r = spawnSync("sh", ["-c", cmd], {
        cwd: ROOT,
        input: JSON.stringify(sample(event, group.matcher)),
        encoding: "utf8",
        env: { ...process.env, CLAUDE_PROJECT_DIR: ROOT },
        timeout: (hook.timeout ?? 60) * 1000,
      });
      const name = `${event}${group.matcher ? `[${group.matcher}]` : ""} ${cmd.split("/").pop()}`;
      const ok = r.status === 0 && !r.stderr.trim();
      console.log(
        `${ok ? "ok  " : "FAIL"} ${name} exit=${r.status}${r.stderr.trim() ? ` stderr=${r.stderr.trim().split("\n")[0]}` : ""}`,
      );
      if (!ok) failures.push(name);
    }
  }
}
console.log(`commands: ${commandCount} hook commands run`);

if (failures.length) {
  console.error(`\nFAILED:\n${failures.map((f) => `  - ${f}`).join("\n")}`);
  process.exit(1);
}
console.log("check-hooks: PASS");

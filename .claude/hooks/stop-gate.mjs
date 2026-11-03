#!/usr/bin/env node
/**
 * Stop: Claude may not end a turn on a red toolchain it did not report.
 *
 * Runs only when THIS session changed a source file since the last green run (see
 * `track-changes.mjs`); a pure conversation turn costs nothing. Then, in parallel:
 *
 *   typecheck   `pnpm typecheck` (four tsc layers; ~1 s warm)       when a TS file or tsconfig changed
 *   gates       every `gate:*` in package.json except client-bundle (needs a production build; CI runs it)
 *   lint        biome lint (errors) + eslint --quiet on the changed files only
 *   tests       cheap tier: changed test files + the changed files' co-located __tests__
 *               full tier:  `vitest related` over the changed files, when the session's ticket
 *                           GOAL.md is at `stage: test|handoff|watch`
 *   frozen      a frozen acceptance test this session changed must still match its sha256
 *
 * Decision table: `decideStop` in lib/gate-core.mjs. Red blocks the stop up to CAP times, then
 * releases with a RED banner to the user — never silently. Green prints a one-line banner, which is
 * what a reviewer reads instead of trusting "all green" in prose.
 *
 * What stays red-but-not-blocking, and is always printed:
 *   - a frozen acceptance test of a ticket before its TEST stage (red is the TDD contract there)
 *   - a test that could not reach the database (the stack is down: NOT VERIFIED, never a pass)
 *
 * Off switch for one session: MF_STOP_GATE=off.
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, rmSync, writeSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  classifyTestResults,
  colocatedTests,
  decideStop,
  fullVerificationIn,
  isRelevantSource,
  parseTscErrors,
  redAllowedIn,
  unverifiedFiles,
} from "./lib/gate-core.mjs";
import {
  loadState,
  mtimeOf,
  ROOT,
  readFrozenManifests,
  readStdinJson,
  saveState,
} from "./lib/gate-io.mjs";

const CAP = 2;
const BIN = join(ROOT, "node_modules", ".bin");

/** @returns {Promise<{ code: number | null, out: string }>} */
function run(cmd, args, timeoutMs, extraEnv = {}) {
  return new Promise((resolve) => {
    // Its own process group, so a timeout kills the whole tree (e.g. vitest and its workers).
    const child = spawn(cmd, args, {
      cwd: ROOT,
      detached: true,
      env: {
        ...process.env,
        ...extraEnv,
        PATH: `${BIN}:${process.env.PATH}`,
        FORCE_COLOR: "0",
        NO_COLOR: "1",
      },
    });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    const timer = setTimeout(() => {
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch {
        child.kill("SIGKILL");
      }
    }, timeoutMs);
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, out });
    });
    child.on("error", (e) => {
      clearTimeout(timer);
      resolve({ code: 1, out: String(e) });
    });
  });
}

const tail = (text, n) => text.trim().split("\n").slice(-n).join("\n");
const sha256 = (rel) =>
  createHash("sha256")
    .update(readFileSync(join(ROOT, rel)))
    .digest("hex");
const listDir = (dir) => {
  try {
    return readdirSync(join(ROOT, dir));
  } catch {
    return [];
  }
};

async function main() {
  if (process.env.MF_STOP_GATE === "off") return;
  const input = readStdinJson();
  if (!input) return;
  const sessionId = input.session_id;
  const state = loadState(sessionId);

  const current = Object.fromEntries(Object.keys(state.touched).map((p) => [p, mtimeOf(p)]));
  const relevant = unverifiedFiles(
    Object.fromEntries(Object.entries(state.touched).filter(([p]) => isRelevantSource(p))),
    state.verified,
    current,
  );
  const live = relevant.filter((p) => current[p] !== -1);
  if (relevant.length === 0) return;
  // Already reported RED for exactly this state: the user has the banner; do not loop on it.
  if (state.releasedAt && relevant.every((p) => state.releasedAt[p] === current[p])) return;

  // ── The session's tickets: any .planning/tasks/<ID>/ file it touched.
  const manifests = readFrozenManifests();
  const sessionTickets = new Set(
    Object.keys(state.touched)
      .map((p) => /^\.planning\/tasks\/([^/]+)\//.exec(p)?.[1])
      .filter(Boolean),
  );
  const mine = manifests.filter((m) => sessionTickets.has(m.ticket));
  const full = mine.some((m) => fullVerificationIn(m.stage));
  const expectedRed = new Set(
    manifests
      .filter((m) => m.active && redAllowedIn(m.stage))
      .flatMap((m) => m.files.map((f) => f.path)),
  );

  // ── Frozen integrity: a frozen test THIS session changed must still match its manifest.
  const tampered = [];
  for (const m of manifests.filter((x) => x.active)) {
    for (const f of m.files) {
      if (!(f.path in state.touched)) continue;
      if (!existsSync(join(ROOT, f.path)) || sha256(f.path) !== f.sha256) {
        tampered.push(`${f.path} (${m.ticket})`);
      }
    }
  }

  // ── Launch everything in parallel.
  const tsTouched = live.some((p) => /\.(ts|tsx|mts|cts)$|^tsconfig[^/]*\.json$/.test(p));
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  const gates = Object.entries(pkg.scripts ?? {})
    .filter(([k]) => k.startsWith("gate:") && k !== "gate:client-bundle")
    .map(([name, cmd]) => ({ name, argv: cmd.split(" ") }));
  const lintable = live.filter((p) => /\.(ts|tsx|js|jsx|mjs|cjs|json|css)$/.test(p));
  const eslintable = live.filter((p) => /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(p));
  const testTargets = full
    ? live.filter((p) => /^(src|scripts)\//.test(p))
    : colocatedTests(live, (p) => existsSync(join(ROOT, p)), listDir).filter(
        (p) => !p.startsWith("e2e/"),
      );
  const report = join(
    tmpdir(),
    `claude-mf-gate-vitest-${String(sessionId).replace(/\W/g, "")}.json`,
  );
  rmSync(report, { force: true });

  const lockAskedAt = Date.now();
  const [tsc, gateRuns, biome, eslint, vitest] = await Promise.all([
    tsTouched ? run("pnpm", ["run", "typecheck"], 300_000) : null,
    Promise.all(
      gates.map(async (g) => ({ ...g, ...(await run(g.argv[0], g.argv.slice(1), 120_000)) })),
    ),
    lintable.length
      ? run(
          "biome",
          [
            "lint",
            "--diagnostic-level=error",
            "--no-errors-on-unmatched",
            "--files-ignore-unknown=true",
            ...lintable,
          ],
          120_000,
        )
      : null,
    eslintable.length && existsSync(join(BIN, "eslint"))
      ? run("eslint", ["--quiet", "--no-warn-ignored", ...eslintable], 180_000)
      : null,
    testTargets.length
      ? // MF-0001: no shared test DB here (yet), so vitest runs directly.
        run(
          "vitest",
          [
            full ? "related" : "run",
            "--run",
            "--passWithNoTests",
            "--reporter=json",
            `--outputFile=${report}`,
            ...testTargets,
          ],
          540_000,
        )
      : null,
  ]);

  // ── Assemble.
  const blocking = [];
  const notes = [];
  const done = [];

  if (tampered.length) {
    blocking.push(
      `FROZEN TEST CHANGED without a re-freeze — the acceptance contract moved:\n${tampered.map((t) => `  - ${t}`).join("\n")}\n  Restore it, or ask the user and re-freeze (new sha256 + a reason in FROZEN.json \`history\`).`,
    );
  }
  if (tsc) {
    if (tsc.code === 0) done.push("typecheck");
    else {
      const errs = parseTscErrors(tsc.out);
      const lines = errs.length
        ? errs
            .slice(0, 30)
            .map(
              (e) =>
                `  ${e.file}:${e.line} ${e.code} ${e.message}${e.file in state.touched ? "" : "  [file not touched by this session]"}`,
            )
        : [tail(tsc.out, 25)];
      blocking.push(`TYPECHECK failed (${errs.length} error(s)):\n${lines.join("\n")}`);
    }
  }
  const redGates = gateRuns.filter((g) => g.code !== 0);
  if (redGates.length) {
    for (const g of redGates) blocking.push(`${g.name.toUpperCase()} failed:\n${tail(g.out, 25)}`);
  } else done.push(`${gateRuns.length} gates`);
  if (biome) {
    if (biome.code === 0) done.push(`biome (${lintable.length} files)`);
    else blocking.push(`BIOME LINT errors in changed files:\n${tail(biome.out, 30)}`);
  }
  if (eslint) {
    if (eslint.code === 0) done.push(`eslint (${eslintable.length} files)`);
    else blocking.push(`ESLINT errors in changed files:\n${tail(eslint.out, 30)}`);
  }
  // Tests that never ran prove nothing: the turn is not blocked, but it is not green either, and
  // the files are NOT recorded as verified, so the next turn runs them again (review B2).
  const testsDidNotRun = false;
  if (vitest) {
    let parsed = null;
    try {
      parsed = JSON.parse(readFileSync(report, "utf8"));
    } catch {
      blocking.push(
        `VITEST did not produce a report (exit ${vitest.code}):\n${tail(vitest.out, 25)}`,
      );
    }
    if (parsed) {
      const c = classifyTestResults(parsed, ROOT, expectedRed);
      const tier = full ? "full related set" : "co-located tier";
      if (c.blocking.length)
        blocking.push(
          `TESTS failed (${tier}):\n${c.blocking
            .slice(0, 25)
            .map((l) => `  - ${l}`)
            .join("\n")}`,
        );
      else done.push(`${c.passed} tests (${tier}, ${parsed.testResults?.length ?? 0} files)`);
      if (c.expected.length)
        notes.push(
          `acceptance tests still red (expected before stage: test):\n${c.expected.map((l) => `  - ${l}`).join("\n")}`,
        );
      if (c.infra.length)
        notes.push(
          `NOT VERIFIED — the test stack refused connections (pnpm db:test:start):\n${c.infra.map((l) => `  - ${l}`).join("\n")}`,
        );
    }
  } else if (!full) {
    notes.push(
      "no co-located tests for the changed files (the full related set runs at stage: test)",
    );
  }

  const decision = decideStop({ red: blocking.length > 0, blocks: state.blocks, cap: CAP });
  const noteText = notes.length ? `\n${notes.map((n) => `• ${n}`).join("\n")}` : "";

  if (decision === "pass") {
    if (!testsDidNotRun) for (const p of relevant) state.verified[p] = current[p];
    state.blocks = 0;
    state.releasedAt = null;
    saveState(sessionId, state);
    writeSync(
      1,
      JSON.stringify({
        systemMessage: testsDidNotRun
          ? `⚠ Stop gate NOT green — tests did not run (test DB busy); nothing else failed: ${done.join(" · ")} — ${live.length} changed file(s)${noteText}`
          : `✓ Stop gate green: ${done.join(" · ")} — ${live.length} changed file(s)${noteText}`,
      }),
    );
    return;
  }

  const body = blocking.join("\n\n");
  if (decision === "block") {
    state.blocks += 1;
    saveState(sessionId, state);
    writeSync(
      1,
      JSON.stringify({
        decision: "block",
        reason: `MindForge Stop gate — RED (attempt ${state.blocks}/${CAP}). Fix these before ending the turn. If a failure is outside your change (a file you never touched, another session's work, a calendar-dependent test), do not edit around it: say so explicitly to the user, naming the file.\n\n${body}${noteText}`,
      }),
    );
    return;
  }

  state.blocks = 0;
  state.releasedAt = Object.fromEntries(relevant.map((p) => [p, current[p]]));
  saveState(sessionId, state);
  writeSync(
    1,
    JSON.stringify({
      systemMessage: `✗ Stop gate RED — released after ${CAP} attempts. This turn did NOT end green:\n\n${body}${noteText}`,
    }),
  );
}

main()
  .catch(() => {
    // A crashed gate must not trap the session; CI and `pnpm verify` remain the backstop.
  })
  .finally(() => process.exit(0));

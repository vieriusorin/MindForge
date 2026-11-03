/**
 * PT-0352 — the pure half of `pnpm ticket:verify`: what a receipt is, when it is stale, what the
 * verdict is, and when a loop should stop. No I/O, so `pt0352-receipts.acceptance.test.ts` can
 * assert every decision.
 *
 * The idea: an agent never writes "green". It runs `ticket:verify`, the SCRIPT runs the checks and
 * appends a receipt bound to a hash of the diff. "Done" means the latest receipt is PASS and its
 * hash is the tree's hash right now. Change one byte afterwards and the receipt is stale.
 */
import { createHash } from "node:crypto";

const sha256 = (text) => createHash("sha256").update(text).digest("hex");

/** Files that make up a ticket's change. Planning, evidence and build output cannot change behaviour. */
const NOT_TICKET_RE =
  /^(\.planning|node_modules|\.next|\.claude\/worktrees|coverage|test-results|playwright-report)\//;

/** @param {string} rel repo-relative POSIX path */
export function isTicketFile(rel) {
  return !NOT_TICKET_RE.test(rel);
}

/**
 * One hash for the whole change: sorted `path\0sha` lines, so listing order cannot matter and a
 * deleted file (sha256 null) differs from an unchanged one.
 * @param {{ path: string, sha256: string | null }[]} entries
 */
export function diffHash(entries) {
  const lines = entries
    .map((e) => `${e.path}\0${e.sha256 ?? "deleted"}`)
    .sort()
    .join("\n");
  return sha256(lines);
}

/**
 * `status` is one of pass · fail · skip · infra · preexisting. Typed as `string` because receipts
 * are read back from JSON, where a literal union cannot be trusted anyway.
 * @typedef {{ id: string, required: boolean, status: string, failures: string[],
 *   newFailures?: string[] }} Check
 */

/**
 * Checks that are judged on their own, never against a baseline. The frozen acceptance tests are
 * red at baseline BY DESIGN — comparing them would turn "still red after the build" into
 * `preexisting` and pass a ticket where nothing was built (PT-0352 review, blocking 1).
 */
export const ABSOLUTE_CHECKS = new Set([
  "frozen-integrity",
  "acceptance",
  "acceptance-e2e",
  "tree-stable",
  "receipt-chain",
]);

/**
 * Splits "red because of this change" from "red before it started". A check that fails now is
 * `preexisting` when the baseline had the same check red and no failure is new. A check with no
 * itemised failures (a gate prints prose) is preexisting only when it was red in the baseline too.
 * `ABSOLUTE_CHECKS` are never compared.
 * @param {Check[]} checks
 * @param {Check[] | null} baseline
 * @returns {Check[]}
 */
export function compareToBaseline(checks, baseline) {
  const before = new Map((baseline ?? []).map((c) => [c.id, c]));
  return checks.map((c) => {
    if (c.status !== "fail") return { ...c, newFailures: [] };
    if (ABSOLUTE_CHECKS.has(c.id)) return { ...c, newFailures: c.failures };
    const b = before.get(c.id);
    if (!b || (b.status !== "fail" && b.status !== "preexisting")) {
      return { ...c, newFailures: c.failures };
    }
    const old = new Set(b.failures);
    const fresh = c.failures.filter((f) => !old.has(f));
    if (fresh.length === 0)
      return { ...c, status: "preexisting", newFailures: [] };
    return { ...c, newFailures: fresh };
  });
}

/**
 * FAIL if anything required or optional is newly red; INCOMPLETE if a required check did not run
 * (skipped, or the test database refused connections); PASS otherwise. "Green because it did not
 * run" is exactly the false pass this exists to prevent.
 * @param {Check[]} checks
 * @returns {"PASS" | "FAIL" | "INCOMPLETE"}
 */
export function verdictOf(checks) {
  if (checks.some((c) => c.status === "fail")) return "FAIL";
  if (
    checks.some(
      (c) => c.required && (c.status === "skip" || c.status === "infra"),
    )
  ) {
    return "INCOMPLETE";
  }
  return "PASS";
}

/** Stable keys for the stop rule: `checkId::failure`, or `checkId::*` for an un-itemised failure. */
export function failureKeys(checks) {
  return checks
    .filter((c) => c.status === "fail")
    .flatMap((c) => {
      const items = c.newFailures ?? c.failures;
      return items.length ? items.map((f) => `${c.id}::${f}`) : [`${c.id}::*`];
    });
}

/**
 * @param {{ diff_hash: string } | null} latest
 * @param {string} currentHash
 * @returns {"none" | "current" | "stale"}
 */
export function receiptStatus(latest, currentHash) {
  if (!latest) return "none";
  return latest.diff_hash === currentHash ? "current" : "stale";
}

/**
 * A receipt line carries the sha256 of the line before it. Editing any earlier line breaks every
 * link after it, so a hand-edited "PASS" is visible to anyone who re-reads the file.
 * @param {string | null} prevLine
 * @param {object} receipt
 */
export function chainLine(prevLine, receipt) {
  return JSON.stringify({
    ...receipt,
    prev: prevLine === null ? null : sha256(prevLine),
  });
}

/**
 * @param {string[]} lines
 * @returns {{ ok: boolean, brokenAt: number | null }} 0-based index of the first line whose `prev`
 *   does not match the line before it
 */
export function verifyChain(lines) {
  for (let i = 0; i < lines.length; i++) {
    let prev;
    try {
      prev = JSON.parse(lines[i]).prev;
    } catch {
      return { ok: false, brokenAt: i };
    }
    const expected = i === 0 ? null : sha256(lines[i - 1]);
    if (prev !== expected) return { ok: false, brokenAt: i };
  }
  return { ok: true, brokenAt: null };
}

/**
 * When an unattended loop stops, as a closed table over its verify receipts (baselines excluded):
 *   last verify PASS                                   -> done
 *   verify count >= maxIterations                      -> budget
 *   last `sameFailureLimit` verifies all FAIL and share a failure key -> stuck (no progress)
 *   otherwise                                          -> continue
 * @param {{ kind: string, verdict: string, failure_keys?: string[] }[]} receipts oldest first
 * @param {{ maxIterations: number, sameFailureLimit?: number }} opts
 * @returns {"done" | "continue" | "stuck" | "budget"}
 */
export function stopRule(receipts, { maxIterations, sameFailureLimit = 2 }) {
  const verifies = receipts.filter((r) => r.kind === "verify");
  if (verifies.length === 0) return "continue";
  if (verifies.at(-1).verdict === "PASS") return "done";
  if (verifies.length >= maxIterations) return "budget";
  const lastN = verifies.slice(-sameFailureLimit);
  if (
    lastN.length === sameFailureLimit &&
    lastN.every((r) => r.verdict === "FAIL")
  ) {
    const [first, ...rest] = lastN.map((r) => new Set(r.failure_keys ?? []));
    for (const key of first) if (rest.every((s) => s.has(key))) return "stuck";
  }
  return "continue";
}

/**
 * Vitest JSON report -> one failure key per failed assertion (`file > full name`), plus whether
 * the failure was the test database being down, which is NOT VERIFIED rather than red.
 * @param {any} report
 * @param {string} root
 */
export function testFailures(report, root) {
  const failures = [];
  let infra = false;
  let passed = 0;
  for (const file of report?.testResults ?? []) {
    const rel = file.name?.startsWith(root)
      ? file.name.slice(root.length + 1)
      : file.name;
    const asserts = file.assertionResults ?? [];
    passed += asserts.filter((a) => a.status === "passed").length;
    const failed = asserts.filter((a) => a.status === "failed");
    const text = [
      file.message ?? "",
      ...failed.flatMap((a) => a.failureMessages ?? []),
    ].join("\n");
    if (/ECONNREFUSED|Connection terminated unexpectedly/.test(text))
      infra = true;
    for (const a of failed) failures.push(`${rel} > ${a.fullName}`);
    if (file.status === "failed" && failed.length === 0) {
      failures.push(
        `${rel} > (suite failed to run) ${(file.message ?? "").split("\n")[0].slice(0, 160)}`,
      );
    }
  }
  return { failures, infra, passed };
}

/**
 * Prose output (a gate, biome, eslint) -> failure items, so a check that was already red at
 * baseline still shows a NEW violation as new (PT-0352 review, blocking 3). Items are the lines
 * that name a repo path, with line/column numbers and durations stripped so an unrelated edit
 * that shifts lines does not invent a "new" failure. Output naming no path collapses to one item
 * keyed on its digit-free text.
 * @param {string} out
 * @returns {string[]}
 */
export function itemiseOutput(out) {
  const items = [];
  for (const raw of out.split("\n")) {
    const line = raw.trim();
    if (
      !/\b(src|scripts|e2e|drizzle|supabase|\.claude)\/[\w@.[\]()/-]+/.test(
        line,
      )
    )
      continue;
    items.push(
      line
        .replace(/[:(]\d+(?:[:,]\d+)?\)?/g, "")
        .replace(/\b\d+(\.\d+)?\s?(ms|s)\b/g, "")
        .slice(0, 240),
    );
  }
  if (items.length === 0 && out.trim()) {
    items.push(
      `output:${sha256(out.replace(/\d+/g, "#").replace(/\s+/g, " ").trim()).slice(0, 16)}`,
    );
  }
  return numberDuplicates(items);
}

/**
 * Keys stripped of line numbers collide when one file has the same failure twice. Numbering the
 * repeats (`… #2`) keeps "one more of the same error" a NEW failure rather than a preexisting one.
 * @param {string[]} items
 */
export function numberDuplicates(items) {
  const seen = new Map();
  return items.map((k) => {
    const n = (seen.get(k) ?? 0) + 1;
    seen.set(k, n);
    return n === 1 ? k : `${k} #${n}`;
  });
}

/**
 * biome `--reporter=json` + eslint `--format json` -> one key per diagnostic: file, rule, message
 * (PT-0352 re-review: default eslint output names the file on its own line, so plain-text keys
 * were per FILE and a new rule violation in an already-red file read as preexisting).
 * @param {string} biomeText
 * @param {string} eslintText
 * @param {string} root
 * @returns {string[] | null} null when neither output parsed (fall back to `itemiseOutput`)
 */
export function lintKeys(biomeText, eslintText, root) {
  const keys = [];
  let parsed = false;
  try {
    const b = JSON.parse(biomeText.slice(biomeText.indexOf("{")));
    parsed = true;
    for (const d of b.diagnostics ?? []) {
      if (d.severity !== "error") continue;
      keys.push(
        `${d.location?.path ?? "?"} ${d.category ?? "?"} ${d.message ?? ""}`.slice(
          0,
          240,
        ),
      );
    }
  } catch {}
  try {
    const e = JSON.parse(eslintText.slice(eslintText.indexOf("[")));
    parsed = true;
    for (const f of e) {
      const rel = f.filePath?.startsWith(root)
        ? f.filePath.slice(root.length + 1)
        : f.filePath;
      for (const m of f.messages ?? []) {
        if (m.severity !== 2) continue;
        keys.push(`${rel} ${m.ruleId ?? "?"} ${m.message ?? ""}`.slice(0, 240));
      }
    }
  } catch {}
  return parsed ? numberDuplicates(keys.sort()) : null;
}

/**
 * The frozen manifest a verify must still satisfy: every entry the baseline recorded is present
 * with the same sha256, unless FROZEN.json's history records a refreeze of that path AFTER the
 * baseline (which `ticket:eval` then lists for a human). Catches a Bash rewrite of a frozen test
 * together with its sha, and a dropped entry (PT-0352 re-review, blocking 2).
 * @param {{ path: string, sha256: string }[] | undefined} pinned from the baseline receipt
 * @param {{ files?: { path: string, sha256: string }[], history?: { action: string, path: string, at: string }[] }} frozen
 * @param {string} baselineAt
 * @returns {string[]}
 */
export function frozenManifestProblems(pinned, frozen, baselineAt) {
  if (!pinned) return [];
  const now = new Map((frozen.files ?? []).map((f) => [f.path, f.sha256]));
  const refrozen = new Set(
    (frozen.history ?? [])
      .filter((h) => h.action === "refreeze" && h.at > baselineAt)
      .map((h) => h.path),
  );
  const problems = [];
  for (const f of pinned) {
    if (!now.has(f.path))
      problems.push(
        `${f.path} was removed from FROZEN.json after the baseline`,
      );
    else if (now.get(f.path) !== f.sha256 && !refrozen.has(f.path)) {
      problems.push(
        `${f.path}: FROZEN.json sha changed after the baseline with no refreeze record`,
      );
    }
  }
  return problems;
}

/**
 * The baseline a verify may compare against: the FIRST baseline line, and only when the chain up
 * to it is intact and (when the runner pinned one) its sha matches. A later line claiming to be a
 * baseline is ignored — appending a forged baseline must not rewrite what was red before
 * (PT-0352 review, blocking 2).
 * @param {string[]} lines
 * @param {string | null} expectedSha sha256 of the baseline line, held by the runner
 * @returns {{ receipt: any | null, problem: string | null }}
 */
export function trustedBaseline(lines, expectedSha) {
  const idx = lines.findIndex((l) => {
    try {
      return JSON.parse(l).kind === "baseline";
    } catch {
      return false;
    }
  });
  if (idx === -1)
    return {
      receipt: null,
      problem: expectedSha ? "pinned baseline not found" : null,
    };
  const chain = verifyChain(lines.slice(0, idx + 1));
  if (!chain.ok)
    return {
      receipt: null,
      problem: `receipt chain broken at line ${chain.brokenAt + 1}`,
    };
  // A baseline written after a verify is not a "before" (PT-0352 re-review, blocking 3).
  if (lines.slice(0, idx).some((l) => l.includes('"kind":"verify"'))) {
    return {
      receipt: null,
      problem: "the first baseline was written after a verify receipt",
    };
  }
  if (expectedSha && sha256(lines[idx]) !== expectedSha) {
    return {
      receipt: null,
      problem: "baseline line does not match the sha the runner recorded",
    };
  }
  return { receipt: JSON.parse(lines[idx]), problem: null };
}

/** sha256 of one receipt line — what the runner pins. */
export const lineSha = (line) => sha256(line);

/**
 * Every frozen acceptance file must have RUN: present in the vitest report, at least one passed
 * assertion, nothing skipped or todo. `--passWithNoTests` plus a file outside vitest's `include`
 * (a frozen `.test.tsx`), an edited `exclude`, or an all-skipped suite otherwise reads as a pass
 * (PT-0352 third review, blocking 4).
 * @param {any} report vitest JSON report
 * @param {string} root
 * @param {string[]} files frozen repo-relative paths
 * @returns {string[]} problems
 */
export function unranFrozen(report, root, files) {
  const byFile = new Map(
    (report?.testResults ?? []).map((f) => [
      f.name?.startsWith(root) ? f.name.slice(root.length + 1) : f.name,
      f.assertionResults ?? [],
    ]),
  );
  const problems = [];
  for (const path of files) {
    const asserts = byFile.get(path);
    if (!asserts)
      problems.push(`${path} did not run (not in the vitest report)`);
    else if (
      !asserts.some((a) => a.status === "passed") &&
      !asserts.some((a) => a.status === "failed")
    ) {
      problems.push(`${path} ran no assertion`);
    } else if (
      asserts.some(
        (a) =>
          a.status === "skipped" ||
          a.status === "pending" ||
          a.status === "todo",
      )
    ) {
      problems.push(`${path} skips or todos part of the contract`);
    }
  }
  return problems;
}

/**
 * Paths a night lane may never change: what decides whether work counts, and what runs it. A lane
 * whose diff touches one is judged by tooling it rewrote (PT-0352 third review, blocking 1).
 */
const TOOLING_RE =
  /^(package\.json|pnpm-lock\.yaml|scripts\/|\.claude\/|\.github\/|\.husky\/|vitest[^/]*\.config\.[cm]?[jt]s|playwright[^/]*\.config\.[cm]?[jt]s|biome\.json|eslint\.config\.[cm]?[jt]s|tsconfig[^/]*\.json)/;

/** @param {string[]} changed repo-relative paths @returns {string[]} the tooling paths among them */
export function toolingTouched(changed) {
  return changed.filter((p) => TOOLING_RE.test(p));
}

/**
 * Playwright `--reporter=json` -> problems with the frozen specs: a spec file absent from the
 * report, one with no test, or one with any skipped test (a spec that skips itself on an env
 * condition otherwise exits 0 and reads as a pass). Fourth review note.
 * @param {any} report
 * @param {string[]} files frozen spec paths, repo-relative
 * @returns {string[]}
 */
export function unranE2e(report, files) {
  /** @type {Map<string, string[]>} file -> test statuses */
  const byFile = new Map();
  const walk = (suite, file) => {
    const f = suite.file ?? file;
    for (const spec of suite.specs ?? []) {
      for (const t of spec.tests ?? []) {
        const list = byFile.get(f) ?? [];
        list.push(t.status ?? t.results?.at(-1)?.status ?? "unknown");
        byFile.set(f, list);
      }
    }
    for (const s of suite.suites ?? []) walk(s, f);
  };
  for (const s of report?.suites ?? []) walk(s, s.file);
  const problems = [];
  for (const path of files) {
    const key = [...byFile.keys()].find(
      (k) => path === k || path.endsWith(`/${k}`) || k.endsWith(path),
    );
    const statuses = key ? byFile.get(key) : undefined;
    if (!statuses)
      problems.push(`${path} did not run (not in the Playwright report)`);
    else if (statuses.length === 0) problems.push(`${path} ran no test`);
    else if (statuses.includes("skipped"))
      problems.push(`${path} skips part of the contract`);
  }
  return problems;
}

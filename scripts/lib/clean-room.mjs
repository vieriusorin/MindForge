/**
 * PT-0352 — the clean-room judge's rules.
 *
 * Four reviews of the overnight runner kept finding the same root cause: a night session runs as
 * the user with a shell, so anything the judge READS from the lane — `vitest.setup.ts`, its
 * `node_modules`, git's index flags (`assume-unchanged` hides an edit from `git diff`), even the
 * verifier itself — the session can rewrite. Patching paths one by one does not converge.
 *
 * So the runner judges in a clean room: a fresh worktree at the pinned base commit (committed,
 * content-addressed tooling the session cannot alter), a fresh `node_modules` clone from the main
 * checkout, and ONLY the lane's product files copied in. What the lane changed is found by
 * hashing its files against the base tree — not by asking the lane's git — and anything changed
 * outside the product allowlist fails the lane outright.
 */
import { createHash } from "node:crypto";

/**
 * Paths a lane may change and have judged. Everything else — scripts, configs, test setup, e2e
 * setup/fixtures, package files, hooks, CI, `.gitignore`, env files — fails the lane: the judge
 * would otherwise run code the session wrote, or a judge-relevant file would silently differ.
 * @param {string} ticket
 */
export function productAllowlist(ticket) {
  return [
    /^src\//,
    /^drizzle\//,
    /^e2e\/flows\//,
    /^e2e\/(?:[^/]+\/)*[^/]+\.spec\.ts$/,
    /^docs\//,
    /^public\//,
    new RegExp(`^\\.planning\\/tasks\\/${ticket}\\/`),
  ];
}

/** Never copied into the judge even when allowed above: the judge brings its own contract. */
const CONTRACT_RE = /^\.planning\/tasks\/[^/]+\/FROZEN\.json$/;

/**
 * @param {string[]} paths changed paths (added, modified or deleted), repo-relative
 * @param {string} ticket
 * @returns {{ product: string[], forbidden: string[] }}
 */
export function classifyDelta(paths, ticket) {
  const allow = productAllowlist(ticket);
  const product = [];
  const forbidden = [];
  for (const p of paths) {
    if (CONTRACT_RE.test(p)) continue; // compared separately against the runner's snapshot
    // An ignore file anywhere decides what the judge's diff and the PR commit can see.
    if (/(^|\/)\.gitignore$/.test(p)) forbidden.push(p);
    else if (allow.some((re) => re.test(p))) product.push(p);
    else forbidden.push(p);
  }
  return { product, forbidden };
}

/** git's blob id for a file's bytes — what `git ls-tree` lists, computed without the lane's git. */
export function gitBlobSha(buf) {
  return createHash("sha1")
    .update(`blob ${buf.length}\0`)
    .update(buf)
    .digest("hex");
}

/**
 * Lane files vs the base tree, both as path -> blob sha.
 * @param {Map<string, string>} base from `git ls-tree -r <base>`
 * @param {Map<string, string>} lane from hashing the lane's files on disk
 * @returns {{ added: string[], modified: string[], deleted: string[] }}
 */
export function treeDelta(base, lane) {
  const added = [];
  const modified = [];
  const deleted = [];
  for (const [p, sha] of lane) {
    if (!base.has(p)) added.push(p);
    else if (base.get(p) !== sha) modified.push(p);
  }
  for (const p of base.keys()) if (!lane.has(p)) deleted.push(p);
  return {
    added: added.sort(),
    modified: modified.sort(),
    deleted: deleted.sort(),
  };
}

/** Directories never walked: build output, dependencies, git, and the lane's own evidence. */
export const SKIP_DIRS = new Set([
  ".git",
  "node_modules",
  ".next",
  "coverage",
  "test-results",
  "playwright-report",
  ".turbo",
]);

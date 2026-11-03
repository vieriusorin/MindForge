/**
 * PT-0352 / PT-0363 — machine-wide locks.
 *
 * `withTestDbLock` serialises EVERY use of the one shared test Supabase stack: `ticket:verify`,
 * and — since PT-0363 — `env-run --env test` itself, so the Stop gate, a hand-run `pnpm test`,
 * `db:test:migrate` and every parallel night lane wait in one line. Several worktrees on one stack
 * contend on the same fixtures and singleton settings rows, which reads as flaky red.
 *
 * The root is fixed (`lockRoot()`), never `os.tmpdir()`: Claude Code's sandbox gives sandboxed
 * commands their own `$TMPDIR`, so a temp-dir lock would not be shared between the runner and a
 * lane. `agents:night` adds the root to each session's `sandbox.filesystem.allowWrite`.
 *
 * Re-entry: a holder hands its children `ctx.env` (one token variable). A child whose token equals
 * the token of the owner currently on disk runs without waiting — that is how `ticket:verify`'s
 * own `env-run` children do not deadlock on it. The token is never written to this process's env,
 * so two un-nested callers in one process still serialise, and a stale token re-enters nothing.
 *
 * A lock appears atomically WITH its owner file (built aside, then renamed into place), so there
 * is no window where a holder died before naming itself. A dead holder's lock is broken by
 * renaming it aside and checking that what moved is still the dead owner's — a live lock taken in
 * the gap is put back. A window remains in which a live lock is briefly absent; it is a few
 * syscalls wide, and the worst case is two holders sharing the test DB once, not a wrong receipt.
 */
import { randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// EPERM means the process exists but may not be signalled — inside Claude Code's macOS sandbox a
// lane may only signal its own sandbox, so the runner, the Stop gate and other lanes all answer
// EPERM. Reading that as "dead" would break a live lock (PT-0363 review B1). Only ESRCH is dead.
const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
};

/** The wait expired while someone else held the lock — "busy", not a crash. */
export class LockBusyError extends Error {
  /** @param {string} message @param {{ label?: string, at?: string } | null} holder */
  constructor(message, holder) {
    super(message);
    this.name = "LockBusyError";
    this.holder = holder;
  }
}

/** @returns {string} where every lock lives — the same for the runner and every sandboxed lane */
export function lockRoot() {
  return process.env.P4T_LOCK_DIR || join(homedir(), ".cache", "p4t-locks");
}

/** @param {string} name @returns {string} the env var that carries a holder's token to children */
const tokenVar = (name) =>
  name === TEST_DB
    ? "P4T_TEST_DB_LOCK_HELD"
    : `P4T_LOCK_HELD_${name.replace(/\W/g, "_").toUpperCase()}`;

const readOwner = (lock) => {
  try {
    return JSON.parse(readFileSync(join(lock, "owner.json"), "utf8"));
  } catch {
    return null;
  }
};

/**
 * @template T
 * @param {string} name lock name (one directory under `lockRoot()`)
 * @param {string} label who holds it, for the waiter's message
 * @param {(ctx: { env: Record<string, string> }) => Promise<T>} fn
 * @param {{ maxWaitMs?: number, log?: (s: string) => void }} [opts]
 * @returns {Promise<T>}
 */
export async function withLock(
  name,
  label,
  fn,
  { maxWaitMs = 90 * 60_000, log = () => {} } = {},
) {
  const root = lockRoot();
  mkdirSync(root, { recursive: true });
  const lock = join(root, `${name}.lock`);
  const variable = tokenVar(name);

  const held = process.env[variable];
  if (held && readOwner(lock)?.token === held)
    return fn({ env: { [variable]: held } });

  const token = randomUUID();
  const started = Date.now();
  let announced = false;
  for (;;) {
    // Acquire: build the lock dir WITH its owner file aside, then rename it into place. A rename
    // onto an existing non-empty dir fails, and a lock is never visible without its owner.
    const staging = `${lock}.new-${process.pid}-${Date.now()}`;
    mkdirSync(staging);
    writeFileSync(
      join(staging, "owner.json"),
      JSON.stringify({
        pid: process.pid,
        label,
        token,
        at: new Date().toISOString(),
      }),
    );
    try {
      renameSync(staging, lock);
      break;
    } catch {
      rmSync(staging, { recursive: true, force: true });
      const owner = readOwner(lock);
      if (owner && !alive(owner.pid)) {
        const graveyard = `${lock}.stale-${process.pid}-${Date.now()}`;
        try {
          renameSync(lock, graveyard);
          // Between reading the owner and the rename, another waiter may have broken the dead
          // lock and taken a live one. If what we moved is not the dead owner's, put it back.
          const moved = JSON.parse(
            readFileSync(join(graveyard, "owner.json"), "utf8"),
          );
          if (moved.pid === owner.pid)
            rmSync(graveyard, { recursive: true, force: true });
          else if (!existsSync(lock)) renameSync(graveyard, lock);
          // else: a live lock was moved aside and another taken in its place. Deleting it would
          // be wrong; leaving it in the graveyard means one holder runs unlocked once. Rare
          // (a crash plus two waiters in the same few syscalls) and visible in the lock root.
        } catch {
          // Another waiter broke it first; go round and race for the fresh rename.
        }
        continue;
      }
      if (!announced) {
        log(
          `waiting for ${name} (held by ${owner?.label ?? "?"} since ${owner?.at ?? "?"})`,
        );
        announced = true;
      }
      if (Date.now() - started > maxWaitMs) {
        throw new LockBusyError(
          `${name} not acquired in ${Math.round(maxWaitMs / 1000)} s (held by ${owner?.label ?? "?"} since ${owner?.at ?? "?"})`,
          owner,
        );
      }
      await sleep(Math.min(3000, Math.max(100, maxWaitMs / 10)));
    }
  }
  try {
    return await fn({ env: { [variable]: token } });
  } finally {
    // Only our own lock: if it was broken and retaken while we ran, it is someone else's now.
    if (readOwner(lock)?.token === token)
      rmSync(lock, { recursive: true, force: true });
  }
}

const TEST_DB = "p4t-test-db";

/** @type {<T>(label: string, fn: (ctx: { env: Record<string, string> }) => Promise<T>, opts?: { maxWaitMs?: number, log?: (s: string) => void }) => Promise<T>} */
export const withTestDbLock = (label, fn, opts) =>
  withLock(TEST_DB, label, fn, opts);

/** @param {string} target an env-run target @returns {boolean} whether it uses the shared test DB */
export function needsTestDbLock(target) {
  return target === "test";
}

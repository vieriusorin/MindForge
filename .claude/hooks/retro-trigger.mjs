#!/usr/bin/env node
/**
 * Stop: a ticket this session finished or parked does not end without a retrospective.
 *
 * Reads the session's touched files (`track-changes.mjs`), maps them to tickets, and blocks the
 * stop while one of them owes a retro (`retroDue` in lib/retro-trigger.mjs). In an interactive
 * session that did any work, a merged night retro marked `applied: deferred` is due as well.
 * Blocks up to CAP times for the same set, then releases with a banner — never loops.
 *
 * Off switch for one session: MF_RETRO=off. Never fails loudly: a broken trigger costs a missed
 * retro, which `pnpm ticket:retro --across` still shows as a ticket without one.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { frontmatter } from "./lib/util.mjs";
import { loadState, ROOT, readStdinJson, saveState } from "./lib/gate-io.mjs";
import { deferredRetro, retroDue, retroInstruction, ticketsTouched } from "./lib/retro-trigger.mjs";

const CAP = 2;
const read = (rel) => {
  const p = join(ROOT, rel);
  return existsSync(p) ? readFileSync(p, "utf8") : null;
};

function latestVerdict(ticket) {
  const lines = (read(`.planning/evidence/${ticket}.receipts.jsonl`) ?? "").split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const r = JSON.parse(lines[i]);
      if (r.kind === "verify") return r.verdict ?? null;
    } catch {
      // blank or partial line
    }
  }
  return null;
}

function factsAge(ticket) {
  const p = join(ROOT, `.planning/tasks/${ticket}/retro-facts.json`);
  return existsSync(p) ? Date.now() - statSync(p).mtimeMs : null;
}

function retroOf(ticket) {
  const text = read(`.planning/tasks/${ticket}/RETRO.md`);
  return text === null ? null : frontmatter(text);
}

function main() {
  if (process.env.MF_RETRO === "off") return;
  const input = readStdinJson();
  if (!input) return;
  const autonomous = Boolean(process.env.MF_AUTONOMOUS);
  const touched = Object.keys(loadState(input.session_id).touched);
  if (touched.length === 0) return;

  /** @type {{ ticket: string, why: string }[]} */
  const due = [];
  for (const ticket of ticketsTouched(touched)) {
    const goalText = read(`.planning/tasks/${ticket}/GOAL.md`);
    if (!goalText) continue;
    const why = retroDue({
      goal: frontmatter(goalText),
      retro: retroOf(ticket),
      latestVerdict: latestVerdict(ticket),
      hasEvidence: existsSync(join(ROOT, `.planning/evidence/${ticket}.md`)),
      autonomous,
      factsAgeMs: factsAge(ticket),
    });
    if (why) due.push({ ticket, why });
  }
  if (!autonomous) {
    let dirs = [];
    try {
      dirs = readdirSync(join(ROOT, ".planning", "tasks"));
    } catch {}
    for (const ticket of dirs) {
      if (due.some((d) => d.ticket === ticket)) continue;
      if (deferredRetro(retroOf(ticket), autonomous))
        due.push({ ticket, why: "night retro, actions deferred" });
    }
  }

  const stateKey = `${input.session_id}-retro`;
  const state = loadState(stateKey);
  if (due.length === 0) {
    if (state.blocks) saveState(stateKey, { ...state, blocks: 0, releasedRed: null });
    return;
  }
  const signature = due.map((d) => `${d.ticket}:${d.why}`).join("|");
  if (state.releasedRed === signature) return;
  const blocks = state.releasedRed === null && state.lastSignature === signature ? state.blocks : 0;

  if (blocks >= CAP) {
    saveState(stateKey, { ...state, blocks: 0, releasedRed: signature, lastSignature: signature });
    process.stdout.write(
      JSON.stringify({
        systemMessage: `✗ Retro not done after ${CAP} attempts: ${due.map((d) => d.ticket).join(", ")}. Run \`pnpm ticket:retro <ID>\` and the retro agent next session.`,
      }),
    );
    return;
  }
  saveState(stateKey, {
    ...state,
    blocks: blocks + 1,
    releasedRed: null,
    lastSignature: signature,
  });
  process.stdout.write(
    JSON.stringify({ decision: "block", reason: retroInstruction(due, autonomous) }),
  );
}

try {
  main();
} catch {
  // see header: never block a session on a broken trigger
}
process.exit(0);

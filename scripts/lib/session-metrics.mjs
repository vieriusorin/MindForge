/**
 * PT-0352 — the pure half of session metrics: one Claude Code transcript (JSONL records, already
 * parsed) -> tokens per model, wall and active time, prompts, and the tickets it worked on.
 *
 * The transcript format is internal to Claude Code and changes between versions, so everything
 * here reads defensively and ignores what it does not recognise. One API response is written as
 * several `assistant` lines (thinking, text, each tool_use) that all carry the SAME usage block —
 * summing lines double- or triple-counts, so usage is taken once per `message.id`.
 */

const TICKET_RE = /\.planning\/tasks\/((?:PT|LS)-\d{4})\//;

/** Local hour -> the bucket the comparison report groups by. */
export function bucketOfHour(hour) {
  if (hour < 6) return "night";
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

const isTypedPrompt = (r) => {
  if (r.type !== "user" || r.isMeta) return false;
  const c = r.message?.content;
  if (typeof c === "string") return c.trim().length > 0 && !c.startsWith("<");
  return (
    Array.isArray(c) &&
    c.some((b) => b?.type === "text") &&
    !c.some((b) => b?.type === "tool_result")
  );
};

/**
 * @param {unknown[]} records parsed JSONL lines
 * @param {{ idleCapMs: number }} opts a gap longer than this counts as `idleCapMs` of activity
 */
export function summarizeTranscript(records, { idleCapMs }) {
  /** @type {Record<string, { calls: number, input: number, output: number, cacheRead: number, cacheWrite: number }>} */
  const models = {};
  const seen = new Set();
  const tickets = {};
  const times = [];
  let prompts = 0;
  let toolCalls = 0;
  const meta = { version: null, branch: null, entrypoint: null, effort: null };

  for (const r of records) {
    if (!r || typeof r !== "object") continue;
    const at = Date.parse(r.timestamp);
    if (Number.isFinite(at) && (r.type === "user" || r.type === "assistant"))
      times.push(at);
    if (r.type === "user" && isTypedPrompt(r)) prompts++;
    if (r.type !== "assistant") continue;
    meta.version ??= r.version ?? null;
    meta.branch ??= r.gitBranch ?? null;
    meta.entrypoint ??= r.entrypoint ?? null;
    meta.effort ??= r.effort ?? null;

    const msg = r.message ?? {};
    for (const block of Array.isArray(msg.content) ? msg.content : []) {
      if (block?.type !== "tool_use") continue;
      toolCalls++;
      const path = block.input?.file_path ?? block.input?.notebook_path;
      const m = typeof path === "string" ? TICKET_RE.exec(path) : null;
      if (m) tickets[m[1]] = (tickets[m[1]] ?? 0) + 1;
    }

    const id = msg.id ?? r.requestId;
    if (
      !id ||
      seen.has(id) ||
      !msg.usage ||
      !msg.model ||
      msg.model === "<synthetic>"
    )
      continue;
    seen.add(id);
    const u = msg.usage;
    models[msg.model] ??= {
      calls: 0,
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
    };
    const m = models[msg.model];
    m.calls++;
    m.input += u.input_tokens ?? 0;
    m.output += u.output_tokens ?? 0;
    m.cacheRead += u.cache_read_input_tokens ?? 0;
    m.cacheWrite += u.cache_creation_input_tokens ?? 0;
  }

  times.sort((a, b) => a - b);
  let activeMs = 0;
  for (let i = 1; i < times.length; i++)
    activeMs += Math.min(times[i] - times[i - 1], idleCapMs);

  return {
    models,
    firstAt: times.length ? new Date(times[0]).toISOString() : null,
    lastAt: times.length ? new Date(times.at(-1)).toISOString() : null,
    wallMs: times.length ? times.at(-1) - times[0] : 0,
    activeMs,
    prompts,
    toolCalls,
    tickets,
    ...meta,
  };
}

/** Sum several model maps (main session + its subagents). */
export function mergeModels(...maps) {
  const out = {};
  for (const map of maps) {
    for (const [model, m] of Object.entries(map)) {
      out[model] ??= {
        calls: 0,
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
      };
      const o = out[model];
      for (const k of Object.keys(o)) o[k] += m[k] ?? 0;
    }
  }
  return out;
}

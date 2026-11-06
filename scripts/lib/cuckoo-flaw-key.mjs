// MF-0041: the flaw-key rule of `pnpm check:packs`. A snippet written as a numbered list tempts the
// author to key the flaw by its list label ("3.") instead of its 1-based line index; with a heading on
// line 1 the two differ by one and the key lands on a true line (D6.S1, MF-0016). When they differ,
// a human must state which line they checked. Pure: the caller passes the file text.
import YAML from "yaml";

/** @typedef {import("./cuckoo-grounding.mjs").GroundingProblem} GroundingProblem */

const LABEL = /^\s*(\d+)[.)]\s/;
const NOTE_ANY = /^\s*#\s*flaw-line:/;
const NOTE =
  /^\s*#\s*flaw-line:\s*(\d+)\s*(?:—|--)\s*"([^"]+)"\s*(?:—|--)\s*(\S.*?)\s*$/;
const MIN_FRAGMENT_WORDS = 3;

/** The numeric label of a line, or null when it has none. */
function labelOf(line) {
  if (typeof line !== "string") return null;
  const m = LABEL.exec(line);
  return m ? Number(m[1]) : null;
}

/** Does the item's flawLine differ from the list label of the line it keys? */
function keyDiffersFromLabel(lines, flawLine) {
  if (!Number.isInteger(flawLine)) return null;
  const labelled = lines.filter((l) => labelOf(l) !== null).length;
  const label = labelOf(lines[flawLine - 1]);
  if (labelled < 2 || label === null || label === flawLine) return null;
  return label;
}

/** Why one `# flaw-line:` note fails to identify the keyed line, or null when it does. */
function noteProblem(raw, lines, flawLine) {
  const m = NOTE.exec(raw);
  if (!m) {
    return `"${raw.trim()}" needs the form # flaw-line: <n> — "<3+ words of the line>" — <reason>`;
  }
  const n = Number(m[1]);
  const fragment = m[2].trim();
  if (n !== flawLine)
    return `# flaw-line: ${n} is stale: flawLine is ${flawLine}`;
  if (fragment.split(/\s+/).length < MIN_FRAGMENT_WORDS) {
    return `# flaw-line: "${fragment}" quotes fewer than ${MIN_FRAGMENT_WORDS} words of line ${n}`;
  }
  if (!lines[n - 1].includes(fragment)) {
    return `# flaw-line: "${fragment}" is not in line ${n}`;
  }
  if (
    lines.some(
      (l, i) => i !== n - 1 && typeof l === "string" && l.includes(fragment),
    )
  ) {
    return `# flaw-line: "${fragment}" also occurs in another line, so it does not identify line ${n}`;
  }
  return null;
}

/**
 * Check every cuckoo in one `cuckoos/*.yaml` file. When two or more lines carry a numeric label and
 * the flaw line's label is not `flawLine`, the item needs
 * `# flaw-line: <flawLine> — "<fragment of that line>" — <reason>`; a note where the rule does not fire
 * is stale. Unparseable files return [] (the cuckoo rule and the pack loader report them).
 * @param {{ file: string, text: string }} input
 * @returns {GroundingProblem[]}
 */
export function checkFlawKeys({ file, text }) {
  const doc = YAML.parseDocument(text);
  if (doc.errors.length > 0) return [];
  const seq = doc.get("cuckoos");
  if (!YAML.isSeq(seq)) return [];

  /** @type {GroundingProblem[]} */
  const problems = [];
  for (const node of seq.items) {
    const item = YAML.isMap(node) ? node.toJSON() : null;
    if (!item || typeof item.id !== "string" || !Array.isArray(item.lines))
      continue;
    const { id, lines, flawLine } = item;
    const block = node.range ? text.slice(node.range[0], node.range[2]) : "";
    const notes = block.split(/\r?\n/).filter((l) => NOTE_ANY.test(l));
    const report = (message, line) =>
      problems.push({
        file,
        id,
        ...(line ? { line } : {}),
        rule: "flaw-key",
        message: `${file}: ${id}${line ? ` line ${line}` : ""}: ${message}`,
      });

    const label = keyDiffersFromLabel(lines, flawLine);
    if (label === null) {
      for (const raw of notes) {
        report(
          `"${raw.trim()}" is stale: flawLine matches its list label, or the line has none`,
        );
      }
      continue;
    }
    if (notes.length === 0) {
      report(
        `flawLine ${flawLine} keys the line labelled "${label}."; check the false line, then add # flaw-line: ${flawLine} — "<3+ words of that line>" — <why the label differs>`,
        flawLine,
      );
      continue;
    }
    for (const raw of notes) {
      const why = noteProblem(raw, lines, flawLine);
      if (why) report(why, flawLine);
    }
  }
  return problems;
}

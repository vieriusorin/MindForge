// MF-0036: the cuckoo rule of `pnpm check:packs`. A cuckoo holds exactly ONE false line (its
// flawLine), so every other line must be true: a second false line grades an informed learner
// wrong (MF-0016 review, D7.S2 line 3). Pure: the caller passes the file text and a corpus reader.
import YAML from "yaml";

/**
 * @typedef {"parse" | "quantifier" | "annotation" | "token" | "source" | "flaw-key"} GroundingRule
 * @typedef {{ file: string, id?: string, line?: number, rule: GroundingRule, word?: string, message: string }} GroundingProblem
 */

/** Absolute words (GOAL D-3), whole words, case-insensitive; `no … can` within one sentence. */
const ABSOLUTE =
  /\b(?:never|always|only|all|every|cannot|guarantee[sd]?)\b|\bcan't\b|\bno\b[^.]*?\bcan\b/gi;
const BACKTICK = /`([^`]+)`/g;
const GROUNDED = /^\s*#\s*grounded:\s*(.*?)\s*(?:—|--)\s*(.*?)\s*$/;
const GROUNDED_BARE = /^\s*#\s*grounded:/;
const EXAMPLE_NAME = /^\s*#\s*example-name:\s*(.+?)\s*$/;
const UNCACHED = /^\s*#\s*uncached:\s*(\S+)\s*(?:—|--)?\s*(.*?)\s*$/;

/** The annotation key of an absolute word: lower case, `no … can` collapsed to `no can`. */
function wordKey(match) {
  const lower = match.toLowerCase();
  return /^no\b/.test(lower) ? "no can" : lower;
}

const normalise = (text) => text.toLowerCase().replace(/\s+/g, " ").trim();

/** Comment annotations inside one item's YAML block (between its `- id:` and the next item). */
function readAnnotations(block) {
  const grounded = [];
  const exampleNames = new Set();
  const uncached = [];
  const malformed = [];
  for (const raw of block.split(/\r?\n/)) {
    const g = GROUNDED.exec(raw);
    if (g) {
      grounded.push({ word: wordKey(g[1]), justification: g[2] });
      continue;
    }
    if (GROUNDED_BARE.test(raw)) {
      malformed.push(raw.trim());
      continue;
    }
    const e = EXAMPLE_NAME.exec(raw);
    if (e) {
      exampleNames.add(e[1]);
      continue;
    }
    const u = UNCACHED.exec(raw);
    if (u) uncached.push({ url: u[1], reason: u[2] });
  }
  return { grounded, exampleNames, uncached, malformed };
}

/**
 * Check every cuckoo in one `cuckoos/*.yaml` file. Each non-flaw line's absolute words need a
 * `# grounded: <word> — <justification>` (a "quoted" justification must occur in a cited source),
 * each backticked token must occur in a cited source or be declared `# example-name: <token>`, and
 * each cited source must have corpus text or a `# uncached: <url> — <reason>` exemption.
 * @param {{ file: string, text: string, corpus: (url: string) => string | null }} input
 * @returns {GroundingProblem[]}
 */
export function checkCuckooFile({ file, text, corpus }) {
  const doc = YAML.parseDocument(text);
  if (doc.errors.length > 0) {
    return [
      { file, rule: "parse", message: `${file}: ${doc.errors[0].message}` },
    ];
  }
  const seq = doc.get("cuckoos");
  if (!YAML.isSeq(seq)) {
    return [{ file, rule: "parse", message: `${file}: no cuckoos list` }];
  }

  /** @type {GroundingProblem[]} */
  const problems = [];
  for (const node of seq.items) {
    const item = YAML.isMap(node) ? node.toJSON() : null;
    if (!item || typeof item.id !== "string" || !Array.isArray(item.lines)) {
      problems.push({
        file,
        rule: "parse",
        message: `${file}: a cuckoo without id or lines`,
      });
      continue;
    }
    const id = item.id;
    const at = (line) => `${file}: ${id}${line ? ` line ${line}` : ""}`;
    const block = node.range ? text.slice(node.range[0], node.range[2]) : "";
    const notes = readAnnotations(block);
    const sources = Array.isArray(item.sources) ? item.sources : [];
    const texts = sources
      .map((url) => corpus(url))
      .filter((t) => typeof t === "string");
    const normalisedTexts = texts.map(normalise);

    for (const raw of notes.malformed) {
      problems.push({
        file,
        id,
        rule: "annotation",
        message: `${at()}: "${raw}" needs the form # grounded: <word> — <justification>`,
      });
    }

    for (const url of sources) {
      if (corpus(url) !== null) continue;
      if (notes.uncached.some((u) => u.url === url && u.reason !== ""))
        continue;
      problems.push({
        file,
        id,
        rule: "source",
        message: `${at()}: no corpus text for ${url} (run pnpm generate:corpus, or add # uncached: ${url} — <reason>)`,
      });
    }
    for (const u of notes.uncached) {
      if (!sources.includes(u.url)) {
        problems.push({
          file,
          id,
          rule: "source",
          message: `${at()}: # uncached: ${u.url} names a URL the item does not cite`,
        });
      } else if (u.reason === "") {
        problems.push({
          file,
          id,
          rule: "source",
          message: `${at()}: # uncached: ${u.url} needs a reason after —`,
        });
      }
    }

    const usedWords = new Set();
    item.lines.forEach((value, index) => {
      const lineNo = index + 1;
      if (lineNo === item.flawLine || typeof value !== "string") return;
      for (const m of value.matchAll(ABSOLUTE)) {
        const key = wordKey(m[0]);
        usedWords.add(key);
        if (notes.grounded.some((g) => g.word === key)) continue;
        problems.push({
          file,
          id,
          line: lineNo,
          rule: "quantifier",
          word: key,
          message: `${at(lineNo)}: "${m[0]}" in a line that must be true; add # grounded: ${key} — <quote or reason>`,
        });
      }
      for (const m of value.matchAll(BACKTICK)) {
        const token = m[1];
        if (notes.exampleNames.has(token)) continue;
        if (texts.some((t) => t.includes(token))) continue;
        problems.push({
          file,
          id,
          line: lineNo,
          rule: "token",
          word: token,
          message: `${at(lineNo)}: \`${token}\` is not in any cached source; cite one that has it, or add # example-name: ${token}`,
        });
      }
    });

    for (const g of notes.grounded) {
      const bad = (why) =>
        problems.push({
          file,
          id,
          rule: "annotation",
          word: g.word,
          message: `${at()}: # grounded: ${g.word} ${why}`,
        });
      if (g.justification === "") {
        bad("needs a quote or a reason after —");
        continue;
      }
      if (!usedWords.has(g.word)) {
        bad("is stale: no line that must be true uses that word");
        continue;
      }
      const quoted = /^"(.*)"$/.exec(g.justification);
      if (!quoted) continue;
      const claim = normalise(quoted[1]);
      if (!claim.includes(g.word === "no can" ? "no" : g.word)) {
        bad("quotes text that does not contain the word");
      } else if (!normalisedTexts.some((t) => t.includes(claim))) {
        bad("quotes text that no cached source contains");
      }
    }
  }
  return problems;
}

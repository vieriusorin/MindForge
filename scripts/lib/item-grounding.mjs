// MF-0033: the question, card and diagram rules of `pnpm check:packs`. An identifier or a product-surface
// term the cited page does not contain is how most mechanical grounding slips looked in MF-0031 and MF-0038
// (`end_turn` cited to the tool-use pages; `claude.ai` in a stem citing rate-limits). Pure: the caller passes
// the file text and a corpus reader. Annotations are YAML comments, so they leave `contentHash` unchanged.
import YAML from "yaml";

/**
 * @typedef {"questions" | "cards" | "diagrams"} ItemKind
 * @typedef {"parse" | "token" | "leak" | "annotation"} ItemRule
 * @typedef {{ file: string, id?: string, rule: ItemRule, word?: string, message: string }} ItemProblem
 * @typedef {{ problems: ItemProblem[], checked: number, skipped: number }} ItemFileResult
 * @typedef {{ urls: string[], tokenFields: string[], leakFields: string[], exempt: string }} ItemFields
 */

/** Product-surface terms that drafters carried over from a sibling page (MF-0038 retro). */
const SURFACE_TERMS = [
  "claude.ai",
  "Claude Code",
  "Messages API",
  "Projects",
  "code execution",
  "memory tool",
  "incognito",
  "Agent Skills",
];
const BACKTICK = /`([^`]+)`/g;
const SNAKE = /\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/g;
const SPAN_SPLIT = /[\s:,.()[\]{}="']+/;
const EXAMPLE_NAME = /^\s*#\s*example-name:\s*(.+?)\s*$/;
const FRAMING = /^\s*#\s*framing:\s*(.*?)\s*$/;
const REASON_SPLIT = /\s*(?:—|--)\s*/;

/** @param {unknown} value */
const str = (value) => (typeof value === "string" ? value : "");

/** @param {unknown} value */
const list = (value) => (Array.isArray(value) ? value : []);

/**
 * The fields each rule reads, per kind. Questions check tokens in rationales only; the stem and option
 * texts are what a rationale may quote, so their tokens are exempt.
 * @param {ItemKind} kind
 * @param {Record<string, unknown>} item
 * @returns {ItemFields}
 */
function fieldsOf(kind, item) {
  if (kind === "questions") {
    const options = list(item.options);
    const texts = [str(item.stem), ...options.map((o) => str(o?.text))];
    const rationales = options.map((o) => str(o?.rationale));
    const source = /** @type {{ url?: unknown } | undefined} */ (item.source);
    const url = str(source?.url);
    return {
      urls: url ? [url] : list(item.sources).map(str),
      tokenFields: rationales,
      leakFields: [...texts, ...rationales],
      exempt: texts.join("\n").toLowerCase(),
    };
  }
  const fields =
    kind === "cards"
      ? [
          str(item.concept),
          str(item.simply),
          str(item.inNature),
          ...list(item.whereItBreaks).map(str),
          str(item.contrast),
        ]
      : [
          str(item.title),
          ...list(item.nodes).map((n) => str(n?.label)),
          ...list(item.edges).map((e) => str(e?.label)),
        ];
  return {
    urls: list(item.sources).map(str),
    tokenFields: fields,
    leakFields: fields,
    exempt: "",
  };
}

/** @param {string} field */
function tokensOf(field) {
  const tokens = [];
  for (const m of field.matchAll(BACKTICK))
    tokens.push({ token: m[1], span: true });
  for (const m of field.replace(BACKTICK, " ").matchAll(SNAKE))
    tokens.push({ token: m[0], span: false });
  return tokens;
}

/** Annotations inside one item's YAML block. */
function readAnnotations(block) {
  const exampleNames = new Set();
  const framed = new Set();
  const malformed = [];
  for (const raw of block.split(/\r?\n/)) {
    const e = EXAMPLE_NAME.exec(raw);
    if (e) {
      exampleNames.add(e[1]);
      continue;
    }
    const f = FRAMING.exec(raw);
    if (!f) continue;
    const [term, ...rest] = f[1].split(REASON_SPLIT);
    if (term && rest.join(" ").trim() !== "") framed.add(term.toLowerCase());
    else malformed.push(raw.trim());
  }
  return { exampleNames, framed, malformed };
}

/**
 * Check every item in one `questions/`, `cards/` or `diagrams/` file. An item is checked only when every
 * cited url has corpus text; otherwise it is counted as skipped and raises nothing.
 * @param {{ file: string, kind: ItemKind, text: string, corpus: (url: string) => string | null }} input
 * @returns {ItemFileResult}
 */
export function checkItemFile({ file, kind, text, corpus }) {
  const doc = YAML.parseDocument(text);
  if (doc.errors.length > 0) {
    return {
      problems: [
        { file, rule: "parse", message: `${file}: ${doc.errors[0].message}` },
      ],
      checked: 0,
      skipped: 0,
    };
  }
  const seq = doc.get(kind);
  if (!YAML.isSeq(seq)) {
    return {
      problems: [{ file, rule: "parse", message: `${file}: no ${kind} list` }],
      checked: 0,
      skipped: 0,
    };
  }

  /** @type {ItemProblem[]} */
  const problems = [];
  let checked = 0;
  let skipped = 0;
  for (const node of seq.items) {
    const item = YAML.isMap(node) ? node.toJSON() : null;
    if (!item || typeof item.id !== "string") {
      problems.push({
        file,
        rule: "parse",
        message: `${file}: an item without an id`,
      });
      continue;
    }
    const id = item.id;
    const notes = readAnnotations(
      node.range ? text.slice(node.range[0], node.range[2]) : "",
    );
    for (const raw of notes.malformed) {
      problems.push({
        file,
        id,
        rule: "annotation",
        message: `${file}: ${id}: "${raw}" needs the form # framing: <term> — <reason>`,
      });
    }

    const fields = fieldsOf(kind, item);
    const pages = fields.urls.map((url) => corpus(url));
    if (pages.length === 0 || pages.some((p) => p === null)) {
      skipped++;
      continue;
    }
    checked++;
    const page = pages.join("\n").toLowerCase();
    const onPage = (word) => page.includes(word.toLowerCase());
    const seen = new Set();
    /** @param {"token" | "leak"} rule @param {string} word @param {string} hint */
    const report = (rule, word, hint) => {
      if (seen.has(`${rule}|${word}`)) return;
      seen.add(`${rule}|${word}`);
      problems.push({
        file,
        id,
        rule,
        word,
        message: `${file}: ${id}: ${rule} "${word}" is not on the cited page (${hint})`,
      });
    };

    for (const field of fields.tokenFields) {
      for (const { token, span } of tokensOf(field)) {
        if (onPage(token) || notes.exampleNames.has(token)) continue;
        if (fields.exempt.includes(token.toLowerCase())) continue;
        const words = token.split(SPAN_SPLIT).filter(Boolean);
        if (span && words.length > 0 && words.every(onPage)) continue;
        report(
          "token",
          token,
          "ground it on the page, or add # example-name: <token>",
        );
      }
    }
    for (const term of SURFACE_TERMS) {
      const lower = term.toLowerCase();
      if (!fields.leakFields.some((f) => f.toLowerCase().includes(lower)))
        continue;
      if (onPage(term) || notes.framed.has(lower)) continue;
      report(
        "leak",
        term,
        "cite the page that says it, or add # framing: <term> — <reason>",
      );
    }
  }
  return { problems, checked, skipped };
}

// MF-0066: the order rule of `pnpm check:packs`. Drafter check (3) says an ordering needs a page sentence
// that orders it, so every order item carries `orderedBy` quotes, and each must occur in the cached text of
// the page the item cites (`source.url`), not merely in some other page. An uncached source is a problem:
// there is no `# uncached:` exemption for orders, because the quote check is the whole rule. Whether the
// quotes really order the steps is the fresh verifier's job. Pure: the caller passes the text and a corpus.
import YAML from "yaml";

/**
 * @typedef {{ file: string, id?: string, rule: "parse" | "source" | "ordered-by", quote?: string, message: string }} OrderProblem
 */

/** Lower case, whitespace collapsed: quotes may wrap or change case, never wording. */
const normalise = (/** @type {string} */ text) =>
  text.toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Check every order in one `orders/*.yaml` file: each `orderedBy` quote must occur in the cached text of
 * the order's `source.url`.
 * @param {{ file: string, text: string, corpus: (url: string) => string | null }} input
 * @returns {{ problems: OrderProblem[], checked: number }}
 */
export function checkOrderFile({ file, text, corpus }) {
  /** @type {unknown} */
  let doc;
  try {
    doc = YAML.parse(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      problems: [{ file, rule: "parse", message: `${file}: ${message}` }],
      checked: 0,
    };
  }
  const orders =
    doc && typeof doc === "object" && Array.isArray(Reflect.get(doc, "orders"))
      ? /** @type {unknown[]} */ (Reflect.get(doc, "orders"))
      : null;
  if (!orders) {
    return {
      problems: [{ file, rule: "parse", message: `${file}: no orders list` }],
      checked: 0,
    };
  }

  /** @type {OrderProblem[]} */
  const problems = [];
  let checked = 0;
  for (const raw of orders) {
    const item = /** @type {Record<string, unknown>} */ (raw ?? {});
    const id = typeof item.id === "string" ? item.id : undefined;
    if (!id) {
      problems.push({
        file,
        rule: "parse",
        message: `${file}: an order without id`,
      });
      continue;
    }
    checked++;
    const source = /** @type {{ url?: unknown } | undefined} */ (item.source);
    const url = typeof source?.url === "string" ? source.url : "";
    const page = url ? corpus(url) : null;
    if (page === null) {
      problems.push({
        file,
        id,
        rule: "source",
        message: `${file}: ${id}: no corpus text for ${url || "(no source.url)"} (run pnpm generate:corpus); an order's quotes are checked against its cited page`,
      });
      continue;
    }
    const text = normalise(page);
    const quotes = Array.isArray(item.orderedBy) ? item.orderedBy : [];
    for (const quote of quotes) {
      if (typeof quote === "string" && text.includes(normalise(quote)))
        continue;
      problems.push({
        file,
        id,
        rule: "ordered-by",
        quote: String(quote),
        message: `${file}: ${id}: orderedBy quote not found on ${url}: "${String(quote)}"`,
      });
    }
  }
  return { problems, checked };
}

/**
 * MF-0066 review: corpus-free floor. Each adjacent pair of steps needs a page sentence that orders it, so an
 * order needs at least `steps.length - 1` `orderedBy` quotes. Fewer is a problem; whether the quotes really
 * order each pair stays the fresh verifier's job. Runs in CI (no corpus needed).
 * @param {{ file: string, text: string }} input
 * @returns {{ problems: OrderProblem[], checked: number }}
 */
export function checkOrderQuoteCount({ file, text }) {
  /** @type {unknown} */
  let doc;
  try {
    doc = YAML.parse(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      problems: [{ file, rule: "parse", message: `${file}: ${message}` }],
      checked: 0,
    };
  }
  const orders =
    doc && typeof doc === "object" && Array.isArray(Reflect.get(doc, "orders"))
      ? /** @type {unknown[]} */ (Reflect.get(doc, "orders"))
      : [];
  /** @type {OrderProblem[]} */
  const problems = [];
  let checked = 0;
  for (const raw of orders) {
    const item = /** @type {Record<string, unknown>} */ (raw ?? {});
    const id = typeof item.id === "string" ? item.id : "(no id)";
    const steps = Array.isArray(item.steps) ? item.steps.length : 0;
    const quotes = Array.isArray(item.orderedBy) ? item.orderedBy.length : 0;
    checked++;
    if (quotes < steps - 1) {
      problems.push({
        file,
        id,
        rule: "ordered-by",
        message: `${file}: ${id}: ${steps} steps need at least ${steps - 1} orderedBy quotes (one per adjacent pair); found ${quotes}`,
      });
    }
  }
  return { problems, checked };
}

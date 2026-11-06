// MF-0044: the key-length rule of `pnpm check:packs`. A `select: 1` key much longer than every distractor is a
// tell a test-wise learner can use (MF-0042: 10 of 32 verifier FIX). Needs no corpus, so it runs in CI.
// Fails closed (verification.md §4): what it cannot read is a problem, never a skip. Pure: the caller passes text.
import YAML from "yaml";

/** @typedef {import("./cuckoo-grounding.mjs").GroundingProblem} GroundingProblem */
/**
 * @typedef {{ problems: GroundingProblem[]; checked: number; grandfathered: number; multi: number }} KeyLengthResult
 */

/** Key chars / longest distractor chars at or above this fails (MF-0042 findings; user decision MF-0044 C-2). */
export const KEY_LENGTH_LIMIT = 1.15;

/**
 * Packs shipped before the rule, skipped until MF-0061 retrofits them (user decision MF-0044 C-3). Probe
 * 2026-11-06: ccdv-f 40, prod-prompting 28, platform-foundations 2 failing questions.
 */
export const GRANDFATHERED_PACKS = new Set([
  "ccdv-f",
  "prod-prompting",
  "platform-foundations",
]);

const RULE = "key-length";

/**
 * @param {string} file
 * @param {string} message
 * @returns {GroundingProblem}
 */
const problem = (file, message) => ({
  file,
  rule: RULE,
  message: `${file}: ${message}`,
});

/**
 * Characters as a reader sees them: code points (an emoji is one), without a block scalar's trailing newline
 * (MF-0044 review: `text: |` counted 114 chars as 115).
 * @param {string} text
 */
const charCount = (text) => [...text.trimEnd()].length;

/**
 * The problem for one `select: 1` question, or null when it is well formed and its key does not stand out by
 * length. The structure is checked in every pack; `compareLengths: false` (a grandfathered pack) skips only the
 * length comparison, so a malformed question is never skipped (MF-0044 review).
 * @param {{ file: string; id: string; options: unknown; compareLengths: boolean }} input
 * @returns {GroundingProblem | null}
 */
function questionProblem({ file, id, options, compareLengths }) {
  if (!Array.isArray(options))
    return problem(file, `${id}: select: 1 needs an options list`);
  /** @type {{ text: string; correct: boolean }[]} */
  const parsed = [];
  for (const [i, option] of options.entries()) {
    if (
      typeof option?.text !== "string" ||
      typeof option?.correct !== "boolean"
    )
      return problem(
        file,
        `${id}: option ${i + 1} needs a text string and a correct boolean`,
      );
    parsed.push({ text: option.text, correct: option.correct });
  }
  const [key, ...extraKeys] = parsed.filter((o) => o.correct);
  if (!key || extraKeys.length > 0)
    return problem(
      file,
      `${id}: select: 1 needs exactly one correct option, found ${extraKeys.length + (key ? 1 : 0)}`,
    );
  const distractors = parsed.filter((o) => !o.correct);
  if (distractors.length === 0)
    return problem(file, `${id}: select: 1 needs at least one distractor`);
  const longest = Math.max(...distractors.map((o) => charCount(o.text)));
  if (longest === 0) return problem(file, `${id}: every distractor is empty`);
  if (!compareLengths) return null;
  const keyChars = charCount(key.text);
  const ratio = keyChars / longest;
  if (ratio < KEY_LENGTH_LIMIT) return null;
  return problem(
    file,
    `${id}: key is ${keyChars} chars, longest distractor ${longest} (${ratio.toFixed(2)}×, limit ${KEY_LENGTH_LIMIT}×)`,
  );
}

/**
 * Key-length problems in one `packs/<pack>/questions/*.yaml` file. A grandfathered pack's questions are counted and
 * structure-checked, not length-checked; a `select` other than 1 is counted, not checked.
 * @param {{ file: string; pack: string; text: string }} input
 * @returns {KeyLengthResult}
 */
export function checkKeyLengths({ file, pack, text }) {
  /** @type {KeyLengthResult} */
  const result = { problems: [], checked: 0, grandfathered: 0, multi: 0 };
  const doc = YAML.parseDocument(text);
  if (doc.errors.length > 0) {
    result.problems.push(
      problem(
        file,
        `key-length: cannot parse YAML: ${doc.errors[0]?.message ?? "unknown error"}`,
      ),
    );
    return result;
  }
  const questions = doc.toJSON()?.questions;
  if (!Array.isArray(questions)) {
    result.problems.push(problem(file, "key-length: no questions list"));
    return result;
  }
  for (const [i, item] of questions.entries()) {
    const id = typeof item?.id === "string" ? item.id : `question ${i + 1}`;
    if (item === null || typeof item !== "object") {
      result.problems.push(
        problem(file, `${id}: key-length: not a question map`),
      );
      continue;
    }
    if (!Number.isInteger(item.select) || item.select < 1) {
      result.problems.push(
        problem(file, `${id}: key-length: select must be a positive integer`),
      );
      continue;
    }
    if (item.select > 1) {
      result.multi++;
      continue;
    }
    const isGrandfathered = GRANDFATHERED_PACKS.has(pack);
    if (isGrandfathered) result.grandfathered++;
    else result.checked++;
    const found = questionProblem({
      file,
      id,
      options: item.options,
      compareLengths: !isGrandfathered,
    });
    if (found) result.problems.push(found);
  }
  return result;
}

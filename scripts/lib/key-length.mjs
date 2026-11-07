// MF-0044: the key-length rule of `pnpm check:packs`. A `select: 1` key much longer than every distractor is a
// tell a test-wise learner can use (MF-0042: 10 of 32 verifier FIX). Needs no corpus, so it runs in CI.
// MF-0061: no pack is grandfathered any more; only `origin: official` items (verbatim Exam Guide copies, CONTEXT.md)
// skip the length comparison, because their text may not be edited. They are still structure-checked and counted.
// MF-0061 U-7 (replaces the U-6 longest-key cap): a pack-level rank rule beside it. Each single-select, non-official
// key is ranked by length among its options; no rank may hold more than 40% of a pack, so neither "pick the longest"
// nor "pick the 2nd longest" / "the shortest" beats chance.
// Fails closed (verification.md §4): what it cannot read is a problem, never a skip. Pure: the caller passes text.
import YAML from "yaml";

/** @typedef {import("./cuckoo-grounding.mjs").GroundingProblem} GroundingProblem */
/**
 * @typedef {{ problems: GroundingProblem[]; checked: number; skippedOfficial: number; multi: number; keyRanks: Record<string, number> }} KeyLengthResult
 * @typedef {{ problem: GroundingProblem | null; keyRank: string | null }} QuestionVerdict
 */

/** Key chars / longest distractor chars at or above this fails (MF-0042 findings; user decision MF-0044 C-2). */
export const KEY_LENGTH_LIMIT = 1.15;

/** Share of a pack's ranked questions any one key-length rank may hold; above it fails (user, MF-0061 U-7). */
export const KEY_RANK_LIMIT = 0.4;

/** Packs with fewer ranked questions are skipped: a share over a handful of questions is noise (MF-0061 U-7). */
export const KEY_RANK_MIN_QUESTIONS = 10;

const LIMIT_PERCENT = Math.round(KEY_RANK_LIMIT * 100);

/**
 * The key's length-rank name among `optionCount` options: rank = 1 + the options strictly longer than the key, so ties
 * share the better rank. The last rank (key strictly shorter than every other option) is "shortest"; the others are
 * "longest", "2nd longest", "3rd longest", "4th longest", … (MF-0061 review 3 note 3: correct for 2–6 options). With
 * 2-option questions one of the two ranks always holds ≥ 50%, so such a pack cannot pass the 40% limit; no shipped pack
 * has them (every select-1 question has 4 options).
 * @param {number} rank
 * @param {number} optionCount
 */
export function rankName(rank, optionCount) {
  if (rank === optionCount && rank > 1) return "shortest";
  if (rank === 1) return "longest";
  const suffix = rank === 2 ? "nd" : rank === 3 ? "rd" : "th";
  return `${rank}${suffix} longest`;
}

/** Report order: longest, 2nd longest, …, shortest last. */
const rankOrder = (name) =>
  name === "longest"
    ? 1
    : name === "shortest"
      ? Number.POSITIVE_INFINITY
      : Number.parseInt(name, 10);

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
 * length. The structure is always checked; `compareLengths: false` (an official item) skips only the length
 * comparison, so a malformed question is never skipped (MF-0044 review).
 * @param {{ file: string; id: string; options: unknown; compareLengths: boolean }} input
 * @returns {QuestionVerdict}
 */
function questionVerdict({ file, id, options, compareLengths }) {
  /** @param {GroundingProblem} found */
  const bad = (found) => ({ problem: found, keyRank: null });
  if (!Array.isArray(options))
    return bad(problem(file, `${id}: select: 1 needs an options list`));
  /** @type {{ text: string; correct: boolean }[]} */
  const parsed = [];
  for (const [i, option] of options.entries()) {
    if (
      typeof option?.text !== "string" ||
      typeof option?.correct !== "boolean"
    )
      return bad(
        problem(
          file,
          `${id}: option ${i + 1} needs a text string and a correct boolean`,
        ),
      );
    parsed.push({ text: option.text, correct: option.correct });
  }
  const [key, ...extraKeys] = parsed.filter((o) => o.correct);
  if (!key || extraKeys.length > 0)
    return bad(
      problem(
        file,
        `${id}: select: 1 needs exactly one correct option, found ${extraKeys.length + (key ? 1 : 0)}`,
      ),
    );
  const distractors = parsed.filter((o) => !o.correct);
  if (distractors.length === 0)
    return bad(problem(file, `${id}: select: 1 needs at least one distractor`));
  const longest = Math.max(...distractors.map((o) => charCount(o.text)));
  if (longest === 0)
    return bad(problem(file, `${id}: every distractor is empty`));
  if (!compareLengths) return { problem: null, keyRank: null };
  const keyChars = charCount(key.text);
  const keyRank = rankName(
    1 + distractors.filter((o) => charCount(o.text) > keyChars).length,
    parsed.length,
  );
  const ratio = keyChars / longest;
  if (ratio < KEY_LENGTH_LIMIT) return { problem: null, keyRank };
  return {
    problem: problem(
      file,
      `${id}: key is ${keyChars} chars, longest distractor ${longest} (${ratio.toFixed(2)}×, limit ${KEY_LENGTH_LIMIT}×)`,
    ),
    keyRank,
  };
}

/**
 * One problem per key-length rank that holds more than KEY_RANK_LIMIT of a pack's ranked questions; [] for a pack
 * under KEY_RANK_MIN_QUESTIONS. Integer comparison, so exactly 40% passes; the printed share is rounded UP, so a failing
 * share never reads as the limit (MF-0061 delta review note 2).
 * @param {{ pack: string; checked: number; keyRanks: Record<string, number> }} input
 * @returns {GroundingProblem[]}
 */
export function keyRankProblems({ pack, checked, keyRanks }) {
  if (checked < KEY_RANK_MIN_QUESTIONS) return [];
  const names = Object.keys(keyRanks).sort(
    (a, b) => rankOrder(a) - rankOrder(b),
  );
  return names.flatMap((name) => {
    const count = keyRanks[name] ?? 0;
    if (count * 100 <= LIMIT_PERCENT * checked) return [];
    const share = Math.ceil((count * 100) / checked);
    return [
      {
        file: `packs/${pack}`,
        rule: "key-rank",
        message: `${pack}: key-rank: key is the ${name} option in ${count} of ${checked} single-select questions (${share}%, limit ${LIMIT_PERCENT}%)`,
      },
    ];
  });
}

/**
 * Key-length problems in one `packs/<pack>/questions/*.yaml` file. An `origin: official` question is counted and
 * structure-checked, not length-checked (MF-0061); a `select` other than 1 is counted, not checked. `keyRanks[name]`
 * counts the well-formed checked questions whose key has that length rank (`rankName`; MF-0061 U-7).
 * @param {{ file: string; text: string }} input
 * @returns {KeyLengthResult}
 */
export function checkKeyLengths({ file, text }) {
  /** @type {KeyLengthResult} */
  const result = {
    problems: [],
    checked: 0,
    skippedOfficial: 0,
    multi: 0,
    keyRanks: {},
  };
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
    const isOfficial = item.origin === "official";
    if (isOfficial) result.skippedOfficial++;
    else result.checked++;
    const verdict = questionVerdict({
      file,
      id,
      options: item.options,
      compareLengths: !isOfficial,
    });
    if (verdict.problem) result.problems.push(verdict.problem);
    if (verdict.keyRank !== null)
      result.keyRanks[verdict.keyRank] =
        (result.keyRanks[verdict.keyRank] ?? 0) + 1;
  }
  return result;
}

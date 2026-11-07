import YAML from "yaml";
import type { Pack } from "../pack/types";
import type { Question } from "../questions/types";
import { MisconceptionFileSchema } from "./schema";
import type { PackMisconceptions } from "./types";

export interface ParseMisconceptionsInput {
  /** Shown at the start of every issue, e.g. `packs/subagents/misconceptions.yaml`. */
  file: string;
  text: string;
  pack: Pack;
  questions: readonly Question[];
}

export interface ParsedMisconceptions {
  data: PackMisconceptions | null;
  issues: string[];
}

/**
 * MF-0065 (DQ-7): parse and validate one pack's misconception file. Issues are `<file>: <path>: <message>`;
 * any issue makes `data` null. What cannot be read is an issue, never a skip.
 */
export function parseMisconceptions({
  file,
  text,
  pack,
  questions,
}: ParseMisconceptionsInput): ParsedMisconceptions {
  let raw: unknown;
  try {
    raw = YAML.parse(text);
  } catch (error) {
    return {
      data: null,
      issues: [
        `${file}: yaml: ${error instanceof Error ? error.message : "unreadable"}`,
      ],
    };
  }
  const parsed = MisconceptionFileSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      data: null,
      issues: parsed.error.issues.map(
        (i) => `${file}: ${i.path.join(".") || "(root)"}: ${i.message}`,
      ),
    };
  }

  const issues: string[] = [];
  const skills = new Set(
    pack.domains.flatMap((d) => d.skills.map((s) => s.code)),
  );
  const declared = new Set<string>();
  parsed.data.misconceptions.forEach((m, i) => {
    if (declared.has(m.id))
      issues.push(
        `${file}: misconceptions.${i}.id: duplicate misconception id "${m.id}"`,
      );
    declared.add(m.id);
    if (m.skill !== undefined && !skills.has(m.skill))
      issues.push(
        `${file}: misconceptions.${i}.skill: unknown skill "${m.skill}" in pack ${pack.slug}`,
      );
  });

  const byId = new Map(questions.map((q) => [q.id, q]));
  const used = new Set<string>();
  for (const [questionId, options] of Object.entries(parsed.data.tags)) {
    const question = byId.get(questionId);
    if (!question) {
      issues.push(
        `${file}: tags.${questionId}: unknown question "${questionId}" in pack ${pack.slug}`,
      );
      continue;
    }
    for (const [optionId, misconceptionId] of Object.entries(options)) {
      const path = `${file}: tags.${questionId}.${optionId}`;
      used.add(misconceptionId);
      const option = question.options.find((o) => o.id === optionId);
      if (!option) issues.push(`${path}: unknown option "${optionId}"`);
      else if (option.correct)
        issues.push(
          `${path}: option "${optionId}" of ${questionId} is correct; only a distractor carries a misconception`,
        );
      if (!declared.has(misconceptionId))
        issues.push(`${path}: undeclared misconception "${misconceptionId}"`);
    }
  }
  for (const id of declared) {
    if (!used.has(id))
      issues.push(
        `${file}: misconceptions: misconception "${id}" is never used`,
      );
  }

  if (issues.length > 0) return { data: null, issues };
  return { data: parsed.data, issues };
}

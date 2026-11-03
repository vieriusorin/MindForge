import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import YAML from "yaml";
import type { Pack } from "../pack/types";
import { QuestionFileSchema } from "./schema";
import type { Question, QuestionFile } from "./types";

export class QuestionValidationError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(`Invalid questions:\n${issues.map((i) => `  - ${i}`).join("\n")}`);
    this.name = "QuestionValidationError";
    this.issues = issues;
  }
}

/** Validate a pack's question files together (pack-wide id uniqueness, skills exist). */
export function parseQuestionFiles(
  files: QuestionFile[],
  pack: Pack,
): Question[] {
  const skills = new Set(
    pack.domains.flatMap((d) => d.skills.map((s) => s.code)),
  );
  const issues: string[] = [];
  const seenIds = new Map<string, string>();
  const out: Question[] = [];

  for (const file of files) {
    let raw: unknown;
    try {
      raw = YAML.parse(file.text);
    } catch (error) {
      issues.push(`${file.name}: yaml: ${(error as Error).message}`);
      continue;
    }
    const parsed = QuestionFileSchema.safeParse(raw);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        issues.push(
          `${file.name}: ${issue.path.join(".") || "(root)"}: ${issue.message}`,
        );
      }
      continue;
    }
    if (!skills.has(parsed.data.skill)) {
      issues.push(
        `${file.name}: skill: unknown skill "${parsed.data.skill}" in pack ${pack.slug}`,
      );
      continue;
    }
    parsed.data.questions.forEach(({ status: _legacy, ...q }, i) => {
      const first = seenIds.get(q.id);
      if (first) {
        issues.push(
          `${file.name}: questions.${i}.id: duplicate question id "${q.id}" (first in ${first})`,
        );
        return;
      }
      seenIds.set(q.id, file.name);
      out.push({ ...q, skillCode: parsed.data.skill });
    });
  }

  if (issues.length) throw new QuestionValidationError(issues);
  return out;
}

/** Read every <dir>/*.yaml for a pack from disk and validate them. A missing dir means no questions. */
export async function loadPackQuestions(
  pack: Pack,
  questionsDir: string,
): Promise<Question[]> {
  let names: string[];
  try {
    names = (await readdir(questionsDir))
      .filter((n) => n.endsWith(".yaml"))
      .sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  const files = await Promise.all(
    names.map(async (name) => ({
      name,
      text: await readFile(join(questionsDir, name), "utf8"),
    })),
  );
  return parseQuestionFiles(files, pack);
}

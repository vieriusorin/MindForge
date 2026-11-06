import { parsePath } from "./parse-path";

export interface CheckPathInput {
  /** The path file, repo-relative (e.g. `paths/claude-developer.yaml`). */
  file: string;
  text: string;
  /** Skill count per known pack slug. A slug absent here is an unknown pack. */
  packSkillCounts: ReadonlyMap<string, number>;
}

/**
 * MF-0058: one message per problem in a path file; empty when the file is valid. A file that fails
 * the schema yields only its parse error. Each slug is reported once, whatever the repeat count.
 */
export function checkPath(input: CheckPathInput): string[] {
  const { file, text, packSkillCounts } = input;
  let courses: readonly string[];
  let slug: string;
  try {
    ({ courses, slug } = parsePath(text, file));
  } catch (error) {
    return [error instanceof Error ? error.message : String(error)];
  }
  const prefix = `${file}: path "${slug}" lists`;
  const problems: string[] = [];
  const seen = new Set<string>();
  const reported = new Set<string>();
  for (const pack of courses) {
    if (seen.has(pack) && !reported.has(pack)) {
      problems.push(`${prefix} pack "${pack}" twice`);
      reported.add(pack);
    }
    seen.add(pack);
  }
  for (const pack of seen) {
    const skills = packSkillCounts.get(pack);
    if (skills === undefined) {
      problems.push(`${prefix} unknown pack "${pack}"`);
    } else if (skills === 0) {
      problems.push(
        `${prefix} pack "${pack}" with 0 skills (a course needs at least one skill)`,
      );
    }
  }
  return problems;
}

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import YAML from "yaml";
import type { z } from "zod";
import type { Pack } from "../pack/types";
import { QuestionFileSchema } from "../questions/schema";
import type { Question } from "../questions/types";
import { CardFileSchema, CuckooFileSchema, DiagramFileSchema } from "./schema";
import type {
  ContentFile,
  ContentFiles,
  Cuckoo,
  Diagram,
  LoadedPackContent,
  NatureCard,
} from "./types";

export class ContentValidationError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(`Invalid content:\n${issues.map((i) => `  - ${i}`).join("\n")}`);
    this.name = "ContentValidationError";
    this.issues = issues;
  }
}

/** YAML + schema + known skill for one file. Issues are `<file>: <path>: <message>`; null = skip it. */
function readFileData<S extends z.ZodType<{ skill: string }>>(
  file: ContentFile,
  schema: S,
  skills: ReadonlySet<string>,
  packSlug: string,
  issues: string[],
): z.infer<S> | null {
  let raw: unknown;
  try {
    raw = YAML.parse(file.text);
  } catch (error) {
    issues.push(`${file.name}: yaml: ${(error as Error).message}`);
    return null;
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      issues.push(
        `${file.name}: ${issue.path.join(".") || "(root)"}: ${issue.message}`,
      );
    }
    return null;
  }
  if (!skills.has(parsed.data.skill)) {
    issues.push(
      `${file.name}: skill: unknown skill "${parsed.data.skill}" in pack ${packSlug}`,
    );
    return null;
  }
  return parsed.data;
}

/** Validate every item file of a pack together: schemas, skills, pack-wide ids, card → diagram links. */
export function parseContent(
  files: ContentFiles,
  pack: Pack,
): LoadedPackContent {
  const skills = new Set(
    pack.domains.flatMap((d) => d.skills.map((s) => s.code)),
  );
  const issues: string[] = [];
  const firstFileOf = new Map<string, string>();
  /** Pack-wide uniqueness across item types; questions first, then diagrams, cards, cuckoos. */
  const claim = (id: string, file: string, path: string): boolean => {
    const first = firstFileOf.get(id);
    if (first) {
      issues.push(
        `${file}: ${path}: duplicate item id "${id}" (first in ${first})`,
      );
      return false;
    }
    firstFileOf.set(id, file);
    return true;
  };

  const questions: Question[] = [];
  for (const file of files.questions) {
    const data = readFileData(
      file,
      QuestionFileSchema,
      skills,
      pack.slug,
      issues,
    );
    data?.questions.forEach(({ status: _legacy, ...q }, i) => {
      if (claim(q.id, file.name, `questions.${i}.id`))
        questions.push({ ...q, skillCode: data.skill });
    });
  }

  const diagrams: Diagram[] = [];
  for (const file of files.diagrams) {
    const data = readFileData(
      file,
      DiagramFileSchema,
      skills,
      pack.slug,
      issues,
    );
    data?.diagrams.forEach((d, i) => {
      if (claim(d.id, file.name, `diagrams.${i}.id`))
        diagrams.push({ ...d, skill: data.skill });
    });
  }

  const diagramIds = new Set(diagrams.map((d) => d.id));
  const cards: NatureCard[] = [];
  for (const file of files.cards) {
    const data = readFileData(file, CardFileSchema, skills, pack.slug, issues);
    data?.cards.forEach((c, i) => {
      if (!claim(c.id, file.name, `cards.${i}.id`)) return;
      if (c.diagram !== undefined && !diagramIds.has(c.diagram)) {
        issues.push(
          `${file.name}: cards.${i}.diagram: unknown diagram "${c.diagram}"`,
        );
        return;
      }
      cards.push({ ...c, skill: data.skill });
    });
  }

  const cuckoos: Cuckoo[] = [];
  for (const file of files.cuckoos ?? []) {
    const data = readFileData(
      file,
      CuckooFileSchema,
      skills,
      pack.slug,
      issues,
    );
    data?.cuckoos.forEach((c, i) => {
      if (claim(c.id, file.name, `cuckoos.${i}.id`))
        cuckoos.push({ ...c, skill: data.skill });
    });
  }

  if (issues.length) throw new ContentValidationError(issues);
  return { questions, cards, diagrams, cuckoos };
}

async function readKind(
  packDir: string,
  kind: keyof ContentFiles,
): Promise<ContentFile[]> {
  const dir = join(packDir, kind);
  let names: string[];
  try {
    names = (await readdir(dir)).filter((n) => n.endsWith(".yaml")).sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  return Promise.all(
    names.map(async (name) => ({
      name: `${kind}/${name}`,
      text: await readFile(join(dir, name), "utf8"),
    })),
  );
}

/** Read `<packDir>/{questions,cards,diagrams,cuckoos}/*.yaml` as text. A missing dir means none. */
export async function readPackFiles(packDir: string): Promise<ContentFiles> {
  const [questions, cards, diagrams, cuckoos] = await Promise.all([
    readKind(packDir, "questions"),
    readKind(packDir, "cards"),
    readKind(packDir, "diagrams"),
    readKind(packDir, "cuckoos"),
  ]);
  return { questions, cards, diagrams, cuckoos };
}

/** Read `<packDir>/{questions,cards,diagrams,cuckoos}/*.yaml` and validate them. A missing dir means none. */
export async function loadPackContent(
  pack: Pack,
  packDir: string,
): Promise<LoadedPackContent> {
  return parseContent(await readPackFiles(packDir), pack);
}

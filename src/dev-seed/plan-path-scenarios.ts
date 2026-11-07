import { buildForest, type ForestView } from "@/engine/forest";
import { memoryBySkill } from "@/engine/memory";
import type { Pack } from "@/engine/pack";
import {
  type CourseProgress,
  isCourseComplete,
  type PathContent,
  pathProgress,
} from "@/engine/path";
import { createRandom, type Random } from "./random";
import {
  PATH_PERSONAS,
  type PathLearner,
  type PathPersona,
  type PathScenarioPlan,
  type PlannedAttempt,
  type PlannedCompletion,
  type PlannedEnrollment,
  type PlannedPathGroup,
  type SeedQuestion,
} from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

/** MF-0068: one course of the path, as the planner needs it. */
export interface PathCourseInput {
  pack: Pack;
  questions: SeedQuestion[];
}

const DISPLAY_NAMES = {
  fresh: "Flora Fresh",
  halfway: "Hana Halfway",
  midpath: "Mira Midpath",
  finisher: "Felix Finisher",
  "lapsed-path": "Luca Lapsed",
  "crammer-path": "Cora Crammer",
} as const satisfies Record<PathPersona, string>;

/** Days before `now` each persona enrolled (fresh: two hours ago). */
const ENROLLED_DAYS_AGO = {
  fresh: 2 / 24,
  halfway: 5,
  midpath: 12,
  finisher: 20,
  "lapsed-path": 45,
  "crammer-path": 3,
} as const satisfies Record<PathPersona, number>;

/** MF-0068 SC-2: what each persona's path must show, per course in path order (checked before any write). */
export function targetStatuses(
  persona: PathPersona,
  total: number,
): CourseProgress["status"][] {
  const rest = (from: number): CourseProgress["status"][] =>
    Array.from({ length: total - from }, () => "not-started" as const);
  const table = {
    fresh: rest(0),
    halfway: ["in-progress", ...rest(1)],
    midpath: ["complete", "complete", "in-progress", ...rest(3)],
    finisher: Array.from({ length: total }, () => "complete" as const),
    "lapsed-path": ["complete", "in-progress", ...rest(2)],
    "crammer-path": ["in-progress", ...rest(1)],
  } as const satisfies Record<PathPersona, CourseProgress["status"][]>;
  return [...table[persona]];
}

/** Halfway's accuracy: some wrong answers, so the partial skills look played, not scripted. */
const HALFWAY_ACCURACY = 0.75;
/** The council probe (MF-0062): 10 correct on one day stays at 2.31 d, a Sprout. */
const CRAM_PER_SKILL = 10;

interface Course {
  pack: Pack;
  skills: string[];
  bySkill: Map<string, SeedQuestion[]>;
}

function toCourse(
  input: PathCourseInput,
  excluded: ReadonlySet<string>,
): Course {
  const skills = input.pack.domains.flatMap((d) => d.skills.map((s) => s.code));
  const bySkill = new Map<string, SeedQuestion[]>(skills.map((s) => [s, []]));
  for (const q of input.questions) {
    if (q.packSlug !== input.pack.slug || excluded.has(q.questionId)) continue;
    bySkill.get(q.skillCode)?.push(q);
  }
  return { pack: input.pack, skills, bySkill };
}

function poolOf(course: Course, skill: string): SeedQuestion[] {
  const pool = course.bySkill.get(skill) ?? [];
  if (pool.length === 0)
    throw new Error(
      `planPathScenarios: skill ${skill} of ${course.pack.slug} has no playable question`,
    );
  return pool;
}

function wrongOption(question: SeedQuestion): string | undefined {
  return question.optionIds.find((id) => !question.correctOptions.includes(id));
}

/**
 * One study session `day` days before `now`, starting two hours into that day: for each skill, `count`
 * answers cycling through its questions from `offset`. Correct, unless `random` draws a miss.
 */
function session({
  email,
  course,
  skills,
  day,
  now,
  count,
  offset = 0,
  random,
}: {
  email: string;
  course: Course;
  skills: readonly string[];
  day: number;
  now: Date;
  count: (pool: readonly SeedQuestion[]) => number;
  offset?: number;
  random?: Random;
}): PlannedAttempt[] {
  const start = now.getTime() - day * DAY_MS + 2 * HOUR_MS;
  const out: PlannedAttempt[] = [];
  for (const skill of skills) {
    const pool = poolOf(course, skill);
    for (let n = 0; n < count(pool); n++) {
      const question = pool[(offset + n) % pool.length];
      if (!question) continue;
      const miss = wrongOption(question);
      const isWrong =
        miss !== undefined &&
        random !== undefined &&
        !random.chance(HALFWAY_ACCURACY);
      out.push({
        email,
        questionId: question.questionId,
        skillCode: question.skillCode,
        packSlug: course.pack.slug,
        chosen: isWrong && miss ? [miss] : [...question.correctOptions],
        correct: !isWrong,
        answeredAt: new Date(start + out.length * MINUTE_MS),
      });
    }
  }
  return out;
}

function forestAt(
  course: Course,
  attempts: readonly PlannedAttempt[],
  email: string,
  at: Date,
): ForestView {
  return buildForest(
    course.pack,
    memoryBySkill(
      attempts.filter(
        (t) =>
          t.email === email &&
          t.packSlug === course.pack.slug &&
          t.answeredAt.getTime() <= at.getTime(),
      ),
      at,
    ),
  );
}

/**
 * Two correct sessions a day apart on every skill (7.32 d, a Sapling), then the completion the MF-0058
 * recorder would write a minute later. Throws when the engine does not call the course complete then.
 */
function completeCourse({
  email,
  course,
  day,
  now,
}: {
  email: string;
  course: Course;
  day: number;
  now: Date;
}): { attempts: PlannedAttempt[]; completion: PlannedCompletion } {
  const attempts = [
    ...session({
      email,
      course,
      skills: course.skills,
      day,
      now,
      count: () => 1,
    }),
    ...session({
      email,
      course,
      skills: course.skills,
      day: day - 1,
      now,
      count: () => 1,
      offset: 1,
    }),
  ];
  const last = Math.max(...attempts.map((t) => t.answeredAt.getTime()));
  const completedAt = new Date(last + MINUTE_MS);
  if (!isCourseComplete(forestAt(course, attempts, email, completedAt)))
    throw new Error(
      `planPathScenarios: ${email} would not complete ${course.pack.slug}`,
    );
  return {
    attempts,
    completion: {
      email,
      packSlug: course.pack.slug,
      completedAt,
      packVersion: course.pack.version,
    },
  };
}

function firstDomainSkills(course: Course): string[] {
  return course.pack.domains[0]?.skills.map((s) => s.code) ?? [];
}

interface PersonaRows {
  attempts: PlannedAttempt[];
  completions: PlannedCompletion[];
}

function planPersona({
  persona,
  email,
  courses,
  now,
  random,
}: {
  persona: PathPersona;
  email: string;
  courses: readonly Course[];
  now: Date;
  random: Random;
}): PersonaRows {
  const course = (i: number): Course => {
    const c = courses[i];
    if (!c)
      throw new Error(`planPathScenarios: the path has no course ${i + 1}`);
    return c;
  };
  const completed = (pairs: readonly (readonly [number, number])[]) =>
    pairs.map(([i, day]) =>
      completeCourse({ email, course: course(i), day, now }),
    );
  const rows = (
    done: ReturnType<typeof completed>,
    extra: PlannedAttempt[] = [],
  ): PersonaRows => ({
    attempts: [...done.flatMap((d) => d.attempts), ...extra],
    completions: done.map((d) => d.completion),
  });

  switch (persona) {
    case "fresh":
      return { attempts: [], completions: [] };
    case "halfway": {
      const c = course(0);
      const half = c.skills.slice(0, Math.ceil(c.skills.length / 2));
      return rows(
        [],
        session({
          email,
          course: c,
          skills: half,
          day: 2,
          now,
          count: (pool) => Math.ceil(pool.length / 2),
          random,
        }),
      );
    }
    case "midpath":
      return rows(
        completed([
          [0, 10],
          [1, 7],
        ]),
        session({
          email,
          course: course(2),
          skills: firstDomainSkills(course(2)),
          day: 2,
          now,
          count: () => 1,
        }),
      );
    case "finisher":
      return rows(completed(courses.map((_, i) => [i, 18 - 3 * i] as const)));
    case "lapsed-path":
      return rows(
        completed([[0, 40]]),
        session({
          email,
          course: course(1),
          skills: firstDomainSkills(course(1)),
          day: 36,
          now,
          count: () => 1,
        }),
      );
    case "crammer-path":
      return rows(
        [],
        session({
          email,
          course: course(0),
          skills: course(0).skills,
          day: 2,
          now,
          count: () => CRAM_PER_SKILL,
        }),
      );
  }
}

/** Fail loud before any write: each persona shows its SC-2 state through `pathProgress` at `now`. */
function assertTargets({
  plan,
  courses,
  path,
  now,
}: {
  plan: PathScenarioPlan;
  courses: readonly Course[];
  path: PathContent;
  now: Date;
}): void {
  for (const learner of plan.learners) {
    const forests = new Map(
      courses.map((c) => [
        c.pack.slug,
        forestAt(c, plan.attempts, learner.email, now),
      ]),
    );
    const progress = pathProgress({
      path,
      completions: plan.completions
        .filter((c) => c.email === learner.email)
        .map((c) => ({
          packSlug: c.packSlug,
          completedAt: c.completedAt.toISOString(),
          packVersion: c.packVersion,
        })),
      forests,
    });
    const got = progress.courses.map((c) => c.status).join(",");
    const want = targetStatuses(learner.persona, courses.length).join(",");
    if (got !== want)
      throw new Error(
        `planPathScenarios: ${learner.persona} shows ${got}, expected ${want}`,
      );
  }
}

/**
 * MF-0068 SC-1..SC-4: the six path personas of one path (each enrolled, each in the state SC-2 names),
 * their answers and recorded completions, and two path groups on the path's first course: all six, and a
 * trio of fresh + halfway + crammer-path (2 others: the heatmap's "not enough data"). Pure: same inputs,
 * same plan. Its own PRNG stream (`seed ^ 0x0068`), so no draw of the pack worlds shifts. Throws before
 * any write when a course cannot give a persona its state, or when the demo domain is your email's.
 */
export function planPathScenarios({
  now,
  seed,
  youEmail,
  demoDomain,
  path,
  courses: inputs,
  excludeItemIds = [],
}: {
  now: Date;
  seed: number;
  youEmail: string;
  demoDomain: string;
  path: PathContent;
  courses: readonly PathCourseInput[];
  excludeItemIds?: readonly string[];
}): PathScenarioPlan {
  const you = youEmail.trim().toLowerCase();
  const domain = demoDomain.trim().toLowerCase();
  if (you.endsWith(`@${domain}`))
    throw new Error("planPathScenarios: your email must not be a demo address");
  const excluded = new Set(excludeItemIds);
  const courses = path.courses.map((slug) => {
    const input = inputs.find((c) => c.pack.slug === slug);
    if (!input) throw new Error(`planPathScenarios: course ${slug} not loaded`);
    return toCourse(input, excluded);
  });
  const firstCourse = path.courses[0];
  if (!firstCourse)
    throw new Error("planPathScenarios: the path has no course");
  const random = createRandom((seed ^ 0x0068) >>> 0);
  const emailOf = (persona: PathPersona): string => `${persona}@${domain}`;
  const startedAt = (persona: PathPersona): Date =>
    new Date(now.getTime() - ENROLLED_DAYS_AGO[persona] * DAY_MS);

  const learners: PathLearner[] = PATH_PERSONAS.map((persona) => ({
    email: emailOf(persona),
    displayName: DISPLAY_NAMES[persona],
    persona,
  }));
  const enrollments: PlannedEnrollment[] = learners.map((l) => ({
    email: l.email,
    pathSlug: path.slug,
    startedAt: startedAt(l.persona),
  }));
  const rows = learners.map((l) =>
    planPersona({ persona: l.persona, email: l.email, courses, now, random }),
  );
  const trio = ["fresh", "halfway", "crammer-path"] as const;
  const groups: PlannedPathGroup[] = [
    {
      name: `Demo path group · ${path.name}`,
      pathSlug: path.slug,
      packSlug: firstCourse,
      createdByEmail: emailOf("finisher"),
      members: PATH_PERSONAS.map((p) => ({
        email: emailOf(p),
        joinedAt: startedAt(p),
      })),
    },
    {
      name: `Demo path trio · ${path.name}`,
      pathSlug: path.slug,
      packSlug: firstCourse,
      createdByEmail: emailOf("fresh"),
      // fresh started the trio (and the path with it); the other two joined an hour later
      members: trio.map((p) => ({
        email: emailOf(p),
        joinedAt:
          p === "fresh"
            ? startedAt(p)
            : new Date(startedAt("fresh").getTime() + HOUR_MS),
      })),
    },
  ];

  const plan: PathScenarioPlan = {
    path: { slug: path.slug, courses: [...path.courses] },
    learners,
    enrollments,
    attempts: rows.flatMap((r) => r.attempts),
    completions: rows.flatMap((r) => r.completions),
    groups,
  };
  assertTargets({ plan, courses, path, now });
  return plan;
}

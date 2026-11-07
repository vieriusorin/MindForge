import {
  createLoader,
  createSerializer,
  parseAsIsoDateTime,
} from "nuqs/server";

/**
 * MF-0064 D-L10: when the lesson started (the player page's server time). Read by the close page's
 * RSC only; the player writes it once, in the link to the close screen.
 */
export const lessonDoneParsers = {
  since: parseAsIsoDateTime,
};

export const loadLessonDoneParams = createLoader(lessonDoneParsers);
const serializeLessonDone = createSerializer(lessonDoneParsers);

/** The lesson's own URL (the course map builds the same one in `startNodeHref`). */
export function lessonHref({
  packSlug,
  skillCode,
}: {
  packSlug: string;
  skillCode: string;
}): string {
  return `/play/${packSlug}/lesson/${encodeURIComponent(skillCode)}`;
}

/** The close screen for a lesson started at `since`. */
export function lessonDoneHref({
  packSlug,
  skillCode,
  since,
}: {
  packSlug: string;
  skillCode: string;
  since: Date;
}): string {
  return serializeLessonDone(`${lessonHref({ packSlug, skillCode })}/done`, {
    since,
  });
}

const FORMAT = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

/** MF-0007: when a flag or a sync happened, in UTC so server and client render the same text. */
export function formatReviewDate(iso: string): string {
  return `${FORMAT.format(new Date(iso))} UTC`;
}

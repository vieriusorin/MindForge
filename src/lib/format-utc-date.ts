const FORMAT = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

/** MF-0007, hoisted in MF-0052: an instant in UTC, so server and client render the same text. */
export function formatUtcDate(iso: string): string {
  return `${FORMAT.format(new Date(iso))} UTC`;
}

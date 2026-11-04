/** The storm's clock in whole minutes, rounded up, for the start card ("26 minutes"). */
export function formatMinutes(seconds: number): string {
  const minutes = Math.ceil(seconds / 60);
  return minutes === 1 ? "1 minute" : `${minutes} minutes`;
}

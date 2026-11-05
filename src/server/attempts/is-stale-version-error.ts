/** MF-0032: `record_attempt` raises 55000 when the registry holds another version than the one sent. */
export function isStaleVersionError(
  error: { code?: string } | null | undefined,
): boolean {
  return error?.code === "55000";
}

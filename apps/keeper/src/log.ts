/** One-line JSON log (docs/04 section 7.4). Never log keys, signatures or tokens. */
export function formatLog(
  level: 'info' | 'warn' | 'error',
  message: string,
  now: Date,
  fields: Record<string, string | number | boolean> = {},
): string {
  return JSON.stringify({ time: now.toISOString(), level, message, ...fields });
}

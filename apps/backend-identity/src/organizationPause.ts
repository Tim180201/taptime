/** Transient database denial. Never treat it as token revocation or an event receipt. */
export function isOrganizationPausedError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P0068';
}

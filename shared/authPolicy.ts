// D-139: applies only when choosing a new password. Existing passwords remain valid
// sign-in input; Supabase checks them. The PO mirrors this value in its dashboard.
export const MIN_PASSWORD_LENGTH = 10;
export const AUTH_RATE_LIMIT_MESSAGE = 'Zu viele Versuche. Bitte warten Sie einige Minuten.';
export const MOBILE_AUTH_RATE_LIMIT_MESSAGE = 'Zu viele Versuche. Bitte warte einige Minuten.';

export function isAuthRateLimited(error: unknown): boolean {
  return typeof error === 'object' && error !== null
    && (('status' in error && error.status === 429)
      || ('code' in error && error.code === 'over_request_rate_limit'));
}

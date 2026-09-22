import { createHmac, randomBytes } from 'node:crypto';

export const REQUEST_RATE_LIMIT_POLICIES = {
  enrollment_redemption: 5,
  employee_account_invitation: 3,
  general_api: 300,
  operator_api: 30,
} as const;
export type RequestRateLimitScope = keyof typeof REQUEST_RATE_LIMIT_POLICIES;

export interface RequestRateLimitDecision {
  readonly allowed: boolean;
  readonly retryAfterSeconds: number;
}

interface FixedWindow {
  count: number;
  expiresAtMilliseconds: number;
}

const WINDOW_MILLISECONDS = 60_000;
const MAX_ACTIVE_WINDOWS = 100_000;

export class RequestRateLimiter {
  private readonly addressHmacKey: Buffer;
  private readonly windows = new Map<string, FixedWindow>();
  private cleanupTimer: ReturnType<typeof setTimeout> | undefined;
  private cleanupAtMilliseconds: number | undefined;

  constructor(
    private readonly now: () => number = Date.now,
    addressHmacKey: Uint8Array = randomBytes(32),
    private readonly maxActiveWindows: number = MAX_ACTIVE_WINDOWS,
  ) {
    if (addressHmacKey.byteLength !== 32) {
      throw new Error('Request rate-limit HMAC key must contain exactly 32 bytes');
    }
    if (!Number.isSafeInteger(maxActiveWindows) || maxActiveWindows < 1) {
      throw new Error('Request rate-limit active-window capacity must be a positive integer');
    }
    this.addressHmacKey = Buffer.from(addressHmacKey);
  }

  take(scope: RequestRateLimitScope, clientAddress: string): RequestRateLimitDecision {
    const now = this.now();
    const key = `${scope}:${createHmac('sha256', this.addressHmacKey)
      .update(clientAddress, 'utf8')
      .digest('base64url')}`;
    const existing = this.windows.get(key);
    const limit = REQUEST_RATE_LIMIT_POLICIES[scope];

    if (existing === undefined || now >= existing.expiresAtMilliseconds) {
      if (existing === undefined && this.windows.size >= this.maxActiveWindows) {
        return {
          allowed: false,
          retryAfterSeconds: Math.max(
            1,
            Math.ceil(((this.cleanupAtMilliseconds ?? now + WINDOW_MILLISECONDS) - now) / 1_000),
          ),
        };
      }
      const expiresAtMilliseconds = now + WINDOW_MILLISECONDS;
      this.windows.set(key, {
        count: 1,
        expiresAtMilliseconds,
      });
      this.scheduleCleanup(expiresAtMilliseconds);
      return { allowed: true, retryAfterSeconds: 0 };
    }

    if (existing.count >= limit) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((existing.expiresAtMilliseconds - now) / 1_000)),
      };
    }

    existing.count += 1;
    return { allowed: true, retryAfterSeconds: 0 };
  }

  close(): void {
    if (this.cleanupTimer !== undefined) {
      clearTimeout(this.cleanupTimer);
      this.cleanupTimer = undefined;
      this.cleanupAtMilliseconds = undefined;
    }
    this.windows.clear();
  }

  private scheduleCleanup(expiresAtMilliseconds: number): void {
    if (
      this.cleanupTimer !== undefined
      && this.cleanupAtMilliseconds !== undefined
      && this.cleanupAtMilliseconds <= expiresAtMilliseconds
    ) {
      return;
    }
    if (this.cleanupTimer !== undefined) {
      clearTimeout(this.cleanupTimer);
    }
    this.cleanupAtMilliseconds = expiresAtMilliseconds;
    this.cleanupTimer = setTimeout(() => this.removeExpiredWindows(), Math.max(
      1,
      expiresAtMilliseconds - this.now(),
    ));
    this.cleanupTimer.unref();
  }

  private removeExpiredWindows(): void {
    this.cleanupTimer = undefined;
    this.cleanupAtMilliseconds = undefined;
    const now = this.now();
    let nextExpiry: number | undefined;
    for (const [key, window] of this.windows) {
      if (now >= window.expiresAtMilliseconds) {
        this.windows.delete(key);
      } else if (nextExpiry === undefined || window.expiresAtMilliseconds < nextExpiry) {
        nextExpiry = window.expiresAtMilliseconds;
      }
    }
    if (nextExpiry !== undefined) {
      this.scheduleCleanup(nextExpiry);
    }
  }
}

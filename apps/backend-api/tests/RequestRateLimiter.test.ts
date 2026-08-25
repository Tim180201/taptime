import { afterEach, describe, expect, it, vi } from 'vitest';
import { RequestRateLimiter } from '../src/RequestRateLimiter.js';

describe('in-memory request rate limiter', () => {
  afterEach(() => vi.useRealTimers());

  it('keeps only keyed address features and removes them without another request', () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    const address = '192.0.2.44';
    const limiter = new RequestRateLimiter(Date.now, Buffer.alloc(32, 7));
    expect(limiter.take('enrollment_redemption', address).allowed).toBe(true);

    const windows = internalWindows(limiter);
    expect([...windows.keys()]).toHaveLength(1);
    expect([...windows.keys()][0]).not.toContain(address);
    expect(JSON.stringify([...windows])).not.toContain(address);

    vi.advanceTimersByTime(59_999);
    expect([...windows.keys()]).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect([...windows.keys()]).toHaveLength(0);
  });

  it('bounds active address state and fails closed until the earliest expiry', () => {
    const limiter = new RequestRateLimiter(() => 10_000, Buffer.alloc(32, 9), 2);
    expect(limiter.take('general_api', '192.0.2.44').allowed).toBe(true);
    expect(limiter.take('general_api', '192.0.2.45').allowed).toBe(true);
    expect(limiter.take('general_api', '192.0.2.46')).toEqual({
      allowed: false,
      retryAfterSeconds: 60,
    });
    expect(internalWindows(limiter)).toHaveLength(2);
    limiter.close();
  });

  it('keeps the general API allowance deliberately generous', () => {
    const limiter = new RequestRateLimiter(() => 10_000, Buffer.alloc(32, 8));
    for (let attempt = 1; attempt <= 300; attempt += 1) {
      expect(limiter.take('general_api', '192.0.2.44').allowed, `attempt ${attempt}`).toBe(true);
    }
    expect(limiter.take('general_api', '192.0.2.44')).toEqual({
      allowed: false,
      retryAfterSeconds: 60,
    });
    limiter.close();
  });
});

function internalWindows(limiter: RequestRateLimiter): Map<string, unknown> {
  return (limiter as unknown as { readonly windows: Map<string, unknown> }).windows;
}

import type { EmployeeMembershipEnrollmentCoordinator as EmployeeEnrollmentPort } from '@taptime/backend-api';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  composeSyntheticEmployeeEnrollmentInterruption,
  SyntheticRedemptionInterruptionController,
  type SyntheticRedemptionInterruptionEvent,
} from '../src/index.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('SyntheticRedemptionInterruptionController', () => {
  it('auto-aborts the paused attempt after exactly eight seconds', async () => {
    vi.useFakeTimers();
    const events: SyntheticRedemptionInterruptionEvent[] = [];
    const controller = new SyntheticRedemptionInterruptionController((event) => events.push(event));
    controller.armNextRedemptionInterruption();
    const attempt = controller.beginRedemptionAttempt();
    const paused = attempt.beforeCommit();
    const rejection = expect(paused).rejects.toThrow(
      'Synthetic C3E1 redemption interrupted before commit',
    );

    expect(controller.getState()).toBe('paused');
    await vi.advanceTimersByTimeAsync(7_999);
    expect(controller.getState()).toBe('paused');
    await vi.advanceTimersByTimeAsync(1);
    await rejection;
    expect(controller.getState()).toBe('disarmed');
    expect(events).toEqual([
      'redemption_interruption_armed',
      'redemption_paused',
      'redemption_interrupted',
    ]);
    attempt.finish();
  });

  it('aborts a paused attempt during idempotent shutdown', async () => {
    const events: SyntheticRedemptionInterruptionEvent[] = [];
    const controller = new SyntheticRedemptionInterruptionController((event) => events.push(event));
    controller.armNextRedemptionInterruption();
    const attempt = controller.beginRedemptionAttempt();
    const paused = attempt.beforeCommit();
    const rejection = expect(paused).rejects.toThrow(
      'Synthetic C3E1 redemption interrupted before commit',
    );

    expect(() => controller.close()).not.toThrow();
    await rejection;
    expect(() => controller.close()).not.toThrow();
    expect(controller.getState()).toBe('disarmed');
    expect(events.at(-1)).toBe('redemption_interrupted');
    attempt.finish();
  });

  it('disarms when the delegate rejects before reaching beforeCommit', async () => {
    const events: SyntheticRedemptionInterruptionEvent[] = [];
    const controller = new SyntheticRedemptionInterruptionController((event) => events.push(event));
    const delegate: EmployeeEnrollmentPort = {
      async createInvitation() {
        throw new Error('not used');
      },
      async readEmployeeMembershipsProjection() {
        throw new Error('not used');
      },
      async redeemInvitation() {
        throw new Error('synthetic delegate failure');
      },
    };
    const composed = composeSyntheticEmployeeEnrollmentInterruption(delegate, controller);
    controller.armNextRedemptionInterruption();

    await expect(composed.redeemInvitation({
      accessToken: 'sensitive-access-token',
      commandId: '70000000-0000-4000-8000-000000000201',
      invitationSecret: 'sensitive-invitation-secret',
    })).rejects.toThrow('synthetic delegate failure');
    expect(controller.getState()).toBe('disarmed');
    expect(events).toEqual(['redemption_interruption_armed']);

    const laterAttempt = controller.beginRedemptionAttempt();
    await expect(laterAttempt.beforeCommit()).resolves.toBeUndefined();
    laterAttempt.finish();
  });

  it('isolates throwing safe-event callbacks from rollback and cleanup', async () => {
    const controller = new SyntheticRedemptionInterruptionController(() => {
      throw new Error('synthetic callback failure');
    });

    expect(() => controller.armNextRedemptionInterruption()).not.toThrow();
    const attempt = controller.beginRedemptionAttempt();
    const paused = attempt.beforeCommit();
    const rejection = expect(paused).rejects.toThrow(
      'Synthetic C3E1 redemption interrupted before commit',
    );
    expect(controller.getState()).toBe('paused');
    expect(() => controller.close()).not.toThrow();
    await rejection;
    expect(controller.getState()).toBe('disarmed');
    attempt.finish();
  });

  it('clears the timer before rejecting a manual abort and rejects a double abort', async () => {
    vi.useFakeTimers();
    const events: SyntheticRedemptionInterruptionEvent[] = [];
    const controller = new SyntheticRedemptionInterruptionController((event) => events.push(event));
    controller.armNextRedemptionInterruption();
    const attempt = controller.beginRedemptionAttempt();
    const paused = attempt.beforeCommit();
    const rejection = expect(paused).rejects.toThrow(
      'Synthetic C3E1 redemption interrupted before commit',
    );

    controller.abortPausedRedemption();
    await rejection;
    expect(() => controller.abortPausedRedemption()).toThrow('No synthetic redemption is paused');
    await vi.advanceTimersByTimeAsync(8_000);
    expect(events.filter((event) => event === 'redemption_interrupted')).toHaveLength(1);
    expect(controller.getState()).toBe('disarmed');
    attempt.finish();
  });

  it('allows only the first redemption attempt to claim an arm', async () => {
    const controller = new SyntheticRedemptionInterruptionController(() => undefined);
    controller.armNextRedemptionInterruption();
    const firstAttempt = controller.beginRedemptionAttempt();
    const concurrentAttempt = controller.beginRedemptionAttempt();

    await expect(concurrentAttempt.beforeCommit()).resolves.toBeUndefined();
    concurrentAttempt.finish();
    expect(controller.getState()).toBe('armed');

    const paused = firstAttempt.beforeCommit();
    const rejection = expect(paused).rejects.toThrow(
      'Synthetic C3E1 redemption interrupted before commit',
    );
    expect(controller.getState()).toBe('paused');
    controller.abortPausedRedemption();
    await rejection;
    firstAttempt.finish();
    expect(controller.getState()).toBe('disarmed');
  });
});

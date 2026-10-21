import { describe, expect, it } from 'vitest';
import { isLockScreenActionRequest, isLockScreenCapabilityRequest, isLockScreenCapability, isLockScreenState,
  isLockScreenCapabilityResult, isLockScreenActionResult, isLockScreenHistory } from '../src/lockScreen.js';

const id = '10000000-0000-4000-8000-000000000001';
const state = { timeEntryId: id, status: 'running', startedAt: '2026-10-21T06:00:00.000Z', breakStartedAt: null,
  stoppedAt: null, asOf: '2026-10-21T06:01:00.000Z', workDurationSeconds: 60, breakDurationSeconds: 0,
  target: { targetType: 'general_work', targetId: id, displayName: 'Allgemeine Arbeitszeit' } };
describe('T104a additive lock screen contract', () => {
  it('accepts only explicit actions with canonical command IDs and no extra authority', () => {
    for (const action of ['pause', 'resume', 'stop']) expect(isLockScreenActionRequest({ action, commandId: id })).toBe(true);
    for (const action of ['toggle', 'start', '', null]) expect(isLockScreenActionRequest({ action, commandId: id })).toBe(false);
    expect(isLockScreenActionRequest({ action: 'stop', commandId: id, userId: id })).toBe(false);
    expect(isLockScreenActionRequest({ action: 'stop', commandId: 'x' })).toBe(false);
  });
  it('requires a running-entry reference and an optional canonical installation, never a client-issued key', () => {
    const request = { expectedMembershipId: id, timeEntryId: id, installationId: null };
    expect(isLockScreenCapabilityRequest(request)).toBe(true);
    expect(isLockScreenCapabilityRequest({ ...request, installationId: id })).toBe(true);
    expect(isLockScreenCapabilityRequest({ ...request, capability: 'A'.repeat(43) })).toBe(false);
    expect(isLockScreenCapabilityRequest({ ...request, installationId: '' })).toBe(false);
  });
  it('requires canonical 32-byte base64url keys and exact responses', () => {
    expect(isLockScreenCapability('A'.repeat(43))).toBe(true);
    for (const key of ['A'.repeat(42), 'A'.repeat(44), 'A'.repeat(42) + 'B', 'A'.repeat(43) + '=', 'header.payload.signature']) expect(isLockScreenCapability(key)).toBe(false);
    const result = { status: 'issued', capability: 'A'.repeat(43), expiresAt: '2026-10-22T06:00:00.000Z', state };
    expect(isLockScreenCapabilityResult(result)).toBe(true);
    expect(isLockScreenCapabilityResult({ ...result, rawToken: 'private' })).toBe(false);
    expect(isLockScreenActionResult({ status: 'applied', state, idempotentRetry: false })).toBe(true);
    expect(isLockScreenActionResult({ status: 'state_changed', state, idempotentRetry: true })).toBe(true);
    expect(isLockScreenActionResult({ status: 'unauthorized', existed: true })).toBe(false);
    expect(isLockScreenActionResult({ status: 'rate_limited', retryAfterSeconds: 0 })).toBe(false);
  });
  it('checks coherent states, pause timestamps and nonnegative whole-second durations', () => {
    expect(isLockScreenState(state)).toBe(true);
    expect(isLockScreenState({ ...state, status: 'paused', breakStartedAt: state.asOf })).toBe(true);
    expect(isLockScreenState({ ...state, status: 'stopped', stoppedAt: state.asOf })).toBe(true);
    for (const patch of [{ status: 'paused' }, { status: 'stopped' }, { status: 'running', breakStartedAt: state.asOf }, { workDurationSeconds: -1 }, { workDurationSeconds: 0.5 }, { asOf: '2026-10-20T06:00:00.000Z' }]) expect(isLockScreenState({ ...state, ...patch })).toBe(false);
  });
  it('bounds history to known actions and canonical timestamps without key-bearing fields', () => {
    const event = { workEventId: id, action: 'pause', at: state.asOf };
    expect(isLockScreenHistory([event])).toBe(true);
    expect(isLockScreenHistory([{ ...event, action: 'toggle' }])).toBe(false);
    expect(isLockScreenHistory([{ ...event, capability: 'private' }])).toBe(false);
  });
});

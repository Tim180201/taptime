import { describe, expect, it } from 'vitest';
import { buildScanDemoPipeline, DEMO_KNOWN_PAYLOAD } from '../../src/cli/runScan';
import { SessionService, toCallerContext } from '../../src/application/SessionService';
import { DEFAULT_DEMO_ACCOUNT, FakeAuthenticationGateway } from '../../src/infrastructure/adapters/FakeAuthenticationGateway';
import { authenticatedCaller, UNAUTHENTICATED_CALLER } from '../../src/domain/CallerContext';

// DT-014: proves buildScanDemoPipeline's scan() extension is additive, not a behavior
// change. The pre-existing single-argument call (used by the CLI, npm run demo:scan) must
// keep working exactly as before; an externally-produced CallerContext (e.g. from
// SessionService, DT-013) must be honored when supplied.
describe('buildScanDemoPipeline external CallerContext support (DT-014)', () => {
  it('preserves the existing hard-coded demo caller when scan() is called with one argument, as the CLI does', () => {
    const lines: string[] = [];
    const pipeline = buildScanDemoPipeline((line) => lines.push(line));

    const outcome = pipeline.scan(DEMO_KNOWN_PAYLOAD);

    expect(outcome).toEqual({
      stage: 'validation',
      result: expect.objectContaining({
        status: 'accepted',
        caller: authenticatedCaller(DEFAULT_DEMO_ACCOUNT.userId, DEFAULT_DEMO_ACCOUNT.organizationId),
      }),
    });
  });

  it('uses a session-derived CallerContext when explicitly supplied, reaching the same accepted outcome as SessionDerivedCallerPipeline.test.ts proves', () => {
    const sessionService = new SessionService(new FakeAuthenticationGateway());
    const authenticationResult = sessionService.signIn({ signInCode: DEFAULT_DEMO_ACCOUNT.signInCode });
    const sessionCaller = toCallerContext(authenticationResult);

    const lines: string[] = [];
    const pipeline = buildScanDemoPipeline((line) => lines.push(line));

    const outcome = pipeline.scan(DEMO_KNOWN_PAYLOAD, sessionCaller);

    expect(outcome.stage).toBe('validation');
    expect(outcome).toEqual({
      stage: 'validation',
      result: expect.objectContaining({ status: 'accepted', caller: sessionCaller }),
    });
    expect(lines.some((line) => line.includes('accepted and started'))).toBe(true);
  });

  it('surfaces AssignmentValidator\'s existing employee_not_authenticated rejection, unmodified, for a rejected session', () => {
    const sessionService = new SessionService(new FakeAuthenticationGateway());
    const authenticationResult = sessionService.signIn({ signInCode: 'not-a-real-code' });
    const sessionCaller = toCallerContext(authenticationResult);
    expect(sessionCaller).toEqual(UNAUTHENTICATED_CALLER);

    const pipeline = buildScanDemoPipeline(() => {});

    const outcome = pipeline.scan(DEMO_KNOWN_PAYLOAD, sessionCaller);

    expect(outcome).toEqual({
      stage: 'validation',
      result: expect.objectContaining({ status: 'rejected', reason: 'employee_not_authenticated' }),
    });
  });

  it('does not let an externally-produced caller leak into a later default-argument call', () => {
    const sessionCaller = authenticatedCaller(DEFAULT_DEMO_ACCOUNT.userId, DEFAULT_DEMO_ACCOUNT.organizationId);
    const pipeline = buildScanDemoPipeline(() => {});

    pipeline.scan(DEMO_KNOWN_PAYLOAD, sessionCaller);
    const secondOutcome = pipeline.scan('some-unrelated-payload');

    expect(secondOutcome).toEqual({ stage: 'resolution', status: 'rejected', reason: 'unknown_tag' });
  });
});

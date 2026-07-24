import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { Interface } from 'node:readline';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DA4_V5_PROFILE,
  DA4_V5_INITIAL_STATUS,
  DA4_V5_PUBLIC_MANIFEST,
  DA4_V5_READ_PROJECTION_ROUTES,
  DA4_V5_WRITE_PLAN,
  createDa4V5AdminWebServer,
  Da4V5InputOwnership,
  Da4V5OperationSession,
  Da4V5OperatorLifecycle,
  Da4V5ReadFaultController,
  Da4V5SignalController,
  Da4V5StartupInterrupted,
  MemoryOnlySyntheticPasswordBinding,
  createDa4V5ArtifactManifest,
  expectedDa4V5Status,
  loadAndVerifyDa4V5Artifact,
  requireDa4V5Profile,
  runDa4V5StrictCleanup,
  validateDa4V5Timezone,
  type Da4V5FixtureManifest,
  type Da4V5AdminWebServer,
} from '../src/index.js';

const temporaryDirectories: string[] = [];
const openHttpServers: Server[] = [];
const openAdminWebServers: Da4V5AdminWebServer[] = [];

afterEach(async () => {
  await Promise.all(openAdminWebServers.splice(0).map((server) => server.close()));
  await Promise.all(openHttpServers.splice(0).map(closeHttpServer));
  await Promise.all(temporaryDirectories.splice(0).map((directory) => (
    rm(directory, { recursive: true, force: true })
  )));
});

describe('DA4 V5 opt-in and credential boundaries', () => {
  it('accepts only the exact profile and rejects missing or unknown input', () => {
    expect(requireDa4V5Profile(DA4_V5_PROFILE)).toBe('da4-v5');
    expect(() => requireDa4V5Profile(undefined)).toThrow(/exact explicit/);
    expect(() => requireDa4V5Profile('default')).toThrow(/exact explicit/);
    expect(() => requireDa4V5Profile('DA4-V5')).toThrow(/exact explicit/);
  });

  it('binds the startup password in memory and reports only match or mismatch', () => {
    const binding = new MemoryOnlySyntheticPasswordBinding('Synthetic-DA4-V5-Password!');
    expect(binding.compare('Synthetic-DA4-V5-Password!')).toBe('match');
    expect(binding.compare('Synthetic-DA4-V5-Password?')).toBe('mismatch');
    binding.destroy();
    expect(binding.compare('Synthetic-DA4-V5-Password!')).toBe('mismatch');
  });

  it('fails closed for ambiguous browser-local correction timestamps', () => {
    const safeManifest = manifestAt('2026-07-23T10:00:00.000Z');
    expect(validateDa4V5Timezone('Europe/Berlin', safeManifest)).toBe('match');

    const ambiguousManifest = manifestAt('2026-10-25T00:30:00.000Z');
    expect(validateDa4V5Timezone('Europe/Berlin', ambiguousManifest)).toBe('mismatch');
    expect(validateDa4V5Timezone('not/a-zone', safeManifest)).toBe('mismatch');
  });
});

describe('DA4 V5 single-use read fault', () => {
  it.each(Object.entries(DA4_V5_READ_PROJECTION_ROUTES))(
    'consumes exactly one allow-listed %s projection POST',
    (section, path) => {
      const control = new Da4V5ReadFaultController();
      control.arm(section as keyof typeof DA4_V5_READ_PROJECTION_ROUTES);
      expect(control.consume('GET', path)).toBe(false);
      expect(control.consume('POST', `${path}/other`)).toBe(false);
      expect(control.consume('POST', path)).toBe(true);
      expect(control.consume('POST', path)).toBe(false);
      expect(() => control.arm(section as keyof typeof DA4_V5_READ_PROJECTION_ROUTES))
        .toThrow(/cannot be armed/);
    },
  );

  it.each([
    '/v1/administration/customers',
    '/v1/administration/employee-invitations',
    '/v1/administration/nfc-tags/reassign',
    '/v1/administration/time-records/correct',
    '/v1/administration/review-items/adjudicate',
    '/v1/administration/time-entries/export',
  ])('never consumes mutating POST route %s', (path) => {
    const control = new Da4V5ReadFaultController();
    control.arm('setup');
    expect(control.consume('POST', path)).toBe(false);
    expect(control.getState()).toEqual({ state: 'armed', section: 'setup' });
  });

  it('rejects concurrent arming before the first fault is consumed', () => {
    const control = new Da4V5ReadFaultController();
    control.arm('setup');
    expect(() => control.arm('employees')).toThrow(/cannot be armed/);
  });
});

describe('DA4 V5 serial write allocation', () => {
  it('accepts only the exact Safari-three then Chromium-three aggregate sequence', () => {
    const session = new Da4V5OperationSession(DA4_V5_INITIAL_STATUS);
    let current = { ...DA4_V5_INITIAL_STATUS };
    expect(session.state()).toMatchObject({
      state: 'awaiting',
      browser: 'safari',
      operation: 'create-customer',
    });

    for (const [index, step] of DA4_V5_WRITE_PLAN.entries()) {
      for (const [key, delta] of Object.entries(step.delta)) {
        current[key as keyof typeof current] += delta;
      }
      expect(session.checkpoint(step.browser, step.operation, current)).toBe('match');
      expect(session.state().step).toBe(Math.min(index + 2, 6));
    }
    expect(session.state()).toEqual({ state: 'complete', step: 6 });
  });

  it('accepts the independent two-audit reassignment and seven-audit final invariant', () => {
    const session = new Da4V5OperationSession(DA4_V5_INITIAL_STATUS);
    const afterCustomer = {
      ...DA4_V5_INITIAL_STATUS,
      auditEvents: DA4_V5_INITIAL_STATUS.auditEvents + 1,
      customerReceipts: 1,
      customers: 22,
    };
    const afterInvitation = {
      ...afterCustomer,
      activeInvitations: 1,
      auditEvents: DA4_V5_INITIAL_STATUS.auditEvents + 2,
      employeeInvitationReceipts: 1,
      unconsumedInvitations: 1,
    };
    const afterReassignment = {
      ...afterInvitation,
      auditEvents: DA4_V5_INITIAL_STATUS.auditEvents + 4,
      reassignmentReceipts: 1,
      totalAssignments: 2,
    };
    const afterCorrection = {
      ...afterReassignment,
      auditEvents: DA4_V5_INITIAL_STATUS.auditEvents + 5,
      timeRecordRevisions: 1,
      timeReviewCommandReceipts: 1,
    };
    const afterExport = {
      ...afterCorrection,
      auditEvents: DA4_V5_INITIAL_STATUS.auditEvents + 6,
      exportAudits: 1,
    };
    const final = {
      ...afterExport,
      auditEvents: DA4_V5_INITIAL_STATUS.auditEvents + 7,
      reviewAdjudications: 1,
      timeReviewCommandReceipts: 2,
      unresolvedReviews: 100,
    };

    expect(session.checkpoint('safari', 'create-customer', afterCustomer)).toBe('match');
    expect(session.checkpoint('safari', 'create-invitation', afterInvitation)).toBe('match');
    expect(afterInvitation).toMatchObject({
      activeInvitations: 1,
      expiredUnconsumedInvitations: 0,
      unconsumedInvitations: 1,
    });
    expect(afterReassignment.auditEvents - afterInvitation.auditEvents).toBe(2);
    expect(session.checkpoint('safari', 'reassign-tag', afterReassignment)).toBe('match');
    expect(session.checkpoint('chromium', 'correct-time-record', afterCorrection)).toBe('match');
    expect(session.checkpoint('chromium', 'export-time-entries', afterExport)).toBe('match');
    expect(session.checkpoint('chromium', 'adjudicate-review', final)).toBe('match');
    expect(final.auditEvents).toBe(DA4_V5_INITIAL_STATUS.auditEvents + 7);
    expect(session.state()).toEqual({ state: 'complete', step: 6 });
  });

  it('accepts active to active to expired to expired as a monotonic invitation transition', () => {
    const session = new Da4V5OperationSession(DA4_V5_INITIAL_STATUS);
    const afterCustomer = expectedDa4V5Status(DA4_V5_INITIAL_STATUS, 1);
    const afterInvitation = expectedDa4V5Status(DA4_V5_INITIAL_STATUS, 2);
    const afterReassignment = expectedDa4V5Status(DA4_V5_INITIAL_STATUS, 3);

    expect(session.checkpoint('safari', 'create-customer', afterCustomer)).toBe('match');
    expect(session.checkpoint('safari', 'create-invitation', afterInvitation)).toBe('match');
    expect(session.checkpoint('safari', 'reassign-tag', afterReassignment)).toBe('match');

    for (let completedSteps = 4; completedSteps <= DA4_V5_WRITE_PLAN.length; completedSteps += 1) {
      const step = DA4_V5_WRITE_PLAN[completedSteps - 1];
      if (step === undefined) {
        throw new Error('DA4 V5 write-plan test step is missing');
      }
      const expected = expectedDa4V5Status(DA4_V5_INITIAL_STATUS, completedSteps);
      const expired = {
        ...expected,
        activeInvitations: 0,
        expiredUnconsumedInvitations: 1,
      };
      expect(session.checkpoint(step.browser, step.operation, expired)).toBe('match');
    }

    expect(session.state()).toEqual({ state: 'complete', step: 6 });
  });

  it('fails permanently when an expired invitation reverts to active', () => {
    const session = new Da4V5OperationSession(DA4_V5_INITIAL_STATUS);
    const afterCustomer = expectedDa4V5Status(DA4_V5_INITIAL_STATUS, 1);
    const afterInvitation = expectedDa4V5Status(DA4_V5_INITIAL_STATUS, 2);
    const expectedReassignment = expectedDa4V5Status(DA4_V5_INITIAL_STATUS, 3);
    const expiredReassignment = {
      ...expectedReassignment,
      activeInvitations: 0,
      expiredUnconsumedInvitations: 1,
    };
    const activeCorrection = expectedDa4V5Status(DA4_V5_INITIAL_STATUS, 4);
    const expiredCorrection = {
      ...activeCorrection,
      activeInvitations: 0,
      expiredUnconsumedInvitations: 1,
    };

    expect(session.checkpoint('safari', 'create-customer', afterCustomer)).toBe('match');
    expect(session.checkpoint('safari', 'create-invitation', afterInvitation)).toBe('match');
    expect(session.checkpoint('safari', 'reassign-tag', expiredReassignment)).toBe('match');
    expect(session.checkpoint('chromium', 'correct-time-record', activeCorrection))
      .toBe('mismatch');
    expect(session.checkpoint('chromium', 'correct-time-record', expiredCorrection))
      .toBe('mismatch');
  });

  it('requires the invitation to be active at its immediate checkpoint and fails permanently', () => {
    const session = new Da4V5OperationSession(DA4_V5_INITIAL_STATUS);
    const afterCustomer = expectedDa4V5Status(DA4_V5_INITIAL_STATUS, 1);
    const expectedInvitation = expectedDa4V5Status(DA4_V5_INITIAL_STATUS, 2);
    const alreadyExpired = {
      ...expectedInvitation,
      activeInvitations: 0,
      expiredUnconsumedInvitations: 1,
    };

    expect(session.checkpoint('safari', 'create-customer', afterCustomer)).toBe('match');
    expect(session.checkpoint('safari', 'create-invitation', alreadyExpired)).toBe('mismatch');
    expect(session.checkpoint('safari', 'create-invitation', expectedInvitation)).toBe('mismatch');
  });

  it.each([
    {
      name: 'missing invitation',
      invitation: { activeInvitations: 0, expiredUnconsumedInvitations: 0, unconsumedInvitations: 0 },
    },
    {
      name: 'consumed invitation',
      invitation: { activeInvitations: 0, expiredUnconsumedInvitations: 0, unconsumedInvitations: 0 },
    },
    {
      name: 'duplicate active invitations',
      invitation: { activeInvitations: 2, expiredUnconsumedInvitations: 0, unconsumedInvitations: 2 },
    },
    {
      name: 'duplicate mixed invitations',
      invitation: { activeInvitations: 1, expiredUnconsumedInvitations: 1, unconsumedInvitations: 2 },
    },
    {
      name: 'unclassified unconsumed invitation',
      invitation: { activeInvitations: 0, expiredUnconsumedInvitations: 0, unconsumedInvitations: 1 },
    },
    {
      name: 'inconsistently double-classified invitation',
      invitation: { activeInvitations: 1, expiredUnconsumedInvitations: 1, unconsumedInvitations: 1 },
    },
  ])('fails permanently for $name at a later checkpoint', ({ invitation }) => {
    const session = new Da4V5OperationSession(DA4_V5_INITIAL_STATUS);
    const afterCustomer = expectedDa4V5Status(DA4_V5_INITIAL_STATUS, 1);
    const afterInvitation = expectedDa4V5Status(DA4_V5_INITIAL_STATUS, 2);
    const expectedReassignment = expectedDa4V5Status(DA4_V5_INITIAL_STATUS, 3);

    expect(session.checkpoint('safari', 'create-customer', afterCustomer)).toBe('match');
    expect(session.checkpoint('safari', 'create-invitation', afterInvitation)).toBe('match');
    expect(session.checkpoint('safari', 'reassign-tag', {
      ...expectedReassignment,
      ...invitation,
    })).toBe('mismatch');
    expect(session.checkpoint(
      'safari',
      'reassign-tag',
      expectedReassignment,
    )).toBe('mismatch');
  });

  it('fails closed when reassignment reports only one new audit event', () => {
    const session = new Da4V5OperationSession(DA4_V5_INITIAL_STATUS);
    const afterCustomer = {
      ...DA4_V5_INITIAL_STATUS,
      auditEvents: DA4_V5_INITIAL_STATUS.auditEvents + 1,
      customerReceipts: 1,
      customers: 22,
    };
    const afterInvitation = {
      ...afterCustomer,
      activeInvitations: 1,
      auditEvents: DA4_V5_INITIAL_STATUS.auditEvents + 2,
      employeeInvitationReceipts: 1,
      unconsumedInvitations: 1,
    };
    const staleOneAuditReassignment = {
      ...afterInvitation,
      auditEvents: DA4_V5_INITIAL_STATUS.auditEvents + 3,
      reassignmentReceipts: 1,
      totalAssignments: 2,
    };
    const correctedTwoAuditReassignment = {
      ...staleOneAuditReassignment,
      auditEvents: DA4_V5_INITIAL_STATUS.auditEvents + 4,
    };

    expect(session.checkpoint('safari', 'create-customer', afterCustomer)).toBe('match');
    expect(session.checkpoint('safari', 'create-invitation', afterInvitation)).toBe('match');
    expect(session.checkpoint(
      'safari',
      'reassign-tag',
      staleOneAuditReassignment,
    )).toBe('mismatch');
    expect(session.checkpoint(
      'safari',
      'reassign-tag',
      correctedTwoAuditReassignment,
    )).toBe('mismatch');
  });

  it('does not advance on wrong browser, order, duplicate, or aggregate drift', () => {
    const session = new Da4V5OperationSession(DA4_V5_INITIAL_STATUS);
    expect(session.checkpoint(
      'chromium',
      'create-customer',
      { ...DA4_V5_INITIAL_STATUS, customers: 22, customerReceipts: 1, auditEvents: 102 },
    )).toBe('mismatch');
    expect(session.checkpoint(
      'safari',
      'create-invitation',
      {
        ...DA4_V5_INITIAL_STATUS,
        activeInvitations: 1,
        unconsumedInvitations: 1,
      },
    )).toBe('mismatch');
    expect(session.checkpoint(
      'safari',
      'create-customer',
      {
        ...DA4_V5_INITIAL_STATUS,
        customers: 22,
        customerReceipts: 1,
        auditEvents: 102,
        workEvents: 304,
      },
    )).toBe('mismatch');
    expect(session.state()).toMatchObject({ state: 'awaiting', step: 1 });
    expect(session.checkpoint(
      'safari',
      'create-customer',
      {
        ...DA4_V5_INITIAL_STATUS,
        customers: 22,
        customerReceipts: 1,
        auditEvents: 102,
      },
    )).toBe('mismatch');
  });
});

describe('DA4 V5 fail-stop and cleanup controls', () => {
  it('completes strict cleanup only after every successful stage runs', async () => {
    const calls: string[] = [];
    await expect(runDa4V5StrictCleanup({
      closeResources: [
        async () => {
          calls.push('resource-1');
        },
        async () => {
          calls.push('resource-2');
        },
      ],
      closeDatabase: async () => {
        calls.push('database');
      },
      closeInstaller: async () => {
        calls.push('installer');
      },
    })).resolves.toBeUndefined();
    expect(calls).toEqual(['resource-1', 'resource-2', 'database', 'installer']);
  });

  it('attempts every cleanup stage and reports only a generic failure', async () => {
    const calls: string[] = [];
    await expect(runDa4V5StrictCleanup({
      closeResources: [
        async () => {
          calls.push('resource-1');
          throw new Error('secret resource detail');
        },
        async () => {
          calls.push('resource-2');
        },
      ],
      closeDatabase: async () => {
        calls.push('database');
        throw new Error('secret database detail');
      },
      closeInstaller: async () => {
        calls.push('installer');
      },
    })).rejects.toThrow('DA4 V5 cleanup failed');
    expect(calls).toEqual(['resource-1', 'resource-2', 'database', 'installer']);
  });

  it('latches a failed command, cleans exactly once, and never runs the next command', async () => {
    const events: string[] = [];
    const cleanup = vi.fn(async () => undefined);
    const markFailed = vi.fn();
    const lifecycle = new Da4V5OperatorLifecycle(cleanup, (event) => events.push(event), markFailed);
    await lifecycle.submit(async () => ({
      state: 'fail',
      event: 'da4_v5_write_checkpoint=mismatch',
    }));
    const nextCommand = vi.fn(async () => ({ state: 'continue' as const }));
    await lifecycle.submit(nextCommand);

    expect(events).toEqual(['da4_v5_write_checkpoint=mismatch']);
    expect(markFailed).toHaveBeenCalledTimes(1);
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(nextCommand).not.toHaveBeenCalled();
    expect(lifecycle.isActive()).toBe(false);
  });

  it('never reports stopped when cleanup fails', async () => {
    const events: string[] = [];
    const lifecycle = new Da4V5OperatorLifecycle(
      async () => {
        throw new Error('private cleanup detail');
      },
      (event) => events.push(event),
      vi.fn(),
    );
    await lifecycle.stop();
    expect(events).toEqual(['da4_v5_cleanup_failed']);
  });

  it('retains normal stop as the only successful stopped event', async () => {
    const events: string[] = [];
    const markFailed = vi.fn();
    const cleanup = vi.fn(async () => undefined);
    const lifecycle = new Da4V5OperatorLifecycle(
      cleanup,
      (event) => events.push(event),
      markFailed,
    );
    await lifecycle.stop();
    expect(events).toEqual(['da4_v5_stopped']);
    expect(markFailed).not.toHaveBeenCalled();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('latches a pre-readiness signal and waits for startup resource settlement before cleanup', async () => {
    const events: string[] = [];
    const markFailed = vi.fn();
    const cleanup = vi.fn(async () => undefined);
    const resource = deferred<void>();
    const signal = new Da4V5SignalController((event) => events.push(event), markFailed);
    let resourceCreated = false;
    const startup = (async () => {
      await resource.promise;
      resourceCreated = true;
      signal.checkpoint();
    })().catch(async (error: unknown) => {
      expect(error).toBeInstanceOf(Da4V5StartupInterrupted);
      expect(resourceCreated).toBe(true);
      await cleanup();
    });

    const firstSignal = signal.handleSignal();
    const repeatedSignal = signal.handleSignal();
    expect(firstSignal).toBe(repeatedSignal);
    expect(cleanup).not.toHaveBeenCalled();
    resource.resolve();
    await Promise.all([firstSignal, repeatedSignal, startup]);

    expect(events).toEqual(['da4_v5_interrupted']);
    expect(markFailed).toHaveBeenCalledTimes(1);
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(signal.isInterrupted()).toBe(true);
  });

  it('latches a post-readiness signal, exits failed, and cleans exactly once without stopped', async () => {
    const events: string[] = [];
    const markFailed = vi.fn();
    const cleanupRelease = deferred<void>();
    const cleanup = vi.fn(() => cleanupRelease.promise);
    const lifecycle = new Da4V5OperatorLifecycle(
      cleanup,
      (event) => events.push(event),
      markFailed,
    );
    const signal = new Da4V5SignalController((event) => events.push(event), markFailed);
    signal.bind(lifecycle);

    const firstSignal = signal.handleSignal();
    const repeatedSignal = signal.handleSignal();
    expect(firstSignal).toBe(repeatedSignal);
    expect(cleanup).toHaveBeenCalledTimes(1);
    cleanupRelease.resolve();
    await Promise.all([firstSignal, repeatedSignal]);

    const nextCommand = vi.fn(async () => ({ state: 'continue' as const }));
    await lifecycle.submit(nextCommand);
    expect(events).toEqual(['da4_v5_interrupted']);
    expect(events).not.toContain('da4_v5_stopped');
    expect(markFailed).toHaveBeenCalledTimes(1);
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(nextCommand).not.toHaveBeenCalled();
  });

  it('converts an in-flight normal stop to failed interruption without a stopped event', async () => {
    const events: string[] = [];
    const markFailed = vi.fn();
    const cleanupRelease = deferred<void>();
    const cleanup = vi.fn(() => cleanupRelease.promise);
    const lifecycle = new Da4V5OperatorLifecycle(
      cleanup,
      (event) => events.push(event),
      markFailed,
    );
    const signal = new Da4V5SignalController((event) => events.push(event), markFailed);
    signal.bind(lifecycle);

    const normalStop = lifecycle.stop();
    const interruptedStop = signal.handleSignal();
    cleanupRelease.resolve();
    await Promise.all([normalStop, interruptedStop]);

    expect(events).toEqual(['da4_v5_interrupted']);
    expect(markFailed).toHaveBeenCalledTimes(1);
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('allows only one readline owner while transitioning command to secret mode', () => {
    const ownership = new Da4V5InputOwnership();
    const command = fakeInterface();
    const secret = fakeInterface();
    ownership.attachCommand(command);
    expect(ownership.mode()).toBe('command');
    expect(() => ownership.attachSecret(secret)).toThrow(/already has an owner/);
    ownership.detachCommandForSecret();
    expect(command.removeAllListeners).toHaveBeenCalledOnce();
    expect(command.close).toHaveBeenCalledOnce();
    ownership.attachSecret(secret);
    expect(ownership.mode()).toBe('secret');
    expect(() => ownership.attachCommand(command)).toThrow(/already has an owner/);
    ownership.releaseSecret(secret);
    expect(secret.close).toHaveBeenCalledOnce();
    expect(ownership.mode()).toBe('none');
  });
});

describe('DA4 V5 Admin Web artifact manifest', () => {
  it('creates a sorted exact inventory and rejects byte drift', async () => {
    const root = await makeArtifact();
    const manifest = await createDa4V5ArtifactManifest(root);
    expect(manifest.files.map((file) => file.path)).toEqual([
      'assets/app.js',
      'index.html',
    ]);
    const manifestPath = join(root, 'bound-manifest.json');
    await writeFile(manifestPath, JSON.stringify(manifest), 'utf8');
    await expect(loadAndVerifyDa4V5Artifact(root, manifestPath)).rejects.toThrow(/mismatch/);

    await rm(manifestPath);
    const outsideManifestPath = join(resolve(root, '..'), `manifest-${Date.now()}.json`);
    await writeFile(outsideManifestPath, JSON.stringify(manifest), 'utf8');
    try {
      await expect(loadAndVerifyDa4V5Artifact(root, outsideManifestPath)).resolves.toEqual(manifest);
      await writeFile(join(root, 'index.html'), '<main>changed</main>', 'utf8');
      await expect(loadAndVerifyDa4V5Artifact(root, outsideManifestPath))
        .rejects.toThrow(/mismatch/);
    } finally {
      await rm(outsideManifestPath, { force: true });
    }
  });

  it('rejects unsafe, duplicate, and incomplete manifest entries', async () => {
    const root = await makeArtifact();
    const manifestPath = join(resolve(root, '..'), `manifest-${Date.now()}.json`);
    await writeFile(manifestPath, JSON.stringify({
      version: 1,
      files: [{
        path: '../index.html',
        bytes: 1,
        sha256: 'a'.repeat(64),
      }],
    }), 'utf8');
    try {
      await expect(loadAndVerifyDa4V5Artifact(root, manifestPath))
        .rejects.toThrow(/Invalid/);
    } finally {
      await rm(manifestPath, { force: true });
    }
  });

  it('keeps the DA4 entry fail-closed before database configuration is read', async () => {
    const source = await readFile(new URL('../src/da4V5Main.ts', import.meta.url), 'utf8');
    expect(source.indexOf('requireDa4V5Profile(')).toBeGreaterThanOrEqual(0);
    expect(source.indexOf('requireDa4V5Profile(')).toBeLessThan(
      source.indexOf("requiredEnvironmentValue('TAPTIME_SYNTHETIC_E2E_DATABASE_URL')"),
    );
    expect(source.indexOf("process.on('SIGINT'")).toBeLessThan(
      source.indexOf('environment = await createSyntheticAndroidE2eEnvironment('),
    );
    expect(source.indexOf("process.on('SIGTERM'")).toBeLessThan(
      source.indexOf('environment = await createSyntheticAndroidE2eEnvironment('),
    );
    expect(source).not.toContain('apps/admin-web');
  });

  it('serves only the bound build, proxies same-origin API, and contains one read fault', async () => {
    const proxied: Array<{
      readonly authorization: string | undefined;
      readonly body: string;
      readonly method: string | undefined;
      readonly path: string | undefined;
    }> = [];
    const api = createServer((request, response) => {
      let body = '';
      request.setEncoding('utf8');
      request.on('data', (chunk) => {
        body += chunk;
      });
      request.on('end', () => {
        proxied.push({
          authorization: request.headers.authorization,
          body,
          method: request.method,
          path: request.url,
        });
        response.statusCode = 200;
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        response.setHeader('X-Untrusted-Upstream', 'not-forwarded');
        response.end(JSON.stringify({ status: 'ready' }));
      });
    });
    openHttpServers.push(api);
    await listenHttpServer(api, 3_000);

    const root = await makeArtifact();
    const manifest = await createDa4V5ArtifactManifest(root);
    const manifestDirectory = await mkdtemp(join(tmpdir(), 'taptime-da4-v5-manifest-'));
    temporaryDirectories.push(manifestDirectory);
    const manifestPath = join(manifestDirectory, 'manifest.json');
    await writeFile(manifestPath, JSON.stringify(manifest), 'utf8');
    const safeEvents: string[] = [];
    const adminWeb = await createDa4V5AdminWebServer({
      rootDirectory: root,
      manifestPath,
      onSafeEvent: (event) => safeEvents.push(event),
    });
    openAdminWebServers.push(adminWeb);

    const page = await fetch(adminWeb.origin);
    expect(page.status).toBe(200);
    expect(await page.text()).toBe('<main>TapTim.e</main>');
    expect(page.headers.get('content-security-policy')).toContain("default-src 'self'");
    expect(page.headers.get('cache-control')).toBe('no-store');

    adminWeb.readFault.arm('setup');
    const writeWhileArmed = await postJson(
      adminWeb.origin,
      '/v1/administration/customers',
      { displayName: 'Safe fixture value' },
    );
    expect(writeWhileArmed.status).toBe(200);
    expect(adminWeb.readFault.getState()).toEqual({ state: 'armed', section: 'setup' });

    const fault = await postJson(
      adminWeb.origin,
      DA4_V5_READ_PROJECTION_ROUTES.setup,
      { cursor: null },
    );
    expect(fault.status).toBe(503);
    expect(await fault.json()).toEqual({ code: 'service_unavailable' });
    expect(fault.headers.get('content-security-policy')).toContain("default-src 'self'");
    expect(fault.headers.get('referrer-policy')).toBe('no-referrer');
    expect(fault.headers.get('x-content-type-options')).toBe('nosniff');
    expect(fault.headers.get('x-frame-options')).toBe('DENY');
    expect(safeEvents).toEqual(['da4_v5_read_fault_consumed']);
    expect(proxied).toHaveLength(1);

    const recovered = await postJson(
      adminWeb.origin,
      DA4_V5_READ_PROJECTION_ROUTES.setup,
      { cursor: null },
    );
    expect(recovered.status).toBe(200);
    expect(await recovered.json()).toEqual({ status: 'ready' });
    expect(recovered.headers.get('x-untrusted-upstream')).toBeNull();
    expect(proxied).toEqual([
      {
        authorization: 'Bearer synthetic.test.token',
        body: '{"displayName":"Safe fixture value"}',
        method: 'POST',
        path: '/v1/administration/customers',
      },
      {
        authorization: 'Bearer synthetic.test.token',
        body: '{"cursor":null}',
        method: 'POST',
        path: '/v1/administration/setup-projection',
      },
    ]);

    await writeFile(join(root, 'index.html'), '<main>drifted</main>', 'utf8');
    const drifted = await fetch(adminWeb.origin);
    expect(drifted.status).toBe(503);

    await adminWeb.close();
    expect(await canListen(5_173)).toBe(true);
  });
});

function fakeInterface(): Interface {
  return {
    close: vi.fn(),
    removeAllListeners: vi.fn(),
  } as unknown as Interface;
}

function deferred<Value = void>(): {
  readonly promise: Promise<Value>;
  readonly resolve: (value: Value) => void;
} {
  let resolve!: (value: Value) => void;
  const promise = new Promise<Value>((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
}

async function makeArtifact(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'taptime-da4-v5-'));
  temporaryDirectories.push(directory);
  await mkdir(join(directory, 'assets'));
  await writeFile(join(directory, 'index.html'), '<main>TapTim.e</main>', 'utf8');
  await writeFile(join(directory, 'assets', 'app.js'), 'export {};\n', 'utf8');
  return realpath(directory);
}

function manifestAt(startedAt: string): Da4V5FixtureManifest {
  const start = new Date(startedAt);
  const stop = new Date(start.valueOf() + 30 * 60_000);
  return {
    ...DA4_V5_PUBLIC_MANIFEST,
    correctionOriginalStartedAt: start.toISOString(),
    correctionOriginalStoppedAt: stop.toISOString(),
    correctionTransformedStartedAt: new Date(start.valueOf() + 60_000).toISOString(),
    correctionTransformedStoppedAt: new Date(stop.valueOf() - 60_000).toISOString(),
  };
}

function postJson(origin: string, path: string, body: unknown): Promise<Response> {
  return fetch(`${origin}${path}`, {
    method: 'POST',
    headers: {
      authorization: 'Bearer synthetic.test.token',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

async function listenHttpServer(server: Server, port: number): Promise<void> {
  await new Promise<void>((resolvePromise, rejectPromise) => {
    server.once('error', rejectPromise);
    server.listen(port, '127.0.0.1', resolvePromise);
  });
}

async function closeHttpServer(server: Server): Promise<void> {
  if (!server.listening) {
    return;
  }
  await new Promise<void>((resolvePromise, rejectPromise) => {
    server.close((error) => error === undefined ? resolvePromise() : rejectPromise(error));
  });
}

async function canListen(port: number): Promise<boolean> {
  const probe = createServer();
  try {
    await listenHttpServer(probe, port);
    return true;
  } catch {
    return false;
  } finally {
    await closeHttpServer(probe);
  }
}

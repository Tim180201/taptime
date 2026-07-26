import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';
import type {
  Da5V5PostgresOwnerBackend,
} from '../src/Da5V5PostgresCapability.js';
import * as capabilityModule from '../src/Da5V5PostgresCapability.js';
import { prepareDa5V5SyntheticDatabase } from '../src/database.js';

const runtimeMocks = vi.hoisted(() => ({
  startLocal: vi.fn(),
  startTest: vi.fn(),
}));

vi.mock('../src/Da5V5PostgresRuntimeGuard.js', () => ({
  startDa5V5FullyAttestedLocalPostgresOwner: runtimeMocks.startLocal,
  startDa5V5FullyAttestedTestPostgresOwner: runtimeMocks.startTest,
}));

const {
  closeDa5V5PostgresCapability,
  consumeDa5V5PostgresCapability,
  createDa5V5LocalPostgresCapability,
  createDa5V5TestPostgresCapability,
  da5V5PostgresCapabilityState,
} = capabilityModule;

const attestation = Object.freeze({
  database: 'taptime_synthetic_android_e2e' as const,
  host: '127.0.0.1' as const,
  port: 55_435 as const,
  role: 'taptime_da5_v5_installer' as const,
  serverVersionNumber: 170_010 as const,
  systemIdentifier: '7561094784090731591',
});

describe('DA5 V5 private PostgreSQL capability', () => {
  beforeEach(() => {
    runtimeMocks.startLocal.mockReset();
    runtimeMocks.startTest.mockReset();
  });

  it('exports no raw issuer, mint or claim surface', () => {
    expect(Object.keys(capabilityModule)).not.toEqual(expect.arrayContaining([
      'claimDa5V5PostgresCapability',
      'createDa5V5PostgresCapabilityIssuer',
      'issueDa5V5PostgresCapability',
      'withDa5V5PostgresCapability',
    ]));
    const forged = Object.freeze({});
    expect(() => da5V5PostgresCapabilityState(
      forged as capabilityModule.Da5V5PostgresCapability,
    )).toThrow(/invalid/);
  });

  it('rejects forged artifact bindings before the local owner factory runs', async () => {
    await expect(createDa5V5LocalPostgresCapability({
      guardArtifactBinding: Object.freeze({}) as never,
      pgConfigPath: '/synthetic/pg_config',
    })).rejects.toThrow(/artifact binding is invalid/);
    expect(runtimeMocks.startLocal).not.toHaveBeenCalled();
  });

  it('gates test issuance on the focused Vitest process authority', async () => {
    const original = process.env.VITEST;
    delete process.env.VITEST;
    try {
      await expect(createTestCapability()).rejects.toThrow(
        /focused PostgreSQL test authority is unavailable/,
      );
      expect(runtimeMocks.startTest).not.toHaveBeenCalled();
    } finally {
      if (original !== undefined) {
        process.env.VITEST = original;
      }
    }
  });

  it('binds a fully attested owner, exposes only operations and closes exactly once', async () => {
    const pool = {} as Pool;
    const owner = createOwner({
      provisionRuntimePool: vi.fn(async () => pool),
    });
    runtimeMocks.startTest.mockResolvedValue(owner);
    const capability = await createTestCapability();

    expect(() => JSON.stringify(capability)).toThrow(/not serializable/);
    expect(() => String(capability)).toThrow(/not stringifiable/);
    await expect(consumeDa5V5PostgresCapability(capability, async (authority) => {
      expect(Object.keys(authority).sort()).toEqual([
        'attestation',
        'ownerDigest',
        'provisionRuntimePool',
        'reattest',
        'source',
        'withInstaller',
      ]);
      expect('databaseUrl' in authority).toBe(false);
      expect('installerPool' in authority).toBe(false);
      expect('installerUrl' in authority).toBe(false);
      await expect(authority.withInstaller(async () => 'installer-operation'))
        .resolves.toBe('installer-operation');
      await expect(authority.provisionRuntimePool({
        login: 'taptime_api',
        max: 2,
        roles: ['taptime_app_runtime'],
      })).resolves.toBe(pool);
      return 'used';
    })).resolves.toBe('used');

    expect(owner.reattest).toHaveBeenNthCalledWith(1, 'before-migrations');
    expect(da5V5PostgresCapabilityState(capability)).toEqual({
      claimed: true,
      cleanupIncomplete: false,
      closed: false,
      source: 'isolated-runtime-guard',
    });
    await expect(closeDa5V5PostgresCapability(capability)).resolves.toBeUndefined();
    expect(owner.reattest).toHaveBeenNthCalledWith(2, 'before-cleanup');
    expect(owner.closeOwner).toHaveBeenCalledTimes(1);
    expect(da5V5PostgresCapabilityState(capability)).toEqual({
      claimed: true,
      cleanupIncomplete: false,
      closed: true,
      source: 'isolated-runtime-guard',
    });
    await expect(closeDa5V5PostgresCapability(capability)).rejects.toThrow(
      /cannot be closed/,
    );
  });

  it('retries only an incomplete owner close after the first cleanup failure', async () => {
    let attempt = 0;
    const owner = createOwner({
      closeOwner: vi.fn(async () => {
        attempt += 1;
        if (attempt === 1) {
          throw new Error('synthetic cleanup failure');
        }
      }),
    });
    runtimeMocks.startTest.mockResolvedValue(owner);
    const capability = await createTestCapability();

    await expect(closeDa5V5PostgresCapability(capability)).rejects.toThrow(
      'synthetic cleanup failure',
    );
    expect(da5V5PostgresCapabilityState(capability)).toEqual({
      claimed: false,
      cleanupIncomplete: true,
      closed: false,
      source: 'isolated-runtime-guard',
    });
    await expect(closeDa5V5PostgresCapability(capability)).resolves.toBeUndefined();
    expect(owner.reattest).toHaveBeenCalledTimes(1);
    expect(owner.closeOwner).toHaveBeenCalledTimes(2);
    expect(da5V5PostgresCapabilityState(capability)).toMatchObject({
      cleanupIncomplete: false,
      closed: true,
    });
  });

  it('preserves the first reattestation failure but still attempts owner cleanup',
    async () => {
      const firstFailure = new Error('synthetic first attestation failure');
      const owner = createOwner({
        reattest: vi.fn(async () => {
          throw firstFailure;
        }),
      });
      runtimeMocks.startTest.mockResolvedValue(owner);
      const capability = await createTestCapability();

      await expect(closeDa5V5PostgresCapability(capability)).rejects.toBe(
        firstFailure,
      );
      expect(owner.closeOwner).toHaveBeenCalledTimes(1);
      expect(da5V5PostgresCapabilityState(capability).cleanupIncomplete).toBe(
        true,
      );
  });

  it('is one-shot and cannot be concurrently consumed or closed', async () => {
    let releaseUse = (): void => undefined;
    let enteredUse = (): void => undefined;
    const entered = new Promise<void>((resolve) => {
      enteredUse = resolve;
    });
    const holdUse = new Promise<void>((resolve) => {
      releaseUse = resolve;
    });
    const owner = createOwner();
    runtimeMocks.startTest.mockResolvedValue(owner);
    const capability = await createTestCapability();
    const active = consumeDa5V5PostgresCapability(capability, async () => {
      enteredUse();
      return holdUse;
    });
    await entered;

    await expect(consumeDa5V5PostgresCapability(
      capability,
      async () => undefined,
    )).rejects.toThrow(/unavailable/);
    await expect(closeDa5V5PostgresCapability(capability)).rejects.toThrow(
      /cannot be closed/,
    );
    releaseUse();
    await active;
    await expect(consumeDa5V5PostgresCapability(
      capability,
      async () => undefined,
    )).rejects.toThrow(/unavailable/);
    await closeDa5V5PostgresCapability(capability);
  });

  it('rejects a freely claimed or invalid owner identity', async () => {
    runtimeMocks.startTest.mockResolvedValue({
      ...createOwner(),
      ownerDigest: 'claimed-by-caller',
    });
    await expect(createTestCapability()).rejects.toThrow(/owner authority is invalid/);

    runtimeMocks.startTest.mockResolvedValue({
      ...createOwner(),
      attestation: {
        ...attestation,
        role: 'postgres',
      },
    });
    await expect(createTestCapability()).rejects.toThrow(
      /operational PostgreSQL capability role is invalid/,
    );
  });

  it('rejects a CI/local source, port and role boundary mismatch before SQL', async () => {
    const owner = createOwner();
    runtimeMocks.startTest.mockResolvedValue(owner);
    const capability = await createTestCapability();

    await expect(prepareDa5V5SyntheticDatabase(
      capability,
      'https://synthetic.invalid',
      'ci-test-adapter',
    )).rejects.toThrow(/capability attestation mismatch/);
    expect(owner.withInstaller).not.toHaveBeenCalled();
    await closeDa5V5PostgresCapability(capability);
  });
});

function createOwner(
  overrides: Partial<Da5V5PostgresOwnerBackend> = {},
): Da5V5PostgresOwnerBackend & {
  closeOwner: ReturnType<typeof vi.fn>;
  provisionRuntimePool: ReturnType<typeof vi.fn>;
  reattest: ReturnType<typeof vi.fn>;
  withInstaller: ReturnType<typeof vi.fn>;
} {
  return {
    attestation,
    closeOwner: vi.fn(async () => undefined),
    lifecycleRecord: Object.freeze({
      artifactDigest: '1'.repeat(64),
      binaryChainDigest: '2'.repeat(64),
      binaryChainManifest: Object.freeze([
        Object.freeze({ digest: '2'.repeat(64) }),
      ]),
      capabilityDigest: '3'.repeat(64),
      catalogDigest: '4'.repeat(64),
      configurationDigest: '5'.repeat(64),
      dataDirectoryIdentity: '5'.repeat(64),
      directoryIdentity: '6'.repeat(64),
      finalDigest: '6'.repeat(64),
      guardExecutableDigest: '7'.repeat(64),
      logDescriptorDigest: '8'.repeat(64),
      mountIdentity: '9'.repeat(64),
      ownerProcess: '9'.repeat(64),
      postmasterDigest: 'a'.repeat(64),
      processIdentity: 'b'.repeat(64),
      provisionalDigest: 'c'.repeat(64),
      rootIdentity: 'd'.repeat(64),
      socketIdentity: 'e'.repeat(64),
      trustedGroupDigest: 'f'.repeat(64),
      version: 'DA5-V5-LIFECYCLE-V1',
    }),
    ownerDigest: '0'.repeat(64),
    provisionRuntimePool: vi.fn(async () => ({} as Pool)),
    reattest: vi.fn(async () => undefined),
    source: 'isolated-runtime-guard',
    withInstaller: vi.fn(async (action: (pool: Pool) => Promise<unknown>) => (
      action({} as Pool)
    )),
    ...overrides,
  } as Da5V5PostgresOwnerBackend & {
    closeOwner: ReturnType<typeof vi.fn>;
    provisionRuntimePool: ReturnType<typeof vi.fn>;
    reattest: ReturnType<typeof vi.fn>;
    withInstaller: ReturnType<typeof vi.fn>;
  };
}

async function createTestCapability() {
  return createDa5V5TestPostgresCapability({
    guardBinaryPath: '/synthetic/guard',
    pgConfigPath: '/synthetic/pg_config',
  });
}

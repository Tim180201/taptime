import type { Pool, PoolClient } from 'pg';
import type {
  Da5V5RuntimeGuardArtifactBinding,
} from './Da5V5RuntimeGuardArtifact.js';
import {
  assertDa5V5RuntimeGuardArtifactBinding,
} from './Da5V5RuntimeGuardArtifact.js';

const capabilityBrand: unique symbol = Symbol('da5-v5-postgres-capability');

export interface Da5V5PostgresCapability {
  readonly [capabilityBrand]: true;
}

export interface Da5V5PostgresAttestation {
  readonly database: 'taptime_synthetic_android_e2e';
  readonly host: '127.0.0.1';
  readonly port: 5_432 | 55_435;
  readonly role: 'postgres' | 'taptime_da5_v5_installer';
  readonly serverVersionNumber: 170_010;
  readonly systemIdentifier: string;
}

export type Da5V5PostgresAttestationStage =
  | 'before-database-create'
  | 'before-migrations'
  | 'after-migrations'
  | 'after-role-provisioning'
  | 'before-product-listeners'
  | 'before-cleanup';

export interface Da5V5RuntimePoolRequest {
  readonly login: string;
  readonly max: number;
  readonly roles: readonly string[];
}

export interface Da5V5PostgresClientOperations {
  readonly query: PoolClient['query'];
  release(error?: Error | boolean): void;
}

export interface Da5V5PostgresOperations {
  connect(): Promise<Da5V5PostgresClientOperations>;
  end(): Promise<void>;
  readonly query: Pool['query'];
}

/**
 * The backend is returned only by a fully-attesting local or CI owner factory.
 * It deliberately exposes operations rather than a URL, password or raw mint.
 */
export interface Da5V5PostgresOwnerBackend {
  readonly attestation: Da5V5PostgresAttestation;
  readonly lifecycleRecord: Readonly<{
    readonly artifactDigest: string;
    readonly binaryChainDigest: string;
    readonly binaryChainManifest: readonly Readonly<
      Record<string, unknown>
    >[];
    readonly capabilityDigest: string;
    readonly catalogDigest: string;
    readonly configurationDigest: string;
    readonly dataDirectoryIdentity: string;
    readonly directoryIdentity: string;
    readonly finalDigest: string;
    readonly guardExecutableDigest: string;
    readonly logDescriptorDigest: string;
    readonly mountIdentity: string;
    readonly ownerProcess: string;
    readonly postmasterDigest: string;
    readonly processIdentity: string;
    readonly provisionalDigest: string;
    readonly rootIdentity: string;
    readonly socketIdentity: string;
    readonly trustedGroupDigest: string;
    readonly version: 'DA5-V5-LIFECYCLE-V1';
  }>;
  readonly ownerDigest: string;
  readonly source: 'ci-test-adapter' | 'isolated-runtime-guard';
  closeOwner(): Promise<void>;
  provisionRuntimePool(
    request: Da5V5RuntimePoolRequest,
  ): Promise<Da5V5PostgresOperations>;
  reattest(stage: Da5V5PostgresAttestationStage): Promise<void>;
  withInstaller<T>(
    action: (pool: Da5V5PostgresOperations) => Promise<T>,
  ): Promise<T>;
}

export interface Da5V5PostgresProvisioningAuthority {
  readonly attestation: Da5V5PostgresAttestation;
  readonly ownerDigest: string;
  readonly source: Da5V5PostgresOwnerBackend['source'];
  provisionRuntimePool(
    request: Da5V5RuntimePoolRequest,
  ): Promise<Da5V5PostgresOperations>;
  reattest(stage: Da5V5PostgresAttestationStage): Promise<void>;
  withInstaller<T>(
    action: (pool: Da5V5PostgresOperations) => Promise<T>,
  ): Promise<T>;
}

interface CapabilityState {
  activeUse: boolean;
  claimed: boolean;
  lifecycle: 'active' | 'cleanup-incomplete' | 'closed';
  readonly owner: Da5V5PostgresOwnerBackend;
}

const capabilityStates = new WeakMap<object, CapabilityState>();

export async function createDa5V5LocalPostgresCapability(options: {
  readonly guardArtifactBinding: Da5V5RuntimeGuardArtifactBinding;
  readonly pgConfigPath: string;
  readonly signal?: AbortSignal;
  readonly temporaryBase?: string;
}): Promise<Da5V5PostgresCapability> {
  assertDa5V5RuntimeGuardArtifactBinding(options.guardArtifactBinding);
  const runtime = await import('./Da5V5PostgresRuntimeGuard.js');
  return issueFromAttestedOwner(
    await runtime.startDa5V5FullyAttestedLocalPostgresOwner(options),
  );
}

export async function createDa5V5TestPostgresCapability(options: {
  readonly guardBinaryPath: string;
  readonly pgConfigPath: string;
  readonly signal?: AbortSignal;
  readonly temporaryBase?: string;
}): Promise<Da5V5PostgresCapability> {
  assertDa5V5FocusedTestProcess();
  const runtime = await import('./Da5V5PostgresRuntimeGuard.js');
  return issueFromAttestedOwner(
    await runtime.startDa5V5FullyAttestedTestPostgresOwner(options),
  );
}

export async function createDa5V5CiPostgresCapability(options: {
  readonly databaseUrl: string;
  readonly ownerRecordPath: string;
  readonly runner?: import('./Da5V5CiPostgresAdapter.js').Da5V5DockerReadRunner;
}): Promise<Da5V5PostgresCapability> {
  assertDa5V5FocusedTestProcess();
  const adapter = await import('./Da5V5CiPostgresAdapter.js');
  return issueFromAttestedOwner(
    await adapter.startDa5V5FullyAttestedCiPostgresOwner(options),
  );
}

export async function consumeDa5V5PostgresCapability<T>(
  capability: Da5V5PostgresCapability,
  action: (authority: Da5V5PostgresProvisioningAuthority) => Promise<T>,
): Promise<T> {
  const state = capabilityStates.get(capability);
  if (
    state === undefined
    || state.lifecycle !== 'active'
    || state.activeUse
    || state.claimed
  ) {
    throw new Error('DA5 V5 PostgreSQL capability is unavailable');
  }
  state.activeUse = true;
  state.claimed = true;
  const owner = state.owner;
  try {
    await owner.reattest('before-migrations');
    const authority: Da5V5PostgresProvisioningAuthority = Object.freeze({
      attestation: owner.attestation,
      ownerDigest: owner.ownerDigest,
      provisionRuntimePool(
        request: Da5V5RuntimePoolRequest,
      ): Promise<Da5V5PostgresOperations> {
        return owner.provisionRuntimePool(request);
      },
      reattest(stage: Da5V5PostgresAttestationStage): Promise<void> {
        return owner.reattest(stage);
      },
      source: owner.source,
      withInstaller<Inner>(
        innerAction: (pool: Da5V5PostgresOperations) => Promise<Inner>,
      ): Promise<Inner> {
        return owner.withInstaller(innerAction);
      },
    });
    return await action(authority);
  } finally {
    state.activeUse = false;
  }
}

export async function closeDa5V5PostgresCapability(
  capability: Da5V5PostgresCapability,
): Promise<void> {
  const state = capabilityStates.get(capability);
  if (
    state === undefined
    || state.lifecycle === 'closed'
    || state.activeUse
  ) {
    throw new Error('DA5 V5 PostgreSQL capability cannot be closed');
  }
  let firstFailure: unknown;
  try {
    if (state.lifecycle === 'active') {
      await state.owner.reattest(
        state.claimed ? 'before-cleanup' : 'before-migrations',
      );
    }
  } catch (error: unknown) {
    firstFailure = error;
  }
  try {
    await state.owner.closeOwner();
  } catch (error: unknown) {
    firstFailure ??= error;
  }
  if (firstFailure !== undefined) {
    state.lifecycle = 'cleanup-incomplete';
    throw firstFailure;
  }
  state.lifecycle = 'closed';
}

export function da5V5PostgresCapabilityState(
  capability: Da5V5PostgresCapability,
): Readonly<{
  readonly claimed: boolean;
  readonly closed: boolean;
  readonly cleanupIncomplete: boolean;
  readonly source: Da5V5PostgresOwnerBackend['source'];
}> {
  const state = capabilityStates.get(capability);
  if (state === undefined) {
    throw new Error('DA5 V5 PostgreSQL capability is invalid');
  }
  return Object.freeze({
    claimed: state.claimed,
    closed: state.lifecycle === 'closed',
    cleanupIncomplete: state.lifecycle === 'cleanup-incomplete',
    source: state.owner.source,
  });
}

function issueFromAttestedOwner(
  owner: Da5V5PostgresOwnerBackend,
): Da5V5PostgresCapability {
  validateOwner(owner);
  const capability = Object.freeze({
    [capabilityBrand]: true as const,
    toJSON(): never {
      throw new Error('DA5 V5 PostgreSQL capability is not serializable');
    },
    toString(): never {
      throw new Error('DA5 V5 PostgreSQL capability is not stringifiable');
    },
  });
  capabilityStates.set(capability, {
    activeUse: false,
    claimed: false,
    lifecycle: 'active',
    owner,
  });
  return capability;
}

export function assertDa5V5FocusedTestProcess(): void {
  if (
    process.env.NODE_ENV !== 'test'
    || process.env.VITEST !== 'true'
    || process.env.TAPTIME_SYNTHETIC_E2E_PROFILE === 'da5-v5'
    || !process.argv.some((argument) => /(?:^|[/\\])vitest(?:[./\\]|$)/u.test(
      argument,
    ))
  ) {
    throw new Error('DA5 V5 focused PostgreSQL test authority is unavailable');
  }
}

function validateOwner(owner: Da5V5PostgresOwnerBackend): void {
  validateAttestation(owner.attestation);
  if (
    !/^[a-f0-9]{64}$/u.test(owner.ownerDigest)
    || !['ci-test-adapter', 'isolated-runtime-guard'].includes(owner.source)
    || typeof owner.closeOwner !== 'function'
    || typeof owner.provisionRuntimePool !== 'function'
    || typeof owner.reattest !== 'function'
    || typeof owner.withInstaller !== 'function'
    || !validateLifecycleRecord(owner.lifecycleRecord)
  ) {
    throw new Error('DA5 V5 PostgreSQL owner authority is invalid');
  }
}

function validateLifecycleRecord(
  record: Da5V5PostgresOwnerBackend['lifecycleRecord'],
): boolean {
  return record !== null
    && typeof record === 'object'
    && Array.isArray(record.binaryChainManifest)
    && record.binaryChainManifest.length > 0
    && [
      record.artifactDigest,
      record.binaryChainDigest,
      record.capabilityDigest,
      record.catalogDigest,
      record.configurationDigest,
      record.dataDirectoryIdentity,
      record.directoryIdentity,
      record.finalDigest,
      record.guardExecutableDigest,
      record.logDescriptorDigest,
      record.mountIdentity,
      record.ownerProcess,
      record.postmasterDigest,
      record.processIdentity,
      record.provisionalDigest,
      record.rootIdentity,
      record.socketIdentity,
      record.trustedGroupDigest,
    ].every((value) => /^[a-f0-9]{64}$/u.test(value))
    && record.version === 'DA5-V5-LIFECYCLE-V1';
}

function validateAttestation(attestation: Da5V5PostgresAttestation): void {
  if (
    attestation.database !== 'taptime_synthetic_android_e2e'
    || attestation.host !== '127.0.0.1'
    || ![5_432, 55_435].includes(attestation.port)
    || !['postgres', 'taptime_da5_v5_installer'].includes(attestation.role)
    || attestation.serverVersionNumber !== 170_010
    || !/^[1-9][0-9]{9,}$/u.test(attestation.systemIdentifier)
  ) {
    throw new Error('DA5 V5 PostgreSQL capability attestation is invalid');
  }
  if (
    attestation.port === 55_435
    && attestation.role !== 'taptime_da5_v5_installer'
  ) {
    throw new Error('DA5 V5 operational PostgreSQL capability role is invalid');
  }
  if (attestation.port === 5_432 && attestation.role !== 'postgres') {
    throw new Error('DA5 V5 CI PostgreSQL capability role is invalid');
  }
}

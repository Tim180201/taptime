import { createHash, randomBytes } from 'node:crypto';
import {
  constants,
  lstat,
  mkdir,
  mkdtemp,
  open,
  readFile,
  realpath,
  rmdir,
  stat,
  statfs,
  type FileHandle,
} from 'node:fs/promises';
import { connect } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, parse, resolve, sep } from 'node:path';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import type { Readable, Writable } from 'node:stream';
import { Pool } from 'pg';
import { B3_MIGRATION_TABLE, B3_SCHEMA } from '@taptime/backend-schema';
import { da5V5RuntimeLogins, runtimeLogins } from './constants.js';
import type {
  Da5V5PostgresMountIdentityRecord,
  Da5V5PostgresProcessIdentityRecord,
  Da5V5PostgresAttestationStage,
  Da5V5PostgresOperations,
  Da5V5PostgresOwnerBackend,
  Da5V5RuntimePoolRequest,
} from './Da5V5PostgresCapability.js';
import {
  assertDa5V5FocusedTestProcess,
} from './Da5V5PostgresCapability.js';
import type {
  Da5V5RuntimeGuardArtifactBinding,
} from './Da5V5RuntimeGuardArtifact.js';
import {
  assertDa5V5RuntimeGuardArtifactBinding,
  verifyDa5V5RuntimeGuardRunningProcess,
  verifyDa5V5RuntimeGuardRunningProcessForTest,
} from './Da5V5RuntimeGuardArtifact.js';

export const DA5_V5_ADMIN_GROUP_ANCHOR = Object.freeze({
  combinedSnapshotSha256:
    '2384b0baccd9049d820794f8ebc9419e4af0fad6831a5a91c209baa0b4a02217',
  directMembers: 2,
  fullRecordSha256:
    'b006276c09d8f2713f6132ea79cec167ab3a3c2887ee53e95eb00c1cc33719a5',
  membershipSha256:
    '70a683b7ebc7981533015d5d63cf12dfb2eabbfa665c34720eddb4d09e9e3064',
  nestedGroups: 0,
});

const snapshotBrand: unique symbol = Symbol('da5-v5-admin-group-snapshot');

export interface Da5V5TrustedAdminGroupSnapshot {
  readonly [snapshotBrand]: true;
  readonly combinedSnapshotSha256:
    typeof DA5_V5_ADMIN_GROUP_ANCHOR.combinedSnapshotSha256;
  readonly directMembers: 2;
  readonly fullRecordSha256:
    typeof DA5_V5_ADMIN_GROUP_ANCHOR.fullRecordSha256;
  readonly membershipSha256:
    typeof DA5_V5_ADMIN_GROUP_ANCHOR.membershipSha256;
  readonly nestedGroups: 0;
}

interface ProtectedGroupSnapshot {
  readonly gid: number;
  readonly groupGuid: string;
  readonly memberPairs: readonly Readonly<{
    readonly guid: string;
    readonly uid: number;
  }>[];
}

interface BoundPath {
  readonly aclSha256: string;
  readonly binary: boolean;
  readonly canonicalPath: string;
  readonly dev: bigint;
  readonly digest?: string;
  readonly fd: FileHandle;
  readonly gid: number;
  readonly ino: bigint;
  readonly mode: number;
  readonly size: bigint;
  readonly uid: number;
}

interface BoundLifecycleFile {
  readonly contentDigest: string | null;
  readonly handle: FileHandle;
  readonly identity: Readonly<Record<string, string>>;
  readonly mutable: boolean;
  readonly path: string;
}

interface BoundLifecycleDirectory {
  readonly handle: FileHandle;
  readonly identity: Readonly<Record<string, string>>;
  readonly ownsHandle: boolean;
  readonly path: string;
}

interface BoundLifecycleSocket {
  readonly identity: Readonly<Record<string, string>>;
  readonly path: string;
}

export interface Da5V5PostgresBinaryChain {
  readonly bindir: string;
  readonly chainDigest: string;
  readonly initdb: string;
  readonly initdbFd: number;
  readonly pgConfig: string;
  readonly pgConfigFd: number;
  readonly postgres: string;
  readonly postgresDigest: string;
  readonly postgresFd: number;
  readonly record: readonly Readonly<Record<string, unknown>>[];
  close(): Promise<void>;
  revalidate(snapshot: Da5V5TrustedAdminGroupSnapshot): Promise<void>;
}

const protectedSnapshots = new WeakMap<object, ProtectedGroupSnapshot>();
const binaryChains = new WeakMap<object, readonly BoundPath[]>();

async function closeFileHandlesSerially(
  handles: readonly FileHandle[],
): Promise<void> {
  let firstFailure: unknown;
  for (const handle of handles) {
    try {
      await handle.close();
    } catch (error: unknown) {
      firstFailure ??= error;
    }
  }
  if (firstFailure !== undefined) {
    throw new Error('DA5 V5 file handles did not all close', {
      cause: firstFailure,
    });
  }
}

async function closeBoundPathHandles(
  bindings: readonly BoundPath[],
): Promise<void> {
  await closeFileHandlesSerially(bindings.map(({ fd }) => fd));
}

interface Da5V5CleanupFailureState {
  firstFailure?: unknown;
}

interface Da5V5RetainedStartupCleanup {
  readonly guardPid: number | null;
  readonly postgresPid: number | null;
  retry(): Promise<void>;
}

const retainedStartupCleanups = new Set<Da5V5RetainedStartupCleanup>();

async function retryDa5V5RetainedStartupCleanups(): Promise<void> {
  for (const retained of [...retainedStartupCleanups]) {
    await retained.retry();
    retainedStartupCleanups.delete(retained);
  }
}

async function attemptDa5V5CleanupStage(
  state: Da5V5CleanupFailureState,
  action: () => Promise<void> | void,
  completed: () => void = () => undefined,
): Promise<boolean> {
  try {
    await action();
    completed();
    return true;
  } catch (error: unknown) {
    state.firstFailure ??= error;
    return false;
  }
}

async function attemptDa5V5ReattestationBoundStop(
  state: Da5V5CleanupFailureState,
  reattest: () => Promise<void>,
  sendStop: () => Promise<void>,
  attested: () => void = () => undefined,
  stopped: () => void = () => undefined,
): Promise<boolean> {
  if (!await attemptDa5V5CleanupStage(state, reattest, attested)) {
    return false;
  }
  return attemptDa5V5CleanupStage(state, sendStop, stopped);
}

export async function runDa5V5AllPathCleanupForTest(
  actions: readonly (() => Promise<void> | void)[],
): Promise<void> {
  assertDa5V5FocusedTestProcess();
  const state: Da5V5CleanupFailureState = {};
  for (const action of actions) {
    await attemptDa5V5CleanupStage(state, action);
  }
  if (state.firstFailure !== undefined) {
    throw new Error('DA5 V5 test cleanup failed', {
      cause: state.firstFailure,
    });
  }
}

export async function runDa5V5ReattestationBoundCleanupForTest(options: {
  readonly destructiveActions?: readonly (() => Promise<void> | void)[];
  readonly reattest: () => Promise<void>;
  readonly safeActions: readonly (() => Promise<void> | void)[];
  readonly sendStop: () => Promise<void>;
}): Promise<void> {
  assertDa5V5FocusedTestProcess();
  const state: Da5V5CleanupFailureState = {};
  const destructiveAuthority = await attemptDa5V5ReattestationBoundStop(
    state,
    options.reattest,
    options.sendStop,
  );
  for (const action of options.safeActions) {
    await attemptDa5V5CleanupStage(state, action);
  }
  if (destructiveAuthority) {
    for (const action of options.destructiveActions ?? []) {
      await attemptDa5V5CleanupStage(state, action);
    }
  }
  if (state.firstFailure !== undefined) {
    throw new Error('DA5 V5 test cleanup failed', {
      cause: state.firstFailure,
    });
  }
}

export function da5V5RetainedStartupCleanupCountForTest(): number {
  assertDa5V5FocusedTestProcess();
  return retainedStartupCleanups.size;
}

export function da5V5RetainedStartupProcessesForTest(): readonly Readonly<{
  readonly guardPid: number | null;
  readonly postgresPid: number | null;
}>[] {
  assertDa5V5FocusedTestProcess();
  return Object.freeze([...retainedStartupCleanups].map((retained) => (
    Object.freeze({
      guardPid: retained.guardPid,
      postgresPid: retained.postgresPid,
    })
  )));
}

export async function retryDa5V5RetainedStartupCleanupsForTest(): Promise<void> {
  assertDa5V5FocusedTestProcess();
  await retryDa5V5RetainedStartupCleanups();
}

export async function runDa5V5HandleOpenSisterFailureForTest(options: {
  readonly failureIndex: number;
  readonly paths: readonly string[];
}): Promise<void> {
  assertDa5V5FocusedTestProcess();
  const handles: FileHandle[] = [];
  let firstFailure: unknown;
  try {
    for (const [index, path] of options.paths.entries()) {
      if (index === options.failureIndex) {
        throw new Error(`synthetic-handle-open-failure-${index}`);
      }
      handles.push(await open(
        path,
        constants.O_RDONLY | constants.O_NOFOLLOW,
      ));
    }
  } catch (error: unknown) {
    firstFailure = error;
  }
  try {
    await closeFileHandlesSerially(handles);
  } catch (error: unknown) {
    firstFailure ??= error;
  }
  if (handles.some(({ fd }) => fd !== -1)) {
    firstFailure ??= new Error('DA5 V5 test handle remained open');
  }
  if (firstFailure !== undefined) {
    throw new Error('DA5 V5 test handle-open sequence failed', {
      cause: firstFailure,
    });
  }
}

const da5V5OwnedRuntimeRoleGraph: Readonly<
  Record<string, readonly string[]>
> = Object.freeze({
  [runtimeLogins.session]: ['taptime_identity_resolver'],
  [runtimeLogins.readModel]: [
    'taptime_administrator',
    'taptime_employee',
    'taptime_identity_resolver',
  ],
  [runtimeLogins.lifecycle]: [
    'taptime_identity_resolver',
    'taptime_server_lifecycle',
  ],
  [runtimeLogins.administration]: [
    'taptime_admin_setup',
    'taptime_identity_resolver',
  ],
  [runtimeLogins.employeeInvitation]: [
    'taptime_employee_invitation_creator',
    'taptime_identity_resolver',
  ],
  [runtimeLogins.employeeEnrollment]: ['taptime_employee_enrollment_redeemer'],
  [runtimeLogins.reassignment]: [
    'taptime_assignment_reassigner',
    'taptime_identity_resolver',
  ],
  [runtimeLogins.offlineLease]: ['taptime_offline_lease_issuer'],
  [runtimeLogins.offlineEvent]: ['taptime_offline_event_ingestor'],
  [runtimeLogins.offlineReconciliation]: [
    'taptime_offline_reconciliation_reader',
  ],
  [runtimeLogins.timeEntryExport]: [
    'taptime_identity_resolver',
    'taptime_time_exporter',
  ],
  [runtimeLogins.timeReviewRead]: [
    'taptime_identity_resolver',
    'taptime_time_review_reader',
  ],
  [runtimeLogins.timeReviewWrite]: [
    'taptime_identity_resolver',
    'taptime_time_review_writer',
  ],
  [da5V5RuntimeLogins.manualLifecycle]: [
    'taptime_identity_resolver',
    'taptime_server_lifecycle',
  ],
  [da5V5RuntimeLogins.mobileOwnTime]: [
    'taptime_identity_resolver',
    'taptime_mobile_own_time_reader',
  ],
  [da5V5RuntimeLogins.mobileTarget]: [
    'taptime_identity_resolver',
    'taptime_mobile_target_reader',
  ],
  [da5V5RuntimeLogins.projectAdministration]: [
    'taptime_identity_resolver',
    'taptime_project_administrator',
  ],
});

const da5V5MigrationRoles = Object.freeze([
  'taptime_admin_setup',
  'taptime_admin_setup_data_function_owner',
  'taptime_admin_setup_function_owner',
  'taptime_administrator',
  'taptime_assignment_reassigner',
  'taptime_assignment_reassignment_function_owner',
  'taptime_bootstrap_executor',
  'taptime_bootstrap_function_owner',
  'taptime_employee',
  'taptime_employee_enrollment_redeemer',
  'taptime_employee_invitation_creator',
  'taptime_employee_invitation_data_function_owner',
  'taptime_employee_invitation_function_owner',
  'taptime_employee_redemption_data_function_owner',
  'taptime_employee_redemption_function_owner',
  'taptime_identity_resolver',
  'taptime_mobile_own_time_reader',
  'taptime_mobile_read_function_owner',
  'taptime_mobile_target_reader',
  'taptime_offline_event_function_owner',
  'taptime_offline_event_ingestor',
  'taptime_offline_lease_function_owner',
  'taptime_offline_lease_issuer',
  'taptime_offline_reconciliation_function_owner',
  'taptime_offline_reconciliation_reader',
  'taptime_project_administrator',
  'taptime_server_lifecycle',
  'taptime_time_export_function_owner',
  'taptime_time_exporter',
  'taptime_time_review_read_function_owner',
  'taptime_time_review_reader',
  'taptime_time_review_write_function_owner',
  'taptime_time_review_writer',
  'taptime_work_target_function_owner',
] as const);

export async function verifyDa5V5TrustedAdminGroupSnapshot():
Promise<Da5V5TrustedAdminGroupSnapshot> {
  if (process.platform !== 'darwin' || process.geteuid === undefined) {
    throw new Error('DA5 V5 trusted admin-group snapshot mismatch');
  }
  const rawGroup = readDirectoryServiceRecord('/Groups/admin');
  const normalizedGroup = normalizeDirectoryServiceRecord(rawGroup);
  const membershipNames = directoryServiceAttribute(
    normalizedGroup,
    'GroupMembership',
  );
  const groupMemberGuids = directoryServiceAttribute(
    normalizedGroup,
    'GroupMembers',
  );
  const nestedGroups = directoryServiceAttribute(normalizedGroup, 'NestedGroups');
  const gidValues = directoryServiceAttribute(normalizedGroup, 'PrimaryGroupID');
  const groupGuids = directoryServiceAttribute(normalizedGroup, 'GeneratedUID');
  if (
    membershipNames.length !== 2
    || groupMemberGuids.length !== 2
    || nestedGroups.length !== 0
    || gidValues.length !== 1
    || groupGuids.length !== 1
    || !/^[0-9]+$/u.test(gidValues[0] ?? '')
    || !isGuid(groupGuids[0] ?? '')
  ) {
    throw new Error('DA5 V5 trusted admin-group snapshot mismatch');
  }
  const memberPairs = membershipNames.map((name) => {
    if (name.includes('/') || name.length === 0) {
      throw new Error('DA5 V5 trusted admin-group snapshot mismatch');
    }
    const account = normalizeDirectoryServiceRecord(
      readDirectoryServiceRecord(`/Users/${name}`),
    );
    const uid = directoryServiceAttribute(account, 'UniqueID');
    const guid = directoryServiceAttribute(account, 'GeneratedUID');
    if (
      uid.length !== 1
      || guid.length !== 1
      || !/^[0-9]+$/u.test(uid[0] ?? '')
      || !isGuid(guid[0] ?? '')
    ) {
      throw new Error('DA5 V5 trusted admin-group snapshot mismatch');
    }
    return Object.freeze({
      guid: (guid[0] as string).toUpperCase(),
      uid: Number(uid[0]),
    });
  }).sort((left, right) => left.uid - right.uid || left.guid.localeCompare(right.guid));
  if (
    new Set(memberPairs.map(({ uid }) => uid)).size !== 2
    || new Set(memberPairs.map(({ guid }) => guid)).size !== 2
    || [...groupMemberGuids].map((guid) => guid.toUpperCase()).sort().join('\n')
      !== memberPairs.map(({ guid }) => guid).sort().join('\n')
  ) {
    throw new Error('DA5 V5 trusted admin-group snapshot mismatch');
  }

  const fullRecordCanonical =
    `DA5-V5-TRUSTED-MACOS-ADMIN-FULL-GROUP-RECORD-V1\n`
    + `${JSON.stringify(normalizedGroup)}\n`;
  const membershipCanonical =
    'DA5-V5-TRUSTED-MACOS-ADMIN-MEMBERSHIP-V1\n'
    + memberPairs.map(({ uid, guid }) => `${uid}:${guid}\n`).join('');
  const fullRecordSha256 = sha256(fullRecordCanonical);
  const membershipSha256 = sha256(membershipCanonical);
  const combinedCanonical = [
    'DA5-V5-TRUSTED-MACOS-ADMIN-SNAPSHOT-V1',
    `gid:${gidValues[0]}`,
    `guid:${(groupGuids[0] as string).toUpperCase()}`,
    `group-record:${fullRecordSha256}`,
    `members:${membershipSha256}`,
    'nested-groups:0',
    '',
  ].join('\n');
  const combinedSnapshotSha256 = sha256(combinedCanonical);
  if (
    fullRecordSha256 !== DA5_V5_ADMIN_GROUP_ANCHOR.fullRecordSha256
    || membershipSha256 !== DA5_V5_ADMIN_GROUP_ANCHOR.membershipSha256
    || combinedSnapshotSha256
      !== DA5_V5_ADMIN_GROUP_ANCHOR.combinedSnapshotSha256
  ) {
    throw new Error('DA5 V5 trusted admin-group snapshot mismatch');
  }
  const snapshot = Object.freeze({
    [snapshotBrand]: true as const,
    combinedSnapshotSha256:
      DA5_V5_ADMIN_GROUP_ANCHOR.combinedSnapshotSha256,
    directMembers: 2 as const,
    fullRecordSha256: DA5_V5_ADMIN_GROUP_ANCHOR.fullRecordSha256,
    membershipSha256: DA5_V5_ADMIN_GROUP_ANCHOR.membershipSha256,
    nestedGroups: 0 as const,
    toJSON(): never {
      throw new Error('DA5 V5 trusted admin-group snapshot is private');
    },
  });
  protectedSnapshots.set(snapshot, Object.freeze({
    gid: Number(gidValues[0]),
    groupGuid: (groupGuids[0] as string).toUpperCase(),
    memberPairs: Object.freeze(memberPairs),
  }));
  return snapshot;
}

export async function bindDa5V5PostgresBinaryChain(options: {
  readonly pgConfigPath: string;
  readonly snapshot: Da5V5TrustedAdminGroupSnapshot;
}): Promise<Da5V5PostgresBinaryChain> {
  const protectedSnapshot = requireProtectedSnapshot(options.snapshot);
  const pgConfig = await requireCanonicalAbsoluteFile(options.pgConfigPath);
  const pgConfigDirectory = dirname(pgConfig);
  const uniquePaths = new Set<string>();
  const bound: BoundPath[] = [];
  try {
    for (const component of pathComponents(pgConfig)) {
      uniquePaths.add(component);
      bound.push(await bindPath(component, component === pgConfig));
    }
    validateBoundChain(bound, protectedSnapshot, process.geteuid?.(), 1);
    await revalidateBoundPaths(bound);
    const version = boundedSpawn(pgConfig, ['--version']);
    await revalidateBoundPaths(bound);
    const bindirOutput = boundedSpawn(pgConfig, ['--bindir']);
    await revalidateBoundPaths(bound);
    if (
      version !== 'PostgreSQL 17.10 (Homebrew)'
      || !bindirOutput.startsWith('/')
    ) {
      throw new Error('DA5 V5 PostgreSQL 17.10 discovery mismatch');
    }
    const bindir = await realpath(bindirOutput);
    if (bindir !== bindirOutput || bindir !== pgConfigDirectory) {
      throw new Error('DA5 V5 PostgreSQL canonical bindir mismatch');
    }
    const initdb = await requireCanonicalAbsoluteFile(join(bindir, 'initdb'));
    const postgres = await requireCanonicalAbsoluteFile(join(bindir, 'postgres'));
    for (const binary of [initdb, postgres]) {
      for (const component of pathComponents(binary)) {
        if (!uniquePaths.has(component)) {
          uniquePaths.add(component);
          bound.push(await bindPath(component, component === binary));
        }
      }
    }
    validateBoundChain(bound, protectedSnapshot, process.geteuid?.(), 3);
    await revalidateBoundPaths(bound);
    const record = Object.freeze(bound.map((entry) => Object.freeze({
      aclSha256: entry.aclSha256,
      binary: entry.binary,
      canonicalPath: entry.canonicalPath,
      dev: entry.dev.toString(),
      digest: entry.digest,
      gid: entry.gid,
      ino: entry.ino.toString(),
      mode: entry.mode,
      size: entry.size.toString(),
      uid: entry.uid,
    })));
    const chainDigest = sha256(JSON.stringify(record));
    const pgConfigBinding = requireBoundBinary(bound, pgConfig);
    const initdbBinding = requireBoundBinary(bound, initdb);
    const postgresBinding = requireBoundBinary(bound, postgres);
    const chain = Object.freeze({
      bindir,
      chainDigest,
      initdb,
      initdbFd: initdbBinding.fd.fd,
      pgConfig,
      pgConfigFd: pgConfigBinding.fd.fd,
      postgres,
      postgresDigest: postgresBinding.digest as string,
      postgresFd: postgresBinding.fd.fd,
      record,
      async close(): Promise<void> {
        await closeBoundPathHandles(bound);
        binaryChains.delete(chain);
      },
      async revalidate(snapshot: Da5V5TrustedAdminGroupSnapshot): Promise<void> {
        await verifyDa5V5TrustedAdminGroupSnapshotMatches(snapshot);
        const latestSnapshot = requireProtectedSnapshot(snapshot);
        await revalidateBoundPaths(bound);
        validateBoundChain(bound, latestSnapshot, process.geteuid?.(), 3);
        if (boundedSpawn(pgConfig, ['--version'])
          !== 'PostgreSQL 17.10 (Homebrew)'
          || boundedSpawn(pgConfig, ['--bindir']) !== bindir) {
          throw new Error('DA5 V5 PostgreSQL binary-chain revalidation mismatch');
        }
        await revalidateBoundPaths(bound);
      },
    });
    binaryChains.set(chain, Object.freeze(bound));
    return chain;
  } catch (error) {
    await closeBoundPathHandles(bound).catch(() => undefined);
    throw error;
  }
}

function requireBoundBinary(
  bindings: readonly BoundPath[],
  path: string,
): BoundPath {
  const binding = bindings.find((candidate) => (
    candidate.binary && candidate.canonicalPath === path
  ));
  if (binding === undefined) {
    throw new Error('DA5 V5 PostgreSQL binary descriptor is unavailable');
  }
  return binding;
}

export async function startDa5V5FullyAttestedLocalPostgresOwner(options: {
  readonly guardArtifactBinding: Da5V5RuntimeGuardArtifactBinding;
  readonly pgConfigPath: string;
  readonly signal?: AbortSignal;
  readonly temporaryBase?: string;
}): Promise<Da5V5PostgresOwnerBackend> {
  assertDa5V5RuntimeGuardArtifactBinding(options.guardArtifactBinding);
  return startDa5V5IsolatedPostgresOwner({
    guardArtifactBindingDigest: sha256([
      options.guardArtifactBinding.manifest.binary.sha256,
      options.guardArtifactBinding.manifestSha256,
      options.guardArtifactBinding.manifest.implementation.commit,
      options.guardArtifactBinding.manifest.implementation.tree,
    ].join('\n')),
    guardBinaryPath: options.guardArtifactBinding.manifest.binary.path,
    pgConfigPath: options.pgConfigPath,
    revalidateGuardArtifact: () => options.guardArtifactBinding.revalidate(),
    verifyGuardProcess: (pid) => verifyDa5V5RuntimeGuardRunningProcess(
      options.guardArtifactBinding,
      pid,
    ),
    signal: options.signal,
    temporaryBase: options.temporaryBase,
  }, 'production');
}

export async function startDa5V5FullyAttestedTestPostgresOwner(options: {
  readonly guardBinaryPath: string;
  readonly pgConfigPath: string;
  readonly signal?: AbortSignal;
  readonly temporaryBase?: string;
  readonly testOnlyRevalidateGuardArtifact?: () => Promise<void>;
  readonly testOnlyStartupFailureAfterProcessCapture?: (
    context: Readonly<{ lifecyclePath: string }>,
  ) => Promise<void>;
  readonly testOnlyStartupFailureAfterOwnership?: () => void;
}): Promise<Da5V5PostgresOwnerBackend> {
  assertDa5V5FocusedTestProcess();
  return startDa5V5IsolatedPostgresOwner({
    ...options,
    guardArtifactBindingDigest: sha256(await readFile(options.guardBinaryPath)),
    revalidateGuardArtifact: options.testOnlyRevalidateGuardArtifact,
    verifyGuardProcess: (pid) => verifyDa5V5RuntimeGuardRunningProcessForTest({
      binaryPath: options.guardBinaryPath,
      pid,
    }),
  }, 'test');
}

async function startDa5V5IsolatedPostgresOwner(options: {
  readonly guardArtifactBindingDigest: string;
  readonly guardBinaryPath: string;
  readonly pgConfigPath: string;
  readonly revalidateGuardArtifact?: () => Promise<void>;
  readonly verifyGuardProcess: (pid: number) => Promise<void>;
  readonly signal?: AbortSignal;
  readonly temporaryBase?: string;
  readonly testOnlyStartupFailureAfterProcessCapture?: (
    context: Readonly<{ lifecyclePath: string }>,
  ) => Promise<void>;
  readonly testOnlyStartupFailureAfterOwnership?: () => void;
}, expectedGuardBuild: 'production' | 'test'):
Promise<Da5V5PostgresOwnerBackend> {
  let lifecyclePhase: Da5V5PostgresLifecyclePhase = 'bind';
  rejectOperationalEnvironment(process.env);
  await retryDa5V5RetainedStartupCleanups();
  const snapshot = await verifyDa5V5TrustedAdminGroupSnapshot();
  const chain = await bindDa5V5PostgresBinaryChain({
    pgConfigPath: options.pgConfigPath,
    snapshot,
  });
  let stagingPath: string | null = null;
  let baseHandle: FileHandle | null = null;
  let stagingHandle: FileHandle | null = null;
  let rootHandle: FileHandle | null = null;
  let guard: RuntimeGuardClient | null = null;
  let bootstrapPool: Pool | null = null;
  let installerPool: Pool | null = null;
  let lifecycleFiles: BoundLifecycleFile[] = [];
  let lifecycleDirectories: BoundLifecycleDirectory[] = [];
  let heartbeat: NodeJS.Timeout | null = null;
  let postgresSpawned = false;
  let retainedPostgresPid: number | null = null;
  let cleanupReattest: (() => Promise<void>) | null = null;
  try {
    await chain.revalidate(snapshot);
    await assertPortAbsent(55_435);
    const base = await realpath(resolve(options.temporaryBase ?? tmpdir()));
    await validateDa5V5TemporaryBase(base);
    baseHandle = await open(base, constants.O_RDONLY);
    stagingPath = await mkdtemp(join(base, '.t5-'));
    await assertPrivateDirectory(stagingPath);
    stagingHandle = await open(stagingPath, constants.O_RDONLY);
    lifecyclePhase = 'probe';
    await options.revalidateGuardArtifact?.();
    await runProbeGuard({
      binaryPath: options.guardBinaryPath,
      expectedGuardBuild,
      stagingHandle,
      stagingPath,
      verifyRunningProcess: options.verifyGuardProcess,
    });
    await chain.revalidate(snapshot);

    lifecyclePhase = 'provisional';
    const lifecycleNonce = randomBytes(16).toString('hex');
    const rootName = `run-${lifecycleNonce}`;
    const tombstoneName = `.removed-${lifecycleNonce}`;
    const rootPath = join(stagingPath, rootName);
    const dataPath = join(rootPath, 'data');
    const socketPath = join(rootPath, 'socket');
    const logPath = join(rootPath, 'postgres.log');
    assertDa5V5UnixSocketPathBound(socketPath);
    await mkdir(rootPath, { mode: 0o700 });
    await mkdir(socketPath, { mode: 0o700 });
    rootHandle = await open(rootPath, constants.O_RDONLY);
    const capabilitySecret = randomBytes(32).toString('hex');
    const password = installerPasswordString(capabilitySecret);
    const installerPassword = Buffer.from(password);
    const exactConfiguration = exactPostgresConfiguration(socketPath);
    const lifecycleGeneration = randomBytes(16).toString('hex');
    const artifactDigest = options.guardArtifactBindingDigest;
    const provisionalBindings = Object.freeze({
      artifactDigest,
      binaryChainDigest: chain.chainDigest,
      capabilityDigest: sha256(capabilitySecret),
      dataPath,
      lifecycleGeneration,
      logPath,
      root: stableStatRecord(await rootHandle.stat({ bigint: true })),
      rootPath,
      socketPath,
      staging: stableStatRecord(await stagingHandle.stat({ bigint: true })),
      trustedGroup: Object.freeze({
        combinedSnapshotSha256: snapshot.combinedSnapshotSha256,
        directMembers: snapshot.directMembers,
        fullRecordSha256: snapshot.fullRecordSha256,
        membershipSha256: snapshot.membershipSha256,
        nestedGroups: snapshot.nestedGroups,
      }),
    });
    const provisionalDigest = sha256(JSON.stringify(provisionalBindings));
    lifecyclePhase = 'initdb';
    await options.revalidateGuardArtifact?.();
    guard = await RuntimeGuardClient.launch({
      binaryPath: options.guardBinaryPath,
      artifactDigest,
      capabilitySecret,
      chainDigest: chain.chainDigest,
      configuration: exactConfiguration.configuration,
      configurationDigest: exactConfiguration.digest,
      dataPath,
      expectedBuild: expectedGuardBuild,
      hba: exactConfiguration.hba,
      initdbPath: chain.initdb,
      logPath,
      lifecycleGeneration,
      mode: 'START',
      postgresPath: chain.postgres,
      postgresFd: chain.postgresFd,
      pgConfigFd: chain.pgConfigFd,
      rootHandle,
      rootName,
      secret: installerPassword,
      socketPath,
      stagingHandle,
      baseHandle,
      initdbFd: chain.initdbFd,
      tombstoneName,
      verifyRunningProcess: options.verifyGuardProcess,
    });
    const startupGuard = guard;
    cleanupReattest = async (): Promise<void> => {
      throw new Error(
        'DA5 V5 Guard process identity was not successfully captured',
      );
    };
    const guardProcessRecord = await captureProcessIdentity({
      authoritativeSessionId: startupGuard.helloIdentity.sessionId,
      executableDigest: artifactDigest,
      executablePath: options.guardBinaryPath,
      expectedParentPid: process.pid,
      expectedProcessGroup: startupGuard.helloIdentity.pgid,
      pid: startupGuard.child.pid as number,
    });
    cleanupReattest = async (): Promise<void> => {
      await options.revalidateGuardArtifact?.();
      await chain.revalidate(snapshot);
      const latestGuardProcess = await captureProcessIdentity({
        authoritativeSessionId: startupGuard.helloIdentity.sessionId,
        executableDigest: artifactDigest,
        executablePath: options.guardBinaryPath,
        expectedParentPid: process.pid,
        expectedProcessGroup: startupGuard.helloIdentity.pgid,
        pid: startupGuard.child.pid as number,
      });
      assertMatchingProcessIdentity(guardProcessRecord, latestGuardProcess);
    };
    installerPassword.fill(0);
    if (options.signal?.aborted === true) {
      throw new Error('DA5 V5 isolated PostgreSQL startup interrupted');
    }
    const mountBindingEvent = await guard.expectPrefix(
      'MOUNT_BINDING|',
      5_000,
    );
    const mountIdentityRecord = parseMountIdentityRecord(mountBindingEvent);
    const mountBindingDigest = mountIdentityRecord.canonicalSha256;
    await guard.expect('INITDB_OK', 35_000);
    lifecyclePhase = 'config';
    for (const path of [
      join(dataPath, 'postgresql.conf'),
      join(dataPath, 'pg_hba.conf'),
      join(dataPath, 'postgresql.auto.conf'),
    ]) {
      lifecycleFiles.push(await bindLifecycleFile(path, true));
    }
    await revalidateLifecycleFiles(lifecycleFiles);
    await chain.revalidate(snapshot);
    await guard.sendAuthenticated('CONFIG_READY');
    lifecyclePhase = 'spawn';
    const spawned = await guard.expectPrefix('POSTGRES_SPAWNED|', 5_000);
    const postgresPidText = spawned.slice('POSTGRES_SPAWNED|'.length);
    if (!/^[1-9][0-9]*$/u.test(postgresPidText)) {
      throw new Error('DA5 V5 PostgreSQL process attestation is invalid');
    }
    const postgresPid = Number(postgresPidText);
    retainedPostgresPid = postgresPid;
    postgresSpawned = true;
    cleanupReattest = async (): Promise<void> => {
      throw new Error(
        'DA5 V5 PostgreSQL process identity was not successfully captured',
      );
    };
    const postgresProcessRecord = await captureProcessIdentity({
      authoritativeSessionId: guard.helloIdentity.sessionId,
      executableDigest: chain.postgresDigest,
      executablePath: chain.postgres,
      expectedParentPid: guard.child.pid as number,
      expectedProcessGroup: guard.helloIdentity.pgid,
      pid: postgresPid,
    });
    cleanupReattest = async (): Promise<void> => {
      await options.revalidateGuardArtifact?.();
      await chain.revalidate(snapshot);
      await revalidateLifecycleFiles(lifecycleFiles);
      const latestGuardProcess = await captureProcessIdentity({
        authoritativeSessionId: startupGuard.helloIdentity.sessionId,
        executableDigest: artifactDigest,
        executablePath: options.guardBinaryPath,
        expectedParentPid: process.pid,
        expectedProcessGroup: startupGuard.helloIdentity.pgid,
        pid: startupGuard.child.pid as number,
      });
      const latestPostgresProcess = await captureProcessIdentity({
        authoritativeSessionId: startupGuard.helloIdentity.sessionId,
        executableDigest: chain.postgresDigest,
        executablePath: chain.postgres,
        expectedParentPid: startupGuard.child.pid as number,
        expectedProcessGroup: startupGuard.helloIdentity.pgid,
        pid: postgresPid,
      });
      assertMatchingProcessIdentity(guardProcessRecord, latestGuardProcess);
      assertMatchingProcessIdentity(
        postgresProcessRecord,
        latestPostgresProcess,
      );
    };
    const logBinding = await bindLifecycleFile(logPath, false);
    lifecycleFiles.push(logBinding);
    heartbeat = setInterval(() => {
      guard?.sendAuthenticated('HEARTBEAT').catch(() => undefined);
    }, 1_000);
    heartbeat.unref();
    await options.testOnlyStartupFailureAfterProcessCapture?.({
      lifecyclePath: logPath,
    });
    lifecyclePhase = 'readiness';
    const bootstrapUrl = postgresUrl(password, 'postgres');
    bootstrapPool = await waitForPostgres(
      bootstrapUrl,
      guard,
      logPath,
      expectedGuardBuild === 'test',
    );
    lifecyclePhase = 'untouched';
    await attestUntouchedCluster(bootstrapPool);
    lifecyclePhase = 'create';
    await bootstrapPool.query(
      'CREATE DATABASE taptime_synthetic_android_e2e '
      + 'OWNER taptime_da5_v5_installer TEMPLATE template0',
    );
    await bootstrapPool.end();
    bootstrapPool = null;
    lifecyclePhase = 'empty-attestation';
    const installerUrl = postgresUrl(password, 'taptime_synthetic_android_e2e');
    installerPool = new Pool({
      connectionString: installerUrl,
      connectionTimeoutMillis: 5_000,
      max: 2,
      query_timeout: 5_000,
      statement_timeout: 5_000,
    });
    const attestation = await attestEmptyDa5Database(installerPool);
    const postmasterBinding = await bindLifecycleFile(
      join(dataPath, 'postmaster.pid'),
      true,
    );
    lifecycleFiles.push(postmasterBinding);
    const postmasterContents = await readLifecycleFile(postmasterBinding);
    assertPostmasterPidBinding(postmasterContents, {
      dataPath,
      pid: postgresPid,
      socketPath,
    });
    const socketBinding = await bindLifecycleSocket(
      join(socketPath, '.s.PGSQL.55435'),
    );
    for (const directoryBinding of [
      { existingHandle: baseHandle, ownsHandle: false, path: base },
      {
        existingHandle: stagingHandle,
        ownsHandle: false,
        path: stagingPath,
      },
      { existingHandle: rootHandle, ownsHandle: false, path: rootPath },
      { existingHandle: undefined, ownsHandle: true, path: dataPath },
      { existingHandle: undefined, ownsHandle: true, path: socketPath },
    ]) {
      lifecycleDirectories.push(await bindLifecycleDirectory(
        directoryBinding.path,
        directoryBinding.existingHandle,
        directoryBinding.ownsHandle,
      ));
    }
    await revalidateLifecycleFiles(lifecycleFiles);
    await revalidateLifecycleDirectories(lifecycleDirectories);
    await revalidateLifecycleSocket(socketBinding);
    await chain.revalidate(snapshot);
    const activeGuard = guard;
    const activeStagingPath = stagingPath;
    const activeStagingHandle = stagingHandle;
    const activeBaseHandle = baseHandle;
    const activeRootHandle = rootHandle;
    const activeChain = chain;
    const activePool = installerPool;
    const activeInstallerOperations = createPostgresOperationFacade(activePool);
    const activeHeartbeat = heartbeat;
    const ownedRuntimePools = new Set<Pool>();
    let ownerState: 'active' | 'cleanup-incomplete' | 'closed' = 'active';
    let cleanupInFlight: Promise<void> | null = null;
    let heartbeatClosed = false;
    let activePoolClosed = false;
    let destructiveAttestationPassed = false;
    let stopAttempted = false;
    let stopSent = false;
    let postgresReaped = false;
    let guardCleanupConfirmed = false;
    let guardControlClosed = false;
    let guardSecretClosed = false;
    let guardExited = false;
    let guardEventClosed = false;
    const closedLifecycleFiles = new Set<BoundLifecycleFile>();
    const closedLifecycleDirectories = new Set<BoundLifecycleDirectory>();
    let rootHandleClosed = false;
    let stagingHandleClosed = false;
    let baseHandleClosed = false;
    let chainClosed = false;
    let stagingRemoved = false;
    const ownerAttestation = Object.freeze({
      database: 'taptime_synthetic_android_e2e' as const,
      host: '127.0.0.1' as const,
      port: 55_435 as const,
      role: 'taptime_da5_v5_installer' as const,
      serverVersionNumber: 170_010 as const,
      systemIdentifier: attestation.systemIdentifier,
    });
    const [rootIdentityState, stagingIdentityState, socketIdentityState] =
      await Promise.all([
        activeRootHandle.stat({ bigint: true }),
        activeStagingHandle.stat({ bigint: true }),
        stat(socketPath, { bigint: true }),
      ]);
    const configurationBindingDigest = sha256(JSON.stringify(
      lifecycleFiles.slice(0, 3).map(lifecycleFileRecord),
    ));
    const directoryIdentity = sha256(JSON.stringify(
      lifecycleDirectories.map(lifecycleDirectoryRecord),
    ));
    const dataDirectoryBinding = lifecycleDirectories.find(
      ({ path }) => path === dataPath,
    );
    if (dataDirectoryBinding === undefined) {
      throw new Error('DA5 V5 PostgreSQL data-directory binding is missing');
    }
    const dataDirectoryIdentity = sha256(JSON.stringify(
      lifecycleDirectoryRecord(dataDirectoryBinding),
    ));
    const logDescriptorDigest = sha256(JSON.stringify(
      lifecycleFileRecord(logBinding),
    ));
    const postmasterDigest = sha256(JSON.stringify(
      lifecycleFileRecord(postmasterBinding),
    ));
    const socketIdentity = sha256(JSON.stringify({
      directory: {
        path: socketPath,
        state: stableStatRecord(socketIdentityState),
      },
      socket: socketBinding,
    }));
    const lifecycleBindings = {
      artifactDigest,
      binaryChainDigest: activeChain.chainDigest,
      binaryChainManifest: activeChain.record,
      capabilityDigest: sha256(capabilitySecret),
      catalogDigest: sha256(JSON.stringify(ownerAttestation)),
      configurationDigest: sha256([
        exactConfiguration.digest,
        configurationBindingDigest,
      ].join('\n')),
      dataDirectoryIdentity,
      directoryIdentity,
      guardExecutableDigest: artifactDigest,
      logDescriptorDigest,
      mountIdentityRecord,
      mountIdentity: mountBindingDigest,
      ownerProcess: sha256(JSON.stringify(guardProcessRecord)),
      guardProcessRecord,
      postmasterDigest,
      postgresProcessRecord,
      processIdentity: sha256(JSON.stringify(postgresProcessRecord)),
      provisionalDigest,
      rootIdentity: sha256(JSON.stringify({
        root: stableStatRecord(rootIdentityState),
        staging: stableStatRecord(stagingIdentityState),
      })),
      socketIdentity,
      trustedGroupDigest: sha256(JSON.stringify(
        provisionalBindings.trustedGroup,
      )),
      version: 'DA5-V5-LIFECYCLE-V1' as const,
    };
    const lifecycleRecord = Object.freeze({
      ...lifecycleBindings,
      finalDigest: sha256(JSON.stringify(lifecycleBindings)),
    });
    const revalidateLifecycleRecord = async (): Promise<void> => {
      await revalidateLifecycleFiles(lifecycleFiles);
      await revalidateLifecycleDirectories(lifecycleDirectories);
      await revalidateLifecycleSocket(socketBinding);
      assertPostmasterPidBinding(await readLifecycleFile(postmasterBinding), {
        dataPath,
        pid: postgresPid,
        socketPath,
      });
      const latestGuardProcess = await captureProcessIdentity({
        authoritativeSessionId: activeGuard.helloIdentity.sessionId,
        executableDigest: artifactDigest,
        executablePath: options.guardBinaryPath,
        expectedParentPid: process.pid,
        expectedProcessGroup: activeGuard.helloIdentity.pgid,
        pid: activeGuard.child.pid as number,
      });
      const latestPostgresProcess = await captureProcessIdentity({
        authoritativeSessionId: activeGuard.helloIdentity.sessionId,
        executableDigest: activeChain.postgresDigest,
        executablePath: activeChain.postgres,
        expectedParentPid: activeGuard.child.pid as number,
        expectedProcessGroup: activeGuard.helloIdentity.pgid,
        pid: postgresPid,
      });
      assertMatchingProcessIdentity(guardProcessRecord, latestGuardProcess);
      assertMatchingProcessIdentity(
        postgresProcessRecord,
        latestPostgresProcess,
      );
      if (
        sha256(JSON.stringify(lifecycleBindings)) !== lifecycleRecord.finalDigest
        || sha256(JSON.stringify(provisionalBindings))
          !== lifecycleRecord.provisionalDigest
        || sha256(JSON.stringify(activeChain.record))
          !== lifecycleRecord.binaryChainDigest
        || sha256(mountIdentityRecord.canonicalRecord)
          !== mountIdentityRecord.canonicalSha256
        || mountIdentityRecord.canonicalSha256
          !== lifecycleRecord.mountIdentity
        || JSON.stringify(lifecycleRecord.mountIdentityRecord)
          !== JSON.stringify(mountIdentityRecord)
      ) {
        throw new Error('DA5 V5 PostgreSQL lifecycle record mismatch');
      }
    };
    cleanupReattest = async (): Promise<void> => {
      await options.revalidateGuardArtifact?.();
      await activeChain.revalidate(snapshot);
      await revalidateLifecycleRecord();
    };
    options.testOnlyStartupFailureAfterOwnership?.();
    const reattestOwner = async (
      stage: Da5V5PostgresAttestationStage,
    ): Promise<void> => {
      if (ownerState !== 'active') {
        throw new Error('DA5 V5 isolated PostgreSQL owner is closed');
      }
      await options.revalidateGuardArtifact?.();
      await activeChain.revalidate(snapshot);
      await revalidateLifecycleRecord();
      await attestDa5V5OwnerLifecycle(
        activePool,
        ownerAttestation,
        stage,
      );
    };
    return Object.freeze({
      attestation: ownerAttestation,
      lifecycleRecord,
      async closeOwner(closeOptions: {
        readonly destructiveAuthorityRevoked?: boolean;
      } = {}): Promise<void> {
        if (ownerState === 'closed') {
          throw new Error('DA5 V5 isolated PostgreSQL owner is closed');
        }
        if (cleanupInFlight !== null) {
          return cleanupInFlight;
        }
        let destructiveAuthorityRevoked =
          closeOptions.destructiveAuthorityRevoked === true;
        ownerState = 'cleanup-incomplete';
        cleanupInFlight = (async (): Promise<void> => {
          const cleanupState: Da5V5CleanupFailureState = {};
          const attempt = async (
            action: () => Promise<void> | void,
            completed: () => void,
          ): Promise<void> => {
            await attemptDa5V5CleanupStage(
              cleanupState,
              action,
              completed,
            );
          };
          const closePool = async (pool: Pool): Promise<void> => {
            try {
              await pool.end();
            } catch (error: unknown) {
              if (
                !(error instanceof Error)
                || !/Called end on pool more than once/u.test(error.message)
              ) {
                throw error;
              }
            }
          };

          if (
            !destructiveAuthorityRevoked
            && !destructiveAttestationPassed
          ) {
            const stopCompleted = await attemptDa5V5ReattestationBoundStop(
              cleanupState,
              cleanupReattest as () => Promise<void>,
              async () => activeGuard.sendAuthenticated('STOP_FAST'),
              () => {
                destructiveAttestationPassed = true;
              },
              () => {
                stopAttempted = true;
                stopSent = true;
              },
            );
            if (!destructiveAttestationPassed) {
              destructiveAuthorityRevoked = true;
            }
            if (destructiveAttestationPassed && !stopCompleted) {
              stopAttempted = true;
            }
          }
          if (destructiveAuthorityRevoked) {
            throw new Error(
              'DA5 V5 isolated PostgreSQL cleanup authority was revoked; '
              + 'live ownership was retained',
              cleanupState.firstFailure === undefined
                ? undefined
                : { cause: cleanupState.firstFailure },
            );
          }

          for (const pool of [...ownedRuntimePools]) {
            await attempt(
              async () => closePool(pool),
              () => ownedRuntimePools.delete(pool),
            );
          }
          if (!heartbeatClosed) {
            await attempt(
              () => clearInterval(activeHeartbeat),
              () => {
                heartbeatClosed = true;
              },
            );
          }
          if (!activePoolClosed) {
            await attempt(
              async () => closePool(activePool),
              () => {
                activePoolClosed = true;
              },
            );
          }
          if (!guardControlClosed) {
            await attempt(
              async () => activeGuard.closeControlPipe(),
              () => {
                guardControlClosed = true;
              },
            );
          }
          if (!guardSecretClosed) {
            await attempt(
              async () => activeGuard.closeSecretPipe(),
              () => {
                guardSecretClosed = true;
              },
            );
          }
          if (!postgresReaped) {
            await attempt(
              async () => activeGuard.expect('POSTGRES_REAPED', 35_000),
              () => {
                postgresReaped = true;
              },
            );
          }
          if (!guardCleanupConfirmed) {
            await attempt(
              async () => activeGuard.expect('CLEANUP_OK', 10_000),
              () => {
                guardCleanupConfirmed = true;
              },
            );
          }
          if (!guardExited) {
            await attempt(
              async () => activeGuard.waitForExit(),
              () => {
                guardExited = true;
              },
            );
          }
          if (!guardEventClosed) {
            await attempt(
              async () => activeGuard.closeEventPipe(),
              () => {
                guardEventClosed = true;
              },
            );
          }
          for (const binding of lifecycleFiles) {
            if (!closedLifecycleFiles.has(binding)) {
              await attempt(
                async () => binding.handle.close(),
                () => closedLifecycleFiles.add(binding),
              );
            }
          }
          for (const binding of lifecycleDirectories) {
            if (
              binding.ownsHandle
              && !closedLifecycleDirectories.has(binding)
            ) {
              await attempt(
                async () => binding.handle.close(),
                () => closedLifecycleDirectories.add(binding),
              );
            }
          }
          if (!rootHandleClosed) {
            await attempt(
              async () => activeRootHandle.close(),
              () => {
                rootHandleClosed = true;
              },
            );
          }
          if (!stagingHandleClosed) {
            await attempt(
              async () => activeStagingHandle.close(),
              () => {
                stagingHandleClosed = true;
              },
            );
          }
          if (!baseHandleClosed) {
            await attempt(
              async () => activeBaseHandle.close(),
              () => {
                baseHandleClosed = true;
              },
            );
          }
          if (!chainClosed) {
            await attempt(
              async () => activeChain.close(),
              () => {
                chainClosed = true;
              },
            );
          }
          if (!stagingRemoved) {
            await attempt(
              async () => rmdir(activeStagingPath),
              () => {
                stagingRemoved = true;
              },
            );
          }
          if (
            cleanupState.firstFailure === undefined
            && ownedRuntimePools.size === 0
            && heartbeatClosed
            && activePoolClosed
            && stopSent
            && destructiveAttestationPassed
            && guardControlClosed
            && guardSecretClosed
            && postgresReaped
            && guardCleanupConfirmed
            && guardExited
            && guardEventClosed
            && closedLifecycleFiles.size === lifecycleFiles.length
            && closedLifecycleDirectories.size === lifecycleDirectories
              .filter(({ ownsHandle }) => ownsHandle).length
            && rootHandleClosed
            && stagingHandleClosed
            && baseHandleClosed
            && chainClosed
            && stagingRemoved
          ) {
            ownerState = 'closed';
            return;
          }
          throw new Error('DA5 V5 isolated PostgreSQL cleanup failed');
        })();
        try {
          await cleanupInFlight;
        } finally {
          cleanupInFlight = null;
        }
      },
      ownerDigest: sha256([
        chain.chainDigest,
        snapshot.combinedSnapshotSha256,
        attestation.systemIdentifier,
      ].join('\n')),
      async provisionRuntimePool(
        request: Da5V5RuntimePoolRequest,
      ): Promise<Da5V5PostgresOperations> {
        await reattestOwner('after-migrations');
        const exactRoles = validateRuntimePoolRequest(request);
        const runtimePassword = randomBytes(32).toString('base64url');
        await normalizeOwnedRuntimeLogin(
          activePool,
          request.login,
          runtimePassword,
          exactRoles,
        );
        const pool = new Pool({
          connectionString: runtimePostgresUrl(
            password,
            request.login,
            runtimePassword,
          ),
          connectionTimeoutMillis: 5_000,
          max: request.max,
          query_timeout: 5_000,
          statement_timeout: 5_000,
        });
        ownedRuntimePools.add(pool);
        return createPostgresOperationFacade(pool);
      },
      reattest: reattestOwner,
      source: 'isolated-runtime-guard' as const,
      async withInstaller<T>(
        action: (pool: Da5V5PostgresOperations) => Promise<T>,
      ): Promise<T> {
        if (ownerState !== 'active') {
          throw new Error('DA5 V5 isolated PostgreSQL owner is closed');
        }
        return action(activeInstallerOperations);
      },
    });
  } catch (error: unknown) {
    const primaryFailure = expectedGuardBuild === 'test'
      && error instanceof Error
      ? error
      : disclosureSafeDa5V5PostgresLifecycleError(error, lifecyclePhase);
    const failedGuard = guard;
    const failedBootstrapPool = bootstrapPool;
    const failedInstallerPool = installerPool;
    const failedHeartbeat = heartbeat;
    const failedStagingPath = stagingPath;
    let startupDestructiveAuthority = failedGuard === null;
    let startupStopAttempted = failedGuard === null;
    let startupHeartbeatClosed = failedHeartbeat === null;
    let bootstrapPoolClosed = failedBootstrapPool === null;
    let installerPoolClosed = failedInstallerPool === null;
    let guardControlClosed = failedGuard === null;
    let guardSecretClosed = failedGuard === null;
    let postgresReaped = !postgresSpawned;
    let guardCleanupConfirmed = !postgresSpawned;
    let guardExited = failedGuard === null;
    let guardEventClosed = failedGuard === null;
    const closedFiles = new Set<BoundLifecycleFile>();
    const closedDirectories = new Set<BoundLifecycleDirectory>();
    let rootClosed = rootHandle === null;
    let stagingClosed = stagingHandle === null;
    let baseClosed = baseHandle === null;
    let chainClosed = false;
    let stagingRemoved = failedStagingPath === null;
    const closePool = async (pool: Pool): Promise<void> => {
      try {
        await pool.end();
      } catch (poolError: unknown) {
        if (
          !(poolError instanceof Error)
          || !/Called end on pool more than once/u.test(poolError.message)
        ) {
          throw poolError;
        }
      }
    };
    const retained: Da5V5RetainedStartupCleanup = Object.freeze({
      guardPid: failedGuard?.child.pid ?? null,
      postgresPid: retainedPostgresPid,
      async retry(): Promise<void> {
        const cleanupState: Da5V5CleanupFailureState = {};
        const attempt = async (
          action: () => Promise<void> | void,
          completed: () => void,
        ): Promise<void> => {
          await attemptDa5V5CleanupStage(cleanupState, action, completed);
        };
        if (failedGuard !== null && !startupDestructiveAuthority) {
          await attemptDa5V5CleanupStage(
            cleanupState,
            cleanupReattest ?? (async () => {
              throw new Error(
                'DA5 V5 startup process identity was not bound for cleanup',
              );
            }),
            () => {
              startupDestructiveAuthority = true;
            },
          );
          if (!startupDestructiveAuthority) {
            throw new Error(
              'DA5 V5 startup cleanup authority was revoked; '
              + 'live ownership was retained',
              cleanupState.firstFailure === undefined
                ? undefined
                : { cause: cleanupState.firstFailure },
            );
          }
        }
        if (failedGuard !== null && !startupStopAttempted) {
          startupStopAttempted = true;
          await attempt(
            async () => failedGuard.sendAuthenticated('STOP_FAST'),
            () => undefined,
          );
        }
        if (!startupHeartbeatClosed && failedHeartbeat !== null) {
          await attempt(
            () => clearInterval(failedHeartbeat),
            () => {
              startupHeartbeatClosed = true;
            },
          );
        }
        if (!bootstrapPoolClosed && failedBootstrapPool !== null) {
          await attempt(
            async () => closePool(failedBootstrapPool),
            () => {
              bootstrapPoolClosed = true;
            },
          );
        }
        if (!installerPoolClosed && failedInstallerPool !== null) {
          await attempt(
            async () => closePool(failedInstallerPool),
            () => {
              installerPoolClosed = true;
            },
          );
        }
        if (failedGuard !== null && !guardControlClosed) {
          await attempt(
            async () => failedGuard.closeControlPipe(),
            () => {
              guardControlClosed = true;
            },
          );
        }
        if (failedGuard !== null && !guardSecretClosed) {
          await attempt(
            async () => failedGuard.closeSecretPipe(),
            () => {
              guardSecretClosed = true;
            },
          );
        }
        if (failedGuard !== null && !postgresReaped) {
          await attempt(
            async () => failedGuard.expect('POSTGRES_REAPED', 35_000),
            () => {
              postgresReaped = true;
            },
          );
        }
        if (failedGuard !== null && !guardCleanupConfirmed) {
          await attempt(
            async () => failedGuard.expect('CLEANUP_OK', 10_000),
            () => {
              guardCleanupConfirmed = true;
            },
          );
        }
        if (failedGuard !== null && !guardExited) {
          await attempt(
            async () => failedGuard.waitForExit(),
            () => {
              guardExited = true;
            },
          );
        }
        if (failedGuard !== null && !guardEventClosed) {
          await attempt(
            async () => failedGuard.closeEventPipe(),
            () => {
              guardEventClosed = true;
            },
          );
        }
        for (const binding of lifecycleFiles) {
          if (!closedFiles.has(binding)) {
            await attempt(
              async () => binding.handle.close(),
              () => closedFiles.add(binding),
            );
          }
        }
        for (const binding of lifecycleDirectories) {
          if (binding.ownsHandle && !closedDirectories.has(binding)) {
            await attempt(
              async () => binding.handle.close(),
              () => closedDirectories.add(binding),
            );
          }
        }
        if (!rootClosed && rootHandle !== null) {
          await attempt(
            async () => rootHandle?.close(),
            () => {
              rootClosed = true;
            },
          );
        }
        if (!stagingClosed && stagingHandle !== null) {
          await attempt(
            async () => stagingHandle?.close(),
            () => {
              stagingClosed = true;
            },
          );
        }
        if (!baseClosed && baseHandle !== null) {
          await attempt(
            async () => baseHandle?.close(),
            () => {
              baseClosed = true;
            },
          );
        }
        if (!chainClosed) {
          await attempt(
            async () => chain.close(),
            () => {
              chainClosed = true;
            },
          );
        }
        if (!stagingRemoved && failedStagingPath !== null) {
          await attempt(
            async () => rmdir(failedStagingPath),
            () => {
              stagingRemoved = true;
            },
          );
        }
        if (cleanupState.firstFailure !== undefined) {
          throw new Error('DA5 V5 retained startup cleanup failed', {
            cause: cleanupState.firstFailure,
          });
        }
      },
    });
    retainedStartupCleanups.add(retained);
    try {
      await retained.retry();
      retainedStartupCleanups.delete(retained);
    } catch (cleanupError: unknown) {
      throw new Error(`${primaryFailure.message};cleanup-incomplete`, {
        cause: cleanupError,
      });
    }
    throw primaryFailure;
  }
}

function createPostgresOperationFacade(
  pool: Pool,
): Da5V5PostgresOperations {
  return Object.freeze({
    async connect() {
      const client = await pool.connect();
      return Object.freeze({
        query: client.query.bind(client),
        release: client.release.bind(client),
        toJSON(): never {
          throw new Error('DA5 V5 PostgreSQL client operations are not serializable');
        },
        toString(): never {
          throw new Error('DA5 V5 PostgreSQL client operations are not stringifiable');
        },
      });
    },
    end: () => pool.end(),
    query: pool.query.bind(pool),
    toJSON(): never {
      throw new Error('DA5 V5 PostgreSQL operations are not serializable');
    },
    toString(): never {
      throw new Error('DA5 V5 PostgreSQL operations are not stringifiable');
    },
  });
}

export type Da5V5PostgresLifecyclePhase =
  | 'bind'
  | 'probe'
  | 'provisional'
  | 'initdb'
  | 'config'
  | 'spawn'
  | 'readiness'
  | 'untouched'
  | 'create'
  | 'empty-attestation'
  | 'cleanup';

export function disclosureSafeDa5V5PostgresLifecycleError(
  error: unknown,
  phase: Da5V5PostgresLifecyclePhase,
): Error {
  const category = error instanceof TypeError
    ? 'internal-type-error'
    : error instanceof Error
      ? 'runtime-error'
      : 'unknown-error';
  let message = '';
  if (error instanceof Error) {
    try {
      message = typeof error.message === 'string' ? error.message : '';
    } catch {
      message = '';
    }
  }
  let sqlstate = 'none';
  if (
    error !== null
    && (typeof error === 'object' || typeof error === 'function')
    && Object.hasOwn(error, 'code')
  ) {
    try {
      const code = Reflect.get(error, 'code');
      if (typeof code === 'string' && /^[0-9A-Z]{5}$/u.test(code)) {
        sqlstate = code;
      }
    } catch {
      sqlstate = 'none';
    }
  }
  let position = 'none';
  if (
    error !== null
    && (typeof error === 'object' || typeof error === 'function')
    && Object.hasOwn(error, 'position')
  ) {
    try {
      const candidate = Reflect.get(error, 'position');
      if (
        typeof candidate === 'string'
        && /^[1-9][0-9]{0,4}$/u.test(candidate)
        && Number(candidate) <= 10_000
      ) {
        position = candidate;
      }
    } catch {
      position = 'none';
    }
  }
  return new Error(
    'DA5 V5 isolated PostgreSQL lifecycle failed '
    + `(${phase};${category};${sqlstate};${position};`
    + `${sha256(`${category}\n${message}`)})`,
  );
}

export function rejectOperationalEnvironment(environment: NodeJS.ProcessEnv): void {
  if (Object.keys(environment).some((name) => (
    /^(?:CC|CFLAGS|CPPFLAGS|LDFLAGS|CPATH|C_INCLUDE_PATH|CPLUS_INCLUDE_PATH)$/u.test(name)
    || /^(?:OBJC_INCLUDE_PATH|LIBRARY_PATH|SDKROOT|DEVELOPER_DIR)$/u.test(name)
    || /^(?:DYLD_|LD_|PG|PQ|LC_)/u.test(name)
    || /^(?:LANG|LANGUAGE)$/u.test(name)
    || name === 'TAPTIME_SYNTHETIC_E2E_DATABASE_URL'
  ))) {
    throw new Error('DA5 V5 inherited runtime/database environment is rejected');
  }
}

export function assertDa5V5UnixSocketPathBound(socketDirectory: string): void {
  const socketPath = join(socketDirectory, '.s.PGSQL.55435');
  if (
    !socketDirectory.startsWith('/')
    || Buffer.byteLength(socketPath) > 103
  ) {
    throw new Error('DA5 V5 private PostgreSQL socket path is too long');
  }
}

export type Da5V5PostgresStartupFailureClass =
  | 'address-unavailable'
  | 'authentication-rejected'
  | 'configuration-rejected'
  | 'data-directory-incompatible'
  | 'fatal-or-panic'
  | 'loader-unavailable'
  | 'lock-file-path-too-long'
  | 'path-unavailable'
  | 'permission-or-ownership'
  | 'resource-unavailable'
  | 'socket-path-too-long'
  | 'unclassified';

export interface Da5V5PostgresStartupFailureDiagnostic {
  readonly category: Da5V5PostgresStartupFailureClass;
  readonly fingerprint: string;
}

export interface Da5V5TestPostgresStartupFailureDiagnostic
extends Da5V5PostgresStartupFailureDiagnostic {
  readonly normalizedTemplate: string;
}

export async function classifyDa5V5PostgresStartupFailure(
  logPath: string,
): Promise<Da5V5PostgresStartupFailureDiagnostic> {
  const descriptor = await open(
    logPath,
    constants.O_RDONLY | constants.O_NOFOLLOW,
  );
  try {
    const before = await descriptor.stat();
    if (!before.isFile() || before.size > 1_048_576) {
      return Object.freeze({
        category: 'unclassified',
        fingerprint: sha256(
          `DA5-V5-POSTGRES-STARTUP-LOG-UNAVAILABLE-V1\n${before.size}\n`,
        ),
      });
    }
    const contents = await descriptor.readFile({ encoding: 'utf8' });
    const fingerprint = sha256(Buffer.from(contents));
    const after = await descriptor.stat();
    if (
      before.dev !== after.dev
      || before.ino !== after.ino
      || before.size !== after.size
      || before.mtimeMs !== after.mtimeMs
    ) {
      return Object.freeze({ category: 'unclassified', fingerprint });
    }
    let category: Da5V5PostgresStartupFailureClass = 'unclassified';
    if (
      /lock file[\s\S]*too long/iu.test(contents)
      || /Lockdatei[\s\S]*zu lang/iu.test(contents)
    ) {
      category = 'lock-file-path-too-long';
    } else if (
      /Unix-domain socket path[\s\S]*too long/iu.test(contents)
      || /Unix-Domain-Socket-Pfad[\s\S]*zu lang/iu.test(contents)
    ) {
      category = 'socket-path-too-long';
    } else if (
      /could not bind[\s\S]*(?:Address already in use|Permission denied)/iu
        .test(contents)
      || /address already in use/iu.test(contents)
      || /konnte[\s\S]*nicht binden/iu.test(contents)
      || /Adresse bereits in Benutzung/iu.test(contents)
    ) {
      category = 'address-unavailable';
    } else if (
      /No such file or directory|Not a directory/iu.test(contents)
      || /Datei oder Verzeichnis nicht gefunden|Kein Verzeichnis/iu.test(contents)
    ) {
      category = 'path-unavailable';
    } else if (
      /Permission denied|Operation not permitted|wrong ownership/iu.test(contents)
      || /invalid permissions|must be owned by/iu.test(contents)
      || /Keine Berechtigung|Operation nicht erlaubt|falsche Eigentümerschaft/iu
        .test(contents)
      || /ungültige Zugriffsrechte|muss .* gehören/iu.test(contents)
    ) {
      category = 'permission-or-ownership';
    } else if (
      /unrecognized configuration parameter|invalid value for parameter/iu
        .test(contents)
      || /syntax error in file|configuration file contains errors/iu
        .test(contents)
      || /unbekannter Konfigurationsparameter|ungültiger Wert für Parameter/iu
        .test(contents)
      || /Syntaxfehler in Datei|Konfigurationsdatei enthält Fehler/iu
        .test(contents)
    ) {
      category = 'configuration-rejected';
    } else if (
      /database files are incompatible|incompatible with this server/iu
        .test(contents)
      || /PG_VERSION|invalid data directory/iu.test(contents)
      || /Datenbankdateien sind inkompatibel|inkompatibel mit diesem Server/iu
        .test(contents)
      || /ungültiges Datenverzeichnis/iu.test(contents)
    ) {
      category = 'data-directory-incompatible';
    } else if (
      /shared memory|semaphore|out of memory|too many open files/iu
        .test(contents)
      || /resource temporarily unavailable|No space left on device/iu
        .test(contents)
      || /Shared Memory|Semaphor|Nicht genügend Speicher/iu.test(contents)
      || /Zu viele offene Dateien|Ressource vorübergehend nicht verfügbar/iu
        .test(contents)
    ) {
      category = 'resource-unavailable';
    } else if (
      /dyld|Library not loaded|image not found|symbol not found/iu.test(contents)
      || /could not load library|shared library/iu.test(contents)
      || /Bibliothek konnte nicht geladen werden/iu.test(contents)
    ) {
      category = 'loader-unavailable';
    } else if (
      /password authentication failed/iu.test(contents)
      || /Passwort-Authentifizierung[\s\S]*fehlgeschlagen/iu.test(contents)
    ) {
      category = 'authentication-rejected';
    } else if (
      /\b(?:FATAL|PANIC):/u.test(contents)
      || /\b(?:FATAL|PANIK):/u.test(contents)
    ) {
      category = 'fatal-or-panic';
    }
    return Object.freeze({ category, fingerprint });
  } catch {
    return Object.freeze({
      category: 'unclassified',
      fingerprint: sha256('DA5-V5-POSTGRES-STARTUP-LOG-UNAVAILABLE-V1\n'),
    });
  } finally {
    await descriptor.close().catch(() => undefined);
  }
}

export async function classifyDa5V5PostgresStartupFailureForTest(
  logPath: string,
): Promise<Da5V5TestPostgresStartupFailureDiagnostic> {
  const diagnostic = await classifyDa5V5PostgresStartupFailure(logPath);
  const descriptor = await open(
    logPath,
    constants.O_RDONLY | constants.O_NOFOLLOW,
  );
  try {
    const before = await descriptor.stat();
    if (!before.isFile() || before.size > 1_048_576) {
      return Object.freeze({
        ...diagnostic,
        normalizedTemplate: 'startup diagnostic unavailable',
      });
    }
    const contents = await descriptor.readFile({ encoding: 'utf8' });
    const after = await descriptor.stat();
    if (
      before.dev !== after.dev
      || before.ino !== after.ino
      || before.size !== after.size
      || before.mtimeMs !== after.mtimeMs
    ) {
      return Object.freeze({
        ...diagnostic,
        normalizedTemplate: 'startup diagnostic unstable',
      });
    }
    const line = contents.split(/\r?\n/u).find((candidate) => (
      /\b(?:FATAL|PANIC|PANIK|startup)\b/iu.test(candidate)
    ));
    return Object.freeze({
      ...diagnostic,
      normalizedTemplate: line === undefined
        ? 'startup diagnostic unavailable'
        : normalizeDa5V5TestStartupLine(line),
    });
  } catch {
    return Object.freeze({
      ...diagnostic,
      normalizedTemplate: 'startup diagnostic unavailable',
    });
  } finally {
    await descriptor.close().catch(() => undefined);
  }
}

function normalizeDa5V5TestStartupLine(value: string): string {
  return value
    .replace(
      /\b(?:password|passwd|secret|token|credential)\b\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;]+)/giu,
      'credential <redacted>',
    )
    .replace(/"[^"]*"|'[^']*'|`[^`]*`|»[^«]*«/gu, '<value>')
    .replace(/(?:[A-Za-z0-9._-]+[\\/])+[A-Za-z0-9._-]+/gu, '<path>')
    .replace(/\b[A-Za-z0-9_-]+\.[A-Za-z0-9._-]+\b/gu, '<path>')
    .replace(/\b(?:0x)?[A-Fa-f0-9]{8,}\b/gu, '<identifier>')
    .replace(/\b(?:PID|UID|GID|port|process|identifier)\b\s*[:=]?\s*\d+/giu, '<id>')
    .replace(/\[[0-9]+\]/gu, '<id>')
    .replace(/[0-9]+/gu, '<number>')
    .replace(/[\\/'"`«»]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

class RuntimeGuardClient {
  private controlError: Error | null = null;
  private readonly frameReader: FrameReader;
  private boundHelloNonce: string | null = null;
  private boundHelloIdentity: Readonly<{
    readonly pgid: number;
    readonly pid: number;
    readonly sessionId: number;
  }> | null = null;
  private controlClosed = false;
  private eventClosed = false;
  private secretClosed = false;
  private stopped = false;

  get helloNonce(): string {
    if (this.boundHelloNonce === null) {
      throw new Error('DA5 V5 Runtime Guard HELLO is not bound');
    }
    return this.boundHelloNonce;
  }

  get helloIdentity(): Readonly<{
    readonly pgid: number;
    readonly pid: number;
    readonly sessionId: number;
  }> {
    if (this.boundHelloIdentity === null) {
      throw new Error('DA5 V5 Runtime Guard HELLO identity is not bound');
    }
    return this.boundHelloIdentity;
  }

  private constructor(
    readonly child: ChildProcess,
    private readonly capabilitySecret: string,
    private readonly control: Writable,
    events: Readable,
    private readonly expectedBuild: 'production' | 'test',
    private readonly secret: Writable,
  ) {
    this.frameReader = new FrameReader(events);
    this.control.on('error', (error) => {
      this.controlError ??= error;
    });
  }

  static async launch(options: {
    readonly artifactDigest: string;
    readonly baseHandle: FileHandle;
    readonly binaryPath: string;
    readonly capabilitySecret: string;
    readonly chainDigest: string;
    readonly configuration: string;
    readonly configurationDigest: string;
    readonly dataPath: string;
    readonly expectedBuild: 'production' | 'test';
    readonly initdbPath: string;
    readonly initdbFd: number;
    readonly hba: string;
    readonly lifecycleGeneration: string;
    readonly logPath: string;
    readonly mode: 'PROBE_ONLY' | 'START';
    readonly postgresPath: string;
    readonly postgresFd: number;
    readonly pgConfigFd: number;
    readonly rootHandle: FileHandle;
    readonly rootName: string;
    readonly secret: Buffer;
    readonly socketPath: string;
    readonly stagingHandle: FileHandle;
    readonly tombstoneName: string;
    readonly verifyRunningProcess: (pid: number) => Promise<void>;
  }): Promise<RuntimeGuardClient> {
    const child = spawn(options.binaryPath, [], {
      cwd: '/',
      detached: true,
      env: {},
      shell: false,
      stdio: [
        'ignore',
        'ignore',
        'ignore',
        'pipe',
        'pipe',
        'pipe',
        options.rootHandle.fd,
        options.stagingHandle.fd,
        options.baseHandle.fd,
        options.pgConfigFd,
        options.initdbFd,
        options.postgresFd,
      ],
    });
    const stdio = child.stdio as unknown as readonly (
      | Readable
      | Writable
      | null
      | undefined
    )[];
    const control = stdio[3] as Writable | null | undefined;
    const events = stdio[4] as Readable | null | undefined;
    const secret = stdio[5] as Writable | null | undefined;
    if (control === null || control === undefined
      || events === null || events === undefined
      || secret === null || secret === undefined
      || child.pid === undefined) {
      control?.destroy();
      events?.destroy();
      secret?.destroy();
      await awaitGuardTermination(child, false).catch(() => undefined);
      throw new Error('DA5 V5 Runtime Guard private pipes are unavailable');
    }
    const client = new RuntimeGuardClient(
      child,
      options.capabilitySecret,
      control,
      events,
      options.expectedBuild,
      secret,
    );
    try {
      const hello = await client.frameReader.read(5_000);
      const helloFields = hello.split('|');
      if (
        helloFields.length !== 7
        || helloFields[0] !== 'HELLO'
        || helloFields[1] !== '1'
        || helloFields[2] !== String(child.pid)
        || helloFields[2] !== helloFields[3]
        || helloFields[2] !== helloFields[4]
        || !/^[a-f0-9]{32}$/u.test(helloFields[5] ?? '')
        || helloFields[6] !== options.expectedBuild
      ) {
        throw new Error('DA5 V5 Runtime Guard HELLO mismatch');
      }
      await options.verifyRunningProcess(child.pid);
      if (
        child.exitCode !== null
        || child.signalCode !== null
        || events.readableEnded
        || control.destroyed
      ) {
        throw new Error('DA5 V5 Runtime Guard exited before identity binding');
      }
      client.boundHelloNonce = helloFields[5] as string;
      client.boundHelloIdentity = Object.freeze({
        pgid: Number(helloFields[4]),
        pid: Number(helloFields[2]),
        sessionId: Number(helloFields[3]),
      });
      try {
        await new Promise<void>((resolveWritten, rejectWritten) => {
          const handleError = (error: Error): void => {
            rejectWritten(error);
          };
          secret.once('error', handleError);
          secret.end(options.secret, () => {
            secret.off('error', handleError);
            resolveWritten();
          });
        });
      } finally {
        options.secret.fill(0);
      }
      const boundManifestFields = [
        options.lifecycleGeneration,
        options.artifactDigest,
        options.chainDigest,
        options.configurationDigest,
        options.mode,
        hex(options.rootName),
        hex(options.tombstoneName),
        hex(options.initdbPath),
        hex(options.postgresPath),
        hex(options.dataPath),
        hex(options.socketPath),
        hex(options.logPath),
        hex(options.configuration),
        hex(options.hba),
      ];
      const manifestDigest = sha256(
        Buffer.from(`${boundManifestFields.join('\0')}\0`),
      );
      await client.writeFrame([
        'START_MANIFEST',
        helloFields[5],
        options.capabilitySecret,
        options.lifecycleGeneration,
        manifestDigest,
        ...boundManifestFields.slice(1),
      ].join('|'));
      await client.expect('ACK', 5_000);
      return client;
    } catch (error) {
      options.secret.fill(0);
      await client.abortHandshake().catch(() => undefined);
      throw error;
    }
  }

  async expect(expected: string, timeoutMs: number): Promise<void> {
    const value = await this.frameReader.read(timeoutMs);
    if (value !== expected) {
      if (this.expectedBuild === 'test' && value.startsWith('INITDB_FAIL|')) {
        throw new Error(`DA5 V5 test Runtime Guard ${value}`);
      }
      throw new Error('DA5 V5 Runtime Guard event mismatch');
    }
  }

  async expectPrefix(prefix: string, timeoutMs: number): Promise<string> {
    const value = await this.frameReader.read(timeoutMs);
    if (!value.startsWith(prefix)) {
      throw new Error('DA5 V5 Runtime Guard event mismatch');
    }
    return value;
  }

  readAvailableEvent(): string | null {
    return this.frameReader.readAvailable();
  }

  async sendAuthenticated(command: 'CONFIG_READY' | 'HEARTBEAT' | 'STOP_FAST'):
  Promise<void> {
    if (command === 'STOP_FAST') {
      if (this.stopped) {
        throw new Error('DA5 V5 Runtime Guard STOP_FAST is one-shot');
      }
      this.stopped = true;
    } else if (this.stopped) {
      throw new Error('DA5 V5 Runtime Guard protocol is stopped');
    }
    await this.writeFrame(`${command}|${this.capabilitySecret}`);
  }

  private async abortHandshake(): Promise<void> {
    let firstFailure: unknown;
    for (const action of [
      () => this.closeControlPipe(),
      () => this.closeSecretPipe(),
      async () => {
        await awaitGuardTermination(this.child, false);
      },
      () => this.closeEventPipe(),
    ]) {
      try {
        await action();
      } catch (error: unknown) {
        firstFailure ??= error;
      }
    }
    if (firstFailure !== undefined) {
      throw new Error('DA5 V5 Runtime Guard handshake cleanup failed', {
        cause: firstFailure,
      });
    }
  }

  async waitForExit(): Promise<void> {
    if (this.child.exitCode !== null || this.child.signalCode !== null) {
      if (this.child.exitCode !== 0 || this.child.signalCode !== null) {
        throw new Error('DA5 V5 Runtime Guard terminal result failed');
      }
      return;
    }
    const result = await awaitGuardTermination(this.child, true);
    if (result[0] !== 0 || result[1] !== null) {
      throw new Error('DA5 V5 Runtime Guard terminal result failed');
    }
  }

  async closeControlPipe(): Promise<void> {
    if (this.controlClosed) {
      return;
    }
    if (this.control.destroyed || this.control.writableEnded) {
      this.controlClosed = true;
      return;
    }
    await endWritable(this.control);
    this.controlClosed = true;
  }

  async closeSecretPipe(): Promise<void> {
    if (this.secretClosed) {
      return;
    }
    if (this.secret.destroyed || this.secret.writableEnded) {
      this.secretClosed = true;
      return;
    }
    await endWritable(this.secret);
    this.secretClosed = true;
  }

  async closeEventPipe(): Promise<void> {
    if (this.eventClosed) {
      return;
    }
    this.frameReader.close();
    this.eventClosed = true;
  }

  private async writeFrame(value: string): Promise<void> {
    const payload = Buffer.from(value);
    if (payload.byteLength === 0 || payload.byteLength > 4_096) {
      throw new Error('DA5 V5 Runtime Guard frame is invalid');
    }
    if (this.controlError !== null || this.control.destroyed) {
      throw new Error('DA5 V5 Runtime Guard control pipe is unavailable');
    }
    const header = Buffer.alloc(4);
    header.writeUInt32BE(payload.byteLength);
    await new Promise<void>((resolveWritten, rejectWritten) => {
      this.control.write(
        Buffer.concat([header, payload]),
        (error?: Error | null) => {
          if (error !== undefined && error !== null) {
            rejectWritten(
              new Error('DA5 V5 Runtime Guard control pipe write failed'),
            );
            return;
          }
          resolveWritten();
        },
      );
    });
  }
}

async function endWritable(stream: Writable): Promise<void> {
  await new Promise<void>((resolveClosed, rejectClosed) => {
    const onError = (error: Error): void => {
      cleanup();
      rejectClosed(error);
    };
    const onFinish = (): void => {
      cleanup();
      resolveClosed();
    };
    const cleanup = (): void => {
      stream.off('error', onError);
      stream.off('finish', onFinish);
    };
    stream.once('error', onError);
    stream.once('finish', onFinish);
    stream.end();
  });
}

async function awaitGuardTermination(
  child: ChildProcess,
  requireSuccess: boolean,
): Promise<readonly [number | null, NodeJS.Signals | null]> {
  const current = child.exitCode !== null || child.signalCode !== null
    ? [child.exitCode, child.signalCode] as const
    : await Promise.race([
        new Promise<readonly [number | null, NodeJS.Signals | null]>((resolveExit) => {
          child.once('exit', (code, signal) => resolveExit([code, signal]));
        }),
        new Promise<never>((_resolve, reject) => {
          setTimeout(() => reject(
            new Error('DA5 V5 Runtime Guard terminal reap timed out'),
          ), 12_000);
        }),
      ]);
  if (requireSuccess && (current[0] !== 0 || current[1] !== null)) {
    throw new Error('DA5 V5 Runtime Guard terminal result failed');
  }
  return current;
}

class FrameReader {
  private buffer = Buffer.alloc(0);

  constructor(private readonly stream: Readable) {}

  close(): void {
    this.stream.destroy();
    this.buffer = Buffer.alloc(0);
  }

  readAvailable(): string | null {
    for (;;) {
      const frame = this.extractFrame();
      if (frame !== null) {
        return frame;
      }
      const chunk = this.stream.read();
      if (chunk === null) {
        return null;
      }
      this.buffer = Buffer.concat([this.buffer, Buffer.from(chunk)]);
    }
  }

  async read(timeoutMs: number): Promise<string> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const frame = this.readAvailable();
      if (frame !== null) {
        return frame;
      }
      const remaining = deadline - Date.now();
      if (remaining <= 0 || this.stream.readableEnded) {
        throw new Error('DA5 V5 Runtime Guard event deadline expired');
      }
      await Promise.race([
        new Promise<void>((resolveReadable) => {
          this.stream.once('readable', resolveReadable);
        }),
        new Promise<never>((_resolve, reject) => {
          setTimeout(() => reject(
            new Error('DA5 V5 Runtime Guard event deadline expired'),
          ), remaining);
        }),
      ]);
    }
  }

  private extractFrame(): string | null {
    if (this.buffer.byteLength < 4) {
      return null;
    }
    const length = this.buffer.readUInt32BE();
    if (length === 0 || length > 4_096) {
      throw new Error('DA5 V5 Runtime Guard event frame is invalid');
    }
    if (this.buffer.byteLength < length + 4) {
      return null;
    }
    const value = this.buffer.subarray(4, length + 4).toString('utf8');
    this.buffer = this.buffer.subarray(length + 4);
    return value;
  }
}

async function runProbeGuard(options: {
  readonly binaryPath: string;
  readonly expectedGuardBuild: 'production' | 'test';
  readonly stagingHandle: FileHandle;
  readonly stagingPath: string;
  readonly verifyRunningProcess: (pid: number) => Promise<void>;
}): Promise<void> {
  const capabilitySecret = randomBytes(32).toString('hex');
  const configuration = exactPostgresConfiguration('/private/unused');
  const guard = await RuntimeGuardClient.launch({
    artifactDigest: sha256(await readFile(options.binaryPath)),
    baseHandle: options.stagingHandle,
    binaryPath: options.binaryPath,
    capabilitySecret,
    chainDigest: sha256('DA5-V5-PROBE-CHAIN'),
    configuration: configuration.configuration,
    configurationDigest: configuration.digest,
    dataPath: '/private/unused',
    expectedBuild: options.expectedGuardBuild,
    hba: configuration.hba,
    initdbPath: '/private/unused',
    initdbFd: options.stagingHandle.fd,
    lifecycleGeneration: randomBytes(16).toString('hex'),
    logPath: '/private/unused',
    mode: 'PROBE_ONLY',
    postgresPath: '/private/unused',
    postgresFd: options.stagingHandle.fd,
    pgConfigFd: options.stagingHandle.fd,
    rootHandle: options.stagingHandle,
    rootName: 'probe-unused',
    secret: Buffer.alloc(1),
    socketPath: '/private/unused',
    stagingHandle: options.stagingHandle,
    tombstoneName: 'probe-unused-target',
    verifyRunningProcess: options.verifyRunningProcess,
  });
  await guard.expect('PROBE_OK', 5_000);
  await guard.waitForExit();
  await assertPrivateDirectory(options.stagingPath);
}

async function verifyDa5V5TrustedAdminGroupSnapshotMatches(
  expected: Da5V5TrustedAdminGroupSnapshot,
): Promise<void> {
  const expectedProtected = requireProtectedSnapshot(expected);
  const current = await verifyDa5V5TrustedAdminGroupSnapshot();
  const currentProtected = requireProtectedSnapshot(current);
  if (
    expected.combinedSnapshotSha256 !== current.combinedSnapshotSha256
    || expected.fullRecordSha256 !== current.fullRecordSha256
    || expected.membershipSha256 !== current.membershipSha256
    || expected.directMembers !== current.directMembers
    || expected.nestedGroups !== current.nestedGroups
    || expectedProtected.gid !== currentProtected.gid
    || expectedProtected.groupGuid !== currentProtected.groupGuid
    || JSON.stringify(expectedProtected.memberPairs)
      !== JSON.stringify(currentProtected.memberPairs)
  ) {
    throw new Error('DA5 V5 trusted admin-group snapshot mismatch');
  }
}

function requireProtectedSnapshot(
  snapshot: Da5V5TrustedAdminGroupSnapshot,
): ProtectedGroupSnapshot {
  const value = protectedSnapshots.get(snapshot);
  if (value === undefined) {
    throw new Error('DA5 V5 trusted admin-group snapshot mismatch');
  }
  return value;
}

function readDirectoryServiceRecord(path: string): Record<string, unknown> {
  const dscl = spawnSync('/usr/bin/dscl', ['-plist', '.', '-read', path], {
    cwd: '/',
    encoding: 'utf8',
    env: Object.freeze({ PATH: '/usr/bin:/bin' }),
    maxBuffer: 65_536,
    shell: false,
    timeout: 5_000,
    killSignal: 'SIGKILL',
  });
  if (
    dscl.error !== undefined
    || dscl.signal !== null
    || dscl.status !== 0
    || dscl.stderr.trim().length > 0
  ) {
    throw new Error('DA5 V5 trusted admin-group snapshot mismatch');
  }
  const plist = spawnSync(
    '/usr/bin/plutil',
    ['-convert', 'json', '-o', '-', '--', '-'],
    {
      cwd: '/',
      encoding: 'utf8',
      env: Object.freeze({ PATH: '/usr/bin:/bin' }),
      input: dscl.stdout,
      maxBuffer: 65_536,
      shell: false,
      timeout: 5_000,
      killSignal: 'SIGKILL',
    },
  );
  if (
    plist.error !== undefined
    || plist.signal !== null
    || plist.status !== 0
    || plist.stderr.trim().length > 0
  ) {
    throw new Error('DA5 V5 trusted admin-group snapshot mismatch');
  }
  try {
    const value: unknown = JSON.parse(plist.stdout);
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new Error();
    }
    return value as Record<string, unknown>;
  } catch {
    throw new Error('DA5 V5 trusted admin-group snapshot mismatch');
  }
}

function normalizeDirectoryServiceRecord(
  record: Record<string, unknown>,
): Record<string, string[]> {
  return Object.fromEntries(Object.keys(record).sort().map((key) => {
    const values = Array.isArray(record[key]) ? record[key] : [record[key]];
    if (values.some((value) => typeof value !== 'string')) {
      throw new Error('DA5 V5 trusted admin-group snapshot mismatch');
    }
    return [key, (values as string[]).slice().sort()];
  }));
}

function directoryServiceAttribute(
  record: Readonly<Record<string, readonly string[]>>,
  name: string,
): readonly string[] {
  return record[`dsAttrTypeStandard:${name}`] ?? [];
}

async function bindPath(path: string, binary: boolean): Promise<BoundPath> {
  const canonicalPath = await realpath(path);
  if (canonicalPath !== path) {
    throw new Error('DA5 V5 PostgreSQL path is not canonical');
  }
  const descriptor = await open(
    canonicalPath,
    constants.O_RDONLY | constants.O_NOFOLLOW,
  );
  try {
    const pathState = await lstat(canonicalPath, { bigint: true });
    const state = await descriptor.stat({ bigint: true });
    if (pathState.dev !== state.dev || pathState.ino !== state.ino) {
      throw new Error('DA5 V5 PostgreSQL stable-FD identity mismatch');
    }
    const digest = binary
      ? await hashFileHandle(descriptor, state.size)
      : undefined;
    const after = await descriptor.stat({ bigint: true });
    if (
      after.dev !== state.dev
      || after.ino !== state.ino
      || after.size !== state.size
      || after.mtimeMs !== state.mtimeMs
    ) {
      throw new Error('DA5 V5 PostgreSQL stable-FD identity mismatch');
    }
    return Object.freeze({
      aclSha256: aclDigest(canonicalPath),
      binary,
      canonicalPath,
      dev: state.dev,
      ...(digest === undefined ? {} : { digest }),
      fd: descriptor,
      gid: Number(state.gid),
      ino: state.ino,
      mode: Number(state.mode & 0o777n),
      size: state.size,
      uid: Number(state.uid),
    });
  } catch (error) {
    await descriptor.close().catch(() => undefined);
    throw error;
  }
}

function validateBoundChain(
  paths: readonly BoundPath[],
  snapshot: ProtectedGroupSnapshot,
  effectiveUid: number | undefined,
  expectedBinaryCount: 1 | 3,
): void {
  if (effectiveUid === undefined) {
    throw new Error('DA5 V5 PostgreSQL binary-chain owner mismatch');
  }
  const binaries = paths.filter(({ binary }) => binary);
  if (binaries.length !== expectedBinaryCount) {
    throw new Error('DA5 V5 PostgreSQL binary-chain cardinality mismatch');
  }
  for (const path of paths) {
    if (
      ![0, effectiveUid].includes(path.uid)
      || (path.mode & 0o002) !== 0
      || (path.mode & 0o020) !== 0 && (
        path.uid !== effectiveUid
        || path.gid !== snapshot.gid
      )
    ) {
      throw new Error('DA5 V5 PostgreSQL binary-chain owner/mode mismatch');
    }
  }
  for (const binary of binaries) {
    if (binary.mode !== 0o555 || binary.digest === undefined) {
      throw new Error('DA5 V5 PostgreSQL binary mode mismatch');
    }
  }
}

async function revalidateBoundPaths(paths: readonly BoundPath[]): Promise<void> {
  for (const entry of paths) {
    const pathState = await lstat(entry.canonicalPath, { bigint: true });
    const fdState = await entry.fd.stat({ bigint: true });
    if (
      pathState.dev !== entry.dev
      || pathState.ino !== entry.ino
      || fdState.dev !== entry.dev
      || fdState.ino !== entry.ino
      || Number(fdState.mode & 0o777n) !== entry.mode
      || Number(fdState.uid) !== entry.uid
      || Number(fdState.gid) !== entry.gid
      || fdState.size !== entry.size
      || aclDigest(entry.canonicalPath) !== entry.aclSha256
      || (entry.digest !== undefined
        && await hashFileHandle(entry.fd, entry.size) !== entry.digest)
    ) {
      throw new Error('DA5 V5 PostgreSQL binary-chain revalidation mismatch');
    }
  }
}

function aclDigest(path: string): string {
  const result = spawnSync('/bin/ls', ['-lde', path], {
    cwd: '/',
    encoding: 'utf8',
    env: Object.freeze({ PATH: '/usr/bin:/bin' }),
    maxBuffer: 65_536,
    shell: false,
    timeout: 5_000,
    killSignal: 'SIGKILL',
  });
  if (
    result.error !== undefined
    || result.signal !== null
    || result.status !== 0
    || result.stderr.trim().length > 0
  ) {
    throw new Error('DA5 V5 PostgreSQL ACL identity mismatch');
  }
  const lines = result.stdout.trimEnd().split('\n');
  if (lines.length !== 1) {
    throw new Error('DA5 V5 PostgreSQL ACL identity mismatch');
  }
  return sha256(result.stdout);
}

async function hashFileHandle(
  descriptor: FileHandle,
  expectedSize: bigint,
): Promise<string> {
  if (expectedSize < 0n || expectedSize > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('DA5 V5 PostgreSQL binary size mismatch');
  }
  const expectedBytes = Number(expectedSize);
  const digest = createHash('sha256');
  const buffer = Buffer.allocUnsafe(65_536);
  let position = 0;
  while (position < expectedBytes) {
    const length = Math.min(buffer.byteLength, expectedBytes - position);
    const { bytesRead } = await descriptor.read(buffer, 0, length, position);
    if (bytesRead <= 0) {
      throw new Error('DA5 V5 PostgreSQL binary read mismatch');
    }
    digest.update(buffer.subarray(0, bytesRead));
    position += bytesRead;
  }
  return digest.digest('hex');
}

export async function validateDa5V5TemporaryBase(path: string): Promise<void> {
  const canonical = await realpath(path);
  const state = await stat(path);
  const mode = state.mode & 0o7777;
  const privateSameEuid = (
    process.geteuid !== undefined
    && state.uid === process.geteuid()
    && mode === 0o700
  );
  const exactLocalStickyRoot = (
    canonical === '/private/tmp'
    && state.uid === 0
    && mode === 0o1777
  );
  if (!state.isDirectory() || (!privateSameEuid && !exactLocalStickyRoot)) {
    throw new Error('DA5 V5 temporary base is not private');
  }
  if (aclDigest(path).length !== 64) {
    throw new Error('DA5 V5 temporary base ACL is invalid');
  }
}

async function assertPrivateDirectory(path: string): Promise<void> {
  const state = await stat(path);
  if (
    !state.isDirectory()
    || process.geteuid === undefined
    || state.uid !== process.geteuid()
    || (state.mode & 0o777) !== 0o700
    || aclDigest(path).length !== 64
  ) {
    throw new Error('DA5 V5 private directory binding mismatch');
  }
}

function exactPostgresConfiguration(socketPath: string): Readonly<{
  readonly configuration: string;
  readonly digest: string;
  readonly hba: string;
}> {
  const configuration = [
    "listen_addresses = '127.0.0.1'",
    'port = 55435',
    `unix_socket_directories = '${socketPath.replaceAll("'", "''")}'`,
    "password_encryption = 'scram-sha-256'",
    'ssl = off',
    'max_connections = 20',
    'shared_buffers = 32MB',
    'fsync = on',
    'synchronous_commit = on',
    'full_page_writes = on',
    '',
  ].join('\n');
  const hba = [
    'local all all reject',
    'host all all 127.0.0.1/32 scram-sha-256',
    'host all all ::1/128 reject',
    '',
  ].join('\n');
  return Object.freeze({
    configuration,
    digest: sha256(Buffer.from(`${configuration}\0${hba}\0\0`)),
    hba,
  });
}

async function waitForPostgres(
  url: string,
  guard: RuntimeGuardClient,
  logPath: string,
  includeTestTemplate: boolean,
): Promise<Pool> {
  const deadline = Date.now() + 20_000;
  for (;;) {
    const pool = new Pool({
      connectionString: url,
      connectionTimeoutMillis: 500,
      max: 1,
      query_timeout: 1_000,
      statement_timeout: 1_000,
    });
    try {
      await pool.query('SELECT 1');
      return pool;
    } catch {
      await pool.end().catch(() => undefined);
      const event = guard.readAvailableEvent();
      if (event !== null) {
        if (event !== 'POSTGRES_EXITED_EARLY') {
          throw new Error('DA5 V5 Runtime Guard readiness event mismatch');
        }
        const classification = includeTestTemplate
          ? await classifyDa5V5PostgresStartupFailureForTest(logPath)
          : await classifyDa5V5PostgresStartupFailure(logPath);
        const template = 'normalizedTemplate' in classification
          ? `;${classification.normalizedTemplate}`
          : '';
        throw new Error(
          'DA5 V5 PostgreSQL exited before readiness '
          + `(${classification.category};${classification.fingerprint}${template})`,
        );
      }
      if (Date.now() >= deadline) {
        throw new Error('DA5 V5 PostgreSQL readiness timed out');
      }
      await new Promise((resolvePause) => setTimeout(resolvePause, 100));
    }
  }
}

async function attestUntouchedCluster(pool: Pool): Promise<void> {
  const cluster = await pool.query<{
    database_role_settings: boolean;
    database_acls: string;
    database_collations: string;
    database_connections: string;
    database_ctypes: string;
    database_encodings: string;
    database_limits: string;
    database_names: string;
    database_owners: string;
    database_providers: string;
    database_tablespaces: string;
    database_templates: string;
    default_acls: boolean;
    extensions: string;
    foreign_state: boolean;
    installer_drift: boolean;
    memberships: string;
    other_client_locks: boolean;
    other_sessions: boolean;
    owner_sessions: string;
    roles: string;
    server_version_num: string;
    security_labels: boolean;
    settings_match: boolean;
    tablespaces: string;
  }>(`
    SELECT
      COALESCE((
        SELECT pg_catalog.string_agg(database.datname, ',' ORDER BY database.datname)
        FROM pg_catalog.pg_database AS database
      ), '') AS database_names,
      COALESCE((
        SELECT pg_catalog.string_agg(owner.rolname, ',' ORDER BY database.datname)
        FROM pg_catalog.pg_database AS database
        JOIN pg_catalog.pg_roles AS owner ON owner.oid = database.datdba
      ), '') AS database_owners,
      COALESCE((
        SELECT pg_catalog.string_agg(
          pg_catalog.pg_encoding_to_char(database.encoding),
          ',' ORDER BY database.datname
        )
        FROM pg_catalog.pg_database AS database
      ), '') AS database_encodings,
      COALESCE((
        SELECT pg_catalog.string_agg(
          database.datcollate, ',' ORDER BY database.datname
        )
        FROM pg_catalog.pg_database AS database
      ), '') AS database_collations,
      COALESCE((
        SELECT pg_catalog.string_agg(
          database.datctype, ',' ORDER BY database.datname
        )
        FROM pg_catalog.pg_database AS database
      ), '') AS database_ctypes,
      COALESCE((
        SELECT pg_catalog.string_agg(
          database.datlocprovider::text, ',' ORDER BY database.datname
        )
        FROM pg_catalog.pg_database AS database
      ), '') AS database_providers,
      COALESCE((
        SELECT pg_catalog.string_agg(
          database.datallowconn::text, ',' ORDER BY database.datname
        )
        FROM pg_catalog.pg_database AS database
      ), '') AS database_connections,
      COALESCE((
        SELECT pg_catalog.string_agg(
          database.datistemplate::text, ',' ORDER BY database.datname
        )
        FROM pg_catalog.pg_database AS database
      ), '') AS database_templates,
      COALESCE((
        SELECT pg_catalog.string_agg(
          database.datconnlimit::text, ',' ORDER BY database.datname
        )
        FROM pg_catalog.pg_database AS database
      ), '') AS database_limits,
      COALESCE((
        SELECT pg_catalog.string_agg(
          COALESCE(database.datacl::text, '<null>'),
          ',' ORDER BY database.datname
        )
        FROM pg_catalog.pg_database AS database
      ), '') AS database_acls,
      COALESCE((
        SELECT pg_catalog.string_agg(
          tablespace.spcname, ',' ORDER BY database.datname
        )
        FROM pg_catalog.pg_database AS database
        JOIN pg_catalog.pg_tablespace AS tablespace
          ON tablespace.oid = database.dattablespace
      ), '') AS database_tablespaces,
      COALESCE((
        SELECT pg_catalog.string_agg(rolname, ',' ORDER BY rolname)
        FROM pg_catalog.pg_roles
      ), '') AS roles,
      COALESCE((
        SELECT pg_catalog.string_agg(
          member.rolname || ':' || parent.rolname,
          ',' ORDER BY member.rolname, parent.rolname
        )
        FROM pg_catalog.pg_auth_members AS membership
        JOIN pg_catalog.pg_roles AS member ON member.oid = membership.member
        JOIN pg_catalog.pg_roles AS parent ON parent.oid = membership.roleid
      ), '') AS memberships,
      COALESCE((
        SELECT pg_catalog.string_agg(
          tablespace.spcname || ':' || owner.rolname || ':'
          || COALESCE(tablespace.spcacl::text, '<null>') || ':'
          || COALESCE(tablespace.spcoptions::text, '<null>'),
          ',' ORDER BY tablespace.spcname
        )
        FROM pg_catalog.pg_tablespace AS tablespace
        JOIN pg_catalog.pg_roles AS owner ON owner.oid = tablespace.spcowner
      ), '') AS tablespaces,
      COALESCE((
        SELECT pg_catalog.string_agg(
          extension.extname || ':' || extension.extversion || ':'
          || namespace.nspname || ':' || owner.rolname,
          ',' ORDER BY extension.extname
        )
        FROM pg_catalog.pg_extension AS extension
        JOIN pg_catalog.pg_namespace AS namespace
          ON namespace.oid = extension.extnamespace
        JOIN pg_catalog.pg_roles AS owner ON owner.oid = extension.extowner
      ), '') AS extensions,
      EXISTS (SELECT 1 FROM pg_catalog.pg_replication_slots)
        OR EXISTS (SELECT 1 FROM pg_catalog.pg_prepared_xacts)
        OR EXISTS (SELECT 1 FROM pg_catalog.pg_publication)
        OR EXISTS (SELECT 1 FROM pg_catalog.pg_subscription)
        OR EXISTS (SELECT 1 FROM pg_catalog.pg_foreign_server)
        OR EXISTS (SELECT 1 FROM pg_catalog.pg_user_mapping)
        OR EXISTS (SELECT 1 FROM pg_catalog.pg_event_trigger)
        AS foreign_state,
      (
        SELECT count(*)::text
        FROM pg_catalog.pg_stat_activity
        WHERE backend_type = 'client backend'
      ) AS owner_sessions,
      (
        pg_catalog.current_setting('listen_addresses') = '127.0.0.1'
        AND pg_catalog.current_setting('port') = '55435'
        AND pg_catalog.current_setting('password_encryption') = 'scram-sha-256'
        AND pg_catalog.current_setting('ssl') = 'off'
        AND pg_catalog.current_setting('max_connections') = '20'
        AND pg_catalog.current_setting('shared_buffers') = '32MB'
        AND pg_catalog.current_setting('fsync') = 'on'
        AND pg_catalog.current_setting('synchronous_commit') = 'on'
        AND pg_catalog.current_setting('full_page_writes') = 'on'
      ) AS settings_match,
      EXISTS (SELECT 1 FROM pg_catalog.pg_db_role_setting)
        AS database_role_settings,
      EXISTS (SELECT 1 FROM pg_catalog.pg_default_acl)
        AS default_acls,
      EXISTS (
        SELECT 1 FROM pg_catalog.pg_seclabel
        WHERE provider IS NOT NULL
      ) AS security_labels,
      EXISTS (
          SELECT 1
          FROM pg_catalog.pg_authid
          WHERE rolname = 'taptime_da5_v5_installer'
            AND (
              NOT rolsuper OR NOT rolinherit OR NOT rolcreaterole
              OR NOT rolcreatedb OR NOT rolcanlogin OR NOT rolreplication
              OR NOT rolbypassrls OR rolconnlimit <> -1
              OR rolpassword NOT LIKE 'SCRAM-SHA-256$%'
            )
      ) AS installer_drift,
      EXISTS (
        SELECT 1 FROM pg_catalog.pg_stat_activity
        WHERE backend_type = 'client backend'
          AND pid <> pg_catalog.pg_backend_pid()
      ) AS other_sessions,
      EXISTS (
        SELECT 1
        FROM pg_catalog.pg_locks AS lock
        JOIN pg_catalog.pg_stat_activity AS activity
          ON activity.pid = lock.pid
        WHERE activity.backend_type = 'client backend'
          AND lock.pid <> pg_catalog.pg_backend_pid()
      ) AS other_client_locks,
      pg_catalog.current_setting('server_version_num') AS server_version_num
  `);
  const row = cluster.rows[0];
  if (row === undefined) {
    throw new Error('DA5 V5 untouched-cluster row mismatch');
  }
  if (
    row.database_names !== 'postgres,template0,template1'
    || row.database_owners
      !== 'taptime_da5_v5_installer,taptime_da5_v5_installer,taptime_da5_v5_installer'
  ) {
    throw new Error('DA5 V5 untouched-cluster database identity mismatch');
  }
  if (row.database_encodings !== 'SQL_ASCII,SQL_ASCII,SQL_ASCII') {
    throw new Error('DA5 V5 untouched-cluster database encoding mismatch');
  }
  if (row.database_collations !== 'C,C,C') {
    throw new Error('DA5 V5 untouched-cluster database collation mismatch');
  }
  if (row.database_ctypes !== 'C,C,C') {
    throw new Error('DA5 V5 untouched-cluster database ctype mismatch');
  }
  if (row.database_providers !== 'c,c,c') {
    throw new Error('DA5 V5 untouched-cluster database provider mismatch');
  }
  if (
    row.database_connections !== 'true,false,true'
  ) {
    throw new Error('DA5 V5 untouched-cluster database connection mismatch');
  }
  if (row.database_templates !== 'false,true,true') {
    throw new Error('DA5 V5 untouched-cluster database template mismatch');
  }
  if (row.database_limits !== '-1,-1,-1') {
    throw new Error('DA5 V5 untouched-cluster database limit mismatch');
  }
  const templateAcl =
    '{=c/taptime_da5_v5_installer,'
    + 'taptime_da5_v5_installer=CTc/taptime_da5_v5_installer}';
  if (row.database_acls !== `<null>,${templateAcl},${templateAcl}`) {
    throw new Error('DA5 V5 untouched-cluster database ACL mismatch');
  }
  if (row.database_tablespaces !== 'pg_default,pg_default,pg_default') {
    throw new Error('DA5 V5 untouched-cluster database tablespace mismatch');
  }
  if (
    row.roles !== [
      'pg_checkpoint',
      'pg_create_subscription',
      'pg_database_owner',
      'pg_execute_server_program',
      'pg_maintain',
      'pg_monitor',
      'pg_read_all_data',
      'pg_read_all_settings',
      'pg_read_all_stats',
      'pg_read_server_files',
      'pg_signal_backend',
      'pg_stat_scan_tables',
      'pg_use_reserved_connections',
      'pg_write_all_data',
      'pg_write_server_files',
      'taptime_da5_v5_installer',
    ].join(',')
  ) {
    throw new Error('DA5 V5 untouched-cluster role allowlist mismatch');
  }
  if (
    row.memberships !== [
      'pg_monitor:pg_read_all_settings',
      'pg_monitor:pg_read_all_stats',
      'pg_monitor:pg_stat_scan_tables',
    ].join(',')
  ) {
    throw new Error('DA5 V5 untouched-cluster membership allowlist mismatch');
  }
  if (
    row.tablespaces !== [
      'pg_default:taptime_da5_v5_installer:<null>:<null>',
      'pg_global:taptime_da5_v5_installer:<null>:<null>',
    ].join(',')
  ) {
    throw new Error('DA5 V5 untouched-cluster tablespace allowlist mismatch');
  }
  if (
    row.extensions !== 'plpgsql:1.0:pg_catalog:taptime_da5_v5_installer'
  ) {
    throw new Error('DA5 V5 untouched-cluster extension allowlist mismatch');
  }
  if (row.foreign_state) {
    throw new Error('DA5 V5 untouched-cluster foreign-state mismatch');
  }
  if (row.owner_sessions !== '1') {
    throw new Error('DA5 V5 untouched-cluster session allowlist mismatch');
  }
  if (!row.settings_match) {
    throw new Error('DA5 V5 untouched-cluster setting allowlist mismatch');
  }
  if (row.database_role_settings) {
    throw new Error('DA5 V5 untouched-cluster role-setting allowlist mismatch');
  }
  if (row.default_acls) {
    throw new Error('DA5 V5 untouched-cluster default-ACL allowlist mismatch');
  }
  if (row.security_labels) {
    throw new Error('DA5 V5 untouched-cluster security-label allowlist mismatch');
  }
  if (row.installer_drift) {
    throw new Error('DA5 V5 untouched-cluster installer-role mismatch');
  }
  if (row.other_sessions) {
    throw new Error('DA5 V5 untouched-cluster other-session mismatch');
  }
  if (row.other_client_locks) {
    throw new Error('DA5 V5 untouched-cluster client-lock mismatch');
  }
  if (row.server_version_num !== '170010') {
    throw new Error('DA5 V5 untouched-cluster version mismatch');
  }
}

async function attestEmptyDa5Database(pool: Pool): Promise<Readonly<{
  readonly systemIdentifier: string;
}>> {
  const state = await pool.query<{
    address: string;
    catalog_drift: boolean;
    database: string;
    database_acl_is_null: boolean;
    database_owner: string;
    database_tablespace: string;
    installer_scram: boolean;
    owner_sessions: string;
    port: number;
    role: string;
    runtime_roles: string;
    server_version_num: string;
    system_identifier: string;
    user_schemas: string;
  }>(`
    SELECT
      pg_catalog.host(pg_catalog.inet_server_addr()) AS address,
      pg_catalog.current_database() AS database,
      pg_catalog.inet_server_port() AS port,
      CURRENT_USER AS role,
      pg_catalog.current_setting('server_version_num') AS server_version_num,
      system_identifier::text,
      database_owner.rolname AS database_owner,
      tablespace.spcname AS database_tablespace,
      database.datacl IS NULL AS database_acl_is_null,
      (
        SELECT role.rolpassword LIKE 'SCRAM-SHA-256$%'
        FROM pg_catalog.pg_authid AS role
        WHERE role.rolname = 'taptime_da5_v5_installer'
          AND role.rolsuper
          AND role.rolinherit
          AND role.rolcreatedb
          AND role.rolcreaterole
          AND role.rolcanlogin
          AND role.rolreplication
          AND role.rolbypassrls
          AND role.rolconnlimit = -1
      ) IS TRUE AS installer_scram,
      (
        SELECT count(*)::text
        FROM pg_catalog.pg_roles
        WHERE rolname LIKE 'taptime\\_%' ESCAPE '\\'
          AND rolname <> 'taptime_da5_v5_installer'
      ) AS runtime_roles,
      (
        SELECT count(*)::text
        FROM pg_catalog.pg_stat_activity
        WHERE datname = pg_catalog.current_database()
          AND backend_type = 'client backend'
      ) AS owner_sessions,
      (
        EXISTS (
          SELECT 1 FROM pg_catalog.pg_namespace
          WHERE nspname NOT LIKE 'pg_%'
            AND nspname NOT IN ('information_schema', 'public')
        )
        OR EXISTS (
          SELECT 1
          FROM pg_catalog.pg_class AS class
          JOIN pg_catalog.pg_namespace AS namespace
            ON namespace.oid = class.relnamespace
          WHERE namespace.nspname = 'public'
        )
        OR EXISTS (SELECT 1 FROM pg_catalog.pg_default_acl)
        OR EXISTS (SELECT 1 FROM pg_catalog.pg_db_role_setting)
        OR EXISTS (SELECT 1 FROM pg_catalog.pg_event_trigger)
        OR EXISTS (SELECT 1 FROM pg_catalog.pg_foreign_server)
        OR EXISTS (SELECT 1 FROM pg_catalog.pg_user_mapping)
        OR (
          SELECT count(*)
          FROM pg_catalog.pg_extension AS extension
          JOIN pg_catalog.pg_namespace AS namespace
            ON namespace.oid = extension.extnamespace
          JOIN pg_catalog.pg_roles AS owner
            ON owner.oid = extension.extowner
          WHERE extension.extname = 'plpgsql'
            AND extension.extversion = '1.0'
            AND namespace.nspname = 'pg_catalog'
            AND owner.rolname = 'taptime_da5_v5_installer'
        ) <> 1
        OR EXISTS (
          SELECT 1
          FROM pg_catalog.pg_extension
          WHERE extname <> 'plpgsql'
        )
      ) AS catalog_drift,
      COALESCE((
        SELECT pg_catalog.string_agg(nspname, ',' ORDER BY nspname)
        FROM pg_catalog.pg_namespace
        WHERE nspname NOT LIKE 'pg_%'
          AND nspname <> 'information_schema'
          AND nspname <> 'public'
      ), '') AS user_schemas
    FROM pg_catalog.pg_control_system()
    JOIN pg_catalog.pg_database AS database
      ON database.datname = pg_catalog.current_database()
    JOIN pg_catalog.pg_roles AS database_owner
      ON database_owner.oid = database.datdba
    JOIN pg_catalog.pg_tablespace AS tablespace
      ON tablespace.oid = database.dattablespace
  `);
  const row = state.rows[0];
  if (row === undefined) {
    throw new Error('DA5 V5 empty database attestation mismatch (row)');
  }
  if (row.address !== '127.0.0.1') {
    throw new Error('DA5 V5 empty database attestation mismatch (address)');
  }
  if (row.database !== 'taptime_synthetic_android_e2e') {
    throw new Error('DA5 V5 empty database attestation mismatch (database)');
  }
  if (
    row.database_owner !== 'taptime_da5_v5_installer'
    || row.database_tablespace !== 'pg_default'
    || !row.database_acl_is_null
  ) {
    throw new Error(
      'DA5 V5 empty database attestation mismatch (database-policy)',
    );
  }
  if (!row.installer_scram) {
    throw new Error(
      'DA5 V5 empty database attestation mismatch (installer-role)',
    );
  }
  if (row.runtime_roles !== '0') {
    throw new Error(
      'DA5 V5 empty database attestation mismatch (runtime-roles)',
    );
  }
  if (row.owner_sessions !== '1') {
    throw new Error(
      'DA5 V5 empty database attestation mismatch (sessions)',
    );
  }
  if (row.catalog_drift) {
    throw new Error(
      'DA5 V5 empty database attestation mismatch (catalog)',
    );
  }
  if (row.port !== 55_435) {
    throw new Error('DA5 V5 empty database attestation mismatch (port)');
  }
  if (row.role !== 'taptime_da5_v5_installer') {
    throw new Error('DA5 V5 empty database attestation mismatch (role)');
  }
  if (row.server_version_num !== '170010') {
    throw new Error(
      'DA5 V5 empty database attestation mismatch (server-version)',
    );
  }
  if (!/^[1-9][0-9]{9,}$/u.test(row.system_identifier)) {
    throw new Error(
      'DA5 V5 empty database attestation mismatch (system-identifier)',
    );
  }
  if (row.user_schemas !== '') {
    throw new Error(
      'DA5 V5 empty database attestation mismatch (user-schemas)',
    );
  }
  return Object.freeze({ systemIdentifier: row.system_identifier });
}

function validateRuntimePoolRequest(
  request: Da5V5RuntimePoolRequest,
): readonly string[] {
  const exactRoles = da5V5OwnedRuntimeRoleGraph[request.login];
  if (
    exactRoles === undefined
    || !Number.isSafeInteger(request.max)
    || request.max < 1
    || request.max > 4
    || request.roles.length !== exactRoles.length
    || [...request.roles].sort().join('\n')
      !== [...exactRoles].sort().join('\n')
  ) {
    throw new Error('DA5 V5 runtime-pool authority mismatch');
  }
  return exactRoles;
}

async function normalizeOwnedRuntimeLogin(
  pool: Pool,
  login: string,
  password: string,
  roles: readonly string[],
): Promise<void> {
  if (
    da5V5OwnedRuntimeRoleGraph[login] === undefined
    || !/^[A-Za-z0-9_-]{32,}$/u.test(password)
  ) {
    throw new Error('DA5 V5 runtime-login authority mismatch');
  }
  await pool.query(`
    DO $login$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = '${login}'
      ) THEN
        CREATE ROLE ${login}
          LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE
          NOREPLICATION NOBYPASSRLS;
      END IF;
    END
    $login$;
    ALTER ROLE ${login} WITH
      LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE
      NOREPLICATION NOBYPASSRLS PASSWORD ${quotePgLiteral(password)};
    ALTER ROLE ${login} RESET ALL;

    DO $parents$
    DECLARE parent_name text;
    BEGIN
      FOR parent_name IN
        SELECT parent.rolname
        FROM pg_catalog.pg_auth_members AS membership
        JOIN pg_catalog.pg_roles AS member ON member.oid = membership.member
        JOIN pg_catalog.pg_roles AS parent ON parent.oid = membership.roleid
        WHERE member.rolname = '${login}'
      LOOP
        EXECUTE format('REVOKE %I FROM ${login}', parent_name);
      END LOOP;
    END
    $parents$;

    REVOKE ALL PRIVILEGES ON SCHEMA ${B3_SCHEMA} FROM ${login};
    REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA ${B3_SCHEMA} FROM ${login};
    REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA ${B3_SCHEMA} FROM ${login};
    REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA ${B3_SCHEMA} FROM ${login};
    GRANT ${roles.join(', ')} TO ${login};
  `);
}

async function attestDa5V5OwnerLifecycle(
  pool: Pool,
  expected: Da5V5PostgresOwnerBackend['attestation'],
  stage: Da5V5PostgresAttestationStage,
): Promise<void> {
  const identity = await pool.query<{
    address: string;
    database: string;
    port: number;
    role: string;
    server_version_num: string;
    system_identifier: string;
  }>(`
    SELECT
      pg_catalog.host(pg_catalog.inet_server_addr()) AS address,
      pg_catalog.current_database() AS database,
      pg_catalog.inet_server_port() AS port,
      CURRENT_USER AS role,
      pg_catalog.current_setting('server_version_num') AS server_version_num,
      system_identifier::text
    FROM pg_catalog.pg_control_system()
  `);
  const row = identity.rows[0];
  if (
    row === undefined
    || row.address !== expected.host
    || row.database !== expected.database
    || row.port !== expected.port
    || row.role !== expected.role
    || row.server_version_num !== String(expected.serverVersionNumber)
    || row.system_identifier !== expected.systemIdentifier
  ) {
    throw new Error('DA5 V5 PostgreSQL lifecycle identity mismatch');
  }

  const settings = await pool.query<{
    hba_file: string;
    listen_addresses: string;
    password_encryption: string;
    port: string;
    ssl: string;
    unix_socket_directories: string;
  }>(`
    SELECT
      pg_catalog.current_setting('hba_file') AS hba_file,
      pg_catalog.current_setting('listen_addresses') AS listen_addresses,
      pg_catalog.current_setting('password_encryption') AS password_encryption,
      pg_catalog.current_setting('port') AS port,
      pg_catalog.current_setting('ssl') AS ssl,
      pg_catalog.current_setting('unix_socket_directories')
        AS unix_socket_directories
  `);
  const configured = settings.rows[0];
  if (
    configured === undefined
    || configured.listen_addresses !== '127.0.0.1'
    || configured.password_encryption !== 'scram-sha-256'
    || configured.port !== '55435'
    || configured.ssl !== 'off'
    || !configured.hba_file.endsWith('/data/pg_hba.conf')
    || !configured.unix_socket_directories.endsWith('/socket')
  ) {
    throw new Error('DA5 V5 PostgreSQL lifecycle configuration mismatch');
  }

  if (stage === 'before-migrations') {
    await attestEmptyDa5Database(pool);
    return;
  }
  if (
    stage === 'after-migrations'
    || stage === 'after-role-provisioning'
    || stage === 'before-product-listeners'
    || stage === 'before-cleanup'
  ) {
    const ledger = await pool.query<{
      migration_count: string;
      migration_list: string;
      schema_owner: string;
    }>(`
      SELECT
        (
          SELECT count(*)::text
          FROM ${B3_MIGRATION_TABLE}
        ) AS migration_count,
        (
          SELECT pg_catalog.string_agg(version, ',' ORDER BY version)
          FROM ${B3_MIGRATION_TABLE}
        ) AS migration_list,
        (
          SELECT owner.rolname
          FROM pg_catalog.pg_namespace AS namespace
          JOIN pg_catalog.pg_roles AS owner ON owner.oid = namespace.nspowner
          WHERE namespace.nspname = '${B3_SCHEMA}'
        ) AS schema_owner
    `);
    const migration = ledger.rows[0];
    if (
      migration?.migration_count !== '13'
      || migration.migration_list
        !== '001,002,003,004,005,006,007,008,009,010,011,012,013'
      || migration.schema_owner !== 'taptime_da5_v5_installer'
    ) {
      throw new Error('DA5 V5 PostgreSQL migration-ledger mismatch');
    }
  }

  if (
    stage === 'after-role-provisioning'
    || stage === 'before-product-listeners'
    || stage === 'before-cleanup'
  ) {
    const expectedRoles = [
      'taptime_da5_v5_installer',
      ...da5V5MigrationRoles,
      ...Object.keys(da5V5OwnedRuntimeRoleGraph),
    ].sort();
    const roles = await pool.query<{ roles: string }>(`
      SELECT COALESCE(
        pg_catalog.string_agg(rolname, ',' ORDER BY rolname),
        ''
      ) AS roles
      FROM pg_catalog.pg_roles
      WHERE rolname !~ '^pg_'
    `);
    if (roles.rows[0]?.roles !== expectedRoles.join(',')) {
      throw new Error('DA5 V5 PostgreSQL role allowlist mismatch');
    }
    const runtimeRoles = await pool.query<{
      bypassrls: boolean;
      canlogin: boolean;
      createdb: boolean;
      createrole: boolean;
      inherit: boolean;
      memberships: string;
      parents: string;
      replication: boolean;
      role: string;
      settings: string;
      superuser: boolean;
    }>(`
      SELECT
        role.rolname AS role,
        role.rolcanlogin AS canlogin,
        role.rolinherit AS inherit,
        role.rolsuper AS superuser,
        role.rolcreatedb AS createdb,
        role.rolcreaterole AS createrole,
        role.rolreplication AS replication,
        role.rolbypassrls AS bypassrls,
        COALESCE((
          SELECT pg_catalog.string_agg(parent.rolname, ',' ORDER BY parent.rolname)
          FROM pg_catalog.pg_auth_members AS membership
          JOIN pg_catalog.pg_roles AS parent ON parent.oid = membership.roleid
          WHERE membership.member = role.oid
        ), '') AS parents,
        COALESCE((
          SELECT pg_catalog.string_agg(
            parent.rolname || ':' || membership.admin_option::text || ':'
              || membership.inherit_option::text || ':'
              || membership.set_option::text,
            ',' ORDER BY parent.rolname
          )
          FROM pg_catalog.pg_auth_members AS membership
          JOIN pg_catalog.pg_roles AS parent ON parent.oid = membership.roleid
          WHERE membership.member = role.oid
        ), '') AS memberships,
        COALESCE((
          SELECT pg_catalog.string_agg(setting, ',' ORDER BY setting)
          FROM pg_catalog.unnest(role.rolconfig) AS setting
        ), '') AS settings
      FROM pg_catalog.pg_roles AS role
      WHERE role.rolname = ANY($1::text[])
      ORDER BY role.rolname
    `, [Object.keys(da5V5OwnedRuntimeRoleGraph)]);
    if (runtimeRoles.rows.length !== Object.keys(da5V5OwnedRuntimeRoleGraph).length) {
      throw new Error('DA5 V5 PostgreSQL runtime-role cardinality mismatch');
    }
    for (const runtimeRole of runtimeRoles.rows) {
      const expectedParents = da5V5OwnedRuntimeRoleGraph[runtimeRole.role];
      const expectedMemberships = expectedParents?.map((parent) => (
        `${parent}:false:true:true`
      )).sort().join(',');
      if (
        expectedParents === undefined
        || !runtimeRole.canlogin
        || runtimeRole.inherit
        || runtimeRole.superuser
        || runtimeRole.createdb
        || runtimeRole.createrole
        || runtimeRole.replication
        || runtimeRole.bypassrls
        || runtimeRole.settings !== ''
        || runtimeRole.parents !== [...expectedParents].sort().join(',')
        || runtimeRole.memberships !== expectedMemberships
      ) {
        throw new Error('DA5 V5 PostgreSQL runtime-role boundary mismatch');
      }
    }
    const directGrants = await pool.query<{ direct_grants: string }>(`
      SELECT (
        (SELECT count(*) FROM information_schema.role_table_grants
          WHERE grantee = ANY($1::text[]))
        + (SELECT count(*) FROM information_schema.role_routine_grants
          WHERE grantee = ANY($1::text[]))
        + (SELECT count(*) FROM information_schema.role_usage_grants
          WHERE grantee = ANY($1::text[]))
        + (SELECT count(*) FROM pg_catalog.aclexplode(
            COALESCE((
              SELECT datacl FROM pg_catalog.pg_database
              WHERE datname = current_database()
            ), '{}'::aclitem[])
          ) AS acl
          JOIN pg_catalog.pg_roles AS grantee ON grantee.oid = acl.grantee
          WHERE grantee.rolname = ANY($1::text[]))
      )::text AS direct_grants
    `, [Object.keys(da5V5OwnedRuntimeRoleGraph)]);
    if (directGrants.rows[0]?.direct_grants !== '0') {
      throw new Error('DA5 V5 PostgreSQL direct-grant boundary mismatch');
    }
  }

  if (stage === 'before-product-listeners') {
    const sessions = await pool.query<{ application_sessions: string }>(`
      SELECT count(*)::text AS application_sessions
      FROM pg_catalog.pg_stat_activity
      WHERE datname = current_database()
        AND pid <> pg_catalog.pg_backend_pid()
        AND backend_type = 'client backend'
    `);
    if (sessions.rows[0]?.application_sessions !== '0') {
      throw new Error('DA5 V5 PostgreSQL pre-listener session mismatch');
    }
  }
}

function runtimePostgresUrl(
  installerPassword: string,
  username: string,
  runtimePassword: string,
): string {
  const url = new URL(postgresUrl(installerPassword, 'taptime_synthetic_android_e2e'));
  url.username = username;
  url.password = runtimePassword;
  return url.toString();
}

function quotePgLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

async function assertPortAbsent(port: number): Promise<void> {
  const occupied = await new Promise<boolean>((resolveResult) => {
    const socket = connect({ host: '127.0.0.1', port });
    socket.setTimeout(250);
    socket.once('connect', () => {
      socket.destroy();
      resolveResult(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolveResult(false);
    });
    socket.once('error', () => resolveResult(false));
  });
  if (occupied) {
    throw new Error('DA5 V5 fixed PostgreSQL port is occupied');
  }
}

async function requireCanonicalAbsoluteFile(path: string): Promise<string> {
  if (!path.startsWith('/')) {
    throw new Error('DA5 V5 PostgreSQL path must be absolute');
  }
  const canonical = await realpath(path);
  const state = await stat(canonical);
  if (!state.isFile()) {
    throw new Error('DA5 V5 PostgreSQL path must be a file');
  }
  return canonical;
}

function pathComponents(path: string): readonly string[] {
  const parsed = parse(path);
  const relative = path.slice(parsed.root.length).split(sep).filter(Boolean);
  const components = [parsed.root];
  let current = parsed.root;
  for (const component of relative) {
    current = join(current, component);
    components.push(current);
  }
  return components;
}

function boundedSpawn(binary: string, args: readonly string[]): string {
  const result = spawnSync(binary, args, {
    cwd: '/',
    encoding: 'utf8',
    env: Object.freeze({ HOME: '/var/empty', PATH: '/usr/bin:/bin', TZ: 'UTC' }),
    maxBuffer: 65_536,
    shell: false,
    timeout: 5_000,
    killSignal: 'SIGKILL',
  });
  if (
    result.error !== undefined
    || result.signal !== null
    || result.status !== 0
    || result.stderr.trim().length > 0
  ) {
    throw new Error('DA5 V5 PostgreSQL bounded discovery failed');
  }
  return result.stdout.trim();
}

async function captureProcessIdentity(options: {
  readonly authoritativeSessionId: number;
  readonly executableDigest: string;
  readonly executablePath: string;
  readonly expectedParentPid: number;
  readonly expectedProcessGroup: number;
  readonly pid: number;
}): Promise<Da5V5PostgresProcessIdentityRecord> {
  const inspectorPath = await realpath('/bin/ps');
  const inspector = await open(
    inspectorPath,
    constants.O_RDONLY | constants.O_NOFOLLOW,
  );
  try {
    const before = await inspector.stat({ bigint: true });
    if (
      !before.isFile()
      || Number(before.uid) !== 0
      || (Number(before.mode) & 0o022) !== 0
    ) {
      throw new Error('DA5 V5 process inspector identity mismatch');
    }
    const inspectorDigest = await hashFileHandle(inspector, before.size);
    const result = spawnSync(inspectorPath, [
      '-ww',
      '-p',
      String(options.pid),
      '-o',
      'pid=',
      '-o',
      'ppid=',
      '-o',
      'pgid=',
      '-o',
      'sess=',
      '-o',
      'lstart=',
      '-o',
      'command=',
    ], {
      cwd: '/',
      encoding: 'utf8',
      env: Object.freeze({ PATH: '/usr/bin:/bin', TZ: 'UTC' }),
      maxBuffer: 4_096,
      shell: false,
      timeout: 5_000,
      killSignal: 'SIGKILL',
    });
    const after = await inspector.stat({ bigint: true });
    if (
      result.error !== undefined
      || result.signal !== null
      || result.status !== 0
      || result.stderr.trim().length > 0
      || stableStatRecord(before).dev !== stableStatRecord(after).dev
      || stableStatRecord(before).ino !== stableStatRecord(after).ino
      || await hashFileHandle(inspector, after.size) !== inspectorDigest
    ) {
      throw new Error('DA5 V5 process identity inspection failed');
    }
    const match = /^\s*([1-9][0-9]*)\s+([1-9][0-9]*)\s+([1-9][0-9]*)\s+([0-9]+)\s+([A-Z][a-z]{2}\s+[A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}\s+\d{4})\s+(.+?)\s*$/u
      .exec(result.stdout);
    const mismatches = match === null
      ? ['shape']
      : [
          Number(match[1]) === options.pid ? null : 'pid',
          Number(match[2]) === options.expectedParentPid ? null : 'parent',
          Number(match[3]) === options.expectedProcessGroup ? null : 'group',
          (
            Number(match[4]) === options.authoritativeSessionId
            || (process.platform === 'darwin' && Number(match[4]) === 0)
          ) ? null : 'session-observation',
          (match[6] ?? '').split(/\s+/u)[0] === options.executablePath
            ? null
            : 'executable',
          /^[a-f0-9]{64}$/u.test(options.executableDigest)
            ? null
            : 'digest',
        ].filter((value): value is string => value !== null);
    if (match === null || mismatches.length > 0) {
      throw new Error(
        `DA5 V5 process identity mismatch (${mismatches.join(',')})`,
      );
    }
    return Object.freeze({
      command: match[6] as string,
      executableDigest: options.executableDigest,
      executablePath: options.executablePath,
      inspectorDigest,
      parentPid: match[2] as string,
      pgid: match[3] as string,
      pid: match[1] as string,
      sessionAuthority: 'guard-hello-getsid',
      sessionId: String(options.authoritativeSessionId),
      sessionObservation: match[4] as string,
      sessionObservationReliability:
        Number(match[4]) === options.authoritativeSessionId
          ? 'authoritative-match'
          : 'darwin-ps-zero-unreliable',
      start: match[5] as string,
    });
  } finally {
    await inspector.close();
  }
}

export async function captureDa5V5ProcessIdentityForTest(options: {
  readonly authoritativeSessionId: number;
  readonly executableDigest: string;
  readonly executablePath: string;
  readonly expectedParentPid: number;
  readonly expectedProcessGroup: number;
  readonly pid: number;
}): Promise<Da5V5PostgresProcessIdentityRecord> {
  assertDa5V5FocusedTestProcess();
  return captureProcessIdentity(options);
}

export async function revalidateDa5V5ProcessIdentityForTest(options: {
  readonly capture: Parameters<typeof captureProcessIdentity>[0];
  readonly expected: Da5V5PostgresProcessIdentityRecord;
  readonly mutateCaptured?: (
    captured: Da5V5PostgresProcessIdentityRecord,
  ) => Da5V5PostgresProcessIdentityRecord;
}): Promise<void> {
  assertDa5V5FocusedTestProcess();
  const captured = await captureProcessIdentity(options.capture);
  const candidate = options.mutateCaptured?.(captured) ?? captured;
  assertMatchingProcessIdentity(options.expected, candidate);
}

function assertMatchingProcessIdentity(
  expected: Da5V5PostgresProcessIdentityRecord,
  captured: Da5V5PostgresProcessIdentityRecord,
): void {
  if (JSON.stringify(captured) !== JSON.stringify(expected)) {
    throw new Error('DA5 V5 PostgreSQL process identity changed');
  }
}

function postgresUrl(password: string, database: string): string {
  const url = new URL('postgresql://127.0.0.1:55435/');
  url.username = 'taptime_da5_v5_installer';
  url.password = password;
  url.pathname = `/${database}`;
  return url.toString();
}

function installerPasswordString(capabilitySecret: string): string {
  return createHash('sha256')
    .update(`DA5-V5-POSTGRES-INSTALLER-V1\n${capabilitySecret}\n`)
    .digest('base64url');
}

function isGuid(value: string): boolean {
  return /^[A-Fa-f0-9]{8}-(?:[A-Fa-f0-9]{4}-){3}[A-Fa-f0-9]{12}$/u.test(value);
}

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function parseMountIdentityRecord(
  event: string,
): Da5V5PostgresMountIdentityRecord {
  const fields = event.split('|');
  const digest = fields[1] ?? '';
  const recordHex = fields[2] ?? '';
  if (
    fields.length !== 3
    || !/^[a-f0-9]{64}$/u.test(digest)
    || !/^(?:[a-f0-9]{2})+$/u.test(recordHex)
  ) {
    throw new Error('DA5 V5 Runtime Guard mount binding mismatch');
  }
  const canonicalRecord = Buffer.from(recordHex, 'hex').toString('utf8');
  const match = /^DA5-V5-MOUNT-BINDING-V2\nbase:(.+)\nstaging:(.+)\nroot:(.+)\n$/u
    .exec(canonicalRecord);
  if (match === null || sha256(canonicalRecord) !== digest) {
    throw new Error('DA5 V5 Runtime Guard mount binding mismatch');
  }
  const parseState = (
    value: string,
  ): Da5V5PostgresMountIdentityRecord['base'] => {
    const state = /^fsid=([a-f0-9]+),type=(-?[0-9]+),bsize=([0-9]+),flags=([0-9]+),mnton=([a-f0-9]*),fstype=([a-f0-9]*)$/u
      .exec(value);
    if (state === null) {
      throw new Error('DA5 V5 Runtime Guard mount state mismatch');
    }
    return Object.freeze({
      blockSize: state[3] as string,
      fileSystemIdHex: state[1] as string,
      fileSystemType: state[2] as string,
      fileSystemTypeNameHex: state[6] as string,
      flags: state[4] as string,
      mountPointHex: state[5] as string,
    });
  };
  return Object.freeze({
    base: parseState(match[1] as string),
    canonicalRecord,
    canonicalSha256: digest,
    platform: process.platform === 'darwin' ? 'darwin' : 'linux',
    root: parseState(match[3] as string),
    staging: parseState(match[2] as string),
  });
}

function stableStatRecord(state: {
  readonly dev: bigint;
  readonly gid: bigint;
  readonly ino: bigint;
  readonly mode: bigint;
  readonly size: bigint;
  readonly uid: bigint;
}): Readonly<Record<string, string>> {
  return Object.freeze({
    dev: state.dev.toString(),
    gid: state.gid.toString(),
    ino: state.ino.toString(),
    mode: state.mode.toString(),
    size: state.size.toString(),
    uid: state.uid.toString(),
  });
}

async function bindLifecycleFile(
  path: string,
  bindContent: boolean,
): Promise<BoundLifecycleFile> {
  if (await realpath(path) !== path) {
    throw new Error('DA5 V5 PostgreSQL lifecycle path is not canonical');
  }
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const state = await handle.stat({ bigint: true });
    if (!state.isFile() || Number(state.uid) !== process.geteuid?.()) {
      throw new Error('DA5 V5 PostgreSQL lifecycle file mismatch');
    }
    const pathState = await lstat(path, { bigint: true });
    const mount = await statfs(path, { bigint: true });
    const identity = lifecycleIdentityRecord(pathState, mount, !bindContent);
    const contentDigest = bindContent
      ? sha256(await readExactLifecycleHandle(handle, Number(state.size)))
      : null;
    const binding = Object.freeze({
      contentDigest,
      handle,
      identity,
      mutable: !bindContent,
      path,
    });
    await revalidateLifecycleFile(binding);
    return binding;
  } catch (error) {
    await handle.close().catch(() => undefined);
    throw error;
  }
}

async function bindLifecycleDirectory(
  path: string,
  existingHandle?: FileHandle,
  ownsHandle = true,
): Promise<BoundLifecycleDirectory> {
  if (await realpath(path) !== path) {
    throw new Error('DA5 V5 PostgreSQL lifecycle directory is not canonical');
  }
  const handle = existingHandle ?? await open(
    path,
    constants.O_RDONLY | constants.O_NOFOLLOW,
  );
  try {
    const pathState = await lstat(path, { bigint: true });
    const handleState = await handle.stat({ bigint: true });
    const mount = await statfs(path, { bigint: true });
    if (
      !pathState.isDirectory()
      || !handleState.isDirectory()
      || stableStatRecord(pathState).dev !== stableStatRecord(handleState).dev
      || stableStatRecord(pathState).ino !== stableStatRecord(handleState).ino
    ) {
      throw new Error('DA5 V5 PostgreSQL lifecycle directory mismatch');
    }
    const identity = lifecycleIdentityRecord(pathState, mount, true);
    const binding = Object.freeze({
      handle,
      identity,
      ownsHandle,
      path,
    });
    await revalidateLifecycleDirectory(binding);
    return binding;
  } catch (error) {
    if (ownsHandle) {
      await handle.close().catch(() => undefined);
    }
    throw error;
  }
}

async function bindLifecycleSocket(path: string): Promise<BoundLifecycleSocket> {
  const state = await lstat(path, { bigint: true });
  if (!state.isSocket() || Number(state.uid) !== process.geteuid?.()) {
    throw new Error('DA5 V5 PostgreSQL lifecycle socket mismatch');
  }
  return Object.freeze({
    identity: lifecycleIdentityRecord(
      state,
      await statfs(dirname(path), { bigint: true }),
    ),
    path,
  });
}

async function revalidateLifecycleFiles(
  bindings: readonly BoundLifecycleFile[],
): Promise<void> {
  for (const binding of bindings) {
    await revalidateLifecycleFile(binding);
  }
}

async function revalidateLifecycleDirectories(
  bindings: readonly BoundLifecycleDirectory[],
): Promise<void> {
  for (const binding of bindings) {
    await revalidateLifecycleDirectory(binding);
  }
}

async function revalidateLifecycleDirectory(
  binding: BoundLifecycleDirectory,
): Promise<void> {
  const pathState = await lstat(binding.path, { bigint: true });
  const handleState = await binding.handle.stat({ bigint: true });
  const mount = await statfs(binding.path, { bigint: true });
  if (
    !pathState.isDirectory()
    || !handleState.isDirectory()
    || JSON.stringify(lifecycleIdentityRecord(pathState, mount, true))
      !== JSON.stringify(binding.identity)
    || JSON.stringify(lifecycleIdentityRecord(handleState, mount, true))
      !== JSON.stringify(binding.identity)
  ) {
    throw new Error('DA5 V5 PostgreSQL lifecycle directory changed');
  }
}

async function revalidateLifecycleFile(
  binding: BoundLifecycleFile,
): Promise<void> {
  const pathState = await lstat(binding.path, { bigint: true });
  const handleState = await binding.handle.stat({ bigint: true });
  const mount = await statfs(binding.path, { bigint: true });
  const pathIdentity = lifecycleIdentityRecord(
    pathState,
    mount,
    binding.mutable,
  );
  const handleIdentity = lifecycleIdentityRecord(
    handleState,
    mount,
    binding.mutable,
  );
  if (
    JSON.stringify(pathIdentity) !== JSON.stringify(binding.identity)
    || JSON.stringify(handleIdentity) !== JSON.stringify(binding.identity)
    || (
      binding.contentDigest !== null
      && sha256(await readExactLifecycleHandle(
        binding.handle,
        Number(handleState.size),
      )) !== binding.contentDigest
    )
  ) {
    throw new Error('DA5 V5 PostgreSQL lifecycle file changed');
  }
}

async function revalidateLifecycleSocket(
  binding: BoundLifecycleSocket,
): Promise<void> {
  const state = await lstat(binding.path, { bigint: true });
  const actual = lifecycleIdentityRecord(
    state,
    await statfs(dirname(binding.path), { bigint: true }),
  );
  if (
    !state.isSocket()
    || JSON.stringify(actual) !== JSON.stringify(binding.identity)
  ) {
    throw new Error('DA5 V5 PostgreSQL lifecycle socket changed');
  }
}

function lifecycleFileRecord(
  binding: BoundLifecycleFile,
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    contentDigest: binding.contentDigest,
    identity: binding.identity,
    mutable: binding.mutable,
    path: binding.path,
  });
}

function lifecycleDirectoryRecord(
  binding: BoundLifecycleDirectory,
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    identity: binding.identity,
    path: binding.path,
  });
}

function lifecycleIdentityRecord(
  state: {
    readonly birthtimeNs: bigint;
    readonly ctimeNs: bigint;
    readonly dev: bigint;
    readonly gid: bigint;
    readonly ino: bigint;
    readonly mode: bigint;
    readonly mtimeNs: bigint;
    readonly nlink: bigint;
    readonly size: bigint;
    readonly uid: bigint;
  },
  mount: {
    readonly bsize: bigint;
    readonly type: bigint;
  },
  mutable = false,
): Readonly<Record<string, string>> {
  const stable = {
    birthtimeNs: state.birthtimeNs.toString(),
    dev: state.dev.toString(),
    fsBlockSize: mount.bsize.toString(),
    fsType: mount.type.toString(),
    gid: state.gid.toString(),
    ino: state.ino.toString(),
    mode: state.mode.toString(),
    nlink: state.nlink.toString(),
    uid: state.uid.toString(),
  };
  return Object.freeze(mutable ? {
    ...stable,
    mutable: 'true',
  } : {
    ...stable,
    ctimeNs: state.ctimeNs.toString(),
    mtimeNs: state.mtimeNs.toString(),
    mutable: 'false',
    size: state.size.toString(),
  });
}

async function readLifecycleFile(binding: BoundLifecycleFile): Promise<Buffer> {
  const state = await binding.handle.stat({ bigint: true });
  return readExactLifecycleHandle(binding.handle, Number(state.size));
}

async function readExactLifecycleHandle(
  handle: FileHandle,
  size: number,
): Promise<Buffer> {
  if (!Number.isSafeInteger(size) || size < 0 || size > 1_048_576) {
    throw new Error('DA5 V5 PostgreSQL lifecycle file size mismatch');
  }
  const bytes = Buffer.alloc(size);
  let offset = 0;
  while (offset < size) {
    const result = await handle.read(bytes, offset, size - offset, offset);
    if (result.bytesRead < 1) {
      throw new Error('DA5 V5 PostgreSQL lifecycle file read mismatch');
    }
    offset += result.bytesRead;
  }
  return bytes;
}

function assertPostmasterPidBinding(
  contents: Buffer,
  expected: {
    readonly dataPath: string;
    readonly pid: number;
    readonly socketPath: string;
  },
): void {
  const lines = contents.toString('utf8').split('\n');
  const checks = Object.freeze({
    dataPath: lines[1] === expected.dataPath,
    lineCount: lines.length >= 8,
    listenAddress: lines[5] === '127.0.0.1',
    pid: lines[0] === String(expected.pid),
    port: lines[3] === '55435',
    socketPath: lines[4] === expected.socketPath,
    startTime: /^[1-9][0-9]*$/u.test(lines[2] ?? ''),
    status: lines[7] === 'ready   ',
  });
  const mismatches = Object.entries(checks)
    .filter(([, matches]) => !matches)
    .map(([name]) => name);
  if (mismatches.length > 0) {
    throw new Error(
      `DA5 V5 PostgreSQL postmaster.pid mismatch (${mismatches.join(',')})`,
    );
  }
}

function hex(value: string): string {
  return Buffer.from(value).toString('hex');
}

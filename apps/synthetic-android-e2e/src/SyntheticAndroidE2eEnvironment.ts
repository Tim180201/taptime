import { randomBytes } from 'node:crypto';
import {
  B4SessionAuthorityResolver,
  B5ScanContextResolver,
  createBackendHttpServer,
  type EmployeeMembershipEnrollmentCoordinator as EmployeeEnrollmentPort,
  type ScanContextResolver,
} from '@taptime/backend-api';
import {
  AdminWriteSessionCoordinator,
  EmployeeMembershipEnrollmentCoordinator,
  NfcTagReassignmentCoordinator,
} from '@taptime/backend-administration';
import {
  PostgresIdentityMembershipResolver,
  SupabaseJwtAccessTokenVerifier,
} from '@taptime/backend-identity';
import {
  ManualLifecycleIngestionCoordinator,
  ServerCanonicalLifecycleIngestionCoordinator,
} from '@taptime/backend-lifecycle';
import {
  MobileWorkReadCoordinator,
  ProjectAdministrationCoordinator,
} from '@taptime/backend-mobile-work';
import {
  OfflineCaptureLeaseCoordinator,
  OfflineEventReconciliationCoordinator,
  OfflineLifecycleIngestionCoordinator,
} from '@taptime/backend-offline-sync';
import { TenantReadSessionCoordinator } from '@taptime/backend-read-model';
import { TimeEntryExportCoordinator } from '@taptime/backend-time-export';
import { TimeReviewCoordinator } from '@taptime/backend-time-review';
import { Pool } from 'pg';
import {
  readDa4V5FixtureManifest,
  readDa4V5Status,
  type Da4V5Status,
} from './Da4V5Database.js';
import {
  DA4_V5_PROFILE,
  type Da4V5FixtureManifest,
} from './Da4V5Profile.js';
import {
  DA5_V5_TAG_B_REGISTRATION_ARM_STATUS,
  Da5V5ProtectedReviewFixture,
  readDa5V5InvariantStatus,
  readDa5V5Status,
  sameDa5V5Status,
  type Da5V5InvariantStatus,
  type Da5V5ProtectedFixtureState,
  type Da5V5Status,
} from './Da5V5Database.js';
import {
  Da5V5DedupeWindowController,
  type Da5V5DedupeBinding,
  type Da5V5DedupePhase,
} from './Da5V5DedupeWindow.js';
import {
  DA5_V5_PROFILE,
  validateDa5V5TagBinding,
  type Da5V5TagBinding,
} from './Da5V5Profile.js';
import {
  Da5V5ScanContextResolver,
  type Da5V5ScanSafeEvent,
  type Da5V5TagRoleState,
} from './Da5V5ScanContextResolver.js';
import {
  SYNTHETIC_ADMIN_AUTH_EMAIL,
  SYNTHETIC_AUTH_EMAIL,
  SYNTHETIC_ENROLLMENT_AUTH_EMAIL,
  SYNTHETIC_PUBLISHABLE_KEY,
  SYNTHETIC_SECOND_ENROLLMENT_AUTH_EMAIL,
} from './constants.js';
import {
  cleanSyntheticDatabase,
  prepareDa5V5SyntheticDatabase,
  prepareSyntheticDatabase,
  readSyntheticEmployeeEnrollmentEvidenceCounts,
  readSyntheticEvidenceCounts,
  readSyntheticTimeReviewEvidenceCounts,
  validateSyntheticInstallerDatabaseUrl,
  type SyntheticEmployeeEnrollmentEvidenceCounts,
  type SyntheticEvidenceCounts,
  type SyntheticTimeReviewEvidenceCounts,
} from './database.js';
import {
  closeDa5V5PostgresCapability,
  type Da5V5PostgresCapability,
} from './Da5V5PostgresCapability.js';
import {
  FingerprintProvisioningScanContextResolver,
  type SyntheticSafeEvent,
} from './FingerprintProvisioningScanContextResolver.js';
import { SyntheticLocalAuthServer } from './SyntheticLocalAuthServer.js';
import {
  SyntheticRedemptionInterruptionController,
  type SyntheticRedemptionInterruptionEvent,
  type SyntheticRedemptionInterruptionState,
} from './SyntheticRedemptionInterruptionController.js';

export type SyntheticEnvironmentSafeEvent =
  | SyntheticSafeEvent
  | SyntheticRedemptionInterruptionEvent
  | Da5V5ScanSafeEvent
  | 'api_administration_unavailable'
  | 'api_employee_enrollment_unavailable'
  | 'api_lifecycle_unavailable'
  | 'api_mobile_work_unavailable'
  | 'api_offline_synchronization_unavailable'
  | 'api_scan_context_unavailable'
  | 'api_session_unavailable'
  | 'api_time_entry_export_unavailable'
  | 'api_time_review_unavailable';

export interface SyntheticAndroidE2eEnvironmentOptions {
  readonly apiPort?: number;
  readonly authPort?: number;
  readonly installerDatabaseUrl?: string;
  readonly password: string;
  readonly profile?: typeof DA4_V5_PROFILE | typeof DA5_V5_PROFILE;
  readonly da5V5PostgresCapability?: Da5V5PostgresCapability;
  readonly da5V5PostgresSource?:
    | 'ci-test-adapter'
    | 'isolated-runtime-guard';
  readonly da5V5TagBinding?: Da5V5TagBinding;
  readonly onDa5V5FixtureOperations?: (pool: Pool) => void;
  readonly onSafeEvent?: (event: SyntheticEnvironmentSafeEvent) => void;
}

export interface SyntheticAndroidE2eEnvironment {
  readonly apiBaseUrl: string;
  readonly administratorEmail: typeof SYNTHETIC_ADMIN_AUTH_EMAIL;
  readonly authBaseUrl: string;
  readonly email: typeof SYNTHETIC_AUTH_EMAIL;
  readonly employeeEmail: typeof SYNTHETIC_AUTH_EMAIL;
  readonly enrollmentEmail: typeof SYNTHETIC_ENROLLMENT_AUTH_EMAIL;
  readonly publishableKey: typeof SYNTHETIC_PUBLISHABLE_KEY;
  readonly secondEnrollmentEmail: typeof SYNTHETIC_SECOND_ENROLLMENT_AUTH_EMAIL;
  abortPausedRedemption(): void;
  armTagA(expectedFingerprint: string): void;
  armNextRedemptionInterruption(): void;
  employeeEnrollmentEvidenceCounts(): Promise<SyntheticEmployeeEnrollmentEvidenceCounts>;
  redemptionInterruptionState(): SyntheticRedemptionInterruptionState;
  provisioningState(): 'armed' | 'disarmed' | 'provisioning';
  evidenceCounts(): Promise<SyntheticEvidenceCounts>;
  timeReviewEvidenceCounts(): Promise<SyntheticTimeReviewEvidenceCounts>;
  da4V5FixtureManifest(): Promise<Da4V5FixtureManifest>;
  da4V5Status(): Promise<Da4V5Status>;
  armDa5V5TagBRegistration(): Promise<void>;
  da5V5CaptureDedupeWindow(
    phase: Da5V5DedupePhase,
    binding: Da5V5DedupeBinding,
  ): Promise<'match' | 'mismatch'>;
  da5V5CheckDedupeWindow(
    phase: Da5V5DedupePhase,
    binding: Da5V5DedupeBinding,
  ): Promise<'match' | 'mismatch'>;
  da5V5DedupeState(): ReturnType<Da5V5DedupeWindowController['state']>;
  da5V5FixtureArm(deviceQueueItems: number): Promise<'match' | 'mismatch'>;
  da5V5FixtureActivateTagB(): Promise<'match' | 'mismatch'>;
  da5V5FixtureCutoverTagA(): Promise<'match' | 'mismatch'>;
  da5V5FixtureMarkTerminal(): Promise<'match' | 'mismatch'>;
  da5V5FixtureState(): Da5V5ProtectedFixtureState;
  da5V5Status(): Promise<Da5V5Status>;
  da5V5InvariantStatus(): Promise<Da5V5InvariantStatus>;
  da5V5TagRegistrationState(): ReturnType<Da5V5ScanContextResolver['state']>;
  da5V5TagRoleState(): Promise<Da5V5TagRoleState>;
  close(): Promise<void>;
}

export function da5V5TagBRegistrationPreconditionMatches(
  status: Da5V5Status,
  tagRoles: Da5V5TagRoleState,
): boolean {
  return sameDa5V5Status(status, DA5_V5_TAG_B_REGISTRATION_ARM_STATUS)
    && tagRoles.activeTagAAssignments === 1
    && tagRoles.activeTagACustomerAAssignments === 1
    && tagRoles.activeTagBAssignments === 0
    && tagRoles.tagAExactRecords === 1
    && tagRoles.tagARecords === 1
    && tagRoles.tagBExactRecords === 0
    && tagRoles.tagBRecords === 0
    && tagRoles.tagBTotalAssignments === 0
    && tagRoles.tagXRecords === 0;
}

export class Da4V5CleanupError extends Error {
  constructor() {
    super('DA4 V5 cleanup failed');
    this.name = 'Da4V5CleanupError';
  }
}

export async function runDa4V5StrictCleanup(options: {
  readonly closeDatabase: () => Promise<void>;
  readonly closeInstaller: () => Promise<void>;
  readonly closeResources: readonly (() => Promise<void>)[];
}): Promise<void> {
  const resourceResults = await Promise.allSettled(
    options.closeResources.map(async (closeResource) => closeResource()),
  );
  const databaseResult = await settle(options.closeDatabase);
  const installerResult = await settle(options.closeInstaller);
  if (
    resourceResults.some((result) => result.status === 'rejected')
    || databaseResult.status === 'rejected'
    || installerResult.status === 'rejected'
  ) {
    throw new Da4V5CleanupError();
  }
}

export class Da5V5CleanupError extends Error {
  constructor() {
    super('DA5 V5 cleanup failed');
    this.name = 'Da5V5CleanupError';
  }
}

export function da5V5StartupCleanupIncomplete(primaryFailure: unknown): Error {
  let primaryMessage = 'DA5 V5 startup failed';
  if (primaryFailure instanceof Error) {
    try {
      if (typeof primaryFailure.message === 'string' && primaryFailure.message.length > 0) {
        primaryMessage = primaryFailure.message;
      }
    } catch {
      primaryMessage = 'DA5 V5 startup failed';
    }
  }
  return new Error(`${primaryMessage};cleanup-incomplete`);
}

export async function runDa5V5StrictCleanup(options: {
  readonly closeCapabilityOwner: () => Promise<void>;
  readonly closeResources: readonly (() => Promise<void>)[];
}): Promise<void> {
  let failed = false;
  for (const closeResource of options.closeResources) {
    const result = await settle(closeResource);
    failed ||= result.status === 'rejected';
  }
  const capabilityOwnerResult = await settle(options.closeCapabilityOwner);
  failed ||= capabilityOwnerResult.status === 'rejected';
  if (failed) {
    throw new Da5V5CleanupError();
  }
}

export async function createSyntheticAndroidE2eEnvironment(
  options: SyntheticAndroidE2eEnvironmentOptions,
): Promise<SyntheticAndroidE2eEnvironment> {
  const profile = validateSyntheticEnvironmentProfile(options.profile as unknown);
  const da5V5Binding = resolveDa5V5TagBinding(profile, options.da5V5TagBinding);
  const databaseInput = resolveSyntheticDatabaseInput(profile, options);
  const onSafeEvent = options.onSafeEvent ?? (() => undefined);
  const auth = await SyntheticLocalAuthServer.create({
    password: options.password,
    port: validatePort(options.authPort ?? 54_321),
  });
  let installerPool: Pool | null = databaseInput.installerDatabaseUrl === undefined
    ? null
    : createPool(databaseInput.installerDatabaseUrl, 2);
  let sessionPool: Pool | null = null;
  let readModelPool: Pool | null = null;
  let lifecyclePool: Pool | null = null;
  let administrationPool: Pool | null = null;
  let employeeInvitationPool: Pool | null = null;
  let employeeEnrollmentPool: Pool | null = null;
  let reassignmentPool: Pool | null = null;
  let offlineLeasePool: Pool | null = null;
  let offlineEventPool: Pool | null = null;
  let offlineReconciliationPool: Pool | null = null;
  let timeEntryExportPool: Pool | null = null;
  let timeReviewReadPool: Pool | null = null;
  let timeReviewWritePool: Pool | null = null;
  let provisionerPool: Pool | null = null;
  let manualLifecyclePool: Pool | null = null;
  let mobileOwnTimePool: Pool | null = null;
  let mobileTargetPool: Pool | null = null;
  let projectAdministrationPool: Pool | null = null;
  let redemptionInterruption: SyntheticRedemptionInterruptionController | null = null;
  let apiServer: ReturnType<typeof createBackendHttpServer> | null = null;
  let da5V5DedupeWindow: Da5V5DedupeWindowController | null = null;
  let da5V5CapabilityClosed = false;
  const cleanupDatabase = async (): Promise<void> => {
    if (profile === DA5_V5_PROFILE) {
      return;
    }
    const pool = installerPool;
    if (pool !== null) {
      await cleanSyntheticDatabase(
        pool,
        profile === DA4_V5_PROFILE ? DA4_V5_PROFILE : undefined,
      );
    }
  };
  const closeInstallerOrCapability = async (): Promise<void> => {
    if (profile === DA5_V5_PROFILE) {
      if (!da5V5CapabilityClosed) {
        await closeDa5V5PostgresCapability(
          databaseInput.da5V5PostgresCapability as Da5V5PostgresCapability,
        );
        da5V5CapabilityClosed = true;
      }
      return;
    }
    const pool = installerPool;
    installerPool = null;
    await pool?.end();
  };

  try {
    await auth.start();
    const database = profile === DA5_V5_PROFILE
      ? null
      : await prepareSyntheticDatabase(
          installerPool as Pool,
          databaseInput.installerDatabaseUrl as string,
          auth.issuer,
          profile,
        );
    if (profile === DA5_V5_PROFILE) {
      const prepared = await prepareDa5V5SyntheticDatabase(
        databaseInput.da5V5PostgresCapability as Da5V5PostgresCapability,
        auth.issuer,
        options.da5V5PostgresSource ?? 'isolated-runtime-guard',
      );
      installerPool = prepared.fixturePool;
      if (options.onDa5V5FixtureOperations !== undefined) {
        if (process.env.NODE_ENV !== 'test') {
          throw new Error('DA5 V5 fixture operation hook is test-only');
        }
        options.onDa5V5FixtureOperations(prepared.fixturePool);
      }
      sessionPool = prepared.runtimePools.session;
      readModelPool = prepared.runtimePools.readModel;
      lifecyclePool = prepared.runtimePools.lifecycle;
      administrationPool = prepared.runtimePools.administration;
      employeeInvitationPool = prepared.runtimePools.employeeInvitation;
      employeeEnrollmentPool = prepared.runtimePools.employeeEnrollment;
      reassignmentPool = prepared.runtimePools.reassignment;
      offlineLeasePool = prepared.runtimePools.offlineLease;
      offlineEventPool = prepared.runtimePools.offlineEvent;
      offlineReconciliationPool = prepared.runtimePools.offlineReconciliation;
      timeEntryExportPool = prepared.runtimePools.timeEntryExport;
      timeReviewReadPool = prepared.runtimePools.timeReviewRead;
      timeReviewWritePool = prepared.runtimePools.timeReviewWrite;
      manualLifecyclePool = prepared.da5V5RuntimePools.manualLifecycle;
      mobileOwnTimePool = prepared.da5V5RuntimePools.mobileOwnTime;
      mobileTargetPool = prepared.da5V5RuntimePools.mobileTarget;
      projectAdministrationPool =
        prepared.da5V5RuntimePools.projectAdministration;
    } else {
      const connections = database?.connectionStrings;
      if (connections === undefined) {
        throw new Error('Synthetic database runtimes are unavailable');
      }
      sessionPool = createPool(connections.session);
      readModelPool = createPool(connections.readModel);
      lifecyclePool = createPool(connections.lifecycle);
      administrationPool = createPool(connections.administration);
      employeeInvitationPool = createPool(connections.employeeInvitation);
      employeeEnrollmentPool = createPool(connections.employeeEnrollment);
      reassignmentPool = createPool(connections.reassignment);
      offlineLeasePool = createPool(connections.offlineLease);
      offlineEventPool = createPool(connections.offlineEvent);
      offlineReconciliationPool = createPool(connections.offlineReconciliation);
      timeEntryExportPool = createPool(connections.timeEntryExport);
      timeReviewReadPool = createPool(connections.timeReviewRead);
      timeReviewWritePool = createPool(connections.timeReviewWrite);
      provisionerPool = createPool(connections.provisioner, 1);
    }
    const privilegedPool = installerPool;
    if (privilegedPool === null) {
      throw new Error('Synthetic installer capability is unavailable');
    }

    const verifier = SupabaseJwtAccessTokenVerifier.fromRemoteJwks({
      issuer: auth.issuer,
      jwksUrl: new URL(`${auth.issuer}/.well-known/jwks.json`),
      allowedAlgorithms: ['RS256'],
    });
    const realScanContext = new B5ScanContextResolver(
      new TenantReadSessionCoordinator(readModelPool, verifier),
    );
    const provisioningScanContext = provisionerPool === null
      ? null
      : new FingerprintProvisioningScanContextResolver(
          realScanContext,
          provisionerPool,
          onSafeEvent,
        );
    const da5V5ScanContext = da5V5Binding === undefined
      ? null
      : new Da5V5ScanContextResolver(
          realScanContext,
          privilegedPool,
          da5V5Binding,
          onSafeEvent,
        );
    const scanContextResolver: ScanContextResolver = da5V5ScanContext ?? provisioningScanContext
      ?? failMissingScanContextResolver();
    const lifecycleCoordinator = new ServerCanonicalLifecycleIngestionCoordinator(
      lifecyclePool,
      verifier,
    );
    const manualLifecycleCoordinator = manualLifecyclePool === null
      ? undefined
      : new ManualLifecycleIngestionCoordinator(manualLifecyclePool, verifier);
    const mobileOwnTimeCursorHmacKey = profile === DA5_V5_PROFILE
      ? randomBytes(32).toString('base64url')
      : undefined;
    const mobileWorkReader = (
      mobileOwnTimePool === null
      || mobileTargetPool === null
      || mobileOwnTimeCursorHmacKey === undefined
    )
      ? undefined
      : new MobileWorkReadCoordinator(
          mobileOwnTimePool,
          mobileTargetPool,
          verifier,
          mobileOwnTimeCursorHmacKey,
        );
    const projectAdministration = projectAdministrationPool === null
      ? undefined
      : new ProjectAdministrationCoordinator(projectAdministrationPool, verifier);
    const employeeEnrollmentCoordinator = new EmployeeMembershipEnrollmentCoordinator(
      employeeInvitationPool,
      employeeEnrollmentPool,
      verifier,
    );
    const interruptionController = new SyntheticRedemptionInterruptionController(onSafeEvent);
    redemptionInterruption = interruptionController;
    const employeeEnrollment = composeSyntheticEmployeeEnrollmentInterruption(
      employeeEnrollmentCoordinator,
      interruptionController,
    );
    apiServer = createBackendHttpServer(
      {
        sessionAuthority: new B4SessionAuthorityResolver(
          verifier,
          new PostgresIdentityMembershipResolver(sessionPool),
        ),
        scanContextResolver,
        lifecycleIngestor: lifecycleCoordinator,
        deferredLifecycleIngestor: lifecycleCoordinator,
        offlineCaptureLeaseIssuer: new OfflineCaptureLeaseCoordinator(
          offlineLeasePool,
          verifier,
        ),
        offlineLifecycleIngestor: new OfflineLifecycleIngestionCoordinator(
          offlineEventPool,
          verifier,
        ),
        offlineEventReconciliationReader: new OfflineEventReconciliationCoordinator(
          offlineReconciliationPool,
          verifier,
        ),
        administration: new AdminWriteSessionCoordinator(administrationPool, verifier),
        employeeEnrollment,
        tagReassignment: new NfcTagReassignmentCoordinator(reassignmentPool, verifier),
        timeEntryExporter: new TimeEntryExportCoordinator(timeEntryExportPool, verifier),
        timeReview: new TimeReviewCoordinator(
          timeReviewReadPool,
          timeReviewWritePool,
          verifier,
        ),
        ...(manualLifecycleCoordinator === undefined ? {} : {
          manualLifecycleIngestor: manualLifecycleCoordinator,
        }),
        ...(mobileWorkReader === undefined ? {} : { mobileWorkReader }),
        ...(projectAdministration === undefined ? {} : { projectAdministration }),
      },
      {
        onDiagnostic(diagnostic) {
          switch (diagnostic.code) {
            case 'administration_failed':
              onSafeEvent('api_administration_unavailable');
              return;
            case 'employee_enrollment_failed':
              onSafeEvent('api_employee_enrollment_unavailable');
              return;
            case 'lifecycle_ingestion_failed':
              onSafeEvent('api_lifecycle_unavailable');
              return;
            case 'mobile_work_failed':
              onSafeEvent('api_mobile_work_unavailable');
              return;
            case 'offline_synchronization_failed':
              onSafeEvent('api_offline_synchronization_unavailable');
              return;
            case 'scan_context_resolution_failed':
              onSafeEvent('api_scan_context_unavailable');
              return;
            case 'session_resolution_failed':
              onSafeEvent('api_session_unavailable');
              return;
            case 'time_entry_export_failed':
              onSafeEvent('api_time_entry_export_unavailable');
              return;
            case 'time_review_failed':
              onSafeEvent('api_time_review_unavailable');
              return;
            default:
              return diagnostic.code satisfies never;
          }
        },
      },
    );
    const apiPort = validatePort(options.apiPort ?? 3_000);
    await listenLoopback(apiServer, apiPort);
    const address = apiServer.address();
    if (address === null || typeof address === 'string') {
      throw new Error('Synthetic C2 API did not expose a TCP port');
    }
    const dedupeWindow = profile === DA5_V5_PROFILE
      ? new Da5V5DedupeWindowController(privilegedPool)
      : null;
    da5V5DedupeWindow = dedupeWindow;
    const protectedReviewFixture = da5V5Binding === undefined
      ? null
      : new Da5V5ProtectedReviewFixture(privilegedPool, da5V5Binding);
    const activeApiServer = apiServer;
    const pools = [
      sessionPool,
      readModelPool,
      lifecyclePool,
      administrationPool,
      employeeInvitationPool,
      employeeEnrollmentPool,
      reassignmentPool,
      offlineLeasePool,
      offlineEventPool,
      offlineReconciliationPool,
      timeEntryExportPool,
      timeReviewReadPool,
      timeReviewWritePool,
      ...[
        provisionerPool,
        manualLifecyclePool,
        mobileOwnTimePool,
        mobileTargetPool,
        projectAdministrationPool,
      ].filter((pool): pool is Pool => pool !== null),
    ] as const;
    let closeState:
      | 'active'
      | 'closing'
      | 'cleanup-incomplete'
      | 'closed' = 'active';
    const completedDa5CloseStages = new Set<string>();
    let da5ClosePromise: Promise<void> | null = null;
    const closeDa5Environment = async (): Promise<void> => {
      let firstFailure: unknown;
      const stage = async (
        name: string,
        action: () => Promise<void> | void,
      ): Promise<void> => {
        if (completedDa5CloseStages.has(name)) {
          return;
        }
        try {
          await action();
          completedDa5CloseStages.add(name);
        } catch (error: unknown) {
          firstFailure ??= error;
        }
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
      await stage('dedupe-window', async () => dedupeWindow?.destroy());
      await stage('interruption', async () => interruptionController.close());
      await stage('api-server', async () => closeServer(activeApiServer));
      for (const [index, pool] of pools.entries()) {
        await stage(`pool-${index}`, async () => closePool(pool));
      }
      await stage('auth', async () => auth.close());
      await stage('capability-owner', closeInstallerOrCapability);
      if (firstFailure !== undefined) {
        throw new Da5V5CleanupError();
      }
    };
    return Object.freeze({
      apiBaseUrl: `http://127.0.0.1:${address.port}`,
      administratorEmail: SYNTHETIC_ADMIN_AUTH_EMAIL,
      authBaseUrl: auth.publicUrl,
      email: SYNTHETIC_AUTH_EMAIL,
      employeeEmail: SYNTHETIC_AUTH_EMAIL,
      enrollmentEmail: SYNTHETIC_ENROLLMENT_AUTH_EMAIL,
      publishableKey: SYNTHETIC_PUBLISHABLE_KEY,
      secondEnrollmentEmail: SYNTHETIC_SECOND_ENROLLMENT_AUTH_EMAIL,
      abortPausedRedemption: () => interruptionController.abortPausedRedemption(),
      armTagA: (expectedFingerprint: string) => {
        if (provisioningScanContext === null) {
          throw new Error('DA5 V5 requires real Administrator setup for Tag A');
        }
        provisioningScanContext.armTagA(expectedFingerprint);
      },
      armNextRedemptionInterruption: () => {
        interruptionController.armNextRedemptionInterruption();
      },
      employeeEnrollmentEvidenceCounts: () => (
        readSyntheticEmployeeEnrollmentEvidenceCounts(privilegedPool)
      ),
      redemptionInterruptionState: () => interruptionController.getState(),
      provisioningState: () => {
        if (provisioningScanContext === null) {
          throw new Error('Legacy synthetic provisioning is not active');
        }
        return provisioningScanContext.getState();
      },
      evidenceCounts: () => readSyntheticEvidenceCounts(privilegedPool),
      timeReviewEvidenceCounts: () => readSyntheticTimeReviewEvidenceCounts(privilegedPool),
      da4V5FixtureManifest: () => {
        if (profile !== DA4_V5_PROFILE) {
          return Promise.reject(new Error('DA4 V5 profile is not active'));
        }
        return readDa4V5FixtureManifest(privilegedPool);
      },
      da4V5Status: () => {
        if (profile !== DA4_V5_PROFILE) {
          return Promise.reject(new Error('DA4 V5 profile is not active'));
        }
        return readDa4V5Status(privilegedPool);
      },
      armDa5V5TagBRegistration: async () => {
        if (da5V5ScanContext === null) {
          throw new Error('DA5 V5 profile is not active');
        }
        const [status, tagRoles] = await Promise.all([
          readDa5V5Status(privilegedPool),
          da5V5ScanContext.roleState(),
        ]);
        if (!da5V5TagBRegistrationPreconditionMatches(status, tagRoles)) {
          throw new Error('DA5 V5 Tag B registration precondition mismatch');
        }
        da5V5ScanContext.armTagBRegistration();
      },
      da5V5CaptureDedupeWindow: (
        phase: Da5V5DedupePhase,
        binding: Da5V5DedupeBinding,
      ) => {
        if (dedupeWindow === null) {
          return Promise.resolve<'mismatch'>('mismatch');
        }
        return dedupeWindow.capture(phase, binding);
      },
      da5V5CheckDedupeWindow: (
        phase: Da5V5DedupePhase,
        binding: Da5V5DedupeBinding,
      ) => {
        if (dedupeWindow === null) {
          return Promise.resolve<'mismatch'>('mismatch');
        }
        return dedupeWindow.check(phase, binding);
      },
      da5V5DedupeState: () => {
        if (dedupeWindow === null) {
          throw new Error('DA5 V5 profile is not active');
        }
        return dedupeWindow.state();
      },
      da5V5FixtureArm: async (deviceQueueItems: number) => {
        if (protectedReviewFixture === null) {
          return 'mismatch';
        }
        return protectedReviewFixture.arm(
          await readDa5V5Status(privilegedPool),
          deviceQueueItems,
        );
      },
      da5V5FixtureActivateTagB: () => {
        if (protectedReviewFixture === null) {
          return Promise.resolve<'mismatch'>('mismatch');
        }
        return protectedReviewFixture.activateTagB();
      },
      da5V5FixtureCutoverTagA: () => {
        if (protectedReviewFixture === null) {
          return Promise.resolve<'mismatch'>('mismatch');
        }
        return protectedReviewFixture.cutoverTagA();
      },
      da5V5FixtureMarkTerminal: async () => {
        if (protectedReviewFixture === null || da5V5Binding === undefined) {
          return 'mismatch';
        }
        const [status, invariants] = await Promise.all([
          readDa5V5Status(privilegedPool),
          readDa5V5InvariantStatus(privilegedPool, da5V5Binding),
        ]);
        return protectedReviewFixture.markTerminal(status, invariants);
      },
      da5V5FixtureState: () => {
        if (protectedReviewFixture === null) {
          throw new Error('DA5 V5 profile is not active');
        }
        return protectedReviewFixture.state();
      },
      da5V5Status: () => {
        if (profile !== DA5_V5_PROFILE) {
          return Promise.reject(new Error('DA5 V5 profile is not active'));
        }
        return readDa5V5Status(privilegedPool);
      },
      da5V5InvariantStatus: () => {
        if (profile !== DA5_V5_PROFILE || da5V5Binding === undefined) {
          return Promise.reject(new Error('DA5 V5 profile is not active'));
        }
        return readDa5V5InvariantStatus(privilegedPool, da5V5Binding);
      },
      da5V5TagRegistrationState: () => {
        if (da5V5ScanContext === null) {
          throw new Error('DA5 V5 profile is not active');
        }
        return da5V5ScanContext.state();
      },
      da5V5TagRoleState: () => {
        if (da5V5ScanContext === null) {
          return Promise.reject(new Error('DA5 V5 profile is not active'));
        }
        return da5V5ScanContext.roleState();
      },
      async close(): Promise<void> {
        if (closeState === 'closed') {
          return;
        }
        if (profile === DA5_V5_PROFILE) {
          if (da5ClosePromise !== null) {
            return da5ClosePromise;
          }
          closeState = 'closing';
          const activeClose = closeDa5Environment();
          da5ClosePromise = activeClose;
          try {
            await activeClose;
            closeState = 'closed';
          } catch (error: unknown) {
            closeState = 'cleanup-incomplete';
            throw error;
          } finally {
            da5ClosePromise = null;
          }
          return;
        }
        if (closeState !== 'active') {
          throw new Da5V5CleanupError();
        }
        closeState = 'closing';
        try {
          if (profile === DA4_V5_PROFILE) {
            await runDa4V5StrictCleanup({
              closeResources: [
                async () => interruptionController.close(),
                () => closeServer(activeApiServer),
                ...pools.map((pool) => () => pool.end()),
                () => auth.close(),
              ],
              closeDatabase: cleanupDatabase,
              closeInstaller: closeInstallerOrCapability,
            });
          } else {
            interruptionController.close();
            await Promise.allSettled([
              closeServer(activeApiServer),
              ...pools.map((pool) => pool.end()),
              auth.close(),
            ]);
            try {
              await cleanupDatabase();
            } finally {
              await closeInstallerOrCapability();
            }
          }
          closeState = 'closed';
        } catch (error) {
          closeState = 'cleanup-incomplete';
          throw error;
        }
      },
    });
  } catch (error) {
    if (profile === DA5_V5_PROFILE) {
      const cleanupResult = await settle(() => runDa5V5StrictCleanup({
        closeResources: [
          async () => da5V5DedupeWindow?.destroy(),
          async () => redemptionInterruption?.close(),
          () => apiServer === null ? Promise.resolve() : closeServer(apiServer),
          () => sessionPool?.end() ?? Promise.resolve(),
          () => readModelPool?.end() ?? Promise.resolve(),
          () => lifecyclePool?.end() ?? Promise.resolve(),
          () => administrationPool?.end() ?? Promise.resolve(),
          () => employeeInvitationPool?.end() ?? Promise.resolve(),
          () => employeeEnrollmentPool?.end() ?? Promise.resolve(),
          () => reassignmentPool?.end() ?? Promise.resolve(),
          () => offlineLeasePool?.end() ?? Promise.resolve(),
          () => offlineEventPool?.end() ?? Promise.resolve(),
          () => offlineReconciliationPool?.end() ?? Promise.resolve(),
          () => timeEntryExportPool?.end() ?? Promise.resolve(),
          () => timeReviewReadPool?.end() ?? Promise.resolve(),
          () => timeReviewWritePool?.end() ?? Promise.resolve(),
          () => provisionerPool?.end() ?? Promise.resolve(),
          () => manualLifecyclePool?.end() ?? Promise.resolve(),
          () => mobileOwnTimePool?.end() ?? Promise.resolve(),
          () => mobileTargetPool?.end() ?? Promise.resolve(),
          () => projectAdministrationPool?.end() ?? Promise.resolve(),
          () => auth.close(),
        ],
        closeCapabilityOwner: closeInstallerOrCapability,
      }));
      if (cleanupResult.status === 'rejected') {
        throw da5V5StartupCleanupIncomplete(error);
      }
      throw error;
    }
    if (profile === DA4_V5_PROFILE) {
      await runDa4V5StrictCleanup({
        closeResources: [
          async () => redemptionInterruption?.close(),
          () => apiServer === null ? Promise.resolve() : closeServer(apiServer),
          () => sessionPool?.end() ?? Promise.resolve(),
          () => readModelPool?.end() ?? Promise.resolve(),
          () => lifecyclePool?.end() ?? Promise.resolve(),
          () => administrationPool?.end() ?? Promise.resolve(),
          () => employeeInvitationPool?.end() ?? Promise.resolve(),
          () => employeeEnrollmentPool?.end() ?? Promise.resolve(),
          () => reassignmentPool?.end() ?? Promise.resolve(),
          () => offlineLeasePool?.end() ?? Promise.resolve(),
          () => offlineEventPool?.end() ?? Promise.resolve(),
          () => offlineReconciliationPool?.end() ?? Promise.resolve(),
          () => timeEntryExportPool?.end() ?? Promise.resolve(),
          () => timeReviewReadPool?.end() ?? Promise.resolve(),
          () => timeReviewWritePool?.end() ?? Promise.resolve(),
          () => provisionerPool?.end() ?? Promise.resolve(),
          () => auth.close(),
        ],
        closeDatabase: cleanupDatabase,
        closeInstaller: closeInstallerOrCapability,
      });
      throw error;
    }
    redemptionInterruption?.close();
    await Promise.allSettled([
      apiServer === null ? Promise.resolve() : closeServer(apiServer),
      sessionPool?.end() ?? Promise.resolve(),
      readModelPool?.end() ?? Promise.resolve(),
      lifecyclePool?.end() ?? Promise.resolve(),
      administrationPool?.end() ?? Promise.resolve(),
      employeeInvitationPool?.end() ?? Promise.resolve(),
      employeeEnrollmentPool?.end() ?? Promise.resolve(),
      reassignmentPool?.end() ?? Promise.resolve(),
      offlineLeasePool?.end() ?? Promise.resolve(),
      offlineEventPool?.end() ?? Promise.resolve(),
      offlineReconciliationPool?.end() ?? Promise.resolve(),
      timeEntryExportPool?.end() ?? Promise.resolve(),
      timeReviewReadPool?.end() ?? Promise.resolve(),
      timeReviewWritePool?.end() ?? Promise.resolve(),
      provisionerPool?.end() ?? Promise.resolve(),
      manualLifecyclePool?.end() ?? Promise.resolve(),
      mobileOwnTimePool?.end() ?? Promise.resolve(),
      mobileTargetPool?.end() ?? Promise.resolve(),
      projectAdministrationPool?.end() ?? Promise.resolve(),
      auth.close(),
    ]);
    try {
      await cleanupDatabase();
    } catch {
      // Preserve the original startup failure; cleanup is best effort only.
    }
    await closeInstallerOrCapability();
    throw error;
  }
}

interface SyntheticDatabaseInput {
  readonly installerDatabaseUrl?: string;
  readonly da5V5PostgresCapability?: Da5V5PostgresCapability;
}

function resolveSyntheticDatabaseInput(
  profile: typeof DA4_V5_PROFILE | typeof DA5_V5_PROFILE | undefined,
  options: SyntheticAndroidE2eEnvironmentOptions,
): SyntheticDatabaseInput {
  if (profile === DA5_V5_PROFILE) {
    if (options.installerDatabaseUrl !== undefined) {
      throw new Error('DA5 V5 rejects operator-supplied database URLs');
    }
    if (options.da5V5PostgresCapability === undefined) {
      throw new Error('DA5 V5 requires an isolated PostgreSQL capability');
    }
    return Object.freeze({
      da5V5PostgresCapability: options.da5V5PostgresCapability,
    });
  }
  if (options.da5V5PostgresCapability !== undefined) {
    throw new Error('The isolated PostgreSQL capability requires the exact DA5 V5 profile');
  }
  if (options.installerDatabaseUrl === undefined) {
    throw new Error('Synthetic E2E requires an installer database URL');
  }
  validateSyntheticInstallerDatabaseUrl(options.installerDatabaseUrl);
  return Object.freeze({
    installerDatabaseUrl: options.installerDatabaseUrl,
  });
}

function validateSyntheticEnvironmentProfile(
  value: unknown,
): typeof DA4_V5_PROFILE | typeof DA5_V5_PROFILE | undefined {
  if (value === undefined || value === DA4_V5_PROFILE || value === DA5_V5_PROFILE) {
    return value;
  }
  throw new Error('Unknown synthetic E2E profile');
}

function resolveDa5V5TagBinding(
  profile: typeof DA4_V5_PROFILE | typeof DA5_V5_PROFILE | undefined,
  binding: Da5V5TagBinding | undefined,
): Da5V5TagBinding | undefined {
  if (profile !== DA5_V5_PROFILE) {
    if (binding !== undefined) {
      throw new Error('DA5 V5 Tag binding requires the exact DA5 V5 profile');
    }
    return undefined;
  }
  if (binding === undefined) {
    throw new Error('DA5 V5 requires an exact disclosure-safe Tag binding');
  }
  return validateDa5V5TagBinding(binding);
}

function failMissingScanContextResolver(): never {
  throw new Error('Synthetic scan-context resolver is unavailable');
}

async function settle(action: () => Promise<void>): Promise<PromiseSettledResult<void>> {
  try {
    await action();
    return { status: 'fulfilled', value: undefined };
  } catch (reason) {
    return { status: 'rejected', reason };
  }
}

export function composeSyntheticEmployeeEnrollmentInterruption(
  delegate: EmployeeEnrollmentPort,
  interruption: SyntheticRedemptionInterruptionController,
): EmployeeEnrollmentPort {
  const composed: EmployeeEnrollmentPort = {
    createInvitation: (command, controls) => delegate.createInvitation(command, controls),
    readEmployeeMembershipsProjection: (command, controls) => (
      delegate.readEmployeeMembershipsProjection(command, controls)
    ),
    async redeemInvitation(command, controls = {}) {
      const interruptionAttempt = interruption.beginRedemptionAttempt();
      try {
        return await delegate.redeemInvitation(command, {
          ...controls,
          beforeCommit: async () => {
            await controls.beforeCommit?.();
            await interruptionAttempt.beforeCommit();
          },
        });
      } finally {
        interruptionAttempt.finish();
      }
    },
  };
  return Object.freeze(composed);
}

function createPool(connectionString: string, max: number = 4): Pool {
  return new Pool({
    connectionString,
    max,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
    query_timeout: 5_000,
    statement_timeout: 5_000,
  });
}

function validatePort(value: number): number {
  if (!Number.isInteger(value) || value < 0 || value > 65_535) {
    throw new Error('Synthetic E2E port must be an integer between 0 and 65535');
  }
  return value;
}

async function listenLoopback(
  server: ReturnType<typeof createBackendHttpServer>,
  port: number,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
}

async function closeServer(server: ReturnType<typeof createBackendHttpServer>): Promise<void> {
  if (!server.listening) {
    return;
  }
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error === undefined ? resolve() : reject(error));
  });
}

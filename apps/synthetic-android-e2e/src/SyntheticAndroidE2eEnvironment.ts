import {
  B4SessionAuthorityResolver,
  B5ScanContextResolver,
  createBackendHttpServer,
  type EmployeeMembershipEnrollmentCoordinator as EmployeeEnrollmentPort,
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
import { ServerCanonicalLifecycleIngestionCoordinator } from '@taptime/backend-lifecycle';
import { TenantReadSessionCoordinator } from '@taptime/backend-read-model';
import { Pool } from 'pg';
import {
  SYNTHETIC_ADMIN_AUTH_EMAIL,
  SYNTHETIC_AUTH_EMAIL,
  SYNTHETIC_ENROLLMENT_AUTH_EMAIL,
  SYNTHETIC_PUBLISHABLE_KEY,
  SYNTHETIC_SECOND_ENROLLMENT_AUTH_EMAIL,
} from './constants.js';
import {
  cleanSyntheticDatabase,
  prepareSyntheticDatabase,
  readSyntheticEmployeeEnrollmentEvidenceCounts,
  readSyntheticEvidenceCounts,
  type SyntheticEmployeeEnrollmentEvidenceCounts,
  type SyntheticEvidenceCounts,
} from './database.js';
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
  | 'api_administration_unavailable'
  | 'api_employee_enrollment_unavailable'
  | 'api_lifecycle_unavailable'
  | 'api_scan_context_unavailable'
  | 'api_session_unavailable';

export interface SyntheticAndroidE2eEnvironmentOptions {
  readonly apiPort?: number;
  readonly authPort?: number;
  readonly installerDatabaseUrl: string;
  readonly password: string;
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
  close(): Promise<void>;
}

export async function createSyntheticAndroidE2eEnvironment(
  options: SyntheticAndroidE2eEnvironmentOptions,
): Promise<SyntheticAndroidE2eEnvironment> {
  const onSafeEvent = options.onSafeEvent ?? (() => undefined);
  const auth = await SyntheticLocalAuthServer.create({
    password: options.password,
    port: validatePort(options.authPort ?? 54_321),
  });
  const installerPool = createPool(options.installerDatabaseUrl, 2);
  let sessionPool: Pool | null = null;
  let readModelPool: Pool | null = null;
  let lifecyclePool: Pool | null = null;
  let administrationPool: Pool | null = null;
  let employeeInvitationPool: Pool | null = null;
  let employeeEnrollmentPool: Pool | null = null;
  let reassignmentPool: Pool | null = null;
  let provisionerPool: Pool | null = null;
  let redemptionInterruption: SyntheticRedemptionInterruptionController | null = null;
  let apiServer: ReturnType<typeof createBackendHttpServer> | null = null;

  try {
    await auth.start();
    const database = await prepareSyntheticDatabase(
      installerPool,
      options.installerDatabaseUrl,
      auth.issuer,
    );
    sessionPool = createPool(database.connectionStrings.session);
    readModelPool = createPool(database.connectionStrings.readModel);
    lifecyclePool = createPool(database.connectionStrings.lifecycle);
    administrationPool = createPool(database.connectionStrings.administration);
    employeeInvitationPool = createPool(database.connectionStrings.employeeInvitation);
    employeeEnrollmentPool = createPool(database.connectionStrings.employeeEnrollment);
    reassignmentPool = createPool(database.connectionStrings.reassignment);
    provisionerPool = createPool(database.connectionStrings.provisioner, 1);

    const verifier = SupabaseJwtAccessTokenVerifier.fromRemoteJwks({
      issuer: auth.issuer,
      jwksUrl: new URL(`${auth.issuer}/.well-known/jwks.json`),
      allowedAlgorithms: ['RS256'],
    });
    const realScanContext = new B5ScanContextResolver(
      new TenantReadSessionCoordinator(readModelPool, verifier),
    );
    const provisioningScanContext = new FingerprintProvisioningScanContextResolver(
      realScanContext,
      provisionerPool,
      onSafeEvent,
    );
    const lifecycleCoordinator = new ServerCanonicalLifecycleIngestionCoordinator(
      lifecyclePool,
      verifier,
    );
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
        scanContextResolver: provisioningScanContext,
        lifecycleIngestor: lifecycleCoordinator,
        deferredLifecycleIngestor: lifecycleCoordinator,
        administration: new AdminWriteSessionCoordinator(administrationPool, verifier),
        employeeEnrollment,
        tagReassignment: new NfcTagReassignmentCoordinator(reassignmentPool, verifier),
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
            case 'scan_context_resolution_failed':
              onSafeEvent('api_scan_context_unavailable');
              return;
            case 'session_resolution_failed':
              onSafeEvent('api_session_unavailable');
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
    const activeApiServer = apiServer;
    const pools = [
      sessionPool,
      readModelPool,
      lifecyclePool,
      administrationPool,
      employeeInvitationPool,
      employeeEnrollmentPool,
      reassignmentPool,
      provisionerPool,
    ] as const;
    let closed = false;
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
        provisioningScanContext.armTagA(expectedFingerprint);
      },
      armNextRedemptionInterruption: () => {
        interruptionController.armNextRedemptionInterruption();
      },
      employeeEnrollmentEvidenceCounts: () => (
        readSyntheticEmployeeEnrollmentEvidenceCounts(installerPool)
      ),
      redemptionInterruptionState: () => interruptionController.getState(),
      provisioningState: () => provisioningScanContext.getState(),
      evidenceCounts: () => readSyntheticEvidenceCounts(installerPool),
      async close(): Promise<void> {
        if (closed) {
          return;
        }
        closed = true;
        interruptionController.close();
        await Promise.allSettled([
          closeServer(activeApiServer),
          ...pools.map((pool) => pool.end()),
          auth.close(),
        ]);
        try {
          await cleanSyntheticDatabase(installerPool);
        } finally {
          await installerPool.end();
        }
      },
    });
  } catch (error) {
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
      provisionerPool?.end() ?? Promise.resolve(),
      auth.close(),
    ]);
    try {
      await cleanSyntheticDatabase(installerPool);
    } catch {
      // Preserve the original startup failure; cleanup is best effort only.
    }
    await installerPool.end();
    throw error;
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

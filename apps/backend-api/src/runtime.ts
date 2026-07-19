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
import {
  OfflineCaptureLeaseCoordinator,
  OfflineEventReconciliationCoordinator,
  OfflineLifecycleIngestionCoordinator,
} from '@taptime/backend-offline-sync';
import { TenantReadSessionCoordinator } from '@taptime/backend-read-model';
import { Pool } from 'pg';
import { B4SessionAuthorityResolver } from './B4SessionAuthorityResolver.js';
import { B5ScanContextResolver } from './B5ScanContextResolver.js';
import {
  createBackendHttpServer,
  type BackendHttpServerOptions,
} from './BackendHttpServer.js';

export interface BackendApiRuntimeConfiguration {
  readonly sessionDatabaseUrl: string;
  readonly readModelDatabaseUrl: string;
  readonly lifecycleDatabaseUrl: string;
  readonly administrationDatabaseUrl: string;
  readonly employeeInvitationDatabaseUrl: string;
  readonly employeeEnrollmentDatabaseUrl: string;
  readonly reassignmentDatabaseUrl: string;
  readonly offlineLeaseDatabaseUrl: string;
  readonly offlineEventDatabaseUrl: string;
  readonly offlineReconciliationDatabaseUrl: string;
  readonly supabaseIssuer: string;
}

export interface BackendApiRuntime {
  readonly server: ReturnType<typeof createBackendHttpServer>;
  close(): Promise<void>;
}

interface ValidatedDatabaseUrl {
  readonly connectionString: string;
  readonly username: string;
}

const allowedDatabaseUrlParameters = new Set([
  'sslcert',
  'sslkey',
  'sslmode',
  'sslnegotiation',
  'sslrootcert',
  'uselibpqcompat',
]);

export function createBackendApiRuntime(
  configuration: BackendApiRuntimeConfiguration,
  options: BackendHttpServerOptions = {},
): BackendApiRuntime {
  const sessionDatabase = validateDatabaseUrl(configuration.sessionDatabaseUrl);
  const readModelDatabase = validateDatabaseUrl(configuration.readModelDatabaseUrl);
  const lifecycleDatabase = validateDatabaseUrl(configuration.lifecycleDatabaseUrl);
  const administrationDatabase = validateDatabaseUrl(configuration.administrationDatabaseUrl);
  const employeeInvitationDatabase = validateDatabaseUrl(configuration.employeeInvitationDatabaseUrl);
  const employeeEnrollmentDatabase = validateDatabaseUrl(configuration.employeeEnrollmentDatabaseUrl);
  const reassignmentDatabase = validateDatabaseUrl(configuration.reassignmentDatabaseUrl);
  const offlineLeaseDatabase = validateDatabaseUrl(configuration.offlineLeaseDatabaseUrl);
  const offlineEventDatabase = validateDatabaseUrl(configuration.offlineEventDatabaseUrl);
  const offlineReconciliationDatabase = validateDatabaseUrl(
    configuration.offlineReconciliationDatabaseUrl,
  );
  assertDistinctDatabaseUsers([
    sessionDatabase,
    readModelDatabase,
    lifecycleDatabase,
    administrationDatabase,
    employeeInvitationDatabase,
    employeeEnrollmentDatabase,
    reassignmentDatabase,
    offlineLeaseDatabase,
    offlineEventDatabase,
    offlineReconciliationDatabase,
  ]);

  const issuer = configuration.supabaseIssuer.replace(/\/+$/, '');
  const verifier = SupabaseJwtAccessTokenVerifier.fromRemoteJwks({
    issuer,
    jwksUrl: new URL(`${issuer}/.well-known/jwks.json`),
    allowedAlgorithms: ['ES256', 'RS256'],
  });

  const sessionPool = createRuntimePool(sessionDatabase.connectionString);
  const readModelPool = createRuntimePool(readModelDatabase.connectionString);
  const lifecyclePool = createRuntimePool(lifecycleDatabase.connectionString);
  const administrationPool = createRuntimePool(administrationDatabase.connectionString);
  const employeeInvitationPool = createRuntimePool(employeeInvitationDatabase.connectionString);
  const employeeEnrollmentPool = createRuntimePool(employeeEnrollmentDatabase.connectionString);
  const reassignmentPool = createRuntimePool(reassignmentDatabase.connectionString);
  const offlineLeasePool = createRuntimePool(offlineLeaseDatabase.connectionString);
  const offlineEventPool = createRuntimePool(offlineEventDatabase.connectionString);
  const offlineReconciliationPool = createRuntimePool(
    offlineReconciliationDatabase.connectionString,
  );
  const lifecycleCoordinator = new ServerCanonicalLifecycleIngestionCoordinator(
    lifecyclePool,
    verifier,
  );
  const server = createBackendHttpServer(
    {
      sessionAuthority: new B4SessionAuthorityResolver(
        verifier,
        new PostgresIdentityMembershipResolver(sessionPool),
      ),
      scanContextResolver: new B5ScanContextResolver(
        new TenantReadSessionCoordinator(readModelPool, verifier),
      ),
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
      employeeEnrollment: new EmployeeMembershipEnrollmentCoordinator(
        employeeInvitationPool,
        employeeEnrollmentPool,
        verifier,
      ),
      tagReassignment: new NfcTagReassignmentCoordinator(reassignmentPool, verifier),
    },
    options,
  );

  return Object.freeze({
    server,
    async close(): Promise<void> {
      let serverCloseFailure: unknown;
      if (server.listening) {
        try {
          await new Promise<void>((resolve, reject) => {
            server.close((error) => error === undefined ? resolve() : reject(error));
          });
        } catch (error) {
          serverCloseFailure = error;
        }
      }
      const results = await Promise.allSettled([
        sessionPool.end(),
        readModelPool.end(),
        lifecyclePool.end(),
        administrationPool.end(),
        employeeInvitationPool.end(),
        employeeEnrollmentPool.end(),
        reassignmentPool.end(),
        offlineLeasePool.end(),
        offlineEventPool.end(),
        offlineReconciliationPool.end(),
      ]);
      const failure = results.find(
        (result): result is PromiseRejectedResult => result.status === 'rejected',
      );
      if (serverCloseFailure !== undefined) {
        throw serverCloseFailure;
      }
      if (failure !== undefined) {
        throw failure.reason;
      }
    },
  });
}

function createRuntimePool(connectionString: string): Pool {
  return new Pool({
    connectionString,
    max: 10,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
    query_timeout: 5_000,
    statement_timeout: 5_000,
  });
}

function validateDatabaseUrl(value: string): ValidatedDatabaseUrl {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Backend API database URL must be an absolute PostgreSQL URL');
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hostname.length === 0) {
    throw new Error('Backend API database URL must use PostgreSQL with an explicit host');
  }
  for (const parameter of url.searchParams.keys()) {
    if (!allowedDatabaseUrlParameters.has(parameter.toLowerCase())) {
      throw new Error('Backend API database URL contains an unsupported connection parameter');
    }
  }

  let username: string;
  try {
    username = decodeURIComponent(url.username);
  } catch {
    throw new Error('Backend API database URL contains an invalid runtime login');
  }
  if (username.length === 0) {
    throw new Error('Backend API database URL must contain an explicit runtime login');
  }
  return { connectionString: url.href, username };
}

function assertDistinctDatabaseUsers(databases: readonly ValidatedDatabaseUrl[]): void {
  const usernames = databases.map(({ username }) => username);
  if (new Set(usernames).size !== usernames.length) {
    throw new Error('Backend API database runtime login names must be distinct');
  }
}

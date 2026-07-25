import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  applyMigrationSet,
  B3_MIGRATION_TABLE,
  B3_SCHEMA,
  loadMigrations,
} from '@taptime/backend-schema';
import type { Pool, PoolClient } from 'pg';
import {
  da5V5RuntimeLogins,
  runtimeLogins,
  SYNTHETIC_DATABASE_NAME,
  syntheticIds,
} from './constants.js';
import { seedDa4V5Fixture } from './Da4V5Database.js';
import { DA4_V5_PROFILE } from './Da4V5Profile.js';
import { seedDa5V5Fixture } from './Da5V5Database.js';
import { DA5_V5_PROFILE, DA5_V5_PUBLIC_MANIFEST } from './Da5V5Profile.js';

const applicationRoles = [
  'taptime_employee',
  'taptime_administrator',
  'taptime_server_lifecycle',
  'taptime_identity_resolver',
  'taptime_employee_invitation_creator',
  'taptime_employee_enrollment_redeemer',
  'taptime_assignment_reassigner',
  'taptime_offline_lease_issuer',
  'taptime_offline_event_ingestor',
  'taptime_offline_reconciliation_reader',
  'taptime_time_exporter',
  'taptime_time_review_reader',
  'taptime_time_review_writer',
] as const;
const da5V5ApplicationRoles = [
  'taptime_mobile_own_time_reader',
  'taptime_mobile_target_reader',
  'taptime_project_administrator',
] as const;
const migrationDirectory = fileURLToPath(new URL('../../backend-schema/migrations/', import.meta.url));

const runtimeRoleGraph = Object.freeze({
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
  [runtimeLogins.offlineLease]: [
    'taptime_offline_lease_issuer',
  ],
  [runtimeLogins.offlineEvent]: [
    'taptime_offline_event_ingestor',
  ],
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
  [runtimeLogins.provisioner]: ['taptime_administrator'],
} as const);

const da5V5RuntimeRoleGraph = Object.freeze({
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
} as const);
const activeDatabaseOwnerships = new WeakMap<
  SyntheticDatabaseOwnership,
  { cleanupEnabled: boolean; pool: Pool }
>();

export interface Da5V5DatabaseConnections {
  readonly manualLifecycle: string;
  readonly mobileOwnTime: string;
  readonly mobileTarget: string;
  readonly projectAdministration: string;
}

export interface SyntheticDatabaseRuntime {
  readonly connectionStrings: Readonly<Record<keyof typeof runtimeLogins, string>>;
  readonly da5V5ConnectionStrings?: Da5V5DatabaseConnections;
}

export interface SyntheticDatabaseOwnership {
  cleanup(profile?: typeof DA4_V5_PROFILE | typeof DA5_V5_PROFILE): Promise<void>;
  release(): Promise<void>;
}

export interface SyntheticEvidenceCounts {
  readonly adminSetupReceipts: number;
  readonly auditEvents: number;
  readonly canonicalDecisions: number;
  readonly customers: number;
  readonly nfcAssignments: number;
  readonly nfcTags: number;
  readonly stoppedTimeEntries: number;
  readonly syncReceipts: number;
  readonly timeEntries: number;
  readonly workEvents: number;
}

export interface SyntheticEmployeeEnrollmentEvidenceCounts {
  readonly activeEmployeeInvitations: number;
  readonly consumedEmployeeInvitations: number;
  readonly employeeInvitationReceipts: number;
  readonly employeeMemberships: number;
  readonly employeeRedemptionReceipts: number;
  readonly identityBindings: number;
  readonly memberships: number;
  readonly users: number;
}

export interface SyntheticTimeReviewEvidenceCounts {
  readonly reviewAdjudications: number;
  readonly reviewPredecessorCursors: number;
  readonly timeEntryExportAudits: number;
  readonly timeRecordRevisions: number;
  readonly timeReviewCommandReceipts: number;
}

export function validateSyntheticInstallerDatabaseUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Synthetic E2E database URL must be an absolute PostgreSQL URL');
  }
  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol)
    || !isNumericLoopbackHost(url.hostname)
    || databaseName !== SYNTHETIC_DATABASE_NAME
    || url.username.length === 0
    || url.search.length > 0
    || url.hash.length > 0
  ) {
    throw new Error(
      `Synthetic E2E setup requires a numeric-loopback PostgreSQL URL for database ${SYNTHETIC_DATABASE_NAME}`,
    );
  }
  return url;
}

export async function prepareSyntheticDatabase(
  installerPool: Pool,
  installerDatabaseUrl: string,
  issuer: string,
  profile?: typeof DA4_V5_PROFILE | typeof DA5_V5_PROFILE,
  ownership?: SyntheticDatabaseOwnership,
): Promise<SyntheticDatabaseRuntime> {
  validateSyntheticInstallerDatabaseUrl(installerDatabaseUrl);
  await assertInstallerConnection(installerPool);
  if (profile === DA5_V5_PROFILE) {
    const activeOwnership = ownership === undefined
      ? undefined
      : activeDatabaseOwnerships.get(ownership);
    if (
      activeOwnership === undefined
      || activeOwnership.pool !== installerPool
    ) {
      throw new Error('DA5 V5 database preparation requires active exclusive ownership');
    }
    await removeLegacyDa5V5Provisioner(installerPool);
    activeOwnership.cleanupEnabled = true;
  }

  await installerPool.query(`DROP SCHEMA IF EXISTS ${B3_SCHEMA} CASCADE`);
  await installerPool.query(`DROP TABLE IF EXISTS ${B3_MIGRATION_TABLE}`);
  const migration = await applyMigrationSet(
    installerPool,
    await loadMigrations(migrationDirectory),
  );
  if (migration.applied.join(',') !== '001,002,003,004,005,006,007,008,009,010,011,012,013') {
    throw new Error('Synthetic E2E requires a clean migration set 001 through 013');
  }

  await normalizeApplicationRoles(installerPool, profile);
  const passwords = {
    session: randomBytes(32).toString('base64url'),
    readModel: randomBytes(32).toString('base64url'),
    lifecycle: randomBytes(32).toString('base64url'),
    administration: randomBytes(32).toString('base64url'),
    employeeInvitation: randomBytes(32).toString('base64url'),
    employeeEnrollment: randomBytes(32).toString('base64url'),
    reassignment: randomBytes(32).toString('base64url'),
    offlineLease: randomBytes(32).toString('base64url'),
    offlineEvent: randomBytes(32).toString('base64url'),
    offlineReconciliation: randomBytes(32).toString('base64url'),
    timeEntryExport: randomBytes(32).toString('base64url'),
    timeReviewRead: randomBytes(32).toString('base64url'),
    timeReviewWrite: randomBytes(32).toString('base64url'),
    provisioner: randomBytes(32).toString('base64url'),
  } as const;
  const enabledRuntimeRoleGraph = profile === DA5_V5_PROFILE
    ? Object.entries(runtimeRoleGraph).filter(([login]) => login !== runtimeLogins.provisioner)
    : Object.entries(runtimeRoleGraph);
  for (const [login, roles] of enabledRuntimeRoleGraph) {
    const key = loginKey(login);
    await normalizeRuntimeLogin(installerPool, login, passwords[key], roles);
  }
  const da5V5Passwords = profile === DA5_V5_PROFILE
    ? {
        manualLifecycle: randomBytes(32).toString('base64url'),
        mobileOwnTime: randomBytes(32).toString('base64url'),
        mobileTarget: randomBytes(32).toString('base64url'),
        projectAdministration: randomBytes(32).toString('base64url'),
      } as const
    : undefined;
  if (da5V5Passwords !== undefined) {
    for (const [login, roles] of Object.entries(da5V5RuntimeRoleGraph)) {
      const key = da5V5LoginKey(login);
      await normalizeRuntimeLogin(installerPool, login, da5V5Passwords[key], roles);
    }
  }
  await seedSyntheticTenant(installerPool, issuer, profile);
  if (profile === DA4_V5_PROFILE) {
    await seedDa4V5Fixture(installerPool);
  } else if (profile === DA5_V5_PROFILE) {
    await seedDa5V5Fixture(installerPool);
  }

  return Object.freeze({
    connectionStrings: Object.freeze({
      session: runtimeConnectionString(installerDatabaseUrl, runtimeLogins.session, passwords.session),
      readModel: runtimeConnectionString(
        installerDatabaseUrl,
        runtimeLogins.readModel,
        passwords.readModel,
      ),
      lifecycle: runtimeConnectionString(
        installerDatabaseUrl,
        runtimeLogins.lifecycle,
        passwords.lifecycle,
      ),
      administration: runtimeConnectionString(
        installerDatabaseUrl,
        runtimeLogins.administration,
        passwords.administration,
      ),
      employeeInvitation: runtimeConnectionString(
        installerDatabaseUrl,
        runtimeLogins.employeeInvitation,
        passwords.employeeInvitation,
      ),
      employeeEnrollment: runtimeConnectionString(
        installerDatabaseUrl,
        runtimeLogins.employeeEnrollment,
        passwords.employeeEnrollment,
      ),
      reassignment: runtimeConnectionString(
        installerDatabaseUrl,
        runtimeLogins.reassignment,
        passwords.reassignment,
      ),
      offlineLease: runtimeConnectionString(
        installerDatabaseUrl,
        runtimeLogins.offlineLease,
        passwords.offlineLease,
      ),
      offlineEvent: runtimeConnectionString(
        installerDatabaseUrl,
        runtimeLogins.offlineEvent,
        passwords.offlineEvent,
      ),
      offlineReconciliation: runtimeConnectionString(
        installerDatabaseUrl,
        runtimeLogins.offlineReconciliation,
        passwords.offlineReconciliation,
      ),
      timeEntryExport: runtimeConnectionString(
        installerDatabaseUrl,
        runtimeLogins.timeEntryExport,
        passwords.timeEntryExport,
      ),
      timeReviewRead: runtimeConnectionString(
        installerDatabaseUrl,
        runtimeLogins.timeReviewRead,
        passwords.timeReviewRead,
      ),
      timeReviewWrite: runtimeConnectionString(
        installerDatabaseUrl,
        runtimeLogins.timeReviewWrite,
        passwords.timeReviewWrite,
      ),
      provisioner: runtimeConnectionString(
        installerDatabaseUrl,
        runtimeLogins.provisioner,
        passwords.provisioner,
      ),
    }),
    ...(da5V5Passwords === undefined ? {} : {
      da5V5ConnectionStrings: Object.freeze({
        manualLifecycle: runtimeConnectionString(
          installerDatabaseUrl,
          da5V5RuntimeLogins.manualLifecycle,
          da5V5Passwords.manualLifecycle,
        ),
        mobileOwnTime: runtimeConnectionString(
          installerDatabaseUrl,
          da5V5RuntimeLogins.mobileOwnTime,
          da5V5Passwords.mobileOwnTime,
        ),
        mobileTarget: runtimeConnectionString(
          installerDatabaseUrl,
          da5V5RuntimeLogins.mobileTarget,
          da5V5Passwords.mobileTarget,
        ),
        projectAdministration: runtimeConnectionString(
          installerDatabaseUrl,
          da5V5RuntimeLogins.projectAdministration,
          da5V5Passwords.projectAdministration,
        ),
      }),
    }),
  });
}

export async function readSyntheticEvidenceCounts(pool: Pool): Promise<SyntheticEvidenceCounts> {
  const result = await pool.query<Record<keyof SyntheticEvidenceCounts, string>>(`
    SELECT
      (SELECT count(*)::text FROM ${B3_SCHEMA}.admin_setup_command_receipts) AS "adminSetupReceipts",
      (SELECT count(*)::text FROM ${B3_SCHEMA}.audit_events) AS "auditEvents",
      (SELECT count(*)::text FROM ${B3_SCHEMA}.canonical_decisions) AS "canonicalDecisions",
      (SELECT count(*)::text FROM ${B3_SCHEMA}.customers) AS "customers",
      (SELECT count(*)::text FROM ${B3_SCHEMA}.nfc_assignments) AS "nfcAssignments",
      (SELECT count(*)::text FROM ${B3_SCHEMA}.nfc_tags) AS "nfcTags",
      (SELECT count(*)::text FROM ${B3_SCHEMA}.time_entries WHERE status = 'stopped') AS "stoppedTimeEntries",
      (SELECT count(*)::text FROM ${B3_SCHEMA}.sync_receipts) AS "syncReceipts",
      (SELECT count(*)::text FROM ${B3_SCHEMA}.time_entries) AS "timeEntries",
      (SELECT count(*)::text FROM ${B3_SCHEMA}.work_events) AS "workEvents"
  `);
  const row = result.rows[0];
  if (row === undefined) {
    throw new Error('Synthetic E2E evidence query returned no result');
  }
  return Object.freeze({
    adminSetupReceipts: Number(row.adminSetupReceipts),
    auditEvents: Number(row.auditEvents),
    canonicalDecisions: Number(row.canonicalDecisions),
    customers: Number(row.customers),
    nfcAssignments: Number(row.nfcAssignments),
    nfcTags: Number(row.nfcTags),
    stoppedTimeEntries: Number(row.stoppedTimeEntries),
    syncReceipts: Number(row.syncReceipts),
    timeEntries: Number(row.timeEntries),
    workEvents: Number(row.workEvents),
  });
}

export async function readSyntheticEmployeeEnrollmentEvidenceCounts(
  pool: Pool,
): Promise<SyntheticEmployeeEnrollmentEvidenceCounts> {
  const result = await pool.query<Record<keyof SyntheticEmployeeEnrollmentEvidenceCounts, string>>(`
    SELECT
      (SELECT count(*)::text
       FROM ${B3_SCHEMA}.employee_membership_invitations
       WHERE consumed_at IS NULL AND expires_at > transaction_timestamp())
        AS "activeEmployeeInvitations",
      (SELECT count(*)::text
       FROM ${B3_SCHEMA}.employee_membership_invitations
       WHERE consumed_at IS NOT NULL) AS "consumedEmployeeInvitations",
      (SELECT count(*)::text FROM ${B3_SCHEMA}.employee_invitation_command_receipts)
        AS "employeeInvitationReceipts",
      (SELECT count(*)::text FROM ${B3_SCHEMA}.memberships
       WHERE role = 'employee' AND revoked_at IS NULL) AS "employeeMemberships",
      (SELECT count(*)::text FROM ${B3_SCHEMA}.employee_enrollment_redemption_receipts)
        AS "employeeRedemptionReceipts",
      (SELECT count(*)::text FROM ${B3_SCHEMA}.identity_bindings) AS "identityBindings",
      (SELECT count(*)::text FROM ${B3_SCHEMA}.memberships) AS "memberships",
      (SELECT count(*)::text FROM ${B3_SCHEMA}.users) AS "users"
  `);
  const row = result.rows[0];
  if (row === undefined) {
    throw new Error('Synthetic C3E1 evidence query returned no result');
  }
  return Object.freeze({
    activeEmployeeInvitations: Number(row.activeEmployeeInvitations),
    consumedEmployeeInvitations: Number(row.consumedEmployeeInvitations),
    employeeInvitationReceipts: Number(row.employeeInvitationReceipts),
    employeeMemberships: Number(row.employeeMemberships),
    employeeRedemptionReceipts: Number(row.employeeRedemptionReceipts),
    identityBindings: Number(row.identityBindings),
    memberships: Number(row.memberships),
    users: Number(row.users),
  });
}

export async function readSyntheticTimeReviewEvidenceCounts(
  pool: Pool,
): Promise<SyntheticTimeReviewEvidenceCounts> {
  const result = await pool.query<Record<keyof SyntheticTimeReviewEvidenceCounts, string>>(`
    SELECT
      (SELECT count(*)::text FROM ${B3_SCHEMA}.offline_review_adjudications)
        AS "reviewAdjudications",
      (SELECT count(*)::text FROM ${B3_SCHEMA}.offline_sync_cursors
       WHERE review_predecessor_sequence IS NOT NULL) AS "reviewPredecessorCursors",
      (SELECT count(*)::text FROM ${B3_SCHEMA}.audit_events
       WHERE event_type = 'TimeEntryExportGenerated') AS "timeEntryExportAudits",
      (SELECT count(*)::text FROM ${B3_SCHEMA}.time_record_revisions)
        AS "timeRecordRevisions",
      (SELECT count(*)::text FROM ${B3_SCHEMA}.time_review_command_receipts)
        AS "timeReviewCommandReceipts"
  `);
  const row = result.rows[0];
  if (row === undefined) {
    throw new Error('Synthetic DA3 evidence query returned no result');
  }
  return Object.freeze({
    reviewAdjudications: Number(row.reviewAdjudications),
    reviewPredecessorCursors: Number(row.reviewPredecessorCursors),
    timeEntryExportAudits: Number(row.timeEntryExportAudits),
    timeRecordRevisions: Number(row.timeRecordRevisions),
    timeReviewCommandReceipts: Number(row.timeReviewCommandReceipts),
  });
}

export async function cleanSyntheticDatabase(
  pool: Pick<Pool, 'query'>,
  profile?: typeof DA4_V5_PROFILE | typeof DA5_V5_PROFILE,
): Promise<void> {
  if (profile === DA5_V5_PROFILE) {
    await assertInstallerConnection(pool);
  }
  await pool.query(`DROP SCHEMA IF EXISTS ${B3_SCHEMA} CASCADE`);
  await pool.query(`DROP TABLE IF EXISTS ${B3_MIGRATION_TABLE}`);
  const runtimeLoginCleanup = profile === DA5_V5_PROFILE
    ? Object.values(runtimeLogins).filter((login) => login !== runtimeLogins.provisioner)
    : Object.values(runtimeLogins);
  for (const login of runtimeLoginCleanup) {
    await pool.query(`DROP ROLE IF EXISTS ${login}`);
  }
  if (profile === DA5_V5_PROFILE) {
    for (const login of Object.values(da5V5RuntimeLogins)) {
      await pool.query(`DROP ROLE IF EXISTS ${login}`);
    }
  }
}

export async function acquireSyntheticDatabaseOwnership(
  pool: Pool,
): Promise<SyntheticDatabaseOwnership> {
  const client = await pool.connect();
  let acquired = false;
  let released = false;
  try {
    await assertInstallerConnection(client);
    const lock = await client.query<{ acquired: boolean }>(
      `SELECT pg_catalog.pg_try_advisory_lock(
         pg_catalog.hashtextextended(
           pg_catalog.current_database() || ':taptime-synthetic-e2e-owner',
           0
         )
       ) AS acquired`,
    );
    if (lock.rows[0]?.acquired !== true) {
      throw new Error('Synthetic E2E database is already owned by another harness');
    }
    acquired = true;
  } catch (error) {
    client.release();
    throw error;
  }
  let ownership: SyntheticDatabaseOwnership;
  ownership = {
    cleanup: (profile?: typeof DA4_V5_PROFILE | typeof DA5_V5_PROFILE) => {
      const activeOwnership = activeDatabaseOwnerships.get(ownership);
      if (
        released
        || !acquired
        || activeOwnership === undefined
        || activeOwnership.pool !== pool
      ) {
        return Promise.reject(new Error('Synthetic E2E database ownership is unavailable'));
      }
      if (!activeOwnership.cleanupEnabled) {
        return Promise.resolve();
      }
      return cleanSyntheticDatabase(client, profile);
    },
    async release(): Promise<void> {
      if (released) {
        return;
      }
      released = true;
      activeDatabaseOwnerships.delete(ownership);
      try {
        if (acquired) {
          const unlock = await client.query<{ released: boolean }>(
            `SELECT pg_catalog.pg_advisory_unlock(
               pg_catalog.hashtextextended(
                 pg_catalog.current_database() || ':taptime-synthetic-e2e-owner',
                 0
               )
             ) AS released`,
          );
          if (unlock.rows[0]?.released !== true) {
            throw new Error('Synthetic E2E database ownership release failed');
          }
          acquired = false;
        }
      } finally {
        client.release();
      }
    },
  };
  activeDatabaseOwnerships.set(ownership, {
    cleanupEnabled: false,
    pool,
  });
  return Object.freeze(ownership);
}

export async function parentRoles(pool: Pool, memberName: string): Promise<readonly string[]> {
  const result = await pool.query<{ role_name: string }>(
    `SELECT parent.rolname AS role_name
     FROM pg_catalog.pg_auth_members AS membership
     JOIN pg_catalog.pg_roles AS member ON member.oid = membership.member
     JOIN pg_catalog.pg_roles AS parent ON parent.oid = membership.roleid
     WHERE member.rolname = $1
     ORDER BY parent.rolname`,
    [memberName],
  );
  return result.rows.map(({ role_name }) => role_name);
}

async function assertInstallerConnection(
  pool: Pick<Pool, 'query'> | Pick<PoolClient, 'query'>,
): Promise<void> {
  const result = await pool.query<{
    current_database: string;
    host: string | null;
    rolcreaterole: boolean;
    rolsuper: boolean;
  }>(`
    SELECT current_database(), inet_server_addr()::text AS host, role.rolcreaterole, role.rolsuper
    FROM pg_catalog.pg_roles AS role
    WHERE role.rolname = current_user
  `);
  const row = result.rows[0];
  if (
    row === undefined
    || row.current_database !== SYNTHETIC_DATABASE_NAME
    || row.host === null
    || !isNumericLoopbackHost(row.host)
    || (!row.rolsuper && !row.rolcreaterole)
  ) {
    throw new Error('Synthetic E2E installer connection failed the local disposable database guard');
  }
}

async function removeLegacyDa5V5Provisioner(pool: Pool): Promise<void> {
  const legacyLogin = runtimeLogins.provisioner;
  const client = await pool.connect();
  let transactionOpen = false;
  try {
    await client.query('BEGIN');
    transactionOpen = true;
    const existing = await client.query<{ present: boolean }>(
      `SELECT pg_catalog.to_regrole($1) IS NOT NULL AS present`,
      [legacyLogin],
    );
    if (existing.rows[0]?.present !== true) {
      await client.query('COMMIT');
      transactionOpen = false;
      return;
    }

    const installerAuthority = await client.query<{ rolsuper: boolean }>(
      `SELECT role.rolsuper
       FROM pg_catalog.pg_roles AS role
       WHERE role.rolname = CURRENT_USER`,
    );
    if (installerAuthority.rows[0]?.rolsuper !== true) {
      throw new Error('DA5 V5 legacy provisioner password state is unverifiable');
    }

    const roleState = await client.query<{
      has_password: boolean;
      rolbypassrls: boolean;
      rolcanlogin: boolean;
      rolconnlimit: number;
      rolcreatedb: boolean;
      rolcreaterole: boolean;
      rolinherit: boolean;
      rolreplication: boolean;
      rolsuper: boolean;
      valid_without_limit: boolean;
    }>(
      `SELECT
         role.rolcanlogin,
         role.rolinherit,
         role.rolsuper,
         role.rolcreatedb,
         role.rolcreaterole,
         role.rolreplication,
         role.rolbypassrls,
         role.rolconnlimit,
         role.rolvaliduntil IS NULL AS valid_without_limit,
         role.rolpassword IS NOT NULL AS has_password
       FROM pg_catalog.pg_authid AS role
       WHERE role.rolname = $1`,
      [legacyLogin],
    );
    const activeSessions = await legacyProvisionerHasActiveSession(
      client,
      legacyLogin,
    );
    const memberships = await client.query<{
      has_members: boolean;
      parents_exact: boolean;
    }>(
      `SELECT
         (
           SELECT
             count(*) = 1
             AND COALESCE(
               bool_and(
                 parent.rolname = 'taptime_administrator'
                 AND NOT membership.admin_option
                 AND NOT membership.inherit_option
                 AND membership.set_option
               ),
               false
             )
           FROM pg_catalog.pg_auth_members AS membership
           JOIN pg_catalog.pg_roles AS member ON member.oid = membership.member
           JOIN pg_catalog.pg_roles AS parent ON parent.oid = membership.roleid
           WHERE member.rolname = $1
         ) AS parents_exact,
         EXISTS (
           SELECT 1
           FROM pg_catalog.pg_auth_members AS membership
           JOIN pg_catalog.pg_roles AS member ON member.oid = membership.member
           JOIN pg_catalog.pg_roles AS parent ON parent.oid = membership.roleid
           WHERE parent.rolname = $1
         ) AS has_members`,
      [legacyLogin],
    );
    const settings = await client.query<{ present: boolean }>(
      `SELECT EXISTS (
         SELECT 1
         FROM pg_catalog.pg_db_role_setting AS setting
         JOIN pg_catalog.pg_roles AS role ON role.oid = setting.setrole
         WHERE role.rolname = $1
       ) AS present`,
      [legacyLogin],
    );
    const dependencies = await client.query<{
      blocked: boolean;
      owns_database: boolean;
    }>(
      `WITH current_context AS (
         SELECT database.oid AS database_oid
         FROM pg_catalog.pg_database AS database
         WHERE database.datname = pg_catalog.current_database()
       )
       SELECT
         EXISTS (
           SELECT 1
           FROM pg_catalog.pg_shdepend AS dependency
           JOIN pg_catalog.pg_roles AS legacy
             ON dependency.refclassid = 'pg_catalog.pg_authid'::pg_catalog.regclass
            AND dependency.refobjid = legacy.oid
           CROSS JOIN current_context
           WHERE legacy.rolname = $1
             AND NOT (
               dependency.deptype = 'o'
               AND dependency.objsubid = 0
               AND (
                 (
                   dependency.dbid = current_context.database_oid
                   AND dependency.classid
                     = 'pg_catalog.pg_namespace'::pg_catalog.regclass
                   AND dependency.objid = pg_catalog.to_regnamespace('${B3_SCHEMA}')
                 )
                 OR (
                   dependency.dbid = current_context.database_oid
                   AND dependency.classid = 'pg_catalog.pg_class'::pg_catalog.regclass
                   AND dependency.objid = pg_catalog.to_regclass('${B3_MIGRATION_TABLE}')
                 )
                 OR (
                   dependency.dbid = 0
                   AND dependency.classid = 'pg_catalog.pg_database'::pg_catalog.regclass
                   AND dependency.objid = current_context.database_oid
                 )
               )
             )
         ) AS blocked,
         EXISTS (
           SELECT 1
           FROM pg_catalog.pg_database AS database
           JOIN pg_catalog.pg_roles AS owner ON owner.oid = database.datdba
           WHERE database.datname = pg_catalog.current_database()
             AND owner.rolname = $1
         ) AS owns_database`,
      [legacyLogin],
    );

    const role = roleState.rows[0];
    const membership = memberships.rows[0];
    const dependency = dependencies.rows[0];
    if (
      role === undefined
      || !role.rolcanlogin
      || role.rolinherit
      || role.rolsuper
      || role.rolcreatedb
      || role.rolcreaterole
      || role.rolreplication
      || role.rolbypassrls
      || role.rolconnlimit !== -1
      || !role.valid_without_limit
      || !role.has_password
    ) {
      throw new Error('DA5 V5 legacy provisioner role state is unsupported');
    }
    if (activeSessions) {
      throw new Error('DA5 V5 legacy provisioner still has an active session');
    }
    if (
      membership === undefined
      || membership.has_members
      || !membership.parents_exact
    ) {
      throw new Error('DA5 V5 legacy provisioner membership state is unsupported');
    }
    if (settings.rows[0]?.present !== false || dependency?.blocked !== false) {
      throw new Error('DA5 V5 legacy provisioner has unsupported shared dependencies');
    }

    await client.query(`ALTER ROLE ${legacyLogin} NOLOGIN PASSWORD NULL`);
    if (await legacyProvisionerHasActiveSession(client, legacyLogin)) {
      throw new Error('DA5 V5 legacy provisioner still has an active session');
    }
    await client.query(`DROP SCHEMA IF EXISTS ${B3_SCHEMA} CASCADE`);
    await client.query(`DROP TABLE IF EXISTS ${B3_MIGRATION_TABLE}`);
    if (dependency.owns_database) {
      await client.query(
        `ALTER DATABASE ${SYNTHETIC_DATABASE_NAME} OWNER TO CURRENT_USER`,
      );
    }
    await client.query(`DROP ROLE ${legacyLogin}`);
    const absent = await client.query<{ absent: boolean }>(
      `SELECT pg_catalog.to_regrole($1) IS NULL AS absent`,
      [legacyLogin],
    );
    if (absent.rows[0]?.absent !== true) {
      throw new Error('DA5 V5 legacy provisioner removal failed');
    }
    await client.query('COMMIT');
    transactionOpen = false;
  } catch (error) {
    if (transactionOpen) {
      try {
        await client.query('ROLLBACK');
      } catch {
        throw new Error('DA5 V5 legacy provisioner rollback failed');
      }
    }
    throw error;
  } finally {
    client.release();
  }
}

async function legacyProvisionerHasActiveSession(
  client: Pick<PoolClient, 'query'>,
  legacyLogin: string,
): Promise<boolean> {
  const activeSessions = await client.query<{ active: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM pg_catalog.pg_stat_activity
       WHERE usename = $1
         AND pid <> pg_catalog.pg_backend_pid()
     ) AS active`,
    [legacyLogin],
  );
  if (activeSessions.rows[0] === undefined) {
    throw new Error('DA5 V5 legacy provisioner session state is unavailable');
  }
  return activeSessions.rows[0].active;
}

async function normalizeApplicationRoles(
  pool: Pool,
  profile?: typeof DA4_V5_PROFILE | typeof DA5_V5_PROFILE,
): Promise<void> {
  const roles = profile === DA5_V5_PROFILE
    ? [...applicationRoles, ...da5V5ApplicationRoles]
    : applicationRoles;
  for (const role of roles) {
    await pool.query(`
      ALTER ROLE ${role} WITH
        NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
      DO $parents$
      DECLARE parent_name text;
      BEGIN
        FOR parent_name IN
          SELECT parent.rolname
          FROM pg_catalog.pg_auth_members AS membership
          JOIN pg_catalog.pg_roles AS member ON member.oid = membership.member
          JOIN pg_catalog.pg_roles AS parent ON parent.oid = membership.roleid
          WHERE member.rolname = '${role}'
        LOOP
          EXECUTE format('REVOKE %I FROM ${role}', parent_name);
        END LOOP;
      END
      $parents$;
    `);
  }
}

async function normalizeRuntimeLogin(
  pool: Pool,
  login: string,
  password: string,
  roles: readonly string[],
): Promise<void> {
  await pool.query(`
    DO $login$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = '${login}') THEN
        CREATE ROLE ${login}
          LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
      END IF;
    END
    $login$;
    ALTER ROLE ${login} WITH
      LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS
      PASSWORD ${quoteLiteral(password)};
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

async function seedSyntheticTenant(
  pool: Pool,
  issuer: string,
  profile?: typeof DA4_V5_PROFILE | typeof DA5_V5_PROFILE,
): Promise<void> {
  await pool.query(
    `INSERT INTO ${B3_SCHEMA}.users (id) VALUES ($1), ($2)`,
    [syntheticIds.user, syntheticIds.administratorUser],
  );
  await pool.query(
    `INSERT INTO ${B3_SCHEMA}.organizations (id, name) VALUES ($1, 'Synthetic Android E2E')`,
    [syntheticIds.organization],
  );
  await pool.query(
    `INSERT INTO ${B3_SCHEMA}.memberships
       (id, organization_id, user_id, role, created_at, revoked_at)
     VALUES
       ($1, $3, $4, 'employee', transaction_timestamp(), NULL),
       ($2, $3, $5, 'administrator', transaction_timestamp(), NULL)`,
    [
      syntheticIds.membership,
      syntheticIds.administratorMembership,
      syntheticIds.organization,
      syntheticIds.user,
      syntheticIds.administratorUser,
    ],
  );
  await pool.query(
    `INSERT INTO ${B3_SCHEMA}.identity_bindings
       (id, user_id, issuer, subject, created_at, revoked_at)
     VALUES
       ($1, $3, $5, $6, transaction_timestamp(), NULL),
       ($2, $4, $5, $7, transaction_timestamp(), NULL)`,
    [
      syntheticIds.identityBinding,
      syntheticIds.administratorIdentityBinding,
      syntheticIds.user,
      syntheticIds.administratorUser,
      issuer,
      syntheticIds.providerSubject,
      syntheticIds.administratorProviderSubject,
    ],
  );
  await pool.query(
    `INSERT INTO ${B3_SCHEMA}.customers
       (id, organization_id, display_name, active, activated_at, deactivated_at)
     VALUES
       ($1, $3, $4, true, transaction_timestamp(), NULL),
       ($2, $3, $5, true, transaction_timestamp(), NULL)`,
    [
      syntheticIds.customer,
      syntheticIds.reassignmentCustomer,
      syntheticIds.organization,
      profile === DA5_V5_PROFILE
        ? DA5_V5_PUBLIC_MANIFEST.customerALabel
        : 'Synthetic Android Customer',
      profile === DA5_V5_PROFILE
        ? DA5_V5_PUBLIC_MANIFEST.customerBLabel
        : 'Synthetic Reassignment Target',
    ],
  );
}

function runtimeConnectionString(
  installerDatabaseUrl: string,
  username: string,
  password: string,
): string {
  const url = new URL(installerDatabaseUrl);
  url.username = username;
  url.password = password;
  return url.href;
}

function loginKey(login: string): keyof typeof runtimeLogins {
  const entry = Object.entries(runtimeLogins).find(([, value]) => value === login);
  if (entry === undefined) {
    throw new Error('Unsupported synthetic runtime login');
  }
  return entry[0] as keyof typeof runtimeLogins;
}

function da5V5LoginKey(login: string): keyof typeof da5V5RuntimeLogins {
  const entry = Object.entries(da5V5RuntimeLogins).find(([, value]) => value === login);
  if (entry === undefined) {
    throw new Error('Unsupported DA5 V5 runtime login');
  }
  return entry[0] as keyof typeof da5V5RuntimeLogins;
}

function isNumericLoopbackHost(hostname: string): boolean {
  const address = hostname.split('/', 1)[0] as string;
  const normalized = address.startsWith('[') && address.endsWith(']')
    ? address.slice(1, -1)
    : address;
  if (normalized === '::1') {
    return true;
  }
  const octets = normalized.split('.');
  return octets.length === 4
    && octets[0] === '127'
    && octets.every((octet) => /^\d{1,3}$/.test(octet) && Number(octet) <= 255);
}

function quoteLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

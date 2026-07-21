import { randomBytes, randomUUID } from 'node:crypto';
import {
  AdminWriteSessionCoordinator,
  EmployeeMembershipEnrollmentCoordinator,
  NfcTagReassignmentCoordinator,
} from '@taptime/backend-administration';
import {
  OrganizationBootstrapCoordinator,
  PostgresBootstrapCapability,
} from '@taptime/backend-bootstrap';
import type {
  AccessTokenVerifier,
  AccessTokenVerificationResult,
  SupabaseJwtAccessTokenVerifier,
} from '@taptime/backend-identity';
import { ServerCanonicalLifecycleIngestionCoordinator } from '@taptime/backend-lifecycle';
import {
  B3_MIGRATION_TABLE,
  B3_SCHEMA,
  migrate,
} from '@taptime/backend-schema';
import {
  CustomerId,
  MembershipId,
  NfcAssignmentId,
  NfcTagId,
  OrganizationId,
  WorkEventId,
  createTimestamp,
  customerAssignmentTarget,
} from '@taptime/core';
import { Pool } from 'pg';
import { expect, it } from 'vitest';
import { TimeEntryExportCoordinator } from '../src/index.js';

const installerConnectionString = process.env.DA2_DATABASE_URL
  ?? 'postgresql://timbartz@127.0.0.1:5432/taptime_da2';
const issuer = 'https://da2-journey.synthetic.invalid/auth';
const tokens = Object.freeze({
  administrator: 'da2-journey-administrator',
  employee: 'da2-journey-employee',
});
const subjects: Readonly<Record<string, string>> = Object.freeze({
  [tokens.administrator]: 'da2-journey-administrator',
  [tokens.employee]: 'da2-journey-employee',
});
const verifier: AccessTokenVerifier = Object.freeze({
  async verify(accessToken: string): Promise<AccessTokenVerificationResult> {
    const subject = subjects[accessToken];
    return subject === undefined
      ? { status: 'rejected', reason: 'invalid_signature' }
      : { status: 'verified', identity: { issuer, subject } };
  },
});

const logins = Object.freeze({
  bootstrap: 'taptime_bootstrap_operator_da2journey001',
  administration: 'taptime_da2_journey_admin',
  invitation: 'taptime_da2_journey_invite',
  enrollment: 'taptime_da2_journey_enroll',
  reassignment: 'taptime_da2_journey_reassign',
  lifecycle: 'taptime_da2_journey_lifecycle',
  export: 'taptime_da2_journey_export',
});
const password = randomBytes(32).toString('base64url');

it('runs the authorized synthetic Setup to Lifecycle to Export journey and removes all state', async () => {
  const installerPool = new Pool({ connectionString: installerConnectionString, max: 6 });
  const runtimePools: Pool[] = [];
  let journeyCompleted = false;
  try {
    await resetDatabase(installerPool);
    await createRuntimeLogins(installerPool);

    const administrationPool = runtimePool(logins.administration);
    const invitationPool = runtimePool(logins.invitation);
    const enrollmentPool = runtimePool(logins.enrollment);
    const reassignmentPool = runtimePool(logins.reassignment);
    const lifecyclePool = runtimePool(logins.lifecycle);
    const exportPool = runtimePool(logins.export);
    runtimePools.push(
      administrationPool,
      invitationPool,
      enrollmentPool,
      reassignmentPool,
      lifecyclePool,
      exportPool,
    );

    const bootstrap = new OrganizationBootstrapCoordinator(
      verifier,
      new PostgresBootstrapCapability({
        target: bootstrapTarget(),
        operatorPrincipal: logins.bootstrap,
        passwordProvider: async () => password,
      }),
    );
    const bootstrapped = await bootstrap.bootstrap({
      requestId: randomUUID(),
      organizationDisplayName: 'TapTim.e DA2 Journey',
      accessToken: tokens.administrator,
    });
    if (bootstrapped.status !== 'succeeded') {
      throw new Error(`Synthetic bootstrap failed: ${JSON.stringify(bootstrapped)}`);
    }
    expect(bootstrapped).toMatchObject({ status: 'succeeded', idempotentRetry: false });

    const organizationId = OrganizationId(bootstrapped.organizationId);
    const administratorMembershipId = MembershipId(bootstrapped.membershipId);
    const administration = new AdminWriteSessionCoordinator(administrationPool, verifier);
    const customerAlpha = await administration.createCustomer({
      accessToken: tokens.administrator,
      expectedMembershipId: administratorMembershipId,
      commandId: randomUUID(),
      displayName: 'Customer Alpha',
    });
    const customerBeta = await administration.createCustomer({
      accessToken: tokens.administrator,
      expectedMembershipId: administratorMembershipId,
      commandId: randomUUID(),
      displayName: 'Customer Beta',
    });
    expect(customerAlpha.status).toBe('succeeded');
    expect(customerBeta.status).toBe('succeeded');
    if (customerAlpha.status !== 'succeeded' || customerBeta.status !== 'succeeded') {
      throw new Error('Synthetic Customer setup failed');
    }

    const provisioned = await administration.provisionNfcTag({
      accessToken: tokens.administrator,
      expectedMembershipId: administratorMembershipId,
      commandId: randomUUID(),
      customerId: customerAlpha.customer.id,
      displayName: 'DA2 Journey Tag',
      canonicalPayload: 'nfc:uid:v1:DA2E2E01',
    });
    expect(provisioned.status).toBe('succeeded');
    if (provisioned.status !== 'succeeded') throw new Error('Synthetic NFC setup failed');

    const enrollment = new EmployeeMembershipEnrollmentCoordinator(
      invitationPool,
      enrollmentPool,
      verifier,
    );
    const invitation = await enrollment.createInvitation({
      accessToken: tokens.administrator,
      expectedMembershipId: administratorMembershipId,
      commandId: randomUUID(),
      displayName: 'Employee Journey',
    });
    expect(invitation.status).toBe('succeeded');
    if (invitation.status !== 'succeeded') throw new Error('Synthetic invitation failed');
    await expect(enrollment.redeemInvitation({
      accessToken: tokens.employee,
      commandId: randomUUID(),
      invitationSecret: invitation.invitationSecret,
    })).resolves.toMatchObject({ status: 'succeeded', role: 'employee' });

    const employeeMembership = await installerPool.query<{ id: string }>(
      `SELECT membership.id
       FROM taptime_server.memberships AS membership
       INNER JOIN taptime_server.identity_bindings AS binding
         ON binding.user_id = membership.user_id
        AND binding.revoked_at IS NULL
       WHERE membership.organization_id = $1
         AND membership.role = 'employee'
         AND membership.revoked_at IS NULL
         AND binding.issuer = $2
         AND binding.subject = $3`,
      [organizationId, issuer, subjects[tokens.employee]],
    );
    expect(employeeMembership.rows).toHaveLength(1);
    const employeeMembershipId = MembershipId(employeeMembership.rows[0]!.id);

    const lifecycle = new ServerCanonicalLifecycleIngestionCoordinator(
      lifecyclePool,
      verifier as SupabaseJwtAccessTokenVerifier,
    );
    const firstStart = Date.now() + 1_000;
    await expect(lifecycle.ingest(lifecycleCommand({
      organizationId,
      membershipId: employeeMembershipId,
      customerId: customerAlpha.customer.id,
      nfcTagId: provisioned.nfcTag.id,
      assignmentId: provisioned.assignmentId,
      occurredAt: firstStart,
    }), employeeMembershipId)).resolves.toMatchObject({
      status: 'synchronized',
      decision: { status: 'time_entry_started' },
    });
    await expect(lifecycle.ingest(lifecycleCommand({
      organizationId,
      membershipId: employeeMembershipId,
      customerId: customerAlpha.customer.id,
      nfcTagId: provisioned.nfcTag.id,
      assignmentId: provisioned.assignmentId,
      occurredAt: firstStart + 10_000,
    }), employeeMembershipId)).resolves.toMatchObject({
      status: 'synchronized',
      decision: { status: 'time_entry_stopped' },
    });

    const reassignment = await new NfcTagReassignmentCoordinator(
      reassignmentPool,
      verifier,
    ).reassignNfcTag({
      accessToken: tokens.administrator,
      expectedMembershipId: administratorMembershipId,
      commandId: randomUUID(),
      nfcTagId: provisioned.nfcTag.id,
      expectedActiveAssignmentId: provisioned.assignmentId,
      targetCustomerId: customerBeta.customer.id,
    });
    expect(reassignment).toMatchObject({ status: 'succeeded', assignmentChanged: true });
    if (reassignment.status !== 'succeeded') throw new Error('Synthetic reassignment failed');

    const secondStart = firstStart + 20_000;
    await expect(lifecycle.ingest(lifecycleCommand({
      organizationId,
      membershipId: employeeMembershipId,
      customerId: customerBeta.customer.id,
      nfcTagId: provisioned.nfcTag.id,
      assignmentId: reassignment.resultAssignmentId,
      occurredAt: secondStart,
    }), employeeMembershipId)).resolves.toMatchObject({
      status: 'synchronized',
      decision: { status: 'time_entry_started' },
    });
    await expect(lifecycle.ingest(lifecycleCommand({
      organizationId,
      membershipId: employeeMembershipId,
      customerId: customerBeta.customer.id,
      nfcTagId: provisioned.nfcTag.id,
      assignmentId: reassignment.resultAssignmentId,
      occurredAt: secondStart + 10_000,
    }), employeeMembershipId)).resolves.toMatchObject({
      status: 'synchronized',
      decision: { status: 'time_entry_stopped' },
    });

    const exported = await new TimeEntryExportCoordinator(exportPool, verifier).exportTimeEntries({
      accessToken: tokens.administrator,
      correlationId: randomUUID(),
      request: {
        expectedMembershipId: administratorMembershipId,
        fromInclusive: new Date(firstStart - 60_000).toISOString(),
        toExclusive: new Date(secondStart + 60_000).toISOString(),
      },
    });
    expect(exported).toMatchObject({ status: 'succeeded', rowCount: 2 });
    if (exported.status !== 'succeeded') throw new Error('Synthetic export failed');
    const csv = new TextDecoder().decode(exported.bytes);
    expect(csv).toContain('"Customer Alpha"');
    expect(csv).toContain('"Customer Beta"');
    expect(csv).toContain('"Employee Journey"');

    const evidence = await installerPool.query<{
      entries: number;
      exports: number;
      export_rows: string;
      export_bytes: string;
      export_sha: string;
    }>(
      `SELECT
         (SELECT count(*)::integer FROM taptime_server.time_entries) AS entries,
         count(*) FILTER (WHERE event_type = 'TimeEntryExportGenerated')::integer AS exports,
         max(payload->>'rowCount') FILTER
           (WHERE event_type = 'TimeEntryExportGenerated') AS export_rows,
         max(payload->>'byteCount') FILTER
           (WHERE event_type = 'TimeEntryExportGenerated') AS export_bytes,
         max(payload->>'sha256') FILTER
           (WHERE event_type = 'TimeEntryExportGenerated') AS export_sha
       FROM taptime_server.audit_events`,
    );
    expect(evidence.rows[0]).toEqual({
      entries: 2,
      exports: 1,
      export_rows: '2',
      export_bytes: String(exported.byteCount),
      export_sha: exported.sha256,
    });
    journeyCompleted = true;
  } finally {
    await Promise.all(runtimePools.map(async (pool) => pool.end().catch(() => undefined)));
    await removeJourneyState(installerPool);
    const cleanup = await installerPool.query<{
      schema_exists: boolean;
      ledger_exists: boolean;
      login_count: number;
    }>(
      `SELECT
         pg_catalog.to_regnamespace($1) IS NOT NULL AS schema_exists,
         pg_catalog.to_regclass($2) IS NOT NULL AS ledger_exists,
         (SELECT count(*)::integer FROM pg_catalog.pg_roles WHERE rolname = ANY($3::text[]))
           AS login_count`,
      [B3_SCHEMA, B3_MIGRATION_TABLE, Object.values(logins)],
    );
    await installerPool.end();
    expect(cleanup.rows[0]).toEqual({
      schema_exists: false,
      ledger_exists: false,
      login_count: 0,
    });
  }
  expect(journeyCompleted).toBe(true);
});

function lifecycleCommand(input: {
  readonly organizationId: OrganizationId;
  readonly membershipId: MembershipId;
  readonly customerId: CustomerId;
  readonly nfcTagId: NfcTagId;
  readonly assignmentId: NfcAssignmentId;
  readonly occurredAt: number;
}) {
  return {
    accessToken: tokens.employee,
    requestedOrganizationId: input.organizationId,
    workEvent: {
      id: WorkEventId(randomUUID()),
      assignmentId: input.assignmentId,
      nfcTagId: input.nfcTagId,
      target: customerAssignmentTarget(input.customerId),
      occurredAt: createTimestamp(new Date(input.occurredAt).toISOString()),
    },
    receipt: { id: randomUUID(), attemptNumber: 1 },
  };
}

function runtimePool(login: string): Pool {
  const url = new URL(installerConnectionString);
  url.username = login;
  url.password = password;
  return new Pool({ connectionString: url.href, max: 2 });
}

function bootstrapTarget() {
  const url = new URL(installerConnectionString);
  return {
    mode: 'loopback-test' as const,
    host: url.hostname,
    port: Number(url.port || '5432'),
    database: url.pathname.slice(1),
    ssl: false as const,
  };
}

async function resetDatabase(pool: Pool): Promise<void> {
  await removeJourneyState(pool);
  const result = await migrate(pool);
  expect(result.applied).toEqual([
    '001', '002', '003', '004', '005', '006', '007', '008', '009', '010', '011',
  ]);
}

async function createRuntimeLogins(pool: Pool): Promise<void> {
  const grants: Readonly<Record<string, readonly string[]>> = Object.freeze({
    [logins.bootstrap]: ['taptime_bootstrap_executor'],
    [logins.administration]: ['taptime_identity_resolver', 'taptime_admin_setup'],
    [logins.invitation]: ['taptime_identity_resolver', 'taptime_employee_invitation_creator'],
    [logins.enrollment]: ['taptime_employee_enrollment_redeemer'],
    [logins.reassignment]: ['taptime_identity_resolver', 'taptime_assignment_reassigner'],
    [logins.lifecycle]: ['taptime_identity_resolver', 'taptime_server_lifecycle'],
    [logins.export]: ['taptime_identity_resolver', 'taptime_time_exporter'],
  });
  const database = quoteIdentifier(new URL(installerConnectionString).pathname.slice(1));
  const bootstrapExpiry = new Date(Date.now() + 60 * 60 * 1_000).toISOString();
  for (const [login, parentRoles] of Object.entries(grants)) {
    await pool.query(`
      CREATE ROLE ${login}
        LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS
        PASSWORD ${quoteLiteral(password)}
        ${login === logins.bootstrap ? `VALID UNTIL ${quoteLiteral(bootstrapExpiry)}` : ''};
      GRANT ${parentRoles.join(', ')} TO ${login}
        WITH INHERIT FALSE, SET TRUE, ADMIN FALSE;
      REVOKE CREATE, TEMPORARY ON DATABASE ${database} FROM ${login};
      GRANT CONNECT ON DATABASE ${database} TO ${login}
    `);
  }
}

async function removeJourneyState(pool: Pool): Promise<void> {
  await pool.query(`DROP SCHEMA IF EXISTS ${B3_SCHEMA} CASCADE`);
  await pool.query(`DROP TABLE IF EXISTS ${B3_MIGRATION_TABLE}`);
  for (const login of Object.values(logins)) {
    await pool.query(`
      DROP OWNED BY ${login};
      DROP ROLE IF EXISTS ${login}
    `).catch(async () => {
      await pool.query(`DROP ROLE IF EXISTS ${login}`);
    });
  }
}

function quoteLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

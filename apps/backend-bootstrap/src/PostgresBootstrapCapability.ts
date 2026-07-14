import { Client, type ClientConfig, type QueryResultRow } from 'pg';
import {
  assertOperatorPrincipal,
  copyValidatedBootstrapDatabaseTarget,
  type BootstrapDatabaseTarget,
} from './databaseTarget.js';
import type {
  BootstrapCapability,
  BootstrapOrganizationResult,
  VerifiedBootstrapRequest,
} from './types.js';

const canonicalUuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
type DatabaseRejectionReason =
  | 'identity_unavailable'
  | 'invalid_request'
  | 'operator_not_authorized'
  | 'operator_replay_forbidden'
  | 'request_id_conflict';

interface CapabilityRow extends QueryResultRow {
  readonly result_status: string;
  readonly idempotent_retry: boolean;
  readonly result_user_id: string | null;
  readonly result_identity_binding_id: string | null;
  readonly result_organization_id: string | null;
  readonly result_membership_id: string | null;
}

export type BootstrapClientFactory = (configuration: ClientConfig) => Client;

export interface PostgresBootstrapCapabilityConfiguration {
  readonly target: BootstrapDatabaseTarget;
  readonly operatorPrincipal: string;
  readonly passwordProvider: () => Promise<string>;
  readonly clientFactory?: BootstrapClientFactory;
}

export class PostgresBootstrapCapability implements BootstrapCapability {
  private readonly clientFactory: BootstrapClientFactory;

  constructor(private readonly configuration: PostgresBootstrapCapabilityConfiguration) {
    this.clientFactory = configuration.clientFactory ?? ((clientConfiguration) => new Client(clientConfiguration));
  }

  async execute(request: VerifiedBootstrapRequest): Promise<BootstrapOrganizationResult> {
    let target: BootstrapDatabaseTarget;
    try {
      assertOperatorPrincipal(this.configuration.operatorPrincipal);
      target = copyValidatedBootstrapDatabaseTarget(this.configuration.target);
    } catch {
      throw new Error('bootstrap_database_unavailable');
    }
    const password = await this.configuration.passwordProvider();
    if (password.length < 1 || Buffer.byteLength(password, 'utf8') > 4_096) {
      throw new Error('bootstrap_database_unavailable');
    }
    const clientConfiguration: ClientConfig = {
      host: target.host,
      port: target.port,
      database: target.database,
      user: this.configuration.operatorPrincipal,
      password,
      ssl: target.ssl,
      application_name: 'taptime-c3b-bootstrap',
      connectionTimeoutMillis: 10_000,
      keepAlive: true,
      options: '',
    };
    const client = this.clientFactory(clientConfiguration);
    let transactionOpen = false;
    try {
      await client.connect();
      await client.query('BEGIN READ WRITE');
      transactionOpen = true;
      await client.query("SET LOCAL statement_timeout = '30s'");
      await client.query("SET LOCAL lock_timeout = '10s'");
      const before = await client.query<{ session_user: string; current_user: string }>(
        'SELECT session_user, current_user',
      );
      if (
        before.rowCount !== 1
        || before.rows[0]?.session_user !== this.configuration.operatorPrincipal
        || before.rows[0]?.current_user !== this.configuration.operatorPrincipal
      ) {
        throw new Error('bootstrap_database_unavailable');
      }
      await client.query('SET LOCAL ROLE taptime_bootstrap_executor');
      const assumed = await client.query<{ session_user: string; current_user: string }>(
        'SELECT session_user, current_user',
      );
      if (
        assumed.rowCount !== 1
        || assumed.rows[0]?.session_user !== this.configuration.operatorPrincipal
        || assumed.rows[0]?.current_user !== 'taptime_bootstrap_executor'
      ) {
        throw new Error('bootstrap_database_unavailable');
      }

      const result = await client.query<CapabilityRow>(
        `SELECT * FROM taptime_server.bootstrap_first_organization($1::uuid, $2::text, $3::text, $4::text)`,
        [
          request.requestId,
          request.canonicalOrganizationName,
          request.identity.issuer,
          request.identity.subject,
        ],
      );
      if (result.rowCount !== 1 || result.rows[0] === undefined) {
        throw new Error('bootstrap_database_unavailable');
      }
      const mapped = mapCapabilityRow(result.rows[0]);
      await client.query('COMMIT');
      transactionOpen = false;
      return mapped;
    } catch {
      if (transactionOpen) {
        try {
          await client.query('ROLLBACK');
        } catch {
          // The caller receives one fixed infrastructure result; raw driver errors stay private.
        }
      }
      throw new Error('bootstrap_database_unavailable');
    } finally {
      await client.end().catch(() => undefined);
    }
  }
}

function mapCapabilityRow(row: CapabilityRow): BootstrapOrganizationResult {
  if (typeof row.idempotent_retry !== 'boolean') {
    throw new Error('bootstrap_database_unavailable');
  }
  if (row.result_status === 'succeeded') {
    const ids = [
      row.result_user_id,
      row.result_identity_binding_id,
      row.result_organization_id,
      row.result_membership_id,
    ];
    if (!ids.every((value) => typeof value === 'string' && canonicalUuidPattern.test(value))) {
      throw new Error('bootstrap_database_unavailable');
    }
    return Object.freeze({
      status: 'succeeded',
      idempotentRetry: row.idempotent_retry,
      userId: row.result_user_id!,
      identityBindingId: row.result_identity_binding_id!,
      organizationId: row.result_organization_id!,
      membershipId: row.result_membership_id!,
    });
  }
  const knownRejections = new Set<DatabaseRejectionReason>([
    'identity_unavailable',
    'invalid_request',
    'operator_not_authorized',
    'operator_replay_forbidden',
    'request_id_conflict',
  ]);
  if (
    !knownRejections.has(row.result_status as DatabaseRejectionReason)
    || row.idempotent_retry !== false
    || row.result_user_id !== null
    || row.result_identity_binding_id !== null
    || row.result_organization_id !== null
    || row.result_membership_id !== null
  ) {
    throw new Error('bootstrap_database_unavailable');
  }
  return {
    status: 'rejected',
    reason: row.result_status as DatabaseRejectionReason,
  };
}

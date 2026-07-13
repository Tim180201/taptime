import type { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import type { B1RequestContext, B1TableCounts } from './types.js';

export const B1_SCHEMA = 'b1_spike';
export const B1_APPLICATION_ROLE = 'taptime_b1_app';
export const B1_RUNTIME_ROLE = 'taptime_b1_runtime';

export type B1QueryObserver = (text: string, values: readonly unknown[]) => void;

export async function executeUnnamedQuery<Row extends QueryResultRow = QueryResultRow>(
  client: PoolClient,
  text: string,
  values: readonly unknown[] = [],
  observer?: B1QueryObserver,
): Promise<QueryResult<Row>> {
  observer?.(text, values);
  return client.query<Row>(text, [...values]);
}

export async function withTenantTransaction<Value>(
  pool: Pool,
  context: B1RequestContext,
  operation: (client: PoolClient) => Promise<Value>,
): Promise<Value> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL ROLE ${B1_APPLICATION_ROLE}`);
    await client.query(
      "SELECT set_config('app.organization_id', $1, true), set_config('app.user_id', $2, true)",
      [context.organizationId, context.userId],
    );
    const value = await operation(client);
    await client.query('COMMIT');
    return value;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function installB1Schema(pool: Pool, syntheticRuntimePassword: string): Promise<void> {
  if (syntheticRuntimePassword.length === 0) {
    throw new Error('Synthetic B1 runtime password must not be empty');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${B1_APPLICATION_ROLE}') THEN
        CREATE ROLE ${B1_APPLICATION_ROLE} NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${B1_RUNTIME_ROLE}') THEN
        CREATE ROLE ${B1_RUNTIME_ROLE} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
      END IF;
    END
    $$;

    ALTER ROLE ${B1_APPLICATION_ROLE} NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
    ALTER ROLE ${B1_RUNTIME_ROLE} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
    GRANT ${B1_APPLICATION_ROLE} TO ${B1_RUNTIME_ROLE};
    `);

    await client.query(
      "SELECT set_config('b1.synthetic_runtime_password', $1, true)",
      [syntheticRuntimePassword],
    );
    await client.query(`
      DO $$
      BEGIN
        EXECUTE format(
          'ALTER ROLE ${B1_RUNTIME_ROLE} PASSWORD %L',
          current_setting('b1.synthetic_runtime_password')
        );
      END
      $$;
    `);

    await client.query(`

    DROP SCHEMA IF EXISTS ${B1_SCHEMA} CASCADE;
    CREATE SCHEMA ${B1_SCHEMA};
    REVOKE ALL ON SCHEMA ${B1_SCHEMA} FROM PUBLIC;

    CREATE TABLE ${B1_SCHEMA}.work_events (
      organization_id text NOT NULL,
      id text NOT NULL,
      assignment_id text NOT NULL,
      nfc_tag_id text NOT NULL,
      target_type text NOT NULL,
      target_id text NOT NULL,
      triggered_by text NOT NULL,
      occurred_at timestamptz NOT NULL,
      received_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
      content_hash char(64) NOT NULL,
      content_hash_algorithm text NOT NULL CHECK (content_hash_algorithm = 'sha256'),
      content_hash_version smallint NOT NULL CHECK (content_hash_version = 1),
      PRIMARY KEY (organization_id, id),
      CONSTRAINT work_events_organization_user_id_unique
        UNIQUE (organization_id, triggered_by, id)
    );

    CREATE TABLE ${B1_SCHEMA}.time_entries (
      organization_id text NOT NULL,
      id text NOT NULL,
      user_id text NOT NULL,
      target_type text NOT NULL,
      target_id text NOT NULL,
      status text NOT NULL CHECK (status IN ('started', 'stopped')),
      started_at timestamptz NOT NULL,
      start_work_event_id text NOT NULL,
      stopped_at timestamptz,
      stop_work_event_id text,
      PRIMARY KEY (organization_id, id),
      CONSTRAINT time_entries_organization_user_id_unique
        UNIQUE (organization_id, user_id, id),
      FOREIGN KEY (organization_id, start_work_event_id)
        REFERENCES ${B1_SCHEMA}.work_events (organization_id, id),
      CONSTRAINT time_entries_start_work_event_user_fk
        FOREIGN KEY (organization_id, user_id, start_work_event_id)
        REFERENCES ${B1_SCHEMA}.work_events (organization_id, triggered_by, id),
      FOREIGN KEY (organization_id, stop_work_event_id)
        REFERENCES ${B1_SCHEMA}.work_events (organization_id, id),
      CONSTRAINT time_entries_stop_work_event_user_fk
        FOREIGN KEY (organization_id, user_id, stop_work_event_id)
        REFERENCES ${B1_SCHEMA}.work_events (organization_id, triggered_by, id),
      CHECK (
        (status = 'started' AND stopped_at IS NULL AND stop_work_event_id IS NULL)
        OR
        (status = 'stopped' AND stopped_at IS NOT NULL AND stop_work_event_id IS NOT NULL)
      )
    );

    CREATE UNIQUE INDEX one_active_time_entry_per_organization_user
      ON ${B1_SCHEMA}.time_entries (organization_id, user_id)
      WHERE status = 'started';

    CREATE TABLE ${B1_SCHEMA}.work_event_decisions (
      organization_id text NOT NULL,
      work_event_id text NOT NULL,
      actor_user_id text NOT NULL,
      decision_status text NOT NULL,
      escalation_reason text,
      time_entry_id text,
      engine_version text NOT NULL,
      decision_payload jsonb NOT NULL,
      decided_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
      PRIMARY KEY (organization_id, work_event_id),
      FOREIGN KEY (organization_id, work_event_id)
        REFERENCES ${B1_SCHEMA}.work_events (organization_id, id),
      CONSTRAINT work_event_decisions_work_event_user_fk
        FOREIGN KEY (organization_id, actor_user_id, work_event_id)
        REFERENCES ${B1_SCHEMA}.work_events (organization_id, triggered_by, id),
      FOREIGN KEY (organization_id, time_entry_id)
        REFERENCES ${B1_SCHEMA}.time_entries (organization_id, id),
      CONSTRAINT work_event_decisions_time_entry_user_fk
        FOREIGN KEY (organization_id, actor_user_id, time_entry_id)
        REFERENCES ${B1_SCHEMA}.time_entries (organization_id, user_id, id)
    );

    CREATE TABLE ${B1_SCHEMA}.sync_receipts (
      organization_id text NOT NULL,
      work_event_id text NOT NULL,
      actor_user_id text NOT NULL,
      request_id text NOT NULL,
      outcome text NOT NULL,
      local_time_entry_id text,
      server_time_entry_id text,
      received_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
      PRIMARY KEY (organization_id, work_event_id),
      FOREIGN KEY (organization_id, work_event_id)
        REFERENCES ${B1_SCHEMA}.work_events (organization_id, id),
      CONSTRAINT sync_receipts_work_event_user_fk
        FOREIGN KEY (organization_id, actor_user_id, work_event_id)
        REFERENCES ${B1_SCHEMA}.work_events (organization_id, triggered_by, id),
      FOREIGN KEY (organization_id, server_time_entry_id)
        REFERENCES ${B1_SCHEMA}.time_entries (organization_id, id),
      CONSTRAINT sync_receipts_time_entry_user_fk
        FOREIGN KEY (organization_id, actor_user_id, server_time_entry_id)
        REFERENCES ${B1_SCHEMA}.time_entries (organization_id, user_id, id)
    );

    CREATE TABLE ${B1_SCHEMA}.audit_events (
      organization_id text NOT NULL,
      id text NOT NULL,
      work_event_id text NOT NULL,
      actor_user_id text NOT NULL,
      event_type text NOT NULL,
      payload jsonb NOT NULL,
      recorded_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
      PRIMARY KEY (organization_id, id),
      FOREIGN KEY (organization_id, work_event_id)
        REFERENCES ${B1_SCHEMA}.work_events (organization_id, id),
      CONSTRAINT audit_events_work_event_user_fk
        FOREIGN KEY (organization_id, actor_user_id, work_event_id)
        REFERENCES ${B1_SCHEMA}.work_events (organization_id, triggered_by, id)
    );

    ALTER TABLE ${B1_SCHEMA}.work_events ENABLE ROW LEVEL SECURITY;
    ALTER TABLE ${B1_SCHEMA}.work_events FORCE ROW LEVEL SECURITY;
    CREATE POLICY work_events_select ON ${B1_SCHEMA}.work_events
      FOR SELECT TO ${B1_APPLICATION_ROLE}
      USING (
        organization_id = NULLIF(current_setting('app.organization_id', true), '')
        AND triggered_by = NULLIF(current_setting('app.user_id', true), '')
      );
    CREATE POLICY work_events_insert ON ${B1_SCHEMA}.work_events
      FOR INSERT TO ${B1_APPLICATION_ROLE}
      WITH CHECK (
        organization_id = NULLIF(current_setting('app.organization_id', true), '')
        AND triggered_by = NULLIF(current_setting('app.user_id', true), '')
      );

    ALTER TABLE ${B1_SCHEMA}.time_entries ENABLE ROW LEVEL SECURITY;
    ALTER TABLE ${B1_SCHEMA}.time_entries FORCE ROW LEVEL SECURITY;
    CREATE POLICY time_entries_select ON ${B1_SCHEMA}.time_entries
      FOR SELECT TO ${B1_APPLICATION_ROLE}
      USING (
        organization_id = NULLIF(current_setting('app.organization_id', true), '')
        AND user_id = NULLIF(current_setting('app.user_id', true), '')
      );
    CREATE POLICY time_entries_insert ON ${B1_SCHEMA}.time_entries
      FOR INSERT TO ${B1_APPLICATION_ROLE}
      WITH CHECK (
        organization_id = NULLIF(current_setting('app.organization_id', true), '')
        AND user_id = NULLIF(current_setting('app.user_id', true), '')
      );
    CREATE POLICY time_entries_update ON ${B1_SCHEMA}.time_entries
      FOR UPDATE TO ${B1_APPLICATION_ROLE}
      USING (
        organization_id = NULLIF(current_setting('app.organization_id', true), '')
        AND user_id = NULLIF(current_setting('app.user_id', true), '')
      )
      WITH CHECK (
        organization_id = NULLIF(current_setting('app.organization_id', true), '')
        AND user_id = NULLIF(current_setting('app.user_id', true), '')
      );

    ALTER TABLE ${B1_SCHEMA}.work_event_decisions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE ${B1_SCHEMA}.work_event_decisions FORCE ROW LEVEL SECURITY;
    CREATE POLICY work_event_decisions_select ON ${B1_SCHEMA}.work_event_decisions
      FOR SELECT TO ${B1_APPLICATION_ROLE}
      USING (
        organization_id = NULLIF(current_setting('app.organization_id', true), '')
        AND actor_user_id = NULLIF(current_setting('app.user_id', true), '')
      );
    CREATE POLICY work_event_decisions_insert ON ${B1_SCHEMA}.work_event_decisions
      FOR INSERT TO ${B1_APPLICATION_ROLE}
      WITH CHECK (
        organization_id = NULLIF(current_setting('app.organization_id', true), '')
        AND actor_user_id = NULLIF(current_setting('app.user_id', true), '')
      );

    ALTER TABLE ${B1_SCHEMA}.sync_receipts ENABLE ROW LEVEL SECURITY;
    ALTER TABLE ${B1_SCHEMA}.sync_receipts FORCE ROW LEVEL SECURITY;
    CREATE POLICY sync_receipts_select ON ${B1_SCHEMA}.sync_receipts
      FOR SELECT TO ${B1_APPLICATION_ROLE}
      USING (
        organization_id = NULLIF(current_setting('app.organization_id', true), '')
        AND actor_user_id = NULLIF(current_setting('app.user_id', true), '')
      );
    CREATE POLICY sync_receipts_insert ON ${B1_SCHEMA}.sync_receipts
      FOR INSERT TO ${B1_APPLICATION_ROLE}
      WITH CHECK (
        organization_id = NULLIF(current_setting('app.organization_id', true), '')
        AND actor_user_id = NULLIF(current_setting('app.user_id', true), '')
      );

    ALTER TABLE ${B1_SCHEMA}.audit_events ENABLE ROW LEVEL SECURITY;
    ALTER TABLE ${B1_SCHEMA}.audit_events FORCE ROW LEVEL SECURITY;
    CREATE POLICY audit_events_select ON ${B1_SCHEMA}.audit_events
      FOR SELECT TO ${B1_APPLICATION_ROLE}
      USING (
        organization_id = NULLIF(current_setting('app.organization_id', true), '')
        AND actor_user_id = NULLIF(current_setting('app.user_id', true), '')
      );
    CREATE POLICY audit_events_insert ON ${B1_SCHEMA}.audit_events
      FOR INSERT TO ${B1_APPLICATION_ROLE}
      WITH CHECK (
        organization_id = NULLIF(current_setting('app.organization_id', true), '')
        AND actor_user_id = NULLIF(current_setting('app.user_id', true), '')
      );

    REVOKE ALL ON ALL TABLES IN SCHEMA ${B1_SCHEMA} FROM PUBLIC;
    GRANT USAGE ON SCHEMA ${B1_SCHEMA} TO ${B1_APPLICATION_ROLE};
    GRANT SELECT, INSERT ON ${B1_SCHEMA}.work_events TO ${B1_APPLICATION_ROLE};
    GRANT SELECT, INSERT ON ${B1_SCHEMA}.work_event_decisions TO ${B1_APPLICATION_ROLE};
    GRANT SELECT, INSERT ON ${B1_SCHEMA}.audit_events TO ${B1_APPLICATION_ROLE};
    GRANT SELECT, INSERT ON ${B1_SCHEMA}.sync_receipts TO ${B1_APPLICATION_ROLE};
    GRANT SELECT, INSERT ON ${B1_SCHEMA}.time_entries TO ${B1_APPLICATION_ROLE};
    GRANT UPDATE (status, stopped_at, stop_work_event_id)
      ON ${B1_SCHEMA}.time_entries TO ${B1_APPLICATION_ROLE};
    `);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function truncateB1Schema(pool: Pool): Promise<void> {
  await pool.query(`
    TRUNCATE TABLE
      ${B1_SCHEMA}.audit_events,
      ${B1_SCHEMA}.sync_receipts,
      ${B1_SCHEMA}.work_event_decisions,
      ${B1_SCHEMA}.time_entries,
      ${B1_SCHEMA}.work_events
    CASCADE
  `);
}

export async function countB1Rows(pool: Pool): Promise<B1TableCounts> {
  const result = await pool.query<{
    work_events: string;
    work_event_decisions: string;
    time_entries: string;
    sync_receipts: string;
    audit_events: string;
  }>(`
    SELECT
      (SELECT count(*) FROM ${B1_SCHEMA}.work_events) AS work_events,
      (SELECT count(*) FROM ${B1_SCHEMA}.work_event_decisions) AS work_event_decisions,
      (SELECT count(*) FROM ${B1_SCHEMA}.time_entries) AS time_entries,
      (SELECT count(*) FROM ${B1_SCHEMA}.sync_receipts) AS sync_receipts,
      (SELECT count(*) FROM ${B1_SCHEMA}.audit_events) AS audit_events
  `);
  const row = result.rows[0];
  if (row === undefined) {
    throw new Error('B1 count query returned no row');
  }

  return {
    workEvents: Number(row.work_events),
    workEventDecisions: Number(row.work_event_decisions),
    timeEntries: Number(row.time_entries),
    syncReceipts: Number(row.sync_receipts),
    auditEvents: Number(row.audit_events),
  };
}

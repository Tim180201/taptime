DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'taptime_time_review_reader') THEN
    CREATE ROLE taptime_time_review_reader
      NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'taptime_time_review_writer') THEN
    CREATE ROLE taptime_time_review_writer
      NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'taptime_time_review_read_function_owner'
  ) THEN
    CREATE ROLE taptime_time_review_read_function_owner
      NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT BYPASSRLS;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'taptime_time_review_write_function_owner'
  ) THEN
    CREATE ROLE taptime_time_review_write_function_owner
      NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT BYPASSRLS;
  END IF;
END
$roles$;

ALTER ROLE taptime_time_review_reader WITH
  NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
ALTER ROLE taptime_time_review_writer WITH
  NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
ALTER ROLE taptime_time_review_read_function_owner WITH
  NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION BYPASSRLS;
ALTER ROLE taptime_time_review_write_function_owner WITH
  NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION BYPASSRLS;

DO $normalize_role_graph$
DECLARE
  role_name text;
  role_oid oid;
  database_oid oid := (
    SELECT database.oid
    FROM pg_catalog.pg_database AS database
    WHERE database.datname = pg_catalog.current_database()
  );
  parent_name text;
  member_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY[
    'taptime_time_review_reader',
    'taptime_time_review_writer',
    'taptime_time_review_read_function_owner',
    'taptime_time_review_write_function_owner'
  ]
  LOOP
    SELECT role.oid INTO STRICT role_oid
    FROM pg_catalog.pg_roles AS role
    WHERE role.rolname = role_name;

    FOR parent_name IN
      SELECT parent.rolname
      FROM pg_catalog.pg_auth_members AS edge
      JOIN pg_catalog.pg_roles AS member ON member.oid = edge.member
      JOIN pg_catalog.pg_roles AS parent ON parent.oid = edge.roleid
      WHERE member.rolname = role_name
    LOOP
      EXECUTE pg_catalog.format('REVOKE %I FROM %I', parent_name, role_name);
    END LOOP;

    FOR member_name IN
      SELECT member.rolname
      FROM pg_catalog.pg_auth_members AS edge
      JOIN pg_catalog.pg_roles AS member ON member.oid = edge.member
      JOIN pg_catalog.pg_roles AS parent ON parent.oid = edge.roleid
      WHERE parent.rolname = role_name
    LOOP
      EXECUTE pg_catalog.format('REVOKE %I FROM %I', role_name, member_name);
    END LOOP;

    IF EXISTS (
      SELECT 1
      FROM pg_catalog.pg_shdepend AS dependency
      WHERE dependency.refclassid = 'pg_catalog.pg_authid'::pg_catalog.regclass
        AND dependency.refobjid = role_oid
        AND dependency.dbid IN (0, database_oid)
    ) OR EXISTS (
      SELECT 1
      FROM pg_catalog.pg_db_role_setting AS role_setting
      WHERE role_setting.setrole = role_oid
        AND role_setting.setdatabase IN (0, database_oid)
    ) THEN
      RAISE EXCEPTION 'DA3 review roles must have no pre-existing ownership, ACL, policy, default-ACL, role-setting or shared-object dependency in this database'
        USING ERRCODE = '42501';
    END IF;
  END LOOP;
END
$normalize_role_graph$;

REVOKE ALL ON ALL TABLES IN SCHEMA taptime_server FROM
  taptime_time_review_reader,
  taptime_time_review_writer,
  taptime_time_review_read_function_owner,
  taptime_time_review_write_function_owner;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA taptime_server FROM
  taptime_time_review_reader,
  taptime_time_review_writer,
  taptime_time_review_read_function_owner,
  taptime_time_review_write_function_owner;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA taptime_server FROM
  taptime_time_review_reader,
  taptime_time_review_writer,
  taptime_time_review_read_function_owner,
  taptime_time_review_write_function_owner;

GRANT USAGE ON SCHEMA taptime_server TO
  taptime_time_review_reader,
  taptime_time_review_writer,
  taptime_time_review_read_function_owner,
  taptime_time_review_write_function_owner;

CREATE TABLE taptime_server.time_record_revisions (
  organization_id uuid NOT NULL REFERENCES taptime_server.organizations (id),
  time_record_id uuid NOT NULL,
  revision_number bigint NOT NULL CHECK (revision_number > 0),
  canonical_time_entry_id uuid,
  user_id uuid NOT NULL,
  target_type text NOT NULL CHECK (target_type = 'customer'),
  target_customer_id uuid NOT NULL,
  effective_started_at timestamptz NOT NULL,
  effective_stopped_at timestamptz NOT NULL,
  base_row_version bigint NOT NULL CHECK (base_row_version >= 0),
  actor_user_id uuid NOT NULL,
  actor_membership_id uuid NOT NULL,
  reason text NOT NULL CHECK (pg_catalog.char_length(pg_catalog.btrim(reason)) BETWEEN 1 AND 500),
  previous_revision_number bigint,
  command_id uuid NOT NULL,
  request_hash char(64) NOT NULL CHECK (request_hash COLLATE "C" ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT pg_catalog.transaction_timestamp(),
  PRIMARY KEY (organization_id, time_record_id, revision_number),
  CONSTRAINT time_record_revisions_command_unique UNIQUE (organization_id, command_id),
  CONSTRAINT time_record_revisions_identity_unique UNIQUE (
    organization_id, user_id, target_type, target_customer_id, time_record_id, revision_number
  ),
  CONSTRAINT time_record_revisions_canonical_fk FOREIGN KEY (
    organization_id, user_id, target_type, target_customer_id, canonical_time_entry_id
  ) REFERENCES taptime_server.time_entries (
    organization_id, user_id, target_type, target_customer_id, id
  ),
  CONSTRAINT time_record_revisions_customer_fk FOREIGN KEY (
    organization_id, target_customer_id
  ) REFERENCES taptime_server.customers (organization_id, id),
  CONSTRAINT time_record_revisions_actor_fk FOREIGN KEY (
    organization_id, actor_user_id, actor_membership_id
  ) REFERENCES taptime_server.memberships (organization_id, user_id, id),
  CONSTRAINT time_record_revisions_previous_fk FOREIGN KEY (
    organization_id, time_record_id, previous_revision_number
  ) REFERENCES taptime_server.time_record_revisions (
    organization_id, time_record_id, revision_number
  ),
  CONSTRAINT time_record_revisions_interval CHECK (
    effective_started_at <= effective_stopped_at
  ),
  CONSTRAINT time_record_revisions_canonical_identity CHECK (
    canonical_time_entry_id IS NULL OR canonical_time_entry_id = time_record_id
  ),
  CONSTRAINT time_record_revisions_previous_shape CHECK (
    (revision_number = 1 AND previous_revision_number IS NULL)
    OR (revision_number > 1 AND previous_revision_number = revision_number - 1)
  )
);

CREATE TABLE taptime_server.time_review_command_receipts (
  organization_id uuid NOT NULL REFERENCES taptime_server.organizations (id),
  command_id uuid NOT NULL,
  actor_user_id uuid NOT NULL,
  actor_membership_id uuid NOT NULL,
  command_type text NOT NULL CHECK (command_type IN ('correction', 'adjudication')),
  request_hash char(64) NOT NULL CHECK (request_hash COLLATE "C" ~ '^[0-9a-f]{64}$'),
  result_payload jsonb NOT NULL CHECK (pg_catalog.jsonb_typeof(result_payload) = 'object'),
  created_at timestamptz NOT NULL DEFAULT pg_catalog.transaction_timestamp(),
  PRIMARY KEY (organization_id, command_id),
  CONSTRAINT time_review_receipts_actor_fk FOREIGN KEY (
    organization_id, actor_user_id, actor_membership_id
  ) REFERENCES taptime_server.memberships (organization_id, user_id, id)
);

CREATE TABLE taptime_server.offline_review_adjudications (
  organization_id uuid NOT NULL REFERENCES taptime_server.organizations (id),
  work_event_id uuid NOT NULL,
  user_id uuid NOT NULL,
  target_type text NOT NULL CHECK (target_type = 'customer'),
  target_customer_id uuid NOT NULL,
  source_family text NOT NULL CHECK (source_family IN ('offline_v2', 'server_legacy')),
  installation_id uuid,
  device_sequence bigint,
  actor_user_id uuid NOT NULL,
  actor_membership_id uuid NOT NULL,
  resolution text NOT NULL CHECK (resolution IN (
    'no_time_record_change', 'adjust_existing_time_record', 'create_recovered_time_record'
  )),
  reason text NOT NULL CHECK (pg_catalog.char_length(pg_catalog.btrim(reason)) BETWEEN 1 AND 500),
  command_id uuid NOT NULL,
  time_record_id uuid,
  revision_number bigint,
  decided_at timestamptz NOT NULL DEFAULT pg_catalog.transaction_timestamp(),
  PRIMARY KEY (organization_id, work_event_id),
  CONSTRAINT offline_review_adjudications_command_item_unique UNIQUE (
    organization_id, command_id, work_event_id
  ),
  CONSTRAINT offline_review_adjudications_event_fk FOREIGN KEY (
    organization_id, user_id, target_type, target_customer_id, work_event_id
  ) REFERENCES taptime_server.work_events (
    organization_id, triggered_by_user_id, target_type, target_customer_id, id
  ),
  CONSTRAINT offline_review_adjudications_actor_fk FOREIGN KEY (
    organization_id, actor_user_id, actor_membership_id
  ) REFERENCES taptime_server.memberships (organization_id, user_id, id),
  CONSTRAINT offline_review_adjudications_revision_fk FOREIGN KEY (
    organization_id, time_record_id, revision_number
  ) REFERENCES taptime_server.time_record_revisions (
    organization_id, time_record_id, revision_number
  ),
  CONSTRAINT offline_review_adjudications_source_shape CHECK (
    (source_family = 'offline_v2' AND installation_id IS NOT NULL AND device_sequence > 0)
    OR (source_family = 'server_legacy' AND installation_id IS NULL AND device_sequence IS NULL)
  ),
  CONSTRAINT offline_review_adjudications_result_shape CHECK (
    (resolution = 'no_time_record_change' AND time_record_id IS NULL AND revision_number IS NULL)
    OR (
      resolution IN ('adjust_existing_time_record', 'create_recovered_time_record')
      AND time_record_id IS NOT NULL AND revision_number IS NOT NULL
    )
  )
);

CREATE INDEX time_record_revisions_latest
  ON taptime_server.time_record_revisions (organization_id, time_record_id, revision_number DESC);
CREATE INDEX offline_review_adjudications_command
  ON taptime_server.offline_review_adjudications (organization_id, command_id);

CREATE FUNCTION taptime_server.reject_time_review_immutable_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $immutable$
BEGIN
  RAISE EXCEPTION 'Time review ledgers are append-only' USING ERRCODE = '55000';
END
$immutable$;

REVOKE ALL ON FUNCTION taptime_server.reject_time_review_immutable_change() FROM PUBLIC;

CREATE TRIGGER time_record_revisions_immutable
  BEFORE UPDATE OR DELETE ON taptime_server.time_record_revisions
  FOR EACH ROW EXECUTE FUNCTION taptime_server.reject_time_review_immutable_change();
CREATE TRIGGER time_review_command_receipts_immutable
  BEFORE UPDATE OR DELETE ON taptime_server.time_review_command_receipts
  FOR EACH ROW EXECUTE FUNCTION taptime_server.reject_time_review_immutable_change();
CREATE TRIGGER offline_review_adjudications_immutable
  BEFORE UPDATE OR DELETE ON taptime_server.offline_review_adjudications
  FOR EACH ROW EXECUTE FUNCTION taptime_server.reject_time_review_immutable_change();

CREATE FUNCTION taptime_server.enforce_time_record_revision_chain_v1()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $revision$
DECLARE
  previous_revision taptime_server.time_record_revisions%ROWTYPE;
BEGIN
  IF NEW.revision_number = 1 THEN
    IF EXISTS (
      SELECT 1 FROM taptime_server.time_record_revisions AS revision
      WHERE revision.organization_id = NEW.organization_id
        AND revision.time_record_id = NEW.time_record_id
    ) THEN
      RAISE EXCEPTION 'Time-record revision chain must start once' USING ERRCODE = '23514';
    END IF;
  ELSE
    SELECT revision.* INTO previous_revision
    FROM taptime_server.time_record_revisions AS revision
    WHERE revision.organization_id = NEW.organization_id
      AND revision.time_record_id = NEW.time_record_id
      AND revision.revision_number = NEW.revision_number - 1;
    IF NOT FOUND
      OR previous_revision.user_id <> NEW.user_id
      OR previous_revision.target_type <> NEW.target_type
      OR previous_revision.target_customer_id <> NEW.target_customer_id
      OR previous_revision.canonical_time_entry_id IS DISTINCT FROM NEW.canonical_time_entry_id
    THEN
      RAISE EXCEPTION 'Time-record revision chain is not contiguous' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.canonical_time_entry_id IS NULL AND NEW.revision_number = 1 AND NEW.base_row_version <> 0 THEN
    RAISE EXCEPTION 'Recovered time record must begin at base row version zero'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$revision$;

REVOKE ALL ON FUNCTION taptime_server.enforce_time_record_revision_chain_v1() FROM PUBLIC;
CREATE TRIGGER time_record_revisions_chain
  BEFORE INSERT ON taptime_server.time_record_revisions
  FOR EACH ROW EXECUTE FUNCTION taptime_server.enforce_time_record_revision_chain_v1();

ALTER TABLE taptime_server.time_record_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.time_record_revisions FORCE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.time_review_command_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.time_review_command_receipts FORCE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.offline_review_adjudications ENABLE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.offline_review_adjudications FORCE ROW LEVEL SECURITY;

CREATE VIEW taptime_server.effective_time_records_v1
WITH (security_invoker = true)
AS
WITH latest_revision AS (
  SELECT DISTINCT ON (revision.organization_id, revision.time_record_id)
    revision.organization_id,
    revision.time_record_id,
    revision.revision_number,
    revision.canonical_time_entry_id,
    revision.user_id,
    revision.target_type,
    revision.target_customer_id,
    revision.effective_started_at,
    revision.effective_stopped_at,
    revision.base_row_version
  FROM taptime_server.time_record_revisions AS revision
  ORDER BY revision.organization_id, revision.time_record_id, revision.revision_number DESC
)
SELECT
  entry.organization_id,
  entry.id AS time_record_id,
  entry.id AS canonical_time_entry_id,
  entry.user_id,
  entry.target_type,
  entry.target_customer_id,
  entry.status,
  COALESCE(revision.effective_started_at, entry.started_at) AS effective_started_at,
  CASE
    WHEN entry.status = 'started' THEN NULL
    ELSE COALESCE(revision.effective_stopped_at, entry.stopped_at)
  END AS effective_stopped_at,
  entry.row_version AS base_row_version,
  COALESCE(revision.revision_number, 0::bigint) AS effective_revision_number,
  'canonical'::text AS source
FROM taptime_server.time_entries AS entry
LEFT JOIN latest_revision AS revision
  ON revision.organization_id = entry.organization_id
 AND revision.time_record_id = entry.id
UNION ALL
SELECT
  revision.organization_id,
  revision.time_record_id,
  NULL::uuid AS canonical_time_entry_id,
  revision.user_id,
  revision.target_type,
  revision.target_customer_id,
  'stopped'::text AS status,
  revision.effective_started_at,
  revision.effective_stopped_at,
  0::bigint AS base_row_version,
  revision.revision_number AS effective_revision_number,
  'recovered'::text AS source
FROM latest_revision AS revision
WHERE revision.canonical_time_entry_id IS NULL;

REVOKE ALL ON taptime_server.effective_time_records_v1 FROM PUBLIC;

GRANT SELECT ON
  taptime_server.identity_bindings,
  taptime_server.memberships,
  taptime_server.organizations,
  taptime_server.customers,
  taptime_server.time_entries,
  taptime_server.work_events,
  taptime_server.canonical_decisions,
  taptime_server.audit_events,
  taptime_server.offline_event_reconciliations,
  taptime_server.offline_review_adjudications,
  taptime_server.time_record_revisions
TO taptime_time_review_read_function_owner;
GRANT SELECT ON taptime_server.effective_time_records_v1
  TO taptime_time_review_read_function_owner;

GRANT SELECT ON
  taptime_server.identity_bindings,
  taptime_server.memberships,
  taptime_server.customers,
  taptime_server.time_entries,
  taptime_server.work_events,
  taptime_server.canonical_decisions,
  taptime_server.audit_events,
  taptime_server.offline_installations,
  taptime_server.offline_sync_cursors,
  taptime_server.offline_event_reconciliations,
  taptime_server.offline_review_adjudications,
  taptime_server.time_record_revisions,
  taptime_server.time_review_command_receipts
TO taptime_time_review_write_function_owner;
GRANT SELECT ON taptime_server.effective_time_records_v1
  TO taptime_time_review_write_function_owner;
GRANT INSERT ON
  taptime_server.time_record_revisions,
  taptime_server.offline_review_adjudications,
  taptime_server.time_review_command_receipts,
  taptime_server.audit_events
TO taptime_time_review_write_function_owner;
GRANT UPDATE (review_predecessor_sequence, updated_at)
  ON taptime_server.offline_sync_cursors TO taptime_time_review_write_function_owner;
-- PostgreSQL requires a narrow UPDATE privilege for SELECT ... FOR SHARE row locks. The
-- NOLOGIN function owner cannot be assumed by either runtime role, and existing immutable/shape
-- triggers still reject any corresponding data mutation.
GRANT UPDATE (id) ON taptime_server.time_entries
  TO taptime_time_review_write_function_owner;
GRANT UPDATE (time_record_id) ON taptime_server.time_record_revisions
  TO taptime_time_review_write_function_owner;

CREATE FUNCTION taptime_server.has_current_time_review_administrator_v1(
  requested_organization_id uuid,
  requested_actor_user_id uuid,
  requested_membership_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $authority$
  SELECT requested_organization_id IS NOT NULL
    AND requested_actor_user_id IS NOT NULL
    AND requested_membership_id IS NOT NULL
    AND requested_organization_id = NULLIF(
      pg_catalog.current_setting('app.organization_id', true), ''
    )::uuid
    AND requested_actor_user_id = NULLIF(
      pg_catalog.current_setting('app.user_id', true), ''
    )::uuid
    AND requested_membership_id = NULLIF(
      pg_catalog.current_setting('app.membership_id', true), ''
    )::uuid
    AND pg_catalog.current_setting('app.membership_role', true) = 'administrator'
    AND EXISTS (
      SELECT 1 FROM taptime_server.memberships AS membership
      WHERE membership.organization_id = requested_organization_id
        AND membership.user_id = requested_actor_user_id
        AND membership.id = requested_membership_id
        AND membership.role = 'administrator'
        AND membership.revoked_at IS NULL
    )
$authority$;

ALTER FUNCTION taptime_server.has_current_time_review_administrator_v1(uuid, uuid, uuid)
  OWNER TO taptime_time_review_read_function_owner;
REVOKE ALL ON FUNCTION taptime_server.has_current_time_review_administrator_v1(uuid, uuid, uuid)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.has_current_time_review_administrator_v1(uuid, uuid, uuid)
  TO taptime_time_review_reader, taptime_time_review_writer,
     taptime_time_review_write_function_owner;
GRANT SELECT (organization_id, user_id, id, role, revoked_at)
  ON taptime_server.memberships TO taptime_time_review_read_function_owner;

CREATE FUNCTION taptime_server.read_effective_time_records_v1(
  requested_organization_id uuid,
  requested_actor_user_id uuid,
  requested_membership_id uuid,
  requested_from_inclusive timestamptz,
  requested_to_exclusive timestamptz,
  requested_after_started_at timestamptz,
  requested_after_time_record_id uuid,
  requested_limit integer
)
RETURNS TABLE (
  time_record_id uuid,
  employee_membership_id uuid,
  employee_display_name text,
  customer_id uuid,
  customer_display_name text,
  source text,
  status text,
  started_at timestamptz,
  stopped_at timestamptz,
  base_row_version bigint,
  effective_revision_number bigint,
  overlaps_another_record boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $records$
BEGIN
  IF pg_catalog.current_setting('role', true) <> 'taptime_time_review_reader'
    OR NOT taptime_server.has_current_time_review_administrator_v1(
      requested_organization_id, requested_actor_user_id, requested_membership_id
    )
    OR requested_from_inclusive IS NULL
    OR requested_to_exclusive IS NULL
    OR requested_to_exclusive <= requested_from_inclusive
    OR requested_to_exclusive - requested_from_inclusive > interval '31 days'
    OR requested_limit NOT BETWEEN 1 AND 101
    OR (requested_after_started_at IS NULL) <> (requested_after_time_record_id IS NULL)
  THEN
    RAISE EXCEPTION 'Time review read capability rejected' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT record.time_record_id, membership.id, COALESCE(membership.display_name, ''),
         customer.id, customer.display_name, record.source, record.status,
         record.effective_started_at, record.effective_stopped_at,
         record.base_row_version, record.effective_revision_number,
         EXISTS (
           SELECT 1 FROM taptime_server.effective_time_records_v1 AS other
           WHERE other.organization_id = record.organization_id
             AND other.user_id = record.user_id
             AND other.time_record_id <> record.time_record_id
             AND other.effective_started_at < COALESCE(
               record.effective_stopped_at, pg_catalog.transaction_timestamp()
             )
             AND COALESCE(other.effective_stopped_at, pg_catalog.transaction_timestamp())
               > record.effective_started_at
         )
  FROM taptime_server.effective_time_records_v1 AS record
  LEFT JOIN taptime_server.memberships AS membership
    ON membership.organization_id = record.organization_id
   AND membership.user_id = record.user_id
  LEFT JOIN taptime_server.customers AS customer
    ON customer.organization_id = record.organization_id
   AND customer.id = record.target_customer_id
  WHERE record.organization_id = requested_organization_id
    AND record.effective_started_at >= requested_from_inclusive
    AND record.effective_started_at < requested_to_exclusive
    AND (
      requested_after_started_at IS NULL
      OR (record.effective_started_at, record.time_record_id)
         > (requested_after_started_at, requested_after_time_record_id)
    )
  ORDER BY record.effective_started_at, record.time_record_id
  LIMIT requested_limit;
END
$records$;

ALTER FUNCTION taptime_server.read_effective_time_records_v1(
  uuid, uuid, uuid, timestamptz, timestamptz, timestamptz, uuid, integer
) OWNER TO taptime_time_review_read_function_owner;
REVOKE ALL ON FUNCTION taptime_server.read_effective_time_records_v1(
  uuid, uuid, uuid, timestamptz, timestamptz, timestamptz, uuid, integer
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.read_effective_time_records_v1(
  uuid, uuid, uuid, timestamptz, timestamptz, timestamptz, uuid, integer
) TO taptime_time_review_reader;

CREATE FUNCTION taptime_server.read_time_review_items_v1(
  requested_organization_id uuid,
  requested_actor_user_id uuid,
  requested_membership_id uuid,
  requested_after_recorded_at timestamptz,
  requested_after_work_event_id uuid,
  requested_limit integer
)
RETURNS TABLE (
  review_item_id uuid,
  source_family text,
  employee_user_id uuid,
  employee_membership_id uuid,
  employee_display_name text,
  customer_id uuid,
  customer_display_name text,
  occurred_at timestamptz,
  recorded_at timestamptz,
  review_reason text,
  device_sequence bigint,
  predecessor_blocked boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $items$
BEGIN
  IF pg_catalog.current_setting('role', true) <> 'taptime_time_review_reader'
    OR NOT taptime_server.has_current_time_review_administrator_v1(
      requested_organization_id, requested_actor_user_id, requested_membership_id
    )
    OR requested_limit NOT BETWEEN 1 AND 101
    OR (requested_after_recorded_at IS NULL) <> (requested_after_work_event_id IS NULL)
  THEN
    RAISE EXCEPTION 'Time review item capability rejected' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH unresolved AS (
    SELECT reconciliation.work_event_id, 'offline_v2'::text AS source_family,
           reconciliation.user_id, event.target_customer_id, event.occurred_at,
           reconciliation.recorded_at, reconciliation.review_reason,
           reconciliation.device_sequence,
           EXISTS (
             SELECT 1 FROM taptime_server.offline_event_reconciliations AS later
             LEFT JOIN taptime_server.offline_review_adjudications AS later_adjudication
               ON later_adjudication.organization_id = later.organization_id
              AND later_adjudication.work_event_id = later.work_event_id
             WHERE later.organization_id = reconciliation.organization_id
               AND later.user_id = reconciliation.user_id
               AND later.installation_id = reconciliation.installation_id
               AND later.device_sequence > reconciliation.device_sequence
               AND later.result_status = 'review_pending'
               AND later.review_reason = 'predecessor_requires_review'
               AND later_adjudication.work_event_id IS NULL
           ) AS predecessor_blocked
    FROM taptime_server.offline_event_reconciliations AS reconciliation
    JOIN taptime_server.work_events AS event
      ON event.organization_id = reconciliation.organization_id
     AND event.id = reconciliation.work_event_id
    LEFT JOIN taptime_server.offline_review_adjudications AS adjudication
      ON adjudication.organization_id = reconciliation.organization_id
     AND adjudication.work_event_id = reconciliation.work_event_id
    WHERE reconciliation.organization_id = requested_organization_id
      AND reconciliation.result_status = 'review_pending'
      AND adjudication.work_event_id IS NULL
    UNION ALL
    SELECT event.id, 'server_legacy'::text, event.triggered_by_user_id,
           event.target_customer_id, event.occurred_at, event.received_at,
           'server_lifecycle_deferred'::text, NULL::bigint, false
    FROM taptime_server.work_events AS event
    WHERE event.organization_id = requested_organization_id
      AND EXISTS (
        SELECT 1 FROM taptime_server.audit_events AS audit
        WHERE audit.organization_id = event.organization_id
          AND audit.work_event_id = event.id
          AND audit.event_type = 'LifecycleDeferred'
          AND audit.entity_type = 'WorkEvent'
      )
      AND NOT EXISTS (
        SELECT 1 FROM taptime_server.canonical_decisions AS decision
        WHERE decision.organization_id = event.organization_id
          AND decision.work_event_id = event.id
      )
      AND NOT EXISTS (
        SELECT 1 FROM taptime_server.offline_event_reconciliations AS reconciliation
        WHERE reconciliation.organization_id = event.organization_id
          AND reconciliation.work_event_id = event.id
      )
      AND NOT EXISTS (
        SELECT 1 FROM taptime_server.offline_review_adjudications AS adjudication
        WHERE adjudication.organization_id = event.organization_id
          AND adjudication.work_event_id = event.id
      )
  )
  SELECT unresolved.work_event_id, unresolved.source_family, unresolved.user_id,
         membership.id, COALESCE(membership.display_name, ''), customer.id,
         customer.display_name, unresolved.occurred_at, unresolved.recorded_at,
         unresolved.review_reason, unresolved.device_sequence,
         unresolved.predecessor_blocked
  FROM unresolved
  LEFT JOIN taptime_server.memberships AS membership
    ON membership.organization_id = requested_organization_id
   AND membership.user_id = unresolved.user_id
  LEFT JOIN taptime_server.customers AS customer
    ON customer.organization_id = requested_organization_id
   AND customer.id = unresolved.target_customer_id
  WHERE requested_after_recorded_at IS NULL
     OR (unresolved.recorded_at, unresolved.work_event_id)
        > (requested_after_recorded_at, requested_after_work_event_id)
  ORDER BY unresolved.recorded_at, unresolved.work_event_id
  LIMIT requested_limit;
END
$items$;

ALTER FUNCTION taptime_server.read_time_review_items_v1(
  uuid, uuid, uuid, timestamptz, uuid, integer
) OWNER TO taptime_time_review_read_function_owner;
REVOKE ALL ON FUNCTION taptime_server.read_time_review_items_v1(
  uuid, uuid, uuid, timestamptz, uuid, integer
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.read_time_review_items_v1(
  uuid, uuid, uuid, timestamptz, uuid, integer
) TO taptime_time_review_reader;

CREATE FUNCTION taptime_server.correct_time_record_v1(
  requested_organization_id uuid,
  requested_actor_user_id uuid,
  requested_membership_id uuid,
  requested_command_id uuid,
  requested_request_hash text,
  requested_time_record_id uuid,
  requested_expected_base_row_version bigint,
  requested_expected_revision_number bigint,
  requested_started_at timestamptz,
  requested_stopped_at timestamptz,
  requested_reason text
)
RETURNS TABLE (
  result_status text,
  time_record_id uuid,
  revision_number bigint,
  effective_started_at timestamptz,
  effective_stopped_at timestamptz,
  idempotent_retry boolean
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog
AS $correction$
DECLARE
  receipt taptime_server.time_review_command_receipts%ROWTYPE;
  record taptime_server.effective_time_records_v1%ROWTYPE;
  next_revision bigint;
BEGIN
  IF pg_catalog.current_setting('role', true) <> 'taptime_time_review_writer'
    OR requested_request_hash IS NULL
    OR requested_request_hash COLLATE "C" !~ '^[0-9a-f]{64}$'
    OR requested_command_id IS NULL
    OR requested_time_record_id IS NULL
    OR requested_expected_base_row_version IS NULL
    OR requested_expected_revision_number IS NULL
    OR requested_started_at IS NULL
    OR requested_stopped_at IS NULL
    OR requested_started_at > requested_stopped_at
    OR requested_stopped_at > pg_catalog.transaction_timestamp()
    OR requested_reason IS NULL
    OR pg_catalog.char_length(pg_catalog.btrim(requested_reason)) NOT BETWEEN 1 AND 500
  THEN
    RAISE EXCEPTION 'Time correction capability rejected' USING ERRCODE = '42501';
  END IF;

  SELECT candidate.* INTO record
  FROM taptime_server.effective_time_records_v1 AS candidate
  WHERE candidate.organization_id = requested_organization_id
    AND candidate.time_record_id = requested_time_record_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'not_adjustable'::text, NULL::uuid, NULL::bigint,
      NULL::timestamptz, NULL::timestamptz, false;
    RETURN;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    requested_organization_id::text || chr(31) || record.user_id::text, 0
  ));
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    requested_organization_id::text || chr(30) || requested_command_id::text, 0
  ));

  IF NOT taptime_server.has_current_time_review_administrator_v1(
    requested_organization_id, requested_actor_user_id, requested_membership_id
  ) THEN
    RETURN QUERY SELECT 'authority_rejected'::text, NULL::uuid, NULL::bigint,
      NULL::timestamptz, NULL::timestamptz, false;
    RETURN;
  END IF;
  PERFORM 1 FROM taptime_server.memberships AS membership
  WHERE membership.organization_id = requested_organization_id
    AND membership.user_id = requested_actor_user_id
    AND membership.id = requested_membership_id
    AND membership.role = 'administrator'
    AND membership.revoked_at IS NULL
  ;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'authority_rejected'::text, NULL::uuid, NULL::bigint,
      NULL::timestamptz, NULL::timestamptz, false;
    RETURN;
  END IF;

  SELECT command.* INTO receipt
  FROM taptime_server.time_review_command_receipts AS command
  WHERE command.organization_id = requested_organization_id
    AND command.command_id = requested_command_id
  ;
  IF FOUND THEN
    IF receipt.command_type <> 'correction' OR receipt.request_hash <> requested_request_hash THEN
      RETURN QUERY SELECT 'command_id_conflict'::text, NULL::uuid, NULL::bigint,
        NULL::timestamptz, NULL::timestamptz, false;
    ELSE
      RETURN QUERY SELECT 'committed'::text,
        (receipt.result_payload->>'timeRecordId')::uuid,
        (receipt.result_payload->>'revisionNumber')::bigint,
        (receipt.result_payload->>'startedAt')::timestamptz,
        (receipt.result_payload->>'stoppedAt')::timestamptz,
        true;
    END IF;
    RETURN;
  END IF;

  IF record.canonical_time_entry_id IS NOT NULL THEN
    PERFORM 1 FROM taptime_server.time_entries AS entry
    WHERE entry.organization_id = requested_organization_id
      AND entry.id = requested_time_record_id
    FOR SHARE;
  ELSE
    PERFORM 1 FROM taptime_server.time_record_revisions AS revision
    WHERE revision.organization_id = requested_organization_id
      AND revision.time_record_id = requested_time_record_id
      AND revision.revision_number = record.effective_revision_number
    FOR SHARE;
  END IF;

  SELECT candidate.* INTO record
  FROM taptime_server.effective_time_records_v1 AS candidate
  WHERE candidate.organization_id = requested_organization_id
    AND candidate.time_record_id = requested_time_record_id;
  IF NOT FOUND OR record.status <> 'stopped' THEN
    RETURN QUERY SELECT 'not_adjustable'::text, NULL::uuid, NULL::bigint,
      NULL::timestamptz, NULL::timestamptz, false;
    RETURN;
  END IF;
  IF record.base_row_version <> requested_expected_base_row_version
    OR record.effective_revision_number <> requested_expected_revision_number
  THEN
    RETURN QUERY SELECT 'conflict'::text, record.time_record_id,
      record.effective_revision_number, record.effective_started_at,
      record.effective_stopped_at, false;
    RETURN;
  END IF;
  IF record.effective_started_at = requested_started_at
    AND record.effective_stopped_at = requested_stopped_at
  THEN
    RETURN QUERY SELECT 'not_adjustable'::text, NULL::uuid, NULL::bigint,
      NULL::timestamptz, NULL::timestamptz, false;
    RETURN;
  END IF;

  next_revision := record.effective_revision_number + 1;
  INSERT INTO taptime_server.time_record_revisions (
    organization_id, time_record_id, revision_number, canonical_time_entry_id,
    user_id, target_type, target_customer_id, effective_started_at,
    effective_stopped_at, base_row_version, actor_user_id, actor_membership_id,
    reason, previous_revision_number, command_id, request_hash
  ) VALUES (
    requested_organization_id, requested_time_record_id, next_revision,
    record.canonical_time_entry_id, record.user_id, record.target_type,
    record.target_customer_id, requested_started_at, requested_stopped_at,
    record.base_row_version, requested_actor_user_id, requested_membership_id,
    requested_reason, NULLIF(next_revision - 1, 0), requested_command_id,
    requested_request_hash
  );

  INSERT INTO taptime_server.audit_events (
    id, organization_id, actor_user_id, event_type, entity_type, entity_id,
    occurred_at, correlation_id, payload
  ) VALUES (
    pg_catalog.gen_random_uuid(), requested_organization_id, requested_actor_user_id,
    'TimeRecordCorrected', 'TimeRecord', requested_time_record_id,
    pg_catalog.transaction_timestamp(), requested_command_id::text,
    pg_catalog.jsonb_build_object(
      'schemaVersion', 1,
      'commandId', requested_command_id,
      'timeRecordId', requested_time_record_id,
      'revisionNumber', next_revision,
      'from', pg_catalog.jsonb_build_object(
        'startedAt', record.effective_started_at,
        'stoppedAt', record.effective_stopped_at
      ),
      'to', pg_catalog.jsonb_build_object(
        'startedAt', requested_started_at,
        'stoppedAt', requested_stopped_at
      ),
      'reason', requested_reason
    )
  );

  INSERT INTO taptime_server.time_review_command_receipts (
    organization_id, command_id, actor_user_id, actor_membership_id,
    command_type, request_hash, result_payload
  ) VALUES (
    requested_organization_id, requested_command_id, requested_actor_user_id,
    requested_membership_id, 'correction', requested_request_hash,
    pg_catalog.jsonb_build_object(
      'timeRecordId', requested_time_record_id,
      'revisionNumber', next_revision,
      'startedAt', requested_started_at,
      'stoppedAt', requested_stopped_at
    )
  );

  RETURN QUERY SELECT 'committed'::text, requested_time_record_id, next_revision,
    requested_started_at, requested_stopped_at, false;
END
$correction$;

ALTER FUNCTION taptime_server.correct_time_record_v1(
  uuid, uuid, uuid, uuid, text, uuid, bigint, bigint, timestamptz, timestamptz, text
) OWNER TO taptime_time_review_write_function_owner;
REVOKE ALL ON FUNCTION taptime_server.correct_time_record_v1(
  uuid, uuid, uuid, uuid, text, uuid, bigint, bigint, timestamptz, timestamptz, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.correct_time_record_v1(
  uuid, uuid, uuid, uuid, text, uuid, bigint, bigint, timestamptz, timestamptz, text
) TO taptime_time_review_writer;

CREATE FUNCTION taptime_server.adjudicate_time_review_items_v1(
  requested_organization_id uuid,
  requested_actor_user_id uuid,
  requested_membership_id uuid,
  requested_command_id uuid,
  requested_request_hash text,
  requested_review_item_ids uuid[],
  requested_resolution text,
  requested_time_record_id uuid,
  requested_expected_base_row_version bigint,
  requested_expected_revision_number bigint,
  requested_started_at timestamptz,
  requested_stopped_at timestamptz,
  requested_reason text
)
RETURNS TABLE (
  result_status text,
  resolution text,
  adjudicated_review_item_ids uuid[],
  time_record_id uuid,
  revision_number bigint,
  idempotent_retry boolean
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog
AS $adjudication$
DECLARE
  receipt taptime_server.time_review_command_receipts%ROWTYPE;
  affected_user_ids uuid[];
  affected_customer_ids uuid[];
  source_families text[];
  affected_user_id uuid;
  source_family text;
  classified_item_count bigint;
  expected_prefix uuid[];
  record taptime_server.effective_time_records_v1%ROWTYPE;
  next_revision bigint;
  resulting_time_record_id uuid;
  resulting_revision_number bigint;
  from_started_at timestamptz;
  from_stopped_at timestamptz;
BEGIN
  IF pg_catalog.current_setting('role', true) <> 'taptime_time_review_writer'
    OR requested_command_id IS NULL
    OR requested_request_hash IS NULL
    OR requested_request_hash COLLATE "C" !~ '^[0-9a-f]{64}$'
    OR requested_review_item_ids IS NULL
    OR pg_catalog.cardinality(requested_review_item_ids) NOT BETWEEN 1 AND 25
    OR (
      SELECT pg_catalog.count(DISTINCT item_id)
      FROM pg_catalog.unnest(requested_review_item_ids) AS item_id
    ) <> pg_catalog.cardinality(requested_review_item_ids)
    OR requested_resolution NOT IN (
      'no_time_record_change', 'adjust_existing_time_record', 'create_recovered_time_record'
    )
    OR requested_reason IS NULL
    OR pg_catalog.char_length(pg_catalog.btrim(requested_reason)) NOT BETWEEN 1 AND 500
    OR (
      requested_resolution = 'no_time_record_change'
      AND (
        requested_time_record_id IS NOT NULL
        OR requested_expected_base_row_version IS NOT NULL
        OR requested_expected_revision_number IS NOT NULL
        OR requested_started_at IS NOT NULL
        OR requested_stopped_at IS NOT NULL
      )
    )
    OR (
      requested_resolution = 'adjust_existing_time_record'
      AND (
        requested_time_record_id IS NULL
        OR requested_expected_base_row_version IS NULL
        OR requested_expected_revision_number IS NULL
        OR requested_started_at IS NULL
        OR requested_stopped_at IS NULL
      )
    )
    OR (
      requested_resolution = 'create_recovered_time_record'
      AND (
        requested_time_record_id IS NOT NULL
        OR requested_expected_base_row_version IS NOT NULL
        OR requested_expected_revision_number IS NOT NULL
        OR requested_started_at IS NULL
        OR requested_stopped_at IS NULL
      )
    )
    OR (
      requested_resolution <> 'no_time_record_change'
      AND (
        requested_started_at > requested_stopped_at
        OR requested_stopped_at > pg_catalog.transaction_timestamp()
      )
    )
  THEN
    RAISE EXCEPTION 'Time review adjudication capability rejected' USING ERRCODE = '42501';
  END IF;

  WITH classified AS (
    SELECT event.id,
           event.triggered_by_user_id AS user_id,
           event.target_customer_id AS customer_id,
           CASE
             WHEN reconciliation.work_event_id IS NOT NULL
               AND reconciliation.result_status = 'review_pending'
               THEN 'offline_v2'::text
             WHEN EXISTS (
               SELECT 1 FROM taptime_server.audit_events AS audit
               WHERE audit.organization_id = event.organization_id
                 AND audit.work_event_id = event.id
                 AND audit.event_type = 'LifecycleDeferred'
                 AND audit.entity_type = 'WorkEvent'
             )
             AND NOT EXISTS (
               SELECT 1 FROM taptime_server.canonical_decisions AS decision
               WHERE decision.organization_id = event.organization_id
                 AND decision.work_event_id = event.id
             )
             AND reconciliation.work_event_id IS NULL
               THEN 'server_legacy'::text
           END AS source_family
    FROM taptime_server.work_events AS event
    LEFT JOIN taptime_server.offline_event_reconciliations AS reconciliation
      ON reconciliation.organization_id = event.organization_id
     AND reconciliation.work_event_id = event.id
    WHERE event.organization_id = requested_organization_id
      AND event.id = ANY(requested_review_item_ids)
  )
  SELECT pg_catalog.array_agg(DISTINCT classified.user_id),
         pg_catalog.array_agg(DISTINCT classified.customer_id),
         pg_catalog.array_agg(DISTINCT classified.source_family),
         pg_catalog.count(*)
  INTO affected_user_ids, affected_customer_ids, source_families, classified_item_count
  FROM classified
  WHERE classified.source_family IS NOT NULL;

  IF pg_catalog.cardinality(affected_user_ids) <> 1
    OR pg_catalog.cardinality(source_families) <> 1
    OR classified_item_count <> pg_catalog.cardinality(requested_review_item_ids)
    OR (
      SELECT pg_catalog.count(*) FROM taptime_server.work_events AS event
      WHERE event.organization_id = requested_organization_id
        AND event.id = ANY(requested_review_item_ids)
    ) <> pg_catalog.cardinality(requested_review_item_ids)
  THEN
    RETURN QUERY SELECT 'invalid_evidence'::text, requested_resolution,
      NULL::uuid[], NULL::uuid, NULL::bigint, false;
    RETURN;
  END IF;
  affected_user_id := affected_user_ids[1];
  source_family := source_families[1];

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    requested_organization_id::text || chr(31) || affected_user_id::text, 0
  ));
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    requested_organization_id::text || chr(30) || requested_command_id::text, 0
  ));

  IF NOT taptime_server.has_current_time_review_administrator_v1(
    requested_organization_id, requested_actor_user_id, requested_membership_id
  ) THEN
    RETURN QUERY SELECT 'authority_rejected'::text, requested_resolution,
      NULL::uuid[], NULL::uuid, NULL::bigint, false;
    RETURN;
  END IF;
  PERFORM 1 FROM taptime_server.memberships AS membership
  WHERE membership.organization_id = requested_organization_id
    AND membership.user_id = requested_actor_user_id
    AND membership.id = requested_membership_id
    AND membership.role = 'administrator'
    AND membership.revoked_at IS NULL
  ;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'authority_rejected'::text, requested_resolution,
      NULL::uuid[], NULL::uuid, NULL::bigint, false;
    RETURN;
  END IF;

  SELECT command.* INTO receipt
  FROM taptime_server.time_review_command_receipts AS command
  WHERE command.organization_id = requested_organization_id
    AND command.command_id = requested_command_id
  ;
  IF FOUND THEN
    IF receipt.command_type <> 'adjudication' OR receipt.request_hash <> requested_request_hash THEN
      RETURN QUERY SELECT 'command_id_conflict'::text, requested_resolution,
        NULL::uuid[], NULL::uuid, NULL::bigint, false;
    ELSE
      RETURN QUERY SELECT 'committed'::text,
        receipt.result_payload->>'resolution',
        ARRAY(
          SELECT value::uuid
          FROM pg_catalog.jsonb_array_elements_text(
            receipt.result_payload->'reviewItemIds'
          ) AS value
        ),
        NULLIF(receipt.result_payload->>'timeRecordId', '')::uuid,
        NULLIF(receipt.result_payload->>'revisionNumber', '')::bigint,
        true;
    END IF;
    RETURN;
  END IF;

  IF source_family = 'offline_v2' THEN
    SELECT pg_catalog.array_agg(prefix.work_event_id ORDER BY prefix.recorded_at, prefix.work_event_id)
    INTO expected_prefix
    FROM (
      SELECT reconciliation.work_event_id, reconciliation.recorded_at
      FROM taptime_server.offline_event_reconciliations AS reconciliation
      LEFT JOIN taptime_server.offline_review_adjudications AS existing_adjudication
        ON existing_adjudication.organization_id = reconciliation.organization_id
       AND existing_adjudication.work_event_id = reconciliation.work_event_id
      WHERE reconciliation.organization_id = requested_organization_id
        AND reconciliation.user_id = affected_user_id
        AND reconciliation.result_status = 'review_pending'
        AND existing_adjudication.work_event_id IS NULL
      ORDER BY reconciliation.recorded_at, reconciliation.work_event_id
      LIMIT pg_catalog.cardinality(requested_review_item_ids)
    ) AS prefix;
  ELSE
    SELECT pg_catalog.array_agg(prefix.work_event_id ORDER BY prefix.recorded_at, prefix.work_event_id)
    INTO expected_prefix
    FROM (
      SELECT event.id AS work_event_id, event.received_at AS recorded_at
      FROM taptime_server.work_events AS event
      WHERE event.organization_id = requested_organization_id
        AND event.triggered_by_user_id = affected_user_id
        AND EXISTS (
          SELECT 1 FROM taptime_server.audit_events AS audit
          WHERE audit.organization_id = event.organization_id
            AND audit.work_event_id = event.id
            AND audit.event_type = 'LifecycleDeferred'
            AND audit.entity_type = 'WorkEvent'
        )
        AND NOT EXISTS (
          SELECT 1 FROM taptime_server.canonical_decisions AS decision
          WHERE decision.organization_id = event.organization_id
            AND decision.work_event_id = event.id
        )
        AND NOT EXISTS (
          SELECT 1 FROM taptime_server.offline_event_reconciliations AS reconciliation
          WHERE reconciliation.organization_id = event.organization_id
            AND reconciliation.work_event_id = event.id
        )
        AND NOT EXISTS (
          SELECT 1 FROM taptime_server.offline_review_adjudications AS existing_adjudication
          WHERE existing_adjudication.organization_id = event.organization_id
            AND existing_adjudication.work_event_id = event.id
        )
      ORDER BY event.received_at, event.id
      LIMIT pg_catalog.cardinality(requested_review_item_ids)
    ) AS prefix;
  END IF;

  IF expected_prefix IS DISTINCT FROM requested_review_item_ids THEN
    RETURN QUERY SELECT 'conflict'::text, requested_resolution,
      NULL::uuid[], NULL::uuid, NULL::bigint, false;
    RETURN;
  END IF;

  IF requested_resolution = 'adjust_existing_time_record' THEN
    IF pg_catalog.cardinality(affected_customer_ids) <> 1 THEN
      RETURN QUERY SELECT 'invalid_evidence'::text, requested_resolution,
        NULL::uuid[], NULL::uuid, NULL::bigint, false;
      RETURN;
    END IF;
    SELECT candidate.* INTO record
    FROM taptime_server.effective_time_records_v1 AS candidate
    WHERE candidate.organization_id = requested_organization_id
      AND candidate.time_record_id = requested_time_record_id;
    IF NOT FOUND
      OR record.user_id <> affected_user_id
      OR record.target_customer_id <> affected_customer_ids[1]
      OR record.status <> 'stopped'
    THEN
      RETURN QUERY SELECT 'invalid_evidence'::text, requested_resolution,
        NULL::uuid[], NULL::uuid, NULL::bigint, false;
      RETURN;
    END IF;
    IF record.canonical_time_entry_id IS NOT NULL THEN
      PERFORM 1 FROM taptime_server.time_entries AS entry
      WHERE entry.organization_id = requested_organization_id
        AND entry.id = requested_time_record_id
      FOR SHARE;
    ELSE
      PERFORM 1 FROM taptime_server.time_record_revisions AS revision
      WHERE revision.organization_id = requested_organization_id
        AND revision.time_record_id = requested_time_record_id
        AND revision.revision_number = record.effective_revision_number
      FOR SHARE;
    END IF;
    SELECT candidate.* INTO record
    FROM taptime_server.effective_time_records_v1 AS candidate
    WHERE candidate.organization_id = requested_organization_id
      AND candidate.time_record_id = requested_time_record_id;
    IF record.base_row_version <> requested_expected_base_row_version
      OR record.effective_revision_number <> requested_expected_revision_number
    THEN
      RETURN QUERY SELECT 'conflict'::text, requested_resolution,
        NULL::uuid[], record.time_record_id, record.effective_revision_number, false;
      RETURN;
    END IF;
    IF record.effective_started_at = requested_started_at
      AND record.effective_stopped_at = requested_stopped_at
    THEN
      RETURN QUERY SELECT 'invalid_evidence'::text, requested_resolution,
        NULL::uuid[], NULL::uuid, NULL::bigint, false;
      RETURN;
    END IF;
    from_started_at := record.effective_started_at;
    from_stopped_at := record.effective_stopped_at;
    next_revision := record.effective_revision_number + 1;
    resulting_time_record_id := record.time_record_id;
    resulting_revision_number := next_revision;
    INSERT INTO taptime_server.time_record_revisions (
      organization_id, time_record_id, revision_number, canonical_time_entry_id,
      user_id, target_type, target_customer_id, effective_started_at,
      effective_stopped_at, base_row_version, actor_user_id, actor_membership_id,
      reason, previous_revision_number, command_id, request_hash
    ) VALUES (
      requested_organization_id, record.time_record_id, next_revision,
      record.canonical_time_entry_id, record.user_id, record.target_type,
      record.target_customer_id, requested_started_at, requested_stopped_at,
      record.base_row_version, requested_actor_user_id, requested_membership_id,
      requested_reason, NULLIF(next_revision - 1, 0), requested_command_id,
      requested_request_hash
    );
  ELSIF requested_resolution = 'create_recovered_time_record' THEN
    IF pg_catalog.cardinality(affected_customer_ids) <> 1 THEN
      RETURN QUERY SELECT 'invalid_evidence'::text, requested_resolution,
        NULL::uuid[], NULL::uuid, NULL::bigint, false;
      RETURN;
    END IF;
    resulting_time_record_id := pg_catalog.gen_random_uuid();
    resulting_revision_number := 1;
    INSERT INTO taptime_server.time_record_revisions (
      organization_id, time_record_id, revision_number, canonical_time_entry_id,
      user_id, target_type, target_customer_id, effective_started_at,
      effective_stopped_at, base_row_version, actor_user_id, actor_membership_id,
      reason, previous_revision_number, command_id, request_hash
    ) VALUES (
      requested_organization_id, resulting_time_record_id, 1, NULL,
      affected_user_id, 'customer', affected_customer_ids[1], requested_started_at,
      requested_stopped_at, 0, requested_actor_user_id, requested_membership_id,
      requested_reason, NULL, requested_command_id, requested_request_hash
    );
  END IF;

  INSERT INTO taptime_server.offline_review_adjudications (
    organization_id, work_event_id, user_id, target_type, target_customer_id,
    source_family, installation_id, device_sequence, actor_user_id,
    actor_membership_id, resolution, reason, command_id, time_record_id,
    revision_number
  )
  SELECT event.organization_id, event.id, event.triggered_by_user_id,
         event.target_type, event.target_customer_id, source_family,
         CASE WHEN source_family = 'offline_v2' THEN reconciliation.installation_id END,
         CASE WHEN source_family = 'offline_v2' THEN reconciliation.device_sequence END,
         requested_actor_user_id, requested_membership_id, requested_resolution,
         requested_reason, requested_command_id, resulting_time_record_id,
         resulting_revision_number
  FROM taptime_server.work_events AS event
  LEFT JOIN taptime_server.offline_event_reconciliations AS reconciliation
    ON reconciliation.organization_id = event.organization_id
   AND reconciliation.work_event_id = event.id
  WHERE event.organization_id = requested_organization_id
    AND event.id = ANY(requested_review_item_ids);

  IF source_family = 'offline_v2' THEN
    PERFORM 1
    FROM taptime_server.offline_sync_cursors AS cursor
    WHERE cursor.organization_id = requested_organization_id
      AND cursor.user_id = affected_user_id
      AND cursor.review_predecessor_sequence IS NOT NULL
    ORDER BY cursor.installation_id
    FOR UPDATE;

    UPDATE taptime_server.offline_sync_cursors AS cursor
    SET review_predecessor_sequence = NULL,
        updated_at = pg_catalog.transaction_timestamp()
    WHERE cursor.organization_id = requested_organization_id
      AND cursor.user_id = affected_user_id
      AND cursor.review_predecessor_sequence IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM taptime_server.offline_event_reconciliations AS reconciliation
        LEFT JOIN taptime_server.offline_review_adjudications AS remaining_adjudication
          ON remaining_adjudication.organization_id = reconciliation.organization_id
         AND remaining_adjudication.work_event_id = reconciliation.work_event_id
        WHERE reconciliation.organization_id = cursor.organization_id
          AND reconciliation.user_id = cursor.user_id
          AND reconciliation.installation_id = cursor.installation_id
          AND reconciliation.result_status = 'review_pending'
          AND remaining_adjudication.work_event_id IS NULL
      );
  END IF;

  INSERT INTO taptime_server.audit_events (
    id, organization_id, actor_user_id, event_type, entity_type, entity_id,
    occurred_at, correlation_id, payload
  ) VALUES (
    pg_catalog.gen_random_uuid(), requested_organization_id, requested_actor_user_id,
    'TimeReviewAdjudicated', 'TimeReviewCommand', requested_command_id,
    pg_catalog.transaction_timestamp(), requested_command_id::text,
    pg_catalog.jsonb_build_object(
      'schemaVersion', 1,
      'commandId', requested_command_id,
      'sourceFamily', source_family,
      'resolution', requested_resolution,
      'reviewItemIds', requested_review_item_ids,
      'timeRecordId', resulting_time_record_id,
      'revisionNumber', resulting_revision_number,
      'from', CASE WHEN from_started_at IS NULL THEN NULL ELSE pg_catalog.jsonb_build_object(
        'startedAt', from_started_at, 'stoppedAt', from_stopped_at
      ) END,
      'to', CASE WHEN resulting_time_record_id IS NULL THEN NULL ELSE pg_catalog.jsonb_build_object(
        'startedAt', requested_started_at, 'stoppedAt', requested_stopped_at
      ) END,
      'reason', requested_reason
    )
  );

  INSERT INTO taptime_server.time_review_command_receipts (
    organization_id, command_id, actor_user_id, actor_membership_id,
    command_type, request_hash, result_payload
  ) VALUES (
    requested_organization_id, requested_command_id, requested_actor_user_id,
    requested_membership_id, 'adjudication', requested_request_hash,
    pg_catalog.jsonb_build_object(
      'resolution', requested_resolution,
      'reviewItemIds', requested_review_item_ids,
      'timeRecordId', COALESCE(resulting_time_record_id::text, ''),
      'revisionNumber', COALESCE(resulting_revision_number::text, '')
    )
  );

  RETURN QUERY SELECT 'committed'::text, requested_resolution,
    requested_review_item_ids, resulting_time_record_id,
    resulting_revision_number, false;
END
$adjudication$;

ALTER FUNCTION taptime_server.adjudicate_time_review_items_v1(
  uuid, uuid, uuid, uuid, text, uuid[], text, uuid, bigint, bigint,
  timestamptz, timestamptz, text
) OWNER TO taptime_time_review_write_function_owner;
REVOKE ALL ON FUNCTION taptime_server.adjudicate_time_review_items_v1(
  uuid, uuid, uuid, uuid, text, uuid[], text, uuid, bigint, bigint,
  timestamptz, timestamptz, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.adjudicate_time_review_items_v1(
  uuid, uuid, uuid, uuid, text, uuid[], text, uuid, bigint, bigint,
  timestamptz, timestamptz, text
) TO taptime_time_review_writer;

-- Existing DA1 evidence stays immutable. It is unresolved only until a separate Human
-- adjudication exists for that WorkEvent.
CREATE OR REPLACE FUNCTION taptime_server.has_offline_review_predecessor_v1(
  requested_organization_id uuid,
  requested_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $predecessor$
BEGIN
  IF pg_catalog.current_setting('role', true) <> 'taptime_offline_event_ingestor'
    OR requested_organization_id IS NULL
    OR requested_user_id IS NULL
    OR requested_organization_id <> NULLIF(
      pg_catalog.current_setting('app.organization_id', true), ''
    )::uuid
    OR requested_user_id <> NULLIF(
      pg_catalog.current_setting('app.user_id', true), ''
    )::uuid
  THEN
    RAISE EXCEPTION 'Offline review predecessor capability rejected'
      USING ERRCODE = '42501';
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM taptime_server.offline_event_reconciliations AS reconciliation
    LEFT JOIN taptime_server.offline_review_adjudications AS adjudication
      ON adjudication.organization_id = reconciliation.organization_id
     AND adjudication.work_event_id = reconciliation.work_event_id
    WHERE reconciliation.organization_id = requested_organization_id
      AND reconciliation.user_id = requested_user_id
      AND reconciliation.result_status = 'review_pending'
      AND adjudication.work_event_id IS NULL
  );
END
$predecessor$;

GRANT SELECT ON taptime_server.offline_review_adjudications
  TO taptime_offline_event_function_owner;

CREATE OR REPLACE FUNCTION taptime_server.enforce_offline_sync_cursor_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $cursor$
DECLARE
  proved_review_clear boolean :=
    pg_catalog.current_setting('role', true) = 'taptime_time_review_writer'
    AND OLD.review_predecessor_sequence IS NOT NULL
    AND NEW.review_predecessor_sequence IS NULL
    AND NEW.last_durable_sequence = OLD.last_durable_sequence;
BEGIN
  IF NEW.organization_id <> OLD.organization_id
    OR NEW.installation_id <> OLD.installation_id
    OR NEW.user_id <> OLD.user_id
    OR NEW.membership_id <> OLD.membership_id
    OR (
      NOT proved_review_clear
      AND (
        NEW.last_durable_sequence <> OLD.last_durable_sequence + 1
        OR (
          OLD.review_predecessor_sequence IS NOT NULL
          AND NEW.review_predecessor_sequence IS DISTINCT FROM OLD.review_predecessor_sequence
        )
      )
    )
    OR (
      proved_review_clear
      AND EXISTS (
        SELECT 1 FROM taptime_server.offline_event_reconciliations AS reconciliation
        LEFT JOIN taptime_server.offline_review_adjudications AS adjudication
          ON adjudication.organization_id = reconciliation.organization_id
         AND adjudication.work_event_id = reconciliation.work_event_id
        WHERE reconciliation.organization_id = OLD.organization_id
          AND reconciliation.user_id = OLD.user_id
          AND reconciliation.installation_id = OLD.installation_id
          AND reconciliation.result_status = 'review_pending'
          AND adjudication.work_event_id IS NULL
      )
    )
    OR (
      NEW.review_predecessor_sequence IS NOT NULL
      AND NEW.review_predecessor_sequence > NEW.last_durable_sequence
    )
  THEN
    RAISE EXCEPTION 'Invalid offline synchronization cursor transition'
      USING ERRCODE = '23514';
  END IF;
  NEW.updated_at := pg_catalog.transaction_timestamp();
  RETURN NEW;
END
$cursor$;

REVOKE ALL ON FUNCTION taptime_server.enforce_offline_sync_cursor_transition() FROM PUBLIC;

GRANT SELECT ON
  taptime_server.identity_bindings,
  taptime_server.memberships,
  taptime_server.offline_installations,
  taptime_server.offline_sync_cursors,
  taptime_server.offline_event_reconciliations,
  taptime_server.offline_review_adjudications
TO taptime_offline_reconciliation_function_owner;

CREATE FUNCTION taptime_server.read_current_offline_review_state_v1(
  requested_installation_id uuid
)
RETURNS TABLE (
  review_status text,
  earliest_unresolved_sequence bigint,
  confirmed_through_sequence bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $state$
DECLARE
  unresolved_sequence bigint;
  durable_sequence bigint;
BEGIN
  IF pg_catalog.current_setting('role', true) <> 'taptime_offline_reconciliation_reader'
    OR requested_installation_id IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM taptime_server.offline_installations AS installation
      JOIN taptime_server.identity_bindings AS binding
        ON binding.id = installation.identity_binding_id
       AND binding.user_id = installation.user_id
      JOIN taptime_server.memberships AS membership
        ON membership.organization_id = installation.organization_id
       AND membership.user_id = installation.user_id
       AND membership.id = installation.membership_id
      WHERE installation.id = requested_installation_id
        AND installation.organization_id = NULLIF(
          pg_catalog.current_setting('app.organization_id', true), ''
        )::uuid
        AND installation.user_id = NULLIF(
          pg_catalog.current_setting('app.user_id', true), ''
        )::uuid
        AND installation.membership_id = NULLIF(
          pg_catalog.current_setting('app.membership_id', true), ''
        )::uuid
        AND binding.id = NULLIF(
          pg_catalog.current_setting('app.identity_binding_id', true), ''
        )::uuid
        AND binding.revoked_at IS NULL
        AND membership.revoked_at IS NULL
    )
  THEN
    RAISE EXCEPTION 'Offline review-state capability rejected' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(cursor.last_durable_sequence, 0)
  INTO STRICT durable_sequence
  FROM taptime_server.offline_installations AS installation
  LEFT JOIN taptime_server.offline_sync_cursors AS cursor
    ON cursor.organization_id = installation.organization_id
   AND cursor.installation_id = installation.id
  WHERE installation.organization_id = NULLIF(
      pg_catalog.current_setting('app.organization_id', true), ''
    )::uuid
    AND installation.user_id = NULLIF(
      pg_catalog.current_setting('app.user_id', true), ''
    )::uuid
    AND installation.membership_id = NULLIF(
      pg_catalog.current_setting('app.membership_id', true), ''
    )::uuid
    AND installation.id = requested_installation_id;

  SELECT MIN(reconciliation.device_sequence) INTO unresolved_sequence
  FROM taptime_server.offline_event_reconciliations AS reconciliation
  LEFT JOIN taptime_server.offline_review_adjudications AS adjudication
    ON adjudication.organization_id = reconciliation.organization_id
   AND adjudication.work_event_id = reconciliation.work_event_id
  WHERE reconciliation.organization_id = NULLIF(
      pg_catalog.current_setting('app.organization_id', true), ''
    )::uuid
    AND reconciliation.user_id = NULLIF(
      pg_catalog.current_setting('app.user_id', true), ''
    )::uuid
    AND reconciliation.membership_id = NULLIF(
      pg_catalog.current_setting('app.membership_id', true), ''
    )::uuid
    AND reconciliation.installation_id = requested_installation_id
    AND reconciliation.result_status = 'review_pending'
    AND adjudication.work_event_id IS NULL;

  RETURN QUERY SELECT
    CASE WHEN unresolved_sequence IS NULL THEN 'clear'::text ELSE 'review_pending'::text END,
    unresolved_sequence,
    durable_sequence;
END
$state$;

ALTER FUNCTION taptime_server.read_current_offline_review_state_v1(uuid)
  OWNER TO taptime_offline_reconciliation_function_owner;
REVOKE ALL ON FUNCTION taptime_server.read_current_offline_review_state_v1(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.read_current_offline_review_state_v1(uuid)
  TO taptime_offline_reconciliation_reader;

CREATE FUNCTION taptime_server.read_effective_time_entry_export_v1(
  requested_organization_id uuid,
  requested_from_inclusive timestamptz,
  requested_to_exclusive timestamptz,
  requested_limit integer
)
RETURNS TABLE (
  organization_id uuid,
  organization_name text,
  time_entry_id uuid,
  employee_membership_id uuid,
  employee_display_name text,
  customer_id uuid,
  customer_display_name text,
  status text,
  started_at timestamptz,
  stopped_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $export$
BEGIN
  IF pg_catalog.current_setting('role', true) <> 'taptime_time_exporter'
    OR requested_organization_id IS NULL
    OR requested_organization_id <> NULLIF(
      pg_catalog.current_setting('app.organization_id', true), ''
    )::uuid
    OR pg_catalog.current_setting('app.membership_role', true) <> 'administrator'
    OR NOT taptime_server.has_current_time_export_authority(requested_organization_id)
    OR requested_from_inclusive IS NULL
    OR requested_to_exclusive IS NULL
    OR requested_to_exclusive <= requested_from_inclusive
    OR requested_to_exclusive - requested_from_inclusive > interval '31 days'
    OR requested_limit NOT BETWEEN 1 AND 10001
  THEN
    RAISE EXCEPTION 'Effective time export capability rejected' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT organization.id, organization.name, record.time_record_id, membership.id,
         COALESCE(membership.display_name, ''), customer.id, customer.display_name,
         record.status, record.effective_started_at, record.effective_stopped_at
  FROM taptime_server.effective_time_records_v1 AS record
  LEFT JOIN taptime_server.organizations AS organization
    ON organization.id = record.organization_id
  LEFT JOIN taptime_server.memberships AS membership
    ON membership.organization_id = record.organization_id
   AND membership.user_id = record.user_id
  LEFT JOIN taptime_server.customers AS customer
    ON customer.organization_id = record.organization_id
   AND customer.id = record.target_customer_id
  WHERE record.organization_id = requested_organization_id
    AND record.effective_started_at >= requested_from_inclusive
    AND record.effective_started_at < requested_to_exclusive
  ORDER BY record.effective_started_at, record.time_record_id
  LIMIT requested_limit;
END
$export$;

ALTER FUNCTION taptime_server.read_effective_time_entry_export_v1(
  uuid, timestamptz, timestamptz, integer
) OWNER TO taptime_time_review_read_function_owner;
REVOKE ALL ON FUNCTION taptime_server.read_effective_time_entry_export_v1(
  uuid, timestamptz, timestamptz, integer
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.read_effective_time_entry_export_v1(
  uuid, timestamptz, timestamptz, integer
) TO taptime_time_exporter;

GRANT EXECUTE ON FUNCTION taptime_server.has_current_time_export_authority(uuid)
  TO taptime_time_review_read_function_owner;

GRANT SELECT ON
  taptime_server.organizations,
  taptime_server.memberships,
  taptime_server.customers,
  taptime_server.time_entries,
  taptime_server.time_record_revisions
TO taptime_time_review_read_function_owner;

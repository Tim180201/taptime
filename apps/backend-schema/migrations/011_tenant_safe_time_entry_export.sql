DO $roles$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'taptime_time_exporter'
  ) THEN
    CREATE ROLE taptime_time_exporter
      NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'taptime_time_export_function_owner'
  ) THEN
    CREATE ROLE taptime_time_export_function_owner
      NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT BYPASSRLS;
  END IF;
END
$roles$;

ALTER ROLE taptime_time_exporter WITH
  NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
ALTER ROLE taptime_time_export_function_owner WITH
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
    'taptime_time_exporter',
    'taptime_time_export_function_owner'
  ]
  LOOP
    SELECT role.oid
    INTO STRICT role_oid
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
      RAISE EXCEPTION 'DA2 export roles must have no pre-existing ownership, ACL, policy, default-ACL, role-setting or shared-object dependency in this database'
        USING ERRCODE = '42501';
    END IF;
  END LOOP;
END
$normalize_role_graph$;

DO $membership_invariant$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_row
    JOIN pg_catalog.pg_class AS table_row ON table_row.oid = constraint_row.conrelid
    JOIN pg_catalog.pg_namespace AS namespace_row ON namespace_row.oid = table_row.relnamespace
    WHERE namespace_row.nspname = 'taptime_server'
      AND table_row.relname = 'memberships'
      AND constraint_row.conname = 'memberships_organization_user_unique'
      AND constraint_row.contype = 'u'
      AND constraint_row.convalidated
  ) THEN
    RAISE EXCEPTION 'DA2 requires memberships_organization_user_unique'
      USING ERRCODE = '23514';
  END IF;
END
$membership_invariant$;

REVOKE ALL ON ALL TABLES IN SCHEMA taptime_server
  FROM taptime_time_exporter, taptime_time_export_function_owner;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA taptime_server
  FROM taptime_time_exporter, taptime_time_export_function_owner;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA taptime_server
  FROM taptime_time_exporter, taptime_time_export_function_owner;

GRANT USAGE ON SCHEMA taptime_server
  TO taptime_time_exporter, taptime_time_export_function_owner;

CREATE FUNCTION taptime_server.has_current_time_export_authority(
  requested_organization_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $authority$
  SELECT requested_organization_id IS NOT NULL
    AND requested_organization_id = NULLIF(
      pg_catalog.current_setting('app.organization_id', true), ''
    )::uuid
    AND pg_catalog.current_setting('app.membership_role', true) = 'administrator'
    AND EXISTS (
      SELECT 1
      FROM taptime_server.memberships AS membership
      WHERE membership.organization_id = requested_organization_id
        AND membership.user_id = NULLIF(
          pg_catalog.current_setting('app.user_id', true), ''
        )::uuid
        AND membership.id = NULLIF(
          pg_catalog.current_setting('app.membership_id', true), ''
        )::uuid
        AND membership.role = 'administrator'
        AND membership.revoked_at IS NULL
    )
$authority$;

ALTER FUNCTION taptime_server.has_current_time_export_authority(uuid)
  OWNER TO taptime_time_export_function_owner;
REVOKE ALL ON FUNCTION taptime_server.has_current_time_export_authority(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.has_current_time_export_authority(uuid)
  TO taptime_time_exporter;

GRANT SELECT (organization_id, user_id, id, role, revoked_at)
  ON taptime_server.memberships TO taptime_time_export_function_owner;

CREATE POLICY organizations_time_export_select ON taptime_server.organizations
  FOR SELECT TO taptime_time_exporter
  USING (
    id = NULLIF(pg_catalog.current_setting('app.organization_id', true), '')::uuid
    AND taptime_server.has_current_time_export_authority(id)
  );

CREATE POLICY memberships_time_export_select ON taptime_server.memberships
  FOR SELECT TO taptime_time_exporter
  USING (
    organization_id = NULLIF(
      pg_catalog.current_setting('app.organization_id', true), ''
    )::uuid
    AND taptime_server.has_current_time_export_authority(organization_id)
  );

CREATE POLICY customers_time_export_select ON taptime_server.customers
  FOR SELECT TO taptime_time_exporter
  USING (
    organization_id = NULLIF(
      pg_catalog.current_setting('app.organization_id', true), ''
    )::uuid
    AND taptime_server.has_current_time_export_authority(organization_id)
  );

CREATE POLICY time_entries_time_export_select ON taptime_server.time_entries
  FOR SELECT TO taptime_time_exporter
  USING (
    organization_id = NULLIF(
      pg_catalog.current_setting('app.organization_id', true), ''
    )::uuid
    AND taptime_server.has_current_time_export_authority(organization_id)
  );

GRANT SELECT (id, name) ON taptime_server.organizations TO taptime_time_exporter;
GRANT SELECT (id, organization_id, user_id, display_name)
  ON taptime_server.memberships TO taptime_time_exporter;
GRANT SELECT (id, organization_id, display_name)
  ON taptime_server.customers TO taptime_time_exporter;
GRANT SELECT (
  id, organization_id, user_id, target_customer_id, status, started_at, stopped_at
) ON taptime_server.time_entries TO taptime_time_exporter;

CREATE FUNCTION taptime_server.append_time_entry_export_audit_v1(
  requested_audit_id uuid,
  requested_organization_id uuid,
  requested_actor_user_id uuid,
  requested_correlation_id text,
  requested_from_inclusive timestamptz,
  requested_to_exclusive timestamptz,
  requested_row_count integer,
  requested_byte_count integer,
  requested_sha256 text
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog
AS $audit$
BEGIN
  IF pg_catalog.current_setting('role', true) <> 'taptime_time_exporter'
    OR requested_audit_id IS NULL
    OR requested_organization_id IS NULL
    OR requested_actor_user_id IS NULL
    OR requested_actor_user_id IS DISTINCT FROM NULLIF(
      pg_catalog.current_setting('app.user_id', true), ''
    )::uuid
    OR NOT taptime_server.has_current_time_export_authority(requested_organization_id)
    OR requested_correlation_id IS NULL
    OR requested_correlation_id COLLATE "C" !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    OR requested_from_inclusive IS NULL
    OR requested_to_exclusive IS NULL
    OR requested_to_exclusive <= requested_from_inclusive
    OR requested_to_exclusive - requested_from_inclusive > interval '31 days'
    OR requested_row_count IS NULL
    OR requested_row_count NOT BETWEEN 0 AND 10000
    OR requested_byte_count IS NULL
    OR requested_byte_count NOT BETWEEN 1 AND 8388608
    OR requested_sha256 IS NULL
    OR requested_sha256 COLLATE "C" !~ '^[0-9a-f]{64}$'
  THEN
    RAISE EXCEPTION 'DA2 export audit capability rejected' USING ERRCODE = '42501';
  END IF;

  INSERT INTO taptime_server.audit_events (
    id,
    organization_id,
    actor_user_id,
    event_type,
    entity_type,
    entity_id,
    occurred_at,
    correlation_id,
    payload
  ) VALUES (
    requested_audit_id,
    requested_organization_id,
    requested_actor_user_id,
    'TimeEntryExportGenerated',
    'TimeEntryExport',
    requested_audit_id,
    pg_catalog.transaction_timestamp(),
    requested_correlation_id,
    pg_catalog.jsonb_build_object(
      'schemaVersion', 1,
      'fromInclusive', pg_catalog.to_char(
        requested_from_inclusive AT TIME ZONE 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      ),
      'toExclusive', pg_catalog.to_char(
        requested_to_exclusive AT TIME ZONE 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      ),
      'rowCount', requested_row_count,
      'byteCount', requested_byte_count,
      'sha256', requested_sha256
    )
  );
END
$audit$;

ALTER FUNCTION taptime_server.append_time_entry_export_audit_v1(
  uuid, uuid, uuid, text, timestamptz, timestamptz, integer, integer, text
) OWNER TO taptime_time_export_function_owner;
REVOKE ALL ON FUNCTION taptime_server.append_time_entry_export_audit_v1(
  uuid, uuid, uuid, text, timestamptz, timestamptz, integer, integer, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.append_time_entry_export_audit_v1(
  uuid, uuid, uuid, text, timestamptz, timestamptz, integer, integer, text
) TO taptime_time_exporter;

GRANT INSERT (
  id, organization_id, actor_user_id, event_type, entity_type, entity_id,
  occurred_at, correlation_id, payload
) ON taptime_server.audit_events TO taptime_time_export_function_owner;

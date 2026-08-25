-- T-013: complete, fixed-shape payroll export. V1 and V2 remain immutable.

GRANT SELECT (organization_id, time_entry_id, started_at, stopped_at)
  ON taptime_server.break_intervals
  TO taptime_time_export_function_owner;
GRANT SELECT (id, organization_id, started_at, stopped_at)
  ON taptime_server.time_entries
  TO taptime_time_export_function_owner;
GRANT EXECUTE ON FUNCTION taptime_server.effective_work_duration_seconds_v1(uuid)
  TO taptime_time_export_function_owner;

-- Keep one duration truth for canonical, corrected and recovered records. The function becomes
-- SECURITY DEFINER only together with an explicit caller/tenant check; its owner bypasses RLS
-- so that a recovered record (which has no time_entries row) can still use the same function.
CREATE OR REPLACE FUNCTION taptime_server.effective_work_duration_seconds_v1(
  requested_time_entry_id uuid
)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $duration$
  WITH record AS (
    SELECT effective.organization_id, effective.user_id,
           effective.canonical_time_entry_id,
           effective.effective_started_at, effective.effective_stopped_at
    FROM taptime_server.effective_time_records_v2 AS effective
    WHERE effective.time_record_id = requested_time_entry_id
  ), authorized_record AS (
    SELECT record.*
    FROM record
    WHERE record.organization_id = NULLIF(
        pg_catalog.current_setting('app.organization_id', true), ''
      )::uuid
      AND CASE pg_catalog.current_setting('role', true)
        WHEN 'taptime_time_exporter' THEN
          taptime_server.has_current_time_export_authority(record.organization_id)
        WHEN 'taptime_administrator' THEN EXISTS (
          SELECT 1
          FROM taptime_server.memberships AS membership
          WHERE membership.organization_id = record.organization_id
            AND membership.user_id = NULLIF(
              pg_catalog.current_setting('app.user_id', true), ''
            )::uuid
            AND membership.role = 'administrator'
            AND membership.revoked_at IS NULL
        )
        WHEN 'taptime_employee' THEN
          record.user_id = NULLIF(
            pg_catalog.current_setting('app.user_id', true), ''
          )::uuid
          AND EXISTS (
            SELECT 1
            FROM taptime_server.memberships AS membership
            WHERE membership.organization_id = record.organization_id
              AND membership.user_id = record.user_id
              AND membership.revoked_at IS NULL
          )
        WHEN 'taptime_server_lifecycle' THEN
          record.user_id = NULLIF(
            pg_catalog.current_setting('app.user_id', true), ''
          )::uuid
          AND EXISTS (
            SELECT 1
            FROM taptime_server.memberships AS membership
            WHERE membership.organization_id = record.organization_id
              AND membership.user_id = record.user_id
              AND membership.revoked_at IS NULL
          )
        WHEN 'taptime_offline_event_ingestor' THEN
          record.user_id = NULLIF(
            pg_catalog.current_setting('app.user_id', true), ''
          )::uuid
          AND EXISTS (
            SELECT 1
            FROM taptime_server.memberships AS membership
            WHERE membership.organization_id = record.organization_id
              AND membership.user_id = record.user_id
              AND membership.revoked_at IS NULL
          )
        ELSE false
      END
  )
  SELECT GREATEST(
    0::bigint,
    pg_catalog.floor(extract(epoch FROM (
      COALESCE(record.effective_stopped_at, pg_catalog.transaction_timestamp())
      - record.effective_started_at
    )))::bigint
    - COALESCE((
      SELECT SUM(pg_catalog.floor(extract(epoch FROM (
        LEAST(
          COALESCE(interval.stopped_at, pg_catalog.transaction_timestamp()),
          COALESCE(record.effective_stopped_at, pg_catalog.transaction_timestamp())
        )
        - GREATEST(interval.started_at, record.effective_started_at)
      )))::bigint)::bigint
      FROM taptime_server.break_intervals AS interval
      WHERE interval.organization_id = record.organization_id
        AND interval.time_entry_id = record.canonical_time_entry_id
        AND interval.started_at < COALESCE(
          record.effective_stopped_at, pg_catalog.transaction_timestamp()
        )
        AND COALESCE(interval.stopped_at, pg_catalog.transaction_timestamp())
          > record.effective_started_at
    ), 0::bigint)
  )
  FROM authorized_record AS record
$duration$;
ALTER FUNCTION taptime_server.effective_work_duration_seconds_v1(uuid)
  OWNER TO taptime_time_export_function_owner;
REVOKE ALL ON FUNCTION taptime_server.effective_work_duration_seconds_v1(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.effective_work_duration_seconds_v1(uuid)
  TO taptime_employee, taptime_administrator, taptime_server_lifecycle,
     taptime_offline_event_ingestor, taptime_time_export_function_owner;

CREATE FUNCTION taptime_server.read_effective_time_entry_export_v3(
  requested_organization_id uuid,
  requested_from_inclusive timestamptz,
  requested_to_exclusive timestamptz,
  requested_limit integer
)
RETURNS TABLE (
  organization_id uuid,
  time_entry_id uuid,
  employee_membership_id uuid,
  employee_display_name text,
  target_type text,
  target_display_name text,
  status text,
  started_via text,
  stopped_via text,
  started_at timestamptz,
  stopped_at timestamptz,
  break_duration_seconds bigint,
  effective_work_duration_seconds bigint,
  effective_revision_number bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $export$
BEGIN
  IF pg_catalog.current_setting('role', true) <> 'taptime_time_exporter'
    OR NOT taptime_server.has_current_time_export_authority(requested_organization_id)
    OR requested_from_inclusive IS NULL
    OR requested_to_exclusive IS NULL
    OR requested_to_exclusive <= requested_from_inclusive
    OR requested_to_exclusive - requested_from_inclusive > interval '31 days'
    OR requested_limit NOT BETWEEN 1 AND 10001
  THEN
    RAISE EXCEPTION 'Time export v3 capability rejected' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    record.organization_id,
    record.time_record_id,
    membership.id,
    COALESCE(membership.display_name, ''),
    record.target_type,
    target.display_name,
    record.status,
    CASE WHEN record.source = 'recovered' THEN 'manual' ELSE record.started_via END,
    CASE WHEN record.source = 'recovered' THEN 'manual' ELSE record.stopped_via END,
    record.effective_started_at,
    record.effective_stopped_at,
    COALESCE(breaks.duration_seconds, 0::bigint),
    taptime_server.effective_work_duration_seconds_v1(record.time_record_id),
    record.effective_revision_number
  FROM taptime_server.effective_time_records_v2 AS record
  JOIN taptime_server.memberships AS membership
    ON membership.organization_id = record.organization_id
   AND membership.user_id = record.user_id
  JOIN taptime_server.work_targets AS target
    ON target.organization_id = record.organization_id
   AND target.target_type = record.target_type
   AND target.target_id = record.target_id
  LEFT JOIN LATERAL (
    SELECT COALESCE(SUM(pg_catalog.floor(extract(epoch FROM (
      LEAST(
        COALESCE(interval.stopped_at, pg_catalog.transaction_timestamp()),
        COALESCE(record.effective_stopped_at, pg_catalog.transaction_timestamp())
      )
      - GREATEST(interval.started_at, record.effective_started_at)
    )))::bigint)::bigint, 0::bigint) AS duration_seconds
    FROM taptime_server.break_intervals AS interval
    WHERE interval.organization_id = record.organization_id
      AND interval.time_entry_id = record.canonical_time_entry_id
      AND interval.started_at < COALESCE(
        record.effective_stopped_at, pg_catalog.transaction_timestamp()
      )
      AND COALESCE(interval.stopped_at, pg_catalog.transaction_timestamp())
        > record.effective_started_at
  ) AS breaks ON true
  WHERE record.organization_id = requested_organization_id
    AND record.effective_started_at >= requested_from_inclusive
    AND record.effective_started_at < requested_to_exclusive
  ORDER BY record.effective_started_at, record.time_record_id
  LIMIT requested_limit;
END
$export$;

ALTER FUNCTION taptime_server.read_effective_time_entry_export_v3(
  uuid, timestamptz, timestamptz, integer
) OWNER TO taptime_time_export_function_owner;
REVOKE ALL ON FUNCTION taptime_server.read_effective_time_entry_export_v3(
  uuid, timestamptz, timestamptz, integer
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.read_effective_time_entry_export_v3(
  uuid, timestamptz, timestamptz, integer
) TO taptime_time_exporter;

CREATE FUNCTION taptime_server.append_time_entry_export_audit_v3(
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
    OR requested_actor_user_id IS DISTINCT FROM NULLIF(
      pg_catalog.current_setting('app.user_id', true), ''
    )::uuid
    OR NOT taptime_server.has_current_time_export_authority(requested_organization_id)
    OR requested_correlation_id COLLATE "C"
       !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    OR requested_to_exclusive <= requested_from_inclusive
    OR requested_to_exclusive - requested_from_inclusive > interval '31 days'
    OR requested_row_count NOT BETWEEN 0 AND 10000
    OR requested_byte_count NOT BETWEEN 1 AND 8388608
    OR requested_sha256 COLLATE "C" !~ '^[0-9a-f]{64}$'
  THEN
    RAISE EXCEPTION 'Time export v3 audit capability rejected' USING ERRCODE = '42501';
  END IF;

  INSERT INTO taptime_server.audit_events (
    id, organization_id, actor_user_id, event_type, entity_type, entity_id,
    occurred_at, correlation_id, payload
  ) VALUES (
    requested_audit_id, requested_organization_id, requested_actor_user_id,
    'TimeEntryExportGenerated', 'TimeEntryExport', requested_audit_id,
    pg_catalog.transaction_timestamp(), requested_correlation_id,
    pg_catalog.jsonb_build_object(
      'schemaVersion', 3,
      'fromInclusive', requested_from_inclusive,
      'toExclusive', requested_to_exclusive,
      'rowCount', requested_row_count,
      'byteCount', requested_byte_count,
      'sha256', requested_sha256
    )
  );
END
$audit$;

ALTER FUNCTION taptime_server.append_time_entry_export_audit_v3(
  uuid, uuid, uuid, text, timestamptz, timestamptz, integer, integer, text
) OWNER TO taptime_time_export_function_owner;
REVOKE ALL ON FUNCTION taptime_server.append_time_entry_export_audit_v3(
  uuid, uuid, uuid, text, timestamptz, timestamptz, integer, integer, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.append_time_entry_export_audit_v3(
  uuid, uuid, uuid, text, timestamptz, timestamptz, integer, integer, text
) TO taptime_time_exporter;

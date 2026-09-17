-- T-036 / D-056: the longest Berlin calendar month spans 31 days plus the repeated hour.
-- Query-size guard only. No data changes; preserve every existing function's signature,
-- body, owner and permissions except for this range comparison.
-- Lifecycle: migrations create/replace this read-only constant; a future migration may
-- remove it only after replacing all callers. SQL/TypeScript parity is tested on the live DB.
CREATE OR REPLACE FUNCTION taptime_server.maximum_calendar_month_range()
RETURNS interval
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog
AS $range$
  SELECT (31 * 24 + 1) * interval '1 hour'
$range$;

REVOKE ALL ON FUNCTION taptime_server.maximum_calendar_month_range() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.maximum_calendar_month_range()
  TO taptime_time_export_function_owner, taptime_time_review_read_function_owner;

CREATE OR REPLACE FUNCTION taptime_server.append_time_entry_export_audit_v1(
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
    OR requested_to_exclusive - requested_from_inclusive > taptime_server.maximum_calendar_month_range()
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

CREATE OR REPLACE FUNCTION taptime_server.read_effective_time_records_v1(
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
    OR requested_to_exclusive - requested_from_inclusive > taptime_server.maximum_calendar_month_range()
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

CREATE OR REPLACE FUNCTION taptime_server.read_effective_time_entry_export_v1(
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
    OR requested_to_exclusive - requested_from_inclusive > taptime_server.maximum_calendar_month_range()
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

CREATE OR REPLACE FUNCTION taptime_server.time_entry_export_v1_is_compatible(
  requested_organization_id uuid,
  requested_from_inclusive timestamptz,
  requested_to_exclusive timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $compatibility$
BEGIN
  IF pg_catalog.current_setting('role', true) <> 'taptime_time_exporter'
    OR NOT taptime_server.has_current_time_export_authority(requested_organization_id)
    OR requested_from_inclusive IS NULL
    OR requested_to_exclusive IS NULL
    OR requested_to_exclusive <= requested_from_inclusive
    OR requested_to_exclusive - requested_from_inclusive > taptime_server.maximum_calendar_month_range()
  THEN
    RAISE EXCEPTION 'Time export v1 compatibility capability rejected' USING ERRCODE = '42501';
  END IF;
  RETURN NOT EXISTS (
    SELECT 1
    FROM taptime_server.effective_time_records_v2 AS record
    WHERE record.organization_id = requested_organization_id
      AND record.effective_started_at >= requested_from_inclusive
      AND record.effective_started_at < requested_to_exclusive
      AND record.target_type <> 'customer'
  );
END
$compatibility$;

CREATE OR REPLACE FUNCTION taptime_server.read_effective_time_entry_export_v2(
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
  record_source text,
  target_type text,
  target_id uuid,
  target_display_name text,
  status text,
  started_via text,
  stopped_via text,
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
    OR NOT taptime_server.has_current_time_export_authority(requested_organization_id)
    OR requested_from_inclusive IS NULL
    OR requested_to_exclusive IS NULL
    OR requested_to_exclusive <= requested_from_inclusive
    OR requested_to_exclusive - requested_from_inclusive > taptime_server.maximum_calendar_month_range()
    OR requested_limit NOT BETWEEN 1 AND 10001
  THEN
    RAISE EXCEPTION 'Time export v2 capability rejected' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT record.organization_id, organization.name, record.time_record_id,
         membership.id, COALESCE(membership.display_name, ''),
         record.source, record.target_type, record.target_id, target.display_name,
         record.status, record.started_via, record.stopped_via,
         record.effective_started_at, record.effective_stopped_at
  FROM taptime_server.effective_time_records_v2 AS record
  JOIN taptime_server.organizations AS organization
    ON organization.id = record.organization_id
  JOIN taptime_server.memberships AS membership
    ON membership.organization_id = record.organization_id
   AND membership.user_id = record.user_id
  JOIN taptime_server.work_targets AS target
    ON target.organization_id = record.organization_id
   AND target.target_type = record.target_type
   AND target.target_id = record.target_id
  WHERE record.organization_id = requested_organization_id
    AND record.effective_started_at >= requested_from_inclusive
    AND record.effective_started_at < requested_to_exclusive
  ORDER BY record.effective_started_at, record.time_record_id
  LIMIT requested_limit;
END
$export$;

CREATE OR REPLACE FUNCTION taptime_server.append_time_entry_export_audit_v2(
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
    OR requested_to_exclusive - requested_from_inclusive > taptime_server.maximum_calendar_month_range()
    OR requested_row_count NOT BETWEEN 0 AND 10000
    OR requested_byte_count NOT BETWEEN 1 AND 8388608
    OR requested_sha256 COLLATE "C" !~ '^[0-9a-f]{64}$'
  THEN
    RAISE EXCEPTION 'Time export v2 audit capability rejected' USING ERRCODE = '42501';
  END IF;
  INSERT INTO taptime_server.audit_events (
    id, organization_id, actor_user_id, event_type, entity_type, entity_id,
    occurred_at, correlation_id, payload
  ) VALUES (
    requested_audit_id, requested_organization_id, requested_actor_user_id,
    'TimeEntryExportGenerated', 'TimeEntryExport', requested_audit_id,
    pg_catalog.transaction_timestamp(), requested_correlation_id,
    pg_catalog.jsonb_build_object(
      'schemaVersion', 2,
      'fromInclusive', requested_from_inclusive,
      'toExclusive', requested_to_exclusive,
      'rowCount', requested_row_count,
      'byteCount', requested_byte_count,
      'sha256', requested_sha256
    )
  );
END
$audit$;

CREATE OR REPLACE FUNCTION taptime_server.read_effective_time_records_v2(
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
  target_type text,
  target_id uuid,
  target_display_name text,
  source text,
  status text,
  started_via text,
  stopped_via text,
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
    OR requested_to_exclusive - requested_from_inclusive > taptime_server.maximum_calendar_month_range()
    OR requested_limit NOT BETWEEN 1 AND 101
    OR (requested_after_started_at IS NULL) <> (requested_after_time_record_id IS NULL)
  THEN
    RAISE EXCEPTION 'Time review v2 read capability rejected' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT record.time_record_id, membership.id, COALESCE(membership.display_name, ''),
         record.target_type, record.target_id, target.display_name,
         record.source, record.status, record.started_via, record.stopped_via,
         record.effective_started_at, record.effective_stopped_at,
         record.base_row_version, record.effective_revision_number,
         EXISTS (
           SELECT 1 FROM taptime_server.effective_time_records_v2 AS other
           WHERE other.organization_id = record.organization_id
             AND other.user_id = record.user_id
             AND other.time_record_id <> record.time_record_id
             AND other.effective_started_at < COALESCE(
               record.effective_stopped_at, pg_catalog.transaction_timestamp()
             )
             AND COALESCE(other.effective_stopped_at, pg_catalog.transaction_timestamp())
               > record.effective_started_at
         )
  FROM taptime_server.effective_time_records_v2 AS record
  LEFT JOIN taptime_server.memberships AS membership
    ON membership.organization_id = record.organization_id
   AND membership.user_id = record.user_id
  JOIN taptime_server.work_targets AS target
    ON target.organization_id = record.organization_id
   AND target.target_type = record.target_type
   AND target.target_id = record.target_id
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

CREATE OR REPLACE FUNCTION taptime_server.read_effective_time_entry_export_v3(
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
    OR requested_to_exclusive - requested_from_inclusive > taptime_server.maximum_calendar_month_range()
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

CREATE OR REPLACE FUNCTION taptime_server.append_time_entry_export_audit_v3(
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
    OR requested_to_exclusive - requested_from_inclusive > taptime_server.maximum_calendar_month_range()
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

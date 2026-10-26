-- T-099b. Migrations create, replace and remove these indexes/read definitions.
-- No new stored business data, roles or policies. Preserve both view security modes.
-- Completed pauses need the same key lookup as active pauses; the old partial
-- unique index only covers status='started'.
CREATE INDEX break_intervals_record ON taptime_server.break_intervals
  (organization_id, time_entry_id, started_at);
CREATE INDEX time_entries_month ON taptime_server.time_entries
  (organization_id, started_at, id);
CREATE INDEX time_record_revisions_month ON taptime_server.time_record_revisions
  (organization_id, effective_started_at, time_record_id);

-- Split untouched entries from revisions so key/person/month predicates can reach
-- their base indexes. A revision in the requested month only wins if there is no
-- newer revision anywhere, including outside that month. Never truncate history.


CREATE OR REPLACE VIEW taptime_server.effective_time_records_v2
WITH (security_barrier = true) AS
SELECT entry.organization_id AS organization_id,
       entry.id AS time_record_id,
       entry.id AS canonical_time_entry_id,
       entry.user_id AS user_id,
       entry.target_type AS target_type,
       entry.target_customer_id AS target_id,
       entry.started_at AS effective_started_at,
       entry.stopped_at AS effective_stopped_at,
       entry.status AS status,
       entry.row_version AS base_row_version,
       0::bigint AS effective_revision_number,
       'canonical'::text AS source,
       COALESCE(entry.started_via,'nfc'::text) AS started_via,
       CASE WHEN entry.status='started' THEN NULL::text ELSE COALESCE(entry.stopped_via,'nfc'::text) END AS stopped_via
FROM taptime_server.time_entries entry
WHERE NOT EXISTS (SELECT 1 FROM taptime_server.time_record_revisions revision
  WHERE revision.organization_id=entry.organization_id AND revision.time_record_id=entry.id)
  AND NOT EXISTS (SELECT 1 FROM taptime_server.time_record_voids void
    WHERE void.organization_id=entry.organization_id AND void.time_record_id=entry.id)
UNION ALL
SELECT entry.organization_id AS organization_id,
       entry.id AS time_record_id,
       entry.id AS canonical_time_entry_id,
       entry.user_id AS user_id,
       entry.target_type AS target_type,
       entry.target_customer_id AS target_id,
       revision.effective_started_at AS effective_started_at,
       CASE WHEN entry.status='started' THEN NULL ELSE revision.effective_stopped_at END AS effective_stopped_at,
       entry.status AS status,
       entry.row_version AS base_row_version,
       revision.revision_number AS effective_revision_number,
       'canonical'::text AS source,
       COALESCE(entry.started_via,'nfc'::text) AS started_via,
       CASE WHEN entry.status='started' THEN NULL::text ELSE COALESCE(entry.stopped_via,'nfc'::text) END AS stopped_via
FROM taptime_server.time_record_revisions revision
JOIN taptime_server.time_entries entry ON entry.organization_id=revision.organization_id AND entry.id=revision.time_record_id
WHERE NOT EXISTS (SELECT 1 FROM taptime_server.time_record_revisions newer
  WHERE newer.organization_id=revision.organization_id AND newer.time_record_id=revision.time_record_id
    AND newer.revision_number>revision.revision_number)
  AND NOT EXISTS (SELECT 1 FROM taptime_server.time_record_voids void
    WHERE void.organization_id=entry.organization_id AND void.time_record_id=entry.id)
UNION ALL
SELECT revision.organization_id AS organization_id,
       revision.time_record_id AS time_record_id,
       NULL::uuid AS canonical_time_entry_id,
       revision.user_id AS user_id,
       revision.target_type AS target_type,
       revision.target_customer_id AS target_id,
       revision.effective_started_at AS effective_started_at,
       revision.effective_stopped_at AS effective_stopped_at,
       'stopped'::text AS status,
       0::bigint AS base_row_version,
       revision.revision_number AS effective_revision_number,
       'recovered'::text AS source,
       NULL::text AS started_via,
       NULL::text AS stopped_via
FROM taptime_server.time_record_revisions revision
WHERE revision.canonical_time_entry_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM taptime_server.time_record_revisions newer
  WHERE newer.organization_id=revision.organization_id AND newer.time_record_id=revision.time_record_id
    AND newer.revision_number>revision.revision_number)
  AND NOT EXISTS (SELECT 1 FROM taptime_server.time_record_voids void
    WHERE void.organization_id=revision.organization_id AND void.time_record_id=revision.time_record_id);


CREATE OR REPLACE VIEW taptime_server.effective_time_records_v1
WITH (security_invoker = true) AS
SELECT entry.organization_id AS organization_id,
       entry.id AS time_record_id,
       entry.id AS canonical_time_entry_id,
       entry.user_id AS user_id,
       entry.target_type AS target_type,
       entry.target_customer_id AS target_customer_id,
       entry.status AS status,
       entry.started_at AS effective_started_at,
       entry.stopped_at AS effective_stopped_at,
       entry.row_version AS base_row_version,
       0::bigint AS effective_revision_number,
       'canonical'::text AS source
FROM taptime_server.time_entries entry
WHERE NOT EXISTS (SELECT 1 FROM taptime_server.time_record_revisions revision
  WHERE revision.organization_id=entry.organization_id AND revision.time_record_id=entry.id)
  AND NOT EXISTS (SELECT 1 FROM taptime_server.time_record_voids void
    WHERE void.organization_id=entry.organization_id AND void.time_record_id=entry.id)
UNION ALL
SELECT entry.organization_id AS organization_id,
       entry.id AS time_record_id,
       entry.id AS canonical_time_entry_id,
       entry.user_id AS user_id,
       entry.target_type AS target_type,
       entry.target_customer_id AS target_customer_id,
       entry.status AS status,
       revision.effective_started_at AS effective_started_at,
       CASE WHEN entry.status='started' THEN NULL ELSE revision.effective_stopped_at END AS effective_stopped_at,
       entry.row_version AS base_row_version,
       revision.revision_number AS effective_revision_number,
       'canonical'::text AS source
FROM taptime_server.time_record_revisions revision
JOIN taptime_server.time_entries entry ON entry.organization_id=revision.organization_id AND entry.id=revision.time_record_id
WHERE NOT EXISTS (SELECT 1 FROM taptime_server.time_record_revisions newer
  WHERE newer.organization_id=revision.organization_id AND newer.time_record_id=revision.time_record_id
    AND newer.revision_number>revision.revision_number)
  AND NOT EXISTS (SELECT 1 FROM taptime_server.time_record_voids void
    WHERE void.organization_id=entry.organization_id AND void.time_record_id=entry.id)
UNION ALL
SELECT revision.organization_id AS organization_id,
       revision.time_record_id AS time_record_id,
       NULL::uuid AS canonical_time_entry_id,
       revision.user_id AS user_id,
       revision.target_type AS target_type,
       revision.target_customer_id AS target_customer_id,
       'stopped'::text AS status,
       revision.effective_started_at AS effective_started_at,
       revision.effective_stopped_at AS effective_stopped_at,
       0::bigint AS base_row_version,
       revision.revision_number AS effective_revision_number,
       'recovered'::text AS source
FROM taptime_server.time_record_revisions revision
WHERE revision.canonical_time_entry_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM taptime_server.time_record_revisions newer
  WHERE newer.organization_id=revision.organization_id AND newer.time_record_id=revision.time_record_id
    AND newer.revision_number>revision.revision_number)
  AND NOT EXISTS (SELECT 1 FROM taptime_server.time_record_voids void
    WHERE void.organization_id=revision.organization_id AND void.time_record_id=revision.time_record_id);


CREATE OR REPLACE FUNCTION taptime_server.read_time_record_calendar_v1(requested_ids uuid[])
RETURNS TABLE(time_record_id uuid, details jsonb, calendar jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog
AS $calendar$
  -- Reuse the live self/tenant/home-location authorization from 033. Arbitrary
  -- record IDs cannot widen that scope. One snapshot covers details and breaks.
  WITH authorized AS MATERIALIZED (
    SELECT * FROM taptime_server.read_time_record_details_v1(requested_ids)
    WHERE current_setting('role',true) IN ('taptime_mobile_own_time_reader','taptime_membership_manager')
  ), requested_records AS MATERIALIZED (
    SELECT record.* FROM taptime_server.effective_time_records_v2 record
    JOIN authorized USING(time_record_id)
    WHERE record.organization_id=NULLIF(current_setting('app.organization_id',true),'')::uuid
      AND record.time_record_id=ANY(requested_ids)
  )
  SELECT record.time_record_id, authorized.details, jsonb_build_object(
    'asOf',to_char(transaction_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'workDurationSeconds',duration.work_seconds,
    'breakDurationSeconds',duration.break_seconds,
    'breakIntervals',duration.break_intervals)
  FROM authorized JOIN requested_records record USING(time_record_id)
  CROSS JOIN LATERAL taptime_server.time_record_duration_v1(record.organization_id,
    record.canonical_time_entry_id,record.effective_started_at,record.effective_stopped_at) duration
  WHERE record.organization_id=NULLIF(current_setting('app.organization_id',true),'')::uuid;
$calendar$;

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
    OR NOT EXISTS (SELECT 1 FROM taptime_server.has_time_management_authority_v1(
      requested_organization_id, requested_actor_user_id, requested_membership_id, NULL
    ))
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
  WITH scope AS MATERIALIZED (
    SELECT * FROM taptime_server.has_time_management_authority_v1(
      requested_organization_id, requested_actor_user_id, requested_membership_id, NULL)
  ), allowed_users AS MATERIALIZED (
    SELECT target.user_id FROM taptime_server.memberships target
    WHERE target.organization_id=requested_organization_id
      AND (target.revoked_at IS NULL OR taptime_server.departure_is_visible_v1(target.revoked_at))
      AND EXISTS (
        SELECT 1 FROM taptime_server.membership_home_location_assignments home
        JOIN scope ON scope.scope_kind='location' AND scope.location_id=home.location_id
        WHERE home.organization_id=target.organization_id AND home.membership_id=target.id
          AND home.location_id=taptime_server.membership_management_home_v1(target.organization_id,target.id))
  )
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
    AND (EXISTS (SELECT 1 FROM scope WHERE scope_kind='organization')
      OR record.user_id IN (SELECT allowed_users.user_id FROM allowed_users))
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
    OR NOT EXISTS (SELECT 1 FROM taptime_server.has_time_management_authority_v1(
      requested_organization_id, requested_actor_user_id, requested_membership_id, NULL
    ))
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
  WITH scope AS MATERIALIZED (
    SELECT * FROM taptime_server.has_time_management_authority_v1(
      requested_organization_id, requested_actor_user_id, requested_membership_id, NULL)
  ), allowed_users AS MATERIALIZED (
    SELECT target.user_id FROM taptime_server.memberships target
    WHERE target.organization_id=requested_organization_id
      AND (target.revoked_at IS NULL OR taptime_server.departure_is_visible_v1(target.revoked_at))
      AND EXISTS (
        SELECT 1 FROM taptime_server.membership_home_location_assignments home
        JOIN scope ON scope.scope_kind='location' AND scope.location_id=home.location_id
        WHERE home.organization_id=target.organization_id AND home.membership_id=target.id
          AND home.location_id=taptime_server.membership_management_home_v1(target.organization_id,target.id))
  )
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
    AND (EXISTS (SELECT 1 FROM scope WHERE scope_kind='organization')
      OR record.user_id IN (SELECT allowed_users.user_id FROM allowed_users))
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

-- D-152 export bounds. The pilot peak is 29,010 rows/month. Byte capacity is
-- derived from the row bound and UTF-8 field maxima, never a larger JSON limit.
CREATE FUNCTION taptime_server.maximum_time_entry_export_rows_v1() RETURNS integer
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$ SELECT 2 * 29010 $$;
CREATE FUNCTION taptime_server.maximum_time_entry_export_bytes_v1() RETURNS integer
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
  SELECT taptime_server.maximum_time_entry_export_rows_v1() * (4 * (120 + 120 + 500) + 512) + 1024
$$;
ALTER FUNCTION taptime_server.maximum_time_entry_export_rows_v1() OWNER TO taptime_time_export_function_owner;
ALTER FUNCTION taptime_server.maximum_time_entry_export_bytes_v1() OWNER TO taptime_time_export_function_owner;
REVOKE ALL ON FUNCTION taptime_server.maximum_time_entry_export_rows_v1(),taptime_server.maximum_time_entry_export_bytes_v1() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.maximum_time_entry_export_rows_v1() TO taptime_time_review_read_function_owner;

-- Cheap bounded preflight, before pause computation, serialization or HTTP bytes.
CREATE FUNCTION taptime_server.read_time_entry_export_size_v1(org uuid,from_inclusive timestamptz,to_exclusive timestamptz)
RETURNS integer LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $size$
BEGIN
  IF current_setting('role',true) IS DISTINCT FROM 'taptime_time_exporter'
    OR NOT taptime_server.has_current_time_export_authority(org)
    OR from_inclusive IS NULL OR to_exclusive IS NULL OR to_exclusive<=from_inclusive
    OR to_exclusive-from_inclusive>taptime_server.maximum_calendar_month_range()
  THEN RAISE EXCEPTION 'Time export capability rejected' USING ERRCODE='42501'; END IF;
  RETURN (SELECT count(*)::integer FROM (
    SELECT 1 FROM taptime_server.effective_time_records_v2 r
    WHERE r.organization_id=org AND r.effective_started_at>=from_inclusive AND r.effective_started_at<to_exclusive
    LIMIT taptime_server.maximum_time_entry_export_rows_v1()+1
  ) bounded);
END
$size$;
ALTER FUNCTION taptime_server.read_time_entry_export_size_v1(uuid,timestamptz,timestamptz) OWNER TO taptime_time_export_function_owner;
REVOKE ALL ON FUNCTION taptime_server.read_time_entry_export_size_v1(uuid,timestamptz,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.read_time_entry_export_size_v1(uuid,timestamptz,timestamptz) TO taptime_time_exporter;

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
    OR requested_limit NOT BETWEEN 1 AND taptime_server.maximum_time_entry_export_rows_v1()+1
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
    OR requested_row_count NOT BETWEEN 0 AND taptime_server.maximum_time_entry_export_rows_v1()
    OR requested_byte_count IS NULL
    OR requested_byte_count NOT BETWEEN 1 AND taptime_server.maximum_time_entry_export_bytes_v1()
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
    OR requested_limit NOT BETWEEN 1 AND taptime_server.maximum_time_entry_export_rows_v1()+1
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
    OR requested_row_count NOT BETWEEN 0 AND taptime_server.maximum_time_entry_export_rows_v1()
    OR requested_byte_count NOT BETWEEN 1 AND taptime_server.maximum_time_entry_export_bytes_v1()
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
    OR requested_limit NOT BETWEEN 1 AND taptime_server.maximum_time_entry_export_rows_v1()+1
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
    duration.break_seconds,
    duration.work_seconds,
    record.effective_revision_number
  FROM taptime_server.effective_time_records_v2 AS record
  JOIN taptime_server.memberships AS membership
    ON membership.organization_id = record.organization_id
   AND membership.user_id = record.user_id
  JOIN taptime_server.work_targets AS target
    ON target.organization_id = record.organization_id
   AND target.target_type = record.target_type
   AND target.target_id = record.target_id
  CROSS JOIN LATERAL taptime_server.time_record_duration_v1(record.organization_id,
    record.canonical_time_entry_id,record.effective_started_at,record.effective_stopped_at) duration
  WHERE record.organization_id = requested_organization_id
    AND record.effective_started_at >= requested_from_inclusive
    AND record.effective_started_at < requested_to_exclusive
  ORDER BY record.effective_started_at, record.time_record_id
  LIMIT requested_limit;
END
$export$;

-- Read v4 metadata from the same effective row, without a second projection per batch.
CREATE FUNCTION taptime_server.read_effective_time_entry_export_v4(
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
  effective_revision_number bigint,
  origin text,
  changed boolean,
  comment text
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
    OR requested_limit NOT BETWEEN 1 AND taptime_server.maximum_time_entry_export_rows_v1()+1
  THEN
    RAISE EXCEPTION 'Time export v4 capability rejected' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  -- Preserve the month cardinality while choosing the metadata joins. Joining
  -- memberships/targets first severely underestimates the UNION view's rows.
  -- Latest comments use an anti-join so PostgreSQL can choose a set-based plan.
  WITH records_with_details AS MATERIALIZED (
    SELECT record.*,
      CASE WHEN origin.origin='backfilled' THEN 'backfilled' WHEN record.source='recovered' THEN 'recovered'
        WHEN record.started_via='manual' OR record.stopped_via='manual' THEN 'manual' ELSE 'nfc' END AS export_origin,
      stopped.time_entry_id IS NOT NULL OR record.effective_revision_number > CASE WHEN record.source='recovered' THEN 1 ELSE 0 END AS export_changed,
      comment.comment AS export_comment
    FROM taptime_server.effective_time_records_v2 AS record
    LEFT JOIN taptime_server.administration_stop_commands stopped
      ON stopped.organization_id=record.organization_id AND stopped.time_entry_id=record.time_record_id
    LEFT JOIN taptime_server.time_record_origins origin
      ON origin.organization_id=record.organization_id AND origin.time_record_id=record.time_record_id
    LEFT JOIN taptime_server.time_record_comments comment
      ON comment.organization_id=record.organization_id AND comment.time_record_id=record.time_record_id
      AND NOT EXISTS (
        SELECT 1 FROM taptime_server.time_record_comments newer
        WHERE newer.organization_id=comment.organization_id AND newer.time_record_id=comment.time_record_id
          AND newer.comment_number>comment.comment_number
      )
    WHERE record.organization_id = requested_organization_id
      AND record.effective_started_at >= requested_from_inclusive
      AND record.effective_started_at < requested_to_exclusive
  )
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
    duration.break_seconds,
    duration.work_seconds,
    record.effective_revision_number,
    record.export_origin,
    record.export_changed,
    record.export_comment
  FROM records_with_details AS record
  JOIN taptime_server.memberships AS membership
    ON membership.organization_id = record.organization_id
   AND membership.user_id = record.user_id
  JOIN taptime_server.work_targets AS target
    ON target.organization_id = record.organization_id
   AND target.target_type = record.target_type
   AND target.target_id = record.target_id
  CROSS JOIN LATERAL taptime_server.time_record_duration_v1(record.organization_id,
    record.canonical_time_entry_id,record.effective_started_at,record.effective_stopped_at) duration
  ORDER BY record.effective_started_at, record.time_record_id
  LIMIT requested_limit;
END
$export$;

ALTER FUNCTION taptime_server.read_effective_time_entry_export_v4(uuid,timestamptz,timestamptz,integer) OWNER TO taptime_time_review_read_function_owner;
REVOKE ALL ON FUNCTION taptime_server.read_effective_time_entry_export_v4(uuid,timestamptz,timestamptz,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.read_effective_time_entry_export_v4(uuid,timestamptz,timestamptz,integer) TO taptime_time_exporter;

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
    OR requested_row_count NOT BETWEEN 0 AND taptime_server.maximum_time_entry_export_rows_v1()
    OR requested_byte_count NOT BETWEEN 1 AND taptime_server.maximum_time_entry_export_bytes_v1()
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

CREATE OR REPLACE FUNCTION taptime_server.append_time_entry_export_audit_v4(
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
    OR requested_row_count NOT BETWEEN 0 AND taptime_server.maximum_time_entry_export_rows_v1()
    OR requested_byte_count NOT BETWEEN 1 AND taptime_server.maximum_time_entry_export_bytes_v1()
    OR requested_sha256 COLLATE "C" !~ '^[0-9a-f]{64}$'
  THEN
    RAISE EXCEPTION 'Time export v4 audit capability rejected' USING ERRCODE = '42501';
  END IF;

  INSERT INTO taptime_server.audit_events (
    id, organization_id, actor_user_id, event_type, entity_type, entity_id,
    occurred_at, correlation_id, payload
  ) VALUES (
    requested_audit_id, requested_organization_id, requested_actor_user_id,
    'TimeEntryExportGenerated', 'TimeEntryExport', requested_audit_id,
    pg_catalog.transaction_timestamp(), requested_correlation_id,
    pg_catalog.jsonb_build_object(
      'schemaVersion', 4,
      'fromInclusive', requested_from_inclusive,
      'toExclusive', requested_to_exclusive,
      'rowCount', requested_row_count,
      'byteCount', requested_byte_count,
      'sha256', requested_sha256
    )
  );
END
$audit$;

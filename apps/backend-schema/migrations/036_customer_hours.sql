-- T-084: read-only customer projection. Migrations own creation, replacement and removal;
-- no new stored data. Internal calculation is callable only by authorized reader owners.
GRANT SELECT (id) ON taptime_server.break_intervals TO taptime_time_export_function_owner;
CREATE FUNCTION taptime_server.time_record_duration_v1(
  org uuid, canonical_id uuid, start_at timestamptz, stop_at timestamptz
) RETURNS TABLE(work_seconds bigint, break_seconds bigint, break_intervals jsonb)
-- Invoker-only, with fully qualified sources; all authorized callers pin pg_catalog.
-- Allow inlining so payroll need not construct the calendar's JSON intervals.
LANGUAGE sql STABLE
AS $duration$
  SELECT GREATEST(0::bigint,floor(extract(epoch FROM
    (COALESCE(stop_at,transaction_timestamp())-start_at)))::bigint-pauses.seconds),
    pauses.seconds,pauses.intervals
  FROM (
    SELECT COALESCE(sum(floor(extract(epoch FROM (clipped.stop-clipped.start)))::bigint),0)::bigint AS seconds,
      COALESCE(jsonb_agg(jsonb_build_object(
        'startedAt',to_char(clipped.start AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'stoppedAt',to_char(clipped.stop AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
      ) ORDER BY clipped.start,clipped.id),'[]'::jsonb) AS intervals
    FROM (
      SELECT pause.id,GREATEST(pause.started_at,start_at) AS start,
        LEAST(COALESCE(pause.stopped_at,transaction_timestamp()),COALESCE(stop_at,transaction_timestamp())) AS stop
      FROM taptime_server.break_intervals pause
      WHERE pause.organization_id=org AND pause.time_entry_id=canonical_id
        AND pause.started_at<COALESCE(stop_at,transaction_timestamp())
        AND COALESCE(pause.stopped_at,transaction_timestamp())>start_at
    ) clipped
  ) pauses;
$duration$;
ALTER FUNCTION taptime_server.time_record_duration_v1(uuid,uuid,timestamptz,timestamptz)
  OWNER TO taptime_time_review_read_function_owner;
REVOKE ALL ON FUNCTION taptime_server.time_record_duration_v1(uuid,uuid,timestamptz,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.time_record_duration_v1(uuid,uuid,timestamptz,timestamptz)
  TO taptime_time_export_function_owner;

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
  SELECT duration.work_seconds FROM authorized_record AS record
  CROSS JOIN LATERAL taptime_server.time_record_duration_v1(record.organization_id,
    record.canonical_time_entry_id,record.effective_started_at,record.effective_stopped_at) duration
$duration$;
ALTER FUNCTION taptime_server.effective_work_duration_seconds_v1(uuid)
  OWNER TO taptime_time_export_function_owner;
REVOKE ALL ON FUNCTION taptime_server.effective_work_duration_seconds_v1(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.effective_work_duration_seconds_v1(uuid)
  TO taptime_employee, taptime_administrator, taptime_server_lifecycle,
     taptime_offline_event_ingestor, taptime_time_export_function_owner;

CREATE OR REPLACE FUNCTION taptime_server.read_time_record_calendar_v1(requested_ids uuid[])
RETURNS TABLE(time_record_id uuid, details jsonb, calendar jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog
AS $calendar$
  -- Reuse the live self/tenant/home-location authorization from 033. Arbitrary
  -- record IDs cannot widen that scope. One snapshot covers details and breaks.
  WITH authorized AS MATERIALIZED (
    SELECT * FROM taptime_server.read_time_record_details_v1(requested_ids)
    WHERE current_setting('role',true) IN ('taptime_mobile_own_time_reader','taptime_membership_manager')
  )
  SELECT record.time_record_id, authorized.details, jsonb_build_object(
    'asOf',to_char(transaction_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'workDurationSeconds',duration.work_seconds,
    'breakDurationSeconds',duration.break_seconds,
    'breakIntervals',duration.break_intervals)
  FROM authorized JOIN taptime_server.effective_time_records_v2 record USING(time_record_id)
  CROSS JOIN LATERAL taptime_server.time_record_duration_v1(record.organization_id,
    record.canonical_time_entry_id,record.effective_started_at,record.effective_stopped_at) duration
  WHERE record.organization_id=NULLIF(current_setting('app.organization_id',true),'')::uuid;
$calendar$;
ALTER FUNCTION taptime_server.read_time_record_calendar_v1(uuid[]) OWNER TO taptime_time_review_read_function_owner;
REVOKE ALL ON FUNCTION taptime_server.read_time_record_calendar_v1(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.read_time_record_calendar_v1(uuid[])
  TO taptime_mobile_own_time_reader,taptime_membership_manager;

GRANT SELECT ON taptime_server.work_target_location_assignments,
  taptime_server.membership_management_location_grants, taptime_server.locations
  TO taptime_time_review_read_function_owner;

CREATE FUNCTION taptime_server.read_customer_hours_v1(from_inclusive timestamptz, to_exclusive timestamptz)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog
AS $customers$
DECLARE
  org uuid := NULLIF(current_setting('app.organization_id',true),'')::uuid;
  actor_id uuid := NULLIF(current_setting('app.membership_id',true),'')::uuid;
  actor_user uuid := NULLIF(current_setting('app.user_id',true),'')::uuid;
  actor_role text;
  locations_enabled boolean;
  result jsonb;
BEGIN
  -- No requested role, person, location or tenant. The live membership is authoritative,
  -- including when the session's role hint is stale or forged.
  SELECT member.role,organization.locations_enabled INTO actor_role,locations_enabled
    FROM taptime_server.memberships member
    JOIN taptime_server.organizations organization ON organization.id=member.organization_id AND organization.status='active'
    WHERE member.organization_id=org AND member.id=actor_id AND member.user_id=actor_user AND member.revoked_at IS NULL;
  IF current_setting('role',true) IS DISTINCT FROM 'taptime_mobile_own_time_reader'
    OR actor_role IS NULL OR actor_role NOT IN ('administrator','standortleitung','employee')
  THEN RAISE EXCEPTION 'Customer read capability rejected' USING ERRCODE='42501'; END IF;
  IF from_inclusive IS NULL OR to_exclusive IS NULL OR to_exclusive<=from_inclusive
    OR to_exclusive-from_inclusive>taptime_server.maximum_calendar_month_range()
    OR from_inclusive IS DISTINCT FROM (date_trunc('month',from_inclusive AT TIME ZONE 'Europe/Berlin') AT TIME ZONE 'Europe/Berlin')
    OR to_exclusive IS DISTINCT FROM ((from_inclusive AT TIME ZONE 'Europe/Berlin'+interval '1 month') AT TIME ZONE 'Europe/Berlin')
  THEN RAISE EXCEPTION 'Invalid calendar month' USING ERRCODE='22023'; END IF;

  WITH visible_customers AS MATERIALIZED (
    SELECT customer.id,customer.display_name,customer.active
    FROM taptime_server.customers customer
    -- D-099: choose the latest binding before checking today's manager grants.
    -- Historical entry locations never determine this scope. The ID breaks time ties.
    LEFT JOIN LATERAL (
      SELECT binding.location_id
      FROM taptime_server.work_target_location_assignments binding
      WHERE binding.organization_id=org AND binding.target_type='customer' AND binding.target_id=customer.id
      ORDER BY binding.assigned_at DESC,binding.id DESC
      LIMIT 1
    ) last_binding ON NOT customer.active
    WHERE customer.organization_id=org AND (
      actor_role='administrator'
      OR (customer.active AND (
        (actor_role='employee' AND NOT locations_enabled)
        OR (locations_enabled AND EXISTS (
          SELECT 1 FROM taptime_server.work_target_location_assignments binding
          JOIN taptime_server.locations location ON location.organization_id=binding.organization_id AND location.id=binding.location_id AND location.active
          WHERE binding.organization_id=org AND binding.target_type='customer' AND binding.target_id=customer.id AND binding.revoked_at IS NULL
            AND ((actor_role='standortleitung' AND EXISTS (
              SELECT 1 FROM taptime_server.membership_management_location_grants grant_row
              WHERE grant_row.organization_id=org AND grant_row.membership_id=actor_id
                AND grant_row.location_id=binding.location_id AND grant_row.revoked_at IS NULL
            )) OR (actor_role='employee' AND EXISTS (
              SELECT 1 FROM taptime_server.membership_home_location_assignments home
              WHERE home.organization_id=org AND home.membership_id=actor_id
                AND home.location_id=binding.location_id AND home.revoked_at IS NULL
            )))
        ))
      ))
      -- Never-bound inactive customers remain admin-only, even with locations off.
      -- Employee visibility is narrowed to own monthly hours by visible_records/totals.
      OR (NOT customer.active AND last_binding.location_id IS NOT NULL AND (
        actor_role='employee'
        OR (actor_role='standortleitung' AND locations_enabled AND EXISTS (
          SELECT 1 FROM taptime_server.membership_management_location_grants grant_row
          WHERE grant_row.organization_id=org AND grant_row.membership_id=actor_id
            AND grant_row.location_id=last_binding.location_id AND grant_row.revoked_at IS NULL
        ))
      ))
    )
  ), visible_records AS MATERIALIZED (
    SELECT record.*,duration.work_seconds
    FROM taptime_server.effective_time_records_v2 record
    JOIN visible_customers customer ON customer.id=record.target_id
    CROSS JOIN LATERAL taptime_server.time_record_duration_v1(record.organization_id,
      record.canonical_time_entry_id,record.effective_started_at,record.effective_stopped_at) duration
    WHERE record.organization_id=org AND record.target_type='customer'
      AND record.effective_started_at>=from_inclusive AND record.effective_started_at<to_exclusive
      AND (actor_role IN ('administrator','standortleitung') OR record.user_id=actor_user)
  )
  SELECT COALESCE(jsonb_agg(item.value ORDER BY item.display_name COLLATE "C",item.id),'[]'::jsonb) INTO result
  FROM (
    SELECT customer.id,customer.display_name,
      jsonb_build_object('customerId',customer.id,'displayName',customer.display_name,'active',customer.active,
        'workDurationSeconds',totals.seconds,'running',totals.running)
      || CASE WHEN actor_role='employee' THEN jsonb_build_object('days',(
        SELECT COALESCE(jsonb_agg(jsonb_build_object('date',day.date,'workDurationSeconds',day.seconds,'running',day.running) ORDER BY day.date),'[]'::jsonb)
        FROM (SELECT (record.effective_started_at AT TIME ZONE 'Europe/Berlin')::date AS date,
          sum(record.work_seconds)::bigint AS seconds,bool_or(record.effective_stopped_at IS NULL) AS running
          FROM visible_records record WHERE record.target_id=customer.id GROUP BY 1) day
      )) ELSE jsonb_build_object('people',(
        SELECT COALESCE(jsonb_agg(jsonb_build_object('membershipId',person.id,'displayName',person.display_name,
          'workDurationSeconds',person.seconds,'running',person.running) ORDER BY person.display_name COLLATE "C",person.id),'[]'::jsonb)
        FROM (SELECT member.id,COALESCE(NULLIF(member.display_name,''),'Ohne Namen') AS display_name,
          sum(record.work_seconds)::bigint AS seconds,bool_or(record.effective_stopped_at IS NULL) AS running
          FROM visible_records record JOIN taptime_server.memberships member ON member.organization_id=org AND member.user_id=record.user_id
          WHERE record.target_id=customer.id GROUP BY member.id,member.display_name) person
      )) END AS value
    FROM visible_customers customer
    CROSS JOIN LATERAL (SELECT COALESCE(sum(record.work_seconds),0)::bigint AS seconds,
      COALESCE(bool_or(record.effective_stopped_at IS NULL),false) AS running
      FROM visible_records record WHERE record.target_id=customer.id) totals
    WHERE customer.active OR totals.seconds>0 OR totals.running
  ) item;
  RETURN jsonb_build_object('version','customer-hours.v1','scope',CASE WHEN actor_role='employee' THEN 'self' ELSE 'people' END,
    'asOf',to_char(transaction_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'customers',result);
END
$customers$;
ALTER FUNCTION taptime_server.read_customer_hours_v1(timestamptz,timestamptz) OWNER TO taptime_time_review_read_function_owner;
REVOKE ALL ON FUNCTION taptime_server.read_customer_hours_v1(timestamptz,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.read_customer_hours_v1(timestamptz,timestamptz) TO taptime_mobile_own_time_reader;

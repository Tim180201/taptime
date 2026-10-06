-- T-110: selected-month read projection, maintained and removed by migrations.
-- No stored aggregate; v1-v3 SQL and v1-v4 HTTP keep their existing behavior.
CREATE FUNCTION taptime_server.read_managed_active_summary_v4(
  requested_location_id uuid, requested_is_running boolean,
  after_membership_id uuid, requested_limit integer,
  from_inclusive timestamptz, to_exclusive timestamptz
)
RETURNS TABLE (
  result_status text, server_time timestamptz, running_count bigint, total_count bigint,
  membership_id uuid, membership_display_name text, membership_role text,
  location_id uuid, location_name text, is_running boolean,
  running_since timestamptz, running_target_display_name text, departed_at timestamptz, month_work_duration_seconds bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog
AS $summary$
DECLARE
  org uuid := NULLIF(current_setting('app.organization_id', true), '')::uuid;
  actor_user uuid := NULLIF(current_setting('app.user_id', true), '')::uuid;
  actor uuid := NULLIF(current_setting('app.membership_id', true), '')::uuid;
  organization_scope boolean;
  location_scope uuid[];
  locations_enabled boolean;
BEGIN
  IF current_setting('role', true) IS DISTINCT FROM 'taptime_membership_manager' THEN
    result_status := 'forbidden'; RETURN NEXT; RETURN;
  END IF;
  SELECT bool_or(scope.scope_kind = 'organization' AND scope.location_id IS NULL),
    array_agg(scope.location_id) FILTER (WHERE scope.scope_kind = 'location' AND scope.location_id IS NOT NULL)
    INTO organization_scope, location_scope
  FROM taptime_server.has_membership_management_authority_v1(
    org, actor_user, actor, 'read', NULL, NULL, NULL
  ) AS scope;
  IF NOT COALESCE(organization_scope, false) AND COALESCE(cardinality(location_scope), 0) = 0 THEN
    result_status := 'forbidden'; RETURN NEXT; RETURN;
  END IF;
  SELECT organization.locations_enabled INTO locations_enabled
    FROM taptime_server.organizations AS organization WHERE organization.id = org;
  IF requested_location_id IS NOT NULL AND NOT (
    locations_enabled AND EXISTS (SELECT 1 FROM taptime_server.locations AS location
      WHERE location.organization_id = org AND location.id = requested_location_id AND location.active)
    AND (COALESCE(organization_scope, false) OR COALESCE(requested_location_id = ANY(location_scope), false))
  ) THEN result_status := 'forbidden'; RETURN NEXT; RETURN; END IF;
  IF requested_limit IS NULL OR requested_limit NOT BETWEEN 1 AND 20
    OR from_inclusive IS NULL OR to_exclusive IS NULL
    OR NOT isfinite(from_inclusive) OR NOT isfinite(to_exclusive)
    OR from_inclusive <> (date_trunc('month',from_inclusive AT TIME ZONE 'Europe/Berlin') AT TIME ZONE 'Europe/Berlin')
    OR to_exclusive <> ((date_trunc('month',from_inclusive AT TIME ZONE 'Europe/Berlin') + interval '1 month') AT TIME ZONE 'Europe/Berlin') THEN
    result_status := 'invalid_request'; RETURN NEXT; RETURN;
  END IF;

  RETURN QUERY
  WITH people AS MATERIALIZED (
    SELECT membership.id, membership.user_id, COALESCE(membership.display_name, CASE membership.role
      WHEN 'administrator' THEN 'Administrator' WHEN 'standortleitung' THEN 'Standortleitung'
      ELSE 'Mitarbeiter' END) AS display_name, membership.role, membership.revoked_at,
      home.location_id, location.display_name AS location_name,
      running.time_record_id IS NOT NULL AS is_running,
      running.effective_started_at AS running_since, running.display_name AS running_target
    FROM taptime_server.memberships AS membership
    LEFT JOIN LATERAL (SELECT membership.organization_id, taptime_server.membership_management_home_v1(org,membership.id) AS location_id) AS home ON locations_enabled
    LEFT JOIN taptime_server.locations AS location
      ON location.organization_id = home.organization_id AND location.id = home.location_id
    LEFT JOIN LATERAL (
      SELECT record.time_record_id, record.effective_started_at, target.display_name
      FROM taptime_server.effective_time_records_v2 AS record
      JOIN taptime_server.work_targets AS target ON target.organization_id = record.organization_id
        AND target.target_type = record.target_type AND target.target_id = record.target_id
      WHERE record.organization_id = membership.organization_id
        AND membership.revoked_at IS NULL AND record.user_id = membership.user_id AND record.status = 'started'
      ORDER BY record.effective_started_at, record.time_record_id LIMIT 1
    ) AS running ON true
    WHERE membership.organization_id = org AND (membership.revoked_at IS NULL OR taptime_server.departure_is_visible_v1(membership.revoked_at))
      AND (COALESCE(organization_scope, false) OR home.location_id = ANY(location_scope))
      AND (requested_location_id IS NULL OR home.location_id = requested_location_id)
  ), counts AS (
    SELECT count(*) FILTER (WHERE people.is_running AND people.revoked_at IS NULL) AS running_count, count(*) FILTER (WHERE people.revoked_at IS NULL) AS total_count FROM people
  ), sorted_people AS MATERIALIZED (
    SELECT people.*, people.revoked_at IS NOT NULL AS departed,
      people.location_id IS NULL AS without_location,
      COALESCE(people.location_name,'') COLLATE "C" AS location_sort,
      people.display_name COLLATE "C" AS name_sort
    FROM people
  ), anchor AS (
    -- A visible anchor keeps its boundary even when its running state changes.
    SELECT * FROM sorted_people WHERE sorted_people.id = after_membership_id
  ), page AS MATERIALIZED (
    SELECT * FROM sorted_people
    WHERE (sorted_people.revoked_at IS NOT NULL OR requested_is_running IS NULL OR sorted_people.is_running = requested_is_running)
      AND (after_membership_id IS NULL OR
        (sorted_people.departed,sorted_people.without_location,sorted_people.location_sort,sorted_people.name_sort,sorted_people.id) >
        (SELECT anchor.departed,anchor.without_location,anchor.location_sort,anchor.name_sort,anchor.id FROM anchor))
    ORDER BY sorted_people.departed,sorted_people.without_location,sorted_people.location_sort,sorted_people.name_sort,sorted_people.id
    LIMIT requested_limit + 1
  ), totals AS (
    -- One set-based aggregate for the page, using the same start-month assignment
    -- and duration as 036 and payroll v3. Cancellations are absent from the view.
    SELECT record.user_id, sum(duration.work_seconds)::bigint AS seconds
    FROM taptime_server.effective_time_records_v2 record
    JOIN page ON page.user_id=record.user_id
    CROSS JOIN LATERAL taptime_server.time_record_duration_v1(record.organization_id,
      record.canonical_time_entry_id,record.effective_started_at,record.effective_stopped_at) duration
    WHERE record.organization_id=org AND record.status='stopped' AND record.effective_stopped_at IS NOT NULL
      AND record.effective_started_at >= from_inclusive
      AND record.effective_started_at < to_exclusive
    GROUP BY record.user_id
  )
  SELECT CASE WHEN after_membership_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM anchor)
      THEN 'invalid_request' ELSE 'succeeded' END,
    transaction_timestamp(), counts.running_count, counts.total_count,
    page.id, page.display_name, page.role, page.location_id, page.location_name,
    page.is_running, page.running_since, page.running_target, page.revoked_at,COALESCE(totals.seconds,0::bigint)
  FROM counts LEFT JOIN page ON true LEFT JOIN totals ON totals.user_id=page.user_id
  ORDER BY page.departed,page.without_location,page.location_sort,page.name_sort,page.id;
END
$summary$;

ALTER FUNCTION taptime_server.read_managed_active_summary_v4(uuid,boolean,uuid,integer,timestamptz,timestamptz) OWNER TO taptime_membership_management_function_owner;
REVOKE ALL ON FUNCTION taptime_server.read_managed_active_summary_v4(uuid,boolean,uuid,integer,timestamptz,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.read_managed_active_summary_v4(uuid,boolean,uuid,integer,timestamptz,timestamptz) TO taptime_membership_manager;

CREATE OR REPLACE FUNCTION taptime_server.read_customer_hours_v1(from_inclusive timestamptz, to_exclusive timestamptz)
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
      -- Own historical hours survive deactivation even without a location binding.
      -- visible_records restricts employees to their own records; totals hides empty customers.
      OR (NOT customer.active AND (
        actor_role='employee'
        OR (actor_role='standortleitung' AND locations_enabled AND last_binding.location_id IS NOT NULL AND EXISTS (
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
        FROM (SELECT member.id,COALESCE(NULLIF(member.display_name,''),CASE member.role WHEN 'administrator' THEN 'Administrator' WHEN 'standortleitung' THEN 'Standortleitung' ELSE 'Mitarbeiter' END) AS display_name,
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

-- T-102: additive read projection; migrations create, replace and remove the function.
-- No stored aggregate, table or client-owned history. v1/v2 remain unchanged.
GRANT EXECUTE ON FUNCTION taptime_server.time_record_duration_v1(uuid,uuid,timestamptz,timestamptz)
  TO taptime_membership_management_function_owner;
GRANT SELECT (id,organization_id,time_entry_id,started_at,stopped_at) ON taptime_server.break_intervals
  TO taptime_membership_management_function_owner;

CREATE FUNCTION taptime_server.read_managed_active_summary_v3(
  requested_location_id uuid, requested_is_running boolean,
  after_membership_id uuid, requested_limit integer
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
  IF requested_limit IS NULL OR requested_limit NOT BETWEEN 1 AND 20 THEN
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
  ), month AS (
    SELECT date_trunc('month',transaction_timestamp() AT TIME ZONE 'Europe/Berlin') AS start_local
  ), totals AS (
    -- One set-based aggregate for the page, using the same start-month assignment
    -- and duration as 036 and payroll v3. Cancellations are absent from the view.
    SELECT record.user_id, sum(duration.work_seconds)::bigint AS seconds
    FROM taptime_server.effective_time_records_v2 record
    JOIN page ON page.user_id=record.user_id
    CROSS JOIN month
    CROSS JOIN LATERAL taptime_server.time_record_duration_v1(record.organization_id,
      record.canonical_time_entry_id,record.effective_started_at,record.effective_stopped_at) duration
    WHERE record.organization_id=org AND record.status='stopped' AND record.effective_stopped_at IS NOT NULL
      AND record.effective_started_at >= (month.start_local AT TIME ZONE 'Europe/Berlin')
      AND record.effective_started_at < ((month.start_local+interval '1 month') AT TIME ZONE 'Europe/Berlin')
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

ALTER FUNCTION taptime_server.read_managed_active_summary_v3(uuid,boolean,uuid,integer) OWNER TO taptime_membership_management_function_owner;
REVOKE ALL ON FUNCTION taptime_server.read_managed_active_summary_v3(uuid,boolean,uuid,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.read_managed_active_summary_v3(uuid,boolean,uuid,integer) TO taptime_membership_manager;

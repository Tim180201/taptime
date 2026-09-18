-- T-059 / D-062: read-only projections. Migrations own their creation, replacement and
-- eventual removal; no new stored data. Grants and home locations retain their existing lifecycle.
CREATE FUNCTION taptime_server.read_managed_person_time_v1(
  target_membership_id uuid,
  from_inclusive timestamptz,
  to_exclusive timestamptz,
  after_started_at timestamptz,
  after_time_record_id uuid,
  requested_limit integer
)
RETURNS TABLE (
  row_kind text, time_record_id uuid, source text, target_type text,
  target_display_name text, status text, started_at timestamptz, stopped_at timestamptz,
  started_via text, stopped_via text, window_started_at timestamptz, window_ended_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog
AS $person$
DECLARE
  org uuid := NULLIF(current_setting('app.organization_id', true), '')::uuid;
  actor_user uuid := NULLIF(current_setting('app.user_id', true), '')::uuid;
  actor uuid := NULLIF(current_setting('app.membership_id', true), '')::uuid;
  target_user uuid;
BEGIN
  IF current_setting('role', true) IS DISTINCT FROM 'taptime_membership_manager' THEN
    row_kind := 'forbidden'; RETURN NEXT; RETURN;
  END IF;
  -- One authority, always live, including the active row and every cursor page.
  SELECT membership.user_id INTO target_user
  FROM taptime_server.memberships AS membership
  WHERE membership.organization_id = org AND membership.id = target_membership_id
    AND EXISTS (
      SELECT 1 FROM taptime_server.has_membership_management_authority_v1(
        org, actor_user, actor, 'read', NULL, NULL, NULL
      ) AS scope
      WHERE (scope.scope_kind = 'organization' AND scope.location_id IS NULL)
        OR (scope.scope_kind = 'location' AND EXISTS (
          SELECT 1 FROM taptime_server.membership_home_location_assignments AS home
          WHERE home.organization_id = membership.organization_id
            AND home.membership_id = membership.id AND home.revoked_at IS NULL
            AND home.location_id = scope.location_id
        ))
    );
  IF NOT FOUND THEN
    row_kind := 'forbidden'; RETURN NEXT; RETURN;
  END IF;
  -- As in 025: bound the requested window and use an ascending (start, id) keyset.
  -- Carry-in intervals can start before that window, so their cursor may too.
  IF from_inclusive IS NULL OR to_exclusive IS NULL
    OR NOT isfinite(from_inclusive) OR NOT isfinite(to_exclusive)
    OR to_exclusive <= from_inclusive
    OR to_exclusive - from_inclusive > taptime_server.maximum_calendar_month_range()
    OR requested_limit IS NULL OR requested_limit NOT BETWEEN 1 AND 21
    OR (after_started_at IS NULL) <> (after_time_record_id IS NULL)
    OR (after_started_at IS NOT NULL AND
      (NOT isfinite(after_started_at) OR after_started_at >= to_exclusive))
  THEN row_kind := 'invalid_request'; RETURN NEXT; RETURN; END IF;

  row_kind := 'window'; window_started_at := from_inclusive; window_ended_at := to_exclusive;
  RETURN NEXT;
  RETURN QUERY
  SELECT 'active'::text, record.time_record_id, record.source, record.target_type,
    target.display_name, record.status, record.effective_started_at, record.effective_stopped_at,
    record.started_via, record.stopped_via, from_inclusive, to_exclusive
  FROM taptime_server.effective_time_records_v2 AS record
  JOIN taptime_server.work_targets AS target ON target.organization_id = record.organization_id
    AND target.target_type = record.target_type AND target.target_id = record.target_id
  WHERE record.organization_id = org AND record.user_id = target_user AND record.status = 'started'
  ORDER BY record.effective_started_at, record.time_record_id LIMIT 1;

  RETURN QUERY
  SELECT 'history'::text, record.time_record_id, record.source, record.target_type,
    target.display_name, record.status, record.effective_started_at, record.effective_stopped_at,
    record.started_via, record.stopped_via, from_inclusive, to_exclusive
  FROM taptime_server.effective_time_records_v2 AS record
  JOIN taptime_server.work_targets AS target ON target.organization_id = record.organization_id
    AND target.target_type = record.target_type AND target.target_id = record.target_id
  WHERE record.organization_id = org AND record.user_id = target_user AND record.status = 'stopped'
    AND record.effective_stopped_at > from_inclusive AND record.effective_started_at < to_exclusive
    AND (after_started_at IS NULL OR (record.effective_started_at, record.time_record_id)
      > (after_started_at, after_time_record_id))
  ORDER BY record.effective_started_at, record.time_record_id LIMIT requested_limit;
END
$person$;

CREATE FUNCTION taptime_server.read_managed_active_summary_v1(
  requested_location_id uuid, requested_is_running boolean,
  after_membership_id uuid, requested_limit integer
)
RETURNS TABLE (
  result_status text, server_time timestamptz, running_count bigint, total_count bigint,
  membership_id uuid, membership_display_name text, membership_role text,
  location_id uuid, location_name text, is_running boolean,
  running_since timestamptz, running_target_display_name text
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
    SELECT membership.id, COALESCE(membership.display_name, CASE membership.role
      WHEN 'administrator' THEN 'Administrator' WHEN 'standortleitung' THEN 'Standortleitung'
      ELSE 'Mitarbeiter' END) AS display_name, membership.role,
      home.location_id, location.display_name AS location_name,
      running.time_record_id IS NOT NULL AS is_running,
      running.effective_started_at AS running_since, running.display_name AS running_target
    FROM taptime_server.memberships AS membership
    LEFT JOIN taptime_server.membership_home_location_assignments AS home
      ON locations_enabled AND home.organization_id = membership.organization_id
      AND home.membership_id = membership.id AND home.revoked_at IS NULL
    LEFT JOIN taptime_server.locations AS location
      ON location.organization_id = home.organization_id AND location.id = home.location_id
    LEFT JOIN LATERAL (
      SELECT record.time_record_id, record.effective_started_at, target.display_name
      FROM taptime_server.effective_time_records_v2 AS record
      JOIN taptime_server.work_targets AS target ON target.organization_id = record.organization_id
        AND target.target_type = record.target_type AND target.target_id = record.target_id
      WHERE record.organization_id = membership.organization_id
        AND record.user_id = membership.user_id AND record.status = 'started'
      ORDER BY record.effective_started_at, record.time_record_id LIMIT 1
    ) AS running ON true
    WHERE membership.organization_id = org AND membership.revoked_at IS NULL
      AND (COALESCE(organization_scope, false) OR home.location_id = ANY(location_scope))
      AND (requested_location_id IS NULL OR home.location_id = requested_location_id)
  ), counts AS (
    SELECT count(*) FILTER (WHERE people.is_running) AS running_count, count(*) AS total_count FROM people
  ), page AS (
    SELECT * FROM people WHERE (requested_is_running IS NULL OR people.is_running = requested_is_running)
      AND (after_membership_id IS NULL OR people.id > after_membership_id)
    ORDER BY people.id LIMIT requested_limit + 1
  )
  SELECT 'succeeded'::text, transaction_timestamp(), counts.running_count, counts.total_count,
    page.id, page.display_name, page.role, page.location_id, page.location_name,
    page.is_running, page.running_since, page.running_target
  FROM counts LEFT JOIN page ON true ORDER BY page.id;
END
$summary$;

-- Existing non-login function owner; runtime gets EXECUTE only, no direct time-table reads.
GRANT SELECT ON taptime_server.effective_time_records_v2, taptime_server.work_targets
  TO taptime_membership_management_function_owner;
GRANT EXECUTE ON FUNCTION taptime_server.maximum_calendar_month_range()
  TO taptime_membership_management_function_owner;
ALTER FUNCTION taptime_server.read_managed_person_time_v1(uuid,timestamptz,timestamptz,timestamptz,uuid,integer)
  OWNER TO taptime_membership_management_function_owner;
ALTER FUNCTION taptime_server.read_managed_active_summary_v1(uuid,boolean,uuid,integer)
  OWNER TO taptime_membership_management_function_owner;
REVOKE ALL ON FUNCTION taptime_server.read_managed_person_time_v1(uuid,timestamptz,timestamptz,timestamptz,uuid,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION taptime_server.read_managed_active_summary_v1(uuid,boolean,uuid,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.read_managed_person_time_v1(uuid,timestamptz,timestamptz,timestamptz,uuid,integer)
  TO taptime_membership_manager;
GRANT EXECUTE ON FUNCTION taptime_server.read_managed_active_summary_v1(uuid,boolean,uuid,integer)
  TO taptime_membership_manager;

-- T-127a / D-143: additive read projections, no new stored data or write authority.
-- Migrations create, replace and eventually remove these functions. Existing revocation
-- and deactivation commands supply the archive; retention/deletion remains B15.
-- SQL reads at most limit+1 (51); the API trims the wire envelope to 14 KiB (T-117a).
GRANT SELECT ON taptime_server.work_target_location_assignments, taptime_server.customers,
  taptime_server.projects, taptime_server.time_record_origins, taptime_server.time_record_comments,
  taptime_server.time_record_revisions TO taptime_membership_management_function_owner;
GRANT EXECUTE ON FUNCTION taptime_server.has_time_management_authority_v1(uuid,uuid,uuid,uuid)
  TO taptime_membership_management_function_owner;

CREATE FUNCTION taptime_server.read_archive_people_v1(
  requested_location_id uuid, requested_membership_id uuid, requested_search text,
  after_display_name text, after_id uuid, requested_limit integer
)
RETURNS TABLE(result_status text, membership_id uuid, display_name text, membership_role text,
  location_id uuid, location_name text, revoked_at timestamptz, last_started_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog
AS $people$
DECLARE
  org uuid := nullif(current_setting('app.organization_id',true),'')::uuid;
  actor_user uuid := nullif(current_setting('app.user_id',true),'')::uuid;
  actor uuid := nullif(current_setting('app.membership_id',true),'')::uuid;
  organization_scope boolean;
  location_scope uuid[];
BEGIN
  IF current_setting('role',true) IS DISTINCT FROM 'taptime_membership_manager' THEN
    result_status := 'forbidden'; RETURN NEXT; RETURN;
  END IF;
  SELECT coalesce(bool_or(s.scope_kind='organization'),false),
    coalesce(array_agg(s.location_id) FILTER (WHERE s.scope_kind='location'),ARRAY[]::uuid[])
    INTO organization_scope, location_scope
  FROM taptime_server.has_membership_management_authority_v1(org,actor_user,actor,'read',NULL,NULL,NULL) s;
  IF NOT organization_scope AND cardinality(location_scope)=0 THEN
    result_status := 'forbidden'; RETURN NEXT; RETURN;
  END IF;
  IF requested_location_id IS NOT NULL AND NOT (
    (organization_scope OR requested_location_id=ANY(location_scope))
    AND EXISTS (SELECT 1 FROM taptime_server.locations l WHERE l.organization_id=org AND l.id=requested_location_id)
  ) THEN result_status := 'forbidden'; RETURN NEXT; RETURN; END IF;
  IF requested_limit IS NULL OR requested_limit NOT BETWEEN 1 AND 51
    OR (after_display_name IS NULL) <> (after_id IS NULL)
    OR (requested_search IS NOT NULL AND length(requested_search) NOT BETWEEN 1 AND 80)
  THEN result_status := 'invalid_request'; RETURN NEXT; RETURN; END IF;
  RETURN QUERY
  WITH page AS MATERIALIZED (
    SELECT m.id,m.user_id,m.display_name,m.role,home.id AS location_id,l.display_name AS location_name,m.revoked_at
    FROM taptime_server.memberships m
    CROSS JOIN LATERAL (SELECT taptime_server.membership_management_home_v1(org,m.id) AS id) home
    LEFT JOIN taptime_server.locations l ON l.organization_id=org AND l.id=home.id
    WHERE m.organization_id=org AND m.revoked_at IS NOT NULL
      AND (organization_scope OR home.id=ANY(location_scope))
      AND (requested_location_id IS NULL OR home.id=requested_location_id)
      AND (requested_membership_id IS NULL OR m.id=requested_membership_id)
      AND (requested_search IS NULL OR strpos(lower(m.display_name COLLATE "und-x-icu"),lower(requested_search COLLATE "und-x-icu"))>0)
      AND (after_id IS NULL OR (coalesce(m.display_name,'') COLLATE "und-x-icu",m.id)>(after_display_name COLLATE "und-x-icu",after_id))
    ORDER BY coalesce(m.display_name,'') COLLATE "und-x-icu",m.id LIMIT requested_limit
  )
  SELECT 'succeeded'::text,page.id,page.display_name,page.role,page.location_id,page.location_name,page.revoked_at,
    (SELECT max(r.effective_started_at) FROM taptime_server.effective_time_records_v2 r
      WHERE r.organization_id=org AND r.user_id=page.user_id)
  FROM (SELECT 1) head LEFT JOIN page ON true
  ORDER BY coalesce(page.display_name,'') COLLATE "und-x-icu",page.id;
END
$people$;

CREATE FUNCTION taptime_server.read_archive_targets_v1(
  requested_location_id uuid, requested_search text, after_display_name text, after_id uuid,
  after_target_type text, requested_limit integer
)
RETURNS TABLE(result_status text, target_type text, target_id uuid, display_name text,
  location_id uuid, location_name text, deactivated_at timestamptz, last_started_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog
AS $targets$
DECLARE
  org uuid := nullif(current_setting('app.organization_id',true),'')::uuid;
  actor_user uuid := nullif(current_setting('app.user_id',true),'')::uuid;
  actor uuid := nullif(current_setting('app.membership_id',true),'')::uuid;
  organization_scope boolean;
  location_scope uuid[];
BEGIN
  IF current_setting('role',true) IS DISTINCT FROM 'taptime_membership_manager' THEN
    result_status := 'forbidden'; RETURN NEXT; RETURN;
  END IF;
  SELECT coalesce(bool_or(s.scope_kind='organization'),false),
    coalesce(array_agg(s.location_id) FILTER (WHERE s.scope_kind='location'),ARRAY[]::uuid[])
    INTO organization_scope, location_scope
  FROM taptime_server.has_membership_management_authority_v1(org,actor_user,actor,'read',NULL,NULL,NULL) s;
  IF NOT organization_scope AND cardinality(location_scope)=0 THEN
    result_status := 'forbidden'; RETURN NEXT; RETURN;
  END IF;
  IF requested_location_id IS NOT NULL AND NOT (
    (organization_scope OR requested_location_id=ANY(location_scope))
    AND EXISTS (SELECT 1 FROM taptime_server.locations l WHERE l.organization_id=org AND l.id=requested_location_id)
  ) THEN result_status := 'forbidden'; RETURN NEXT; RETURN; END IF;
  IF requested_limit IS NULL OR requested_limit NOT BETWEEN 1 AND 51
    OR (after_display_name IS NULL) <> (after_id IS NULL)
    OR (requested_search IS NOT NULL AND length(requested_search) NOT BETWEEN 1 AND 80)
  THEN result_status := 'invalid_request'; RETURN NEXT; RETURN; END IF;
  IF (after_id IS NULL) <> (after_target_type IS NULL)
    OR (after_target_type IS NOT NULL AND after_target_type NOT IN ('customer','project'))
  THEN result_status := 'invalid_request'; RETURN NEXT; RETURN; END IF;
  RETURN QUERY
  WITH targets AS (
    SELECT 'customer'::text AS kind,c.id,c.display_name,c.deactivated_at
    FROM taptime_server.customers c WHERE c.organization_id=org AND NOT c.active
    UNION ALL
    SELECT 'project'::text,p.id,p.display_name,p.deactivated_at
    FROM taptime_server.projects p WHERE p.organization_id=org AND NOT p.active
  ), page AS MATERIALIZED (
    SELECT t.*,last_binding.location_id,l.display_name AS location_name
    FROM targets t
    LEFT JOIN LATERAL (
      SELECT b.location_id FROM taptime_server.work_target_location_assignments b
      WHERE b.organization_id=org AND b.target_type=t.kind AND b.target_id=t.id
      ORDER BY b.assigned_at DESC,b.id DESC LIMIT 1
    ) last_binding ON true
    LEFT JOIN taptime_server.locations l ON l.organization_id=org AND l.id=last_binding.location_id
    WHERE (organization_scope OR last_binding.location_id=ANY(location_scope))
      AND (requested_location_id IS NULL OR last_binding.location_id=requested_location_id)
      AND (requested_search IS NULL OR strpos(lower(t.display_name COLLATE "und-x-icu"),lower(requested_search COLLATE "und-x-icu"))>0)
      AND (after_id IS NULL OR (t.display_name COLLATE "und-x-icu",t.id,t.kind COLLATE "C")>(after_display_name COLLATE "und-x-icu",after_id,after_target_type COLLATE "C"))
    ORDER BY t.display_name COLLATE "und-x-icu",t.id,t.kind COLLATE "C" LIMIT requested_limit
  )
  SELECT 'succeeded'::text,page.kind,page.id,page.display_name,page.location_id,page.location_name,page.deactivated_at,
    (SELECT max(r.effective_started_at) FROM taptime_server.effective_time_records_v2 r
      WHERE r.organization_id=org AND r.target_type=page.kind AND r.target_id=page.id)
  FROM (SELECT 1) head LEFT JOIN page ON true
  ORDER BY page.display_name COLLATE "und-x-icu",page.id,page.kind COLLATE "C";
END
$targets$;

CREATE FUNCTION taptime_server.read_managed_active_summary_v6(requested_location_id uuid, requested_is_running boolean, after_display_name text, after_membership_id uuid, requested_limit integer, from_inclusive timestamp with time zone, to_exclusive timestamp with time zone, requested_search text)
 RETURNS TABLE(result_status text, server_time timestamp with time zone, running_count bigint, total_count bigint, membership_id uuid, membership_display_name text, membership_role text, location_id uuid, location_name text, is_running boolean, running_since timestamp with time zone, running_target_display_name text, departed_at timestamp with time zone, month_work_duration_seconds bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
<<reader>>
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
  IF requested_limit IS NULL OR requested_limit NOT BETWEEN 1 AND 51
    OR (after_membership_id IS NULL) <> (after_display_name IS NULL)
    OR from_inclusive IS NULL OR to_exclusive IS NULL
    OR NOT isfinite(from_inclusive) OR NOT isfinite(to_exclusive)
    OR from_inclusive <> (date_trunc('month',from_inclusive AT TIME ZONE 'Europe/Berlin') AT TIME ZONE 'Europe/Berlin')
    OR to_exclusive <> ((date_trunc('month',from_inclusive AT TIME ZONE 'Europe/Berlin') + interval '1 month') AT TIME ZONE 'Europe/Berlin') THEN
    result_status := 'invalid_request'; RETURN NEXT; RETURN;
  END IF;

  IF requested_search IS NOT NULL THEN
    -- The TS boundary canonicalizes NFC/Unicode trim with normalizeTapTimeNameV1.
    -- Keep the predecessor's capabilities; no additional helper grants are needed.
    IF length(requested_search) NOT BETWEEN 1 AND 80 THEN result_status := 'invalid_request'; RETURN NEXT; RETURN; END IF;
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
    WHERE membership.organization_id = org AND (membership.revoked_at IS NULL OR (
        requested_is_running IS DISTINCT FROM true AND EXISTS (
          -- Match the start-month assignment of the monthly totals, including zero-second work.
          SELECT 1 FROM taptime_server.effective_time_records_v2 monthly
          WHERE monthly.organization_id=org AND monthly.user_id=membership.user_id
            AND monthly.status='stopped' AND monthly.effective_stopped_at IS NOT NULL
            AND monthly.effective_started_at>=from_inclusive AND monthly.effective_started_at<to_exclusive
        )))
      AND (COALESCE(organization_scope, false) OR home.location_id = ANY(location_scope))
      AND (requested_location_id IS NULL OR home.location_id = requested_location_id)
  ), counts AS (
    SELECT count(*) FILTER (WHERE people.is_running AND people.revoked_at IS NULL) AS running_count, count(*) FILTER (WHERE people.revoked_at IS NULL) AS total_count FROM people
  ), page AS MATERIALIZED (
    SELECT * FROM people
    WHERE (requested_is_running IS NULL OR people.is_running = requested_is_running)
      AND (requested_search IS NULL OR strpos(lower(people.display_name COLLATE "und-x-icu"),lower(requested_search COLLATE "und-x-icu"))>0)
      AND (after_membership_id IS NULL OR (people.display_name COLLATE "und-x-icu",people.id)>(after_display_name COLLATE "und-x-icu",after_membership_id))
    ORDER BY people.display_name COLLATE "und-x-icu",people.id LIMIT requested_limit
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
  SELECT 'succeeded'::text,
    transaction_timestamp(), counts.running_count, counts.total_count,
    page.id, page.display_name, page.role, page.location_id, page.location_name,
    page.is_running, page.running_since, page.running_target, page.revoked_at,COALESCE(totals.seconds,0::bigint)
  FROM counts LEFT JOIN page ON true LEFT JOIN totals ON totals.user_id=page.user_id
  ORDER BY page.display_name COLLATE "und-x-icu",page.id;
END
$function$;
ALTER FUNCTION taptime_server.read_managed_active_summary_v6(uuid,boolean,text,uuid,integer,timestamptz,timestamptz,text) OWNER TO taptime_membership_management_function_owner;
REVOKE ALL ON FUNCTION taptime_server.read_managed_active_summary_v6(uuid,boolean,text,uuid,integer,timestamptz,timestamptz,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.read_managed_active_summary_v6(uuid,boolean,text,uuid,integer,timestamptz,timestamptz,text) TO taptime_membership_manager;


CREATE FUNCTION taptime_server.read_managed_person_time_v2(
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
  started_via text, stopped_via text, window_started_at timestamptz, window_ended_at timestamptz,
  can_manage_time boolean, details jsonb, calendar jsonb
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
            AND home.membership_id = membership.id
            AND home.location_id=taptime_server.membership_management_home_v1(org,membership.id)
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

  -- The read scope has no departure deadline; writes keep their existing authority.
  can_manage_time := EXISTS (SELECT 1 FROM taptime_server.has_time_management_authority_v1(
    org, actor_user, actor, target_user));
  row_kind := 'window'; window_started_at := from_inclusive; window_ended_at := to_exclusive;
  RETURN NEXT;
  -- Keep the existing details and calendar semantics in this authorized snapshot.
  -- Calling their v1 readers would reapply D-115 and hide an older former person's rows.
  RETURN QUERY
  WITH active AS MATERIALIZED (
    SELECT record.time_record_id AS id FROM taptime_server.effective_time_records_v2 record
    WHERE record.organization_id=org AND record.user_id=target_user AND record.status='started'
    ORDER BY record.effective_started_at,record.time_record_id LIMIT 1
  ), history AS MATERIALIZED (
    SELECT record.time_record_id AS id FROM taptime_server.effective_time_records_v2 record
    WHERE record.organization_id=org AND record.user_id=target_user AND record.status='stopped'
      AND record.effective_stopped_at>from_inclusive AND record.effective_started_at<to_exclusive
      AND (after_started_at IS NULL OR (record.effective_started_at,record.time_record_id)>(after_started_at,after_time_record_id))
    ORDER BY record.effective_started_at,record.time_record_id LIMIT requested_limit
  ), page AS MATERIALIZED (
    SELECT 'active'::text AS kind,active.id FROM active
    UNION ALL SELECT 'history'::text,history.id FROM history
  )
  SELECT page.kind,r.time_record_id,r.source,r.target_type,target.display_name,r.status,
    r.effective_started_at,r.effective_stopped_at,r.started_via,r.stopped_via,from_inclusive,to_exclusive,
    can_manage_time,jsonb_build_object(
    'origin',CASE WHEN o.origin='backfilled' THEN 'backfilled' WHEN r.source='recovered' THEN 'recovered'
      WHEN r.started_via='manual' OR r.stopped_via='manual' THEN 'manual' ELSE 'nfc' END,
    'baseRowVersion',r.base_row_version,'effectiveRevisionNumber',r.effective_revision_number,
    'comment',c.comment,
    'changed',stopped.time_entry_id IS NOT NULL OR r.effective_revision_number > CASE WHEN r.source='recovered' THEN 1 ELSE 0 END,
    'change',CASE WHEN rev.time_record_id IS NULL THEN NULL ELSE jsonb_build_object(
      'at',to_char(rev.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'reason',rev.reason,'actor',CASE WHEN rev.actor_user_id=r.user_id THEN 'self' ELSE 'administration' END) END,
    'overlapsAnotherRecord',EXISTS(
      -- Unrevised canonical entries can use their indexed original start directly.
      SELECT 1 FROM taptime_server.time_entries other
      WHERE other.organization_id=r.organization_id AND other.user_id=r.user_id AND other.id<>r.time_record_id
        AND other.started_at < coalesce(r.effective_stopped_at,'infinity'::timestamptz)
        AND (other.status='started' OR other.stopped_at>r.effective_started_at)
        AND NOT EXISTS (SELECT 1 FROM taptime_server.time_record_revisions revised
          WHERE revised.organization_id=other.organization_id AND revised.time_record_id=other.id)
      UNION ALL
      -- A revision in the interval counts only if no newer revision exists, even outside it.
      SELECT 1 FROM taptime_server.time_record_revisions other
      LEFT JOIN taptime_server.time_entries canonical
        ON canonical.organization_id=other.organization_id AND canonical.id=other.canonical_time_entry_id
      WHERE other.organization_id=r.organization_id AND other.user_id=r.user_id AND other.time_record_id<>r.time_record_id
        AND other.effective_started_at < coalesce(r.effective_stopped_at,'infinity'::timestamptz)
        AND (canonical.status='started' OR other.effective_stopped_at>r.effective_started_at)
        AND NOT EXISTS (SELECT 1 FROM taptime_server.time_record_revisions newer
          WHERE newer.organization_id=other.organization_id AND newer.time_record_id=other.time_record_id
            AND newer.revision_number>other.revision_number)))
    || CASE WHEN stopped.time_entry_id IS NULL THEN '{}'::jsonb ELSE jsonb_build_object(
      'administrationStop',jsonb_build_object('at',to_char(stopped.action_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'reason',stopped.reason)) END,
    jsonb_build_object('asOf',to_char(transaction_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'workDurationSeconds',duration.work_seconds,'breakDurationSeconds',duration.break_seconds,'breakIntervals',duration.break_intervals)
  FROM page JOIN taptime_server.effective_time_records_v2 r ON r.organization_id=org AND r.time_record_id=page.id
  JOIN taptime_server.work_targets target ON target.organization_id=r.organization_id
    AND target.target_type=r.target_type AND target.target_id=r.target_id
  CROSS JOIN LATERAL taptime_server.time_record_duration_v1(r.organization_id,
    r.canonical_time_entry_id,r.effective_started_at,r.effective_stopped_at) duration
  LEFT JOIN taptime_server.administration_stop_commands stopped ON stopped.organization_id=r.organization_id AND stopped.time_entry_id=r.time_record_id
  LEFT JOIN taptime_server.time_record_origins o ON o.organization_id=r.organization_id AND o.time_record_id=r.time_record_id
  LEFT JOIN taptime_server.time_record_revisions rev ON rev.organization_id=r.organization_id AND rev.time_record_id=r.time_record_id AND rev.revision_number=r.effective_revision_number
  LEFT JOIN LATERAL (SELECT c.comment FROM taptime_server.time_record_comments c WHERE c.organization_id=r.organization_id AND c.time_record_id=r.time_record_id ORDER BY c.comment_number DESC LIMIT 1) c ON true
  ORDER BY page.kind COLLATE "C",r.effective_started_at,r.time_record_id;
END
$person$;

CREATE FUNCTION taptime_server.read_archive_status_v1(
  requested_membership_ids uuid[], requested_customer_ids uuid[], requested_project_ids uuid[]
)
RETURNS TABLE(result_status text, entity_type text, entity_id uuid, archived boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog
AS $status$
DECLARE
  org uuid := nullif(current_setting('app.organization_id',true),'')::uuid;
  actor_user uuid := nullif(current_setting('app.user_id',true),'')::uuid;
  actor uuid := nullif(current_setting('app.membership_id',true),'')::uuid;
  organization_scope boolean;
  location_scope uuid[];
BEGIN
  IF current_setting('role',true) IS DISTINCT FROM 'taptime_membership_manager' THEN
    result_status := 'forbidden'; RETURN NEXT; RETURN;
  END IF;
  SELECT coalesce(bool_or(s.scope_kind='organization'),false),
    coalesce(array_agg(s.location_id) FILTER (WHERE s.scope_kind='location'),ARRAY[]::uuid[])
    INTO organization_scope, location_scope
  FROM taptime_server.has_membership_management_authority_v1(org,actor_user,actor,'read',NULL,NULL,NULL) s;
  IF NOT organization_scope AND cardinality(location_scope)=0 THEN
    result_status := 'forbidden'; RETURN NEXT; RETURN;
  END IF;
  IF requested_membership_ids IS NULL OR requested_customer_ids IS NULL OR requested_project_ids IS NULL
    OR cardinality(requested_membership_ids)+cardinality(requested_customer_ids)+cardinality(requested_project_ids)>200
    OR array_position(requested_membership_ids,NULL) IS NOT NULL
    OR array_position(requested_customer_ids,NULL) IS NOT NULL OR array_position(requested_project_ids,NULL) IS NOT NULL
  THEN result_status := 'invalid_request'; RETURN NEXT; RETURN; END IF;
  RETURN QUERY
  WITH visible AS (
    SELECT 'person'::text AS kind,m.id,m.revoked_at IS NOT NULL AS archived
    FROM taptime_server.memberships m
    WHERE m.organization_id=org AND m.id=ANY(requested_membership_ids)
      AND (organization_scope OR taptime_server.membership_management_home_v1(org,m.id)=ANY(location_scope)
        OR EXISTS (
          -- Customer detail discloses contributors even when their home is elsewhere.
          -- This authorizes only their status, never their archive/person-time page.
          SELECT 1 FROM taptime_server.effective_time_records_v2 r
          JOIN taptime_server.customers customer ON customer.organization_id=org AND customer.id=r.target_id
          JOIN LATERAL (
            SELECT b.location_id FROM taptime_server.work_target_location_assignments b
            WHERE b.organization_id=org AND b.target_type='customer' AND b.target_id=customer.id
              AND (NOT customer.active OR b.revoked_at IS NULL)
            ORDER BY b.assigned_at DESC,b.id DESC LIMIT 1
          ) binding ON binding.location_id=ANY(location_scope)
          WHERE r.organization_id=org AND r.user_id=m.user_id AND r.target_type='customer'
        ))
    UNION ALL
    SELECT t.target_type,t.target_id,NOT t.active
    FROM taptime_server.work_targets t
    LEFT JOIN LATERAL (
      -- Active targets use their current binding; archived ones the latest binding.
      SELECT b.location_id FROM taptime_server.work_target_location_assignments b
      WHERE b.organization_id=org AND b.target_type=t.target_type AND b.target_id=t.target_id
        AND (NOT t.active OR b.revoked_at IS NULL)
      ORDER BY b.assigned_at DESC,b.id DESC LIMIT 1
    ) binding ON true
    WHERE t.organization_id=org
      AND ((t.target_type='customer' AND t.target_id=ANY(requested_customer_ids))
        OR (t.target_type='project' AND t.target_id=ANY(requested_project_ids)))
      AND (organization_scope OR binding.location_id=ANY(location_scope) OR EXISTS (
        -- Reviewable time rows expose their targets independently of today's target binding.
        SELECT 1 FROM taptime_server.effective_time_records_v2 r
        WHERE r.organization_id=org AND r.target_type=t.target_type AND r.target_id=t.target_id
          AND EXISTS (SELECT 1 FROM taptime_server.has_time_management_authority_v1(org,actor_user,actor,r.user_id))
      ))
  )
  SELECT 'succeeded'::text,v.kind,v.id,v.archived
  FROM (SELECT 1) head LEFT JOIN visible v ON true ORDER BY v.kind COLLATE "C",v.id;
END
$status$;

ALTER FUNCTION taptime_server.read_archive_people_v1(uuid,uuid,text,text,uuid,integer) OWNER TO taptime_membership_management_function_owner;
REVOKE ALL ON FUNCTION taptime_server.read_archive_people_v1(uuid,uuid,text,text,uuid,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.read_archive_people_v1(uuid,uuid,text,text,uuid,integer) TO taptime_membership_manager;
ALTER FUNCTION taptime_server.read_archive_targets_v1(uuid,text,text,uuid,text,integer) OWNER TO taptime_membership_management_function_owner;
REVOKE ALL ON FUNCTION taptime_server.read_archive_targets_v1(uuid,text,text,uuid,text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.read_archive_targets_v1(uuid,text,text,uuid,text,integer) TO taptime_membership_manager;
ALTER FUNCTION taptime_server.read_managed_person_time_v2(uuid,timestamptz,timestamptz,timestamptz,uuid,integer) OWNER TO taptime_membership_management_function_owner;
REVOKE ALL ON FUNCTION taptime_server.read_managed_person_time_v2(uuid,timestamptz,timestamptz,timestamptz,uuid,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.read_managed_person_time_v2(uuid,timestamptz,timestamptz,timestamptz,uuid,integer) TO taptime_membership_manager;
ALTER FUNCTION taptime_server.read_archive_status_v1(uuid[],uuid[],uuid[]) OWNER TO taptime_membership_management_function_owner;
REVOKE ALL ON FUNCTION taptime_server.read_archive_status_v1(uuid[],uuid[],uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.read_archive_status_v1(uuid[],uuid[],uuid[]) TO taptime_membership_manager;

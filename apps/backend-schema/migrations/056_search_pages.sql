-- T-117a. Read-only search and name keysets. G1 byte pruning is in TypeScript.
-- Functions are created/changed/removed only by migrations. No stored data, roles,
-- policies or old functions change. Each scope below is copied from its predecessor.
-- SQL fetches limit+1 (up to 51); the public limit remains at most 50.


CREATE FUNCTION taptime_server.read_customer_hours_v3(from_inclusive timestamptz,to_exclusive timestamptz,requested_search text,after_display_name text,after_id uuid,requested_limit integer)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog
AS $function$
<<reader>>
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

  IF requested_limit IS NULL OR requested_limit NOT BETWEEN 1 AND 51
    OR (after_display_name IS NULL) <> (after_id IS NULL)
  THEN RAISE EXCEPTION 'Invalid search page' USING ERRCODE='22023'; END IF;
  IF requested_search IS NOT NULL THEN
    -- The TS boundary canonicalizes NFC/Unicode trim with normalizeTapTimeNameV1.
    -- Keep the predecessor's capabilities; no additional helper grants are needed.
    IF length(requested_search) NOT BETWEEN 1 AND 80 THEN RAISE EXCEPTION 'Invalid search' USING ERRCODE='22023'; END IF;
  END IF;

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
  SELECT COALESCE(jsonb_agg(item.value ORDER BY item.display_name COLLATE "und-x-icu",item.id),'[]'::jsonb) INTO result
  FROM (
    SELECT customer.id,customer.display_name,
      jsonb_build_object('customerId',customer.id,'displayName',customer.display_name,'active',customer.active,
        'workDurationSeconds',totals.seconds,'running',totals.running)
      || CASE WHEN actor_role='employee' THEN '{}'::jsonb ELSE jsonb_build_object(
        'quotaSeconds',quota.minutes*60,
        'quotaStage',CASE WHEN quota.minutes IS NULL THEN 'none'
          WHEN totals.seconds>=quota.minutes*60 THEN 'exceeded'
          WHEN totals.seconds*10>=quota.minutes::bigint*60*9 THEN 'warning' ELSE 'ok' END) END AS value
    FROM visible_customers customer
    CROSS JOIN LATERAL (SELECT COALESCE(sum(record.work_seconds),0)::bigint AS seconds,
      COALESCE(bool_or(record.effective_stopped_at IS NULL),false) AS running
      FROM visible_records record WHERE record.target_id=customer.id) totals
    LEFT JOIN LATERAL (
      SELECT setting.minutes FROM taptime_server.customer_quota_settings setting
      WHERE reader.actor_role<>'employee' AND setting.organization_id=org
        AND setting.customer_id=customer.id AND setting.set_at<to_exclusive
      ORDER BY setting.set_at DESC,setting.sequence DESC LIMIT 1
    ) quota ON true
    WHERE (customer.active OR totals.seconds>0 OR totals.running)
      AND (requested_search IS NULL OR strpos(lower(customer.display_name COLLATE "und-x-icu"),lower(requested_search COLLATE "und-x-icu"))>0)
      AND (after_id IS NULL OR (customer.display_name COLLATE "und-x-icu",customer.id)>(after_display_name COLLATE "und-x-icu",after_id))
    ORDER BY customer.display_name COLLATE "und-x-icu",customer.id LIMIT requested_limit
  ) item;
  RETURN jsonb_build_object('version','customer-hours.v3','scope',CASE WHEN actor_role='employee' THEN 'self' ELSE 'people' END,
    'asOf',to_char(transaction_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'customers',result);
END
$function$;

ALTER FUNCTION taptime_server.read_customer_hours_v3(timestamptz,timestamptz,text,text,uuid,integer) OWNER TO taptime_time_review_read_function_owner;
REVOKE ALL ON FUNCTION taptime_server.read_customer_hours_v3(timestamptz,timestamptz,text,text,uuid,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.read_customer_hours_v3(timestamptz,timestamptz,text,text,uuid,integer) TO taptime_mobile_own_time_reader;


CREATE FUNCTION taptime_server.read_customer_hours_detail_v1(from_inclusive timestamptz,to_exclusive timestamptz,requested_customer_id uuid,after_display_name text,after_id uuid,requested_limit integer)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog
AS $function$
<<reader>>
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

  IF requested_limit IS NULL OR requested_limit NOT BETWEEN 1 AND 51
    OR (after_display_name IS NULL) <> (after_id IS NULL)
  THEN RAISE EXCEPTION 'Invalid search page' USING ERRCODE='22023'; END IF;

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
    WHERE customer.id=requested_customer_id AND customer.organization_id=org AND (
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
  SELECT item.value INTO result FROM (
    SELECT
      jsonb_build_object('customerId',customer.id,'displayName',customer.display_name,'active',customer.active,
        'workDurationSeconds',totals.seconds,'running',totals.running)
      || CASE WHEN actor_role='employee' THEN '{}'::jsonb ELSE jsonb_build_object(
        'quotaSeconds',quota.minutes*60,
        'quotaStage',CASE WHEN quota.minutes IS NULL THEN 'none'
          WHEN totals.seconds>=quota.minutes*60 THEN 'exceeded'
          WHEN totals.seconds*10>=quota.minutes::bigint*60*9 THEN 'warning' ELSE 'ok' END) END
      || CASE WHEN actor_role='employee' THEN jsonb_build_object('days',(
        SELECT COALESCE(jsonb_agg(jsonb_build_object('date',day.date,'workDurationSeconds',day.seconds,'running',day.running) ORDER BY day.date),'[]'::jsonb)
        FROM (SELECT (record.effective_started_at AT TIME ZONE 'Europe/Berlin')::date AS date,
          sum(record.work_seconds)::bigint AS seconds,bool_or(record.effective_stopped_at IS NULL) AS running
          FROM visible_records record WHERE record.target_id=customer.id GROUP BY 1) day
      )) ELSE jsonb_build_object('people',(
        SELECT COALESCE(jsonb_agg(jsonb_build_object('membershipId',person.id,'displayName',person.display_name,
          'workDurationSeconds',person.seconds,'running',person.running) ORDER BY person.display_name COLLATE "und-x-icu",person.id),'[]'::jsonb)
        FROM (SELECT * FROM (SELECT member.id,COALESCE(NULLIF(member.display_name,''),CASE member.role WHEN 'administrator' THEN 'Administrator' WHEN 'standortleitung' THEN 'Standortleitung' ELSE 'Mitarbeiter' END) AS display_name,
          sum(record.work_seconds)::bigint AS seconds,bool_or(record.effective_stopped_at IS NULL) AS running
          FROM visible_records record JOIN taptime_server.memberships member ON member.organization_id=org AND member.user_id=record.user_id
          WHERE record.target_id=customer.id GROUP BY member.id,member.display_name) all_people
          WHERE after_id IS NULL OR (all_people.display_name COLLATE "und-x-icu",all_people.id)>(after_display_name COLLATE "und-x-icu",after_id)
          ORDER BY all_people.display_name COLLATE "und-x-icu",all_people.id LIMIT requested_limit) person
      )) END AS value
    FROM visible_customers customer
    CROSS JOIN LATERAL (SELECT COALESCE(sum(record.work_seconds),0)::bigint AS seconds,
      COALESCE(bool_or(record.effective_stopped_at IS NULL),false) AS running
      FROM visible_records record WHERE record.target_id=customer.id) totals
    LEFT JOIN LATERAL (
      SELECT setting.minutes FROM taptime_server.customer_quota_settings setting
      WHERE reader.actor_role<>'employee' AND setting.organization_id=org
        AND setting.customer_id=customer.id AND setting.set_at<to_exclusive
      ORDER BY setting.set_at DESC,setting.sequence DESC LIMIT 1
    ) quota ON true
    WHERE customer.active OR totals.seconds>0 OR totals.running
  ) item;
  IF result IS NULL THEN RETURN jsonb_build_object('status','not_found'); END IF;
  IF actor_role='employee' AND after_id IS NOT NULL THEN
    RAISE EXCEPTION 'Invalid detail page' USING ERRCODE='22023';
  END IF;
  RETURN jsonb_build_object('version','customer-hours.detail.v1','scope',CASE WHEN actor_role='employee' THEN 'self' ELSE 'people' END,
    'asOf',to_char(transaction_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'customer',result-'people'-'days') || CASE WHEN actor_role='employee'
      THEN jsonb_build_object('days',result->'days') ELSE jsonb_build_object('people',result->'people') END;
END
$function$;

ALTER FUNCTION taptime_server.read_customer_hours_detail_v1(timestamptz,timestamptz,uuid,text,uuid,integer) OWNER TO taptime_time_review_read_function_owner;
REVOKE ALL ON FUNCTION taptime_server.read_customer_hours_detail_v1(timestamptz,timestamptz,uuid,text,uuid,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.read_customer_hours_detail_v1(timestamptz,timestamptz,uuid,text,uuid,integer) TO taptime_mobile_own_time_reader;


CREATE FUNCTION taptime_server.read_managed_active_summary_v5(requested_location_id uuid, requested_is_running boolean, after_display_name text, after_membership_id uuid, requested_limit integer, from_inclusive timestamp with time zone, to_exclusive timestamp with time zone, requested_search text)
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
    WHERE membership.organization_id = org AND (membership.revoked_at IS NULL OR taptime_server.departure_is_visible_v1(membership.revoked_at))
      AND (COALESCE(organization_scope, false) OR home.location_id = ANY(location_scope))
      AND (requested_location_id IS NULL OR home.location_id = requested_location_id)
  ), counts AS (
    SELECT count(*) FILTER (WHERE people.is_running AND people.revoked_at IS NULL) AS running_count, count(*) FILTER (WHERE people.revoked_at IS NULL) AS total_count FROM people
  ), page AS MATERIALIZED (
    SELECT * FROM people
    WHERE (people.revoked_at IS NOT NULL OR requested_is_running IS NULL OR people.is_running = requested_is_running)
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
ALTER FUNCTION taptime_server.read_managed_active_summary_v5(uuid,boolean,text,uuid,integer,timestamptz,timestamptz,text) OWNER TO taptime_membership_management_function_owner;
REVOKE ALL ON FUNCTION taptime_server.read_managed_active_summary_v5(uuid,boolean,text,uuid,integer,timestamptz,timestamptz,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.read_managed_active_summary_v5(uuid,boolean,text,uuid,integer,timestamptz,timestamptz,text) TO taptime_membership_manager;


CREATE FUNCTION taptime_server.read_managed_memberships_v3(
  requested_location_id uuid,
  requested_search text,
  after_display_name text,
  requested_cursor uuid,
  requested_limit integer
)
RETURNS TABLE (
  result_status text,
  organization_id uuid,
  organization_name text,
  membership_id uuid,
  membership_display_name text,
  membership_role text,
  membership_active boolean,
  membership_row_version bigint,
  location_id uuid,
  location_name text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, taptime_server
AS $projection$
DECLARE
  context_organization_id uuid := NULLIF(
    pg_catalog.current_setting('app.organization_id', true), ''
  )::uuid;
  context_user_id uuid := NULLIF(
    pg_catalog.current_setting('app.user_id', true), ''
  )::uuid;
  context_membership_id uuid := NULLIF(
    pg_catalog.current_setting('app.membership_id', true), ''
  )::uuid;
  organization_locations_enabled boolean;
BEGIN
  IF pg_catalog.current_setting('role', true) <> 'taptime_membership_manager'
    OR requested_limit NOT BETWEEN 1 AND 51
  THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM taptime_server.has_membership_management_authority_v1(
      context_organization_id, context_user_id, context_membership_id,
      'read', NULL, NULL, NULL
    )
  ) THEN
    RETURN QUERY SELECT 'forbidden'::text, NULL::uuid, NULL::text, NULL::uuid,
      NULL::text, NULL::text, NULL::boolean, NULL::bigint, NULL::uuid, NULL::text;
    RETURN;
  END IF;

  SELECT organization.locations_enabled
  INTO organization_locations_enabled
  FROM taptime_server.organizations AS organization
  WHERE organization.id = context_organization_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'forbidden'::text, NULL::uuid, NULL::text, NULL::uuid,
      NULL::text, NULL::text, NULL::boolean, NULL::bigint, NULL::uuid, NULL::text;
    RETURN;
  END IF;

  IF requested_location_id IS NOT NULL
    AND (
      NOT organization_locations_enabled
      OR NOT (
        EXISTS (
          SELECT 1
          FROM taptime_server.has_membership_management_authority_v1(
            context_organization_id, context_user_id, context_membership_id,
            'read', NULL, NULL, NULL
          ) AS authority
          WHERE authority.scope_kind = 'location'
            AND authority.location_id = requested_location_id
        )
        OR (
          EXISTS (
            SELECT 1
            FROM taptime_server.has_membership_management_authority_v1(
              context_organization_id, context_user_id, context_membership_id,
              'read', NULL, NULL, NULL
            ) AS authority
            WHERE authority.scope_kind = 'organization'
              AND authority.location_id IS NULL
          )
          AND EXISTS (
            SELECT 1 FROM taptime_server.locations AS location
            WHERE location.organization_id = context_organization_id
              AND location.id = requested_location_id
              AND location.active
          )
        )
      )
    )
  THEN
    RETURN QUERY SELECT 'location_scope_forbidden'::text, NULL::uuid, NULL::text,
      NULL::uuid, NULL::text, NULL::text, NULL::boolean, NULL::bigint,
      NULL::uuid, NULL::text;
    RETURN;
  END IF;

  IF requested_limit IS NULL OR requested_limit NOT BETWEEN 1 AND 51
    OR (after_display_name IS NULL) <> (requested_cursor IS NULL)
  THEN RAISE EXCEPTION 'Invalid search page' USING ERRCODE='22023'; END IF;
  IF requested_search IS NOT NULL THEN
    -- The TS boundary canonicalizes NFC/Unicode trim with normalizeTapTimeNameV1.
    -- Keep the predecessor's capabilities; no additional helper grants are needed.
    IF length(requested_search) NOT BETWEEN 1 AND 80 THEN RAISE EXCEPTION 'Invalid search' USING ERRCODE='22023'; END IF;
  END IF;

  RETURN QUERY
  WITH management_scope AS MATERIALIZED (
    SELECT authority.scope_kind, authority.location_id
    FROM taptime_server.has_membership_management_authority_v1(
      context_organization_id, context_user_id, context_membership_id,
      'read', NULL, NULL, NULL
    ) AS authority
  )
  SELECT 'succeeded'::text, organization.id, organization.name, page.id,
         COALESCE(
           page.display_name,
           CASE page.role
             WHEN 'administrator' THEN 'Administrator'
             WHEN 'standortleitung' THEN 'Standortleitung'
             ELSE 'Beschäftigter'
           END
         ),
         page.role, page.revoked_at IS NULL, page.row_version,
         page.location_id, page.location_name
  FROM taptime_server.organizations AS organization
  LEFT JOIN LATERAL (
    SELECT membership.id, membership.display_name, membership.role,
           membership.revoked_at, membership.row_version,
           home.location_id, location.display_name AS location_name
    FROM taptime_server.memberships AS membership
    LEFT JOIN taptime_server.membership_home_location_assignments AS home
      ON organization_locations_enabled
     AND home.organization_id = membership.organization_id
     AND home.membership_id = membership.id
     AND home.revoked_at IS NULL
    LEFT JOIN taptime_server.locations AS location
      ON location.organization_id = home.organization_id
     AND location.id = home.location_id
    WHERE membership.organization_id = organization.id
      AND (requested_cursor IS NULL OR (COALESCE(membership.display_name,CASE membership.role WHEN 'administrator' THEN 'Administrator' WHEN 'standortleitung' THEN 'Standortleitung' ELSE 'Beschäftigter' END) COLLATE "und-x-icu",membership.id)>(after_display_name COLLATE "und-x-icu",requested_cursor))
      AND (requested_search IS NULL OR strpos(lower(COALESCE(membership.display_name,CASE membership.role WHEN 'administrator' THEN 'Administrator' WHEN 'standortleitung' THEN 'Standortleitung' ELSE 'Beschäftigter' END) COLLATE "und-x-icu"),lower(requested_search COLLATE "und-x-icu"))>0)
      AND (
        EXISTS (
          SELECT 1 FROM management_scope AS scope
          WHERE scope.scope_kind = 'organization' AND scope.location_id IS NULL
        )
        OR EXISTS (
          SELECT 1 FROM management_scope AS scope
          WHERE scope.scope_kind = 'location'
            AND scope.location_id = home.location_id
        )
      )
      AND (
        requested_location_id IS NULL
        OR home.location_id = requested_location_id
      )
    ORDER BY COALESCE(membership.display_name,CASE membership.role WHEN 'administrator' THEN 'Administrator' WHEN 'standortleitung' THEN 'Standortleitung' ELSE 'Beschäftigter' END) COLLATE "und-x-icu",membership.id
    LIMIT requested_limit
  ) AS page ON true
  WHERE organization.id = context_organization_id
    AND EXISTS (SELECT 1 FROM management_scope)
  ORDER BY COALESCE(page.display_name,CASE page.role WHEN 'administrator' THEN 'Administrator' WHEN 'standortleitung' THEN 'Standortleitung' ELSE 'Beschäftigter' END) COLLATE "und-x-icu",page.id;
END
$projection$;
ALTER FUNCTION taptime_server.read_managed_memberships_v3(uuid,text,text,uuid,integer) OWNER TO taptime_membership_management_function_owner;
REVOKE ALL ON FUNCTION taptime_server.read_managed_memberships_v3(uuid,text,text,uuid,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.read_managed_memberships_v3(uuid,text,text,uuid,integer) TO taptime_membership_manager;


CREATE FUNCTION taptime_server.read_mobile_work_targets_v2(requested_organization_id uuid, requested_user_id uuid, requested_membership_id uuid, requested_after_type_rank integer, requested_after_display_name text, requested_after_target_id uuid, requested_limit integer, requested_search text, requested_target_type text)
 RETURNS TABLE(target_type text, target_id uuid, display_name text, row_version bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
BEGIN
  IF pg_catalog.current_setting('role', true) <> 'taptime_mobile_target_reader'
    OR NOT taptime_server.has_current_mobile_self_v1(
      requested_organization_id, requested_user_id, requested_membership_id
    )
    OR requested_limit NOT BETWEEN 1 AND 51
    OR (requested_after_type_rank IS NULL)
       <> (requested_after_display_name IS NULL OR requested_after_target_id IS NULL)
  THEN
    RAISE EXCEPTION 'Mobile target capability rejected' USING ERRCODE = '42501';
  END IF;

  IF requested_limit IS NULL OR requested_limit NOT BETWEEN 1 AND 51
    OR (requested_after_display_name IS NULL) <> (requested_after_target_id IS NULL)
  THEN RAISE EXCEPTION 'Invalid search page' USING ERRCODE='22023'; END IF;
  IF requested_search IS NOT NULL THEN
    -- The TS boundary canonicalizes NFC/Unicode trim with normalizeTapTimeNameV1.
    -- Keep the predecessor's capabilities; no additional helper grants are needed.
    IF length(requested_search) NOT BETWEEN 1 AND 80 THEN RAISE EXCEPTION 'Invalid search' USING ERRCODE='22023'; END IF;
  END IF;
  IF requested_target_type IS NOT NULL AND requested_target_type NOT IN ('customer','project','general_work') THEN
    RAISE EXCEPTION 'Invalid target type' USING ERRCODE='22023';
  END IF;

  RETURN QUERY
  SELECT target.target_type, target.target_id, target.display_name, target.row_version
  FROM taptime_server.work_targets AS target
  WHERE target.organization_id = requested_organization_id
    AND target.active
    AND (requested_search IS NULL OR strpos(lower(target.display_name COLLATE "und-x-icu"),lower(requested_search COLLATE "und-x-icu"))>0)
    AND (requested_target_type IS NULL OR target.target_type=requested_target_type)
    AND (
      NOT EXISTS (
        SELECT 1
        FROM taptime_server.organizations AS organization
        WHERE organization.id = requested_organization_id
          AND organization.locations_enabled
      )
      OR target.target_type = 'general_work'
      OR EXISTS (
        SELECT 1
        FROM taptime_server.work_target_location_assignments AS binding
        WHERE binding.organization_id = target.organization_id
          AND binding.target_type = target.target_type
          AND binding.target_id = target.target_id
          AND binding.revoked_at IS NULL
          AND taptime_server.membership_has_work_location_v1(
            requested_organization_id, requested_membership_id, binding.location_id
          )
      )
    )
    AND (
      requested_after_type_rank IS NULL
      OR (
        CASE target.target_type
          WHEN 'customer' THEN 1 WHEN 'project' THEN 2 ELSE 3
        END,
        target.display_name COLLATE "und-x-icu",
        target.target_id
      ) > (
        requested_after_type_rank,
        requested_after_display_name COLLATE "und-x-icu",
        requested_after_target_id
      )
    )
  ORDER BY
    CASE target.target_type WHEN 'customer' THEN 1 WHEN 'project' THEN 2 ELSE 3 END,
    target.display_name COLLATE "und-x-icu",
    target.target_id
  LIMIT requested_limit;
END
$function$;
ALTER FUNCTION taptime_server.read_mobile_work_targets_v2(uuid,uuid,uuid,integer,text,uuid,integer,text,text) OWNER TO taptime_mobile_read_function_owner;
REVOKE ALL ON FUNCTION taptime_server.read_mobile_work_targets_v2(uuid,uuid,uuid,integer,text,uuid,integer,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.read_mobile_work_targets_v2(uuid,uuid,uuid,integer,text,uuid,integer,text,text) TO taptime_mobile_target_reader;


CREATE FUNCTION taptime_server.read_time_backfill_targets_v2(
  requested_organization_id uuid, requested_actor_user_id uuid, requested_membership_id uuid,
  requested_target_membership_id uuid, requested_after_type_rank integer, requested_after_display_name text, requested_after_id uuid,
  requested_limit integer, requested_search text
)
RETURNS TABLE(target_type text,target_id uuid,display_name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog
AS $backfill_targets$
DECLARE target_user uuid;
BEGIN
  SELECT person.user_id INTO target_user FROM taptime_server.memberships AS person
    WHERE person.organization_id=requested_organization_id AND person.id=requested_target_membership_id;
  IF current_setting('role',true) IS DISTINCT FROM 'taptime_time_review_reader'
    OR target_user IS NULL OR requested_limit IS NULL OR requested_limit NOT BETWEEN 1 AND 51
    OR (requested_after_type_rank IS NULL) <> (requested_after_id IS NULL)
    OR (requested_after_type_rank IS NOT NULL AND requested_after_type_rank NOT BETWEEN 1 AND 3)
    OR NOT EXISTS (SELECT 1 FROM taptime_server.has_time_management_authority_v1(
      requested_organization_id,requested_actor_user_id,requested_membership_id,target_user
    )) THEN RAISE EXCEPTION 'Time target capability rejected' USING ERRCODE='42501'; END IF;
  IF requested_limit IS NULL OR requested_limit NOT BETWEEN 1 AND 51
    OR (requested_after_display_name IS NULL) <> (requested_after_id IS NULL)
  THEN RAISE EXCEPTION 'Invalid search page' USING ERRCODE='22023'; END IF;
  IF requested_search IS NOT NULL THEN
    -- The TS boundary canonicalizes NFC/Unicode trim with normalizeTapTimeNameV1.
    -- Keep the predecessor's capabilities; no additional helper grants are needed.
    IF length(requested_search) NOT BETWEEN 1 AND 80 THEN RAISE EXCEPTION 'Invalid search' USING ERRCODE='22023'; END IF;
  END IF;
  RETURN QUERY
    SELECT target.target_type,target.target_id,target.display_name
    FROM taptime_server.work_targets AS target
    WHERE target.organization_id=requested_organization_id
      AND taptime_server.membership_may_choose_time_target_v1(
        requested_organization_id,requested_target_membership_id,target.target_type,target.target_id
      )
      AND (requested_search IS NULL OR strpos(lower(target.display_name COLLATE "und-x-icu"),lower(requested_search COLLATE "und-x-icu"))>0)
      AND (requested_after_type_rank IS NULL OR
        (CASE target.target_type WHEN 'customer' THEN 1 WHEN 'project' THEN 2 ELSE 3 END,target.display_name COLLATE "und-x-icu",target.target_id)
        > (requested_after_type_rank,requested_after_display_name COLLATE "und-x-icu",requested_after_id))
    ORDER BY CASE target.target_type WHEN 'customer' THEN 1 WHEN 'project' THEN 2 ELSE 3 END,target.display_name COLLATE "und-x-icu",target.target_id LIMIT requested_limit;
END
$backfill_targets$;
ALTER FUNCTION taptime_server.read_time_backfill_targets_v2(uuid,uuid,uuid,uuid,integer,text,uuid,integer,text) OWNER TO taptime_time_review_read_function_owner;
REVOKE ALL ON FUNCTION taptime_server.read_time_backfill_targets_v2(uuid,uuid,uuid,uuid,integer,text,uuid,integer,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.read_time_backfill_targets_v2(uuid,uuid,uuid,uuid,integer,text,uuid,integer,text) TO taptime_time_review_reader;

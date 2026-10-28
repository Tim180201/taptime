-- T-137. Same read contracts, scope and ordering; repeated work is shared per call.
-- Indexes and function definitions are created/changed/retired only by migrations.
-- No new data, roles or policies; all predecessor function owners/ACLs are retained.

-- Match the exact authenticated person + entry lookup (064); null-entry receipts
-- cannot match it and need no additional index write.
CREATE INDEX sync_receipts_person_entry ON taptime_server.sync_receipts
  (organization_id,user_id,server_time_entry_id) WHERE server_time_entry_id IS NOT NULL;

-- Read the first authorized name page in order instead of sorting every visible tag.
CREATE INDEX nfc_tags_setup_name ON taptime_server.nfc_tags
  (organization_id,display_name COLLATE "und-x-icu",id);

CREATE OR REPLACE FUNCTION taptime_server.read_customer_hours_v3(from_inclusive timestamptz,to_exclusive timestamptz,requested_search text,after_display_name text,after_id uuid,requested_limit integer)
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
    SELECT record.target_id,record.effective_stopped_at,duration.work_seconds
    FROM taptime_server.effective_time_records_v2 record
    JOIN visible_customers customer ON customer.id=record.target_id
    CROSS JOIN LATERAL taptime_server.time_record_duration_v1(record.organization_id,
      record.canonical_time_entry_id,record.effective_started_at,record.effective_stopped_at) duration
    WHERE record.organization_id=org AND record.target_type='customer'
      AND record.effective_started_at>=from_inclusive AND record.effective_started_at<to_exclusive
      AND (actor_role IN ('administrator','standortleitung') OR record.user_id=actor_user)
  ), totals_by_customer AS MATERIALIZED (
    SELECT record.target_id,sum(record.work_seconds)::bigint AS seconds,
      bool_or(record.effective_stopped_at IS NULL) AS running
    FROM visible_records record GROUP BY record.target_id
  )
  SELECT COALESCE(jsonb_agg(item.value ORDER BY item.display_name COLLATE "und-x-icu",item.id),'[]'::jsonb) INTO result
  FROM (
    SELECT customer.id,customer.display_name,
      jsonb_build_object('customerId',customer.id,'displayName',customer.display_name,'active',customer.active,
        'workDurationSeconds',COALESCE(totals.seconds,0::bigint),'running',COALESCE(totals.running,false))
      || CASE WHEN actor_role='employee' THEN '{}'::jsonb ELSE jsonb_build_object(
        'quotaSeconds',quota.minutes*60,
        'quotaStage',CASE WHEN quota.minutes IS NULL THEN 'none'
          WHEN COALESCE(totals.seconds,0::bigint)>=quota.minutes*60 THEN 'exceeded'
          WHEN COALESCE(totals.seconds,0::bigint)*10>=quota.minutes::bigint*60*9 THEN 'warning' ELSE 'ok' END) END AS value
    FROM visible_customers customer
    LEFT JOIN totals_by_customer totals ON totals.target_id=customer.id
    LEFT JOIN LATERAL (
      SELECT setting.minutes FROM taptime_server.customer_quota_settings setting
      WHERE reader.actor_role<>'employee' AND setting.organization_id=org
        AND setting.customer_id=customer.id AND setting.set_at<to_exclusive
      ORDER BY setting.set_at DESC,setting.sequence DESC LIMIT 1
    ) quota ON true
    WHERE (customer.active OR COALESCE(totals.seconds,0::bigint)>0 OR COALESCE(totals.running,false))
      AND (requested_search IS NULL OR strpos(lower(customer.display_name COLLATE "und-x-icu"),lower(requested_search COLLATE "und-x-icu"))>0)
      AND (after_id IS NULL OR (customer.display_name COLLATE "und-x-icu",customer.id)>(after_display_name COLLATE "und-x-icu",after_id))
    ORDER BY customer.display_name COLLATE "und-x-icu",customer.id LIMIT requested_limit
  ) item;
  RETURN jsonb_build_object('version','customer-hours.v3','scope',CASE WHEN actor_role='employee' THEN 'self' ELSE 'people' END,
    'asOf',to_char(transaction_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'customers',result);
END
$function$;

CREATE OR REPLACE FUNCTION taptime_server.read_customer_quota_alerts_v1(from_inclusive timestamptz,to_exclusive timestamptz,after_display_name text,after_id uuid,requested_limit integer)
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
    SELECT record.target_id,record.effective_stopped_at,duration.work_seconds
    FROM taptime_server.effective_time_records_v2 record
    JOIN visible_customers customer ON customer.id=record.target_id
    CROSS JOIN LATERAL taptime_server.time_record_duration_v1(record.organization_id,
      record.canonical_time_entry_id,record.effective_started_at,record.effective_stopped_at) duration
    WHERE record.organization_id=org AND record.target_type='customer'
      AND record.effective_started_at>=from_inclusive AND record.effective_started_at<to_exclusive
      AND (actor_role IN ('administrator','standortleitung') OR record.user_id=actor_user)
  ), totals_by_customer AS MATERIALIZED (
    SELECT record.target_id,sum(record.work_seconds)::bigint AS seconds,
      bool_or(record.effective_stopped_at IS NULL) AS running
    FROM visible_records record GROUP BY record.target_id
  )
  SELECT COALESCE(jsonb_agg(item.value ORDER BY item.display_name COLLATE "und-x-icu",item.id),'[]'::jsonb) INTO result
  FROM (
    SELECT customer.id,customer.display_name,
      jsonb_build_object('customerId',customer.id,'displayName',customer.display_name,'active',customer.active,
        'workDurationSeconds',COALESCE(totals.seconds,0::bigint),'running',COALESCE(totals.running,false))
      || CASE WHEN actor_role='employee' THEN '{}'::jsonb ELSE jsonb_build_object(
        'quotaSeconds',quota.minutes*60,
        'quotaStage',CASE WHEN quota.minutes IS NULL THEN 'none'
          WHEN COALESCE(totals.seconds,0::bigint)>=quota.minutes*60 THEN 'exceeded'
          WHEN COALESCE(totals.seconds,0::bigint)*10>=quota.minutes::bigint*60*9 THEN 'warning' ELSE 'ok' END) END AS value
    FROM visible_customers customer
    LEFT JOIN totals_by_customer totals ON totals.target_id=customer.id
    LEFT JOIN LATERAL (
      SELECT setting.minutes FROM taptime_server.customer_quota_settings setting
      WHERE reader.actor_role<>'employee' AND setting.organization_id=org
        AND setting.customer_id=customer.id AND setting.set_at<to_exclusive
      ORDER BY setting.set_at DESC,setting.sequence DESC LIMIT 1
    ) quota ON true
    WHERE (customer.active OR COALESCE(totals.seconds,0::bigint)>0 OR COALESCE(totals.running,false))
      AND actor_role<>'employee' AND quota.minutes IS NOT NULL AND COALESCE(totals.seconds,0::bigint)*10>=quota.minutes::bigint*60*9
      AND (after_id IS NULL OR (customer.display_name COLLATE "und-x-icu",customer.id)>(after_display_name COLLATE "und-x-icu",after_id))
    ORDER BY customer.display_name COLLATE "und-x-icu",customer.id LIMIT requested_limit
  ) item;
  RETURN jsonb_build_object('version','customer-quota-alerts.v1','scope',CASE WHEN actor_role='employee' THEN 'self' ELSE 'people' END,
    'asOf',to_char(transaction_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'customers',result);
END
$function$;

CREATE OR REPLACE FUNCTION taptime_server.read_archive_status_v1(
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
  WITH customer_scope AS MATERIALIZED (
    -- Resolve the current/latest customer binding once, not once per historical entry.
    SELECT customer.id
    FROM taptime_server.customers customer
    JOIN LATERAL (
      SELECT b.location_id FROM taptime_server.work_target_location_assignments b
      WHERE b.organization_id=org AND b.target_type='customer' AND b.target_id=customer.id
        AND (NOT customer.active OR b.revoked_at IS NULL)
      ORDER BY b.assigned_at DESC,b.id DESC LIMIT 1
    ) binding ON binding.location_id=ANY(location_scope)
    WHERE customer.organization_id=org
  ), target_contributors AS MATERIALIZED (
    SELECT DISTINCT r.target_type,r.target_id,r.user_id
    FROM taptime_server.effective_time_records_v2 r
    WHERE NOT organization_scope AND r.organization_id=org
      AND ((r.target_type='customer' AND r.target_id=ANY(requested_customer_ids))
        OR (r.target_type='project' AND r.target_id=ANY(requested_project_ids)))
  ), readable_contributors AS MATERIALIZED (
    -- The existing authority remains the sole decision; evaluate it once per person.
    SELECT contributor.user_id
    FROM (SELECT DISTINCT r.user_id FROM target_contributors r) contributor
    WHERE EXISTS (SELECT 1 FROM taptime_server.has_time_management_authority_v1(org,actor_user,actor,contributor.user_id))
  ), visible AS (
    SELECT 'person'::text AS kind,m.id,m.revoked_at IS NOT NULL AS archived
    FROM taptime_server.memberships m
    WHERE m.organization_id=org AND m.id=ANY(requested_membership_ids)
      AND (organization_scope OR taptime_server.membership_management_home_v1(org,m.id)=ANY(location_scope)
        OR EXISTS (
          -- Customer detail discloses contributors even when their home is elsewhere.
          -- This authorizes only their status, never their archive/person-time page.
          SELECT 1 FROM taptime_server.effective_time_records_v2 r
          JOIN customer_scope customer ON customer.id=r.target_id
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
        SELECT 1 FROM target_contributors r
        JOIN readable_contributors allowed ON allowed.user_id=r.user_id
        WHERE r.target_type=t.target_type AND r.target_id=t.target_id
      ))
  )
  SELECT 'succeeded'::text,v.kind,v.id,v.archived
  FROM (SELECT 1) head LEFT JOIN visible v ON true ORDER BY v.kind COLLATE "C",v.id;
END
$status$;

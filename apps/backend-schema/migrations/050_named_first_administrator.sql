-- T-107: the operator supplies the existing membership display name at creation.
-- Its immutable lifecycle and retention remain those of memberships (008/T-016).
-- Old create functions remain callable for installed clients; names never enter operator read models.
CREATE FUNCTION taptime_server.operator_create_organization_v4(command uuid,requested_name text,email_hash bytea,verified_issuer text,verified_subject text, account_was_invited boolean,requested_package_size integer,requested_administrator_name text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid := taptime_server.require_platform_operator_v1();
  canonical_name text := taptime_server.normalize_taptime_name_v1(requested_name,'organization');
  administrator_name text := taptime_server.normalize_membership_display_name_v1(requested_administrator_name);
  fingerprint bytea; receipt taptime_server.platform_command_receipts%ROWTYPE;
  org uuid := gen_random_uuid(); person uuid := gen_random_uuid(); result jsonb;
BEGIN
  IF administrator_name IS NULL OR requested_package_size<1 OR command IS NULL OR canonical_name IS NULL OR email_hash IS NULL OR octet_length(email_hash)<>32
    OR verified_issuer IS NULL OR length(btrim(verified_issuer))=0 THEN RETURN jsonb_build_object('status','invalid_request'); END IF;
  fingerprint := sha256(convert_to(jsonb_build_array('create-named-admin',administrator_name,canonical_name,encode(email_hash,'hex'),verified_issuer,requested_package_size)::text,'UTF8'));
  PERFORM pg_advisory_xact_lock(hashtextextended('taptime:operator-command:'||command::text,0));
  PERFORM pg_advisory_xact_lock(hashtextextended('taptime:account-email:'||encode(email_hash,'hex'),0));
  SELECT * INTO receipt FROM taptime_server.platform_command_receipts WHERE command_id=command;
  IF FOUND THEN
    IF receipt.operator_id=actor AND receipt.request_hash=fingerprint THEN RETURN receipt.result; END IF;
    RETURN jsonb_build_object('status','command_id_conflict');
  END IF;
  IF verified_subject IS NULL THEN RETURN jsonb_build_object('status','prepared'); END IF;
  IF length(btrim(verified_subject))=0 THEN RETURN jsonb_build_object('status','invalid_request'); END IF;
  -- Serialize with both membership entry paths and root grants, including fixed snapshots.
  UPDATE taptime_server.platform_identity_guard SET revision=revision+1;
  IF EXISTS(SELECT FROM taptime_server.platform_operators WHERE issuer=verified_issuer AND subject=verified_subject AND revoked_at IS NULL)
    OR EXISTS(SELECT FROM taptime_server.identity_bindings WHERE issuer=verified_issuer AND subject=verified_subject) THEN
    RETURN jsonb_build_object('status','identity_unavailable');
  END IF;
  INSERT INTO taptime_server.organizations(id,name,package_size) VALUES(org,canonical_name,requested_package_size);
  INSERT INTO taptime_server.users(id) VALUES(person);
  INSERT INTO taptime_server.identity_bindings(id,user_id,issuer,subject) VALUES(gen_random_uuid(),person,verified_issuer,verified_subject);
  INSERT INTO taptime_server.memberships(id,organization_id,user_id,role,created_by_user_id,display_name) VALUES(gen_random_uuid(),org,person,'administrator',person,administrator_name);
  result := jsonb_build_object('status','succeeded','organization_id',org,'invitation_status',CASE WHEN account_was_invited THEN 'succeeded' ELSE 'succeeded_existing_account' END);
  INSERT INTO taptime_server.platform_command_receipts(command_id,operator_id,request_hash,result) VALUES(command,actor,fingerprint,result);
  INSERT INTO taptime_server.platform_audit_events(operator_id,operator_principal,organization_id,command_id,action,package_size_after)
    VALUES(actor,'operator',org,command,'organization_created',requested_package_size);
  RETURN result;
END $$;

ALTER FUNCTION taptime_server.operator_create_organization_v4(uuid,text,bytea,text,text,boolean,integer,text) OWNER TO taptime_platform_operator_owner;
REVOKE ALL ON FUNCTION taptime_server.operator_create_organization_v4(uuid,text,bytea,text,text,boolean,integer,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.operator_create_organization_v4(uuid,text,bytea,text,text,boolean,integer,text) TO taptime_platform_operator;

-- From 046: only the missing-name label changes; authorization and totals are unchanged.
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
        FROM (SELECT member.id,COALESCE(NULLIF(member.display_name,''),CASE member.role WHEN 'administrator' THEN 'Administrator' WHEN 'standortleitung' THEN 'Standortleitung' ELSE 'Beschäftigter' END) AS display_name,
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

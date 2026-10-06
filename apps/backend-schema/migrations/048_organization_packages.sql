-- T-075 / D-087: the operator creates, changes and clears the optional package.
-- Membership created_at/revoked_at preserve each active interval; no stored counter.
-- Audit/receipts remain append-only; their retention belongs to T-016.
ALTER TABLE taptime_server.organizations ADD COLUMN package_size integer
  CHECK (package_size IS NULL OR package_size >= 1);
ALTER TABLE taptime_server.platform_audit_events
  ADD COLUMN package_size_before integer CHECK (package_size_before IS NULL OR package_size_before >= 1),
  ADD COLUMN package_size_after integer CHECK (package_size_after IS NULL OR package_size_after >= 1);

-- Private calculation: only function owners can call with an arbitrary organization.
-- Half-open intervals, grouped deltas at identical instants, one statement snapshot.
CREATE FUNCTION taptime_server.organization_access_usage_v1(org uuid, as_at timestamptz)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $usage$
  WITH month AS (
    SELECT date_trunc('month',as_at AT TIME ZONE 'Europe/Berlin') AS local_start
  ), windows AS (
    SELECT offset_month,
      (local_start + offset_month * interval '1 month') AT TIME ZONE 'Europe/Berlin' AS start_at,
      (local_start + (offset_month+1) * interval '1 month') AT TIME ZONE 'Europe/Berlin' AS end_at,
      to_char(local_start + offset_month * interval '1 month','YYYY-MM') AS label
    FROM month CROSS JOIN (VALUES (-1),(0)) offsets(offset_month)
  ), intervals AS MATERIALIZED (
    SELECT created_at,revoked_at FROM taptime_server.memberships
    WHERE organization_id=org AND created_at<=as_at
      AND (revoked_at IS NULL OR revoked_at>created_at)
  ), deltas AS (
    SELECT w.offset_month,w.start_at AS instant,count(i.*)::bigint AS delta
    FROM windows w LEFT JOIN intervals i ON i.created_at<=w.start_at
      AND (i.revoked_at IS NULL OR i.revoked_at>w.start_at)
    GROUP BY w.offset_month,w.start_at
    UNION ALL
    SELECT w.offset_month,i.created_at,1 FROM windows w JOIN intervals i
      ON i.created_at>w.start_at AND i.created_at<w.end_at
    UNION ALL
    SELECT w.offset_month,i.revoked_at,-1 FROM windows w JOIN intervals i
      ON i.revoked_at>w.start_at AND i.revoked_at<w.end_at AND i.revoked_at<=as_at
  ), grouped AS (
    SELECT offset_month,instant,sum(delta) AS delta FROM deltas GROUP BY offset_month,instant
  ), counts AS (
    SELECT offset_month,sum(delta) OVER(PARTITION BY offset_month ORDER BY instant) AS active FROM grouped
  ), peaks AS (
    SELECT offset_month,max(active)::bigint AS peak FROM counts GROUP BY offset_month
  )
  SELECT jsonb_build_object('package_size',o.package_size,
    'active_access_count',(SELECT count(*) FROM taptime_server.memberships
      WHERE organization_id=org AND created_at<=as_at AND (revoked_at IS NULL OR revoked_at>as_at)),
    'current_month',(SELECT label FROM windows WHERE offset_month=0),
    'current_month_peak',(SELECT peak FROM peaks WHERE offset_month=0),
    'previous_month',(SELECT label FROM windows WHERE offset_month=-1),
    'previous_month_peak',(SELECT peak FROM peaks WHERE offset_month=-1))
  FROM taptime_server.organizations o WHERE o.id=org;
$usage$;
ALTER FUNCTION taptime_server.organization_access_usage_v1(uuid,timestamptz) OWNER TO taptime_platform_operator_owner;
REVOKE ALL ON FUNCTION taptime_server.organization_access_usage_v1(uuid,timestamptz) FROM PUBLIC;

-- Only the live administrator in the authenticated organization receives package data.
CREATE FUNCTION taptime_server.read_organization_package_v1() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE
  org uuid := NULLIF(current_setting('app.organization_id',true),'')::uuid;
  person uuid := NULLIF(current_setting('app.user_id',true),'')::uuid;
  member uuid := NULLIF(current_setting('app.membership_id',true),'')::uuid;
BEGIN
  IF current_setting('role',true) IS DISTINCT FROM 'taptime_membership_manager'
    OR NOT EXISTS (SELECT 1 FROM taptime_server.has_membership_management_authority_v1(
      org,person,member,'read',NULL,NULL,NULL) scope WHERE scope.scope_kind='organization')
  THEN RETURN NULL; END IF;
  RETURN (SELECT jsonb_build_object('packageSize',o.package_size,'activeAccessCount',
      (SELECT count(*) FROM taptime_server.memberships m WHERE m.organization_id=org AND m.revoked_at IS NULL))
    FROM taptime_server.organizations o WHERE o.id=org);
END $$;
GRANT SELECT (package_size) ON taptime_server.organizations TO taptime_membership_management_function_owner;
ALTER FUNCTION taptime_server.read_organization_package_v1() OWNER TO taptime_membership_management_function_owner;
REVOKE ALL ON FUNCTION taptime_server.read_organization_package_v1() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.read_organization_package_v1() TO taptime_membership_manager;

CREATE FUNCTION taptime_server.read_operator_overview_v2() RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid := taptime_server.require_platform_operator_v1(); result jsonb;
BEGIN
  SELECT jsonb_build_object('status','succeeded','organizations',coalesce(jsonb_agg(row_data ORDER BY row_data->>'created_at',row_data->>'organization_id'),'[]'::jsonb),
    'totals',jsonb_build_object('organizations',count(*),'administrators',coalesce(sum((row_data->>'administrators')::bigint),0),
      'location_managers',coalesce(sum((row_data->>'location_managers')::bigint),0),
      'employees',coalesce(sum((row_data->>'employees')::bigint),0),'active_now',coalesce(sum((row_data->>'active_now')::bigint),0),
      'taps_today',(SELECT count(*) FROM taptime_server.work_events WHERE received_at>=date_trunc('day',now() AT TIME ZONE 'Europe/Berlin') AT TIME ZONE 'Europe/Berlin')))
  INTO result FROM (
    SELECT jsonb_build_object('organization_id',o.id,'name',o.name,'status',o.status,'created_at',o.created_at,'row_version',o.row_version,
      'package_usage',taptime_server.organization_access_usage_v1(o.id,transaction_timestamp()),
      'administrators',(SELECT count(*) FROM taptime_server.memberships WHERE organization_id=o.id AND revoked_at IS NULL AND role='administrator'),
      'location_managers',(SELECT count(*) FROM taptime_server.memberships WHERE organization_id=o.id AND revoked_at IS NULL AND role='standortleitung'),
      'employees',(SELECT count(*) FROM taptime_server.memberships WHERE organization_id=o.id AND revoked_at IS NULL AND role='employee'),
      'active_now',(SELECT count(*) FROM taptime_server.time_entries WHERE organization_id=o.id AND status='started'),
      'last_tap',(SELECT max(received_at) FROM taptime_server.work_events WHERE organization_id=o.id),
      'tags',(SELECT count(*) FROM taptime_server.nfc_tags WHERE organization_id=o.id),
      'active_assignments',(SELECT count(*) FROM taptime_server.nfc_assignments WHERE organization_id=o.id AND active),
      'open_invitations',(SELECT count(*) FROM taptime_server.employee_membership_invitations WHERE organization_id=o.id AND consumed_at IS NULL AND expires_at>now())) row_data
    FROM taptime_server.organizations o
  ) rows;
  INSERT INTO taptime_server.platform_audit_events(operator_id,operator_principal,action) VALUES(actor,'operator','overview');
  RETURN result;
END $$;

CREATE FUNCTION taptime_server.read_platform_audit_v2(before_id bigint,page_size integer) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid := taptime_server.require_platform_operator_v1(); result jsonb;
BEGIN
  IF page_size IS NULL OR page_size NOT BETWEEN 1 AND 100 OR before_id<=0 THEN RETURN jsonb_build_object('status','invalid_request'); END IF;
  SELECT jsonb_build_object('status','succeeded','events',coalesce(jsonb_agg(jsonb_build_object(
    'id',id::text,'organization_id',organization_id,'action',action,'reason',reason,'created_at',created_at,
    'package_size_before',package_size_before,'package_size_after',package_size_after,
    'actor',CASE WHEN operator_principal LIKE 'root@%' THEN 'root' ELSE 'operator' END) ORDER BY id DESC),'[]'::jsonb),
    'next_before',CASE WHEN count(*)=page_size THEN min(id)::text ELSE NULL END) INTO result
    FROM (SELECT * FROM taptime_server.platform_audit_events WHERE before_id IS NULL OR id<before_id ORDER BY id DESC LIMIT page_size) events;
  INSERT INTO taptime_server.platform_audit_events(operator_id,operator_principal,action) VALUES(actor,'operator','audit');
  RETURN result;
END $$;

CREATE FUNCTION taptime_server.operator_create_organization_v3(command uuid,requested_name text,email_hash bytea,verified_issuer text,verified_subject text, account_was_invited boolean,requested_package_size integer)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid := taptime_server.require_platform_operator_v1();
  canonical_name text := taptime_server.normalize_taptime_name_v1(requested_name,'organization');
  fingerprint bytea; receipt taptime_server.platform_command_receipts%ROWTYPE;
  org uuid := gen_random_uuid(); person uuid := gen_random_uuid(); result jsonb;
BEGIN
  IF requested_package_size<1 OR command IS NULL OR canonical_name IS NULL OR email_hash IS NULL OR octet_length(email_hash)<>32
    OR verified_issuer IS NULL OR length(btrim(verified_issuer))=0 THEN RETURN jsonb_build_object('status','invalid_request'); END IF;
  fingerprint := sha256(convert_to(jsonb_build_array('create-package',canonical_name,encode(email_hash,'hex'),verified_issuer,requested_package_size)::text,'UTF8'));
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
  INSERT INTO taptime_server.memberships(id,organization_id,user_id,role,created_by_user_id) VALUES(gen_random_uuid(),org,person,'administrator',person);
  result := jsonb_build_object('status','succeeded','organization_id',org,'invitation_status',CASE WHEN account_was_invited THEN 'succeeded' ELSE 'succeeded_existing_account' END);
  INSERT INTO taptime_server.platform_command_receipts(command_id,operator_id,request_hash,result) VALUES(command,actor,fingerprint,result);
  INSERT INTO taptime_server.platform_audit_events(operator_id,operator_principal,organization_id,command_id,action,package_size_after)
    VALUES(actor,'operator',org,command,'organization_created',requested_package_size);
  RETURN result;
END $$;

CREATE FUNCTION taptime_server.operator_set_organization_package_v1(command uuid,org uuid,requested_package_size integer,reason text,expected_version bigint)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid := taptime_server.require_platform_operator_v1(); fingerprint bytea;
  receipt taptime_server.platform_command_receipts%ROWTYPE; existing taptime_server.organizations%ROWTYPE; result jsonb;
BEGIN
  IF command IS NULL OR org IS NULL OR requested_package_size<1
    OR reason IS NULL OR length(btrim(reason)) NOT BETWEEN 1 AND 500 OR expected_version IS NULL OR expected_version<1
    THEN RETURN jsonb_build_object('status','invalid_request'); END IF;
  fingerprint := sha256(convert_to(jsonb_build_array('package',org,requested_package_size,btrim(reason),expected_version)::text,'UTF8'));
  PERFORM pg_advisory_xact_lock(hashtextextended('taptime:operator-command:'||command::text,0));
  SELECT * INTO receipt FROM taptime_server.platform_command_receipts WHERE command_id=command;
  IF FOUND THEN
    IF receipt.operator_id=actor AND receipt.request_hash=fingerprint THEN RETURN receipt.result; END IF;
    RETURN jsonb_build_object('status','command_id_conflict');
  END IF;
  SELECT * INTO existing FROM taptime_server.organizations WHERE id=org FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','not_found'); END IF;
  IF existing.row_version<>expected_version OR existing.package_size IS NOT DISTINCT FROM requested_package_size THEN RETURN jsonb_build_object('status','conflict'); END IF;
  UPDATE taptime_server.organizations SET package_size=requested_package_size,row_version=row_version+1 WHERE id=org;
  result := jsonb_build_object('status','succeeded','organization_id',org,'row_version',expected_version+1);
  INSERT INTO taptime_server.platform_command_receipts(command_id,operator_id,request_hash,result) VALUES(command,actor,fingerprint,result);
  INSERT INTO taptime_server.platform_audit_events(operator_id,operator_principal,organization_id,command_id,action,reason,package_size_before,package_size_after)
    VALUES(actor,'operator',org,command,'organization_package_changed',btrim(reason),existing.package_size,requested_package_size);
  RETURN result;
END $$;

ALTER FUNCTION taptime_server.read_operator_overview_v2() OWNER TO taptime_platform_operator_owner;
REVOKE ALL ON FUNCTION taptime_server.read_operator_overview_v2() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.read_operator_overview_v2() TO taptime_platform_operator;
ALTER FUNCTION taptime_server.read_platform_audit_v2(bigint,integer) OWNER TO taptime_platform_operator_owner;
REVOKE ALL ON FUNCTION taptime_server.read_platform_audit_v2(bigint,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.read_platform_audit_v2(bigint,integer) TO taptime_platform_operator;
ALTER FUNCTION taptime_server.operator_create_organization_v3(uuid,text,bytea,text,text,boolean,integer) OWNER TO taptime_platform_operator_owner;
REVOKE ALL ON FUNCTION taptime_server.operator_create_organization_v3(uuid,text,bytea,text,text,boolean,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.operator_create_organization_v3(uuid,text,bytea,text,text,boolean,integer) TO taptime_platform_operator;
ALTER FUNCTION taptime_server.operator_set_organization_package_v1(uuid,uuid,integer,text,bigint) OWNER TO taptime_platform_operator_owner;
REVOKE ALL ON FUNCTION taptime_server.operator_set_organization_package_v1(uuid,uuid,integer,text,bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.operator_set_organization_package_v1(uuid,uuid,integer,text,bigint) TO taptime_platform_operator;

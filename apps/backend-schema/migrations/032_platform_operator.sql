-- D-068/D-074: root grants/revokes operators; operator commands administer organizations.
-- Audit is append-only; retention remains part of T-016, never a customer capability.
DO $roles$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='taptime_platform_operator') THEN
    CREATE ROLE taptime_platform_operator NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='taptime_platform_operator_owner') THEN
    CREATE ROLE taptime_platform_operator_owner NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION BYPASSRLS;
  END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname IN ('taptime_platform_operator','taptime_platform_operator_owner')
    AND (rolsuper OR rolcanlogin OR rolcreaterole OR rolcreatedb OR rolreplication OR rolinherit))
    OR EXISTS (SELECT FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.member
      WHERE r.rolname IN ('taptime_platform_operator','taptime_platform_operator_owner')) THEN
    RAISE EXCEPTION 'Invalid platform capability roles';
  END IF;
END $roles$;

CREATE TABLE taptime_server.platform_operators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issuer text NOT NULL CHECK(length(btrim(issuer))>0),
  subject text NOT NULL CHECK(length(btrim(subject))>0),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  revoked_at timestamptz CHECK(revoked_at IS NULL OR revoked_at>=created_at)
);
CREATE UNIQUE INDEX platform_operators_active_identity ON taptime_server.platform_operators(issuer,subject)
  WHERE revoked_at IS NULL;

CREATE TABLE taptime_server.platform_audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  operator_id uuid REFERENCES taptime_server.platform_operators(id),
  operator_principal text NOT NULL CHECK(length(operator_principal)>0),
  organization_id uuid REFERENCES taptime_server.organizations(id),
  command_id uuid,
  action text NOT NULL CHECK(length(action)>0),
  reason text CHECK(length(reason) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp()
);

-- A private serialization row is created by migration and updated by authority triggers.
-- Unlike advisory locks alone it also prevents write skew under repeatable-read snapshots.
-- No runtime role can read/change/remove it; removal only with the schema itself.
CREATE TABLE taptime_server.platform_identity_guard (
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
  revision bigint NOT NULL DEFAULT 0
);
INSERT INTO taptime_server.platform_identity_guard DEFAULT VALUES;

ALTER TABLE taptime_server.platform_operators ENABLE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.platform_operators FORCE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.platform_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.platform_audit_events FORCE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.platform_identity_guard ENABLE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.platform_identity_guard FORCE ROW LEVEL SECURITY;

ALTER TABLE taptime_server.organizations
  ADD COLUMN status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','paused')),
  ADD COLUMN paused_at timestamptz,
  ADD COLUMN pause_reason text,
  ADD CONSTRAINT organizations_pause_state CHECK(
    (status='active' AND paused_at IS NULL AND pause_reason IS NULL) OR
    (status='paused' AND paused_at IS NOT NULL AND pause_reason IS NOT NULL
      AND length(btrim(pause_reason)) BETWEEN 1 AND 500));

CREATE FUNCTION taptime_server.guard_platform_identity_v1() RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $guard$
BEGIN
  UPDATE taptime_server.platform_identity_guard SET revision=revision+1;
  IF TG_TABLE_NAME='platform_operators' AND NEW.revoked_at IS NULL THEN
    IF EXISTS(SELECT FROM taptime_server.identity_bindings b JOIN taptime_server.memberships m ON m.user_id=b.user_id
      WHERE b.issuer=NEW.issuer AND b.subject=NEW.subject AND m.revoked_at IS NULL) THEN
      RAISE EXCEPTION 'identity_unavailable' USING ERRCODE='23514';
    END IF;
  ELSIF TG_TABLE_NAME='memberships' AND NEW.revoked_at IS NULL THEN
    IF EXISTS(SELECT FROM taptime_server.identity_bindings b JOIN taptime_server.platform_operators o
      ON o.issuer=b.issuer AND o.subject=b.subject WHERE b.user_id=NEW.user_id AND o.revoked_at IS NULL) THEN
      RAISE EXCEPTION 'identity_unavailable' USING ERRCODE='23514';
    END IF;
  ELSIF TG_TABLE_NAME='identity_bindings' THEN
    IF EXISTS(SELECT FROM taptime_server.platform_operators o JOIN taptime_server.memberships m
      ON m.user_id=NEW.user_id WHERE o.issuer=NEW.issuer AND o.subject=NEW.subject
      AND o.revoked_at IS NULL AND m.revoked_at IS NULL) THEN
      RAISE EXCEPTION 'identity_unavailable' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END $guard$;
ALTER FUNCTION taptime_server.guard_platform_identity_v1() OWNER TO taptime_platform_operator_owner;
REVOKE ALL ON FUNCTION taptime_server.guard_platform_identity_v1() FROM PUBLIC;
CREATE TRIGGER platform_operator_identity_guard BEFORE INSERT OR UPDATE ON taptime_server.platform_operators
  FOR EACH ROW EXECUTE FUNCTION taptime_server.guard_platform_identity_v1();
CREATE TRIGGER membership_operator_identity_guard BEFORE INSERT OR UPDATE ON taptime_server.memberships
  FOR EACH ROW EXECUTE FUNCTION taptime_server.guard_platform_identity_v1();
CREATE TRIGGER binding_operator_identity_guard BEFORE INSERT OR UPDATE ON taptime_server.identity_bindings
  FOR EACH ROW EXECUTE FUNCTION taptime_server.guard_platform_identity_v1();

CREATE FUNCTION taptime_server.reject_platform_audit_mutation_v1() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$ BEGIN
  RAISE EXCEPTION 'Platform audit is append-only' USING ERRCODE='42501';
END $$;
REVOKE ALL ON FUNCTION taptime_server.reject_platform_audit_mutation_v1() FROM PUBLIC;
CREATE TRIGGER platform_audit_append_only BEFORE UPDATE OR DELETE ON taptime_server.platform_audit_events
  FOR EACH ROW EXECUTE FUNCTION taptime_server.reject_platform_audit_mutation_v1();

GRANT USAGE ON SCHEMA taptime_server TO taptime_platform_operator,taptime_platform_operator_owner;
REVOKE ALL ON taptime_server.platform_operators,taptime_server.platform_audit_events,
  taptime_server.platform_identity_guard FROM PUBLIC,taptime_platform_operator;
GRANT SELECT ON taptime_server.platform_operators,taptime_server.identity_bindings,
  taptime_server.memberships TO taptime_platform_operator_owner;
GRANT UPDATE(id) ON taptime_server.platform_operators TO taptime_platform_operator_owner;
GRANT SELECT,UPDATE ON taptime_server.platform_identity_guard TO taptime_platform_operator_owner;

-- Created only by successful commands; immutable receipts bind retries to actor and input.
CREATE TABLE taptime_server.platform_command_receipts (
  command_id uuid PRIMARY KEY,
  operator_id uuid NOT NULL REFERENCES taptime_server.platform_operators(id),
  request_hash bytea NOT NULL CHECK(octet_length(request_hash)=32),
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp()
);
ALTER TABLE taptime_server.platform_command_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.platform_command_receipts FORCE ROW LEVEL SECURITY;
CREATE TRIGGER platform_receipt_append_only BEFORE UPDATE OR DELETE ON taptime_server.platform_command_receipts
  FOR EACH ROW EXECUTE FUNCTION taptime_server.reject_platform_audit_mutation_v1();

-- The session function is the bootstrap: issuer/subject are supplied by the JWT verifier.
-- It resolves and locks the active identity before setting transaction-local operator context.
CREATE FUNCTION taptime_server.read_operator_session_v1(verified_issuer text,verified_subject text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE operator_uuid uuid;
BEGIN
  IF current_setting('role',true) IS DISTINCT FROM 'taptime_platform_operator' THEN
    RAISE EXCEPTION 'Operator authority required' USING ERRCODE='42501';
  END IF;
  PERFORM set_config('app.operator_id','',true);
  SELECT id INTO operator_uuid FROM taptime_server.platform_operators
    WHERE issuer=verified_issuer AND subject=verified_subject AND revoked_at IS NULL FOR SHARE;
  IF operator_uuid IS NULL THEN RETURN jsonb_build_object('status','forbidden'); END IF;
  PERFORM set_config('app.operator_id',operator_uuid::text,true);
  INSERT INTO taptime_server.platform_audit_events(operator_id,operator_principal,action)
    VALUES(operator_uuid,'operator','session');
  RETURN jsonb_build_object('status','active');
END $$;

CREATE FUNCTION taptime_server.require_platform_operator_v1() RETURNS uuid
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE operator_uuid uuid := NULLIF(current_setting('app.operator_id',true),'')::uuid;
BEGIN
  IF current_setting('role',true) IS DISTINCT FROM 'taptime_platform_operator' OR operator_uuid IS NULL
    OR NOT EXISTS(SELECT FROM taptime_server.platform_operators WHERE id=operator_uuid AND revoked_at IS NULL) THEN
    RAISE EXCEPTION 'Operator authority required' USING ERRCODE='42501';
  END IF;
  RETURN operator_uuid;
END $$;

CREATE FUNCTION taptime_server.read_operator_overview_v1() RETURNS jsonb
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

CREATE FUNCTION taptime_server.read_operator_health_v1() RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid := taptime_server.require_platform_operator_v1();
BEGIN
  INSERT INTO taptime_server.platform_audit_events(operator_id,operator_principal,action) VALUES(actor,'operator','health');
  RETURN jsonb_build_object('status','succeeded','database_bytes',pg_database_size(current_database()),
    'last_archived_at',(SELECT max(archived_at) FROM taptime_server.offsite_wal_archive_receipts),
    'last_base_at',(SELECT max(archived_at) FROM taptime_server.offsite_base_backup_receipts));
END $$;

CREATE FUNCTION taptime_server.read_platform_audit_v1(before_id bigint,page_size integer) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid := taptime_server.require_platform_operator_v1(); result jsonb;
BEGIN
  IF page_size IS NULL OR page_size NOT BETWEEN 1 AND 100 OR before_id<=0 THEN RETURN jsonb_build_object('status','invalid_request'); END IF;
  SELECT jsonb_build_object('status','succeeded','events',coalesce(jsonb_agg(jsonb_build_object(
    'id',id::text,'organization_id',organization_id,'action',action,'reason',reason,'created_at',created_at,
    'actor',CASE WHEN operator_principal LIKE 'root@%' THEN 'root' ELSE 'operator' END) ORDER BY id DESC),'[]'::jsonb),
    'next_before',CASE WHEN count(*)=page_size THEN min(id)::text ELSE NULL END) INTO result
    FROM (SELECT * FROM taptime_server.platform_audit_events WHERE before_id IS NULL OR id<before_id ORDER BY id DESC LIMIT page_size) events;
  INSERT INTO taptime_server.platform_audit_events(operator_id,operator_principal,action) VALUES(actor,'operator','audit');
  RETURN result;
END $$;

CREATE FUNCTION taptime_server.operator_create_organization_v1(command uuid,requested_name text,email_hash bytea,verified_issuer text,verified_subject text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid := taptime_server.require_platform_operator_v1();
  canonical_name text := taptime_server.normalize_taptime_name_v1(requested_name,'organization');
  fingerprint bytea; receipt taptime_server.platform_command_receipts%ROWTYPE;
  org uuid := gen_random_uuid(); person uuid := gen_random_uuid(); result jsonb;
BEGIN
  IF command IS NULL OR canonical_name IS NULL OR email_hash IS NULL OR octet_length(email_hash)<>32
    OR verified_issuer IS NULL OR length(btrim(verified_issuer))=0 THEN RETURN jsonb_build_object('status','invalid_request'); END IF;
  fingerprint := sha256(convert_to(jsonb_build_array('create',canonical_name,encode(email_hash,'hex'),verified_issuer)::text,'UTF8'));
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
  INSERT INTO taptime_server.organizations(id,name) VALUES(org,canonical_name);
  INSERT INTO taptime_server.users(id) VALUES(person);
  INSERT INTO taptime_server.identity_bindings(id,user_id,issuer,subject) VALUES(gen_random_uuid(),person,verified_issuer,verified_subject);
  INSERT INTO taptime_server.memberships(id,organization_id,user_id,role,created_by_user_id) VALUES(gen_random_uuid(),org,person,'administrator',person);
  result := jsonb_build_object('status','succeeded','organization_id',org);
  INSERT INTO taptime_server.platform_command_receipts(command_id,operator_id,request_hash,result) VALUES(command,actor,fingerprint,result);
  INSERT INTO taptime_server.platform_audit_events(operator_id,operator_principal,organization_id,command_id,action)
    VALUES(actor,'operator',org,command,'organization_created');
  RETURN result;
END $$;

CREATE FUNCTION taptime_server.operator_set_organization_status_v1(command uuid,org uuid,desired_status text,reason text,expected_version bigint)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid := taptime_server.require_platform_operator_v1(); fingerprint bytea;
  receipt taptime_server.platform_command_receipts%ROWTYPE; existing taptime_server.organizations%ROWTYPE; result jsonb;
BEGIN
  IF command IS NULL OR org IS NULL OR desired_status IS NULL OR desired_status NOT IN ('active','paused')
    OR reason IS NULL OR length(btrim(reason)) NOT BETWEEN 1 AND 500 OR expected_version IS NULL OR expected_version<1
    THEN RETURN jsonb_build_object('status','invalid_request'); END IF;
  fingerprint := sha256(convert_to(jsonb_build_array('status',org,desired_status,btrim(reason),expected_version)::text,'UTF8'));
  PERFORM pg_advisory_xact_lock(hashtextextended('taptime:operator-command:'||command::text,0));
  SELECT * INTO receipt FROM taptime_server.platform_command_receipts WHERE command_id=command;
  IF FOUND THEN
    IF receipt.operator_id=actor AND receipt.request_hash=fingerprint THEN RETURN receipt.result; END IF;
    RETURN jsonb_build_object('status','command_id_conflict');
  END IF;
  SELECT * INTO existing FROM taptime_server.organizations WHERE id=org FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','not_found'); END IF;
  IF existing.row_version<>expected_version OR existing.status=desired_status THEN RETURN jsonb_build_object('status','conflict'); END IF;
  UPDATE taptime_server.organizations SET status=desired_status,row_version=row_version+1,
    paused_at=CASE WHEN desired_status='paused' THEN now() ELSE NULL END,
    pause_reason=CASE WHEN desired_status='paused' THEN btrim(reason) ELSE NULL END WHERE id=org;
  result := jsonb_build_object('status','succeeded','organization_id',org,'row_version',expected_version+1);
  INSERT INTO taptime_server.platform_command_receipts(command_id,operator_id,request_hash,result) VALUES(command,actor,fingerprint,result);
  INSERT INTO taptime_server.platform_audit_events(operator_id,operator_principal,organization_id,command_id,action,reason)
    VALUES(actor,'operator',org,command,CASE WHEN desired_status='paused' THEN 'organization_paused' ELSE 'organization_resumed' END,btrim(reason));
  RETURN result;
END $$;

GRANT SELECT,INSERT ON taptime_server.platform_command_receipts,taptime_server.platform_audit_events TO taptime_platform_operator_owner;
GRANT USAGE ON SEQUENCE taptime_server.platform_audit_events_id_seq TO taptime_platform_operator_owner;
GRANT SELECT,INSERT,UPDATE ON taptime_server.organizations TO taptime_platform_operator_owner;
GRANT INSERT ON taptime_server.users,taptime_server.identity_bindings,taptime_server.memberships TO taptime_platform_operator_owner;
GRANT SELECT ON taptime_server.time_entries,taptime_server.work_events,taptime_server.nfc_tags,taptime_server.nfc_assignments,
  taptime_server.employee_membership_invitations,taptime_server.offsite_wal_archive_receipts,
  taptime_server.offsite_base_backup_receipts TO taptime_platform_operator_owner;
GRANT EXECUTE ON FUNCTION taptime_server.normalize_membership_display_name_v1(text) TO taptime_platform_operator_owner;
GRANT EXECUTE ON FUNCTION taptime_server.normalize_taptime_name_v1(text,text) TO taptime_platform_operator_owner;
DO $functions$
DECLARE fn regprocedure;
BEGIN
  FOR fn IN SELECT oid::regprocedure FROM pg_proc WHERE pronamespace='taptime_server'::regnamespace
    AND proname IN ('read_operator_session_v1','require_platform_operator_v1','read_operator_overview_v1',
    'read_operator_health_v1','read_platform_audit_v1','operator_create_organization_v1','operator_set_organization_status_v1')
  LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO taptime_platform_operator_owner',fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC',fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO taptime_platform_operator',fn);
  END LOOP;
END $functions$;

-- D-075/D-080: pause is a transient denial on every authority path.
-- Locks serialize successful writes with the operator status change.
CREATE OR REPLACE FUNCTION taptime_server.resolve_request_actor(verified_issuer text, verified_subject text)
RETURNS TABLE (user_id uuid, organization_id uuid, membership_id uuid, membership_role text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog ROWS 1 AS $pause$
DECLARE resolved record;
BEGIN
  SELECT binding.user_id, membership.organization_id, membership.id AS membership_id, membership.role AS membership_role, binding.revoked_at IS NULL AS identity_current, membership.revoked_at IS NULL AS membership_current, organization.status AS organization_status INTO resolved
  FROM taptime_server.identity_bindings binding
  JOIN taptime_server.users resolved_user ON resolved_user.id=binding.user_id
  JOIN taptime_server.memberships membership ON membership.user_id=resolved_user.id
  JOIN taptime_server.organizations organization ON organization.id=membership.organization_id
  WHERE binding.issuer=verified_issuer AND binding.subject=verified_subject
    AND binding.revoked_at IS NULL AND membership.revoked_at IS NULL;
  IF NOT FOUND THEN RETURN; END IF;
  IF resolved.organization_status='paused' THEN
    IF resolved.identity_current AND resolved.membership_current THEN
      RAISE EXCEPTION 'organization_paused' USING ERRCODE='P0068';
    END IF;
    -- Historical authority does not disclose organization state to revoked members.
    RAISE EXCEPTION 'Offline actor capability rejected' USING ERRCODE='42501';
  END IF;
  RETURN QUERY SELECT resolved.user_id, resolved.organization_id, resolved.membership_id, resolved.membership_role;
END $pause$;

CREATE OR REPLACE FUNCTION taptime_server.lock_request_actor(verified_issuer text, verified_subject text)
RETURNS TABLE (user_id uuid, organization_id uuid, membership_id uuid, membership_role text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog ROWS 1 AS $pause$
DECLARE resolved record;
BEGIN
  SELECT binding.user_id, membership.organization_id, membership.id AS membership_id, membership.role AS membership_role, binding.revoked_at IS NULL AS identity_current, membership.revoked_at IS NULL AS membership_current, organization.status AS organization_status INTO resolved
  FROM taptime_server.identity_bindings binding
  JOIN taptime_server.users resolved_user ON resolved_user.id=binding.user_id
  JOIN taptime_server.memberships membership ON membership.user_id=resolved_user.id
  JOIN taptime_server.organizations organization ON organization.id=membership.organization_id
  WHERE binding.issuer=verified_issuer AND binding.subject=verified_subject
    AND binding.revoked_at IS NULL AND membership.revoked_at IS NULL
  FOR SHARE OF binding, membership, organization;
  IF NOT FOUND THEN RETURN; END IF;
  IF resolved.organization_status='paused' THEN
    IF resolved.identity_current AND resolved.membership_current THEN
      RAISE EXCEPTION 'organization_paused' USING ERRCODE='P0068';
    END IF;
    -- Historical authority does not disclose organization state to revoked members.
    RAISE EXCEPTION 'Offline actor capability rejected' USING ERRCODE='42501';
  END IF;
  RETURN QUERY SELECT resolved.user_id, resolved.organization_id, resolved.membership_id, resolved.membership_role;
END $pause$;

CREATE OR REPLACE FUNCTION taptime_server.lock_offline_active_actor_v1(verified_issuer text, verified_subject text)
RETURNS TABLE (identity_binding_id uuid, user_id uuid, organization_id uuid, membership_id uuid, membership_role text, membership_row_version bigint)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog ROWS 1 AS $pause$
DECLARE resolved record;
BEGIN
  IF pg_catalog.current_setting('role', true) NOT IN (
    'taptime_offline_lease_issuer',
    'taptime_offline_event_ingestor',
    'taptime_offline_reconciliation_reader'
  ) OR verified_issuer IS NULL OR verified_subject IS NULL THEN
    RAISE EXCEPTION 'Offline actor capability rejected' USING ERRCODE = '42501';
  END IF;

  SELECT binding.id AS identity_binding_id, binding.user_id, membership.organization_id, membership.id AS membership_id, membership.role AS membership_role, membership.row_version AS membership_row_version, binding.revoked_at IS NULL AS identity_current, membership.revoked_at IS NULL AS membership_current, organization.status AS organization_status INTO resolved
  FROM taptime_server.identity_bindings binding
  JOIN taptime_server.memberships membership ON membership.user_id=binding.user_id
  JOIN taptime_server.organizations organization ON organization.id=membership.organization_id
  WHERE binding.issuer=verified_issuer AND binding.subject=verified_subject
    AND binding.revoked_at IS NULL AND membership.revoked_at IS NULL
  FOR SHARE OF binding, membership, organization;
  IF NOT FOUND THEN RETURN; END IF;
  IF resolved.organization_status='paused' THEN
    IF resolved.identity_current AND resolved.membership_current THEN
      RAISE EXCEPTION 'organization_paused' USING ERRCODE='P0068';
    END IF;
    -- Historical authority does not disclose organization state to revoked members.
    RAISE EXCEPTION 'Offline actor capability rejected' USING ERRCODE='42501';
  END IF;
  RETURN QUERY SELECT resolved.identity_binding_id, resolved.user_id, resolved.organization_id, resolved.membership_id, resolved.membership_role, resolved.membership_row_version;
END $pause$;

CREATE OR REPLACE FUNCTION taptime_server.lock_offline_historical_actor_v1(verified_issuer text, verified_subject text, requested_membership_id uuid)
RETURNS TABLE (identity_binding_id uuid, user_id uuid, organization_id uuid, membership_id uuid, membership_role text, membership_row_version bigint, identity_current boolean, membership_current boolean)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog ROWS 1 AS $pause$
DECLARE resolved record;
BEGIN
  IF pg_catalog.current_setting('role', true) <> 'taptime_offline_event_ingestor'
    OR pg_catalog.current_setting(
      'app.offline_archive_contract_version', true
    ) <> '4'
    OR verified_issuer IS NULL
    OR verified_subject IS NULL
    OR requested_membership_id IS NULL
  THEN
    RAISE EXCEPTION 'Offline historical actor capability rejected' USING ERRCODE = '42501';
  END IF;

  SELECT binding.id AS identity_binding_id, binding.user_id, membership.organization_id, membership.id AS membership_id, membership.role AS membership_role, membership.row_version AS membership_row_version, binding.revoked_at IS NULL AS identity_current, membership.revoked_at IS NULL AS membership_current, organization.status AS organization_status INTO resolved
  FROM taptime_server.identity_bindings binding
  JOIN taptime_server.memberships membership ON membership.user_id=binding.user_id
  JOIN taptime_server.organizations organization ON organization.id=membership.organization_id
  WHERE binding.issuer=verified_issuer AND binding.subject=verified_subject
    AND membership.id=requested_membership_id
  FOR SHARE OF binding, membership, organization;
  IF NOT FOUND THEN RETURN; END IF;
  IF resolved.organization_status='paused' THEN
    IF resolved.identity_current AND resolved.membership_current THEN
      RAISE EXCEPTION 'organization_paused' USING ERRCODE='P0068';
    END IF;
    -- Historical authority does not disclose organization state to revoked members.
    RAISE EXCEPTION 'Offline actor capability rejected' USING ERRCODE='42501';
  END IF;
  RETURN QUERY SELECT resolved.identity_binding_id, resolved.user_id, resolved.organization_id, resolved.membership_id, resolved.membership_role, resolved.membership_row_version, resolved.identity_current, resolved.membership_current;
END $pause$;

GRANT SELECT, UPDATE(id) ON taptime_server.organizations
  TO taptime_offline_lease_function_owner,taptime_offline_event_function_owner;

-- Invitation redemption precedes membership and therefore has no request actor.
-- Keep 020 semantics and grants, adding only the target organization pause lock.
GRANT UPDATE(id) ON taptime_server.organizations TO taptime_employee_redemption_data_function_owner;
CREATE OR REPLACE FUNCTION taptime_server.redeem_employee_membership_invitation_data_v2(
  requested_command_id uuid,
  requested_token_digest bytea,
  verified_issuer text,
  verified_subject text,
  generated_user_id uuid,
  generated_identity_binding_id uuid,
  generated_membership_id uuid
)
RETURNS TABLE (
  result_status text,
  result_organization_name text,
  result_membership_display_name text
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, taptime_server
AS $redeem$
DECLARE
  invitation taptime_server.employee_membership_invitations%ROWTYPE;
  creator taptime_server.memberships%ROWTYPE;
  binding taptime_server.identity_bindings%ROWTYPE;
  receipt taptime_server.employee_enrollment_redemption_receipts%ROWTYPE;
  resolved_user_id uuid;
  resolved_binding_id uuid;
  identity_lock_hash bytea;
  existing_membership taptime_server.memberships%ROWTYPE;
  safe_organization_name text;
  selected_role text := pg_catalog.current_setting('role', true);
BEGIN
  IF selected_role NOT IN (
      'taptime_employee_enrollment_redeemer',
      'taptime_membership_enrollment_redeemer'
    )
    OR requested_command_id IS NULL
    OR requested_token_digest IS NULL
    OR pg_catalog.octet_length(requested_token_digest) <> 32
    OR verified_issuer IS NULL OR verified_subject IS NULL
    OR pg_catalog.length(pg_catalog.btrim(verified_issuer)) = 0
    OR pg_catalog.length(pg_catalog.btrim(verified_subject)) = 0
    OR pg_catalog.octet_length(verified_issuer) > 2048
    OR pg_catalog.octet_length(verified_subject) > 2048
    OR generated_user_id IS NULL OR generated_identity_binding_id IS NULL
    OR generated_membership_id IS NULL
  THEN
    RETURN QUERY SELECT 'invalid_request', NULL::text, NULL::text;
    RETURN;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'taptime:c3e1:invitation-digest:v1:' || pg_catalog.encode(requested_token_digest, 'hex'), 0
  ));
  SELECT candidate.* INTO invitation
  FROM taptime_server.employee_membership_invitations AS candidate
  WHERE candidate.token_digest = requested_token_digest
  FOR UPDATE;
  IF NOT FOUND
    OR (selected_role = 'taptime_employee_enrollment_redeemer'
      AND invitation.membership_role <> 'employee')
  THEN
    RETURN QUERY SELECT 'enrollment_unavailable', NULL::text, NULL::text;
    RETURN;
  END IF;

  -- Unbound invitees have no request actor yet. Lock the target organization
  -- before either creating authority or replaying a receipt. Do not disclose its
  -- paused state, name or invited person to an otherwise unauthorized identity.
  PERFORM 1 FROM taptime_server.organizations AS organization
    WHERE organization.id = invitation.organization_id AND organization.status = 'active'
    FOR SHARE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'enrollment_unavailable', NULL::text, NULL::text;
    RETURN;
  END IF;

  identity_lock_hash := pg_catalog.sha256(
    pg_catalog.convert_to('taptime:c3:identity:v1', 'UTF8') || pg_catalog.decode('00', 'hex')
    || pg_catalog.int4send(pg_catalog.octet_length(pg_catalog.convert_to(verified_issuer, 'UTF8')))
    || pg_catalog.convert_to(verified_issuer, 'UTF8')
    || pg_catalog.int4send(pg_catalog.octet_length(pg_catalog.convert_to(verified_subject, 'UTF8')))
    || pg_catalog.convert_to(verified_subject, 'UTF8')
  );

  IF invitation.consumed_at IS NOT NULL THEN
    IF invitation.redemption_command_id <> requested_command_id THEN
      RETURN QUERY SELECT 'enrollment_unavailable', NULL::text, NULL::text;
      RETURN;
    END IF;
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(pg_catalog.encode(identity_lock_hash, 'hex'), 0)
    );
    SELECT candidate.* INTO binding
    FROM taptime_server.identity_bindings AS candidate
    WHERE candidate.issuer = verified_issuer AND candidate.subject = verified_subject
    FOR SHARE;
    IF NOT FOUND OR binding.revoked_at IS NOT NULL
      OR binding.id <> invitation.consumed_identity_binding_id
      OR binding.user_id <> invitation.consumed_user_id
    THEN
      RETURN QUERY SELECT 'enrollment_unavailable', NULL::text, NULL::text;
      RETURN;
    END IF;
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
      'taptime:c3:bootstrap:user:' || binding.user_id::text, 0
    ));
    PERFORM 1 FROM taptime_server.users AS app_user WHERE app_user.id = binding.user_id FOR SHARE;
    SELECT stored.* INTO receipt
    FROM taptime_server.employee_enrollment_redemption_receipts AS stored
    WHERE stored.command_id = requested_command_id;
    SELECT membership.* INTO existing_membership
    FROM taptime_server.memberships AS membership
    WHERE membership.organization_id = invitation.organization_id
      AND membership.id = invitation.consumed_membership_id
      AND membership.user_id = binding.user_id
      AND membership.role = invitation.membership_role
      AND membership.revoked_at IS NULL
      AND (
        invitation.home_location_id IS NULL
        OR EXISTS (
          SELECT 1
          FROM taptime_server.membership_home_location_assignments AS home
          WHERE home.organization_id = invitation.organization_id
            AND home.membership_id = membership.id
            AND home.location_id = invitation.home_location_id
            AND home.revoked_at IS NULL
        )
      )
    FOR SHARE;
    IF receipt.command_id IS NULL
      OR receipt.invitation_id <> invitation.id
      OR receipt.identity_binding_id <> binding.id
      OR receipt.user_id <> binding.user_id
      OR receipt.membership_id <> invitation.consumed_membership_id
      OR existing_membership.id IS NULL
    THEN
      RETURN QUERY SELECT 'enrollment_unavailable', NULL::text, NULL::text;
      RETURN;
    END IF;
    SELECT organization.name INTO safe_organization_name
    FROM taptime_server.organizations AS organization
    WHERE organization.id = invitation.organization_id;
    RETURN QUERY SELECT 'succeeded', safe_organization_name, existing_membership.display_name;
    RETURN;
  END IF;

  IF invitation.expires_at <= pg_catalog.transaction_timestamp() THEN
    RETURN QUERY SELECT 'enrollment_unavailable', NULL::text, NULL::text;
    RETURN;
  END IF;
  SELECT membership.* INTO creator
  FROM taptime_server.memberships AS membership
  WHERE membership.organization_id = invitation.organization_id
    AND membership.id = invitation.creator_membership_id
    AND membership.user_id = invitation.creator_user_id
  FOR SHARE;
  IF NOT FOUND OR NOT EXISTS (
    SELECT 1
    FROM taptime_server.has_membership_management_authority_v1(
      invitation.organization_id, invitation.creator_user_id,
      invitation.creator_membership_id, 'invite', NULL,
      invitation.membership_role, invitation.home_location_id
    )
  ) THEN
    RETURN QUERY SELECT 'enrollment_unavailable', NULL::text, NULL::text;
    RETURN;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(pg_catalog.encode(identity_lock_hash, 'hex'), 0)
  );
  SELECT candidate.* INTO binding
  FROM taptime_server.identity_bindings AS candidate
  WHERE candidate.issuer = verified_issuer AND candidate.subject = verified_subject
  FOR SHARE;
  IF FOUND THEN
    IF binding.revoked_at IS NOT NULL THEN
      RETURN QUERY SELECT 'enrollment_unavailable', NULL::text, NULL::text;
      RETURN;
    END IF;
    resolved_user_id := binding.user_id;
    resolved_binding_id := binding.id;
  ELSE
    resolved_user_id := generated_user_id;
    resolved_binding_id := generated_identity_binding_id;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'taptime:c3:bootstrap:user:' || resolved_user_id::text, 0
  ));
  IF binding.id IS NOT NULL THEN
    PERFORM 1 FROM taptime_server.users AS app_user
    WHERE app_user.id = resolved_user_id FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'IdentityBinding references a missing User'; END IF;
  ELSIF EXISTS (
    SELECT 1 FROM taptime_server.users AS app_user WHERE app_user.id = resolved_user_id
  ) THEN
    RAISE EXCEPTION 'Generated T-009 User ID collision';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'taptime:c3e1:redemption-command:v1:' || requested_command_id::text, 0
  ));
  SELECT stored.* INTO receipt
  FROM taptime_server.employee_enrollment_redemption_receipts AS stored
  WHERE stored.command_id = requested_command_id;
  IF FOUND THEN
    RETURN QUERY SELECT 'enrollment_unavailable', NULL::text, NULL::text;
    RETURN;
  END IF;

  FOR existing_membership IN
    SELECT membership.* FROM taptime_server.memberships AS membership
    WHERE membership.user_id = resolved_user_id
    ORDER BY membership.organization_id, membership.id
    FOR SHARE
  LOOP
    RETURN QUERY SELECT 'enrollment_unavailable', NULL::text, NULL::text;
    RETURN;
  END LOOP;

  IF binding.id IS NULL THEN
    INSERT INTO taptime_server.users (id) VALUES (resolved_user_id);
    INSERT INTO taptime_server.identity_bindings (id, user_id, issuer, subject)
    VALUES (resolved_binding_id, resolved_user_id, verified_issuer, verified_subject);
  END IF;

  PERFORM pg_catalog.set_config('app.organization_id', invitation.organization_id::text, true);
  PERFORM pg_catalog.set_config('app.user_id', invitation.creator_user_id::text, true);
  PERFORM pg_catalog.set_config('app.membership_id', invitation.creator_membership_id::text, true);
  PERFORM pg_catalog.set_config('app.membership_role', creator.role, true);
  PERFORM pg_catalog.set_config('app.correlation_id', requested_command_id::text, true);

  INSERT INTO taptime_server.memberships (
    id, organization_id, user_id, role, created_by_user_id, display_name
  ) VALUES (
    generated_membership_id, invitation.organization_id, resolved_user_id,
    invitation.membership_role, invitation.creator_user_id, invitation.display_name
  );
  IF invitation.home_location_id IS NOT NULL THEN
    INSERT INTO taptime_server.membership_home_location_assignments (
      id, organization_id, membership_id, location_id
    ) VALUES (
      pg_catalog.gen_random_uuid(), invitation.organization_id,
      generated_membership_id, invitation.home_location_id
    );
  END IF;
  UPDATE taptime_server.employee_membership_invitations
  SET consumed_at = pg_catalog.transaction_timestamp(),
      consumed_identity_binding_id = resolved_binding_id,
      consumed_user_id = resolved_user_id,
      consumed_membership_id = generated_membership_id,
      redemption_command_id = requested_command_id,
      row_version = row_version + 1
  WHERE id = invitation.id;
  INSERT INTO taptime_server.employee_enrollment_redemption_receipts (
    command_id, invitation_id, organization_id, actor_user_id, actor_membership_id,
    identity_binding_id, user_id, membership_id, token_digest
  ) VALUES (
    requested_command_id, invitation.id, invitation.organization_id,
    invitation.creator_user_id, invitation.creator_membership_id,
    resolved_binding_id, resolved_user_id, generated_membership_id,
    requested_token_digest
  );
  SELECT organization.name INTO safe_organization_name
  FROM taptime_server.organizations AS organization
  WHERE organization.id = invitation.organization_id;
  RETURN QUERY SELECT 'succeeded', safe_organization_name, invitation.display_name;
END
$redeem$;

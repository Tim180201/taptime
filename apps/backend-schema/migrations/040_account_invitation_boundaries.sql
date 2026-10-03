-- T-094: existing bindings are classified without disclosing another management scope.
CREATE FUNCTION taptime_server.employee_account_invitation_v2(
  requested_command_id uuid, requested_hash bytea, requested_email_hash bytea,
  requested_name text, requested_location_id uuid, verified_issuer text,
  verified_subject text, account_was_invited boolean, account_from_invitation boolean
)
RETURNS TABLE (result_status text, organization_id uuid, actor_membership_id uuid, membership_id uuid)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = pg_catalog
AS $account$
DECLARE
  org uuid := NULLIF(current_setting('app.organization_id', true), '')::uuid;
  actor uuid := NULLIF(current_setting('app.membership_id', true), '')::uuid;
  actor_user uuid := NULLIF(current_setting('app.user_id', true), '')::uuid;
  receipt taptime_server.employee_account_invitation_receipts%ROWTYPE;
  binding taptime_server.identity_bindings%ROWTYPE;
  existing taptime_server.memberships%ROWTYPE;
  new_user uuid := gen_random_uuid();
  new_membership uuid := gen_random_uuid();
BEGIN
  IF current_setting('role', true) IS DISTINCT FROM 'taptime_membership_manager'
    OR org IS NULL OR actor IS NULL OR actor_user IS NULL
    OR requested_command_id IS NULL
    OR NULLIF(current_setting('app.correlation_id', true), '') IS DISTINCT FROM requested_command_id::text
    OR requested_hash IS NULL OR octet_length(requested_hash) <> 32
    OR requested_email_hash IS NULL OR octet_length(requested_email_hash) <> 32
    OR requested_name IS NULL
    OR taptime_server.normalize_membership_display_name_v1(requested_name) IS DISTINCT FROM requested_name
    OR verified_issuer IS NULL OR length(verified_issuer) = 0
    OR account_was_invited IS NULL
  THEN RETURN QUERY SELECT 'invalid_request', NULL::uuid, NULL::uuid, NULL::uuid; RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM taptime_server.has_membership_management_authority_v1(
    org, actor_user, actor, 'invite', NULL, 'employee', requested_location_id
  )) THEN RETURN QUERY SELECT 'forbidden', NULL::uuid, NULL::uuid, NULL::uuid; RETURN; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('taptime:account-command:' || org::text || ':' || requested_command_id::text, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended('taptime:account-email:' || encode(requested_email_hash, 'hex'), 0));
  SELECT r.* INTO receipt FROM taptime_server.employee_account_invitation_receipts r
    WHERE r.organization_id = org AND r.command_id = requested_command_id;
  IF FOUND THEN
    IF receipt.actor_membership_id = actor AND receipt.request_hash = requested_hash THEN
      RETURN QUERY SELECT receipt.result_status, org, actor, receipt.membership_id;
    ELSE RETURN QUERY SELECT 'command_id_conflict', org, actor, NULL::uuid; END IF;
    RETURN;
  END IF;
  IF verified_subject IS NULL THEN
    RETURN QUERY SELECT 'prepared', org, actor, NULL::uuid; RETURN;
  END IF;
  IF length(verified_subject) = 0 THEN
    RETURN QUERY SELECT 'invalid_request', org, actor, NULL::uuid; RETURN;
  END IF;

  SELECT b.* INTO binding FROM taptime_server.identity_bindings b
    WHERE b.issuer = verified_issuer AND b.subject = verified_subject FOR SHARE;
  IF FOUND THEN
    SELECT m.* INTO existing FROM taptime_server.memberships m
      WHERE m.user_id = binding.user_id AND m.organization_id = org FOR SHARE;
    IF FOUND THEN
      IF NOT EXISTS (SELECT 1 FROM taptime_server.has_membership_management_authority_v1(
          org, actor_user, actor, 'read', NULL, NULL, NULL
        ) scope WHERE scope.scope_kind = 'organization' OR EXISTS (
          SELECT 1 FROM taptime_server.membership_home_location_assignments home
          WHERE home.organization_id = org AND home.membership_id = existing.id
            AND home.location_id = scope.location_id AND home.revoked_at IS NULL
        )) THEN
        RETURN QUERY SELECT 'outside_management_scope', org, actor, NULL::uuid; RETURN;
      END IF;
      RETURN QUERY SELECT CASE WHEN existing.revoked_at IS NULL THEN 'membership_exists'
        ELSE 'former_membership' END, org, actor, NULL::uuid;
    ELSIF EXISTS (SELECT 1 FROM taptime_server.memberships m
      WHERE m.user_id = binding.user_id AND m.organization_id <> org) THEN
      RETURN QUERY SELECT 'email_exists', org, actor, NULL::uuid;
    ELSE
      -- An existing binding without a membership needs investigation, never reassignment.
      RETURN QUERY SELECT 'invitation_needs_attention', org, actor, NULL::uuid;
    END IF;
    RETURN;
  END IF;

  IF account_from_invitation IS DISTINCT FROM true THEN
    RETURN QUERY SELECT 'account_not_invited', org, actor, NULL::uuid; RETURN;
  END IF;

  INSERT INTO taptime_server.users (id) VALUES (new_user);
  INSERT INTO taptime_server.identity_bindings (id, user_id, issuer, subject)
    VALUES (gen_random_uuid(), new_user, verified_issuer, verified_subject);
  INSERT INTO taptime_server.memberships (id, organization_id, user_id, role, created_by_user_id, display_name)
    VALUES (new_membership, org, new_user, 'employee', actor_user, requested_name);
  IF requested_location_id IS NOT NULL THEN
    INSERT INTO taptime_server.membership_home_location_assignments (id, organization_id, membership_id, location_id)
      VALUES (gen_random_uuid(), org, new_membership, requested_location_id);
  END IF;
  INSERT INTO taptime_server.employee_account_invitation_receipts
    (organization_id, command_id, actor_membership_id, request_hash, membership_id, result_status)
    VALUES (org, requested_command_id, actor, requested_hash, new_membership,
      CASE WHEN account_was_invited THEN 'succeeded' ELSE 'succeeded_existing_account' END);
  RETURN QUERY SELECT CASE WHEN account_was_invited THEN 'succeeded' ELSE 'succeeded_existing_account' END,
    org, actor, new_membership;
END
$account$;
ALTER FUNCTION taptime_server.employee_account_invitation_v2(uuid, bytea, bytea, text, uuid, text, text, boolean, boolean)
  OWNER TO taptime_employee_redemption_data_function_owner;
REVOKE ALL ON FUNCTION taptime_server.employee_account_invitation_v2(uuid, bytea, bytea, text, uuid, text, text, boolean, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.employee_account_invitation_v2(uuid, bytea, bytea, text, uuid, text, text, boolean, boolean)
  TO taptime_membership_manager;

-- Created by an authorized resend request, append-only; removal follows membership-data retention in T-016.
CREATE TABLE taptime_server.account_invitation_resend_audit (
  organization_id uuid NOT NULL,
  command_id uuid NOT NULL,
  actor_membership_id uuid NOT NULL,
  target_membership_id uuid NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (organization_id, command_id),
  FOREIGN KEY (organization_id, actor_membership_id) REFERENCES taptime_server.memberships(organization_id,id),
  FOREIGN KEY (organization_id, target_membership_id) REFERENCES taptime_server.memberships(organization_id,id)
);
ALTER TABLE taptime_server.account_invitation_resend_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.account_invitation_resend_audit FORCE ROW LEVEL SECURITY;
REVOKE ALL ON taptime_server.account_invitation_resend_audit FROM PUBLIC;
GRANT SELECT, INSERT ON taptime_server.account_invitation_resend_audit TO taptime_employee_redemption_data_function_owner;

CREATE FUNCTION taptime_server.reserve_account_invitation_resend_v1(command uuid, target uuid, requested_issuer text)
RETURNS TABLE(result_status text, subject text, organization_id uuid, actor_membership_id uuid)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE
  org uuid := NULLIF(current_setting('app.organization_id',true),'')::uuid;
  actor uuid := NULLIF(current_setting('app.membership_id',true),'')::uuid;
  person uuid := NULLIF(current_setting('app.user_id',true),'')::uuid;
  account text;
BEGIN
  IF current_setting('role',true) IS DISTINCT FROM 'taptime_membership_manager'
    OR command IS NULL OR target IS NULL OR requested_issuer IS NULL
    OR NULLIF(current_setting('app.correlation_id',true),'') IS DISTINCT FROM command::text THEN
    RETURN QUERY SELECT 'invalid_request',NULL::text,NULL::uuid,NULL::uuid; RETURN;
  END IF;
  -- The current read scope, never the client-supplied person, authorizes this operation.
  IF NOT EXISTS (
    SELECT 1 FROM taptime_server.memberships m
    JOIN taptime_server.has_membership_management_authority_v1(org,person,actor,'read',NULL,NULL,NULL) scope
      ON scope.scope_kind='organization' OR EXISTS (
        SELECT 1 FROM taptime_server.membership_home_location_assignments home
        WHERE home.organization_id=org AND home.membership_id=m.id
          AND home.location_id=scope.location_id AND home.revoked_at IS NULL)
    WHERE m.organization_id=org AND m.id=target AND m.revoked_at IS NULL
  ) THEN RETURN QUERY SELECT 'forbidden',NULL::text,NULL::uuid,NULL::uuid; RETURN; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('taptime:resend:'||org::text||':'||target::text,0));
  SELECT b.subject INTO account FROM taptime_server.identity_bindings b
    JOIN taptime_server.memberships m ON m.user_id=b.user_id
    WHERE m.organization_id=org AND m.id=target AND m.revoked_at IS NULL
      AND b.issuer=requested_issuer AND b.revoked_at IS NULL FOR SHARE OF m,b;
  IF NOT FOUND THEN RETURN QUERY SELECT 'invitation_needs_attention',NULL::text,org,actor; RETURN; END IF;
  IF EXISTS(SELECT 1 FROM taptime_server.account_invitation_resend_audit a
    WHERE a.organization_id=org AND (a.command_id=command OR (a.target_membership_id=target
      AND a.requested_at>clock_timestamp()-interval '10 minutes'))) THEN
    RETURN QUERY SELECT 'invitation_rate_limited',NULL::text,org,actor; RETURN;
  END IF;
  INSERT INTO taptime_server.account_invitation_resend_audit(organization_id,command_id,actor_membership_id,target_membership_id)
    VALUES(org,command,actor,target);
  RETURN QUERY SELECT 'reserved',account,org,actor;
END $$;
ALTER FUNCTION taptime_server.reserve_account_invitation_resend_v1(uuid,uuid,text) OWNER TO taptime_employee_redemption_data_function_owner;
REVOKE ALL ON FUNCTION taptime_server.reserve_account_invitation_resend_v1(uuid,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.reserve_account_invitation_resend_v1(uuid,uuid,text) TO taptime_membership_manager;
CREATE FUNCTION taptime_server.operator_create_organization_v2(command uuid,requested_name text,email_hash bytea,verified_issuer text,verified_subject text, account_was_invited boolean)
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
  result := jsonb_build_object('status','succeeded','organization_id',org,'invitation_status',CASE WHEN account_was_invited THEN 'succeeded' ELSE 'succeeded_existing_account' END);
  INSERT INTO taptime_server.platform_command_receipts(command_id,operator_id,request_hash,result) VALUES(command,actor,fingerprint,result);
  INSERT INTO taptime_server.platform_audit_events(operator_id,operator_principal,organization_id,command_id,action)
    VALUES(actor,'operator',org,command,'organization_created');
  RETURN result;
END $$;

ALTER FUNCTION taptime_server.operator_create_organization_v2(uuid,text,bytea,text,text,boolean) OWNER TO taptime_platform_operator_owner;
REVOKE ALL ON FUNCTION taptime_server.operator_create_organization_v2(uuid,text,bytea,text,text,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.operator_create_organization_v2(uuid,text,bytea,text,text,boolean) TO taptime_platform_operator;

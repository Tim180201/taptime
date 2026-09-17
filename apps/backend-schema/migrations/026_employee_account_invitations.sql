-- Created by the invitation operation; immutable receipts make retries mail-free.
-- Membership revocation uses the existing management path; retention/deletion is T-016.
CREATE TABLE taptime_server.employee_account_invitation_receipts (
  organization_id uuid NOT NULL,
  command_id uuid NOT NULL,
  actor_membership_id uuid NOT NULL,
  request_hash bytea NOT NULL CHECK (octet_length(request_hash) = 32),
  membership_id uuid NOT NULL,
  result_status text NOT NULL CHECK (result_status IN ('succeeded', 'succeeded_existing_account')),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (organization_id, command_id),
  FOREIGN KEY (organization_id, actor_membership_id)
    REFERENCES taptime_server.memberships (organization_id, id),
  FOREIGN KEY (organization_id, membership_id)
    REFERENCES taptime_server.memberships (organization_id, id)
);
ALTER TABLE taptime_server.employee_account_invitation_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.employee_account_invitation_receipts FORCE ROW LEVEL SECURITY;
REVOKE ALL ON taptime_server.employee_account_invitation_receipts FROM PUBLIC;
GRANT SELECT, INSERT ON taptime_server.employee_account_invitation_receipts
  TO taptime_employee_redemption_data_function_owner;

-- Three phases in ONE caller transaction: authorize/lock, classify an existing identity,
-- or insert a new identity + membership + location + retry receipt. No email is stored.
CREATE FUNCTION taptime_server.employee_account_invitation_v1(
  requested_command_id uuid, requested_hash bytea, requested_email_hash bytea,
  requested_name text, requested_location_id uuid, verified_issuer text,
  verified_subject text, account_was_invited boolean
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
        RETURN QUERY SELECT 'forbidden', org, actor, NULL::uuid; RETURN;
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
ALTER FUNCTION taptime_server.employee_account_invitation_v1(uuid, bytea, bytea, text, uuid, text, text, boolean)
  OWNER TO taptime_employee_redemption_data_function_owner;
REVOKE ALL ON FUNCTION taptime_server.employee_account_invitation_v1(uuid, bytea, bytea, text, uuid, text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.employee_account_invitation_v1(uuid, bytea, bytea, text, uuid, text, text, boolean)
  TO taptime_membership_manager;

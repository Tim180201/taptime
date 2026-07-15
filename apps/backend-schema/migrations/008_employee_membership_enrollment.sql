DO $roles$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'taptime_employee_invitation_creator'
  ) THEN
    CREATE ROLE taptime_employee_invitation_creator
      NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'taptime_employee_enrollment_redeemer'
  ) THEN
    CREATE ROLE taptime_employee_enrollment_redeemer
      NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles
    WHERE rolname = 'taptime_employee_invitation_function_owner'
  ) THEN
    CREATE ROLE taptime_employee_invitation_function_owner
      NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT BYPASSRLS;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles
    WHERE rolname = 'taptime_employee_invitation_data_function_owner'
  ) THEN
    CREATE ROLE taptime_employee_invitation_data_function_owner
      NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT BYPASSRLS;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles
    WHERE rolname = 'taptime_employee_redemption_function_owner'
  ) THEN
    CREATE ROLE taptime_employee_redemption_function_owner
      NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT BYPASSRLS;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles
    WHERE rolname = 'taptime_employee_redemption_data_function_owner'
  ) THEN
    CREATE ROLE taptime_employee_redemption_data_function_owner
      NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT BYPASSRLS;
  END IF;
END
$roles$;

ALTER ROLE taptime_employee_invitation_creator WITH
  NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
ALTER ROLE taptime_employee_enrollment_redeemer WITH
  NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
ALTER ROLE taptime_employee_invitation_function_owner WITH
  NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION BYPASSRLS;
ALTER ROLE taptime_employee_invitation_data_function_owner WITH
  NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION BYPASSRLS;
ALTER ROLE taptime_employee_redemption_function_owner WITH
  NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION BYPASSRLS;
ALTER ROLE taptime_employee_redemption_data_function_owner WITH
  NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION BYPASSRLS;

DO $normalize_role_graph$
DECLARE
  role_name text;
  role_oid oid;
  database_oid oid := (
    SELECT database.oid FROM pg_catalog.pg_database AS database
    WHERE database.datname = pg_catalog.current_database()
  );
  parent_name text;
  member_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY[
    'taptime_employee_invitation_creator',
    'taptime_employee_enrollment_redeemer',
    'taptime_employee_invitation_function_owner',
    'taptime_employee_invitation_data_function_owner',
    'taptime_employee_redemption_function_owner',
    'taptime_employee_redemption_data_function_owner'
  ]
  LOOP
    SELECT role.oid INTO STRICT role_oid
    FROM pg_catalog.pg_roles AS role WHERE role.rolname = role_name;
    FOR parent_name IN
      SELECT parent.rolname
      FROM pg_catalog.pg_auth_members AS edge
      INNER JOIN pg_catalog.pg_roles AS member ON member.oid = edge.member
      INNER JOIN pg_catalog.pg_roles AS parent ON parent.oid = edge.roleid
      WHERE member.rolname = role_name
    LOOP
      EXECUTE pg_catalog.format('REVOKE %I FROM %I', parent_name, role_name);
    END LOOP;
    FOR member_name IN
      SELECT member.rolname
      FROM pg_catalog.pg_auth_members AS edge
      INNER JOIN pg_catalog.pg_roles AS member ON member.oid = edge.member
      INNER JOIN pg_catalog.pg_roles AS parent ON parent.oid = edge.roleid
      WHERE parent.rolname = role_name
    LOOP
      EXECUTE pg_catalog.format('REVOKE %I FROM %I', role_name, member_name);
    END LOOP;
    IF EXISTS (
      SELECT 1 FROM pg_catalog.pg_shdepend AS dependency
      WHERE dependency.refclassid = 'pg_catalog.pg_authid'::pg_catalog.regclass
        AND dependency.refobjid = role_oid
        AND dependency.dbid IN (0, database_oid)
    ) OR EXISTS (
      SELECT 1 FROM pg_catalog.pg_db_role_setting AS role_setting
      WHERE role_setting.setrole = role_oid
        AND role_setting.setdatabase IN (0, database_oid)
    ) THEN
      RAISE EXCEPTION 'C3E1 roles must have no pre-existing ownership, ACL, policy, default-ACL, role-setting or shared-object dependency in this database'
        USING ERRCODE = '42501';
    END IF;
  END LOOP;
END
$normalize_role_graph$;

CREATE FUNCTION taptime_server.normalize_membership_display_name_v1(requested_name text)
RETURNS text
LANGUAGE sql
STABLE
PARALLEL SAFE
SET search_path = pg_catalog
AS $name$
  SELECT taptime_server.normalize_taptime_name_v1(requested_name, 'customer')
$name$;

REVOKE ALL ON FUNCTION taptime_server.normalize_membership_display_name_v1(text) FROM PUBLIC;

ALTER TABLE taptime_server.memberships
  ADD COLUMN display_name text,
  ADD CONSTRAINT memberships_display_name_v1 CHECK (
    display_name IS NULL
    OR (
      taptime_server.normalize_membership_display_name_v1(display_name) IS NOT NULL
      AND display_name = taptime_server.normalize_membership_display_name_v1(display_name)
    )
  );

CREATE FUNCTION taptime_server.enforce_membership_display_name_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $guard$
BEGIN
  IF NEW.display_name IS DISTINCT FROM OLD.display_name THEN
    RAISE EXCEPTION 'Membership display name is immutable in C3E1' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$guard$;

REVOKE ALL ON FUNCTION taptime_server.enforce_membership_display_name_immutable() FROM PUBLIC;

CREATE TRIGGER memberships_display_name_immutable
  BEFORE UPDATE ON taptime_server.memberships
  FOR EACH ROW EXECUTE FUNCTION taptime_server.enforce_membership_display_name_immutable();

CREATE TABLE taptime_server.employee_membership_invitations (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES taptime_server.organizations (id),
  creator_user_id uuid NOT NULL,
  creator_membership_id uuid NOT NULL,
  display_name text NOT NULL,
  token_digest bytea NOT NULL UNIQUE CHECK (pg_catalog.octet_length(token_digest) = 32),
  created_at timestamptz NOT NULL DEFAULT pg_catalog.transaction_timestamp(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  consumed_identity_binding_id uuid,
  consumed_user_id uuid,
  consumed_membership_id uuid,
  redemption_command_id uuid,
  row_version bigint NOT NULL DEFAULT 1 CHECK (row_version > 0),
  CONSTRAINT employee_invitations_creator_fk FOREIGN KEY (
    organization_id, creator_user_id, creator_membership_id
  ) REFERENCES taptime_server.memberships (organization_id, user_id, id),
  CONSTRAINT employee_invitations_name_v1 CHECK (
    display_name = taptime_server.normalize_membership_display_name_v1(display_name)
  ),
  CONSTRAINT employee_invitations_expiry_order CHECK (expires_at > created_at),
  CONSTRAINT employee_invitations_consumption_order CHECK (
    consumed_at IS NULL OR (consumed_at >= created_at AND consumed_at <= expires_at)
  ),
  CONSTRAINT employee_invitations_consumption_shape CHECK (
    (consumed_at IS NULL
      AND consumed_identity_binding_id IS NULL
      AND consumed_user_id IS NULL
      AND consumed_membership_id IS NULL
      AND redemption_command_id IS NULL)
    OR
    (consumed_at IS NOT NULL
      AND consumed_identity_binding_id IS NOT NULL
      AND consumed_user_id IS NOT NULL
      AND consumed_membership_id IS NOT NULL
      AND redemption_command_id IS NOT NULL)
  ),
  CONSTRAINT employee_invitations_binding_fk FOREIGN KEY (
    consumed_identity_binding_id, consumed_user_id
  ) REFERENCES taptime_server.identity_bindings (id, user_id),
  CONSTRAINT employee_invitations_membership_fk FOREIGN KEY (
    organization_id, consumed_user_id, consumed_membership_id
  ) REFERENCES taptime_server.memberships (organization_id, user_id, id)
);

ALTER TABLE taptime_server.employee_membership_invitations
  ADD CONSTRAINT employee_invitations_tenant_id_unique UNIQUE (organization_id, id);

CREATE INDEX employee_invitations_active_by_organization
  ON taptime_server.employee_membership_invitations (organization_id, expires_at, id)
  WHERE consumed_at IS NULL;

CREATE TABLE taptime_server.employee_invitation_command_receipts (
  organization_id uuid NOT NULL REFERENCES taptime_server.organizations (id),
  command_id uuid NOT NULL,
  actor_user_id uuid NOT NULL,
  membership_id uuid NOT NULL,
  request_hash_version smallint NOT NULL CHECK (request_hash_version = 1),
  request_hash bytea NOT NULL CHECK (pg_catalog.octet_length(request_hash) = 32),
  invitation_id uuid NOT NULL REFERENCES taptime_server.employee_membership_invitations (id),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.transaction_timestamp(),
  PRIMARY KEY (organization_id, command_id),
  CONSTRAINT employee_invitation_receipts_actor_fk FOREIGN KEY (
    organization_id, actor_user_id, membership_id
  ) REFERENCES taptime_server.memberships (organization_id, user_id, id),
  CONSTRAINT employee_invitation_receipts_invitation_tenant_fk FOREIGN KEY (
    organization_id, invitation_id
  ) REFERENCES taptime_server.employee_membership_invitations (organization_id, id)
);

CREATE TABLE taptime_server.employee_enrollment_redemption_receipts (
  command_id uuid PRIMARY KEY,
  invitation_id uuid NOT NULL UNIQUE REFERENCES taptime_server.employee_membership_invitations (id),
  organization_id uuid NOT NULL,
  actor_user_id uuid NOT NULL,
  actor_membership_id uuid NOT NULL,
  identity_binding_id uuid NOT NULL,
  user_id uuid NOT NULL,
  membership_id uuid NOT NULL,
  token_digest bytea NOT NULL CHECK (pg_catalog.octet_length(token_digest) = 32),
  created_at timestamptz NOT NULL DEFAULT pg_catalog.transaction_timestamp(),
  CONSTRAINT employee_redemption_receipts_actor_fk FOREIGN KEY (
    organization_id, actor_user_id, actor_membership_id
  ) REFERENCES taptime_server.memberships (organization_id, user_id, id),
  CONSTRAINT employee_redemption_receipts_binding_fk FOREIGN KEY (
    identity_binding_id, user_id
  ) REFERENCES taptime_server.identity_bindings (id, user_id),
  CONSTRAINT employee_redemption_receipts_membership_fk FOREIGN KEY (
    organization_id, user_id, membership_id
  ) REFERENCES taptime_server.memberships (organization_id, user_id, id),
  CONSTRAINT employee_redemption_receipts_invitation_fk FOREIGN KEY (
    organization_id, invitation_id
  ) REFERENCES taptime_server.employee_membership_invitations (organization_id, id)
);

ALTER TABLE taptime_server.employee_membership_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.employee_membership_invitations FORCE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.employee_invitation_command_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.employee_invitation_command_receipts FORCE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.employee_enrollment_redemption_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.employee_enrollment_redemption_receipts FORCE ROW LEVEL SECURITY;

CREATE FUNCTION taptime_server.enforce_employee_invitation_consumption_shape()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $guard$
BEGIN
  IF TG_OP = 'DELETE'
    OR pg_catalog.current_setting('role', true) <> 'taptime_employee_enrollment_redeemer'
    OR OLD.consumed_at IS NOT NULL
    OR NEW.id <> OLD.id
    OR NEW.organization_id <> OLD.organization_id
    OR NEW.creator_user_id <> OLD.creator_user_id
    OR NEW.creator_membership_id <> OLD.creator_membership_id
    OR NEW.display_name <> OLD.display_name
    OR NEW.token_digest <> OLD.token_digest
    OR NEW.created_at <> OLD.created_at
    OR NEW.expires_at <> OLD.expires_at
    OR NEW.consumed_at IS NULL
    OR NEW.consumed_identity_binding_id IS NULL
    OR NEW.consumed_user_id IS NULL
    OR NEW.consumed_membership_id IS NULL
    OR NEW.redemption_command_id IS NULL
    OR NEW.row_version <> OLD.row_version + 1
  THEN
    RAISE EXCEPTION 'Invalid Employee invitation mutation' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$guard$;

REVOKE ALL ON FUNCTION taptime_server.enforce_employee_invitation_consumption_shape() FROM PUBLIC;

CREATE TRIGGER employee_invitations_consumption_guard
  BEFORE UPDATE OR DELETE ON taptime_server.employee_membership_invitations
  FOR EACH ROW EXECUTE FUNCTION taptime_server.enforce_employee_invitation_consumption_shape();

CREATE FUNCTION taptime_server.deny_employee_enrollment_receipt_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $guard$
BEGIN
  RAISE EXCEPTION 'Employee enrollment receipts are append-only' USING ERRCODE = '42501';
END
$guard$;

REVOKE ALL ON FUNCTION taptime_server.deny_employee_enrollment_receipt_mutation() FROM PUBLIC;

CREATE TRIGGER employee_invitation_receipts_append_only
  BEFORE UPDATE OR DELETE ON taptime_server.employee_invitation_command_receipts
  FOR EACH ROW EXECUTE FUNCTION taptime_server.deny_employee_enrollment_receipt_mutation();
CREATE TRIGGER employee_redemption_receipts_append_only
  BEFORE UPDATE OR DELETE ON taptime_server.employee_enrollment_redemption_receipts
  FOR EACH ROW EXECUTE FUNCTION taptime_server.deny_employee_enrollment_receipt_mutation();

CREATE OR REPLACE FUNCTION taptime_server.append_administrative_audit_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, taptime_server
AS $audit$
DECLARE
  audit_organization_id uuid;
  audit_entity_id uuid;
  audit_event_type text;
  audit_entity_type text;
  audit_payload jsonb;
  audit_correlation_id text;
  selected_role text := current_setting('role', true);
BEGIN
  IF selected_role NOT IN (
    'taptime_administrator',
    'taptime_admin_setup',
    'taptime_employee_invitation_creator',
    'taptime_employee_enrollment_redeemer'
  ) THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF selected_role = 'taptime_admin_setup' AND NOT (
    TG_OP = 'INSERT' AND TG_TABLE_NAME IN ('customers', 'nfc_tags', 'nfc_assignments')
  ) THEN
    RAISE EXCEPTION 'Setup operation is not audit-allowlisted: %.%', TG_TABLE_NAME, TG_OP
      USING ERRCODE = '42501';
  END IF;
  IF selected_role = 'taptime_employee_invitation_creator' AND NOT (
    TG_OP = 'INSERT' AND TG_TABLE_NAME = 'employee_membership_invitations'
  ) THEN
    RAISE EXCEPTION 'Invitation operation is not audit-allowlisted: %.%', TG_TABLE_NAME, TG_OP
      USING ERRCODE = '42501';
  END IF;
  IF selected_role = 'taptime_employee_enrollment_redeemer' THEN
    IF TG_OP <> 'INSERT' OR TG_TABLE_NAME <> 'memberships' THEN
      RAISE EXCEPTION 'Redemption operation is not audit-allowlisted: %.%', TG_TABLE_NAME, TG_OP
        USING ERRCODE = '42501';
    END IF;
    IF NEW.role <> 'employee' THEN
      RAISE EXCEPTION 'Redemption Membership role is not audit-allowlisted'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF TG_TABLE_NAME = 'organizations' THEN
    audit_organization_id := NEW.id;
  ELSE
    audit_organization_id := CASE
      WHEN TG_OP = 'DELETE' THEN OLD.organization_id
      ELSE NEW.organization_id
    END;
  END IF;
  audit_entity_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END;
  audit_correlation_id := NULLIF(current_setting('app.correlation_id', true), '');
  IF audit_correlation_id IS NULL THEN
    RAISE EXCEPTION 'Administrative audit correlation context is required' USING ERRCODE = '42501';
  END IF;
  IF selected_role IN (
    'taptime_admin_setup',
    'taptime_employee_invitation_creator',
    'taptime_employee_enrollment_redeemer'
  ) AND audit_correlation_id COLLATE "C"
    !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  THEN
    RAISE EXCEPTION 'Administrative audit correlation must be a canonical UUID'
      USING ERRCODE = '42501';
  END IF;

  IF selected_role = 'taptime_employee_invitation_creator' THEN
    IF NEW.creator_user_id <> taptime_server.current_user_id() THEN
      RAISE EXCEPTION 'Invitation audit actor mismatch' USING ERRCODE = '42501';
    END IF;
    audit_event_type := 'EmployeeMembershipInvitationCreated';
    audit_entity_type := 'EmployeeMembershipInvitation';
    audit_payload := pg_catalog.jsonb_build_object(
      'displayName', NEW.display_name,
      'expiresAt', pg_catalog.to_char(NEW.expires_at AT TIME ZONE 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    );
  ELSIF selected_role = 'taptime_employee_enrollment_redeemer' THEN
    IF NEW.created_by_user_id <> taptime_server.current_user_id() THEN
      RAISE EXCEPTION 'Membership grant audit actor mismatch' USING ERRCODE = '42501';
    END IF;
    audit_event_type := 'MembershipGranted';
    audit_entity_type := 'Membership';
    audit_payload := pg_catalog.jsonb_build_object('role', NEW.role);
  ELSIF TG_TABLE_NAME = 'organizations' AND TG_OP = 'UPDATE' THEN
    audit_event_type := 'OrganizationUpdated';
    audit_entity_type := 'Organization';
    audit_payload := pg_catalog.jsonb_build_object(
      'changedFields', pg_catalog.jsonb_build_array('name'), 'rowVersion', NEW.row_version
    );
  ELSIF TG_TABLE_NAME = 'memberships' AND TG_OP = 'INSERT' THEN
    audit_event_type := 'MembershipGranted';
    audit_entity_type := 'Membership';
    audit_payload := pg_catalog.jsonb_build_object('role', NEW.role);
  ELSIF TG_TABLE_NAME = 'memberships' AND TG_OP = 'UPDATE' THEN
    audit_event_type := CASE
      WHEN NEW.revoked_at IS NOT NULL THEN 'MembershipRevoked' ELSE 'MembershipRoleChanged'
    END;
    audit_entity_type := 'Membership';
    audit_payload := pg_catalog.jsonb_build_object(
      'role', NEW.role, 'revoked', NEW.revoked_at IS NOT NULL, 'rowVersion', NEW.row_version
    );
  ELSIF TG_TABLE_NAME = 'customers' THEN
    audit_event_type := CASE TG_OP
      WHEN 'INSERT' THEN 'CustomerCreated'
      WHEN 'UPDATE' THEN 'CustomerDeactivated'
      WHEN 'DELETE' THEN 'CustomerDeleted'
    END;
    audit_entity_type := 'Customer';
    audit_payload := CASE WHEN TG_OP = 'UPDATE'
      THEN pg_catalog.jsonb_build_object('active', NEW.active, 'rowVersion', NEW.row_version)
      ELSE '{}'::jsonb END;
  ELSIF TG_TABLE_NAME = 'nfc_tags' THEN
    audit_event_type := CASE WHEN TG_OP = 'INSERT' THEN 'NfcTagRegistered' ELSE 'NfcTagDeleted' END;
    audit_entity_type := 'NfcTag';
    audit_payload := '{}'::jsonb;
  ELSIF TG_TABLE_NAME = 'nfc_assignments' THEN
    audit_event_type := CASE
      WHEN TG_OP = 'INSERT' THEN 'NfcTagAssigned' ELSE 'NfcAssignmentDeactivated'
    END;
    audit_entity_type := 'NfcAssignment';
    audit_payload := CASE WHEN TG_OP = 'UPDATE'
      THEN pg_catalog.jsonb_build_object('active', NEW.active, 'rowVersion', NEW.row_version)
      ELSE '{}'::jsonb END;
  ELSE
    RAISE EXCEPTION 'Administrative operation is not audit-allowlisted: %.%', TG_TABLE_NAME, TG_OP
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO taptime_server.audit_events (
    id, organization_id, actor_user_id, operator_principal, event_type, entity_type,
    entity_id, occurred_at, correlation_id, payload
  ) VALUES (
    pg_catalog.gen_random_uuid(), audit_organization_id, taptime_server.current_user_id(), NULL,
    audit_event_type, audit_entity_type, audit_entity_id, pg_catalog.transaction_timestamp(),
    audit_correlation_id, audit_payload
  );
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END
$audit$;

CREATE TRIGGER employee_invitations_administrative_audit
  AFTER INSERT ON taptime_server.employee_membership_invitations
  FOR EACH ROW EXECUTE FUNCTION taptime_server.append_administrative_audit_event();

CREATE FUNCTION taptime_server.employee_invitation_request_digest_v1(
  requested_organization_id uuid,
  requested_actor_user_id uuid,
  requested_membership_id uuid,
  canonical_display_name text
)
RETURNS bytea
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog
AS $digest$
  SELECT pg_catalog.sha256(
    pg_catalog.convert_to('taptime:c3e1:invitation-create:v1', 'UTF8')
    || pg_catalog.decode('00', 'hex')
    || pg_catalog.int4send(pg_catalog.octet_length(pg_catalog.convert_to(requested_organization_id::text, 'UTF8')))
    || pg_catalog.convert_to(requested_organization_id::text, 'UTF8')
    || pg_catalog.int4send(pg_catalog.octet_length(pg_catalog.convert_to(requested_actor_user_id::text, 'UTF8')))
    || pg_catalog.convert_to(requested_actor_user_id::text, 'UTF8')
    || pg_catalog.int4send(pg_catalog.octet_length(pg_catalog.convert_to(requested_membership_id::text, 'UTF8')))
    || pg_catalog.convert_to(requested_membership_id::text, 'UTF8')
    || pg_catalog.int4send(pg_catalog.octet_length(pg_catalog.convert_to(canonical_display_name, 'UTF8')))
    || pg_catalog.convert_to(canonical_display_name, 'UTF8')
  )
$digest$;

CREATE FUNCTION taptime_server.create_employee_membership_invitation_data_v1(
  requested_command_id uuid,
  requested_invitation_id uuid,
  requested_display_name text,
  requested_token_digest bytea
)
RETURNS TABLE (result_status text, result_expires_at timestamptz)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, taptime_server
AS $create$
DECLARE
  context_organization_id uuid := NULLIF(pg_catalog.current_setting('app.organization_id', true), '')::uuid;
  context_user_id uuid := NULLIF(pg_catalog.current_setting('app.user_id', true), '')::uuid;
  context_membership_id uuid := NULLIF(pg_catalog.current_setting('app.membership_id', true), '')::uuid;
  canonical_name text;
  request_hash bytea;
  existing_receipt taptime_server.employee_invitation_command_receipts%ROWTYPE;
  invitation_expiry timestamptz;
  active_count integer;
BEGIN
  IF pg_catalog.current_setting('role', true) <> 'taptime_employee_invitation_creator'
    OR requested_command_id IS NULL
    OR requested_invitation_id IS NULL
    OR requested_token_digest IS NULL
    OR pg_catalog.octet_length(requested_token_digest) <> 32
    OR NULLIF(pg_catalog.current_setting('app.correlation_id', true), '') <> requested_command_id::text
  THEN
    RETURN QUERY SELECT 'invalid_request', NULL::timestamptz;
    RETURN;
  END IF;
  canonical_name := taptime_server.normalize_membership_display_name_v1(requested_display_name);
  IF canonical_name IS NULL OR canonical_name <> requested_display_name THEN
    RETURN QUERY SELECT 'invalid_request', NULL::timestamptz;
    RETURN;
  END IF;

  PERFORM 1 FROM taptime_server.memberships AS membership
  WHERE membership.organization_id = context_organization_id
    AND membership.id = context_membership_id
    AND membership.user_id = context_user_id
    AND membership.role = 'administrator'
    AND membership.revoked_at IS NULL
  FOR SHARE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'forbidden', NULL::timestamptz;
    RETURN;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'taptime:c3e1:invitation-create-command:v1:' || context_organization_id::text
      || ':' || requested_command_id::text, 0
  ));
  request_hash := taptime_server.employee_invitation_request_digest_v1(
    context_organization_id, context_user_id, context_membership_id, canonical_name
  );
  SELECT receipt.* INTO existing_receipt
  FROM taptime_server.employee_invitation_command_receipts AS receipt
  WHERE receipt.organization_id = context_organization_id
    AND receipt.command_id = requested_command_id;
  IF FOUND THEN
    IF existing_receipt.actor_user_id = context_user_id
      AND existing_receipt.membership_id = context_membership_id
      AND existing_receipt.request_hash_version = 1
      AND existing_receipt.request_hash = request_hash
    THEN
      RETURN QUERY SELECT 'invitation_created_token_unavailable', existing_receipt.expires_at;
    ELSE
      RETURN QUERY SELECT 'command_id_conflict', NULL::timestamptz;
    END IF;
    RETURN;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'taptime:c3e1:invitation-cap:v1:' || pg_catalog.length(context_organization_id::text)
      || ':' || context_organization_id::text, 0
  ));
  SELECT pg_catalog.count(*)::integer INTO active_count
  FROM taptime_server.employee_membership_invitations AS invitation
  WHERE invitation.organization_id = context_organization_id
    AND invitation.consumed_at IS NULL
    AND invitation.expires_at > pg_catalog.transaction_timestamp();
  IF active_count >= 5 THEN
    RETURN QUERY SELECT 'invitation_limit_reached', NULL::timestamptz;
    RETURN;
  END IF;

  invitation_expiry := pg_catalog.transaction_timestamp() + interval '15 minutes';
  INSERT INTO taptime_server.employee_membership_invitations (
    id, organization_id, creator_user_id, creator_membership_id, display_name,
    token_digest, expires_at
  ) VALUES (
    requested_invitation_id, context_organization_id, context_user_id, context_membership_id,
    canonical_name, requested_token_digest, invitation_expiry
  );
  INSERT INTO taptime_server.employee_invitation_command_receipts (
    organization_id, command_id, actor_user_id, membership_id, request_hash_version,
    request_hash, invitation_id, expires_at
  ) VALUES (
    context_organization_id, requested_command_id, context_user_id, context_membership_id, 1,
    request_hash, requested_invitation_id, invitation_expiry
  );
  RETURN QUERY SELECT 'succeeded', invitation_expiry;
END
$create$;

CREATE FUNCTION taptime_server.create_employee_membership_invitation_v1(
  requested_command_id uuid,
  requested_invitation_id uuid,
  requested_display_name text,
  requested_token_digest bytea
)
RETURNS TABLE (result_status text, result_expires_at timestamptz)
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, taptime_server
AS $entry$
  SELECT * FROM taptime_server.create_employee_membership_invitation_data_v1(
    requested_command_id, requested_invitation_id, requested_display_name, requested_token_digest
  )
$entry$;

CREATE FUNCTION taptime_server.read_employee_memberships_projection_data_v1(
  requested_cursor uuid,
  requested_limit integer
)
RETURNS TABLE (
  organization_id uuid,
  organization_name text,
  membership_id uuid,
  membership_display_name text
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, taptime_server
AS $projection$
DECLARE
  context_organization_id uuid := NULLIF(pg_catalog.current_setting('app.organization_id', true), '')::uuid;
  context_user_id uuid := NULLIF(pg_catalog.current_setting('app.user_id', true), '')::uuid;
  context_membership_id uuid := NULLIF(pg_catalog.current_setting('app.membership_id', true), '')::uuid;
BEGIN
  IF pg_catalog.current_setting('role', true) <> 'taptime_employee_invitation_creator'
    OR requested_limit NOT BETWEEN 1 AND 20
  THEN
    RETURN;
  END IF;
  PERFORM 1 FROM taptime_server.memberships AS membership
  WHERE membership.organization_id = context_organization_id
    AND membership.id = context_membership_id
    AND membership.user_id = context_user_id
    AND membership.role = 'administrator'
    AND membership.revoked_at IS NULL
  FOR SHARE;
  IF NOT FOUND THEN RETURN; END IF;

  RETURN QUERY
  SELECT organization.id, organization.name, page.id, page.display_name
  FROM taptime_server.organizations AS organization
  LEFT JOIN LATERAL (
    SELECT membership.id, membership.display_name
    FROM taptime_server.memberships AS membership
    WHERE membership.organization_id = organization.id
      AND membership.role = 'employee'
      AND membership.revoked_at IS NULL
      AND membership.display_name IS NOT NULL
      AND (requested_cursor IS NULL OR membership.id > requested_cursor)
    ORDER BY membership.id
    LIMIT requested_limit + 1
  ) AS page ON true
  WHERE organization.id = context_organization_id;
END
$projection$;

CREATE FUNCTION taptime_server.read_employee_memberships_projection_v1(
  requested_cursor uuid,
  requested_limit integer
)
RETURNS TABLE (
  organization_id uuid,
  organization_name text,
  membership_id uuid,
  membership_display_name text
)
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, taptime_server
AS $entry$
  SELECT * FROM taptime_server.read_employee_memberships_projection_data_v1(
    requested_cursor, requested_limit
  )
$entry$;

CREATE FUNCTION taptime_server.redeem_employee_membership_invitation_data_v1(
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
BEGIN
  IF pg_catalog.current_setting('role', true) <> 'taptime_employee_enrollment_redeemer'
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
      AND membership.role = 'employee'
      AND membership.revoked_at IS NULL
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
    AND membership.role = 'administrator'
    AND membership.revoked_at IS NULL
  FOR SHARE;
  IF NOT FOUND THEN
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
  ELSIF EXISTS (SELECT 1 FROM taptime_server.users AS app_user WHERE app_user.id = resolved_user_id) THEN
    RAISE EXCEPTION 'Generated C3E1 User ID collision';
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
  PERFORM pg_catalog.set_config('app.membership_role', 'administrator', true);
  PERFORM pg_catalog.set_config('app.correlation_id', requested_command_id::text, true);

  INSERT INTO taptime_server.memberships (
    id, organization_id, user_id, role, created_by_user_id, display_name
  ) VALUES (
    generated_membership_id, invitation.organization_id, resolved_user_id, 'employee',
    invitation.creator_user_id, invitation.display_name
  );
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
    requested_command_id, invitation.id, invitation.organization_id, invitation.creator_user_id,
    invitation.creator_membership_id, resolved_binding_id, resolved_user_id,
    generated_membership_id, requested_token_digest
  );
  SELECT organization.name INTO safe_organization_name
  FROM taptime_server.organizations AS organization
  WHERE organization.id = invitation.organization_id;
  RETURN QUERY SELECT 'succeeded', safe_organization_name, invitation.display_name;
END
$redeem$;

CREATE FUNCTION taptime_server.redeem_employee_membership_invitation_v1(
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
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, taptime_server
AS $entry$
  SELECT * FROM taptime_server.redeem_employee_membership_invitation_data_v1(
    requested_command_id, requested_token_digest, verified_issuer, verified_subject,
    generated_user_id, generated_identity_binding_id, generated_membership_id
  )
$entry$;

ALTER FUNCTION taptime_server.create_employee_membership_invitation_data_v1(
  uuid, uuid, text, bytea
) OWNER TO taptime_employee_invitation_data_function_owner;
ALTER FUNCTION taptime_server.read_employee_memberships_projection_data_v1(uuid, integer)
  OWNER TO taptime_employee_invitation_data_function_owner;
ALTER FUNCTION taptime_server.create_employee_membership_invitation_v1(uuid, uuid, text, bytea)
  OWNER TO taptime_employee_invitation_function_owner;
ALTER FUNCTION taptime_server.read_employee_memberships_projection_v1(uuid, integer)
  OWNER TO taptime_employee_invitation_function_owner;
ALTER FUNCTION taptime_server.redeem_employee_membership_invitation_data_v1(
  uuid, bytea, text, text, uuid, uuid, uuid
) OWNER TO taptime_employee_redemption_data_function_owner;
ALTER FUNCTION taptime_server.redeem_employee_membership_invitation_v1(
  uuid, bytea, text, text, uuid, uuid, uuid
) OWNER TO taptime_employee_redemption_function_owner;
ALTER FUNCTION taptime_server.append_administrative_audit_event()
  OWNER TO taptime_admin_setup_function_owner;

REVOKE ALL ON ALL TABLES IN SCHEMA taptime_server FROM
  taptime_employee_invitation_creator,
  taptime_employee_enrollment_redeemer,
  taptime_employee_invitation_function_owner,
  taptime_employee_invitation_data_function_owner,
  taptime_employee_redemption_function_owner,
  taptime_employee_redemption_data_function_owner;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA taptime_server FROM
  taptime_employee_invitation_creator,
  taptime_employee_enrollment_redeemer,
  taptime_employee_invitation_function_owner,
  taptime_employee_invitation_data_function_owner,
  taptime_employee_redemption_function_owner,
  taptime_employee_redemption_data_function_owner;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA taptime_server FROM
  taptime_employee_invitation_creator,
  taptime_employee_enrollment_redeemer,
  taptime_employee_invitation_function_owner,
  taptime_employee_invitation_data_function_owner,
  taptime_employee_redemption_function_owner,
  taptime_employee_redemption_data_function_owner;
REVOKE ALL ON SCHEMA taptime_server FROM
  taptime_employee_invitation_creator,
  taptime_employee_enrollment_redeemer,
  taptime_employee_invitation_function_owner,
  taptime_employee_invitation_data_function_owner,
  taptime_employee_redemption_function_owner,
  taptime_employee_redemption_data_function_owner;

GRANT USAGE ON SCHEMA taptime_server TO
  taptime_employee_invitation_creator,
  taptime_employee_enrollment_redeemer,
  taptime_employee_invitation_function_owner,
  taptime_employee_invitation_data_function_owner,
  taptime_employee_redemption_function_owner,
  taptime_employee_redemption_data_function_owner;

GRANT SELECT ON taptime_server.organizations,
  taptime_server.memberships,
  taptime_server.employee_membership_invitations,
  taptime_server.employee_invitation_command_receipts
  TO taptime_employee_invitation_data_function_owner;
GRANT INSERT ON taptime_server.employee_membership_invitations,
  taptime_server.employee_invitation_command_receipts
  TO taptime_employee_invitation_data_function_owner;
-- PostgreSQL requires an UPDATE privilege for SELECT ... FOR SHARE. The owner receives only
-- the optimistic-lock column; the runtime role has no table privilege and cannot SET this owner.
GRANT UPDATE (row_version) ON taptime_server.memberships
  TO taptime_employee_invitation_data_function_owner;
GRANT EXECUTE ON FUNCTION taptime_server.normalize_membership_display_name_v1(text),
  taptime_server.employee_invitation_request_digest_v1(uuid, uuid, uuid, text),
  taptime_server.normalize_taptime_name_v1(text, text)
  TO taptime_employee_invitation_data_function_owner;
GRANT EXECUTE ON FUNCTION taptime_server.create_employee_membership_invitation_data_v1(
  uuid, uuid, text, bytea
), taptime_server.read_employee_memberships_projection_data_v1(uuid, integer)
  TO taptime_employee_invitation_function_owner;
GRANT EXECUTE ON FUNCTION taptime_server.create_employee_membership_invitation_v1(
  uuid, uuid, text, bytea
), taptime_server.read_employee_memberships_projection_v1(uuid, integer)
  TO taptime_employee_invitation_creator;

GRANT SELECT ON taptime_server.organizations,
  taptime_server.users,
  taptime_server.identity_bindings,
  taptime_server.memberships,
  taptime_server.employee_membership_invitations,
  taptime_server.employee_enrollment_redemption_receipts
  TO taptime_employee_redemption_data_function_owner;
GRANT INSERT ON taptime_server.users,
  taptime_server.identity_bindings,
  taptime_server.memberships,
  taptime_server.employee_enrollment_redemption_receipts
  TO taptime_employee_redemption_data_function_owner;
GRANT UPDATE (row_version) ON taptime_server.memberships
  TO taptime_employee_redemption_data_function_owner;
GRANT UPDATE (revoked_at) ON taptime_server.identity_bindings
  TO taptime_employee_redemption_data_function_owner;
GRANT UPDATE (created_at) ON taptime_server.users
  TO taptime_employee_redemption_data_function_owner;
GRANT UPDATE (
  consumed_at, consumed_identity_binding_id, consumed_user_id, consumed_membership_id,
  redemption_command_id, row_version
) ON taptime_server.employee_membership_invitations
  TO taptime_employee_redemption_data_function_owner;
GRANT EXECUTE ON FUNCTION taptime_server.redeem_employee_membership_invitation_data_v1(
  uuid, bytea, text, text, uuid, uuid, uuid
) TO taptime_employee_redemption_function_owner;
GRANT EXECUTE ON FUNCTION taptime_server.normalize_membership_display_name_v1(text),
  taptime_server.normalize_taptime_name_v1(text, text)
  TO taptime_employee_redemption_data_function_owner;
GRANT EXECUTE ON FUNCTION taptime_server.redeem_employee_membership_invitation_v1(
  uuid, bytea, text, text, uuid, uuid, uuid
) TO taptime_employee_enrollment_redeemer;

REVOKE ALL ON FUNCTION taptime_server.normalize_membership_display_name_v1(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION taptime_server.employee_invitation_request_digest_v1(
  uuid, uuid, uuid, text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION taptime_server.create_employee_membership_invitation_data_v1(
  uuid, uuid, text, bytea
) FROM PUBLIC;
REVOKE ALL ON FUNCTION taptime_server.create_employee_membership_invitation_v1(
  uuid, uuid, text, bytea
) FROM PUBLIC;
REVOKE ALL ON FUNCTION taptime_server.read_employee_memberships_projection_data_v1(uuid, integer)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION taptime_server.read_employee_memberships_projection_v1(uuid, integer)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION taptime_server.redeem_employee_membership_invitation_data_v1(
  uuid, bytea, text, text, uuid, uuid, uuid
) FROM PUBLIC;
REVOKE ALL ON FUNCTION taptime_server.redeem_employee_membership_invitation_v1(
  uuid, bytea, text, text, uuid, uuid, uuid
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION taptime_server.normalize_membership_display_name_v1(text)
  TO taptime_administrator, taptime_bootstrap_function_owner;

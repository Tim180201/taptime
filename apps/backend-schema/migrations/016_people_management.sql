DO $roles$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'taptime_membership_manager'
  ) THEN
    CREATE ROLE taptime_membership_manager
      NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles
    WHERE rolname = 'taptime_membership_management_function_owner'
  ) THEN
    CREATE ROLE taptime_membership_management_function_owner
      NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT BYPASSRLS;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles
    WHERE rolname = 'taptime_membership_enrollment_redeemer'
  ) THEN
    CREATE ROLE taptime_membership_enrollment_redeemer
      NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles
    WHERE rolname = 'taptime_membership_redemption_function_owner'
  ) THEN
    CREATE ROLE taptime_membership_redemption_function_owner
      NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT BYPASSRLS;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles
    WHERE rolname = 'taptime_people_audit_function_owner'
  ) THEN
    CREATE ROLE taptime_people_audit_function_owner
      NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT BYPASSRLS;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles
    WHERE rolname = 'taptime_password_reset_auditor'
  ) THEN
    CREATE ROLE taptime_password_reset_auditor
      NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
END
$roles$;

ALTER ROLE taptime_membership_manager WITH
  NOLOGIN NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
ALTER ROLE taptime_membership_management_function_owner WITH
  NOLOGIN NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION BYPASSRLS;
ALTER ROLE taptime_membership_enrollment_redeemer WITH
  NOLOGIN NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
ALTER ROLE taptime_membership_redemption_function_owner WITH
  NOLOGIN NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION BYPASSRLS;
ALTER ROLE taptime_people_audit_function_owner WITH
  NOLOGIN NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION BYPASSRLS;
ALTER ROLE taptime_password_reset_auditor WITH
  NOLOGIN NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;

DO $verify_no_superuser$
DECLARE
  offending text;
BEGIN
  SELECT pg_catalog.string_agg(rolname, ', ' ORDER BY rolname) INTO offending
  FROM pg_catalog.pg_roles
  WHERE rolname IN (
    'taptime_membership_manager',
    'taptime_membership_management_function_owner',
    'taptime_membership_enrollment_redeemer',
    'taptime_membership_redemption_function_owner',
    'taptime_people_audit_function_owner',
    'taptime_password_reset_auditor'
  ) AND rolsuper;
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'TapTime people-management roles must not be SUPERUSER: %', offending;
  END IF;
END
$verify_no_superuser$;

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
    'taptime_membership_manager',
    'taptime_membership_management_function_owner',
    'taptime_membership_enrollment_redeemer',
    'taptime_membership_redemption_function_owner',
    'taptime_people_audit_function_owner',
    'taptime_password_reset_auditor'
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
      RAISE EXCEPTION 'T-009 roles must have no pre-existing ownership, ACL, policy, default-ACL, role-setting or shared-object dependency in this database'
        USING ERRCODE = '42501';
    END IF;
  END LOOP;
END
$normalize_role_graph$;

-- Upgrade every existing runtime login that still carries the v1 capability. This runs inside
-- the schema migration, so an existing production volume does not depend on init SQL rerunning.
DO $upgrade_runtime_logins$
DECLARE
  login_name text;
BEGIN
  FOR login_name IN
    SELECT member.rolname
    FROM pg_catalog.pg_auth_members AS edge
    INNER JOIN pg_catalog.pg_roles AS parent ON parent.oid = edge.roleid
    INNER JOIN pg_catalog.pg_roles AS member ON member.oid = edge.member
    WHERE parent.rolname = 'taptime_employee_invitation_creator' AND member.rolcanlogin
  LOOP
    EXECUTE pg_catalog.format(
      'GRANT taptime_membership_manager, taptime_password_reset_auditor TO %I WITH INHERIT FALSE, SET TRUE, ADMIN FALSE',
      login_name
    );
    EXECUTE pg_catalog.format('REVOKE taptime_employee_invitation_creator FROM %I', login_name);
  END LOOP;
  FOR login_name IN
    SELECT member.rolname
    FROM pg_catalog.pg_auth_members AS edge
    INNER JOIN pg_catalog.pg_roles AS parent ON parent.oid = edge.roleid
    INNER JOIN pg_catalog.pg_roles AS member ON member.oid = edge.member
    WHERE parent.rolname = 'taptime_employee_enrollment_redeemer' AND member.rolcanlogin
  LOOP
    EXECUTE pg_catalog.format(
      'GRANT taptime_membership_enrollment_redeemer TO %I WITH INHERIT FALSE, SET TRUE, ADMIN FALSE',
      login_name
    );
    EXECUTE pg_catalog.format('REVOKE taptime_employee_enrollment_redeemer FROM %I', login_name);
  END LOOP;
END
$upgrade_runtime_logins$;

ALTER TABLE taptime_server.employee_membership_invitations
  ADD COLUMN membership_role text NOT NULL DEFAULT 'employee'
  CONSTRAINT employee_invitations_membership_role_v1
    CHECK (membership_role IN ('administrator', 'employee'));

CREATE TABLE taptime_server.membership_management_command_receipts (
  organization_id uuid NOT NULL REFERENCES taptime_server.organizations (id),
  command_id uuid NOT NULL,
  actor_user_id uuid NOT NULL,
  actor_membership_id uuid NOT NULL,
  target_membership_id uuid NOT NULL,
  command_type text NOT NULL CHECK (command_type IN ('revoke', 'change_role')),
  requested_role text CHECK (requested_role IN ('administrator', 'employee')),
  expected_row_version bigint NOT NULL CHECK (expected_row_version > 0),
  result_role text NOT NULL CHECK (result_role IN ('administrator', 'employee')),
  result_revoked_at timestamptz,
  result_row_version bigint NOT NULL CHECK (result_row_version > 0),
  created_at timestamptz NOT NULL DEFAULT pg_catalog.transaction_timestamp(),
  PRIMARY KEY (organization_id, command_id),
  CONSTRAINT membership_management_receipts_actor_fk FOREIGN KEY (
    organization_id, actor_user_id, actor_membership_id
  ) REFERENCES taptime_server.memberships (organization_id, user_id, id),
  CONSTRAINT membership_management_receipts_target_fk FOREIGN KEY (
    organization_id, target_membership_id
  ) REFERENCES taptime_server.memberships (organization_id, id),
  CONSTRAINT membership_management_receipts_request_shape CHECK (
    (command_type = 'revoke' AND requested_role IS NULL AND result_revoked_at IS NOT NULL)
    OR
    (command_type = 'change_role' AND requested_role IS NOT NULL AND result_revoked_at IS NULL)
  )
);

ALTER TABLE taptime_server.membership_management_command_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.membership_management_command_receipts FORCE ROW LEVEL SECURITY;

CREATE FUNCTION taptime_server.deny_membership_management_receipt_mutation_v1()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $guard$
BEGIN
  RAISE EXCEPTION 'Membership management receipts are append-only' USING ERRCODE = '42501';
END
$guard$;

REVOKE ALL ON FUNCTION taptime_server.deny_membership_management_receipt_mutation_v1()
  FROM PUBLIC;

CREATE TRIGGER membership_management_receipts_append_only
  BEFORE UPDATE OR DELETE ON taptime_server.membership_management_command_receipts
  FOR EACH ROW EXECUTE FUNCTION
    taptime_server.deny_membership_management_receipt_mutation_v1();

-- This is the single authorization seam for people management. T-015 extends the body with
-- location responsibility; callers and mutation functions keep the same capability contract.
CREATE FUNCTION taptime_server.has_membership_management_authority_v1(
  requested_organization_id uuid,
  requested_actor_user_id uuid,
  requested_actor_membership_id uuid,
  requested_action text,
  requested_target_membership_id uuid,
  requested_membership_role text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $authority$
  SELECT requested_organization_id IS NOT NULL
    AND requested_actor_user_id IS NOT NULL
    AND requested_actor_membership_id IS NOT NULL
    AND requested_action IN ('read', 'invite', 'revoke', 'change_role')
    -- An administrator Membership carries Organization-wide responsibility today. T-015 adds
    -- persisted location responsibility here; every caller continues to ask the same capability.
    AND EXISTS (
      SELECT 1
      FROM taptime_server.memberships AS actor
      WHERE actor.organization_id = requested_organization_id
        AND actor.user_id = requested_actor_user_id
        AND actor.id = requested_actor_membership_id
        AND actor.role = 'administrator'
        AND actor.revoked_at IS NULL
    )
    AND CASE requested_action
      WHEN 'read' THEN
        requested_target_membership_id IS NULL AND requested_membership_role IS NULL
      WHEN 'invite' THEN
        requested_target_membership_id IS NULL
        AND requested_membership_role IN ('administrator', 'employee')
      WHEN 'revoke' THEN
        requested_target_membership_id IS NOT NULL
        AND requested_membership_role IS NULL
        AND EXISTS (
          SELECT 1 FROM taptime_server.memberships AS target
          WHERE target.organization_id = requested_organization_id
            AND target.id = requested_target_membership_id
            AND target.revoked_at IS NULL
        )
      WHEN 'change_role' THEN
        requested_target_membership_id IS NOT NULL
        AND requested_membership_role IN ('administrator', 'employee')
        AND EXISTS (
          SELECT 1 FROM taptime_server.memberships AS target
          WHERE target.organization_id = requested_organization_id
            AND target.id = requested_target_membership_id
            AND target.revoked_at IS NULL
        )
      ELSE false
    END
$authority$;

ALTER FUNCTION taptime_server.has_membership_management_authority_v1(
  uuid, uuid, uuid, text, uuid, text
) OWNER TO taptime_membership_management_function_owner;
REVOKE ALL ON FUNCTION taptime_server.has_membership_management_authority_v1(
  uuid, uuid, uuid, text, uuid, text
) FROM PUBLIC;

CREATE FUNCTION taptime_server.membership_invitation_request_digest_v2(
  requested_organization_id uuid,
  requested_actor_user_id uuid,
  requested_membership_id uuid,
  canonical_display_name text,
  requested_membership_role text
)
RETURNS bytea
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog
AS $digest$
  SELECT pg_catalog.sha256(
    pg_catalog.convert_to('taptime:t009:membership-invitation:v2', 'UTF8')
    || pg_catalog.decode('00', 'hex')
    || pg_catalog.convert_to(requested_organization_id::text, 'UTF8')
    || pg_catalog.decode('00', 'hex')
    || pg_catalog.convert_to(requested_actor_user_id::text, 'UTF8')
    || pg_catalog.decode('00', 'hex')
    || pg_catalog.convert_to(requested_membership_id::text, 'UTF8')
    || pg_catalog.decode('00', 'hex')
    || pg_catalog.convert_to(canonical_display_name, 'UTF8')
    || pg_catalog.decode('00', 'hex')
    || pg_catalog.convert_to(requested_membership_role, 'UTF8')
  )
$digest$;

CREATE FUNCTION taptime_server.create_membership_invitation_v2(
  requested_command_id uuid,
  requested_invitation_id uuid,
  requested_display_name text,
  requested_membership_role text,
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
  IF pg_catalog.current_setting('role', true) <> 'taptime_membership_manager'
    OR requested_command_id IS NULL
    OR requested_invitation_id IS NULL
    OR requested_membership_role NOT IN ('administrator', 'employee')
    OR requested_token_digest IS NULL
    OR pg_catalog.octet_length(requested_token_digest) <> 32
    OR NULLIF(pg_catalog.current_setting('app.correlation_id', true), '')
       <> requested_command_id::text
  THEN
    RETURN QUERY SELECT 'invalid_request', NULL::timestamptz;
    RETURN;
  END IF;
  canonical_name := taptime_server.normalize_membership_display_name_v1(
    requested_display_name
  );
  IF canonical_name IS NULL OR canonical_name <> requested_display_name THEN
    RETURN QUERY SELECT 'invalid_request', NULL::timestamptz;
    RETURN;
  END IF;
  IF NOT taptime_server.has_membership_management_authority_v1(
    context_organization_id, context_user_id, context_membership_id,
    'invite', NULL, requested_membership_role
  ) THEN
    RETURN QUERY SELECT 'forbidden', NULL::timestamptz;
    RETURN;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'taptime:t009:membership-invitation-command:' || context_organization_id::text
      || ':' || requested_command_id::text, 0
  ));
  request_hash := taptime_server.membership_invitation_request_digest_v2(
    context_organization_id, context_user_id, context_membership_id,
    canonical_name, requested_membership_role
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
    'taptime:t009:membership-invitation-cap:' || context_organization_id::text, 0
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
    membership_role, token_digest, expires_at
  ) VALUES (
    requested_invitation_id, context_organization_id, context_user_id,
    context_membership_id, canonical_name, requested_membership_role,
    requested_token_digest, invitation_expiry
  );
  INSERT INTO taptime_server.employee_invitation_command_receipts (
    organization_id, command_id, actor_user_id, membership_id, request_hash_version,
    request_hash, invitation_id, expires_at
  ) VALUES (
    context_organization_id, requested_command_id, context_user_id,
    context_membership_id, 1, request_hash, requested_invitation_id, invitation_expiry
  );
  RETURN QUERY SELECT 'succeeded', invitation_expiry;
END
$create$;

CREATE FUNCTION taptime_server.read_managed_memberships_v1(
  requested_cursor uuid,
  requested_limit integer
)
RETURNS TABLE (
  organization_id uuid,
  organization_name text,
  membership_id uuid,
  membership_display_name text,
  membership_role text,
  membership_active boolean,
  membership_row_version bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, taptime_server
AS $projection$
DECLARE
  context_organization_id uuid := NULLIF(pg_catalog.current_setting('app.organization_id', true), '')::uuid;
  context_user_id uuid := NULLIF(pg_catalog.current_setting('app.user_id', true), '')::uuid;
  context_membership_id uuid := NULLIF(pg_catalog.current_setting('app.membership_id', true), '')::uuid;
BEGIN
  IF pg_catalog.current_setting('role', true) <> 'taptime_membership_manager'
    OR requested_limit NOT BETWEEN 1 AND 20
    OR NOT taptime_server.has_membership_management_authority_v1(
      context_organization_id, context_user_id, context_membership_id,
      'read', NULL, NULL
    )
  THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT organization.id, organization.name, page.id,
         COALESCE(
           page.display_name,
           CASE page.role WHEN 'administrator' THEN 'Administrator' ELSE 'Beschäftigter' END
         ),
         page.role, page.revoked_at IS NULL, page.row_version
  FROM taptime_server.organizations AS organization
  LEFT JOIN LATERAL (
    SELECT membership.id, membership.display_name, membership.role,
           membership.revoked_at, membership.row_version
    FROM taptime_server.memberships AS membership
    WHERE membership.organization_id = organization.id
      AND (requested_cursor IS NULL OR membership.id > requested_cursor)
    ORDER BY membership.id
    LIMIT requested_limit + 1
  ) AS page ON true
  WHERE organization.id = context_organization_id;
END
$projection$;

CREATE FUNCTION taptime_server.manage_membership_v1(
  requested_command_id uuid,
  requested_target_membership_id uuid,
  requested_expected_row_version bigint,
  requested_command_type text,
  requested_membership_role text
)
RETURNS TABLE (
  result_status text,
  result_role text,
  result_active boolean,
  result_row_version bigint,
  result_idempotent_retry boolean
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, taptime_server
AS $manage$
DECLARE
  context_organization_id uuid := NULLIF(pg_catalog.current_setting('app.organization_id', true), '')::uuid;
  context_user_id uuid := NULLIF(pg_catalog.current_setting('app.user_id', true), '')::uuid;
  context_membership_id uuid := NULLIF(pg_catalog.current_setting('app.membership_id', true), '')::uuid;
  target taptime_server.memberships%ROWTYPE;
  receipt taptime_server.membership_management_command_receipts%ROWTYPE;
  administrator_count integer;
BEGIN
  IF pg_catalog.current_setting('role', true) <> 'taptime_membership_manager'
    OR requested_command_id IS NULL
    OR requested_target_membership_id IS NULL
    OR requested_expected_row_version IS NULL OR requested_expected_row_version < 1
    OR requested_command_type NOT IN ('revoke', 'change_role')
    OR (requested_command_type = 'revoke' AND requested_membership_role IS NOT NULL)
    OR (requested_command_type = 'change_role'
      AND requested_membership_role NOT IN ('administrator', 'employee'))
    OR NULLIF(pg_catalog.current_setting('app.correlation_id', true), '')
       <> requested_command_id::text
  THEN
    RETURN QUERY SELECT 'invalid_request', NULL::text, NULL::boolean,
      NULL::bigint, false;
    RETURN;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'taptime:t009:membership-command:' || context_organization_id::text
      || ':' || requested_command_id::text, 0
  ));
  SELECT stored.* INTO receipt
  FROM taptime_server.membership_management_command_receipts AS stored
  WHERE stored.organization_id = context_organization_id
    AND stored.command_id = requested_command_id;
  IF FOUND THEN
    IF receipt.actor_user_id = context_user_id
      AND receipt.actor_membership_id = context_membership_id
      AND receipt.target_membership_id = requested_target_membership_id
      AND receipt.command_type = requested_command_type
      AND receipt.requested_role IS NOT DISTINCT FROM requested_membership_role
      AND receipt.expected_row_version = requested_expected_row_version
    THEN
      RETURN QUERY SELECT 'succeeded', receipt.result_role,
        receipt.result_revoked_at IS NULL, receipt.result_row_version, true;
    ELSE
      RETURN QUERY SELECT 'command_id_conflict', NULL::text, NULL::boolean,
        NULL::bigint, false;
    END IF;
    RETURN;
  END IF;

  SELECT membership.* INTO target
  FROM taptime_server.memberships AS membership
  WHERE membership.organization_id = context_organization_id
    AND membership.id = requested_target_membership_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'target_unavailable', NULL::text, NULL::boolean,
      NULL::bigint, false;
    RETURN;
  END IF;
  IF requested_command_type = 'revoke'
    AND target.id = context_membership_id
  THEN
    RETURN QUERY SELECT 'self_revocation_forbidden', NULL::text, NULL::boolean,
      NULL::bigint, false;
    RETURN;
  END IF;
  IF NOT taptime_server.has_membership_management_authority_v1(
    context_organization_id, context_user_id, context_membership_id,
    requested_command_type, requested_target_membership_id, requested_membership_role
  ) THEN
    RETURN QUERY SELECT 'forbidden', NULL::text, NULL::boolean,
      NULL::bigint, false;
    RETURN;
  END IF;
  IF target.row_version <> requested_expected_row_version THEN
    RETURN QUERY SELECT 'stale_row_version', NULL::text, NULL::boolean,
      NULL::bigint, false;
    RETURN;
  END IF;
  IF requested_command_type = 'change_role'
    AND target.role = requested_membership_role
  THEN
    RETURN QUERY SELECT 'invalid_request', NULL::text, NULL::boolean,
      NULL::bigint, false;
    RETURN;
  END IF;

  IF target.role = 'administrator'
    AND (
      requested_command_type = 'revoke'
      OR (requested_command_type = 'change_role' AND requested_membership_role = 'employee')
    )
  THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
      'taptime:t009:last-administrator:' || context_organization_id::text, 0
    ));
    SELECT pg_catalog.count(*)::integer INTO administrator_count
    FROM taptime_server.memberships AS membership
    WHERE membership.organization_id = context_organization_id
      AND membership.role = 'administrator'
      AND membership.revoked_at IS NULL;
    IF administrator_count <= 1 THEN
      RETURN QUERY SELECT 'last_administrator', NULL::text, NULL::boolean,
        NULL::bigint, false;
      RETURN;
    END IF;
  END IF;

  IF requested_command_type = 'revoke' THEN
    UPDATE taptime_server.memberships
    SET revoked_at = pg_catalog.transaction_timestamp(), row_version = row_version + 1
    WHERE organization_id = context_organization_id AND id = target.id
    RETURNING * INTO target;
  ELSIF target.role <> requested_membership_role THEN
    UPDATE taptime_server.memberships
    SET role = requested_membership_role, row_version = row_version + 1
    WHERE organization_id = context_organization_id AND id = target.id
    RETURNING * INTO target;
  END IF;

  INSERT INTO taptime_server.membership_management_command_receipts (
    organization_id, command_id, actor_user_id, actor_membership_id,
    target_membership_id, command_type, requested_role, expected_row_version,
    result_role, result_revoked_at, result_row_version
  ) VALUES (
    context_organization_id, requested_command_id, context_user_id,
    context_membership_id, target.id, requested_command_type,
    requested_membership_role, requested_expected_row_version,
    target.role, target.revoked_at, target.row_version
  );
  RETURN QUERY SELECT 'succeeded', target.role, target.revoked_at IS NULL,
    target.row_version, false;
END
$manage$;

CREATE OR REPLACE FUNCTION taptime_server.enforce_employee_invitation_consumption_shape()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $guard$
BEGIN
  IF TG_OP = 'DELETE'
    OR pg_catalog.current_setting('role', true) NOT IN (
      'taptime_employee_enrollment_redeemer',
      'taptime_membership_enrollment_redeemer'
    )
    OR OLD.consumed_at IS NOT NULL
    OR NEW.id <> OLD.id
    OR NEW.organization_id <> OLD.organization_id
    OR NEW.creator_user_id <> OLD.creator_user_id
    OR NEW.creator_membership_id <> OLD.creator_membership_id
    OR NEW.display_name <> OLD.display_name
    OR NEW.membership_role <> OLD.membership_role
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
    RAISE EXCEPTION 'Invalid Membership invitation mutation' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$guard$;

CREATE OR REPLACE FUNCTION taptime_server.redeem_employee_membership_invitation_data_v1(
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
  IF NOT FOUND OR NOT taptime_server.has_membership_management_authority_v1(
    invitation.organization_id, invitation.creator_user_id, invitation.creator_membership_id,
    'invite', NULL, invitation.membership_role
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
  ELSIF EXISTS (SELECT 1 FROM taptime_server.users AS app_user WHERE app_user.id = resolved_user_id) THEN
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

CREATE FUNCTION taptime_server.redeem_membership_invitation_v2(
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
  result_membership_display_name text,
  result_membership_role text
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, taptime_server
AS $entry$
DECLARE
  redemption record;
  invited_role text;
BEGIN
  SELECT result.result_status, result.result_organization_name,
         result.result_membership_display_name
  INTO redemption
  FROM taptime_server.redeem_employee_membership_invitation_data_v1(
    requested_command_id, requested_token_digest, verified_issuer, verified_subject,
    generated_user_id, generated_identity_binding_id, generated_membership_id
  ) AS result;
  IF redemption.result_status = 'succeeded' THEN
    SELECT invitation.membership_role INTO invited_role
    FROM taptime_server.employee_membership_invitations AS invitation
    WHERE invitation.token_digest = requested_token_digest;
  END IF;
  RETURN QUERY SELECT redemption.result_status,
    redemption.result_organization_name, redemption.result_membership_display_name,
    invited_role;
END
$entry$;

CREATE FUNCTION taptime_server.append_people_management_audit_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, taptime_server
AS $audit$
DECLARE
  selected_role text := pg_catalog.current_setting('role', true);
  event_name text;
  entity_name text;
  event_payload jsonb;
  entity_id uuid;
  organization_id uuid;
BEGIN
  IF selected_role = 'taptime_membership_manager'
    AND TG_TABLE_NAME = 'employee_membership_invitations' AND TG_OP = 'INSERT'
  THEN
    event_name := 'MembershipInvitationCreated';
    entity_name := 'MembershipInvitation';
    event_payload := pg_catalog.jsonb_build_object(
      'displayName', NEW.display_name,
      'role', NEW.membership_role,
      'expiresAt', pg_catalog.to_char(
        NEW.expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      )
    );
    entity_id := NEW.id;
    organization_id := NEW.organization_id;
  ELSIF selected_role = 'taptime_membership_manager'
    AND TG_TABLE_NAME = 'memberships' AND TG_OP = 'UPDATE'
  THEN
    event_name := CASE WHEN NEW.revoked_at IS DISTINCT FROM OLD.revoked_at
      THEN 'MembershipRevoked' ELSE 'MembershipRoleChanged' END;
    entity_name := 'Membership';
    event_payload := pg_catalog.jsonb_build_object(
      'role', NEW.role,
      'revoked', NEW.revoked_at IS NOT NULL,
      'rowVersion', NEW.row_version
    );
    entity_id := NEW.id;
    organization_id := NEW.organization_id;
  ELSIF selected_role = 'taptime_membership_enrollment_redeemer'
    AND TG_TABLE_NAME = 'memberships' AND TG_OP = 'INSERT'
  THEN
    event_name := 'MembershipGranted';
    entity_name := 'Membership';
    event_payload := pg_catalog.jsonb_build_object('role', NEW.role);
    entity_id := NEW.id;
    organization_id := NEW.organization_id;
  ELSE
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF NULLIF(pg_catalog.current_setting('app.correlation_id', true), '') IS NULL
    OR NULLIF(pg_catalog.current_setting('app.user_id', true), '') IS NULL
  THEN
    RAISE EXCEPTION 'People-management audit context is required' USING ERRCODE = '42501';
  END IF;
  INSERT INTO taptime_server.audit_events (
    id, organization_id, actor_user_id, operator_principal, event_type,
    entity_type, entity_id, occurred_at, correlation_id, payload
  ) VALUES (
    pg_catalog.gen_random_uuid(), organization_id,
    pg_catalog.current_setting('app.user_id')::uuid, NULL, event_name,
    entity_name, entity_id, pg_catalog.transaction_timestamp(),
    pg_catalog.current_setting('app.correlation_id'), event_payload
  );
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END
$audit$;

CREATE FUNCTION taptime_server.record_password_reset_completed_v1()
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, taptime_server
AS $record$
DECLARE
  context_organization_id uuid := NULLIF(pg_catalog.current_setting('app.organization_id', true), '')::uuid;
  context_user_id uuid := NULLIF(pg_catalog.current_setting('app.user_id', true), '')::uuid;
  context_membership_id uuid := NULLIF(pg_catalog.current_setting('app.membership_id', true), '')::uuid;
  context_correlation_id text := NULLIF(pg_catalog.current_setting('app.correlation_id', true), '');
BEGIN
  IF pg_catalog.current_setting('role', true) <> 'taptime_password_reset_auditor'
    OR context_organization_id IS NULL OR context_user_id IS NULL
    OR context_membership_id IS NULL OR context_correlation_id IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM taptime_server.memberships AS membership
      WHERE membership.organization_id = context_organization_id
        AND membership.user_id = context_user_id
        AND membership.id = context_membership_id
        AND membership.revoked_at IS NULL
    )
  THEN
    RETURN 'forbidden';
  END IF;
  INSERT INTO taptime_server.audit_events (
    id, organization_id, actor_user_id, operator_principal, event_type,
    entity_type, entity_id, occurred_at, correlation_id, payload
  ) VALUES (
    pg_catalog.gen_random_uuid(), context_organization_id, context_user_id, NULL,
    'PasswordResetCompleted', 'User', context_user_id,
    pg_catalog.transaction_timestamp(), context_correlation_id,
    pg_catalog.jsonb_build_object('membershipId', context_membership_id)
  );
  RETURN 'succeeded';
END
$record$;

CREATE TRIGGER invitations_people_management_audit
  AFTER INSERT ON taptime_server.employee_membership_invitations
  FOR EACH ROW EXECUTE FUNCTION taptime_server.append_people_management_audit_v1();
CREATE TRIGGER memberships_people_management_audit
  AFTER INSERT OR UPDATE ON taptime_server.memberships
  FOR EACH ROW EXECUTE FUNCTION taptime_server.append_people_management_audit_v1();

ALTER FUNCTION taptime_server.create_membership_invitation_v2(uuid, uuid, text, text, bytea)
  OWNER TO taptime_membership_management_function_owner;
ALTER FUNCTION taptime_server.read_managed_memberships_v1(uuid, integer)
  OWNER TO taptime_membership_management_function_owner;
ALTER FUNCTION taptime_server.manage_membership_v1(uuid, uuid, bigint, text, text)
  OWNER TO taptime_membership_management_function_owner;
ALTER FUNCTION taptime_server.redeem_membership_invitation_v2(
  uuid, bytea, text, text, uuid, uuid, uuid
) OWNER TO taptime_membership_redemption_function_owner;
ALTER FUNCTION taptime_server.append_people_management_audit_v1()
  OWNER TO taptime_people_audit_function_owner;
ALTER FUNCTION taptime_server.record_password_reset_completed_v1()
  OWNER TO taptime_people_audit_function_owner;

REVOKE ALL ON ALL TABLES IN SCHEMA taptime_server FROM
  taptime_membership_manager,
  taptime_membership_management_function_owner,
  taptime_membership_enrollment_redeemer,
  taptime_membership_redemption_function_owner,
  taptime_people_audit_function_owner,
  taptime_password_reset_auditor;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA taptime_server FROM
  taptime_membership_manager,
  taptime_membership_management_function_owner,
  taptime_membership_enrollment_redeemer,
  taptime_membership_redemption_function_owner,
  taptime_people_audit_function_owner,
  taptime_password_reset_auditor;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA taptime_server FROM
  taptime_membership_manager,
  taptime_membership_management_function_owner,
  taptime_membership_enrollment_redeemer,
  taptime_membership_redemption_function_owner,
  taptime_people_audit_function_owner,
  taptime_password_reset_auditor;
REVOKE ALL ON SCHEMA taptime_server FROM
  taptime_membership_manager,
  taptime_membership_management_function_owner,
  taptime_membership_enrollment_redeemer,
  taptime_membership_redemption_function_owner,
  taptime_people_audit_function_owner,
  taptime_password_reset_auditor;

GRANT USAGE ON SCHEMA taptime_server TO
  taptime_membership_manager,
  taptime_membership_management_function_owner,
  taptime_membership_enrollment_redeemer,
  taptime_membership_redemption_function_owner,
  taptime_people_audit_function_owner,
  taptime_password_reset_auditor;

GRANT SELECT ON taptime_server.organizations,
  taptime_server.memberships,
  taptime_server.employee_membership_invitations,
  taptime_server.employee_invitation_command_receipts,
  taptime_server.membership_management_command_receipts
  TO taptime_membership_management_function_owner;
GRANT INSERT ON taptime_server.employee_membership_invitations,
  taptime_server.employee_invitation_command_receipts,
  taptime_server.membership_management_command_receipts
  TO taptime_membership_management_function_owner;
-- Migration 014 removed this capability from taptime_administrator. Only this function owner
-- receives the three columns required by the reviewed people-management transaction.
GRANT UPDATE (role, revoked_at, row_version) ON taptime_server.memberships
  TO taptime_membership_management_function_owner;
GRANT EXECUTE ON FUNCTION
	  taptime_server.has_membership_management_authority_v1(
	    uuid, uuid, uuid, text, uuid, text
  ),
  taptime_server.normalize_membership_display_name_v1(text),
  taptime_server.normalize_taptime_name_v1(text, text),
  taptime_server.membership_invitation_request_digest_v2(uuid, uuid, uuid, text, text)
  TO taptime_membership_management_function_owner;

GRANT SELECT (membership_role, token_digest)
  ON taptime_server.employee_membership_invitations
  TO taptime_membership_redemption_function_owner;
GRANT EXECUTE ON FUNCTION taptime_server.redeem_employee_membership_invitation_data_v1(
  uuid, bytea, text, text, uuid, uuid, uuid
) TO taptime_membership_redemption_function_owner;
GRANT EXECUTE ON FUNCTION taptime_server.has_membership_management_authority_v1(
	  uuid, uuid, uuid, text, uuid, text
) TO taptime_employee_redemption_data_function_owner;

GRANT INSERT ON taptime_server.audit_events TO taptime_people_audit_function_owner;
GRANT SELECT ON taptime_server.memberships TO taptime_people_audit_function_owner;
GRANT EXECUTE ON FUNCTION taptime_server.current_user_id()
  TO taptime_people_audit_function_owner;

GRANT EXECUTE ON FUNCTION taptime_server.create_membership_invitation_v2(
  uuid, uuid, text, text, bytea
), taptime_server.read_managed_memberships_v1(uuid, integer),
  taptime_server.manage_membership_v1(uuid, uuid, bigint, text, text)
  TO taptime_membership_manager;
GRANT EXECUTE ON FUNCTION taptime_server.redeem_membership_invitation_v2(
  uuid, bytea, text, text, uuid, uuid, uuid
) TO taptime_membership_enrollment_redeemer;
GRANT EXECUTE ON FUNCTION taptime_server.record_password_reset_completed_v1()
  TO taptime_password_reset_auditor;

REVOKE ALL ON FUNCTION taptime_server.has_membership_management_authority_v1(
	  uuid, uuid, uuid, text, uuid, text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION taptime_server.membership_invitation_request_digest_v2(
  uuid, uuid, uuid, text, text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION taptime_server.create_membership_invitation_v2(
  uuid, uuid, text, text, bytea
) FROM PUBLIC;
REVOKE ALL ON FUNCTION taptime_server.read_managed_memberships_v1(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION taptime_server.manage_membership_v1(
  uuid, uuid, bigint, text, text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION taptime_server.redeem_membership_invitation_v2(
  uuid, bytea, text, text, uuid, uuid, uuid
) FROM PUBLIC;
REVOKE ALL ON FUNCTION taptime_server.append_people_management_audit_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION taptime_server.record_password_reset_completed_v1() FROM PUBLIC;

-- The v1 endpoints remain installed for migration history but are no longer reachable by the
-- production people-management runtime roles after the backend moves to the v2 capabilities.

-- T-126 / D-142, clarified by TL: name changes retain old/new names in the audit.
-- Migration owns creation, replacement and retirement of this capability and its NOLOGIN
-- owner. Names originate at invitation/bootstrap, are changed here by authorized managers,
-- and cannot be cleared or changed after departure. Audit/receipts remain append-only;
-- eventual removal belongs to the same future retention policy as customer history.
DO $owner$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'taptime_membership_rename_owner') THEN
    CREATE ROLE taptime_membership_rename_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION BYPASSRLS;
  END IF;
END
$owner$;
ALTER ROLE taptime_membership_rename_owner WITH NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION BYPASSRLS;
GRANT USAGE ON SCHEMA taptime_server TO taptime_membership_rename_owner;
GRANT SELECT (id, status) ON taptime_server.organizations TO taptime_membership_rename_owner;
GRANT SELECT ON taptime_server.memberships, taptime_server.membership_management_command_receipts
  TO taptime_membership_rename_owner;
GRANT INSERT ON taptime_server.membership_management_command_receipts TO taptime_membership_rename_owner;
GRANT UPDATE (display_name, row_version) ON taptime_server.memberships TO taptime_membership_rename_owner;
GRANT EXECUTE ON FUNCTION taptime_server.normalize_taptime_name_v1(text,text),
  taptime_server.normalize_membership_display_name_v1(text),
  taptime_server.has_membership_management_authority_v1(uuid,uuid,uuid,text,uuid,text,uuid),
  taptime_server.membership_management_home_v1(uuid,uuid) TO taptime_membership_rename_owner;

-- Share the command namespace with revoke/change_role, including their advisory lock.
-- Store canonical input so equivalent normalized requests repeat the same result.
ALTER TABLE taptime_server.membership_management_command_receipts
  ADD COLUMN requested_name text,
  DROP CONSTRAINT membership_management_command_receipts_command_type_check,
  DROP CONSTRAINT membership_management_receipts_request_shape,
  ADD CONSTRAINT membership_management_receipts_command_type_v2
    CHECK (command_type IN ('revoke', 'change_role', 'rename')),
  ADD CONSTRAINT membership_management_receipts_request_shape_v2 CHECK (
    (command_type = 'revoke' AND requested_role IS NULL AND requested_name IS NULL AND result_revoked_at IS NOT NULL)
    OR (command_type = 'change_role' AND requested_role IS NOT NULL AND requested_name IS NULL AND result_revoked_at IS NULL)
    OR (command_type = 'rename' AND requested_role IS NULL AND result_revoked_at IS NULL
      AND requested_name IS NOT NULL
      AND taptime_server.normalize_membership_display_name_v1(requested_name) IS NOT NULL
      AND requested_name = taptime_server.normalize_membership_display_name_v1(requested_name))
  );

CREATE OR REPLACE FUNCTION taptime_server.enforce_membership_display_name_immutable()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $guard$
BEGIN
  IF NEW.display_name IS DISTINCT FROM OLD.display_name THEN
    -- Only rename_membership_v1 writes as this owner; runtime roles cannot SET ROLE to it.
    IF current_user <> 'taptime_membership_rename_owner'
      OR current_setting('role', true) IS DISTINCT FROM 'taptime_membership_manager'
      OR OLD.revoked_at IS NOT NULL OR NEW.revoked_at IS NOT NULL
      OR NEW.display_name IS NULL
      OR NEW.row_version <> OLD.row_version + 1
      OR (to_jsonb(NEW) - ARRAY['display_name','row_version'])
         IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['display_name','row_version'])
    THEN RAISE EXCEPTION 'Membership name may only change through its rename command' USING ERRCODE = '23514'; END IF;
  END IF;
  RETURN NEW;
END
$guard$;
REVOKE ALL ON FUNCTION taptime_server.enforce_membership_display_name_immutable() FROM PUBLIC;

CREATE FUNCTION taptime_server.rename_membership_v1(
  requested_command_id uuid, requested_target_membership_id uuid,
  requested_expected_row_version bigint, requested_display_name text
)
RETURNS TABLE (result_status text, result_role text, result_active boolean,
  result_row_version bigint, result_idempotent_retry boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $rename$
DECLARE
  org uuid := NULLIF(current_setting('app.organization_id', true), '')::uuid;
  actor_user uuid := NULLIF(current_setting('app.user_id', true), '')::uuid;
  actor_member uuid := NULLIF(current_setting('app.membership_id', true), '')::uuid;
  canonical_name text := taptime_server.normalize_membership_display_name_v1(requested_display_name);
  target taptime_server.memberships%ROWTYPE;
  receipt taptime_server.membership_management_command_receipts%ROWTYPE;
BEGIN
  IF current_setting('role', true) IS DISTINCT FROM 'taptime_membership_manager'
    OR org IS NULL OR actor_user IS NULL OR actor_member IS NULL
    OR requested_command_id IS NULL OR requested_target_membership_id IS NULL
    OR requested_expected_row_version IS NULL OR requested_expected_row_version < 1
    OR canonical_name IS NULL
    OR requested_command_id::text IS DISTINCT FROM NULLIF(current_setting('app.correlation_id', true), '')
  THEN RETURN QUERY SELECT 'invalid_request', NULL::text, NULL::boolean, NULL::bigint, false; RETURN; END IF;

  -- Revalidate the active actor, including paused organizations, before disclosing a receipt.
  IF NOT EXISTS (SELECT 1 FROM taptime_server.organizations o JOIN taptime_server.memberships m
      ON m.organization_id = o.id AND m.id = actor_member AND m.user_id = actor_user
      AND m.revoked_at IS NULL AND m.role = current_setting('app.membership_role', true)
      WHERE o.id = org AND o.status = 'active')
    OR NOT EXISTS (SELECT 1 FROM taptime_server.has_membership_management_authority_v1(
    org, actor_user, actor_member, 'read', NULL, NULL, NULL))
  THEN RETURN QUERY SELECT 'forbidden', NULL::text, NULL::boolean, NULL::bigint, false; RETURN; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'taptime:t009:membership-command:' || org::text || ':' || requested_command_id::text, 0));
  SELECT stored.* INTO receipt FROM taptime_server.membership_management_command_receipts stored
    WHERE stored.organization_id = org AND stored.command_id = requested_command_id;
  IF FOUND THEN
    IF receipt.actor_user_id = actor_user AND receipt.actor_membership_id = actor_member
      AND receipt.target_membership_id = requested_target_membership_id
      AND receipt.command_type = 'rename' AND receipt.requested_name = canonical_name
      AND receipt.expected_row_version = requested_expected_row_version
    THEN RETURN QUERY SELECT 'succeeded', receipt.result_role, receipt.result_revoked_at IS NULL,
      receipt.result_row_version, true;
    ELSE RETURN QUERY SELECT 'command_id_conflict', NULL::text, NULL::boolean, NULL::bigint, false;
    END IF;
    RETURN;
  END IF;

  SELECT member.* INTO target FROM taptime_server.memberships member
    WHERE member.organization_id = org AND member.id = requested_target_membership_id FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT 'target_unavailable', NULL::text, NULL::boolean, NULL::bigint, false; RETURN; END IF;
  IF target.revoked_at IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM taptime_server.has_membership_management_authority_v1(
      org, actor_user, actor_member, 'read', NULL, NULL, NULL) scope
      WHERE scope.scope_kind = 'organization' OR (target.role = 'employee' AND scope.scope_kind = 'location'
        AND scope.location_id = taptime_server.membership_management_home_v1(org, target.id)))
    THEN RETURN QUERY SELECT 'already_departed', NULL::text, NULL::boolean, NULL::bigint, false;
    ELSE RETURN QUERY SELECT 'forbidden', NULL::text, NULL::boolean, NULL::bigint, false;
    END IF;
    RETURN;
  END IF;
  -- Revoke authority has precisely the target scope required here; its self-revocation
  -- prohibition is in manage_membership_v1, so administrators may rename themselves.
  IF NOT EXISTS (SELECT 1 FROM taptime_server.has_membership_management_authority_v1(
    org, actor_user, actor_member, 'revoke', target.id, NULL, NULL))
  THEN RETURN QUERY SELECT 'forbidden', NULL::text, NULL::boolean, NULL::bigint, false; RETURN; END IF;
  IF target.row_version <> requested_expected_row_version
  THEN RETURN QUERY SELECT 'stale_row_version', NULL::text, NULL::boolean, NULL::bigint, false; RETURN; END IF;
  IF target.display_name = canonical_name
  THEN RETURN QUERY SELECT 'invalid_request', NULL::text, NULL::boolean, NULL::bigint, false; RETURN; END IF;

  UPDATE taptime_server.memberships SET display_name = canonical_name, row_version = row_version + 1
    WHERE organization_id = org AND id = target.id RETURNING * INTO target;
  INSERT INTO taptime_server.membership_management_command_receipts (
    organization_id, command_id, actor_user_id, actor_membership_id, target_membership_id,
    command_type, requested_name, expected_row_version, result_role, result_revoked_at, result_row_version
  ) VALUES (org, requested_command_id, actor_user, actor_member, target.id,
    'rename', canonical_name, requested_expected_row_version, target.role, target.revoked_at, target.row_version);
  RETURN QUERY SELECT 'succeeded', target.role, true, target.row_version, false;
END
$rename$;
ALTER FUNCTION taptime_server.rename_membership_v1(uuid,uuid,bigint,text) OWNER TO taptime_membership_rename_owner;
REVOKE ALL ON FUNCTION taptime_server.rename_membership_v1(uuid,uuid,bigint,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.rename_membership_v1(uuid,uuid,bigint,text) TO taptime_membership_manager;

CREATE OR REPLACE FUNCTION taptime_server.append_people_management_audit_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
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
      THEN 'MembershipRevoked'
      WHEN NEW.display_name IS DISTINCT FROM OLD.display_name THEN 'MembershipRenamed'
      ELSE 'MembershipRoleChanged' END;
    entity_name := 'Membership';
    event_payload := CASE WHEN event_name = 'MembershipRenamed' THEN pg_catalog.jsonb_build_object(
      'oldName', OLD.display_name, 'newName', NEW.display_name, 'rowVersion', NEW.row_version,
      'membershipId', current_setting('app.membership_id', true), 'action', 'rename'
    ) ELSE pg_catalog.jsonb_build_object(
      'role', NEW.role,
      'revoked', NEW.revoked_at IS NOT NULL,
      'rowVersion', NEW.row_version
    ) END;
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
$function$;

-- Existing people projections substitute a role label for NULL names and omit versions.
-- Read the exact editable value on opening the sheet, without changing installed App contracts.
CREATE FUNCTION taptime_server.read_membership_name_v1(requested_target_membership_id uuid)
RETURNS TABLE (display_name text, row_version bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $read$
  SELECT target.display_name, target.row_version FROM taptime_server.memberships target
  JOIN taptime_server.organizations org ON org.id = target.organization_id AND org.status = 'active'
  WHERE current_setting('role', true) = 'taptime_membership_manager'
    AND target.organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid
    AND target.id = requested_target_membership_id AND target.revoked_at IS NULL
    AND EXISTS (SELECT 1 FROM taptime_server.has_membership_management_authority_v1(
      target.organization_id, NULLIF(current_setting('app.user_id', true), '')::uuid,
      NULLIF(current_setting('app.membership_id', true), '')::uuid, 'revoke', target.id, NULL, NULL))
$read$;
ALTER FUNCTION taptime_server.read_membership_name_v1(uuid) OWNER TO taptime_membership_rename_owner;
REVOKE ALL ON FUNCTION taptime_server.read_membership_name_v1(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.read_membership_name_v1(uuid) TO taptime_membership_manager;

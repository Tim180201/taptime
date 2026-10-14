-- T-119: fixed SECURITY DEFINER search paths and least-privilege owners.
-- Bodies are complete definitions of the installed functions; behavior and caller grants stay intact.
-- Migration creates these NOLOGIN roles. Future migrations maintain their grants; when the
-- corresponding functions are retired, a migration revokes privileges and drops the unused roles.
DO $owners$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'taptime_membership_guard_owner') THEN
    CREATE ROLE taptime_membership_guard_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION BYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'taptime_identity_lookup_owner') THEN
    CREATE ROLE taptime_identity_lookup_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION BYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'taptime_lifecycle_configuration_owner') THEN
    CREATE ROLE taptime_lifecycle_configuration_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION BYPASSRLS;
  END IF;
END
$owners$;
ALTER ROLE taptime_membership_guard_owner WITH NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION BYPASSRLS;
GRANT USAGE ON SCHEMA taptime_server TO taptime_membership_guard_owner;
ALTER ROLE taptime_identity_lookup_owner WITH NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION BYPASSRLS;
GRANT USAGE ON SCHEMA taptime_server TO taptime_identity_lookup_owner;
ALTER ROLE taptime_lifecycle_configuration_owner WITH NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION BYPASSRLS;
GRANT USAGE ON SCHEMA taptime_server TO taptime_lifecycle_configuration_owner;

-- BYPASSRLS avoids recursive membership policies and allows identity lookup before a tenant
-- is known. Access is limited to the columns read by these functions; no caller is a member.
GRANT SELECT (organization_id, user_id, role, revoked_at) ON taptime_server.memberships TO taptime_membership_guard_owner;
GRANT EXECUTE ON FUNCTION taptime_server.current_user_id(), taptime_server.current_organization_id() TO taptime_membership_guard_owner;

GRANT SELECT (user_id, issuer, subject, revoked_at), UPDATE (user_id) ON taptime_server.identity_bindings TO taptime_identity_lookup_owner;
GRANT SELECT (id) ON taptime_server.users TO taptime_identity_lookup_owner;
GRANT SELECT (id, user_id, organization_id, role, revoked_at), UPDATE (id) ON taptime_server.memberships TO taptime_identity_lookup_owner;
GRANT SELECT (id, status), UPDATE (id) ON taptime_server.organizations TO taptime_identity_lookup_owner;

-- PostgreSQL row locks require UPDATE on at least one column of each locked table.
GRANT SELECT (id, organization_id, user_id, revoked_at) ON taptime_server.memberships TO taptime_lifecycle_configuration_owner;
GRANT SELECT (organization_id, target_type, target_id), UPDATE (target_id) ON taptime_server.work_targets TO taptime_lifecycle_configuration_owner;
GRANT SELECT (id, organization_id, nfc_tag_id, assignment_type, target_type, target_customer_id, active, valid_from, valid_to), UPDATE (id)
  ON taptime_server.nfc_assignments TO taptime_lifecycle_configuration_owner;
GRANT SELECT (id, organization_id, created_at), UPDATE (id) ON taptime_server.nfc_tags TO taptime_lifecycle_configuration_owner;
GRANT SELECT (id, organization_id, active, activated_at, deactivated_at), UPDATE (id)
  ON taptime_server.customers TO taptime_lifecycle_configuration_owner;

CREATE OR REPLACE FUNCTION taptime_server.append_administrative_audit_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  audit_organization_id uuid;
  audit_entity_id uuid;
  audit_event_type text;
  audit_entity_type text;
  audit_payload jsonb;
  audit_correlation_id text;
  selected_role text := pg_catalog.current_setting('role', true);
BEGIN
  IF selected_role NOT IN (
    'taptime_administrator',
    'taptime_admin_setup',
    'taptime_employee_invitation_creator',
    'taptime_employee_enrollment_redeemer',
    'taptime_assignment_reassigner'
  ) THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF selected_role = 'taptime_admin_setup' AND NOT (
    (TG_OP = 'INSERT' AND TG_TABLE_NAME IN ('customers', 'nfc_tags', 'nfc_assignments'))
    OR (TG_OP = 'UPDATE' AND TG_TABLE_NAME IN ('customers','nfc_assignments'))
    OR (
      TG_OP = 'UPDATE'
      AND TG_TABLE_NAME = 'organizations'
      AND (pg_catalog.to_jsonb(NEW) ->> 'locations_enabled')::boolean IS DISTINCT FROM
          (pg_catalog.to_jsonb(OLD) ->> 'locations_enabled')::boolean
      AND (pg_catalog.to_jsonb(NEW) ->> 'name') = (pg_catalog.to_jsonb(OLD) ->> 'name')
    )
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
  IF selected_role = 'taptime_assignment_reassigner' AND NOT (
    TG_TABLE_NAME = 'nfc_assignments' AND TG_OP IN ('INSERT', 'UPDATE')
  ) THEN
    RAISE EXCEPTION 'Reassignment operation is not audit-allowlisted: %.%', TG_TABLE_NAME, TG_OP
      USING ERRCODE = '42501';
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
  audit_correlation_id := NULLIF(pg_catalog.current_setting('app.correlation_id', true), '');
  IF audit_correlation_id IS NULL THEN
    RAISE EXCEPTION 'Administrative audit correlation context is required' USING ERRCODE = '42501';
  END IF;
  IF selected_role IN (
    'taptime_admin_setup',
    'taptime_employee_invitation_creator',
    'taptime_employee_enrollment_redeemer',
    'taptime_assignment_reassigner'
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
      'expiresAt', pg_catalog.to_char(
        NEW.expires_at AT TIME ZONE 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      )
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
    audit_payload := CASE
      WHEN (pg_catalog.to_jsonb(NEW) ->> 'locations_enabled')::boolean IS DISTINCT FROM
           (pg_catalog.to_jsonb(OLD) ->> 'locations_enabled')::boolean THEN
        pg_catalog.jsonb_build_object(
          'changedFields', pg_catalog.jsonb_build_array('locationsEnabled'),
          'locationsEnabled', (pg_catalog.to_jsonb(NEW) ->> 'locations_enabled')::boolean,
          'rowVersion', NEW.row_version
        )
      ELSE
        pg_catalog.jsonb_build_object(
          'changedFields', pg_catalog.jsonb_build_array('name'),
          'rowVersion', NEW.row_version
        )
    END;
  ELSIF TG_TABLE_NAME = 'memberships' AND TG_OP = 'INSERT' THEN
    audit_event_type := 'MembershipGranted';
    audit_entity_type := 'Membership';
    audit_payload := pg_catalog.jsonb_build_object('role', NEW.role);
  ELSIF TG_TABLE_NAME = 'memberships' AND TG_OP = 'UPDATE' THEN
    audit_event_type := CASE
      WHEN NEW.revoked_at IS NOT NULL THEN 'MembershipRevoked'
      ELSE 'MembershipRoleChanged'
    END;
    audit_entity_type := 'Membership';
    audit_payload := pg_catalog.jsonb_build_object(
      'role', NEW.role,
      'revoked', NEW.revoked_at IS NOT NULL,
      'rowVersion', NEW.row_version
    );
  ELSIF TG_TABLE_NAME = 'customers' THEN
    audit_event_type := CASE TG_OP
      WHEN 'INSERT' THEN 'CustomerCreated'
      WHEN 'UPDATE' THEN CASE WHEN NEW.active THEN 'CustomerRenamed' ELSE 'CustomerDeactivated' END
      WHEN 'DELETE' THEN 'CustomerDeleted'
    END;
    audit_entity_type := 'Customer';
    audit_payload := CASE WHEN TG_OP = 'UPDATE'
      THEN pg_catalog.jsonb_build_object('active', NEW.active, 'rowVersion', NEW.row_version,
        'oldName',OLD.display_name,'newName',CASE WHEN NEW.active THEN NEW.display_name ELSE NULL END,
        'membershipId',current_setting('app.membership_id',true), 'action',CASE WHEN NEW.active THEN 'rename' ELSE 'deactivate' END)
      ELSE '{}'::jsonb
    END;
  ELSIF TG_TABLE_NAME = 'nfc_tags' THEN
    audit_event_type := CASE WHEN TG_OP = 'INSERT' THEN 'NfcTagRegistered' ELSE 'NfcTagDeleted' END;
    audit_entity_type := 'NfcTag';
    audit_payload := '{}'::jsonb;
  ELSIF TG_TABLE_NAME = 'nfc_assignments' THEN
    audit_event_type := CASE
      WHEN TG_OP = 'INSERT' THEN 'NfcTagAssigned'
      ELSE 'NfcAssignmentDeactivated'
    END;
    audit_entity_type := 'NfcAssignment';
    audit_payload := CASE WHEN TG_OP = 'UPDATE'
      THEN pg_catalog.jsonb_build_object('active', NEW.active, 'rowVersion', NEW.row_version)
      ELSE '{}'::jsonb
    END;
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
$function$;

CREATE OR REPLACE FUNCTION taptime_server.append_location_setup_audit_event_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  authorized boolean;
  event_type text;
  entity_type text;
  payload jsonb;
  correlation_id text := NULLIF(pg_catalog.current_setting('app.correlation_id', true), '');
BEGIN
  IF pg_catalog.current_setting('role', true) <> 'taptime_admin_setup' THEN
    RETURN NEW;
  END IF;
  authorized := taptime_server.has_current_admin_setup_authority(NEW.organization_id);
  IF TG_TABLE_NAME = 'work_target_location_assignments' AND TG_OP = 'INSERT' THEN
    authorized := authorized OR (NEW.target_type = 'customer'
      AND taptime_server.has_current_customer_creation_authority_v1(NEW.organization_id, NEW.location_id)
      AND taptime_server.is_current_customer_creation_v1(NEW.organization_id, NEW.target_id));
  END IF;
  IF TG_TABLE_NAME='work_target_location_assignments' AND TG_OP='UPDATE' THEN
    authorized:=authorized OR (NEW.target_type='customer' AND OLD.revoked_at IS NULL AND NEW.revoked_at IS NOT NULL
      AND taptime_server.is_current_customer_deactivation_v1(NEW.organization_id,NEW.target_id));
  END IF;
  IF NOT authorized
    OR correlation_id COLLATE "C"
       !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  THEN
    RAISE EXCEPTION 'Location setup audit context rejected' USING ERRCODE = '42501';
  END IF;

  IF TG_TABLE_NAME = 'locations' THEN
    entity_type := 'Location';
    IF TG_OP = 'INSERT' THEN
      event_type := 'LocationCreated';
      payload := pg_catalog.jsonb_build_object('displayName', NEW.display_name);
    ELSIF NEW.active IS FALSE THEN
      event_type := 'LocationDeactivated';
      payload := pg_catalog.jsonb_build_object('rowVersion', NEW.row_version);
    ELSE
      event_type := 'LocationRenamed';
      payload := pg_catalog.jsonb_build_object(
        'beforeDisplayName', OLD.display_name,
        'displayName', NEW.display_name,
        'rowVersion', NEW.row_version
      );
    END IF;
  ELSIF TG_TABLE_NAME = 'membership_home_location_assignments' THEN
    event_type := CASE WHEN TG_OP = 'INSERT' THEN 'HomeLocationAssigned'
      ELSE 'HomeLocationRevoked' END;
    entity_type := 'MembershipHomeLocationAssignment';
    payload := pg_catalog.jsonb_build_object(
      'membershipId', NEW.membership_id, 'locationId', NEW.location_id
    );
  ELSIF TG_TABLE_NAME = 'membership_work_location_grants' THEN
    event_type := CASE WHEN TG_OP = 'INSERT' THEN 'WorkLocationGranted'
      ELSE 'WorkLocationRevoked' END;
    entity_type := 'MembershipWorkLocationGrant';
    payload := pg_catalog.jsonb_build_object(
      'membershipId', NEW.membership_id, 'locationId', NEW.location_id
    );
  ELSIF TG_TABLE_NAME = 'membership_management_location_grants' THEN
    event_type := CASE WHEN TG_OP = 'INSERT' THEN 'ManagementLocationGranted'
      ELSE 'ManagementLocationRevoked' END;
    entity_type := 'MembershipManagementLocationGrant';
    payload := pg_catalog.jsonb_build_object(
      'membershipId', NEW.membership_id, 'locationId', NEW.location_id
    );
  ELSIF TG_TABLE_NAME = 'work_target_location_assignments' THEN
    event_type := CASE WHEN TG_OP = 'INSERT' THEN 'WorkTargetLocationAssigned'
      ELSE 'WorkTargetLocationRevoked' END;
    entity_type := 'WorkTargetLocationAssignment';
    payload := pg_catalog.jsonb_build_object(
      'targetType', NEW.target_type, 'targetId', NEW.target_id,
      'locationId', NEW.location_id
    );
  ELSE
    RAISE EXCEPTION 'Location setup audit table rejected' USING ERRCODE = '42501';
  END IF;

  INSERT INTO taptime_server.audit_events (
    id, organization_id, actor_user_id, operator_principal, event_type, entity_type,
    entity_id, occurred_at, correlation_id, payload
  ) VALUES (
    pg_catalog.gen_random_uuid(), NEW.organization_id, taptime_server.current_user_id(), NULL,
    event_type, entity_type, NEW.id, pg_catalog.transaction_timestamp(), correlation_id, payload
  );
  RETURN NEW;
END
$function$;

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
$function$;

CREATE OR REPLACE FUNCTION taptime_server.create_employee_membership_invitation_data_v1(requested_command_id uuid, requested_invitation_id uuid, requested_display_name text, requested_token_digest bytea)
 RETURNS TABLE(result_status text, result_expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION taptime_server.create_employee_membership_invitation_v1(requested_command_id uuid, requested_invitation_id uuid, requested_display_name text, requested_token_digest bytea)
 RETURNS TABLE(result_status text, result_expires_at timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
  SELECT * FROM taptime_server.create_employee_membership_invitation_data_v1(
    requested_command_id, requested_invitation_id, requested_display_name, requested_token_digest
  )
$function$;

CREATE OR REPLACE FUNCTION taptime_server.create_membership_invitation_v3(requested_command_id uuid, requested_invitation_id uuid, requested_display_name text, requested_membership_role text, requested_home_location_id uuid, requested_token_digest bytea)
 RETURNS TABLE(result_status text, result_expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  context_organization_id uuid := NULLIF(pg_catalog.current_setting('app.organization_id', true), '')::uuid;
  context_user_id uuid := NULLIF(pg_catalog.current_setting('app.user_id', true), '')::uuid;
  context_membership_id uuid := NULLIF(pg_catalog.current_setting('app.membership_id', true), '')::uuid;
  canonical_name text;
  request_hash bytea;
  request_hash_version smallint;
  existing_receipt taptime_server.employee_invitation_command_receipts%ROWTYPE;
  invitation_expiry timestamptz;
  active_count integer;
BEGIN
  IF pg_catalog.current_setting('role', true) <> 'taptime_membership_manager'
    OR requested_command_id IS NULL
    OR requested_invitation_id IS NULL
    OR requested_membership_role NOT IN ('administrator', 'standortleitung', 'employee')
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
  IF NOT EXISTS (
    SELECT 1
    FROM taptime_server.has_membership_management_authority_v1(
      context_organization_id, context_user_id, context_membership_id,
      'invite', NULL, requested_membership_role, requested_home_location_id
    )
  ) THEN
    RETURN QUERY SELECT 'forbidden', NULL::timestamptz;
    RETURN;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'taptime:t009:membership-invitation-command:' || context_organization_id::text
      || ':' || requested_command_id::text, 0
  ));
  IF requested_home_location_id IS NULL THEN
    request_hash_version := 1;
    request_hash := taptime_server.membership_invitation_request_digest_v2(
      context_organization_id, context_user_id, context_membership_id,
      canonical_name, requested_membership_role
    );
  ELSE
    request_hash_version := 2;
    request_hash := taptime_server.membership_invitation_request_digest_v3(
      context_organization_id, context_user_id, context_membership_id,
      canonical_name, requested_membership_role, requested_home_location_id
    );
  END IF;
  SELECT receipt.* INTO existing_receipt
  FROM taptime_server.employee_invitation_command_receipts AS receipt
  WHERE receipt.organization_id = context_organization_id
    AND receipt.command_id = requested_command_id;
  IF FOUND THEN
    IF existing_receipt.actor_user_id = context_user_id
      AND existing_receipt.membership_id = context_membership_id
      AND existing_receipt.request_hash_version = request_hash_version
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
    membership_role, home_location_id, token_digest, expires_at
  ) VALUES (
    requested_invitation_id, context_organization_id, context_user_id,
    context_membership_id, canonical_name, requested_membership_role,
    requested_home_location_id, requested_token_digest, invitation_expiry
  );
  INSERT INTO taptime_server.employee_invitation_command_receipts (
    organization_id, command_id, actor_user_id, membership_id, request_hash_version,
    request_hash, invitation_id, expires_at
  ) VALUES (
    context_organization_id, requested_command_id, context_user_id,
    context_membership_id, request_hash_version, request_hash,
    requested_invitation_id, invitation_expiry
  );
  RETURN QUERY SELECT 'succeeded', invitation_expiry;
END
$function$;

CREATE OR REPLACE FUNCTION taptime_server.has_active_administrator_membership(requested_organization_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM taptime_server.memberships AS membership
    WHERE membership.organization_id = requested_organization_id
      AND membership.user_id = taptime_server.current_user_id()
      AND membership.role = 'administrator'
      AND membership.revoked_at IS NULL
  )
$function$;
ALTER FUNCTION taptime_server.has_active_administrator_membership(uuid) OWNER TO taptime_membership_guard_owner;

CREATE OR REPLACE FUNCTION taptime_server.has_active_membership(requested_organization_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM taptime_server.memberships AS membership
    WHERE membership.organization_id = requested_organization_id
      AND membership.user_id = taptime_server.current_user_id()
      AND membership.revoked_at IS NULL
  )
$function$;
ALTER FUNCTION taptime_server.has_active_membership(uuid) OWNER TO taptime_membership_guard_owner;

CREATE OR REPLACE FUNCTION taptime_server.lock_lifecycle_configuration(requested_organization_id uuid, requested_assignment_id uuid)
 RETURNS TABLE(assignment_id uuid, nfc_tag_id uuid, assignment_type text, target_type text, target_customer_id uuid, assignment_active boolean, assignment_valid_from timestamp with time zone, assignment_valid_to timestamp with time zone, tag_created_at timestamp with time zone, customer_active boolean, customer_activated_at timestamp with time zone, customer_deactivated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER ROWS 1
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  locked_customer_id uuid;
BEGIN
  PERFORM 1 FROM taptime_server.work_targets target
  WHERE target.organization_id=requested_organization_id AND target.target_type='customer'
    AND requested_organization_id=NULLIF(current_setting('app.organization_id',true),'')::uuid
    AND target.target_id=(SELECT a.target_customer_id FROM taptime_server.nfc_assignments a WHERE a.organization_id=requested_organization_id AND a.id=requested_assignment_id)
  FOR UPDATE;
  SELECT assignment.target_customer_id INTO locked_customer_id
  FROM taptime_server.nfc_assignments AS assignment
  JOIN taptime_server.nfc_tags AS tag
    ON tag.organization_id = assignment.organization_id
   AND tag.id = assignment.nfc_tag_id
  WHERE requested_organization_id = NULLIF(
      pg_catalog.current_setting('app.organization_id', true), ''
    )::uuid
    AND assignment.organization_id = requested_organization_id
    AND assignment.id = requested_assignment_id
    AND EXISTS (
      SELECT 1 FROM taptime_server.memberships AS membership
      WHERE membership.organization_id = requested_organization_id
        AND membership.user_id = NULLIF(
          pg_catalog.current_setting('app.user_id', true), ''
        )::uuid
        AND membership.id = NULLIF(
          pg_catalog.current_setting('app.membership_id', true), ''
        )::uuid
        AND membership.revoked_at IS NULL
    )
  FOR SHARE OF assignment, tag;
  IF NOT FOUND THEN RETURN; END IF;
  IF locked_customer_id IS NOT NULL THEN
    PERFORM 1 FROM taptime_server.customers AS customer
    WHERE customer.organization_id = requested_organization_id
      AND customer.id = locked_customer_id
    FOR SHARE;
  END IF;

  RETURN QUERY
  SELECT assignment.id, tag.id, assignment.assignment_type,
         assignment.target_type, assignment.target_customer_id,
         assignment.active, assignment.valid_from, assignment.valid_to,
         tag.created_at, customer.active, customer.activated_at,
         customer.deactivated_at
  FROM taptime_server.nfc_assignments AS assignment
  JOIN taptime_server.nfc_tags AS tag
    ON tag.organization_id = assignment.organization_id
   AND tag.id = assignment.nfc_tag_id
  LEFT JOIN taptime_server.customers AS customer
    ON customer.organization_id = assignment.organization_id
   AND customer.id = assignment.target_customer_id
  WHERE requested_organization_id = NULLIF(
      pg_catalog.current_setting('app.organization_id', true), ''
    )::uuid
    AND assignment.organization_id = requested_organization_id
    AND assignment.id = requested_assignment_id
    AND EXISTS (
      SELECT 1 FROM taptime_server.memberships AS membership
      WHERE membership.organization_id = requested_organization_id
        AND membership.user_id = NULLIF(
          pg_catalog.current_setting('app.user_id', true), ''
        )::uuid
        AND membership.id = NULLIF(
          pg_catalog.current_setting('app.membership_id', true), ''
        )::uuid
        AND membership.revoked_at IS NULL
    )
  ;
END
$function$;
ALTER FUNCTION taptime_server.lock_lifecycle_configuration(uuid,uuid) OWNER TO taptime_lifecycle_configuration_owner;

CREATE OR REPLACE FUNCTION taptime_server.lock_request_actor(verified_issuer text, verified_subject text)
 RETURNS TABLE(user_id uuid, organization_id uuid, membership_id uuid, membership_role text)
 LANGUAGE plpgsql
 SECURITY DEFINER ROWS 1
 SET search_path TO 'pg_catalog'
AS $function$
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
END $function$;
ALTER FUNCTION taptime_server.lock_request_actor(text,text) OWNER TO taptime_identity_lookup_owner;

CREATE OR REPLACE FUNCTION taptime_server.manage_membership_v1(requested_command_id uuid, requested_target_membership_id uuid, requested_expected_row_version bigint, requested_command_type text, requested_membership_role text)
 RETURNS TABLE(result_status text, result_role text, result_active boolean, result_row_version bigint, result_idempotent_retry boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
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
      AND requested_membership_role NOT IN ('administrator', 'standortleitung', 'employee'))
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
  IF target.revoked_at IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM taptime_server.has_membership_management_authority_v1(
      context_organization_id,context_user_id,context_membership_id,'read',NULL,NULL,NULL) scope
      WHERE scope.scope_kind='organization' OR (requested_command_type='revoke' AND target.role='employee'
        AND scope.scope_kind='location' AND scope.location_id=taptime_server.membership_management_home_v1(context_organization_id,target.id))) THEN
      RETURN QUERY SELECT 'already_departed',NULL::text,NULL::boolean,NULL::bigint,false;
    ELSE
      RETURN QUERY SELECT 'forbidden',NULL::text,NULL::boolean,NULL::bigint,false;
    END IF;
    RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM taptime_server.has_membership_management_authority_v1(
      context_organization_id, context_user_id, context_membership_id,
      requested_command_type, requested_target_membership_id,
      requested_membership_role, NULL
    )
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
      OR (
        requested_command_type = 'change_role'
        AND requested_membership_role <> 'administrator'
      )
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
    -- The identity resolver locks membership before the lifecycle person lock. Keep that order.
    PERFORM pg_advisory_xact_lock(hashtextextended(context_organization_id::text||chr(31)||target.user_id::text,0));
    IF EXISTS (SELECT 1 FROM taptime_server.time_entries e WHERE e.organization_id=context_organization_id
      AND e.user_id=target.user_id AND e.status='started') THEN
      RETURN QUERY SELECT 'running_time_active',NULL::text,NULL::boolean,NULL::bigint,false;
      RETURN;
    END IF;
    UPDATE taptime_server.memberships
    SET revoked_at = COALESCE((SELECT stop.stopped_at FROM taptime_server.administration_stop_commands stop
      WHERE stop.organization_id=context_organization_id AND stop.command_id=requested_command_id
        AND stop.actor_membership_id=context_membership_id AND stop.user_id=target.user_id
        AND stop.request_payload->>'revocationExpectedRowVersion'=requested_expected_row_version::text), clock_timestamp()), row_version = row_version + 1
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
$function$;

CREATE OR REPLACE FUNCTION taptime_server.read_administration_session_v2(requested_organization_id uuid, requested_actor_user_id uuid, requested_actor_membership_id uuid)
 RETURNS TABLE(locations_enabled boolean, setup_available boolean, employees_available boolean, time_records_available boolean, time_export_available boolean, review_items_available boolean, management_scope_kind text, management_location_id uuid, management_location_name text, nfc_setup_available boolean, role text, own_time_available boolean, manual_capture_available boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  actor_role text;
  feature_enabled boolean;
BEGIN
  IF pg_catalog.current_setting('role', true) <> 'taptime_identity_resolver'
    OR requested_organization_id IS NULL
    OR requested_actor_user_id IS NULL
    OR requested_actor_membership_id IS NULL
  THEN
    RETURN;
  END IF;

  SELECT membership.role, organization.locations_enabled
  INTO actor_role, feature_enabled
  FROM taptime_server.organizations AS organization
  JOIN taptime_server.memberships AS membership
    ON membership.organization_id = organization.id
   AND membership.user_id = requested_actor_user_id
   AND membership.id = requested_actor_membership_id
   AND membership.revoked_at IS NULL
  WHERE organization.id = requested_organization_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  PERFORM pg_catalog.set_config(
    'app.organization_id', requested_organization_id::text, true
  );
  PERFORM pg_catalog.set_config('app.user_id', requested_actor_user_id::text, true);
  PERFORM pg_catalog.set_config(
    'app.membership_id', requested_actor_membership_id::text, true
  );
  PERFORM pg_catalog.set_config('app.membership_role', actor_role, true);

  RETURN QUERY
  WITH membership_scope AS MATERIALIZED (
    SELECT authority.scope_kind, authority.location_id
    FROM taptime_server.has_membership_management_authority_v1(
      requested_organization_id, requested_actor_user_id,
      requested_actor_membership_id, 'read', NULL, NULL, NULL
    ) AS authority
  ),
  section_authority AS MATERIALIZED (
    SELECT
      taptime_server.has_current_admin_setup_authority(
        requested_organization_id
      ) AS setup_available,
      EXISTS (SELECT 1 FROM membership_scope) AS employees_available,
      EXISTS (SELECT 1 FROM taptime_server.has_time_management_authority_v1(
        requested_organization_id, requested_actor_user_id,
        requested_actor_membership_id, NULL
      )) AS time_review_available,
      taptime_server.has_current_time_export_authority(
        requested_organization_id
      ) AS time_export_available
  ),
  scope_shape AS MATERIALIZED (
    SELECT CASE
      WHEN EXISTS (
        SELECT 1 FROM membership_scope
        WHERE scope_kind = 'organization' AND location_id IS NULL
      ) THEN 'organization'::text
      ELSE 'locations'::text
    END AS scope_kind
  ),
  location_scope AS (
    SELECT scope.location_id, location.display_name
    FROM membership_scope AS scope
    JOIN taptime_server.locations AS location
      ON scope.scope_kind = 'location'
     AND scope.location_id = location.id
     AND location.organization_id = requested_organization_id
     AND location.active
  )
  SELECT feature_enabled,
         section_authority.setup_available,
         section_authority.employees_available,
         section_authority.time_review_available,
         section_authority.time_export_available,
         section_authority.time_review_available,
         scope_shape.scope_kind,
         location_scope.location_id,
         location_scope.display_name,
         taptime_server.has_current_nfc_setup_authority_v1(requested_organization_id, NULL),
         actor_role, true, true
  FROM section_authority
  CROSS JOIN scope_shape
  LEFT JOIN location_scope ON scope_shape.scope_kind = 'locations'
  ORDER BY location_scope.display_name, location_scope.location_id;
END
$function$;

CREATE OR REPLACE FUNCTION taptime_server.read_employee_memberships_projection_data_v1(requested_cursor uuid, requested_limit integer)
 RETURNS TABLE(organization_id uuid, organization_name text, membership_id uuid, membership_display_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION taptime_server.read_employee_memberships_projection_v1(requested_cursor uuid, requested_limit integer)
 RETURNS TABLE(organization_id uuid, organization_name text, membership_id uuid, membership_display_name text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
  SELECT * FROM taptime_server.read_employee_memberships_projection_data_v1(
    requested_cursor, requested_limit
  )
$function$;

CREATE OR REPLACE FUNCTION taptime_server.read_managed_memberships_v1(requested_cursor uuid, requested_limit integer)
 RETURNS TABLE(organization_id uuid, organization_name text, membership_id uuid, membership_display_name text, membership_role text, membership_active boolean, membership_row_version bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  context_organization_id uuid := NULLIF(pg_catalog.current_setting('app.organization_id', true), '')::uuid;
  context_user_id uuid := NULLIF(pg_catalog.current_setting('app.user_id', true), '')::uuid;
  context_membership_id uuid := NULLIF(pg_catalog.current_setting('app.membership_id', true), '')::uuid;
BEGIN
  IF pg_catalog.current_setting('role', true) <> 'taptime_membership_manager'
    OR requested_limit NOT BETWEEN 1 AND 20
  THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH management_scope AS MATERIALIZED (
    SELECT authority.scope_kind, authority.location_id
    FROM taptime_server.has_membership_management_authority_v1(
      context_organization_id, context_user_id, context_membership_id,
      'read', NULL, NULL, NULL
    ) AS authority
  )
  SELECT organization.id, organization.name, page.id,
         COALESCE(
           page.display_name,
           CASE page.role
             WHEN 'administrator' THEN 'Administrator'
             WHEN 'standortleitung' THEN 'Standortleitung'
             ELSE 'Beschäftigter'
           END
         ),
         page.role, page.revoked_at IS NULL, page.row_version
  FROM taptime_server.organizations AS organization
  LEFT JOIN LATERAL (
    SELECT membership.id, membership.display_name, membership.role,
           membership.revoked_at, membership.row_version
    FROM taptime_server.memberships AS membership
    WHERE membership.organization_id = organization.id
      AND (requested_cursor IS NULL OR membership.id > requested_cursor)
      AND (
        EXISTS (
          SELECT 1 FROM management_scope AS scope
          WHERE scope.scope_kind = 'organization' AND scope.location_id IS NULL
        )
        OR EXISTS (
          SELECT 1
          FROM taptime_server.membership_home_location_assignments AS home
          JOIN management_scope AS scope
            ON scope.scope_kind = 'location'
           AND scope.location_id = home.location_id
          WHERE home.organization_id = membership.organization_id
            AND home.membership_id = membership.id
            AND home.revoked_at IS NULL
        )
      )
    ORDER BY membership.id
    LIMIT requested_limit + 1
  ) AS page ON true
  WHERE organization.id = context_organization_id
    AND EXISTS (SELECT 1 FROM management_scope);
END
$function$;

CREATE OR REPLACE FUNCTION taptime_server.read_managed_memberships_v2(requested_location_id uuid, requested_cursor uuid, requested_limit integer)
 RETURNS TABLE(result_status text, organization_id uuid, organization_name text, membership_id uuid, membership_display_name text, membership_role text, membership_active boolean, membership_row_version bigint, location_id uuid, location_name text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
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
    OR requested_limit NOT BETWEEN 1 AND 20
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
      AND (requested_cursor IS NULL OR membership.id > requested_cursor)
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
    ORDER BY membership.id
    LIMIT requested_limit + 1
  ) AS page ON true
  WHERE organization.id = context_organization_id
    AND EXISTS (SELECT 1 FROM management_scope);
END
$function$;

CREATE OR REPLACE FUNCTION taptime_server.read_managed_memberships_v3(requested_location_id uuid, requested_search text, after_display_name text, requested_cursor uuid, requested_limit integer)
 RETURNS TABLE(result_status text, organization_id uuid, organization_name text, membership_id uuid, membership_display_name text, membership_role text, membership_active boolean, membership_row_version bigint, location_id uuid, location_name text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION taptime_server.record_password_reset_completed_v1()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION taptime_server.redeem_employee_membership_invitation_data_v2(requested_command_id uuid, requested_token_digest bytea, verified_issuer text, verified_subject text, generated_user_id uuid, generated_identity_binding_id uuid, generated_membership_id uuid)
 RETURNS TABLE(result_status text, result_organization_name text, result_membership_display_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION taptime_server.redeem_employee_membership_invitation_v1(requested_command_id uuid, requested_token_digest bytea, verified_issuer text, verified_subject text, generated_user_id uuid, generated_identity_binding_id uuid, generated_membership_id uuid)
 RETURNS TABLE(result_status text, result_organization_name text, result_membership_display_name text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
  SELECT * FROM taptime_server.redeem_employee_membership_invitation_data_v1(
    requested_command_id, requested_token_digest, verified_issuer, verified_subject,
    generated_user_id, generated_identity_binding_id, generated_membership_id
  )
$function$;

CREATE OR REPLACE FUNCTION taptime_server.redeem_membership_invitation_v2(requested_command_id uuid, requested_token_digest bytea, verified_issuer text, verified_subject text, generated_user_id uuid, generated_identity_binding_id uuid, generated_membership_id uuid)
 RETURNS TABLE(result_status text, result_organization_name text, result_membership_display_name text, result_membership_role text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION taptime_server.resolve_request_actor(verified_issuer text, verified_subject text)
 RETURNS TABLE(user_id uuid, organization_id uuid, membership_id uuid, membership_role text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER ROWS 1
 SET search_path TO 'pg_catalog'
AS $function$
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
END $function$;
ALTER FUNCTION taptime_server.resolve_request_actor(text,text) OWNER TO taptime_identity_lookup_owner;

CREATE OR REPLACE FUNCTION taptime_server.user_belongs_to_organization(candidate_user_id uuid, requested_organization_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM taptime_server.memberships AS membership
    WHERE membership.organization_id = requested_organization_id
      AND membership.user_id = candidate_user_id
  )
  AND requested_organization_id = taptime_server.current_organization_id()
  AND EXISTS (
    SELECT 1
    FROM taptime_server.memberships AS administrator_membership
    WHERE administrator_membership.organization_id = requested_organization_id
      AND administrator_membership.user_id = taptime_server.current_user_id()
      AND administrator_membership.role = 'administrator'
      AND administrator_membership.revoked_at IS NULL
  )
$function$;
ALTER FUNCTION taptime_server.user_belongs_to_organization(uuid,uuid) OWNER TO taptime_membership_guard_owner;


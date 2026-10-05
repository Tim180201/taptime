-- T-100: existing Customer / assignment lifecycle, immutable audits also acknowledge commands.
-- Administrators and current Location managers rename or deactivate; no reactivation.
-- Audit history is append-only and follows the existing organization retention lifecycle.
CREATE FUNCTION taptime_server.has_current_customer_management_authority_v1(
  requested_organization_id uuid, requested_customer_id uuid
)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog
AS $authority$
  SELECT COALESCE(
    requested_organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid
    AND EXISTS (
      SELECT 1 FROM taptime_server.memberships AS actor
      JOIN taptime_server.organizations AS organization ON organization.id = actor.organization_id
      WHERE actor.organization_id = requested_organization_id
        AND actor.user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
        AND actor.id = NULLIF(current_setting('app.membership_id', true), '')::uuid
        AND actor.role = current_setting('app.membership_role', true)
        AND actor.revoked_at IS NULL AND organization.status = 'active'
        AND (
          actor.role = 'administrator'
          OR (actor.role = 'standortleitung' AND organization.locations_enabled AND EXISTS (
            SELECT 1 FROM taptime_server.membership_management_location_grants AS grant_scope
            JOIN taptime_server.locations AS location
              ON location.organization_id = grant_scope.organization_id
             AND location.id = grant_scope.location_id AND location.active
            WHERE grant_scope.organization_id = actor.organization_id
              AND grant_scope.membership_id = actor.id AND grant_scope.revoked_at IS NULL
              AND (requested_customer_id IS NULL OR EXISTS (
                SELECT 1 FROM taptime_server.work_target_location_assignments AS binding
                JOIN taptime_server.work_targets AS target
                  ON target.organization_id = binding.organization_id
                 AND target.target_type = binding.target_type AND target.target_id = binding.target_id
                JOIN taptime_server.customers AS customer
                  ON customer.organization_id = target.organization_id AND customer.id = target.target_id
                WHERE binding.organization_id = location.organization_id AND binding.location_id = location.id
                  AND (binding.revoked_at IS NULL OR (NOT customer.active AND binding.id=(
                    SELECT last_binding.id FROM taptime_server.work_target_location_assignments last_binding
                    WHERE last_binding.organization_id=customer.organization_id AND last_binding.target_type='customer' AND last_binding.target_id=customer.id
                    ORDER BY last_binding.assigned_at DESC,last_binding.id DESC LIMIT 1))) AND binding.target_type = 'customer'
                  AND customer.id = requested_customer_id
              ))
          ))
        )
    ), false)
$authority$;

ALTER FUNCTION taptime_server.has_current_customer_management_authority_v1(uuid,uuid) OWNER TO taptime_admin_setup_data_function_owner;
REVOKE ALL ON FUNCTION taptime_server.has_current_customer_management_authority_v1(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.has_current_customer_management_authority_v1(uuid,uuid)
  TO taptime_admin_setup,taptime_admin_setup_function_owner;
GRANT SELECT ON taptime_server.customers,taptime_server.nfc_assignments,taptime_server.work_targets,taptime_server.time_entries
  TO taptime_admin_setup_data_function_owner;
GRANT UPDATE (display_name,active,deactivated_at,row_version) ON taptime_server.customers TO taptime_admin_setup_data_function_owner;
GRANT UPDATE (active,valid_to,row_version) ON taptime_server.nfc_assignments TO taptime_admin_setup_data_function_owner;
GRANT UPDATE (active) ON taptime_server.work_targets TO taptime_admin_setup_data_function_owner;

CREATE FUNCTION taptime_server.enforce_customer_update_v1() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $shape$
BEGIN
  IF (to_jsonb(NEW)-ARRAY['display_name','active','deactivated_at','row_version','updated_at'])
       IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['display_name','active','deactivated_at','row_version','updated_at'])
    OR NOT OLD.active OR NEW.row_version<>OLD.row_version+1
    OR (NEW.active AND NEW.deactivated_at IS NOT NULL)
    OR (NOT NEW.active AND (NEW.deactivated_at IS NULL OR NEW.display_name<>OLD.display_name))
  THEN RAISE EXCEPTION 'Invalid Customer update shape' USING ERRCODE='23514'; END IF;
  NEW.updated_at:=clock_timestamp(); RETURN NEW;
END $shape$;
REVOKE ALL ON FUNCTION taptime_server.enforce_customer_update_v1() FROM PUBLIC;
DROP TRIGGER customers_administrator_update_shape ON taptime_server.customers;
CREATE TRIGGER customers_administrator_update_shape BEFORE UPDATE ON taptime_server.customers
 FOR EACH ROW EXECUTE FUNCTION taptime_server.enforce_customer_update_v1();

CREATE FUNCTION taptime_server.manage_customer_v1(requested_customer uuid,requested_action text,requested_name text,requested_command uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $manage$
DECLARE
 org uuid:=NULLIF(current_setting('app.organization_id',true),'')::uuid;
 actor uuid:=NULLIF(current_setting('app.membership_id',true),'')::uuid;
 canonical text;
 prior record;
 customer taptime_server.customers%ROWTYPE;
 deletion_time timestamptz;
BEGIN
 IF current_setting('role',true) IS DISTINCT FROM 'taptime_admin_setup' OR requested_customer IS NULL
   OR NOT taptime_server.has_current_customer_management_authority_v1(org,requested_customer)
 THEN RAISE EXCEPTION 'Customer authority rejected' USING ERRCODE='42501'; END IF;
 IF requested_command IS NULL OR requested_command::text IS DISTINCT FROM current_setting('app.correlation_id',true)
   OR requested_action NOT IN ('rename','deactivate') OR requested_action IS NULL
 THEN RAISE EXCEPTION 'Invalid customer command' USING ERRCODE='22023'; END IF;
 canonical:=CASE WHEN requested_action='rename' THEN taptime_server.normalize_taptime_name_v1(requested_name,'customer') ELSE NULL END;
 IF (requested_action='rename' AND canonical IS NULL) OR (requested_action='deactivate' AND requested_name IS NOT NULL)
 THEN RETURN 'invalid_request'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('taptime:t015e:location-setup:v1:'||org::text,0));
 PERFORM pg_advisory_xact_lock(hashtextextended('customer-management:'||org::text||':'||requested_command::text,0));
 IF NOT taptime_server.has_current_customer_management_authority_v1(org,requested_customer)
 THEN RAISE EXCEPTION 'Customer scope changed' USING ERRCODE='42501'; END IF;
 SELECT entity_id,actor_user_id,payload,event_type INTO prior FROM taptime_server.audit_events
 WHERE organization_id=org AND correlation_id=requested_command::text AND entity_type='Customer'
 LIMIT 1;
 IF FOUND THEN
   IF prior.entity_id=requested_customer AND prior.actor_user_id=NULLIF(current_setting('app.user_id',true),'')::uuid
     AND prior.payload->>'membershipId'=actor::text AND prior.payload->>'action'=requested_action
     AND prior.payload->>'newName' IS NOT DISTINCT FROM canonical
   THEN RETURN 'succeeded'; END IF;
   RETURN 'command_id_conflict';
 END IF;
 -- Shared ordering with manual, NFC and offline capture: target, assignments, customer.
 PERFORM 1 FROM taptime_server.work_targets WHERE organization_id=org AND target_type='customer' AND target_id=requested_customer FOR UPDATE;
 PERFORM 1 FROM taptime_server.nfc_assignments WHERE organization_id=org AND target_customer_id=requested_customer AND active ORDER BY id FOR UPDATE;
 SELECT * INTO customer FROM taptime_server.customers WHERE organization_id=org AND id=requested_customer FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Customer authority rejected' USING ERRCODE='42501'; END IF;
 IF NOT customer.active THEN RETURN 'customer_unavailable'; END IF;
 IF requested_action='deactivate' THEN
   IF EXISTS(SELECT 1 FROM taptime_server.time_entries WHERE organization_id=org AND target_type='customer' AND target_customer_id=requested_customer AND status='started')
   THEN RETURN 'running_time'; END IF;
   deletion_time:=clock_timestamp();
   UPDATE taptime_server.nfc_assignments SET active=false,valid_to=deletion_time,row_version=row_version+1
     WHERE organization_id=org AND target_customer_id=requested_customer AND active;
   UPDATE taptime_server.customers SET active=false,deactivated_at=deletion_time,row_version=row_version+1
     WHERE organization_id=org AND id=requested_customer;
 ELSE
   UPDATE taptime_server.customers SET display_name=canonical,row_version=row_version+1 WHERE organization_id=org AND id=requested_customer;
 END IF;
 RETURN 'succeeded';
END $manage$;
ALTER FUNCTION taptime_server.manage_customer_v1(uuid,text,text,uuid) OWNER TO taptime_admin_setup_data_function_owner;
REVOKE ALL ON FUNCTION taptime_server.manage_customer_v1(uuid,text,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.manage_customer_v1(uuid,text,text,uuid) TO taptime_admin_setup;

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
$audit$;

CREATE OR REPLACE FUNCTION taptime_server.lock_lifecycle_configuration(
  requested_organization_id uuid,
  requested_assignment_id uuid
)
RETURNS TABLE (
  assignment_id uuid,
  nfc_tag_id uuid,
  assignment_type text,
  target_type text,
  target_customer_id uuid,
  assignment_active boolean,
  assignment_valid_from timestamptz,
  assignment_valid_to timestamptz,
  tag_created_at timestamptz,
  customer_active boolean,
  customer_activated_at timestamptz,
  customer_deactivated_at timestamptz
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, taptime_server, pg_temp
ROWS 1
AS $configuration$
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
$configuration$;
GRANT SELECT, UPDATE(active) ON taptime_server.work_targets TO taptime_offline_event_function_owner;

CREATE OR REPLACE FUNCTION taptime_server.lock_offline_historical_configuration_v1(
  requested_organization_id uuid,
  requested_assignment_id uuid,
  requested_nfc_tag_id uuid,
  requested_target_customer_id uuid
)
RETURNS TABLE (
  assignment_id uuid,
  nfc_tag_id uuid,
  target_type text,
  target_customer_id uuid,
  assignment_active boolean,
  assignment_valid_from timestamptz,
  assignment_valid_to timestamptz,
  tag_created_at timestamptz,
  customer_active boolean,
  customer_activated_at timestamptz,
  customer_deactivated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $configuration$
BEGIN
  IF pg_catalog.current_setting('role', true) <> 'taptime_offline_event_ingestor'
    OR requested_organization_id IS NULL
    OR requested_organization_id <> NULLIF(
      pg_catalog.current_setting('app.organization_id', true), ''
    )::uuid
  THEN
    RAISE EXCEPTION 'Offline historical configuration capability rejected'
      USING ERRCODE = '42501';
  END IF;

  PERFORM 1 FROM taptime_server.work_targets target WHERE target.organization_id=requested_organization_id
    AND target.target_type='customer' AND target.target_id=requested_target_customer_id FOR UPDATE;
  RETURN QUERY
  SELECT assignment.id, assignment.nfc_tag_id, assignment.target_type,
         assignment.target_customer_id, assignment.active, assignment.valid_from,
         assignment.valid_to, tag.created_at, customer.active, customer.activated_at,
         customer.deactivated_at
  FROM taptime_server.nfc_assignments AS assignment
  JOIN taptime_server.nfc_tags AS tag
    ON tag.organization_id = assignment.organization_id
   AND tag.id = assignment.nfc_tag_id
  JOIN taptime_server.customers AS customer
    ON customer.organization_id = assignment.organization_id
   AND customer.id = assignment.target_customer_id
  WHERE assignment.organization_id = requested_organization_id
    AND assignment.id = requested_assignment_id
    AND assignment.nfc_tag_id = requested_nfc_tag_id
    AND assignment.target_type = 'customer'
    AND assignment.target_customer_id = requested_target_customer_id
  FOR SHARE OF assignment, tag, customer;
END
$configuration$;

ALTER TABLE taptime_server.offline_event_reconciliations
  DROP CONSTRAINT offline_reconciliations_review_reason_v2,
  ADD CONSTRAINT offline_reconciliations_review_reason_v2 CHECK (review_reason IN (
    'identity_or_membership_not_current','capture_time_out_of_bounds','automatic_window_elapsed',
    'historical_configuration_not_valid','predecessor_requires_review','business_engine_escalation','customer_deleted'));

-- An unassigned tag still belongs to the last customer's location. Deactivating a
-- customer does not transfer that tag to an unrelated manager.
CREATE OR REPLACE FUNCTION taptime_server.has_current_nfc_tag_setup_authority_v1(requested_organization_id uuid,requested_tag_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $scope$
 SELECT taptime_server.has_current_admin_setup_authority(requested_organization_id)
 OR (taptime_server.has_current_nfc_setup_authority_v1(requested_organization_id,NULL) AND (
   COALESCE((SELECT taptime_server.has_current_customer_management_authority_v1(assignment.organization_id,assignment.target_customer_id)
     FROM taptime_server.nfc_assignments assignment WHERE assignment.organization_id=requested_organization_id AND assignment.nfc_tag_id=requested_tag_id
     ORDER BY assignment.active DESC,assignment.valid_from DESC,assignment.created_at DESC,assignment.id DESC LIMIT 1),false)
   OR (NOT EXISTS(SELECT 1 FROM taptime_server.nfc_assignments WHERE organization_id=requested_organization_id AND nfc_tag_id=requested_tag_id)
     AND EXISTS(SELECT 1 FROM taptime_server.audit_events WHERE organization_id=requested_organization_id
       AND actor_user_id=NULLIF(current_setting('app.user_id',true),'')::uuid AND correlation_id=current_setting('app.correlation_id',true)
       AND event_type='NfcTagRegistered' AND entity_id=requested_tag_id))))
$scope$;

CREATE FUNCTION taptime_server.inspect_nfc_tag_v1(requested_payload text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $inspect$
DECLARE org uuid:=NULLIF(current_setting('app.organization_id',true),'')::uuid; result jsonb;
BEGIN
 IF current_setting('role',true) IS DISTINCT FROM 'taptime_admin_setup'
   OR NOT taptime_server.has_current_customer_management_authority_v1(org,NULL)
 THEN RAISE EXCEPTION 'Tag inspection rejected' USING ERRCODE='42501'; END IF;
 SELECT jsonb_build_object('status','succeeded','assignment',CASE WHEN assignment.id IS NULL THEN 'unassigned' WHEN assignment.assignment_type='break' THEN 'break' ELSE 'customer' END,
   'customerName',customer.display_name,'locationName',location.display_name) INTO result
 FROM taptime_server.nfc_tags tag
 LEFT JOIN taptime_server.nfc_assignments assignment ON assignment.organization_id=tag.organization_id AND assignment.nfc_tag_id=tag.id AND assignment.active
 LEFT JOIN taptime_server.customers customer ON customer.organization_id=assignment.organization_id AND customer.id=assignment.target_customer_id
 LEFT JOIN taptime_server.work_target_location_assignments binding ON binding.organization_id=customer.organization_id AND binding.target_type='customer' AND binding.target_id=customer.id AND binding.revoked_at IS NULL
 LEFT JOIN taptime_server.locations location ON location.organization_id=binding.organization_id AND location.id=binding.location_id
 WHERE tag.organization_id=org AND tag.payload_value=requested_payload AND taptime_server.has_current_nfc_tag_setup_authority_v1(org,tag.id);
 RETURN COALESCE(result,jsonb_build_object('status','succeeded','assignment','unassigned','customerName',NULL,'locationName',NULL));
END $inspect$;
ALTER FUNCTION taptime_server.inspect_nfc_tag_v1(text) OWNER TO taptime_admin_setup_data_function_owner;
REVOKE ALL ON FUNCTION taptime_server.inspect_nfc_tag_v1(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.inspect_nfc_tag_v1(text) TO taptime_admin_setup;

-- Reusing a freed tag creates a new assignment; old assignment/audit rows remain.
-- No caller gains direct write privileges. The immutable audit is the command receipt.
GRANT INSERT ON taptime_server.audit_events TO taptime_admin_setup_data_function_owner;
GRANT INSERT (id,organization_id,nfc_tag_id,target_type,target_customer_id,assignment_type,active) ON taptime_server.nfc_assignments TO taptime_admin_setup_data_function_owner;
-- Column update privilege is required for FOR UPDATE; the capability never changes Tag data.
GRANT UPDATE(display_name) ON taptime_server.nfc_tags TO taptime_admin_setup_data_function_owner;
CREATE FUNCTION taptime_server.reuse_nfc_tag_v1(requested_customer uuid,requested_payload text,requested_name text,requested_command uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $reuse$
DECLARE org uuid:=NULLIF(current_setting('app.organization_id',true),'')::uuid;
 tag record; prior record; assignment_id uuid:=gen_random_uuid(); canonical text;
 request jsonb;
BEGIN
 IF current_setting('role',true) IS DISTINCT FROM 'taptime_admin_setup'
   OR NOT taptime_server.has_current_nfc_setup_authority_v1(org,requested_customer)
   OR (requested_customer IS NOT NULL AND NOT taptime_server.has_current_customer_management_authority_v1(org,requested_customer))
 THEN RAISE EXCEPTION 'Tag reuse rejected' USING ERRCODE='42501'; END IF;
 canonical:=taptime_server.normalize_taptime_name_v1(requested_name,'tag');
 IF canonical IS NULL OR requested_payload IS NULL OR requested_payload COLLATE "C" !~ '^nfc:uid:v1:(?:[0-9A-F]{2}){1,32}$'
   OR requested_command IS NULL OR requested_command::text IS DISTINCT FROM current_setting('app.correlation_id',true)
 THEN RETURN jsonb_build_object('status','invalid_request'); END IF;
 request:=jsonb_build_object('customerId',requested_customer,'payloadHash',encode(sha256(convert_to(requested_payload,'UTF8')),'hex'),'name',canonical,
   'membershipId',current_setting('app.membership_id',true));
 PERFORM pg_advisory_xact_lock(hashtextextended('taptime:t015e:location-setup:v1:'||org::text,0));
 PERFORM pg_advisory_xact_lock(hashtextextended('tag-reuse:'||org::text||':'||requested_command::text,0));
 SELECT payload INTO prior FROM taptime_server.audit_events WHERE organization_id=org AND correlation_id=requested_command::text AND event_type='NfcTagReused';
 IF FOUND THEN
   IF prior.payload->'request'=request THEN RETURN prior.payload->'result'; END IF;
   RETURN jsonb_build_object('status','command_id_conflict');
 END IF;
 IF requested_customer IS NOT NULL THEN
   PERFORM 1 FROM taptime_server.work_targets WHERE organization_id=org AND target_type='customer' AND target_id=requested_customer FOR UPDATE;
   PERFORM 1 FROM taptime_server.customers WHERE organization_id=org AND id=requested_customer AND active FOR SHARE;
   IF NOT FOUND THEN RETURN jsonb_build_object('status','assignment_target_unavailable'); END IF;
 END IF;
 SELECT id,validation_fingerprint INTO tag FROM taptime_server.nfc_tags WHERE organization_id=org AND payload_value=requested_payload FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('status','tag_payload_already_registered'); END IF;
 IF NOT taptime_server.has_current_nfc_tag_setup_authority_v1(org,tag.id)
 THEN RAISE EXCEPTION 'Tag scope rejected' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM taptime_server.nfc_assignments WHERE organization_id=org AND nfc_tag_id=tag.id AND active)
 THEN RETURN jsonb_build_object('status','tag_payload_already_registered'); END IF;
 INSERT INTO taptime_server.nfc_assignments(id,organization_id,nfc_tag_id,target_type,target_customer_id,assignment_type,active)
 VALUES(assignment_id,org,tag.id,CASE WHEN requested_customer IS NULL THEN NULL ELSE 'customer' END,requested_customer,
   CASE WHEN requested_customer IS NULL THEN 'break' ELSE 'work' END,true);
 INSERT INTO taptime_server.audit_events(id,organization_id,actor_user_id,operator_principal,event_type,entity_type,entity_id,occurred_at,correlation_id,payload)
 VALUES(gen_random_uuid(),org,NULLIF(current_setting('app.user_id',true),'')::uuid,NULL,'NfcTagReused','NfcTag',tag.id,clock_timestamp(),requested_command::text,
   jsonb_build_object('request',request,'assignmentId',assignment_id,'result',jsonb_build_object('status','succeeded','validationFingerprint',tag.validation_fingerprint)));
 RETURN jsonb_build_object('status','succeeded','validationFingerprint',tag.validation_fingerprint);
END $reuse$;
ALTER FUNCTION taptime_server.reuse_nfc_tag_v1(uuid,text,text,uuid) OWNER TO taptime_admin_setup_data_function_owner;
REVOKE ALL ON FUNCTION taptime_server.reuse_nfc_tag_v1(uuid,text,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.reuse_nfc_tag_v1(uuid,text,text,uuid) TO taptime_admin_setup;

CREATE FUNCTION taptime_server.is_current_customer_deactivation_v1(org uuid,customer_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $deactivation$
 SELECT taptime_server.has_current_customer_management_authority_v1(org,customer_id)
 AND EXISTS(SELECT 1 FROM taptime_server.customers WHERE organization_id=org AND id=customer_id AND NOT active AND xmin=xid(pg_current_xact_id()))
$deactivation$;
ALTER FUNCTION taptime_server.is_current_customer_deactivation_v1(uuid,uuid) OWNER TO taptime_admin_setup_data_function_owner;
REVOKE ALL ON FUNCTION taptime_server.is_current_customer_deactivation_v1(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.is_current_customer_deactivation_v1(uuid,uuid) TO taptime_admin_setup_function_owner;

CREATE OR REPLACE FUNCTION taptime_server.append_location_setup_audit_event_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, taptime_server
AS $audit$
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
$audit$;

CREATE OR REPLACE FUNCTION taptime_server.revoke_work_target_location_relation_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $target_lifecycle$
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'taptime:t015e:location-setup:v1:' || NEW.organization_id::text,
    0
  ));
  IF OLD.active AND NOT NEW.active THEN
    UPDATE taptime_server.work_target_location_assignments
    SET revoked_at = CASE WHEN NEW.target_type='customer' THEN NEW.deactivated_at ELSE pg_catalog.transaction_timestamp() END
    WHERE organization_id = NEW.organization_id
      AND target_type = NEW.target_type
      AND target_id = NEW.target_id
      AND revoked_at IS NULL;
  END IF;
  RETURN NEW;
END
$target_lifecycle$;
CREATE OR REPLACE FUNCTION taptime_server.resolve_work_event_location_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog
AS $resolve_event$
DECLARE
  enabled boolean;
  person uuid;
  resolved uuid;
BEGIN
  -- The caller supplies evidence, never a location override. Always replace its value.
  NEW.accepted_work_location_id := NULL;
  SELECT locations_enabled INTO enabled FROM taptime_server.organizations
    WHERE id=NEW.organization_id FOR KEY SHARE;
  IF NOT COALESCE(enabled,false) THEN RETURN NEW; END IF;

  -- Stop and pause retain even a historical NULL, independent of today's grants/bindings.
  SELECT entry.accepted_work_location_id INTO resolved
    FROM taptime_server.time_entries entry
    WHERE entry.organization_id=NEW.organization_id AND entry.user_id=NEW.triggered_by_user_id
      AND entry.status='started' AND (NEW.subject_type='break' OR (
        entry.target_type=NEW.target_type AND entry.target_customer_id=NEW.target_customer_id));
  IF FOUND THEN NEW.accepted_work_location_id:=resolved; RETURN NEW; END IF;
  IF NEW.subject_type='break' THEN RETURN NEW; END IF;

  SELECT id INTO person FROM taptime_server.memberships
    WHERE organization_id=NEW.organization_id AND user_id=NEW.triggered_by_user_id AND revoked_at IS NULL;
  IF person IS NULL THEN RETURN NEW; END IF;
  IF NEW.target_type='general_work' THEN
    SELECT home.location_id INTO resolved
      FROM taptime_server.membership_home_location_assignments home
      JOIN taptime_server.locations location ON location.organization_id=home.organization_id
        AND location.id=home.location_id AND location.active
      WHERE home.organization_id=NEW.organization_id AND home.membership_id=person AND home.revoked_at IS NULL;
  ELSE
    SELECT binding.location_id INTO resolved
      FROM taptime_server.work_target_location_assignments binding
      JOIN taptime_server.locations location ON location.organization_id=binding.organization_id
        AND location.id=binding.location_id AND location.active
      WHERE binding.organization_id=NEW.organization_id AND binding.target_type=NEW.target_type
        AND binding.target_id=NEW.target_customer_id AND (binding.revoked_at IS NULL OR (
          current_setting('role',true)='taptime_offline_event_ingestor' AND NEW.target_type='customer'
          AND NEW.occurred_at>=binding.assigned_at AND NEW.occurred_at<binding.revoked_at
          AND EXISTS(SELECT 1 FROM taptime_server.customers customer WHERE customer.organization_id=NEW.organization_id
            AND customer.id=NEW.target_customer_id AND NOT customer.active AND NEW.occurred_at<customer.deactivated_at)
        )) ORDER BY binding.assigned_at DESC,binding.id DESC LIMIT 1;
    IF resolved IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM taptime_server.membership_home_location_assignments home
        WHERE home.organization_id=NEW.organization_id AND home.membership_id=person
          AND home.location_id=resolved AND home.revoked_at IS NULL
      UNION ALL SELECT 1 FROM taptime_server.membership_work_location_grants work_grant
        WHERE work_grant.organization_id=NEW.organization_id AND work_grant.membership_id=person
          AND work_grant.location_id=resolved AND work_grant.revoked_at IS NULL
    ) THEN resolved:=NULL; END IF;
  END IF;
  NEW.accepted_work_location_id:=resolved;
  RETURN NEW;
END
$resolve_event$;

-- Legacy leases follow the same target-before-assignment lock order as v2/v3.
CREATE OR REPLACE FUNCTION taptime_server.lock_offline_capture_projection_v1(
  requested_organization_id uuid
)
RETURNS TABLE (
  assignment_id uuid,
  nfc_tag_id uuid,
  target_type text,
  target_customer_id uuid,
  display_name text,
  canonical_payload text,
  assignment_row_version bigint,
  customer_row_version bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $projection$
BEGIN
  IF pg_catalog.current_setting('role', true) <> 'taptime_offline_lease_issuer'
    OR requested_organization_id IS NULL
    OR requested_organization_id <> NULLIF(
      pg_catalog.current_setting('app.organization_id', true), ''
    )::uuid
  THEN
    RAISE EXCEPTION 'Offline projection capability rejected' USING ERRCODE = '42501';
  END IF;

  PERFORM 1 FROM taptime_server.work_targets target WHERE target.organization_id=requested_organization_id
    AND target.target_type='customer' ORDER BY target.target_id FOR SHARE;
  RETURN QUERY
  SELECT assignment.id, tag.id, assignment.target_type, assignment.target_customer_id,
         customer.display_name, tag.payload_value, assignment.row_version, customer.row_version
  FROM taptime_server.nfc_assignments AS assignment
  JOIN taptime_server.nfc_tags AS tag
    ON tag.organization_id = assignment.organization_id
   AND tag.id = assignment.nfc_tag_id
  JOIN taptime_server.customers AS customer
    ON customer.organization_id = assignment.organization_id
   AND customer.id = assignment.target_customer_id
  WHERE assignment.organization_id = requested_organization_id
    AND assignment.active
    AND assignment.valid_to IS NULL
    AND customer.active
    AND customer.deactivated_at IS NULL
    AND taptime_server.membership_may_choose_time_target_v1(requested_organization_id,
      nullif(current_setting('app.membership_id',true),'')::uuid,assignment.target_type,assignment.target_customer_id)
  ORDER BY assignment.id
  FOR SHARE OF assignment, tag, customer;
END
$projection$;


-- T-100: deletion must not remove employees' own historical customer hours.
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
        FROM (SELECT member.id,COALESCE(NULLIF(member.display_name,''),'Ohne Namen') AS display_name,
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

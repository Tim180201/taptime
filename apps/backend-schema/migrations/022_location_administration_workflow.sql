-- T-015e: make the Location model reachable through administrator-owned lifecycle commands.
-- Existing activation stays in set_organization_locations_enabled_v1 and remains atomic.

ALTER TABLE taptime_server.locations
  ADD CONSTRAINT locations_canonical_display_name CHECK (
    taptime_server.normalize_taptime_name_v1(display_name, 'customer') IS NOT NULL
    AND display_name = taptime_server.normalize_taptime_name_v1(display_name, 'customer')
  );

-- Migration 019 deliberately allowed only deactivation. T-015e completes the lifecycle with an
-- audited rename while retaining the one-way active-to-inactive transition.
CREATE OR REPLACE FUNCTION taptime_server.enforce_location_deactivation_v1()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $location_history$
DECLARE
  renamed boolean := NEW.display_name IS DISTINCT FROM OLD.display_name;
  deactivated boolean := NEW.active IS FALSE AND OLD.active IS TRUE;
BEGIN
  IF NEW.row_version <> OLD.row_version + 1
    OR renamed = deactivated
  THEN
    RAISE EXCEPTION 'Location update must be exactly one rename or deactivation'
      USING ERRCODE = '23514';
  END IF;

  IF renamed THEN
    IF NOT OLD.active
      OR NEW.active IS DISTINCT FROM OLD.active
      OR NEW.activated_at IS DISTINCT FROM OLD.activated_at
      OR NEW.deactivated_at IS DISTINCT FROM OLD.deactivated_at
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
      OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
      OR NEW.id IS DISTINCT FROM OLD.id
    THEN
      RAISE EXCEPTION 'Location rename changed immutable fields' USING ERRCODE = '23514';
    END IF;
  ELSE
    IF NEW.active IS NOT FALSE
      OR NEW.deactivated_at IS NULL
      OR NEW.deactivated_at < OLD.activated_at
      OR NEW.display_name IS DISTINCT FROM OLD.display_name
      OR NEW.activated_at IS DISTINCT FROM OLD.activated_at
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
      OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
      OR NEW.id IS DISTINCT FROM OLD.id
    THEN
      RAISE EXCEPTION 'Location deactivation changed immutable fields' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END
$location_history$;
REVOKE ALL ON FUNCTION taptime_server.enforce_location_deactivation_v1() FROM PUBLIC;

-- Every new assignment must point at a current target and an active Location. Historical rows
-- remain readable after either side later becomes inactive.
CREATE FUNCTION taptime_server.enforce_current_location_relation_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $current_relation$
DECLARE
  related_organization_id uuid;
  related_active boolean;
  target_revoked_at timestamptz;
  target_role text;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'taptime:t015e:location-setup:v1:' || NEW.organization_id::text,
    0
  ));
  SELECT location.organization_id, location.active
  INTO related_organization_id, related_active
  FROM taptime_server.locations AS location
  WHERE location.id = NEW.location_id;
  -- Leave missing and cross-Organization rows to the existing composite foreign key so its
  -- stable 23503 contract remains intact.
  IF NOT FOUND OR related_organization_id IS DISTINCT FROM NEW.organization_id THEN
    RETURN NEW;
  END IF;
  IF NOT related_active THEN
    RAISE EXCEPTION 'Location relation requires an active Location' USING ERRCODE = '23514';
  END IF;

  IF TG_TABLE_NAME IN (
    'membership_home_location_assignments',
    'membership_work_location_grants',
    'membership_management_location_grants'
  ) THEN
    SELECT membership.organization_id, membership.revoked_at, membership.role
    INTO related_organization_id, target_revoked_at, target_role
    FROM taptime_server.memberships AS membership
    WHERE membership.id = NEW.membership_id;
    IF NOT FOUND OR related_organization_id IS DISTINCT FROM NEW.organization_id THEN
      RETURN NEW;
    END IF;
    IF target_revoked_at IS NOT NULL THEN
      RAISE EXCEPTION 'Location relation requires an active Membership' USING ERRCODE = '23514';
    END IF;
    IF TG_TABLE_NAME = 'membership_management_location_grants'
      AND target_role <> 'standortleitung'
    THEN
      RAISE EXCEPTION 'Management Location Grant requires Location Manager role'
        USING ERRCODE = '23514';
    END IF;
  ELSE
    SELECT target.organization_id, target.active
    INTO related_organization_id, related_active
    FROM taptime_server.work_targets AS target
    WHERE target.target_type = NEW.target_type
      AND target.target_id = NEW.target_id
    ORDER BY (target.organization_id = NEW.organization_id) DESC
    LIMIT 1;
    IF NOT FOUND OR related_organization_id IS DISTINCT FROM NEW.organization_id THEN
      RETURN NEW;
    END IF;
    IF NOT related_active THEN
      RAISE EXCEPTION 'Location relation requires an active Work Target' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END
$current_relation$;
ALTER FUNCTION taptime_server.enforce_current_location_relation_v1()
  OWNER TO taptime_admin_setup_data_function_owner;
REVOKE ALL ON FUNCTION taptime_server.enforce_current_location_relation_v1() FROM PUBLIC;

CREATE TRIGGER membership_home_locations_current_relation
  BEFORE INSERT ON taptime_server.membership_home_location_assignments
  FOR EACH ROW EXECUTE FUNCTION taptime_server.enforce_current_location_relation_v1();
CREATE TRIGGER membership_work_locations_current_relation
  BEFORE INSERT ON taptime_server.membership_work_location_grants
  FOR EACH ROW EXECUTE FUNCTION taptime_server.enforce_current_location_relation_v1();
CREATE TRIGGER membership_management_locations_current_relation
  BEFORE INSERT ON taptime_server.membership_management_location_grants
  FOR EACH ROW EXECUTE FUNCTION taptime_server.enforce_current_location_relation_v1();
CREATE TRIGGER work_target_locations_current_relation
  BEFORE INSERT ON taptime_server.work_target_location_assignments
  FOR EACH ROW EXECUTE FUNCTION taptime_server.enforce_current_location_relation_v1();

-- Membership and resource lifecycle owns the removal side of every current assignment. Rows are
-- revoked, never deleted, so the original setup remains traceable and no inactive target can
-- strand a Location forever.
CREATE FUNCTION taptime_server.revoke_membership_location_relations_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $membership_lifecycle$
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'taptime:t015e:location-setup:v1:' || NEW.organization_id::text,
    0
  ));
  IF OLD.revoked_at IS NULL AND NEW.revoked_at IS NOT NULL THEN
    UPDATE taptime_server.membership_home_location_assignments
    SET revoked_at = pg_catalog.transaction_timestamp()
    WHERE organization_id = NEW.organization_id
      AND membership_id = NEW.id
      AND revoked_at IS NULL;
    UPDATE taptime_server.membership_work_location_grants
    SET revoked_at = pg_catalog.transaction_timestamp()
    WHERE organization_id = NEW.organization_id
      AND membership_id = NEW.id
      AND revoked_at IS NULL;
    UPDATE taptime_server.membership_management_location_grants
    SET revoked_at = pg_catalog.transaction_timestamp()
    WHERE organization_id = NEW.organization_id
      AND membership_id = NEW.id
      AND revoked_at IS NULL;
  ELSIF OLD.role = 'standortleitung' AND NEW.role <> 'standortleitung' THEN
    UPDATE taptime_server.membership_management_location_grants
    SET revoked_at = pg_catalog.transaction_timestamp()
    WHERE organization_id = NEW.organization_id
      AND membership_id = NEW.id
      AND revoked_at IS NULL;
  END IF;
  RETURN NEW;
END
$membership_lifecycle$;
ALTER FUNCTION taptime_server.revoke_membership_location_relations_v1()
  OWNER TO taptime_admin_setup_data_function_owner;
REVOKE ALL ON FUNCTION taptime_server.revoke_membership_location_relations_v1() FROM PUBLIC;
CREATE TRIGGER memberships_revoke_location_relations
  AFTER UPDATE OF role, revoked_at ON taptime_server.memberships
  FOR EACH ROW EXECUTE FUNCTION taptime_server.revoke_membership_location_relations_v1();

CREATE FUNCTION taptime_server.revoke_work_target_location_relation_v1()
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
    SET revoked_at = pg_catalog.transaction_timestamp()
    WHERE organization_id = NEW.organization_id
      AND target_type = NEW.target_type
      AND target_id = NEW.target_id
      AND revoked_at IS NULL;
  END IF;
  RETURN NEW;
END
$target_lifecycle$;
ALTER FUNCTION taptime_server.revoke_work_target_location_relation_v1()
  OWNER TO taptime_admin_setup_data_function_owner;
REVOKE ALL ON FUNCTION taptime_server.revoke_work_target_location_relation_v1() FROM PUBLIC;
CREATE TRIGGER work_targets_revoke_location_relation
  AFTER UPDATE OF active ON taptime_server.work_targets
  FOR EACH ROW EXECUTE FUNCTION taptime_server.revoke_work_target_location_relation_v1();

-- Success receipts make every setup mutation idempotent without storing requested names or
-- other raw input. They are permanent command history and therefore have no delete lifecycle.
CREATE TABLE taptime_server.location_setup_command_receipts (
  organization_id uuid NOT NULL REFERENCES taptime_server.organizations (id),
  command_id uuid NOT NULL,
  actor_user_id uuid NOT NULL,
  actor_membership_id uuid NOT NULL,
  command_type text NOT NULL CHECK (command_type IN (
    'create_location', 'rename_location', 'deactivate_location',
    'set_home_location', 'set_work_location', 'set_management_location',
    'set_work_target_location', 'set_locations_enabled'
  )),
  request_hash bytea NOT NULL CHECK (pg_catalog.octet_length(request_hash) = 32),
  result_entity_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.transaction_timestamp(),
  PRIMARY KEY (organization_id, command_id),
  CONSTRAINT location_setup_receipts_actor_fk FOREIGN KEY (
    organization_id, actor_user_id, actor_membership_id
  ) REFERENCES taptime_server.memberships (organization_id, user_id, id)
);

CREATE FUNCTION taptime_server.deny_location_receipt_change_v1()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $immutable$
BEGIN
  RAISE EXCEPTION 'Location setup receipt history is immutable' USING ERRCODE = '42501';
END
$immutable$;
REVOKE ALL ON FUNCTION taptime_server.deny_location_receipt_change_v1() FROM PUBLIC;
CREATE TRIGGER location_setup_receipts_immutable
  BEFORE UPDATE OR DELETE ON taptime_server.location_setup_command_receipts
  FOR EACH ROW EXECUTE FUNCTION taptime_server.deny_location_receipt_change_v1();

ALTER TABLE taptime_server.location_setup_command_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.location_setup_command_receipts FORCE ROW LEVEL SECURITY;
CREATE POLICY location_setup_receipts_admin_select
  ON taptime_server.location_setup_command_receipts FOR SELECT TO taptime_admin_setup
  USING (taptime_server.has_current_admin_setup_authority(organization_id));
CREATE POLICY location_setup_receipts_admin_insert
  ON taptime_server.location_setup_command_receipts FOR INSERT TO taptime_admin_setup
  WITH CHECK (
    taptime_server.has_current_admin_setup_authority(organization_id)
    AND actor_user_id = taptime_server.current_user_id()
    AND actor_membership_id = NULLIF(
      pg_catalog.current_setting('app.membership_id', true), ''
    )::uuid
    AND command_id = NULLIF(
      pg_catalog.current_setting('app.correlation_id', true), ''
    )::uuid
  );

-- The setup runtime needs tenant-scoped read projections in addition to the Location tables
-- already granted by migration 019.
CREATE POLICY memberships_admin_location_setup_select ON taptime_server.memberships
  FOR SELECT TO taptime_admin_setup
  USING (taptime_server.has_current_admin_setup_authority(organization_id));
CREATE POLICY work_targets_admin_location_setup_select ON taptime_server.work_targets
  FOR SELECT TO taptime_admin_setup
  USING (taptime_server.has_current_admin_setup_authority(organization_id));
CREATE POLICY projects_admin_location_setup_select ON taptime_server.projects
  FOR SELECT TO taptime_admin_setup
  USING (taptime_server.has_current_admin_setup_authority(organization_id));

GRANT SELECT (id, organization_id, display_name, role, revoked_at, row_version)
  ON taptime_server.memberships TO taptime_admin_setup;
GRANT SELECT (locations_enabled)
  ON taptime_server.organizations TO taptime_admin_setup;
GRANT SELECT (role)
  ON taptime_server.memberships TO taptime_admin_setup_data_function_owner;
GRANT SELECT (organization_id, target_type, target_id, display_name, active)
  ON taptime_server.work_targets TO taptime_admin_setup;
GRANT SELECT (id, organization_id, display_name, active)
  ON taptime_server.projects TO taptime_admin_setup;
GRANT SELECT, INSERT ON taptime_server.location_setup_command_receipts TO taptime_admin_setup;
GRANT UPDATE (display_name) ON taptime_server.locations TO taptime_admin_setup;
GRANT UPDATE (revoked_at) ON
  taptime_server.membership_home_location_assignments,
  taptime_server.membership_work_location_grants,
  taptime_server.membership_management_location_grants,
  taptime_server.work_target_location_assignments
TO taptime_admin_setup_data_function_owner;

-- Location lifecycle and assignment changes get their own closed audit trigger. This keeps the
-- older generic allowlist unchanged in effect for every pre-existing table.
CREATE FUNCTION taptime_server.append_location_setup_audit_event_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, taptime_server
AS $audit$
DECLARE
  event_type text;
  entity_type text;
  payload jsonb;
  correlation_id text := NULLIF(pg_catalog.current_setting('app.correlation_id', true), '');
BEGIN
  IF pg_catalog.current_setting('role', true) <> 'taptime_admin_setup' THEN
    RETURN NEW;
  END IF;
  IF NOT taptime_server.has_current_admin_setup_authority(NEW.organization_id)
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
ALTER FUNCTION taptime_server.append_location_setup_audit_event_v1()
  OWNER TO taptime_admin_setup_function_owner;
REVOKE ALL ON FUNCTION taptime_server.append_location_setup_audit_event_v1() FROM PUBLIC;
GRANT SELECT (organization_id, id, display_name, active, row_version)
  ON taptime_server.locations TO taptime_admin_setup_function_owner;

CREATE TRIGGER locations_setup_audit
  AFTER INSERT OR UPDATE ON taptime_server.locations
  FOR EACH ROW EXECUTE FUNCTION taptime_server.append_location_setup_audit_event_v1();
CREATE TRIGGER membership_home_locations_setup_audit
  AFTER INSERT OR UPDATE ON taptime_server.membership_home_location_assignments
  FOR EACH ROW EXECUTE FUNCTION taptime_server.append_location_setup_audit_event_v1();
CREATE TRIGGER membership_work_locations_setup_audit
  AFTER INSERT OR UPDATE ON taptime_server.membership_work_location_grants
  FOR EACH ROW EXECUTE FUNCTION taptime_server.append_location_setup_audit_event_v1();
CREATE TRIGGER membership_management_locations_setup_audit
  AFTER INSERT OR UPDATE ON taptime_server.membership_management_location_grants
  FOR EACH ROW EXECUTE FUNCTION taptime_server.append_location_setup_audit_event_v1();
CREATE TRIGGER work_target_locations_setup_audit
  AFTER INSERT OR UPDATE ON taptime_server.work_target_location_assignments
  FOR EACH ROW EXECUTE FUNCTION taptime_server.append_location_setup_audit_event_v1();

REVOKE ALL ON TABLE taptime_server.location_setup_command_receipts FROM PUBLIC;

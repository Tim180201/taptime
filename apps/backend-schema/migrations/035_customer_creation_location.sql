-- T-086: create a customer and its Location atomically. Creation is delegated;
-- later edits, revocation and relocation keep their existing Administrator authority.
-- Grants are created/revoked by existing Location commands. The new receipt field is
-- written once with the command and retained with the immutable receipt (no new lifecycle).
CREATE FUNCTION taptime_server.has_current_customer_creation_authority_v1(
  requested_organization_id uuid, requested_location_id uuid
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
        AND actor.revoked_at IS NULL
        AND (
          (NOT organization.locations_enabled AND requested_location_id IS NULL AND actor.role = 'administrator')
          OR (organization.locations_enabled AND EXISTS (
            SELECT 1 FROM taptime_server.locations AS location
            WHERE location.organization_id = organization.id AND location.id = requested_location_id AND location.active
              AND (actor.role = 'administrator' OR (actor.role = 'standortleitung' AND EXISTS (
                SELECT 1 FROM taptime_server.membership_management_location_grants AS grant_scope
                WHERE grant_scope.organization_id = organization.id AND grant_scope.location_id = location.id
                  AND grant_scope.membership_id = actor.id AND grant_scope.revoked_at IS NULL
              )))
          ))
        )
    ), false)
$authority$;
ALTER FUNCTION taptime_server.has_current_customer_creation_authority_v1(uuid, uuid)
  OWNER TO taptime_admin_setup_data_function_owner;
REVOKE ALL ON FUNCTION taptime_server.has_current_customer_creation_authority_v1(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.has_current_customer_creation_authority_v1(uuid, uuid)
  TO taptime_admin_setup, taptime_admin_setup_function_owner, taptime_admin_setup_data_function_owner;

-- A Location manager may bind only the customer inserted by this very transaction
-- and command. An old CustomerCreated audit cannot authorize moving an existing customer.
CREATE FUNCTION taptime_server.is_current_customer_creation_v1(
  requested_organization_id uuid, requested_customer_id uuid
)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog
AS $creation$
  SELECT EXISTS (
    SELECT 1 FROM taptime_server.customers AS customer
    JOIN taptime_server.audit_events AS audit
      ON audit.organization_id = customer.organization_id AND audit.entity_id = customer.id
    WHERE customer.organization_id = requested_organization_id AND customer.id = requested_customer_id
      AND customer.active AND customer.xmin = pg_current_xact_id()::text::xid
      AND audit.event_type = 'CustomerCreated' AND audit.entity_type = 'Customer'
      AND audit.actor_user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
      AND audit.correlation_id = NULLIF(current_setting('app.correlation_id', true), '')
  )
$creation$;
ALTER FUNCTION taptime_server.is_current_customer_creation_v1(uuid, uuid)
  OWNER TO taptime_admin_setup_data_function_owner;
REVOKE ALL ON FUNCTION taptime_server.is_current_customer_creation_v1(uuid, uuid) FROM PUBLIC;
GRANT SELECT (xmin) ON taptime_server.customers TO taptime_admin_setup_data_function_owner;
GRANT EXECUTE ON FUNCTION taptime_server.is_current_customer_creation_v1(uuid, uuid)
  TO taptime_admin_setup, taptime_admin_setup_function_owner;

ALTER POLICY customers_admin_setup_insert ON taptime_server.customers
  WITH CHECK (taptime_server.has_current_admin_setup_authority(organization_id)
    OR (active AND taptime_server.has_current_customer_creation_authority_v1(organization_id,
      NULLIF(current_setting('app.customer_creation_location_id', true), '')::uuid)));
ALTER POLICY work_target_locations_admin_setup_insert ON taptime_server.work_target_location_assignments
  WITH CHECK (taptime_server.has_current_admin_setup_authority(organization_id)
    OR (target_type = 'customer'
      AND taptime_server.has_current_customer_creation_authority_v1(organization_id, location_id)
      AND taptime_server.is_current_customer_creation_v1(organization_id, target_id)));

-- An empty managed Location still has a Tags entry point; a concrete customer stays scoped.
CREATE OR REPLACE FUNCTION taptime_server.has_current_nfc_setup_authority_v1(
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
        AND actor.revoked_at IS NULL
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
                 AND target.target_type = binding.target_type AND target.target_id = binding.target_id AND target.active
                JOIN taptime_server.customers AS customer
                  ON customer.organization_id = target.organization_id AND customer.id = target.target_id AND customer.active
                WHERE binding.organization_id = location.organization_id AND binding.location_id = location.id
                  AND binding.revoked_at IS NULL AND binding.target_type = 'customer'
                  AND customer.id = requested_customer_id
              ))
          ))
        )
    ), false)
$authority$;

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

-- Keep the no-Location v1 digest byte-identical, including historical retries.
-- Location commands bind the same digest and the UUID's fixed-width binary value.
CREATE FUNCTION taptime_server.admin_create_customer_at_location_digest_v1(
  organization_id uuid, actor_user_id uuid, membership_id uuid, display_name text, location_id uuid
) RETURNS bytea LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = pg_catalog
AS $digest$
  SELECT sha256(taptime_server.admin_create_customer_digest_v1(organization_id, actor_user_id, membership_id, display_name)
    || uuid_send(location_id))
$digest$;
REVOKE ALL ON FUNCTION taptime_server.admin_create_customer_at_location_digest_v1(uuid, uuid, uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.admin_create_customer_at_location_digest_v1(uuid, uuid, uuid, text, uuid)
  TO taptime_admin_setup, taptime_admin_setup_data_function_owner;

ALTER TABLE taptime_server.admin_setup_command_receipts ADD COLUMN customer_location_id uuid,
  ADD CONSTRAINT customer_receipt_location_kind CHECK (customer_location_id IS NULL OR command_type = 'createCustomer'),
  ADD CONSTRAINT customer_receipt_location_fk FOREIGN KEY (organization_id, customer_location_id)
    REFERENCES taptime_server.locations (organization_id, id);
GRANT INSERT (customer_location_id) ON taptime_server.admin_setup_command_receipts TO taptime_admin_setup;

CREATE POLICY customer_creation_receipts_select ON taptime_server.admin_setup_command_receipts
  FOR SELECT TO taptime_admin_setup
  USING (command_type = 'createCustomer'
    AND taptime_server.has_current_nfc_setup_authority_v1(organization_id, result_customer_id));
CREATE POLICY customer_creation_receipts_insert ON taptime_server.admin_setup_command_receipts
  FOR INSERT TO taptime_admin_setup
  WITH CHECK (command_type = 'createCustomer'
    AND taptime_server.has_current_customer_creation_authority_v1(organization_id, customer_location_id)
    AND taptime_server.is_current_customer_creation_v1(organization_id, result_customer_id)
    AND actor_user_id = taptime_server.current_user_id()
    AND membership_id = NULLIF(current_setting('app.membership_id', true), '')::uuid
    AND actor_membership_role = current_setting('app.membership_role', true)
    AND command_id = NULLIF(current_setting('app.correlation_id', true), '')::uuid);

-- The legacy guard continues to validate all old command shapes. The new branch
-- checks exactly the CustomerCreated + WorkTargetLocationAssigned evidence for one receipt.
CREATE FUNCTION taptime_server.enforce_customer_location_receipt_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog
AS $receipt$
DECLARE
  customer_name text;
  binding_id uuid;
BEGIN
  SELECT customer.display_name, binding.id INTO customer_name, binding_id
    FROM taptime_server.customers AS customer
    JOIN taptime_server.work_target_location_assignments AS binding
      ON binding.organization_id = customer.organization_id AND binding.target_type = 'customer'
     AND binding.target_id = customer.id AND binding.location_id = NEW.customer_location_id AND binding.revoked_at IS NULL
    WHERE customer.organization_id = NEW.organization_id AND customer.id = NEW.result_customer_id AND customer.active;
  IF NOT FOUND OR NEW.command_type IS DISTINCT FROM 'createCustomer'
    OR NEW.request_hash_version IS DISTINCT FROM 1 OR NEW.result_status IS DISTINCT FROM 'succeeded'
    OR NEW.result_nfc_tag_id IS NOT NULL OR NEW.result_nfc_assignment_id IS NOT NULL
    OR NEW.result_replaced_assignment_id IS NOT NULL OR NEW.result_target_customer_id IS NOT NULL
    OR NEW.result_assignment_changed IS NOT NULL OR NEW.result_effective_at IS NOT NULL
    OR NEW.request_hash IS DISTINCT FROM taptime_server.admin_create_customer_at_location_digest_v1(
      NEW.organization_id, NEW.actor_user_id, NEW.membership_id, customer_name, NEW.customer_location_id)
    OR (SELECT count(*) FROM taptime_server.audit_events WHERE organization_id = NEW.organization_id
          AND correlation_id = NEW.command_id::text) <> 2
    OR NOT EXISTS (SELECT 1 FROM taptime_server.audit_events WHERE organization_id = NEW.organization_id
      AND correlation_id = NEW.command_id::text AND actor_user_id = NEW.actor_user_id AND operator_principal IS NULL
      AND event_type = 'CustomerCreated' AND entity_type = 'Customer' AND entity_id = NEW.result_customer_id AND payload = '{}'::jsonb)
    OR NOT EXISTS (SELECT 1 FROM taptime_server.audit_events WHERE organization_id = NEW.organization_id
      AND correlation_id = NEW.command_id::text AND actor_user_id = NEW.actor_user_id AND operator_principal IS NULL
      AND event_type = 'WorkTargetLocationAssigned' AND entity_type = 'WorkTargetLocationAssignment' AND entity_id = binding_id
      AND payload = jsonb_build_object('targetType', 'customer', 'targetId', NEW.result_customer_id, 'locationId', NEW.customer_location_id))
  THEN
    RAISE EXCEPTION 'Customer Location receipt integrity rejected' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$receipt$;
ALTER FUNCTION taptime_server.enforce_customer_location_receipt_v1() OWNER TO taptime_admin_setup_data_function_owner;
REVOKE ALL ON FUNCTION taptime_server.enforce_customer_location_receipt_v1() FROM PUBLIC;
DROP TRIGGER admin_setup_receipts_integrity_guard ON taptime_server.admin_setup_command_receipts;
CREATE TRIGGER admin_setup_receipts_integrity_guard AFTER INSERT ON taptime_server.admin_setup_command_receipts
  FOR EACH ROW WHEN (NEW.customer_location_id IS NULL)
  EXECUTE FUNCTION taptime_server.enforce_admin_setup_receipt_integrity();
CREATE TRIGGER customer_location_receipts_integrity_guard AFTER INSERT ON taptime_server.admin_setup_command_receipts
  FOR EACH ROW WHEN (NEW.customer_location_id IS NOT NULL)
  EXECUTE FUNCTION taptime_server.enforce_customer_location_receipt_v1();

-- The existing paginated Location picker also serves managers with multiple grants.
ALTER POLICY locations_admin_setup_select ON taptime_server.locations
  USING (taptime_server.has_current_admin_setup_authority(organization_id)
    OR taptime_server.has_current_customer_creation_authority_v1(organization_id, id));

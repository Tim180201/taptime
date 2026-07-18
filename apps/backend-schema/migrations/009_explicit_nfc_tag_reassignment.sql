DO $roles$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'taptime_assignment_reassigner'
  ) THEN
    CREATE ROLE taptime_assignment_reassigner
      NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_roles
    WHERE rolname = 'taptime_assignment_reassignment_function_owner'
  ) THEN
    CREATE ROLE taptime_assignment_reassignment_function_owner
      NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT BYPASSRLS;
  END IF;
END
$roles$;

ALTER ROLE taptime_assignment_reassigner WITH
  NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
ALTER ROLE taptime_assignment_reassignment_function_owner WITH
  NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION BYPASSRLS;

DO $normalize_role_graph$
DECLARE
  role_name text;
  role_oid oid;
  database_oid oid := (
    SELECT database.oid
    FROM pg_catalog.pg_database AS database
    WHERE database.datname = pg_catalog.current_database()
  );
  parent_name text;
  member_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY[
    'taptime_assignment_reassigner',
    'taptime_assignment_reassignment_function_owner'
  ]
  LOOP
    SELECT role.oid
    INTO STRICT role_oid
    FROM pg_catalog.pg_roles AS role
    WHERE role.rolname = role_name;

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
      SELECT 1
      FROM pg_catalog.pg_shdepend AS dependency
      WHERE dependency.refclassid = 'pg_catalog.pg_authid'::pg_catalog.regclass
        AND dependency.refobjid = role_oid
        AND dependency.dbid IN (0, database_oid)
    ) OR EXISTS (
      SELECT 1
      FROM pg_catalog.pg_db_role_setting AS role_setting
      WHERE role_setting.setrole = role_oid
        AND role_setting.setdatabase IN (0, database_oid)
    ) THEN
      RAISE EXCEPTION 'C3E2 roles must have no pre-existing ownership, ACL, policy, default-ACL, role-setting or shared-object dependency in this database'
        USING ERRCODE = '42501';
    END IF;
  END LOOP;
END
$normalize_role_graph$;

ALTER TABLE taptime_server.admin_setup_command_receipts
  DROP CONSTRAINT admin_setup_command_receipts_command_type_check,
  DROP CONSTRAINT admin_setup_receipts_result_shape,
  ADD COLUMN result_replaced_assignment_id uuid,
  ADD COLUMN result_target_customer_id uuid,
  ADD COLUMN result_assignment_changed boolean,
  ADD COLUMN result_effective_at timestamptz,
  ADD CONSTRAINT admin_setup_receipts_replaced_assignment_fk FOREIGN KEY (
    organization_id, result_replaced_assignment_id
  ) REFERENCES taptime_server.nfc_assignments (organization_id, id),
  ADD CONSTRAINT admin_setup_receipts_target_customer_fk FOREIGN KEY (
    organization_id, result_target_customer_id
  ) REFERENCES taptime_server.customers (organization_id, id),
  ADD CONSTRAINT admin_setup_command_receipts_command_type_check CHECK (
    command_type IN ('createCustomer', 'provisionNfcTag', 'reassignNfcTag')
  ),
  ADD CONSTRAINT admin_setup_receipts_result_shape CHECK (
    (
      command_type = 'createCustomer'
      AND result_customer_id IS NOT NULL
      AND result_nfc_tag_id IS NULL
      AND result_nfc_assignment_id IS NULL
      AND result_replaced_assignment_id IS NULL
      AND result_target_customer_id IS NULL
      AND result_assignment_changed IS NULL
      AND result_effective_at IS NULL
    )
    OR (
      command_type = 'provisionNfcTag'
      AND result_customer_id IS NULL
      AND result_nfc_tag_id IS NOT NULL
      AND result_nfc_assignment_id IS NOT NULL
      AND result_replaced_assignment_id IS NULL
      AND result_target_customer_id IS NULL
      AND result_assignment_changed IS NULL
      AND result_effective_at IS NULL
    )
    OR (
      command_type = 'reassignNfcTag'
      AND result_customer_id IS NULL
      AND result_nfc_tag_id IS NOT NULL
      AND result_nfc_assignment_id IS NOT NULL
      AND result_target_customer_id IS NOT NULL
      AND result_assignment_changed IS NOT NULL
      AND (
        (
          result_assignment_changed
          AND result_replaced_assignment_id IS NOT NULL
          AND result_replaced_assignment_id <> result_nfc_assignment_id
          AND result_effective_at IS NOT NULL
        )
        OR (
          NOT result_assignment_changed
          AND result_replaced_assignment_id IS NULL
          AND result_effective_at IS NULL
        )
      )
    )
  );

CREATE FUNCTION taptime_server.admin_reassign_nfc_tag_digest_v1(
  requested_organization_id uuid,
  requested_actor_user_id uuid,
  requested_membership_id uuid,
  requested_nfc_tag_id uuid,
  requested_expected_assignment_id uuid,
  requested_target_customer_id uuid
)
RETURNS bytea
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog
AS $digest_contract$
DECLARE
  framed bytea := pg_catalog.convert_to('taptime:c3:v1', 'UTF8')
    || pg_catalog.decode('00', 'hex');
  field text;
  encoded bytea;
BEGIN
  IF requested_organization_id IS NULL
    OR requested_actor_user_id IS NULL
    OR requested_membership_id IS NULL
    OR requested_nfc_tag_id IS NULL
    OR requested_expected_assignment_id IS NULL
    OR requested_target_customer_id IS NULL
  THEN
    RAISE EXCEPTION 'Invalid NFC Tag reassignment command data' USING ERRCODE = '22023';
  END IF;

  FOREACH field IN ARRAY ARRAY[
    'reassignNfcTag',
    requested_organization_id::text,
    requested_actor_user_id::text,
    requested_membership_id::text,
    requested_nfc_tag_id::text,
    requested_expected_assignment_id::text,
    requested_target_customer_id::text
  ]
  LOOP
    encoded := pg_catalog.convert_to(field, 'UTF8');
    framed := framed || pg_catalog.int4send(pg_catalog.octet_length(encoded)) || encoded;
  END LOOP;
  RETURN pg_catalog.sha256(framed);
END
$digest_contract$;

CREATE FUNCTION taptime_server.has_current_assignment_reassignment_authority(
  requested_organization_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $authority$
  SELECT requested_organization_id IS NOT NULL
    AND requested_organization_id = NULLIF(
      pg_catalog.current_setting('app.organization_id', true), ''
    )::uuid
    AND pg_catalog.current_setting('app.membership_role', true) = 'administrator'
    AND EXISTS (
      SELECT 1
      FROM taptime_server.memberships AS membership
      WHERE membership.organization_id = requested_organization_id
        AND membership.user_id = NULLIF(
          pg_catalog.current_setting('app.user_id', true), ''
        )::uuid
        AND membership.id = NULLIF(
          pg_catalog.current_setting('app.membership_id', true), ''
        )::uuid
        AND membership.role = 'administrator'
        AND membership.revoked_at IS NULL
    )
$authority$;

CREATE FUNCTION taptime_server.lock_assignment_reassignment_target_v1(
  requested_organization_id uuid,
  requested_customer_id uuid
)
RETURNS TABLE (locked_customer_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $target_lock$
BEGIN
  IF pg_catalog.current_setting('role', true) <> 'taptime_assignment_reassigner'
    OR requested_customer_id IS NULL
    OR NOT taptime_server.has_current_assignment_reassignment_authority(
      requested_organization_id
    )
  THEN
    RAISE EXCEPTION 'C3E2 Customer lock capability rejected' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT customer.id
  FROM taptime_server.customers AS customer
  WHERE customer.organization_id = requested_organization_id
    AND customer.id = requested_customer_id
    AND customer.active
  FOR SHARE;
END
$target_lock$;

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
    'taptime_employee_enrollment_redeemer',
    'taptime_assignment_reassigner'
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
  audit_correlation_id := NULLIF(current_setting('app.correlation_id', true), '');
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
    audit_payload := pg_catalog.jsonb_build_object(
      'changedFields', pg_catalog.jsonb_build_array('name'),
      'rowVersion', NEW.row_version
    );
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
      WHEN 'UPDATE' THEN 'CustomerDeactivated'
      WHEN 'DELETE' THEN 'CustomerDeleted'
    END;
    audit_entity_type := 'Customer';
    audit_payload := CASE WHEN TG_OP = 'UPDATE'
      THEN pg_catalog.jsonb_build_object('active', NEW.active, 'rowVersion', NEW.row_version)
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

CREATE OR REPLACE FUNCTION taptime_server.enforce_admin_setup_receipt_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $receipt_integrity$
DECLARE
  expected_request_hash bytea;
  stored_display_name text;
  stored_payload text;
  stored_customer_id uuid;
  expected_assignment_id uuid;
  result_assignment_active boolean;
  result_assignment_valid_from timestamptz;
  replaced_assignment_active boolean;
  replaced_assignment_valid_to timestamptz;
  audit_total bigint;
  customer_audit_total bigint;
  tag_audit_total bigint;
  assignment_audit_total bigint;
  replaced_assignment_audit_total bigint;
BEGIN
  IF NEW.organization_id IS NULL
    OR NEW.actor_user_id IS NULL
    OR NEW.membership_id IS NULL
    OR NEW.request_hash_version IS DISTINCT FROM 1
    OR NEW.request_hash IS NULL
    OR pg_catalog.octet_length(NEW.request_hash) <> 32
    OR NEW.result_status IS DISTINCT FROM 'succeeded'
  THEN
    RAISE EXCEPTION 'C3 receipt integrity rejected' USING ERRCODE = '23514';
  END IF;

  IF NEW.command_type = 'createCustomer'
    AND NEW.result_customer_id IS NOT NULL
    AND NEW.result_nfc_tag_id IS NULL
    AND NEW.result_nfc_assignment_id IS NULL
    AND NEW.result_replaced_assignment_id IS NULL
    AND NEW.result_target_customer_id IS NULL
    AND NEW.result_assignment_changed IS NULL
    AND NEW.result_effective_at IS NULL
  THEN
    SELECT customer.display_name
    INTO stored_display_name
    FROM taptime_server.customers AS customer
    WHERE customer.organization_id = NEW.organization_id
      AND customer.id = NEW.result_customer_id
      AND customer.active;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'C3 receipt integrity rejected' USING ERRCODE = '23514';
    END IF;
    expected_request_hash := taptime_server.admin_create_customer_digest_v1(
      NEW.organization_id, NEW.actor_user_id, NEW.membership_id, stored_display_name
    );
    SELECT
      pg_catalog.count(*),
      pg_catalog.count(*) FILTER (WHERE
        audit.actor_user_id = NEW.actor_user_id
        AND audit.operator_principal IS NULL
        AND audit.event_type = 'CustomerCreated'
        AND audit.entity_type = 'Customer'
        AND audit.entity_id = NEW.result_customer_id
        AND audit.payload = '{}'::jsonb
      )
    INTO audit_total, customer_audit_total
    FROM taptime_server.audit_events AS audit
    WHERE audit.organization_id = NEW.organization_id
      AND audit.correlation_id = NEW.command_id::text;
    IF audit_total <> 1 OR customer_audit_total <> 1 THEN
      RAISE EXCEPTION 'C3 receipt integrity rejected' USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.command_type = 'provisionNfcTag'
    AND NEW.result_customer_id IS NULL
    AND NEW.result_nfc_tag_id IS NOT NULL
    AND NEW.result_nfc_assignment_id IS NOT NULL
    AND NEW.result_replaced_assignment_id IS NULL
    AND NEW.result_target_customer_id IS NULL
    AND NEW.result_assignment_changed IS NULL
    AND NEW.result_effective_at IS NULL
  THEN
    SELECT tag.display_name, tag.payload_value, assignment.target_customer_id
    INTO stored_display_name, stored_payload, stored_customer_id
    FROM taptime_server.nfc_tags AS tag
    INNER JOIN taptime_server.nfc_assignments AS assignment
      ON assignment.organization_id = tag.organization_id
     AND assignment.id = NEW.result_nfc_assignment_id
     AND assignment.nfc_tag_id = tag.id
     AND assignment.target_type = 'customer'
     AND assignment.active
    INNER JOIN taptime_server.customers AS customer
      ON customer.organization_id = assignment.organization_id
     AND customer.id = assignment.target_customer_id
     AND customer.active
    WHERE tag.organization_id = NEW.organization_id
      AND tag.id = NEW.result_nfc_tag_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'C3 receipt integrity rejected' USING ERRCODE = '23514';
    END IF;
    expected_request_hash := taptime_server.admin_provision_nfc_tag_digest_v1(
      NEW.organization_id, NEW.actor_user_id, NEW.membership_id, stored_customer_id,
      stored_display_name, stored_payload
    );
    SELECT
      pg_catalog.count(*),
      pg_catalog.count(*) FILTER (WHERE
        audit.actor_user_id = NEW.actor_user_id
        AND audit.operator_principal IS NULL
        AND audit.event_type = 'NfcTagRegistered'
        AND audit.entity_type = 'NfcTag'
        AND audit.entity_id = NEW.result_nfc_tag_id
        AND audit.payload = '{}'::jsonb
      ),
      pg_catalog.count(*) FILTER (WHERE
        audit.actor_user_id = NEW.actor_user_id
        AND audit.operator_principal IS NULL
        AND audit.event_type = 'NfcTagAssigned'
        AND audit.entity_type = 'NfcAssignment'
        AND audit.entity_id = NEW.result_nfc_assignment_id
        AND audit.payload = '{}'::jsonb
      )
    INTO audit_total, tag_audit_total, assignment_audit_total
    FROM taptime_server.audit_events AS audit
    WHERE audit.organization_id = NEW.organization_id
      AND audit.correlation_id = NEW.command_id::text;
    IF audit_total <> 2 OR tag_audit_total <> 1 OR assignment_audit_total <> 1 THEN
      RAISE EXCEPTION 'C3 receipt integrity rejected' USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.command_type = 'reassignNfcTag'
    AND NEW.result_customer_id IS NULL
    AND NEW.result_nfc_tag_id IS NOT NULL
    AND NEW.result_nfc_assignment_id IS NOT NULL
    AND NEW.result_target_customer_id IS NOT NULL
    AND NEW.result_assignment_changed IS NOT NULL
  THEN
    expected_assignment_id := CASE
      WHEN NEW.result_assignment_changed THEN NEW.result_replaced_assignment_id
      ELSE NEW.result_nfc_assignment_id
    END;
    IF expected_assignment_id IS NULL THEN
      RAISE EXCEPTION 'C3E2 receipt integrity rejected' USING ERRCODE = '23514';
    END IF;

    SELECT assignment.active, assignment.valid_from
    INTO result_assignment_active, result_assignment_valid_from
    FROM taptime_server.nfc_assignments AS assignment
    INNER JOIN taptime_server.nfc_tags AS tag
      ON tag.organization_id = assignment.organization_id
     AND tag.id = assignment.nfc_tag_id
    INNER JOIN taptime_server.customers AS customer
      ON customer.organization_id = assignment.organization_id
     AND customer.id = assignment.target_customer_id
    WHERE assignment.organization_id = NEW.organization_id
      AND assignment.id = NEW.result_nfc_assignment_id
      AND assignment.nfc_tag_id = NEW.result_nfc_tag_id
      AND assignment.target_type = 'customer'
      AND assignment.target_customer_id = NEW.result_target_customer_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'C3E2 receipt integrity rejected' USING ERRCODE = '23514';
    END IF;

    IF NEW.result_assignment_changed THEN
      SELECT assignment.active, assignment.valid_to
      INTO replaced_assignment_active, replaced_assignment_valid_to
      FROM taptime_server.nfc_assignments AS assignment
      WHERE assignment.organization_id = NEW.organization_id
        AND assignment.id = NEW.result_replaced_assignment_id
        AND assignment.nfc_tag_id = NEW.result_nfc_tag_id
        AND assignment.target_type = 'customer';
      IF NOT FOUND
        OR result_assignment_active IS NOT TRUE
        OR replaced_assignment_active IS NOT FALSE
        OR NEW.result_effective_at IS NULL
        OR result_assignment_valid_from IS DISTINCT FROM NEW.result_effective_at
        OR replaced_assignment_valid_to IS DISTINCT FROM NEW.result_effective_at
      THEN
        RAISE EXCEPTION 'C3E2 receipt integrity rejected' USING ERRCODE = '23514';
      END IF;
      SELECT
        pg_catalog.count(*),
        pg_catalog.count(*) FILTER (WHERE
          audit.actor_user_id = NEW.actor_user_id
          AND audit.operator_principal IS NULL
          AND audit.event_type = 'NfcAssignmentDeactivated'
          AND audit.entity_type = 'NfcAssignment'
          AND audit.entity_id = NEW.result_replaced_assignment_id
          AND audit.payload = pg_catalog.jsonb_build_object(
            'active', false,
            'rowVersion', (
              SELECT assignment.row_version
              FROM taptime_server.nfc_assignments AS assignment
              WHERE assignment.organization_id = NEW.organization_id
                AND assignment.id = NEW.result_replaced_assignment_id
            )
          )
        ),
        pg_catalog.count(*) FILTER (WHERE
          audit.actor_user_id = NEW.actor_user_id
          AND audit.operator_principal IS NULL
          AND audit.event_type = 'NfcTagAssigned'
          AND audit.entity_type = 'NfcAssignment'
          AND audit.entity_id = NEW.result_nfc_assignment_id
          AND audit.payload = '{}'::jsonb
        )
      INTO audit_total, replaced_assignment_audit_total, assignment_audit_total
      FROM taptime_server.audit_events AS audit
      WHERE audit.organization_id = NEW.organization_id
        AND audit.correlation_id = NEW.command_id::text;
      IF audit_total <> 2
        OR replaced_assignment_audit_total <> 1
        OR assignment_audit_total <> 1
      THEN
        RAISE EXCEPTION 'C3E2 receipt integrity rejected' USING ERRCODE = '23514';
      END IF;
    ELSE
      IF NEW.result_replaced_assignment_id IS NOT NULL
        OR NEW.result_effective_at IS NOT NULL
        OR result_assignment_active IS NOT TRUE
      THEN
        RAISE EXCEPTION 'C3E2 receipt integrity rejected' USING ERRCODE = '23514';
      END IF;
      SELECT pg_catalog.count(*)
      INTO audit_total
      FROM taptime_server.audit_events AS audit
      WHERE audit.organization_id = NEW.organization_id
        AND audit.correlation_id = NEW.command_id::text;
      IF audit_total <> 0 THEN
        RAISE EXCEPTION 'C3E2 receipt integrity rejected' USING ERRCODE = '23514';
      END IF;
    END IF;

    expected_request_hash := taptime_server.admin_reassign_nfc_tag_digest_v1(
      NEW.organization_id,
      NEW.actor_user_id,
      NEW.membership_id,
      NEW.result_nfc_tag_id,
      expected_assignment_id,
      NEW.result_target_customer_id
    );
  ELSE
    RAISE EXCEPTION 'C3 receipt integrity rejected' USING ERRCODE = '23514';
  END IF;

  IF NEW.request_hash IS DISTINCT FROM expected_request_hash THEN
    RAISE EXCEPTION 'C3 receipt integrity rejected' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$receipt_integrity$;

ALTER FUNCTION taptime_server.admin_reassign_nfc_tag_digest_v1(
  uuid, uuid, uuid, uuid, uuid, uuid
) OWNER TO taptime_assignment_reassignment_function_owner;
ALTER FUNCTION taptime_server.has_current_assignment_reassignment_authority(uuid)
  OWNER TO taptime_assignment_reassignment_function_owner;
ALTER FUNCTION taptime_server.lock_assignment_reassignment_target_v1(uuid, uuid)
  OWNER TO taptime_assignment_reassignment_function_owner;
ALTER FUNCTION taptime_server.enforce_admin_setup_receipt_integrity()
  OWNER TO taptime_admin_setup_data_function_owner;
ALTER FUNCTION taptime_server.append_administrative_audit_event()
  OWNER TO taptime_admin_setup_function_owner;

REVOKE ALL ON ALL TABLES IN SCHEMA taptime_server FROM
  taptime_assignment_reassigner,
  taptime_assignment_reassignment_function_owner;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA taptime_server FROM
  taptime_assignment_reassigner,
  taptime_assignment_reassignment_function_owner;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA taptime_server FROM
  taptime_assignment_reassigner,
  taptime_assignment_reassignment_function_owner;
REVOKE ALL ON SCHEMA taptime_server FROM
  taptime_assignment_reassigner,
  taptime_assignment_reassignment_function_owner;

GRANT USAGE ON SCHEMA taptime_server TO
  taptime_assignment_reassigner,
  taptime_assignment_reassignment_function_owner;

GRANT SELECT ON taptime_server.memberships
  TO taptime_assignment_reassignment_function_owner;
GRANT SELECT (id, organization_id, active)
  ON taptime_server.customers TO taptime_assignment_reassignment_function_owner;
GRANT UPDATE (active)
  ON taptime_server.customers TO taptime_assignment_reassignment_function_owner;
GRANT EXECUTE ON FUNCTION
  taptime_server.has_current_assignment_reassignment_authority(uuid)
  TO taptime_assignment_reassignment_function_owner;

GRANT EXECUTE ON FUNCTION taptime_server.current_organization_id(),
  taptime_server.current_user_id(),
  taptime_server.admin_reassign_nfc_tag_digest_v1(uuid, uuid, uuid, uuid, uuid, uuid),
  taptime_server.has_current_assignment_reassignment_authority(uuid),
  taptime_server.lock_assignment_reassignment_target_v1(uuid, uuid)
  TO taptime_assignment_reassigner;
GRANT EXECUTE ON FUNCTION taptime_server.admin_reassign_nfc_tag_digest_v1(
  uuid, uuid, uuid, uuid, uuid, uuid
) TO taptime_admin_setup_data_function_owner;
GRANT SELECT (
  valid_from, valid_to, created_at, updated_at, row_version
) ON taptime_server.nfc_assignments TO taptime_admin_setup_data_function_owner;
GRANT SELECT (id, organization_id)
  ON taptime_server.nfc_tags TO taptime_assignment_reassigner;
GRANT SELECT (
  id, organization_id, nfc_tag_id, target_type, target_customer_id, active,
  valid_from, valid_to, created_at, updated_at, row_version
) ON taptime_server.nfc_assignments TO taptime_assignment_reassigner;
GRANT UPDATE (active, valid_to, updated_at, row_version)
  ON taptime_server.nfc_assignments TO taptime_assignment_reassigner;
GRANT INSERT (
  id, organization_id, nfc_tag_id, target_type, target_customer_id, active, valid_from
) ON taptime_server.nfc_assignments TO taptime_assignment_reassigner;
GRANT SELECT (id, organization_id, assignment_id)
  ON taptime_server.work_events TO taptime_assignment_reassigner;
GRANT SELECT (organization_id, status, start_work_event_id)
  ON taptime_server.time_entries TO taptime_assignment_reassigner;
GRANT SELECT, INSERT ON taptime_server.admin_setup_command_receipts
  TO taptime_assignment_reassigner;

CREATE POLICY nfc_tags_assignment_reassigner_select ON taptime_server.nfc_tags
  FOR SELECT TO taptime_assignment_reassigner
  USING (taptime_server.has_current_assignment_reassignment_authority(organization_id));
CREATE POLICY nfc_assignments_assignment_reassigner_select ON taptime_server.nfc_assignments
  FOR SELECT TO taptime_assignment_reassigner
  USING (taptime_server.has_current_assignment_reassignment_authority(organization_id));
CREATE POLICY nfc_assignments_assignment_reassigner_update ON taptime_server.nfc_assignments
  FOR UPDATE TO taptime_assignment_reassigner
  USING (taptime_server.has_current_assignment_reassignment_authority(organization_id))
  WITH CHECK (taptime_server.has_current_assignment_reassignment_authority(organization_id));
CREATE POLICY nfc_assignments_assignment_reassigner_insert ON taptime_server.nfc_assignments
  FOR INSERT TO taptime_assignment_reassigner
  WITH CHECK (taptime_server.has_current_assignment_reassignment_authority(organization_id));
CREATE POLICY work_events_assignment_reassigner_select ON taptime_server.work_events
  FOR SELECT TO taptime_assignment_reassigner
  USING (taptime_server.has_current_assignment_reassignment_authority(organization_id));
CREATE POLICY time_entries_assignment_reassigner_select ON taptime_server.time_entries
  FOR SELECT TO taptime_assignment_reassigner
  USING (taptime_server.has_current_assignment_reassignment_authority(organization_id));
CREATE POLICY admin_setup_receipts_assignment_reassigner_select
  ON taptime_server.admin_setup_command_receipts
  FOR SELECT TO taptime_assignment_reassigner
  USING (taptime_server.has_current_assignment_reassignment_authority(organization_id));
CREATE POLICY admin_setup_receipts_assignment_reassigner_insert
  ON taptime_server.admin_setup_command_receipts
  FOR INSERT TO taptime_assignment_reassigner
  WITH CHECK (
    taptime_server.has_current_assignment_reassignment_authority(organization_id)
    AND actor_user_id = taptime_server.current_user_id()
    AND membership_id = NULLIF(
      pg_catalog.current_setting('app.membership_id', true), ''
    )::uuid
    AND command_id = NULLIF(
      pg_catalog.current_setting('app.correlation_id', true), ''
    )::uuid
    AND command_type = 'reassignNfcTag'
  );

REVOKE ALL ON FUNCTION taptime_server.admin_reassign_nfc_tag_digest_v1(
  uuid, uuid, uuid, uuid, uuid, uuid
) FROM PUBLIC;
REVOKE ALL ON FUNCTION taptime_server.has_current_assignment_reassignment_authority(uuid)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION taptime_server.lock_assignment_reassignment_target_v1(uuid, uuid)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION taptime_server.enforce_admin_setup_receipt_integrity()
  FROM PUBLIC;

COMMENT ON FUNCTION taptime_server.admin_reassign_nfc_tag_digest_v1(
  uuid, uuid, uuid, uuid, uuid, uuid
) IS 'C3E2 length-framed command digest; contains identifiers only and no raw NFC payload.';

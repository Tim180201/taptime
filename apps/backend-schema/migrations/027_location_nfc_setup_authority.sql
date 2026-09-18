-- T-060: NFC setup is delegated through live customer Location assignments.
-- Existing Location/membership commands create and revoke the grants; no new lifecycle.
CREATE FUNCTION taptime_server.has_current_nfc_setup_authority_v1(
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
            JOIN taptime_server.work_target_location_assignments AS binding
              ON binding.organization_id = location.organization_id
             AND binding.location_id = location.id AND binding.revoked_at IS NULL
             AND binding.target_type = 'customer'
            JOIN taptime_server.work_targets AS target
              ON target.organization_id = binding.organization_id
             AND target.target_type = binding.target_type AND target.target_id = binding.target_id
             AND target.active
            JOIN taptime_server.customers AS customer
              ON customer.organization_id = target.organization_id
             AND customer.id = target.target_id AND customer.active
            WHERE grant_scope.organization_id = actor.organization_id
              AND grant_scope.membership_id = actor.id AND grant_scope.revoked_at IS NULL
              AND (requested_customer_id IS NULL OR customer.id = requested_customer_id)
          ))
        )
    ), false)
$authority$;
ALTER FUNCTION taptime_server.has_current_nfc_setup_authority_v1(uuid, uuid)
  OWNER TO taptime_admin_setup_data_function_owner;
REVOKE ALL ON FUNCTION taptime_server.has_current_nfc_setup_authority_v1(uuid, uuid) FROM PUBLIC;
GRANT SELECT (role) ON taptime_server.memberships TO taptime_admin_setup_data_function_owner;
GRANT EXECUTE ON FUNCTION taptime_server.has_current_nfc_setup_authority_v1(uuid, uuid)
  TO taptime_admin_setup, taptime_assignment_reassigner,
     taptime_admin_setup_data_function_owner, taptime_assignment_reassignment_function_owner,
     taptime_membership_management_function_owner;

-- Avoid recursive RLS between Tags and Assignments. A Tag follows its current/latest
-- assignment, never an arbitrary historical customer. A freshly inserted Tag is visible
-- only to the command which registered it, until that transaction assigns it.
CREATE FUNCTION taptime_server.has_current_nfc_tag_setup_authority_v1(
  requested_organization_id uuid, requested_tag_id uuid
)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog
AS $tag_scope$
  SELECT taptime_server.has_current_admin_setup_authority(requested_organization_id)
    OR (taptime_server.has_current_nfc_setup_authority_v1(requested_organization_id, NULL)
      AND (
        COALESCE((
          SELECT taptime_server.has_current_nfc_setup_authority_v1(
            assignment.organization_id, assignment.target_customer_id
          )
          FROM taptime_server.nfc_assignments AS assignment
          WHERE assignment.organization_id = requested_organization_id
            AND assignment.nfc_tag_id = requested_tag_id
          ORDER BY assignment.active DESC, assignment.valid_from DESC, assignment.created_at DESC, assignment.id DESC
          LIMIT 1
        ), false)
        OR (
          NOT EXISTS (SELECT 1 FROM taptime_server.nfc_assignments AS assignment
            WHERE assignment.organization_id = requested_organization_id AND assignment.nfc_tag_id = requested_tag_id)
          AND EXISTS (SELECT 1 FROM taptime_server.audit_events AS audit
            WHERE audit.organization_id = requested_organization_id
              AND audit.actor_user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
              AND audit.correlation_id = NULLIF(current_setting('app.correlation_id', true), '')
              AND audit.event_type = 'NfcTagRegistered' AND audit.entity_id = requested_tag_id)
        )
      ))
$tag_scope$;
ALTER FUNCTION taptime_server.has_current_nfc_tag_setup_authority_v1(uuid, uuid)
  OWNER TO taptime_admin_setup_data_function_owner;
REVOKE ALL ON FUNCTION taptime_server.has_current_nfc_tag_setup_authority_v1(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.has_current_nfc_tag_setup_authority_v1(uuid, uuid)
  TO taptime_admin_setup, taptime_assignment_reassigner, taptime_admin_setup_data_function_owner;

-- The original four-argument capability stays Administrator-only for older servers.
CREATE FUNCTION taptime_server.insert_admin_setup_nfc_tag_v1(
  requested_id uuid,
  requested_organization_id uuid,
  canonical_display_name text,
  canonical_payload text,
  requested_customer_id uuid
)
RETURNS TABLE (
  inserted_nfc_tag_id uuid,
  validation_fingerprint text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $tag_insert$
BEGIN
  IF pg_catalog.current_setting('role', true) <> 'taptime_admin_setup'
    OR requested_id IS NULL
    OR NOT taptime_server.has_current_nfc_setup_authority_v1(requested_organization_id, requested_customer_id)
    OR canonical_display_name IS NULL
    OR taptime_server.normalize_taptime_name_v1(
      canonical_display_name,
      'tag'
    ) IS NULL
    OR canonical_display_name IS DISTINCT FROM taptime_server.normalize_taptime_name_v1(
      canonical_display_name,
      'tag'
    )
    OR canonical_payload IS NULL
    OR canonical_payload COLLATE "C" !~ '^nfc:uid:v1:(?:[0-9A-F]{2}){1,32}$'
  THEN
    RAISE EXCEPTION 'C3C Tag insert capability rejected' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  INSERT INTO taptime_server.nfc_tags AS inserted_tag (
    id,
    organization_id,
    display_name,
    payload_value
  ) VALUES (
    requested_id,
    requested_organization_id,
    canonical_display_name,
    canonical_payload
  )
  ON CONFLICT ON CONSTRAINT nfc_tags_organization_payload_unique DO NOTHING
  RETURNING inserted_tag.id, inserted_tag.validation_fingerprint;
END
$tag_insert$;

ALTER FUNCTION taptime_server.insert_admin_setup_nfc_tag_v1(uuid, uuid, text, text, uuid)
  OWNER TO taptime_admin_setup_data_function_owner;
REVOKE ALL ON FUNCTION taptime_server.insert_admin_setup_nfc_tag_v1(uuid, uuid, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.insert_admin_setup_nfc_tag_v1(uuid, uuid, text, text, uuid) TO taptime_admin_setup;

CREATE OR REPLACE FUNCTION taptime_server.lock_admin_setup_active_customer_v1(
  requested_organization_id uuid,
  requested_customer_id uuid
)
RETURNS TABLE (locked_customer_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $customer_lock$
BEGIN
  IF pg_catalog.current_setting('role', true) <> 'taptime_admin_setup'
    OR requested_customer_id IS NULL
    OR NOT taptime_server.has_current_nfc_setup_authority_v1(requested_organization_id, requested_customer_id)
  THEN
    RAISE EXCEPTION 'C3C Customer lock capability rejected' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT customer.id
  FROM taptime_server.customers AS customer
  WHERE customer.organization_id = requested_organization_id
    AND customer.id = requested_customer_id
    AND customer.active
  FOR SHARE;
END
$customer_lock$;

CREATE OR REPLACE FUNCTION taptime_server.lock_assignment_reassignment_target_v1(
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
    OR NOT taptime_server.has_current_nfc_setup_authority_v1(requested_organization_id, requested_customer_id)
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

-- New receipts snapshot the context role. Existing rows deliberately remain NULL:
-- adding the column without a default first avoids rewriting historical receipts.
ALTER TABLE taptime_server.admin_setup_command_receipts
  ADD COLUMN actor_membership_role text CHECK (actor_membership_role IN ('administrator', 'standortleitung'));
ALTER TABLE taptime_server.admin_setup_command_receipts ALTER COLUMN actor_membership_role
  SET DEFAULT NULLIF(current_setting('app.membership_role', true), '');
ALTER TABLE taptime_server.admin_break_tag_command_receipts
  ADD COLUMN actor_membership_role text CHECK (actor_membership_role IN ('administrator', 'standortleitung'));
ALTER TABLE taptime_server.admin_break_tag_command_receipts ALTER COLUMN actor_membership_role
  SET DEFAULT NULLIF(current_setting('app.membership_role', true), '');

ALTER POLICY organizations_admin_setup_select ON taptime_server.organizations
  USING (taptime_server.has_current_nfc_setup_authority_v1(id, NULL));
ALTER POLICY customers_admin_setup_select ON taptime_server.customers
  USING (taptime_server.has_current_nfc_setup_authority_v1(organization_id, id));
-- customers_admin_setup_insert and all Location lifecycle policies remain unchanged.
ALTER POLICY nfc_tags_admin_setup_select ON taptime_server.nfc_tags
  USING (taptime_server.has_current_nfc_tag_setup_authority_v1(organization_id, id));
ALTER POLICY nfc_tags_assignment_reassigner_select ON taptime_server.nfc_tags
  USING (taptime_server.has_current_nfc_tag_setup_authority_v1(organization_id, id));
ALTER POLICY nfc_tags_admin_setup_insert ON taptime_server.nfc_tags
  WITH CHECK (taptime_server.has_current_nfc_setup_authority_v1(organization_id, NULL));
ALTER POLICY nfc_assignments_admin_setup_select ON taptime_server.nfc_assignments
  USING (taptime_server.has_current_nfc_setup_authority_v1(organization_id, target_customer_id)
    AND taptime_server.has_current_nfc_tag_setup_authority_v1(organization_id, nfc_tag_id));
ALTER POLICY nfc_assignments_assignment_reassigner_select ON taptime_server.nfc_assignments
  USING (taptime_server.has_current_nfc_setup_authority_v1(organization_id, target_customer_id)
    AND taptime_server.has_current_nfc_tag_setup_authority_v1(organization_id, nfc_tag_id));
ALTER POLICY nfc_assignments_admin_setup_insert ON taptime_server.nfc_assignments
  WITH CHECK (taptime_server.has_current_nfc_setup_authority_v1(organization_id, target_customer_id)
    AND taptime_server.has_current_nfc_tag_setup_authority_v1(organization_id, nfc_tag_id));
ALTER POLICY nfc_assignments_assignment_reassigner_insert ON taptime_server.nfc_assignments
  WITH CHECK (taptime_server.has_current_nfc_setup_authority_v1(organization_id, target_customer_id)
    AND taptime_server.has_current_nfc_tag_setup_authority_v1(organization_id, nfc_tag_id));
ALTER POLICY nfc_assignments_assignment_reassigner_update ON taptime_server.nfc_assignments
  USING (taptime_server.has_current_nfc_setup_authority_v1(organization_id, target_customer_id)
    AND taptime_server.has_current_nfc_tag_setup_authority_v1(organization_id, nfc_tag_id))
  WITH CHECK (taptime_server.has_current_nfc_setup_authority_v1(organization_id, target_customer_id)
    AND taptime_server.has_current_nfc_tag_setup_authority_v1(organization_id, nfc_tag_id));
ALTER POLICY admin_setup_receipts_select ON taptime_server.admin_setup_command_receipts
  USING (taptime_server.has_current_admin_setup_authority(organization_id)
    OR (command_type IN ('provisionNfcTag', 'reassignNfcTag')
      AND taptime_server.has_current_nfc_tag_setup_authority_v1(organization_id, result_nfc_tag_id)
      AND EXISTS (SELECT 1 FROM taptime_server.nfc_assignments AS assignment
        WHERE assignment.organization_id = admin_setup_command_receipts.organization_id
          AND assignment.id = admin_setup_command_receipts.result_nfc_assignment_id
          AND assignment.nfc_tag_id = admin_setup_command_receipts.result_nfc_tag_id)
      AND (result_replaced_assignment_id IS NULL OR EXISTS (
        SELECT 1 FROM taptime_server.nfc_assignments AS replaced
        WHERE replaced.organization_id = admin_setup_command_receipts.organization_id
          AND replaced.id = admin_setup_command_receipts.result_replaced_assignment_id))));
ALTER POLICY admin_setup_receipts_insert ON taptime_server.admin_setup_command_receipts
  WITH CHECK ((taptime_server.has_current_admin_setup_authority(organization_id)
    OR (command_type IN ('provisionNfcTag', 'reassignNfcTag')
      AND taptime_server.has_current_nfc_tag_setup_authority_v1(organization_id, result_nfc_tag_id)
      AND EXISTS (SELECT 1 FROM taptime_server.nfc_assignments AS assignment
        WHERE assignment.organization_id = admin_setup_command_receipts.organization_id
          AND assignment.id = admin_setup_command_receipts.result_nfc_assignment_id
          AND assignment.nfc_tag_id = admin_setup_command_receipts.result_nfc_tag_id)
      AND (result_replaced_assignment_id IS NULL OR EXISTS (
        SELECT 1 FROM taptime_server.nfc_assignments AS replaced
        WHERE replaced.organization_id = admin_setup_command_receipts.organization_id
          AND replaced.id = admin_setup_command_receipts.result_replaced_assignment_id))))
    AND actor_user_id = taptime_server.current_user_id()
    AND membership_id = NULLIF(current_setting('app.membership_id', true), '')::uuid
    AND actor_membership_role = current_setting('app.membership_role', true)
    AND command_id = NULLIF(current_setting('app.correlation_id', true), '')::uuid
  );
ALTER POLICY admin_setup_receipts_assignment_reassigner_select ON taptime_server.admin_setup_command_receipts
  USING (taptime_server.has_current_admin_setup_authority(organization_id)
    OR (command_type IN ('provisionNfcTag', 'reassignNfcTag')
      AND taptime_server.has_current_nfc_tag_setup_authority_v1(organization_id, result_nfc_tag_id)
      AND EXISTS (SELECT 1 FROM taptime_server.nfc_assignments AS assignment
        WHERE assignment.organization_id = admin_setup_command_receipts.organization_id
          AND assignment.id = admin_setup_command_receipts.result_nfc_assignment_id
          AND assignment.nfc_tag_id = admin_setup_command_receipts.result_nfc_tag_id)
      AND (result_replaced_assignment_id IS NULL OR EXISTS (
        SELECT 1 FROM taptime_server.nfc_assignments AS replaced
        WHERE replaced.organization_id = admin_setup_command_receipts.organization_id
          AND replaced.id = admin_setup_command_receipts.result_replaced_assignment_id))));
ALTER POLICY admin_setup_receipts_assignment_reassigner_insert ON taptime_server.admin_setup_command_receipts
  WITH CHECK ((taptime_server.has_current_admin_setup_authority(organization_id)
    OR (command_type IN ('provisionNfcTag', 'reassignNfcTag')
      AND taptime_server.has_current_nfc_tag_setup_authority_v1(organization_id, result_nfc_tag_id)
      AND EXISTS (SELECT 1 FROM taptime_server.nfc_assignments AS assignment
        WHERE assignment.organization_id = admin_setup_command_receipts.organization_id
          AND assignment.id = admin_setup_command_receipts.result_nfc_assignment_id
          AND assignment.nfc_tag_id = admin_setup_command_receipts.result_nfc_tag_id)
      AND (result_replaced_assignment_id IS NULL OR EXISTS (
        SELECT 1 FROM taptime_server.nfc_assignments AS replaced
        WHERE replaced.organization_id = admin_setup_command_receipts.organization_id
          AND replaced.id = admin_setup_command_receipts.result_replaced_assignment_id))))
    AND actor_user_id = taptime_server.current_user_id()
    AND membership_id = NULLIF(current_setting('app.membership_id', true), '')::uuid
    AND actor_membership_role = current_setting('app.membership_role', true)
    AND command_id = NULLIF(current_setting('app.correlation_id', true), '')::uuid
    AND command_type = 'reassignNfcTag'
  );
ALTER POLICY admin_break_receipts_setup_select ON taptime_server.admin_break_tag_command_receipts
  USING (taptime_server.has_current_nfc_setup_authority_v1(organization_id, NULL));
ALTER POLICY admin_break_receipts_setup_insert ON taptime_server.admin_break_tag_command_receipts
  WITH CHECK (taptime_server.has_current_nfc_setup_authority_v1(organization_id, NULL)
    AND actor_user_id = taptime_server.current_user_id()
    AND membership_id = NULLIF(current_setting('app.membership_id', true), '')::uuid
    AND actor_membership_role = current_setting('app.membership_role', true)
    AND command_id = NULLIF(current_setting('app.correlation_id', true), '')::uuid);

-- Reassignment must still see active work using its source assignment. Scope by that
-- assignment, including work which began before Location activation (accepted Location NULL).
GRANT EXECUTE ON FUNCTION taptime_server.has_current_admin_setup_authority(uuid)
  TO taptime_assignment_reassigner;
ALTER POLICY work_events_assignment_reassigner_select ON taptime_server.work_events
  USING (taptime_server.has_current_admin_setup_authority(organization_id)
    OR EXISTS (SELECT 1 FROM taptime_server.nfc_assignments AS assignment
      WHERE assignment.organization_id = work_events.organization_id
        AND assignment.id = work_events.assignment_id));
ALTER POLICY time_entries_assignment_reassigner_select ON taptime_server.time_entries
  USING (taptime_server.has_current_admin_setup_authority(organization_id)
    OR EXISTS (SELECT 1 FROM taptime_server.work_events AS event
      WHERE event.organization_id = time_entries.organization_id
        AND event.id = time_entries.start_work_event_id));

-- Return columns are additive; explicit old SELECT lists keep their contract.
DROP FUNCTION taptime_server.read_administration_session_v2(uuid, uuid, uuid);
CREATE FUNCTION taptime_server.read_administration_session_v2(
  requested_organization_id uuid,
  requested_actor_user_id uuid,
  requested_actor_membership_id uuid
)
RETURNS TABLE (
  locations_enabled boolean,
  setup_available boolean,
  employees_available boolean,
  time_records_available boolean,
  time_export_available boolean,
  review_items_available boolean,
  management_scope_kind text,
  management_location_id uuid,
  management_location_name text,
  nfc_setup_available boolean
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, taptime_server
AS $session$
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
      taptime_server.has_current_time_review_administrator_v1(
        requested_organization_id, requested_actor_user_id,
        requested_actor_membership_id
      ) AS time_review_available,
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
         taptime_server.has_current_nfc_setup_authority_v1(requested_organization_id, NULL)
  FROM section_authority
  CROSS JOIN scope_shape
  LEFT JOIN location_scope ON scope_shape.scope_kind = 'locations'
  ORDER BY location_scope.display_name, location_scope.location_id;
END
$session$;

ALTER FUNCTION taptime_server.read_administration_session_v2(uuid, uuid, uuid)
  OWNER TO taptime_membership_management_function_owner;
REVOKE ALL ON FUNCTION taptime_server.read_administration_session_v2(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.read_administration_session_v2(uuid, uuid, uuid) TO taptime_identity_resolver;

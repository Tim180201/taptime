CREATE FUNCTION taptime_server.current_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  SELECT NULLIF(current_setting('app.organization_id', true), '')::uuid
$$;

CREATE FUNCTION taptime_server.current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')::uuid
$$;

CREATE FUNCTION taptime_server.has_active_membership(requested_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, taptime_server
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM taptime_server.memberships AS membership
    WHERE membership.organization_id = requested_organization_id
      AND membership.user_id = taptime_server.current_user_id()
      AND membership.revoked_at IS NULL
  )
$$;

CREATE FUNCTION taptime_server.has_active_administrator_membership(requested_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, taptime_server
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM taptime_server.memberships AS membership
    WHERE membership.organization_id = requested_organization_id
      AND membership.user_id = taptime_server.current_user_id()
      AND membership.role = 'administrator'
      AND membership.revoked_at IS NULL
  )
$$;

CREATE FUNCTION taptime_server.user_belongs_to_organization(candidate_user_id uuid, requested_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, taptime_server
AS $$
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
$$;

REVOKE ALL ON FUNCTION taptime_server.current_organization_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION taptime_server.current_user_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION taptime_server.has_active_membership(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION taptime_server.has_active_administrator_membership(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION taptime_server.user_belongs_to_organization(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION taptime_server.enforce_time_entry_stop_transition() FROM PUBLIC;
REVOKE ALL ON FUNCTION taptime_server.validate_canonical_decision_result() FROM PUBLIC;
REVOKE ALL ON FUNCTION taptime_server.enforce_administrator_update_shape() FROM PUBLIC;
REVOKE ALL ON FUNCTION taptime_server.append_administrative_audit_event() FROM PUBLIC;

GRANT USAGE ON SCHEMA taptime_server TO taptime_employee, taptime_administrator, taptime_server_lifecycle;
GRANT EXECUTE ON FUNCTION taptime_server.current_organization_id() TO taptime_employee, taptime_administrator, taptime_server_lifecycle;
GRANT EXECUTE ON FUNCTION taptime_server.current_user_id() TO taptime_employee, taptime_administrator, taptime_server_lifecycle;
GRANT EXECUTE ON FUNCTION taptime_server.has_active_membership(uuid)
  TO taptime_employee, taptime_administrator, taptime_server_lifecycle;
GRANT EXECUTE ON FUNCTION taptime_server.has_active_administrator_membership(uuid) TO taptime_administrator;
GRANT EXECUTE ON FUNCTION taptime_server.user_belongs_to_organization(uuid, uuid) TO taptime_administrator;

REVOKE ALL ON ALL TABLES IN SCHEMA taptime_server FROM PUBLIC;

GRANT SELECT ON
  taptime_server.users,
  taptime_server.identity_bindings,
  taptime_server.organizations,
  taptime_server.memberships,
  taptime_server.customers,
  taptime_server.nfc_tags,
  taptime_server.nfc_assignments,
  taptime_server.time_entries,
  taptime_server.sync_receipts
TO taptime_employee;

GRANT SELECT ON
  taptime_server.users,
  taptime_server.identity_bindings,
  taptime_server.organizations,
  taptime_server.memberships,
  taptime_server.customers,
  taptime_server.nfc_tags,
  taptime_server.nfc_assignments,
  taptime_server.work_events,
  taptime_server.time_entries,
  taptime_server.canonical_decisions,
  taptime_server.sync_receipts,
  taptime_server.audit_events
TO taptime_administrator;
GRANT UPDATE (name, row_version) ON taptime_server.organizations TO taptime_administrator;
GRANT INSERT (id, organization_id, user_id, role, created_by_user_id)
  ON taptime_server.memberships TO taptime_administrator;
GRANT UPDATE (role, revoked_at, row_version)
  ON taptime_server.memberships TO taptime_administrator;
GRANT INSERT (id, organization_id, active)
  ON taptime_server.customers TO taptime_administrator;
GRANT UPDATE (active, deactivated_at, row_version)
  ON taptime_server.customers TO taptime_administrator;
GRANT DELETE ON taptime_server.customers TO taptime_administrator;
GRANT INSERT (id, organization_id, payload_value)
  ON taptime_server.nfc_tags TO taptime_administrator;
GRANT DELETE ON taptime_server.nfc_tags TO taptime_administrator;
GRANT INSERT (id, organization_id, nfc_tag_id, target_type, target_customer_id, active)
  ON taptime_server.nfc_assignments TO taptime_administrator;
GRANT UPDATE (active, valid_to, row_version)
  ON taptime_server.nfc_assignments TO taptime_administrator;

GRANT SELECT ON
  taptime_server.memberships,
  taptime_server.customers,
  taptime_server.nfc_tags,
  taptime_server.nfc_assignments,
  taptime_server.work_events,
  taptime_server.time_entries,
  taptime_server.canonical_decisions,
  taptime_server.sync_receipts
TO taptime_server_lifecycle;
GRANT INSERT ON
  taptime_server.work_events,
  taptime_server.time_entries,
  taptime_server.canonical_decisions,
  taptime_server.sync_receipts,
  taptime_server.audit_events
TO taptime_server_lifecycle;
GRANT UPDATE (status, stop_work_event_id, stopped_at, row_version)
  ON taptime_server.time_entries TO taptime_server_lifecycle;

ALTER TABLE taptime_server.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.users FORCE ROW LEVEL SECURITY;
CREATE POLICY users_employee_self_select ON taptime_server.users
  FOR SELECT TO taptime_employee
  USING (id = taptime_server.current_user_id());
CREATE POLICY users_administrator_tenant_select ON taptime_server.users
  FOR SELECT TO taptime_administrator
  USING (
    id = taptime_server.current_user_id()
    OR (
      taptime_server.has_active_administrator_membership(taptime_server.current_organization_id())
      AND taptime_server.user_belongs_to_organization(id, taptime_server.current_organization_id())
    )
  );

ALTER TABLE taptime_server.identity_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.identity_bindings FORCE ROW LEVEL SECURITY;
CREATE POLICY identity_bindings_employee_self_select ON taptime_server.identity_bindings
  FOR SELECT TO taptime_employee
  USING (user_id = taptime_server.current_user_id());
CREATE POLICY identity_bindings_administrator_self_select ON taptime_server.identity_bindings
  FOR SELECT TO taptime_administrator
  USING (user_id = taptime_server.current_user_id());

ALTER TABLE taptime_server.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.organizations FORCE ROW LEVEL SECURITY;
CREATE POLICY organizations_member_select ON taptime_server.organizations
  FOR SELECT TO taptime_employee, taptime_administrator
  USING (
    id = taptime_server.current_organization_id()
    AND taptime_server.has_active_membership(id)
  );
CREATE POLICY organizations_administrator_update ON taptime_server.organizations
  FOR UPDATE TO taptime_administrator
  USING (
    id = taptime_server.current_organization_id()
    AND taptime_server.has_active_administrator_membership(id)
  )
  WITH CHECK (
    id = taptime_server.current_organization_id()
    AND taptime_server.has_active_administrator_membership(id)
  );

ALTER TABLE taptime_server.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.memberships FORCE ROW LEVEL SECURITY;
CREATE POLICY memberships_employee_self_select ON taptime_server.memberships
  FOR SELECT TO taptime_employee
  USING (
    organization_id = taptime_server.current_organization_id()
    AND user_id = taptime_server.current_user_id()
    AND revoked_at IS NULL
  );
CREATE POLICY memberships_administrator_select ON taptime_server.memberships
  FOR SELECT TO taptime_administrator
  USING (
    organization_id = taptime_server.current_organization_id()
    AND taptime_server.has_active_administrator_membership(organization_id)
  );
CREATE POLICY memberships_administrator_insert ON taptime_server.memberships
  FOR INSERT TO taptime_administrator
  WITH CHECK (
    organization_id = taptime_server.current_organization_id()
    AND taptime_server.has_active_administrator_membership(organization_id)
    AND created_by_user_id = taptime_server.current_user_id()
    AND revoked_at IS NULL
    AND row_version = 1
  );
CREATE POLICY memberships_administrator_update ON taptime_server.memberships
  FOR UPDATE TO taptime_administrator
  USING (
    organization_id = taptime_server.current_organization_id()
    AND taptime_server.has_active_administrator_membership(organization_id)
  )
  WITH CHECK (
    organization_id = taptime_server.current_organization_id()
    AND taptime_server.has_active_administrator_membership(organization_id)
  );
CREATE POLICY memberships_lifecycle_user_select ON taptime_server.memberships
  FOR SELECT TO taptime_server_lifecycle
  USING (
    organization_id = taptime_server.current_organization_id()
    AND user_id = taptime_server.current_user_id()
  );

ALTER TABLE taptime_server.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.customers FORCE ROW LEVEL SECURITY;
CREATE POLICY customers_employee_active_select ON taptime_server.customers
  FOR SELECT TO taptime_employee
  USING (
    organization_id = taptime_server.current_organization_id()
    AND active
    AND taptime_server.has_active_membership(organization_id)
  );
CREATE POLICY customers_administrator_select ON taptime_server.customers
  FOR SELECT TO taptime_administrator
  USING (
    organization_id = taptime_server.current_organization_id()
    AND taptime_server.has_active_administrator_membership(organization_id)
  );
CREATE POLICY customers_administrator_insert ON taptime_server.customers
  FOR INSERT TO taptime_administrator
  WITH CHECK (
    organization_id = taptime_server.current_organization_id()
    AND taptime_server.has_active_administrator_membership(organization_id)
    AND active
    AND deactivated_at IS NULL
    AND row_version = 1
  );
CREATE POLICY customers_administrator_update ON taptime_server.customers
  FOR UPDATE TO taptime_administrator
  USING (
    organization_id = taptime_server.current_organization_id()
    AND taptime_server.has_active_administrator_membership(organization_id)
  ) WITH CHECK (
    organization_id = taptime_server.current_organization_id()
    AND taptime_server.has_active_administrator_membership(organization_id)
  );
CREATE POLICY customers_administrator_delete ON taptime_server.customers
  FOR DELETE TO taptime_administrator
  USING (
    organization_id = taptime_server.current_organization_id()
    AND taptime_server.has_active_administrator_membership(organization_id)
  );
CREATE POLICY customers_lifecycle_select ON taptime_server.customers
  FOR SELECT TO taptime_server_lifecycle
  USING (organization_id = taptime_server.current_organization_id());

ALTER TABLE taptime_server.nfc_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.nfc_tags FORCE ROW LEVEL SECURITY;
CREATE POLICY nfc_tags_employee_select ON taptime_server.nfc_tags
  FOR SELECT TO taptime_employee
  USING (
    organization_id = taptime_server.current_organization_id()
    AND taptime_server.has_active_membership(organization_id)
  );
CREATE POLICY nfc_tags_administrator_select ON taptime_server.nfc_tags
  FOR SELECT TO taptime_administrator
  USING (
    organization_id = taptime_server.current_organization_id()
    AND taptime_server.has_active_administrator_membership(organization_id)
  );
CREATE POLICY nfc_tags_administrator_insert ON taptime_server.nfc_tags
  FOR INSERT TO taptime_administrator
  WITH CHECK (
    organization_id = taptime_server.current_organization_id()
    AND taptime_server.has_active_administrator_membership(organization_id)
  );
CREATE POLICY nfc_tags_administrator_update ON taptime_server.nfc_tags
  FOR UPDATE TO taptime_administrator
  USING (
    organization_id = taptime_server.current_organization_id()
    AND taptime_server.has_active_administrator_membership(organization_id)
  ) WITH CHECK (
    organization_id = taptime_server.current_organization_id()
    AND taptime_server.has_active_administrator_membership(organization_id)
  );
CREATE POLICY nfc_tags_administrator_delete ON taptime_server.nfc_tags
  FOR DELETE TO taptime_administrator
  USING (
    organization_id = taptime_server.current_organization_id()
    AND taptime_server.has_active_administrator_membership(organization_id)
  );
CREATE POLICY nfc_tags_lifecycle_select ON taptime_server.nfc_tags
  FOR SELECT TO taptime_server_lifecycle
  USING (organization_id = taptime_server.current_organization_id());

ALTER TABLE taptime_server.nfc_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.nfc_assignments FORCE ROW LEVEL SECURITY;
CREATE POLICY nfc_assignments_employee_active_select ON taptime_server.nfc_assignments
  FOR SELECT TO taptime_employee
  USING (
    organization_id = taptime_server.current_organization_id()
    AND active
    AND taptime_server.has_active_membership(organization_id)
  );
CREATE POLICY nfc_assignments_administrator_select ON taptime_server.nfc_assignments
  FOR SELECT TO taptime_administrator
  USING (
    organization_id = taptime_server.current_organization_id()
    AND taptime_server.has_active_administrator_membership(organization_id)
  );
CREATE POLICY nfc_assignments_administrator_insert ON taptime_server.nfc_assignments
  FOR INSERT TO taptime_administrator
  WITH CHECK (
    organization_id = taptime_server.current_organization_id()
    AND taptime_server.has_active_administrator_membership(organization_id)
    AND active
    AND valid_to IS NULL
    AND row_version = 1
  );
CREATE POLICY nfc_assignments_administrator_update ON taptime_server.nfc_assignments
  FOR UPDATE TO taptime_administrator
  USING (
    organization_id = taptime_server.current_organization_id()
    AND taptime_server.has_active_administrator_membership(organization_id)
  ) WITH CHECK (
    organization_id = taptime_server.current_organization_id()
    AND taptime_server.has_active_administrator_membership(organization_id)
  );
CREATE POLICY nfc_assignments_lifecycle_select ON taptime_server.nfc_assignments
  FOR SELECT TO taptime_server_lifecycle
  USING (organization_id = taptime_server.current_organization_id());

ALTER TABLE taptime_server.work_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.work_events FORCE ROW LEVEL SECURITY;
CREATE POLICY work_events_administrator_select ON taptime_server.work_events
  FOR SELECT TO taptime_administrator
  USING (
    organization_id = taptime_server.current_organization_id()
    AND taptime_server.has_active_administrator_membership(organization_id)
  );
CREATE POLICY work_events_lifecycle_select ON taptime_server.work_events
  FOR SELECT TO taptime_server_lifecycle
  USING (
    organization_id = taptime_server.current_organization_id()
    AND triggered_by_user_id = taptime_server.current_user_id()
  );
CREATE POLICY work_events_lifecycle_insert ON taptime_server.work_events
  FOR INSERT TO taptime_server_lifecycle
  WITH CHECK (
    organization_id = taptime_server.current_organization_id()
    AND triggered_by_user_id = taptime_server.current_user_id()
  );

ALTER TABLE taptime_server.time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.time_entries FORCE ROW LEVEL SECURITY;
CREATE POLICY time_entries_employee_self_select ON taptime_server.time_entries
  FOR SELECT TO taptime_employee
  USING (
    organization_id = taptime_server.current_organization_id()
    AND user_id = taptime_server.current_user_id()
    AND taptime_server.has_active_membership(organization_id)
  );
CREATE POLICY time_entries_administrator_select ON taptime_server.time_entries
  FOR SELECT TO taptime_administrator
  USING (
    organization_id = taptime_server.current_organization_id()
    AND taptime_server.has_active_administrator_membership(organization_id)
  );
CREATE POLICY time_entries_lifecycle_select ON taptime_server.time_entries
  FOR SELECT TO taptime_server_lifecycle
  USING (
    organization_id = taptime_server.current_organization_id()
    AND user_id = taptime_server.current_user_id()
  );
CREATE POLICY time_entries_lifecycle_insert ON taptime_server.time_entries
  FOR INSERT TO taptime_server_lifecycle
  WITH CHECK (
    organization_id = taptime_server.current_organization_id()
    AND user_id = taptime_server.current_user_id()
    AND taptime_server.has_active_membership(organization_id)
  );
CREATE POLICY time_entries_lifecycle_update ON taptime_server.time_entries
  FOR UPDATE TO taptime_server_lifecycle
  USING (
    organization_id = taptime_server.current_organization_id()
    AND user_id = taptime_server.current_user_id()
    AND taptime_server.has_active_membership(organization_id)
  ) WITH CHECK (
    organization_id = taptime_server.current_organization_id()
    AND user_id = taptime_server.current_user_id()
    AND taptime_server.has_active_membership(organization_id)
  );

ALTER TABLE taptime_server.canonical_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.canonical_decisions FORCE ROW LEVEL SECURITY;
CREATE POLICY canonical_decisions_administrator_select ON taptime_server.canonical_decisions
  FOR SELECT TO taptime_administrator
  USING (
    organization_id = taptime_server.current_organization_id()
    AND taptime_server.has_active_administrator_membership(organization_id)
  );
CREATE POLICY canonical_decisions_lifecycle_select ON taptime_server.canonical_decisions
  FOR SELECT TO taptime_server_lifecycle
  USING (
    organization_id = taptime_server.current_organization_id()
    AND actor_user_id = taptime_server.current_user_id()
  );
CREATE POLICY canonical_decisions_lifecycle_insert ON taptime_server.canonical_decisions
  FOR INSERT TO taptime_server_lifecycle
  WITH CHECK (
    organization_id = taptime_server.current_organization_id()
    AND actor_user_id = taptime_server.current_user_id()
    AND (
      taptime_server.has_active_membership(organization_id)
      OR (decision_type = 'escalation_required' AND time_entry_id IS NULL)
    )
  );

ALTER TABLE taptime_server.sync_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.sync_receipts FORCE ROW LEVEL SECURITY;
CREATE POLICY sync_receipts_employee_self_select ON taptime_server.sync_receipts
  FOR SELECT TO taptime_employee
  USING (
    organization_id = taptime_server.current_organization_id()
    AND user_id = taptime_server.current_user_id()
    AND taptime_server.has_active_membership(organization_id)
  );
CREATE POLICY sync_receipts_administrator_select ON taptime_server.sync_receipts
  FOR SELECT TO taptime_administrator
  USING (
    organization_id = taptime_server.current_organization_id()
    AND taptime_server.has_active_administrator_membership(organization_id)
  );
CREATE POLICY sync_receipts_lifecycle_select ON taptime_server.sync_receipts
  FOR SELECT TO taptime_server_lifecycle
  USING (
    organization_id = taptime_server.current_organization_id()
    AND user_id = taptime_server.current_user_id()
  );
CREATE POLICY sync_receipts_lifecycle_insert ON taptime_server.sync_receipts
  FOR INSERT TO taptime_server_lifecycle
  WITH CHECK (
    organization_id = taptime_server.current_organization_id()
    AND user_id = taptime_server.current_user_id()
    AND (
      taptime_server.has_active_membership(organization_id)
      OR (
        server_time_entry_id IS NULL
        AND EXISTS (
          SELECT 1
          FROM taptime_server.canonical_decisions AS decision
          WHERE decision.organization_id = sync_receipts.organization_id
            AND decision.actor_user_id = sync_receipts.user_id
            AND decision.target_type = sync_receipts.target_type
            AND decision.target_customer_id = sync_receipts.target_customer_id
            AND decision.work_event_id = sync_receipts.work_event_id
            AND decision.decision_type = 'escalation_required'
        )
      )
    )
  );

ALTER TABLE taptime_server.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.audit_events FORCE ROW LEVEL SECURITY;
CREATE POLICY audit_events_administrator_select ON taptime_server.audit_events
  FOR SELECT TO taptime_administrator
  USING (
    organization_id = taptime_server.current_organization_id()
    AND taptime_server.has_active_administrator_membership(organization_id)
  );
CREATE POLICY audit_events_lifecycle_insert ON taptime_server.audit_events
  FOR INSERT TO taptime_server_lifecycle
  WITH CHECK (
    organization_id = taptime_server.current_organization_id()
    AND actor_user_id = taptime_server.current_user_id()
    AND work_event_user_id = taptime_server.current_user_id()
    AND work_event_id IS NOT NULL
  );

ALTER DEFAULT PRIVILEGES IN SCHEMA taptime_server REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA taptime_server REVOKE ALL ON FUNCTIONS FROM PUBLIC;

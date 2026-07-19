DO $roles$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'taptime_offline_lease_issuer'
  ) THEN
    CREATE ROLE taptime_offline_lease_issuer
      NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'taptime_offline_event_ingestor'
  ) THEN
    CREATE ROLE taptime_offline_event_ingestor
      NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'taptime_offline_reconciliation_reader'
  ) THEN
    CREATE ROLE taptime_offline_reconciliation_reader
      NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles
    WHERE rolname = 'taptime_offline_lease_function_owner'
  ) THEN
    CREATE ROLE taptime_offline_lease_function_owner
      NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT BYPASSRLS;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles
    WHERE rolname = 'taptime_offline_event_function_owner'
  ) THEN
    CREATE ROLE taptime_offline_event_function_owner
      NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT BYPASSRLS;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles
    WHERE rolname = 'taptime_offline_reconciliation_function_owner'
  ) THEN
    CREATE ROLE taptime_offline_reconciliation_function_owner
      NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT BYPASSRLS;
  END IF;
END
$roles$;

ALTER ROLE taptime_offline_lease_issuer WITH
  NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
ALTER ROLE taptime_offline_event_ingestor WITH
  NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
ALTER ROLE taptime_offline_reconciliation_reader WITH
  NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
ALTER ROLE taptime_offline_lease_function_owner WITH
  NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION BYPASSRLS;
ALTER ROLE taptime_offline_event_function_owner WITH
  NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION BYPASSRLS;
ALTER ROLE taptime_offline_reconciliation_function_owner WITH
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
    'taptime_offline_lease_issuer',
    'taptime_offline_event_ingestor',
    'taptime_offline_reconciliation_reader',
    'taptime_offline_lease_function_owner',
    'taptime_offline_event_function_owner',
    'taptime_offline_reconciliation_function_owner'
  ]
  LOOP
    SELECT role.oid
    INTO STRICT role_oid
    FROM pg_catalog.pg_roles AS role
    WHERE role.rolname = role_name;

    FOR parent_name IN
      SELECT parent.rolname
      FROM pg_catalog.pg_auth_members AS edge
      JOIN pg_catalog.pg_roles AS member ON member.oid = edge.member
      JOIN pg_catalog.pg_roles AS parent ON parent.oid = edge.roleid
      WHERE member.rolname = role_name
    LOOP
      EXECUTE pg_catalog.format('REVOKE %I FROM %I', parent_name, role_name);
    END LOOP;

    FOR member_name IN
      SELECT member.rolname
      FROM pg_catalog.pg_auth_members AS edge
      JOIN pg_catalog.pg_roles AS member ON member.oid = edge.member
      JOIN pg_catalog.pg_roles AS parent ON parent.oid = edge.roleid
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
      RAISE EXCEPTION 'Offline synchronization roles must have no pre-existing ownership, ACL, policy, default-ACL, role-setting or shared-object dependency in this database'
        USING ERRCODE = '42501';
    END IF;
  END LOOP;
END
$normalize_role_graph$;

CREATE TABLE taptime_server.offline_installations (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES taptime_server.organizations (id),
  user_id uuid NOT NULL REFERENCES taptime_server.users (id),
  membership_id uuid NOT NULL,
  identity_binding_id uuid NOT NULL,
  binding_digest bytea NOT NULL UNIQUE CHECK (pg_catalog.octet_length(binding_digest) = 32),
  created_at timestamptz NOT NULL DEFAULT pg_catalog.transaction_timestamp(),
  CONSTRAINT offline_installations_tenant_id_unique UNIQUE (organization_id, id),
  CONSTRAINT offline_installations_tenant_user_id_unique UNIQUE (
    organization_id, user_id, id
  ),
  CONSTRAINT offline_installations_tenant_membership_id_unique UNIQUE (
    organization_id, user_id, membership_id, id
  ),
  CONSTRAINT offline_installations_owner_unique UNIQUE (
    organization_id, user_id, membership_id, identity_binding_id, id
  ),
  CONSTRAINT offline_installations_membership_fk FOREIGN KEY (
    organization_id, user_id, membership_id
  ) REFERENCES taptime_server.memberships (organization_id, user_id, id),
  CONSTRAINT offline_installations_binding_fk FOREIGN KEY (
    identity_binding_id, user_id
  ) REFERENCES taptime_server.identity_bindings (id, user_id)
);

CREATE TABLE taptime_server.offline_capture_leases (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES taptime_server.organizations (id),
  installation_id uuid NOT NULL,
  identity_binding_id uuid NOT NULL,
  user_id uuid NOT NULL,
  membership_id uuid NOT NULL,
  membership_row_version bigint NOT NULL CHECK (membership_row_version > 0),
  membership_role text NOT NULL CHECK (membership_role IN ('administrator', 'employee')),
  issued_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  configuration_revision char(64) NOT NULL CHECK (
    configuration_revision ~ '^[0-9a-f]{64}$'
  ),
  item_count integer NOT NULL CHECK (item_count >= 0 AND item_count <= 4096),
  serialized_bytes integer NOT NULL CHECK (
    serialized_bytes >= 0 AND serialized_bytes <= 4194304
  ),
  manifest_digest char(64) NOT NULL CHECK (manifest_digest ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT pg_catalog.transaction_timestamp(),
  CONSTRAINT offline_capture_leases_tenant_id_unique UNIQUE (organization_id, id),
  CONSTRAINT offline_capture_leases_installation_unique UNIQUE (
    organization_id, installation_id, id
  ),
  CONSTRAINT offline_capture_leases_owner_unique UNIQUE (
    organization_id, user_id, membership_id, identity_binding_id, installation_id, id
  ),
  CONSTRAINT offline_capture_leases_installation_fk FOREIGN KEY (
    organization_id, user_id, membership_id, identity_binding_id, installation_id
  ) REFERENCES taptime_server.offline_installations (
    organization_id, user_id, membership_id, identity_binding_id, id
  ),
  CONSTRAINT offline_capture_leases_lifetime CHECK (
    expires_at = issued_at + interval '12 hours'
  )
);

CREATE TABLE taptime_server.offline_capture_lease_items (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES taptime_server.organizations (id),
  lease_id uuid NOT NULL,
  installation_id uuid NOT NULL,
  lookup_value char(64) NOT NULL CHECK (lookup_value ~ '^[0-9a-f]{64}$'),
  assignment_id uuid NOT NULL,
  nfc_tag_id uuid NOT NULL,
  target_type text NOT NULL CHECK (target_type = 'customer'),
  target_customer_id uuid NOT NULL,
  display_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.transaction_timestamp(),
  CONSTRAINT offline_lease_items_tenant_id_unique UNIQUE (organization_id, id),
  CONSTRAINT offline_lease_items_lease_id_unique UNIQUE (organization_id, lease_id, id),
  CONSTRAINT offline_lease_items_lookup_unique UNIQUE (
    organization_id, lease_id, lookup_value
  ),
  CONSTRAINT offline_lease_items_lease_fk FOREIGN KEY (
    organization_id, installation_id, lease_id
  ) REFERENCES taptime_server.offline_capture_leases (
    organization_id, installation_id, id
  ),
  CONSTRAINT offline_lease_items_assignment_snapshot_fk FOREIGN KEY (
    organization_id, assignment_id, nfc_tag_id, target_type, target_customer_id
  ) REFERENCES taptime_server.nfc_assignments (
    organization_id, id, nfc_tag_id, target_type, target_customer_id
  ),
  CONSTRAINT offline_lease_items_display_name CHECK (
    display_name = taptime_server.normalize_taptime_name_v1(display_name, 'customer')
  )
);

CREATE INDEX offline_lease_items_ordered_page
  ON taptime_server.offline_capture_lease_items (organization_id, lease_id, id);

CREATE TABLE taptime_server.offline_capture_lease_receipts (
  organization_id uuid NOT NULL REFERENCES taptime_server.organizations (id),
  command_id uuid NOT NULL,
  user_id uuid NOT NULL,
  membership_id uuid NOT NULL,
  identity_binding_id uuid NOT NULL,
  installation_id uuid NOT NULL,
  lease_id uuid NOT NULL,
  binding_digest bytea NOT NULL CHECK (pg_catalog.octet_length(binding_digest) = 32),
  lookup_key_digest bytea NOT NULL CHECK (pg_catalog.octet_length(lookup_key_digest) = 32),
  created_at timestamptz NOT NULL DEFAULT pg_catalog.transaction_timestamp(),
  PRIMARY KEY (organization_id, command_id),
  CONSTRAINT offline_lease_receipts_lease_unique UNIQUE (organization_id, lease_id),
  CONSTRAINT offline_lease_receipts_owner_fk FOREIGN KEY (
    organization_id, user_id, membership_id, identity_binding_id, installation_id, lease_id
  ) REFERENCES taptime_server.offline_capture_leases (
    organization_id, user_id, membership_id, identity_binding_id, installation_id, id
  )
);

CREATE TABLE taptime_server.offline_sync_cursors (
  organization_id uuid NOT NULL REFERENCES taptime_server.organizations (id),
  installation_id uuid NOT NULL,
  user_id uuid NOT NULL,
  membership_id uuid NOT NULL,
  last_durable_sequence bigint NOT NULL DEFAULT 0 CHECK (last_durable_sequence >= 0),
  review_predecessor_sequence bigint CHECK (
    review_predecessor_sequence IS NULL
    OR (
      review_predecessor_sequence > 0
      AND review_predecessor_sequence <= last_durable_sequence
    )
  ),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.transaction_timestamp(),
  PRIMARY KEY (organization_id, installation_id),
  CONSTRAINT offline_sync_cursors_owner_fk FOREIGN KEY (
    organization_id, user_id, membership_id, installation_id
  ) REFERENCES taptime_server.offline_installations (
    organization_id, user_id, membership_id, id
  )
);

CREATE TABLE taptime_server.offline_event_reconciliations (
  organization_id uuid NOT NULL REFERENCES taptime_server.organizations (id),
  work_event_id uuid NOT NULL,
  receipt_id uuid NOT NULL,
  installation_id uuid NOT NULL,
  lease_id uuid NOT NULL,
  lease_item_id uuid NOT NULL,
  user_id uuid NOT NULL,
  membership_id uuid NOT NULL,
  device_sequence bigint NOT NULL CHECK (device_sequence > 0),
  request_content_hash char(64) NOT NULL CHECK (
    request_content_hash ~ '^[0-9a-f]{64}$'
  ),
  boot_marker text NOT NULL CHECK (
    pg_catalog.octet_length(boot_marker) BETWEEN 1 AND 256
  ),
  monotonic_anchor_milliseconds bigint NOT NULL CHECK (monotonic_anchor_milliseconds >= 0),
  monotonic_delta_milliseconds bigint NOT NULL CHECK (monotonic_delta_milliseconds >= 0),
  wall_clock_anchor timestamptz NOT NULL,
  clock_proof_status text NOT NULL CHECK (
    clock_proof_status IN ('verified_same_boot', 'review_only')
  ),
  clock_proof_version smallint NOT NULL CHECK (clock_proof_version = 1),
  provenance_version smallint NOT NULL CHECK (provenance_version = 1),
  result_status text NOT NULL CHECK (result_status IN ('synchronized', 'review_pending')),
  review_reason text CHECK (review_reason IN (
    'identity_or_membership_not_current',
    'capture_time_out_of_bounds',
    'automatic_window_elapsed',
    'historical_configuration_not_valid',
    'predecessor_requires_review'
  )),
  decision_work_event_id uuid,
  server_time_entry_id uuid,
  recorded_at timestamptz NOT NULL DEFAULT pg_catalog.transaction_timestamp(),
  PRIMARY KEY (organization_id, work_event_id),
  CONSTRAINT offline_reconciliations_receipt_unique UNIQUE (organization_id, receipt_id),
  CONSTRAINT offline_reconciliations_sequence_unique UNIQUE (
    organization_id, installation_id, device_sequence
  ),
  CONSTRAINT offline_reconciliations_installation_fk FOREIGN KEY (
    organization_id, user_id, membership_id, installation_id
  ) REFERENCES taptime_server.offline_installations (
    organization_id, user_id, membership_id, id
  ),
  CONSTRAINT offline_reconciliations_item_fk FOREIGN KEY (
    organization_id, lease_id, lease_item_id
  ) REFERENCES taptime_server.offline_capture_lease_items (
    organization_id, lease_id, id
  ),
  CONSTRAINT offline_reconciliations_work_event_fk FOREIGN KEY (
    organization_id, user_id, work_event_id
  ) REFERENCES taptime_server.work_events (
    organization_id, triggered_by_user_id, id
  ),
  CONSTRAINT offline_reconciliations_receipt_fk FOREIGN KEY (
    organization_id, receipt_id
  ) REFERENCES taptime_server.sync_receipts (organization_id, id),
  CONSTRAINT offline_reconciliations_decision_fk FOREIGN KEY (
    organization_id, user_id, decision_work_event_id
  ) REFERENCES taptime_server.canonical_decisions (
    organization_id, actor_user_id, work_event_id
  ),
  CONSTRAINT offline_reconciliations_time_entry_fk FOREIGN KEY (
    organization_id, user_id, server_time_entry_id
  ) REFERENCES taptime_server.time_entries (organization_id, user_id, id),
  CONSTRAINT offline_reconciliations_decision_same_event CHECK (
    decision_work_event_id IS NULL OR decision_work_event_id = work_event_id
  ),
  CONSTRAINT offline_reconciliations_result_shape CHECK (
    (
      result_status = 'synchronized'
      AND review_reason IS NULL
      AND decision_work_event_id = work_event_id
    )
    OR
    (
      result_status = 'review_pending'
      AND review_reason IS NOT NULL
      AND decision_work_event_id IS NULL
      AND server_time_entry_id IS NULL
    )
  )
);

CREATE FUNCTION taptime_server.reject_offline_immutable_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $immutable$
BEGIN
  RAISE EXCEPTION 'Offline synchronization evidence is append-only'
    USING ERRCODE = '55000';
END
$immutable$;

REVOKE ALL ON FUNCTION taptime_server.reject_offline_immutable_change() FROM PUBLIC;

CREATE TRIGGER offline_installations_immutable
  BEFORE UPDATE OR DELETE ON taptime_server.offline_installations
  FOR EACH ROW EXECUTE FUNCTION taptime_server.reject_offline_immutable_change();
CREATE TRIGGER offline_capture_leases_immutable
  BEFORE UPDATE OR DELETE ON taptime_server.offline_capture_leases
  FOR EACH ROW EXECUTE FUNCTION taptime_server.reject_offline_immutable_change();
CREATE TRIGGER offline_capture_lease_items_immutable
  BEFORE UPDATE OR DELETE ON taptime_server.offline_capture_lease_items
  FOR EACH ROW EXECUTE FUNCTION taptime_server.reject_offline_immutable_change();
CREATE TRIGGER offline_capture_lease_receipts_immutable
  BEFORE UPDATE OR DELETE ON taptime_server.offline_capture_lease_receipts
  FOR EACH ROW EXECUTE FUNCTION taptime_server.reject_offline_immutable_change();
CREATE TRIGGER offline_event_reconciliations_immutable
  BEFORE UPDATE OR DELETE ON taptime_server.offline_event_reconciliations
  FOR EACH ROW EXECUTE FUNCTION taptime_server.reject_offline_immutable_change();

CREATE FUNCTION taptime_server.enforce_offline_sync_cursor_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $cursor$
BEGIN
  IF NEW.organization_id <> OLD.organization_id
    OR NEW.installation_id <> OLD.installation_id
    OR NEW.user_id <> OLD.user_id
    OR NEW.membership_id <> OLD.membership_id
    OR NEW.last_durable_sequence <> OLD.last_durable_sequence + 1
    OR (
      OLD.review_predecessor_sequence IS NOT NULL
      AND NEW.review_predecessor_sequence IS DISTINCT FROM OLD.review_predecessor_sequence
    )
    OR (
      NEW.review_predecessor_sequence IS NOT NULL
      AND NEW.review_predecessor_sequence > NEW.last_durable_sequence
    )
  THEN
    RAISE EXCEPTION 'Invalid offline synchronization cursor transition'
      USING ERRCODE = '23514';
  END IF;
  NEW.updated_at := pg_catalog.transaction_timestamp();
  RETURN NEW;
END
$cursor$;

REVOKE ALL ON FUNCTION taptime_server.enforce_offline_sync_cursor_transition() FROM PUBLIC;

CREATE TRIGGER offline_sync_cursor_transition
  BEFORE UPDATE ON taptime_server.offline_sync_cursors
  FOR EACH ROW EXECUTE FUNCTION taptime_server.enforce_offline_sync_cursor_transition();

ALTER TABLE taptime_server.offline_installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.offline_installations FORCE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.offline_capture_leases ENABLE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.offline_capture_leases FORCE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.offline_capture_lease_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.offline_capture_lease_items FORCE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.offline_capture_lease_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.offline_capture_lease_receipts FORCE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.offline_sync_cursors ENABLE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.offline_sync_cursors FORCE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.offline_event_reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.offline_event_reconciliations FORCE ROW LEVEL SECURITY;

CREATE FUNCTION taptime_server.current_offline_actor_matches_v1(
  requested_organization_id uuid,
  requested_user_id uuid,
  requested_membership_id uuid,
  requested_identity_binding_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $authority$
  SELECT requested_organization_id IS NOT NULL
    AND requested_user_id IS NOT NULL
    AND requested_membership_id IS NOT NULL
    AND requested_organization_id = NULLIF(
      pg_catalog.current_setting('app.organization_id', true), ''
    )::uuid
    AND requested_user_id = NULLIF(
      pg_catalog.current_setting('app.user_id', true), ''
    )::uuid
    AND requested_membership_id = NULLIF(
      pg_catalog.current_setting('app.membership_id', true), ''
    )::uuid
    AND (
      requested_identity_binding_id IS NULL
      OR requested_identity_binding_id = NULLIF(
        pg_catalog.current_setting('app.identity_binding_id', true), ''
      )::uuid
    )
$authority$;

ALTER FUNCTION taptime_server.current_offline_actor_matches_v1(uuid, uuid, uuid, uuid)
  OWNER TO taptime_offline_lease_function_owner;
REVOKE ALL ON FUNCTION taptime_server.current_offline_actor_matches_v1(
  uuid, uuid, uuid, uuid
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.current_offline_actor_matches_v1(
  uuid, uuid, uuid, uuid
) TO
  taptime_offline_lease_issuer,
  taptime_offline_event_ingestor,
  taptime_offline_reconciliation_reader;

CREATE POLICY offline_installations_lease_policy
  ON taptime_server.offline_installations
  FOR ALL TO taptime_offline_lease_issuer
  USING (
    taptime_server.current_offline_actor_matches_v1(
      organization_id, user_id, membership_id, identity_binding_id
    )
  )
  WITH CHECK (
    taptime_server.current_offline_actor_matches_v1(
      organization_id, user_id, membership_id, identity_binding_id
    )
  );

CREATE POLICY offline_installations_event_policy
  ON taptime_server.offline_installations
  FOR SELECT TO taptime_offline_event_ingestor
  USING (
    taptime_server.current_offline_actor_matches_v1(
      organization_id, user_id, membership_id, NULL
    )
  );

CREATE POLICY offline_capture_leases_lease_policy
  ON taptime_server.offline_capture_leases
  FOR ALL TO taptime_offline_lease_issuer
  USING (
    taptime_server.current_offline_actor_matches_v1(
      organization_id, user_id, membership_id, identity_binding_id
    )
  )
  WITH CHECK (
    taptime_server.current_offline_actor_matches_v1(
      organization_id, user_id, membership_id, identity_binding_id
    )
  );

CREATE POLICY offline_capture_leases_event_policy
  ON taptime_server.offline_capture_leases
  FOR SELECT TO taptime_offline_event_ingestor
  USING (
    taptime_server.current_offline_actor_matches_v1(
      organization_id, user_id, membership_id, NULL
    )
  );

CREATE POLICY offline_capture_lease_items_lease_policy
  ON taptime_server.offline_capture_lease_items
  FOR ALL TO taptime_offline_lease_issuer
  USING (
    organization_id = NULLIF(
      pg_catalog.current_setting('app.organization_id', true), ''
    )::uuid
  )
  WITH CHECK (
    organization_id = NULLIF(
      pg_catalog.current_setting('app.organization_id', true), ''
    )::uuid
  );

CREATE POLICY offline_capture_lease_items_event_policy
  ON taptime_server.offline_capture_lease_items
  FOR SELECT TO taptime_offline_event_ingestor
  USING (
    organization_id = NULLIF(
      pg_catalog.current_setting('app.organization_id', true), ''
    )::uuid
  );

CREATE POLICY offline_lease_receipts_lease_policy
  ON taptime_server.offline_capture_lease_receipts
  FOR ALL TO taptime_offline_lease_issuer
  USING (
    taptime_server.current_offline_actor_matches_v1(
      organization_id, user_id, membership_id, identity_binding_id
    )
  )
  WITH CHECK (
    taptime_server.current_offline_actor_matches_v1(
      organization_id, user_id, membership_id, identity_binding_id
    )
  );

CREATE POLICY offline_sync_cursors_event_policy
  ON taptime_server.offline_sync_cursors
  FOR ALL TO taptime_offline_event_ingestor
  USING (
    taptime_server.current_offline_actor_matches_v1(
      organization_id, user_id, membership_id, NULL
    )
  )
  WITH CHECK (
    taptime_server.current_offline_actor_matches_v1(
      organization_id, user_id, membership_id, NULL
    )
  );

CREATE POLICY offline_reconciliations_event_policy
  ON taptime_server.offline_event_reconciliations
  FOR ALL TO taptime_offline_event_ingestor
  USING (
    taptime_server.current_offline_actor_matches_v1(
      organization_id, user_id, membership_id, NULL
    )
  )
  WITH CHECK (
    taptime_server.current_offline_actor_matches_v1(
      organization_id, user_id, membership_id, NULL
    )
  );

CREATE POLICY offline_reconciliations_reader_policy
  ON taptime_server.offline_event_reconciliations
  FOR SELECT TO taptime_offline_reconciliation_reader
  USING (
    taptime_server.current_offline_actor_matches_v1(
      organization_id, user_id, membership_id, NULL
    )
  );

GRANT USAGE ON SCHEMA taptime_server TO
  taptime_offline_lease_issuer,
  taptime_offline_event_ingestor,
  taptime_offline_reconciliation_reader;
GRANT EXECUTE ON FUNCTION taptime_server.normalize_taptime_name_v1(text, text)
  TO taptime_offline_lease_issuer;
GRANT EXECUTE ON FUNCTION taptime_server.current_organization_id()
  TO taptime_offline_event_ingestor;
GRANT EXECUTE ON FUNCTION taptime_server.current_user_id()
  TO taptime_offline_event_ingestor;
GRANT EXECUTE ON FUNCTION taptime_server.has_active_membership(uuid)
  TO taptime_offline_event_ingestor;

GRANT SELECT, INSERT ON
  taptime_server.offline_installations,
  taptime_server.offline_capture_leases,
  taptime_server.offline_capture_lease_items,
  taptime_server.offline_capture_lease_receipts
TO taptime_offline_lease_issuer;

GRANT SELECT ON
  taptime_server.offline_installations,
  taptime_server.offline_capture_leases,
  taptime_server.offline_capture_lease_items,
  taptime_server.customers,
  taptime_server.nfc_tags,
  taptime_server.nfc_assignments,
  taptime_server.work_events,
  taptime_server.time_entries,
  taptime_server.canonical_decisions,
  taptime_server.sync_receipts
TO taptime_offline_event_ingestor;

GRANT INSERT ON
  taptime_server.work_events,
  taptime_server.time_entries,
  taptime_server.canonical_decisions,
  taptime_server.sync_receipts,
  taptime_server.audit_events
TO taptime_offline_event_ingestor;
GRANT UPDATE (status, stop_work_event_id, stopped_at, row_version)
  ON taptime_server.time_entries TO taptime_offline_event_ingestor;

GRANT SELECT, INSERT ON taptime_server.offline_sync_cursors
  TO taptime_offline_event_ingestor;
GRANT UPDATE (
  last_durable_sequence, review_predecessor_sequence, updated_at
) ON taptime_server.offline_sync_cursors TO taptime_offline_event_ingestor;
GRANT SELECT, INSERT ON taptime_server.offline_event_reconciliations
  TO taptime_offline_event_ingestor;
GRANT SELECT ON taptime_server.offline_event_reconciliations
  TO taptime_offline_reconciliation_reader;

CREATE POLICY customers_offline_event_select
  ON taptime_server.customers
  FOR SELECT TO taptime_offline_event_ingestor
  USING (organization_id = taptime_server.current_organization_id());
CREATE POLICY nfc_tags_offline_event_select
  ON taptime_server.nfc_tags
  FOR SELECT TO taptime_offline_event_ingestor
  USING (organization_id = taptime_server.current_organization_id());
CREATE POLICY nfc_assignments_offline_event_select
  ON taptime_server.nfc_assignments
  FOR SELECT TO taptime_offline_event_ingestor
  USING (organization_id = taptime_server.current_organization_id());
CREATE POLICY work_events_offline_event_select
  ON taptime_server.work_events
  FOR SELECT TO taptime_offline_event_ingestor
  USING (
    organization_id = taptime_server.current_organization_id()
    AND triggered_by_user_id = taptime_server.current_user_id()
  );
CREATE POLICY work_events_offline_event_insert
  ON taptime_server.work_events
  FOR INSERT TO taptime_offline_event_ingestor
  WITH CHECK (
    organization_id = taptime_server.current_organization_id()
    AND triggered_by_user_id = taptime_server.current_user_id()
  );
CREATE POLICY time_entries_offline_event_select
  ON taptime_server.time_entries
  FOR SELECT TO taptime_offline_event_ingestor
  USING (
    organization_id = taptime_server.current_organization_id()
    AND user_id = taptime_server.current_user_id()
  );
CREATE POLICY time_entries_offline_event_insert
  ON taptime_server.time_entries
  FOR INSERT TO taptime_offline_event_ingestor
  WITH CHECK (
    organization_id = taptime_server.current_organization_id()
    AND user_id = taptime_server.current_user_id()
    AND taptime_server.has_active_membership(organization_id)
  );
CREATE POLICY time_entries_offline_event_update
  ON taptime_server.time_entries
  FOR UPDATE TO taptime_offline_event_ingestor
  USING (
    organization_id = taptime_server.current_organization_id()
    AND user_id = taptime_server.current_user_id()
    AND taptime_server.has_active_membership(organization_id)
  )
  WITH CHECK (
    organization_id = taptime_server.current_organization_id()
    AND user_id = taptime_server.current_user_id()
    AND taptime_server.has_active_membership(organization_id)
  );
CREATE POLICY canonical_decisions_offline_event_select
  ON taptime_server.canonical_decisions
  FOR SELECT TO taptime_offline_event_ingestor
  USING (
    organization_id = taptime_server.current_organization_id()
    AND actor_user_id = taptime_server.current_user_id()
  );
CREATE POLICY canonical_decisions_offline_event_insert
  ON taptime_server.canonical_decisions
  FOR INSERT TO taptime_offline_event_ingestor
  WITH CHECK (
    organization_id = taptime_server.current_organization_id()
    AND actor_user_id = taptime_server.current_user_id()
    AND taptime_server.has_active_membership(organization_id)
  );
CREATE POLICY sync_receipts_offline_event_select
  ON taptime_server.sync_receipts
  FOR SELECT TO taptime_offline_event_ingestor
  USING (
    organization_id = taptime_server.current_organization_id()
    AND user_id = taptime_server.current_user_id()
  );
CREATE POLICY sync_receipts_offline_event_insert
  ON taptime_server.sync_receipts
  FOR INSERT TO taptime_offline_event_ingestor
  WITH CHECK (
    organization_id = taptime_server.current_organization_id()
    AND user_id = taptime_server.current_user_id()
  );
CREATE POLICY audit_events_offline_event_insert
  ON taptime_server.audit_events
  FOR INSERT TO taptime_offline_event_ingestor
  WITH CHECK (
    organization_id = taptime_server.current_organization_id()
    AND actor_user_id = taptime_server.current_user_id()
    AND work_event_user_id = taptime_server.current_user_id()
    AND work_event_id IS NOT NULL
  );

REVOKE ALL ON ALL TABLES IN SCHEMA taptime_server FROM
  taptime_offline_lease_function_owner,
  taptime_offline_event_function_owner,
  taptime_offline_reconciliation_function_owner;

GRANT USAGE ON SCHEMA taptime_server TO
  taptime_offline_lease_function_owner,
  taptime_offline_event_function_owner,
  taptime_offline_reconciliation_function_owner;

GRANT SELECT ON
  taptime_server.identity_bindings,
  taptime_server.memberships,
  taptime_server.customers,
  taptime_server.nfc_tags,
  taptime_server.nfc_assignments
TO taptime_offline_lease_function_owner;
GRANT UPDATE ON
  taptime_server.identity_bindings,
  taptime_server.memberships,
  taptime_server.customers,
  taptime_server.nfc_tags,
  taptime_server.nfc_assignments
TO taptime_offline_lease_function_owner;

GRANT SELECT ON
  taptime_server.identity_bindings,
  taptime_server.memberships,
  taptime_server.customers,
  taptime_server.nfc_tags,
  taptime_server.nfc_assignments,
  taptime_server.offline_installations,
  taptime_server.offline_capture_leases,
  taptime_server.offline_capture_lease_items,
  taptime_server.offline_sync_cursors,
  taptime_server.offline_event_reconciliations,
  taptime_server.work_events,
  taptime_server.sync_receipts,
  taptime_server.canonical_decisions,
  taptime_server.time_entries
TO taptime_offline_event_function_owner;
GRANT UPDATE ON
  taptime_server.identity_bindings,
  taptime_server.memberships,
  taptime_server.customers,
  taptime_server.nfc_tags,
  taptime_server.nfc_assignments
TO taptime_offline_event_function_owner;

GRANT SELECT ON
  taptime_server.identity_bindings,
  taptime_server.memberships,
  taptime_server.offline_event_reconciliations,
  taptime_server.canonical_decisions
TO taptime_offline_reconciliation_function_owner;

CREATE FUNCTION taptime_server.lock_offline_active_actor_v1(
  verified_issuer text,
  verified_subject text
)
RETURNS TABLE (
  identity_binding_id uuid,
  user_id uuid,
  organization_id uuid,
  membership_id uuid,
  membership_role text,
  membership_row_version bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $actor$
BEGIN
  IF pg_catalog.current_setting('role', true) NOT IN (
    'taptime_offline_lease_issuer',
    'taptime_offline_event_ingestor',
    'taptime_offline_reconciliation_reader'
  ) OR verified_issuer IS NULL OR verified_subject IS NULL THEN
    RAISE EXCEPTION 'Offline actor capability rejected' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT binding.id, binding.user_id, membership.organization_id, membership.id,
         membership.role, membership.row_version
  FROM taptime_server.identity_bindings AS binding
  JOIN taptime_server.memberships AS membership ON membership.user_id = binding.user_id
  WHERE binding.issuer = verified_issuer
    AND binding.subject = verified_subject
    AND binding.revoked_at IS NULL
    AND membership.revoked_at IS NULL
  FOR SHARE OF binding, membership;
END
$actor$;

ALTER FUNCTION taptime_server.lock_offline_active_actor_v1(text, text)
  OWNER TO taptime_offline_lease_function_owner;
REVOKE ALL ON FUNCTION taptime_server.lock_offline_active_actor_v1(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.lock_offline_active_actor_v1(text, text)
  TO taptime_offline_lease_issuer, taptime_offline_reconciliation_reader;

CREATE FUNCTION taptime_server.lock_offline_historical_actor_v1(
  verified_issuer text,
  verified_subject text,
  requested_membership_id uuid
)
RETURNS TABLE (
  identity_binding_id uuid,
  user_id uuid,
  organization_id uuid,
  membership_id uuid,
  membership_role text,
  membership_row_version bigint,
  identity_current boolean,
  membership_current boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $actor$
BEGIN
  IF pg_catalog.current_setting('role', true) <> 'taptime_offline_event_ingestor'
    OR verified_issuer IS NULL
    OR verified_subject IS NULL
    OR requested_membership_id IS NULL
  THEN
    RAISE EXCEPTION 'Offline historical actor capability rejected' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT binding.id, binding.user_id, membership.organization_id, membership.id,
         membership.role, membership.row_version, binding.revoked_at IS NULL,
         membership.revoked_at IS NULL
  FROM taptime_server.identity_bindings AS binding
  JOIN taptime_server.memberships AS membership ON membership.user_id = binding.user_id
  WHERE binding.issuer = verified_issuer
    AND binding.subject = verified_subject
    AND membership.id = requested_membership_id
  FOR SHARE OF binding, membership;
END
$actor$;

ALTER FUNCTION taptime_server.lock_offline_historical_actor_v1(text, text, uuid)
  OWNER TO taptime_offline_event_function_owner;
REVOKE ALL ON FUNCTION taptime_server.lock_offline_historical_actor_v1(text, text, uuid)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.lock_offline_historical_actor_v1(text, text, uuid)
  TO taptime_offline_event_ingestor;

CREATE FUNCTION taptime_server.lock_offline_capture_projection_v1(
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
  ORDER BY assignment.id
  FOR SHARE OF assignment, tag, customer;
END
$projection$;

ALTER FUNCTION taptime_server.lock_offline_capture_projection_v1(uuid)
  OWNER TO taptime_offline_lease_function_owner;
REVOKE ALL ON FUNCTION taptime_server.lock_offline_capture_projection_v1(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.lock_offline_capture_projection_v1(uuid)
  TO taptime_offline_lease_issuer;

CREATE FUNCTION taptime_server.lock_offline_historical_configuration_v1(
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

ALTER FUNCTION taptime_server.lock_offline_historical_configuration_v1(
  uuid, uuid, uuid, uuid
) OWNER TO taptime_offline_event_function_owner;
REVOKE ALL ON FUNCTION taptime_server.lock_offline_historical_configuration_v1(
  uuid, uuid, uuid, uuid
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.lock_offline_historical_configuration_v1(
  uuid, uuid, uuid, uuid
) TO taptime_offline_event_ingestor;

CREATE FUNCTION taptime_server.has_offline_review_predecessor_v1(
  requested_organization_id uuid,
  requested_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $predecessor$
BEGIN
  IF pg_catalog.current_setting('role', true) <> 'taptime_offline_event_ingestor'
    OR requested_organization_id IS NULL
    OR requested_user_id IS NULL
    OR requested_organization_id <> NULLIF(
      pg_catalog.current_setting('app.organization_id', true), ''
    )::uuid
    OR requested_user_id <> NULLIF(
      pg_catalog.current_setting('app.user_id', true), ''
    )::uuid
  THEN
    RAISE EXCEPTION 'Offline review predecessor capability rejected'
      USING ERRCODE = '42501';
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM taptime_server.offline_event_reconciliations AS reconciliation
    WHERE reconciliation.organization_id = requested_organization_id
      AND reconciliation.user_id = requested_user_id
      AND reconciliation.result_status = 'review_pending'
  );
END
$predecessor$;

ALTER FUNCTION taptime_server.has_offline_review_predecessor_v1(uuid, uuid)
  OWNER TO taptime_offline_event_function_owner;
REVOKE ALL ON FUNCTION taptime_server.has_offline_review_predecessor_v1(uuid, uuid)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.has_offline_review_predecessor_v1(uuid, uuid)
  TO taptime_offline_event_ingestor;

CREATE FUNCTION taptime_server.read_offline_event_reconciliations_v1(
  requested_work_event_ids uuid[]
)
RETURNS TABLE (
  work_event_id uuid,
  receipt_id uuid,
  device_sequence bigint,
  result_status text,
  review_reason text,
  decision_type text,
  reason text,
  time_entry_id uuid,
  active_time_entry_id uuid,
  previous_work_event_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $reconciliation$
BEGIN
  IF pg_catalog.current_setting('role', true) <> 'taptime_offline_reconciliation_reader'
    OR requested_work_event_ids IS NULL
    OR pg_catalog.cardinality(requested_work_event_ids) NOT BETWEEN 1 AND 25
  THEN
    RAISE EXCEPTION 'Offline reconciliation capability rejected' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT reconciliation.work_event_id, reconciliation.receipt_id,
         reconciliation.device_sequence, reconciliation.result_status,
         reconciliation.review_reason, decision.decision_type, decision.reason,
         decision.time_entry_id, decision.active_time_entry_id,
         decision.previous_work_event_id
  FROM taptime_server.offline_event_reconciliations AS reconciliation
  LEFT JOIN taptime_server.canonical_decisions AS decision
    ON decision.organization_id = reconciliation.organization_id
   AND decision.actor_user_id = reconciliation.user_id
   AND decision.work_event_id = reconciliation.decision_work_event_id
  WHERE reconciliation.organization_id = NULLIF(
      pg_catalog.current_setting('app.organization_id', true), ''
    )::uuid
    AND reconciliation.user_id = NULLIF(
      pg_catalog.current_setting('app.user_id', true), ''
    )::uuid
    AND reconciliation.membership_id = NULLIF(
      pg_catalog.current_setting('app.membership_id', true), ''
    )::uuid
    AND reconciliation.work_event_id = ANY(requested_work_event_ids)
  ORDER BY reconciliation.device_sequence;
END
$reconciliation$;

ALTER FUNCTION taptime_server.read_offline_event_reconciliations_v1(uuid[])
  OWNER TO taptime_offline_reconciliation_function_owner;
REVOKE ALL ON FUNCTION taptime_server.read_offline_event_reconciliations_v1(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.read_offline_event_reconciliations_v1(uuid[])
  TO taptime_offline_reconciliation_reader;

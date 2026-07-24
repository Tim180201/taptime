-- DA5 additive generalized WorkTarget, trigger provenance and isolated Mobile read capabilities.
DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'taptime_mobile_own_time_reader') THEN
    CREATE ROLE taptime_mobile_own_time_reader
      NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'taptime_mobile_target_reader') THEN
    CREATE ROLE taptime_mobile_target_reader
      NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'taptime_project_administrator') THEN
    CREATE ROLE taptime_project_administrator
      NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'taptime_mobile_read_function_owner') THEN
    CREATE ROLE taptime_mobile_read_function_owner
      NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION BYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'taptime_work_target_function_owner') THEN
    CREATE ROLE taptime_work_target_function_owner
      NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION BYPASSRLS;
  END IF;
END
$roles$;

ALTER ROLE taptime_mobile_own_time_reader WITH NOLOGIN NOINHERIT NOBYPASSRLS;
ALTER ROLE taptime_mobile_target_reader WITH NOLOGIN NOINHERIT NOBYPASSRLS;
ALTER ROLE taptime_project_administrator WITH NOLOGIN NOINHERIT NOBYPASSRLS;
ALTER ROLE taptime_mobile_read_function_owner WITH NOLOGIN NOINHERIT BYPASSRLS;
ALTER ROLE taptime_work_target_function_owner WITH NOLOGIN NOINHERIT BYPASSRLS;

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
    'taptime_mobile_own_time_reader',
    'taptime_mobile_target_reader',
    'taptime_project_administrator',
    'taptime_mobile_read_function_owner',
    'taptime_work_target_function_owner'
  ]
  LOOP
    SELECT role.oid INTO STRICT role_oid
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
      RAISE EXCEPTION 'DA5 roles must have no pre-existing ownership, ACL, policy, default-ACL, role-setting or shared-object dependency in this database'
        USING ERRCODE = '42501';
    END IF;
  END LOOP;
END
$normalize_role_graph$;

CREATE TABLE taptime_server.work_targets (
  organization_id uuid NOT NULL REFERENCES taptime_server.organizations (id),
  target_type text NOT NULL CHECK (target_type IN ('customer', 'project', 'general_work')),
  target_id uuid NOT NULL,
  display_name text NOT NULL,
  active boolean NOT NULL,
  row_version bigint NOT NULL DEFAULT 1 CHECK (row_version > 0),
  built_in boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.transaction_timestamp(),
  deactivated_at timestamptz,
  PRIMARY KEY (organization_id, target_type, target_id),
  CONSTRAINT work_targets_builtin_shape CHECK (
    (target_type = 'general_work' AND built_in AND active AND deactivated_at IS NULL)
    OR (target_type <> 'general_work' AND NOT built_in)
  ),
  CONSTRAINT work_targets_activity_shape CHECK (
    (active AND deactivated_at IS NULL)
    OR (NOT active AND deactivated_at IS NOT NULL)
  ),
  CONSTRAINT work_targets_display_name_shape CHECK (
    pg_catalog.char_length(display_name) BETWEEN 1 AND 120
    AND pg_catalog.octet_length(display_name) <= 480
  )
);

CREATE UNIQUE INDEX work_targets_one_general_per_organization
  ON taptime_server.work_targets (organization_id)
  WHERE target_type = 'general_work';

CREATE TABLE taptime_server.projects (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES taptime_server.organizations (id),
  display_name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  row_version bigint NOT NULL DEFAULT 1 CHECK (row_version > 0),
  created_at timestamptz NOT NULL DEFAULT pg_catalog.transaction_timestamp(),
  deactivated_at timestamptz,
  CONSTRAINT projects_tenant_id_unique UNIQUE (organization_id, id),
  CONSTRAINT projects_name_shape CHECK (
    display_name = taptime_server.normalize_taptime_name_v1(display_name, 'customer')
  ),
  CONSTRAINT projects_activity_shape CHECK (
    (active AND deactivated_at IS NULL)
    OR (NOT active AND deactivated_at IS NOT NULL)
  )
);

CREATE TABLE taptime_server.project_command_receipts (
  organization_id uuid NOT NULL REFERENCES taptime_server.organizations (id),
  command_id uuid NOT NULL,
  actor_user_id uuid NOT NULL,
  actor_membership_id uuid NOT NULL,
  command_type text NOT NULL CHECK (command_type IN ('create', 'deactivate')),
  request_hash char(64) NOT NULL CHECK (request_hash COLLATE "C" ~ '^[0-9a-f]{64}$'),
  project_id uuid NOT NULL,
  result_display_name text NOT NULL,
  result_active boolean NOT NULL,
  result_row_version bigint NOT NULL CHECK (result_row_version > 0),
  created_at timestamptz NOT NULL DEFAULT pg_catalog.transaction_timestamp(),
  PRIMARY KEY (organization_id, command_id),
  CONSTRAINT project_receipts_actor_fk FOREIGN KEY (
    organization_id, actor_user_id, actor_membership_id
  ) REFERENCES taptime_server.memberships (organization_id, user_id, id)
);

CREATE FUNCTION taptime_server.reject_general_work_target_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $immutable$
BEGIN
  IF OLD.target_type = 'general_work' THEN
    RAISE EXCEPTION 'General Work target is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$immutable$;
REVOKE ALL ON FUNCTION taptime_server.reject_general_work_target_change() FROM PUBLIC;

CREATE TRIGGER work_targets_general_immutable
  BEFORE UPDATE OR DELETE ON taptime_server.work_targets
  FOR EACH ROW EXECUTE FUNCTION taptime_server.reject_general_work_target_change();

CREATE FUNCTION taptime_server.ensure_organization_general_work_target_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $general$
BEGIN
  INSERT INTO taptime_server.work_targets (
    organization_id, target_type, target_id, display_name, active, built_in
  ) VALUES (
    NEW.id, 'general_work', pg_catalog.gen_random_uuid(),
    'Allgemeine Arbeitszeit', true, true
  );
  RETURN NEW;
END
$general$;

ALTER FUNCTION taptime_server.ensure_organization_general_work_target_v1()
  OWNER TO taptime_work_target_function_owner;
REVOKE ALL ON FUNCTION taptime_server.ensure_organization_general_work_target_v1() FROM PUBLIC;

CREATE TRIGGER organizations_general_work_target
  AFTER INSERT ON taptime_server.organizations
  FOR EACH ROW EXECUTE FUNCTION taptime_server.ensure_organization_general_work_target_v1();

INSERT INTO taptime_server.work_targets (
  organization_id, target_type, target_id, display_name, active, built_in,
  row_version, created_at, deactivated_at
)
SELECT customer.organization_id, 'customer', customer.id, customer.display_name,
       customer.active, false, customer.row_version, customer.created_at,
       customer.deactivated_at
FROM taptime_server.customers AS customer;

INSERT INTO taptime_server.work_targets (
  organization_id, target_type, target_id, display_name, active, built_in
)
SELECT organization.id, 'general_work', pg_catalog.gen_random_uuid(),
       'Allgemeine Arbeitszeit', true, true
FROM taptime_server.organizations AS organization;

CREATE FUNCTION taptime_server.synchronize_customer_work_target_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $customer_target$
BEGIN
  INSERT INTO taptime_server.work_targets (
    organization_id, target_type, target_id, display_name, active, built_in,
    row_version, created_at, deactivated_at
  ) VALUES (
    NEW.organization_id, 'customer', NEW.id, NEW.display_name, NEW.active, false,
    NEW.row_version, NEW.created_at, NEW.deactivated_at
  )
  ON CONFLICT (organization_id, target_type, target_id) DO UPDATE
  SET display_name = EXCLUDED.display_name,
      active = EXCLUDED.active,
      row_version = EXCLUDED.row_version,
      deactivated_at = EXCLUDED.deactivated_at;
  RETURN NEW;
END
$customer_target$;

ALTER FUNCTION taptime_server.synchronize_customer_work_target_v1()
  OWNER TO taptime_work_target_function_owner;
REVOKE ALL ON FUNCTION taptime_server.synchronize_customer_work_target_v1() FROM PUBLIC;

CREATE TRIGGER customers_work_target_projection
  AFTER INSERT OR UPDATE OF display_name, active, row_version, deactivated_at
  ON taptime_server.customers
  FOR EACH ROW EXECUTE FUNCTION taptime_server.synchronize_customer_work_target_v1();

CREATE FUNCTION taptime_server.synchronize_project_work_target_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $project_target$
BEGIN
  INSERT INTO taptime_server.work_targets (
    organization_id, target_type, target_id, display_name, active, built_in,
    row_version, created_at, deactivated_at
  ) VALUES (
    NEW.organization_id, 'project', NEW.id, NEW.display_name, NEW.active, false,
    NEW.row_version, NEW.created_at, NEW.deactivated_at
  )
  ON CONFLICT (organization_id, target_type, target_id) DO UPDATE
  SET active = EXCLUDED.active,
      row_version = EXCLUDED.row_version,
      deactivated_at = EXCLUDED.deactivated_at;
  RETURN NEW;
END
$project_target$;

ALTER FUNCTION taptime_server.synchronize_project_work_target_v1()
  OWNER TO taptime_work_target_function_owner;
REVOKE ALL ON FUNCTION taptime_server.synchronize_project_work_target_v1() FROM PUBLIC;

CREATE TRIGGER projects_work_target_projection
  AFTER INSERT OR UPDATE OF active, row_version, deactivated_at
  ON taptime_server.projects
  FOR EACH ROW EXECUTE FUNCTION taptime_server.synchronize_project_work_target_v1();

-- Generalize existing physical target columns additively. The legacy name remains to keep every
-- DA1–DA4 query and serialized v1 boundary byte-compatible.
ALTER TABLE taptime_server.work_events
  DROP CONSTRAINT work_events_target_type_check,
  DROP CONSTRAINT work_events_assignment_snapshot_fk,
  DROP CONSTRAINT work_events_content_hash_version_check,
  ALTER COLUMN assignment_id DROP NOT NULL,
  ALTER COLUMN nfc_tag_id DROP NOT NULL,
  ADD COLUMN trigger_type text NOT NULL DEFAULT 'nfc',
  ADD CONSTRAINT work_events_target_type_v2 CHECK (
    target_type IN ('customer', 'project', 'general_work')
  ),
  ADD CONSTRAINT work_events_content_hash_version_v2 CHECK (
    content_hash_version IN (1, 2)
    AND (content_hash_version = 1) = (
      trigger_type = 'nfc' AND target_type = 'customer'
    )
  ),
  ADD CONSTRAINT work_events_trigger_shape_v2 CHECK (
    (trigger_type = 'nfc' AND assignment_id IS NOT NULL AND nfc_tag_id IS NOT NULL)
    OR (trigger_type = 'manual' AND assignment_id IS NULL AND nfc_tag_id IS NULL)
  ),
  ADD CONSTRAINT work_events_assignment_snapshot_fk FOREIGN KEY (
    organization_id, assignment_id, nfc_tag_id, target_type, target_customer_id
  ) REFERENCES taptime_server.nfc_assignments (
    organization_id, id, nfc_tag_id, target_type, target_customer_id
  ),
  ADD CONSTRAINT work_events_target_fk_v2 FOREIGN KEY (
    organization_id, target_type, target_customer_id
  ) REFERENCES taptime_server.work_targets (organization_id, target_type, target_id);

ALTER TABLE taptime_server.time_entries
  DROP CONSTRAINT time_entries_target_type_check,
  DROP CONSTRAINT time_entries_target_fk,
  ADD COLUMN started_via text NOT NULL DEFAULT 'nfc',
  ADD COLUMN stopped_via text,
  ADD CONSTRAINT time_entries_target_type_v2 CHECK (
    target_type IN ('customer', 'project', 'general_work')
  ),
  ADD CONSTRAINT time_entries_target_fk_v2 FOREIGN KEY (
    organization_id, target_type, target_customer_id
  ) REFERENCES taptime_server.work_targets (organization_id, target_type, target_id);

UPDATE taptime_server.time_entries
SET stopped_via = 'nfc'
WHERE status = 'stopped';

ALTER TABLE taptime_server.time_entries
  ADD CONSTRAINT time_entries_provenance_v2 CHECK (
    started_via IN ('nfc', 'manual')
    AND (
      (status = 'started' AND stopped_via IS NULL)
      OR (status = 'stopped' AND stopped_via IN ('nfc', 'manual'))
    )
  );

ALTER TABLE taptime_server.canonical_decisions
  DROP CONSTRAINT canonical_decisions_target_type_check,
  ADD CONSTRAINT canonical_decisions_target_type_v2 CHECK (
    target_type IN ('customer', 'project', 'general_work')
  );

ALTER TABLE taptime_server.sync_receipts
  DROP CONSTRAINT sync_receipts_target_type_check,
  ADD CONSTRAINT sync_receipts_target_type_v2 CHECK (
    target_type IN ('customer', 'project', 'general_work')
  );

ALTER TABLE taptime_server.time_record_revisions
  DROP CONSTRAINT time_record_revisions_target_type_check,
  DROP CONSTRAINT time_record_revisions_customer_fk,
  ADD CONSTRAINT time_record_revisions_target_type_v2 CHECK (
    target_type IN ('customer', 'project', 'general_work')
  ),
  ADD CONSTRAINT time_record_revisions_target_fk_v2 FOREIGN KEY (
    organization_id, target_type, target_customer_id
  ) REFERENCES taptime_server.work_targets (organization_id, target_type, target_id);

ALTER TABLE taptime_server.offline_review_adjudications
  DROP CONSTRAINT offline_review_adjudications_target_type_check,
  ADD CONSTRAINT offline_review_adjudications_target_type_v2 CHECK (
    target_type IN ('customer', 'project', 'general_work')
  );

ALTER TABLE taptime_server.offline_capture_lease_items
  DROP CONSTRAINT offline_capture_lease_items_target_type_check,
  DROP CONSTRAINT offline_lease_items_assignment_snapshot_fk,
  DROP CONSTRAINT offline_lease_items_display_name,
  ALTER COLUMN lookup_value DROP NOT NULL,
  ALTER COLUMN assignment_id DROP NOT NULL,
  ALTER COLUMN nfc_tag_id DROP NOT NULL,
  ADD COLUMN item_type text NOT NULL DEFAULT 'nfc_assignment',
  ADD COLUMN assignment_row_version bigint,
  ADD COLUMN target_row_version bigint,
  ADD CONSTRAINT offline_lease_items_item_shape_v2 CHECK (
    (
      item_type = 'nfc_assignment'
      AND lookup_value IS NOT NULL AND assignment_id IS NOT NULL AND nfc_tag_id IS NOT NULL
      AND target_type = 'customer'
      AND assignment_row_version > 0
    )
    OR (
      item_type = 'manual_target'
      AND lookup_value IS NULL AND assignment_id IS NULL AND nfc_tag_id IS NULL
      AND target_type IN ('customer', 'project', 'general_work')
      AND assignment_row_version IS NULL
      AND target_row_version > 0
    )
  ),
  ADD CONSTRAINT offline_lease_items_assignment_snapshot_fk FOREIGN KEY (
    organization_id, assignment_id, nfc_tag_id, target_type, target_customer_id
  ) REFERENCES taptime_server.nfc_assignments (
    organization_id, id, nfc_tag_id, target_type, target_customer_id
  ),
  ADD CONSTRAINT offline_lease_items_target_fk_v2 FOREIGN KEY (
    organization_id, target_type, target_customer_id
  ) REFERENCES taptime_server.work_targets (organization_id, target_type, target_id),
  ADD CONSTRAINT offline_lease_items_display_name_v2 CHECK (
    pg_catalog.char_length(display_name) BETWEEN 1 AND 120
    AND pg_catalog.octet_length(display_name) <= 480
  );

UPDATE taptime_server.offline_capture_lease_items AS item
SET assignment_row_version = assignment.row_version,
    target_row_version = target.row_version
FROM taptime_server.nfc_assignments AS assignment,
     taptime_server.work_targets AS target
WHERE assignment.organization_id = item.organization_id
  AND assignment.id = item.assignment_id
  AND target.organization_id = item.organization_id
  AND target.target_type = item.target_type
  AND target.target_id = item.target_customer_id
  AND (item.assignment_row_version IS NULL OR item.target_row_version IS NULL);

UPDATE taptime_server.offline_capture_lease_items AS item
SET target_row_version = target.row_version
FROM taptime_server.work_targets AS target
WHERE target.organization_id = item.organization_id
  AND target.target_type = item.target_type
  AND target.target_id = item.target_customer_id
  AND item.target_row_version IS NULL;

ALTER TABLE taptime_server.offline_capture_lease_items
  ALTER COLUMN target_row_version SET NOT NULL;

ALTER TABLE taptime_server.offline_capture_leases
  ADD COLUMN lease_schema_version integer NOT NULL DEFAULT 1,
  ADD COLUMN manifest_version integer NOT NULL DEFAULT 1,
  ADD CONSTRAINT offline_capture_leases_version_v2 CHECK (
    (lease_schema_version = 1 AND manifest_version = 1)
    OR (lease_schema_version = 2 AND manifest_version = 2)
  );

ALTER TABLE taptime_server.offline_capture_lease_receipts
  ADD COLUMN lease_schema_version integer NOT NULL DEFAULT 1,
  ADD CONSTRAINT offline_capture_lease_receipts_version_v2 CHECK (
    lease_schema_version IN (1, 2)
  );

ALTER TABLE taptime_server.offline_event_reconciliations
  DROP CONSTRAINT offline_event_reconciliations_provenance_version_check,
  ADD CONSTRAINT offline_event_reconciliations_provenance_version_v2 CHECK (
    provenance_version IN (1, 2)
  );

CREATE FUNCTION taptime_server.lock_offline_capture_projection_v2(
  requested_organization_id uuid
)
RETURNS TABLE (
  item_type text,
  assignment_id uuid,
  nfc_tag_id uuid,
  target_type text,
  target_id uuid,
  display_name text,
  canonical_payload text,
  assignment_row_version bigint,
  target_row_version bigint
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
    RAISE EXCEPTION 'Offline v2 projection capability rejected' USING ERRCODE = '42501';
  END IF;

  PERFORM target.target_id
  FROM taptime_server.work_targets AS target
  WHERE target.organization_id = requested_organization_id
    AND target.active
  FOR SHARE;

  PERFORM assignment.id
  FROM taptime_server.nfc_assignments AS assignment
  JOIN taptime_server.nfc_tags AS tag
    ON tag.organization_id = assignment.organization_id
   AND tag.id = assignment.nfc_tag_id
  WHERE assignment.organization_id = requested_organization_id
    AND assignment.active
    AND assignment.valid_to IS NULL
  FOR SHARE OF assignment, tag;

  RETURN QUERY
  SELECT 'nfc_assignment'::text, assignment.id, tag.id, target.target_type,
         target.target_id, target.display_name, tag.payload_value,
         assignment.row_version, target.row_version
  FROM taptime_server.nfc_assignments AS assignment
  JOIN taptime_server.nfc_tags AS tag
    ON tag.organization_id = assignment.organization_id
   AND tag.id = assignment.nfc_tag_id
  JOIN taptime_server.work_targets AS target
    ON target.organization_id = assignment.organization_id
   AND target.target_type = assignment.target_type
   AND target.target_id = assignment.target_customer_id
  WHERE assignment.organization_id = requested_organization_id
    AND assignment.active
    AND assignment.valid_to IS NULL
    AND target.active
  UNION ALL
  SELECT 'manual_target'::text, NULL::uuid, NULL::uuid, target.target_type,
         target.target_id, target.display_name, NULL::text, NULL::bigint,
         target.row_version
  FROM taptime_server.work_targets AS target
  WHERE target.organization_id = requested_organization_id
    AND target.active
  ORDER BY 1, 5;
END
$projection$;

ALTER FUNCTION taptime_server.lock_offline_capture_projection_v2(uuid)
  OWNER TO taptime_offline_lease_function_owner;
REVOKE ALL ON FUNCTION taptime_server.lock_offline_capture_projection_v2(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.lock_offline_capture_projection_v2(uuid)
  TO taptime_offline_lease_issuer;

GRANT SELECT, UPDATE ON taptime_server.work_targets
  TO taptime_offline_lease_function_owner;

CREATE FUNCTION taptime_server.lock_offline_historical_configuration_v2(
  requested_organization_id uuid,
  requested_target_type text,
  requested_target_id uuid,
  requested_assignment_id uuid,
  requested_nfc_tag_id uuid
)
RETURNS TABLE (
  target_type text,
  target_id uuid,
  target_active boolean,
  target_created_at timestamptz,
  target_deactivated_at timestamptz,
  target_row_version bigint,
  assignment_active boolean,
  assignment_valid_from timestamptz,
  assignment_valid_to timestamptz,
  assignment_row_version bigint,
  tag_created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $configuration$
BEGIN
  IF pg_catalog.current_setting('role', true) <> 'taptime_offline_event_ingestor'
    OR requested_organization_id IS DISTINCT FROM NULLIF(
      pg_catalog.current_setting('app.organization_id', true), ''
    )::uuid
    OR requested_target_type NOT IN ('customer', 'project', 'general_work')
    OR (requested_assignment_id IS NULL) <> (requested_nfc_tag_id IS NULL)
  THEN
    RAISE EXCEPTION 'Offline v2 historical configuration capability rejected'
      USING ERRCODE = '42501';
  END IF;

  PERFORM target.target_id
  FROM taptime_server.work_targets AS target
  WHERE target.organization_id = requested_organization_id
    AND target.target_type = requested_target_type
    AND target.target_id = requested_target_id
  FOR UPDATE;

  IF requested_assignment_id IS NOT NULL THEN
    PERFORM assignment.id
    FROM taptime_server.nfc_assignments AS assignment
    JOIN taptime_server.nfc_tags AS tag
      ON tag.organization_id = assignment.organization_id
     AND tag.id = assignment.nfc_tag_id
    WHERE assignment.organization_id = requested_organization_id
      AND assignment.id = requested_assignment_id
      AND tag.id = requested_nfc_tag_id
    FOR UPDATE OF assignment, tag;
  END IF;

  RETURN QUERY
  SELECT target.target_type, target.target_id, target.active, target.created_at,
         target.deactivated_at, target.row_version,
         assignment.active, assignment.valid_from, assignment.valid_to,
         assignment.row_version, tag.created_at
  FROM taptime_server.work_targets AS target
  LEFT JOIN taptime_server.nfc_assignments AS assignment
    ON assignment.organization_id = target.organization_id
   AND assignment.id = requested_assignment_id
  LEFT JOIN taptime_server.nfc_tags AS tag
    ON tag.organization_id = assignment.organization_id
   AND tag.id = requested_nfc_tag_id
  WHERE target.organization_id = requested_organization_id
    AND target.target_type = requested_target_type
    AND target.target_id = requested_target_id;
END
$configuration$;

ALTER FUNCTION taptime_server.lock_offline_historical_configuration_v2(
  uuid, text, uuid, uuid, uuid
) OWNER TO taptime_offline_lease_function_owner;
REVOKE ALL ON FUNCTION taptime_server.lock_offline_historical_configuration_v2(
  uuid, text, uuid, uuid, uuid
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.lock_offline_historical_configuration_v2(
  uuid, text, uuid, uuid, uuid
) TO taptime_offline_event_ingestor;

-- The additive target FK and provenance column must not silently remove capabilities that the
-- pre-DA5 runtime roles already held on their established lifecycle paths.
GRANT SELECT ON taptime_server.work_targets, taptime_server.nfc_assignments
  TO taptime_server_lifecycle, taptime_offline_lease_issuer,
     taptime_offline_event_ingestor;
GRANT UPDATE (status, stop_work_event_id, stopped_at, stopped_via, row_version)
  ON taptime_server.time_entries
  TO taptime_server_lifecycle, taptime_offline_event_ingestor;

CREATE POLICY work_targets_offline_lease_select ON taptime_server.work_targets
  FOR SELECT TO taptime_offline_lease_issuer
  USING (
    organization_id = NULLIF(
      pg_catalog.current_setting('app.organization_id', true), ''
    )::uuid
  );
CREATE POLICY work_targets_offline_event_select ON taptime_server.work_targets
  FOR SELECT TO taptime_offline_event_ingestor
  USING (
    organization_id = NULLIF(
      pg_catalog.current_setting('app.organization_id', true), ''
    )::uuid
  );
CREATE POLICY nfc_assignments_offline_lease_select ON taptime_server.nfc_assignments
  FOR SELECT TO taptime_offline_lease_issuer
  USING (
    organization_id = NULLIF(
      pg_catalog.current_setting('app.organization_id', true), ''
    )::uuid
  );

CREATE OR REPLACE VIEW taptime_server.effective_time_records_v2
WITH (security_barrier = true)
AS
WITH latest_revision AS (
  SELECT DISTINCT ON (revision.organization_id, revision.time_record_id)
    revision.*
  FROM taptime_server.time_record_revisions AS revision
  ORDER BY revision.organization_id, revision.time_record_id, revision.revision_number DESC
)
SELECT entry.organization_id, entry.id AS time_record_id, entry.id AS canonical_time_entry_id,
       entry.user_id, entry.target_type, entry.target_customer_id AS target_id,
       COALESCE(revision.effective_started_at, entry.started_at) AS effective_started_at,
       CASE WHEN entry.status = 'started' THEN NULL
            ELSE COALESCE(revision.effective_stopped_at, entry.stopped_at) END AS effective_stopped_at,
       entry.status, entry.row_version AS base_row_version,
       COALESCE(revision.revision_number, 0::bigint) AS effective_revision_number,
       'canonical'::text AS source,
       COALESCE(entry.started_via, 'nfc'::text) AS started_via,
       CASE
         WHEN entry.status = 'started' THEN NULL::text
         ELSE COALESCE(entry.stopped_via, 'nfc'::text)
       END AS stopped_via
FROM taptime_server.time_entries AS entry
LEFT JOIN latest_revision AS revision
  ON revision.organization_id = entry.organization_id
 AND revision.time_record_id = entry.id
UNION ALL
SELECT revision.organization_id, revision.time_record_id, NULL::uuid,
       revision.user_id, revision.target_type, revision.target_customer_id,
       revision.effective_started_at, revision.effective_stopped_at,
       'stopped'::text, 0::bigint, revision.revision_number,
       'recovered'::text, NULL::text, NULL::text
FROM latest_revision AS revision
WHERE revision.canonical_time_entry_id IS NULL;

REVOKE ALL ON taptime_server.effective_time_records_v2 FROM PUBLIC;

CREATE FUNCTION taptime_server.has_current_mobile_self_v1(
  requested_organization_id uuid,
  requested_user_id uuid,
  requested_membership_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $authority$
  SELECT requested_organization_id = NULLIF(
      pg_catalog.current_setting('app.organization_id', true), ''
    )::uuid
    AND requested_user_id = NULLIF(
      pg_catalog.current_setting('app.user_id', true), ''
    )::uuid
    AND requested_membership_id = NULLIF(
      pg_catalog.current_setting('app.membership_id', true), ''
    )::uuid
    AND pg_catalog.current_setting('app.membership_role', true)
      IN ('employee', 'administrator')
    AND EXISTS (
      SELECT 1 FROM taptime_server.memberships AS membership
      WHERE membership.organization_id = requested_organization_id
        AND membership.user_id = requested_user_id
        AND membership.id = requested_membership_id
        AND membership.role IN ('employee', 'administrator')
        AND membership.revoked_at IS NULL
    )
$authority$;

ALTER FUNCTION taptime_server.has_current_mobile_self_v1(uuid, uuid, uuid)
  OWNER TO taptime_mobile_read_function_owner;
REVOKE ALL ON FUNCTION taptime_server.has_current_mobile_self_v1(uuid, uuid, uuid) FROM PUBLIC;

CREATE FUNCTION taptime_server.read_mobile_own_time_v1(
  requested_organization_id uuid,
  requested_user_id uuid,
  requested_membership_id uuid,
  requested_after_started_at timestamptz,
  requested_after_time_record_id uuid,
  requested_limit integer
)
RETURNS TABLE (
  row_kind text,
  time_record_id uuid,
  source text,
  target_type text,
  target_display_name text,
  status text,
  started_at timestamptz,
  stopped_at timestamptz,
  started_via text,
  stopped_via text,
  window_started_at timestamptz,
  window_ended_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $own_time$
DECLARE
  boundary timestamptz := pg_catalog.transaction_timestamp();
BEGIN
  IF pg_catalog.current_setting('role', true) <> 'taptime_mobile_own_time_reader'
    OR NOT taptime_server.has_current_mobile_self_v1(
      requested_organization_id, requested_user_id, requested_membership_id
    )
    OR requested_limit NOT BETWEEN 1 AND 21
    OR (requested_after_started_at IS NULL) <> (requested_after_time_record_id IS NULL)
  THEN
    RAISE EXCEPTION 'Mobile own-time capability rejected' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT 'active'::text, record.time_record_id, record.source,
         record.target_type, target.display_name, record.status,
         record.effective_started_at, record.effective_stopped_at,
         record.started_via, record.stopped_via,
         boundary - interval '31 days', boundary
  FROM taptime_server.effective_time_records_v2 AS record
  JOIN taptime_server.work_targets AS target
    ON target.organization_id = record.organization_id
   AND target.target_type = record.target_type
   AND target.target_id = record.target_id
  WHERE record.organization_id = requested_organization_id
    AND record.user_id = requested_user_id
    AND record.status = 'started'
  LIMIT 1;

  RETURN QUERY
  SELECT 'history'::text, record.time_record_id, record.source,
         record.target_type, target.display_name, record.status,
         record.effective_started_at, record.effective_stopped_at,
         record.started_via, record.stopped_via,
         boundary - interval '31 days', boundary
  FROM taptime_server.effective_time_records_v2 AS record
  JOIN taptime_server.work_targets AS target
    ON target.organization_id = record.organization_id
   AND target.target_type = record.target_type
   AND target.target_id = record.target_id
  WHERE record.organization_id = requested_organization_id
    AND record.user_id = requested_user_id
    AND record.status = 'stopped'
    AND record.effective_started_at >= boundary - interval '31 days'
    AND record.effective_started_at < boundary
    AND (
      requested_after_started_at IS NULL
      OR (record.effective_started_at, record.time_record_id)
         < (requested_after_started_at, requested_after_time_record_id)
    )
  ORDER BY record.effective_started_at DESC, record.time_record_id DESC
  LIMIT requested_limit;
END
$own_time$;

ALTER FUNCTION taptime_server.read_mobile_own_time_v1(
  uuid, uuid, uuid, timestamptz, uuid, integer
) OWNER TO taptime_mobile_read_function_owner;
REVOKE ALL ON FUNCTION taptime_server.read_mobile_own_time_v1(
  uuid, uuid, uuid, timestamptz, uuid, integer
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.read_mobile_own_time_v1(
  uuid, uuid, uuid, timestamptz, uuid, integer
) TO taptime_mobile_own_time_reader;

CREATE FUNCTION taptime_server.read_mobile_work_targets_v1(
  requested_organization_id uuid,
  requested_user_id uuid,
  requested_membership_id uuid,
  requested_after_type_rank integer,
  requested_after_display_name text,
  requested_after_target_id uuid,
  requested_limit integer
)
RETURNS TABLE (
  target_type text,
  target_id uuid,
  display_name text,
  row_version bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $targets$
BEGIN
  IF pg_catalog.current_setting('role', true) <> 'taptime_mobile_target_reader'
    OR NOT taptime_server.has_current_mobile_self_v1(
      requested_organization_id, requested_user_id, requested_membership_id
    )
    OR requested_limit NOT BETWEEN 1 AND 51
    OR (requested_after_type_rank IS NULL)
       <> (requested_after_display_name IS NULL OR requested_after_target_id IS NULL)
  THEN
    RAISE EXCEPTION 'Mobile target capability rejected' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT target.target_type, target.target_id, target.display_name, target.row_version
  FROM taptime_server.work_targets AS target
  WHERE target.organization_id = requested_organization_id
    AND target.active
    AND (
      requested_after_type_rank IS NULL
      OR (
        CASE target.target_type
          WHEN 'customer' THEN 1 WHEN 'project' THEN 2 ELSE 3
        END,
        target.display_name COLLATE "C",
        target.target_id
      ) > (
        requested_after_type_rank,
        requested_after_display_name COLLATE "C",
        requested_after_target_id
      )
    )
  ORDER BY
    CASE target.target_type WHEN 'customer' THEN 1 WHEN 'project' THEN 2 ELSE 3 END,
    target.display_name COLLATE "C",
    target.target_id
  LIMIT requested_limit;
END
$targets$;

ALTER FUNCTION taptime_server.read_mobile_work_targets_v1(
  uuid, uuid, uuid, integer, text, uuid, integer
) OWNER TO taptime_mobile_read_function_owner;
REVOKE ALL ON FUNCTION taptime_server.read_mobile_work_targets_v1(
  uuid, uuid, uuid, integer, text, uuid, integer
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.read_mobile_work_targets_v1(
  uuid, uuid, uuid, integer, text, uuid, integer
) TO taptime_mobile_target_reader;

CREATE FUNCTION taptime_server.lock_active_work_target_v1(
  requested_organization_id uuid,
  requested_target_type text,
  requested_target_id uuid
)
RETURNS TABLE (target_type text, target_id uuid, active boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $target_lock$
BEGIN
  IF pg_catalog.current_setting('role', true) <> 'taptime_server_lifecycle'
    OR requested_organization_id IS DISTINCT FROM NULLIF(
      pg_catalog.current_setting('app.organization_id', true), ''
    )::uuid
    OR requested_target_type NOT IN ('customer', 'project', 'general_work')
  THEN
    RAISE EXCEPTION 'WorkTarget lock rejected' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT target.target_type, target.target_id, target.active
  FROM taptime_server.work_targets AS target
  WHERE target.organization_id = requested_organization_id
    AND target.target_type = requested_target_type
    AND target.target_id = requested_target_id
  FOR UPDATE;
END
$target_lock$;

ALTER FUNCTION taptime_server.lock_active_work_target_v1(uuid, text, uuid)
  OWNER TO taptime_work_target_function_owner;
REVOKE ALL ON FUNCTION taptime_server.lock_active_work_target_v1(uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.lock_active_work_target_v1(uuid, text, uuid)
  TO taptime_server_lifecycle;

CREATE FUNCTION taptime_server.lock_project_for_administration_v1(
  requested_organization_id uuid,
  requested_project_id uuid
)
RETURNS TABLE (
  project_id uuid,
  display_name text,
  active boolean,
  row_version bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $project_lock$
BEGIN
  IF pg_catalog.current_setting('role', true) <> 'taptime_project_administrator'
    OR requested_organization_id IS DISTINCT FROM NULLIF(
      pg_catalog.current_setting('app.organization_id', true), ''
    )::uuid
    OR pg_catalog.current_setting('app.membership_role', true) <> 'administrator'
  THEN
    RAISE EXCEPTION 'Project lock rejected' USING ERRCODE = '42501';
  END IF;

  PERFORM target.target_id
  FROM taptime_server.work_targets AS target
  WHERE target.organization_id = requested_organization_id
    AND target.target_type = 'project'
    AND target.target_id = requested_project_id
  FOR UPDATE;

  RETURN QUERY
  SELECT project.id, project.display_name, project.active, project.row_version
  FROM taptime_server.projects AS project
  WHERE project.organization_id = requested_organization_id
    AND project.id = requested_project_id
  FOR UPDATE;
END
$project_lock$;

ALTER FUNCTION taptime_server.lock_project_for_administration_v1(uuid, uuid)
  OWNER TO taptime_work_target_function_owner;
REVOKE ALL ON FUNCTION taptime_server.lock_project_for_administration_v1(uuid, uuid)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.lock_project_for_administration_v1(uuid, uuid)
  TO taptime_project_administrator;

CREATE FUNCTION taptime_server.project_has_active_time_entry_v1(
  requested_organization_id uuid,
  requested_project_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $project_use$
BEGIN
  IF pg_catalog.current_setting('role', true) <> 'taptime_project_administrator'
    OR requested_organization_id IS DISTINCT FROM NULLIF(
      pg_catalog.current_setting('app.organization_id', true), ''
    )::uuid
    OR pg_catalog.current_setting('app.membership_role', true) <> 'administrator'
  THEN
    RAISE EXCEPTION 'Project active-use check rejected' USING ERRCODE = '42501';
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM taptime_server.time_entries AS entry
    WHERE entry.organization_id = requested_organization_id
      AND entry.target_type = 'project'
      AND entry.target_customer_id = requested_project_id
      AND entry.status = 'started'
  );
END
$project_use$;

ALTER FUNCTION taptime_server.project_has_active_time_entry_v1(uuid, uuid)
  OWNER TO taptime_work_target_function_owner;
REVOKE ALL ON FUNCTION taptime_server.project_has_active_time_entry_v1(uuid, uuid)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.project_has_active_time_entry_v1(uuid, uuid)
  TO taptime_project_administrator;

CREATE FUNCTION taptime_server.append_project_audit_v1(
  requested_organization_id uuid,
  requested_actor_user_id uuid,
  requested_membership_id uuid,
  requested_command_id uuid,
  requested_project_id uuid,
  requested_event_type text,
  requested_payload jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $project_audit$
BEGIN
  IF pg_catalog.current_setting('role', true) <> 'taptime_project_administrator'
    OR requested_organization_id IS DISTINCT FROM NULLIF(
      pg_catalog.current_setting('app.organization_id', true), ''
    )::uuid
    OR requested_actor_user_id IS DISTINCT FROM NULLIF(
      pg_catalog.current_setting('app.user_id', true), ''
    )::uuid
    OR requested_membership_id IS DISTINCT FROM NULLIF(
      pg_catalog.current_setting('app.membership_id', true), ''
    )::uuid
    OR pg_catalog.current_setting('app.membership_role', true) <> 'administrator'
    OR requested_event_type NOT IN ('ProjectCreated', 'ProjectDeactivated')
  THEN
    RAISE EXCEPTION 'Project audit rejected' USING ERRCODE = '42501';
  END IF;
  INSERT INTO taptime_server.audit_events (
    id, organization_id, actor_user_id, event_type, entity_type, entity_id,
    occurred_at, correlation_id, payload
  ) VALUES (
    pg_catalog.gen_random_uuid(), requested_organization_id, requested_actor_user_id,
    requested_event_type, 'Project', requested_project_id,
    pg_catalog.transaction_timestamp(), requested_command_id::text, requested_payload
  );
END
$project_audit$;

ALTER FUNCTION taptime_server.append_project_audit_v1(
  uuid, uuid, uuid, uuid, uuid, text, jsonb
) OWNER TO taptime_work_target_function_owner;
REVOKE ALL ON FUNCTION taptime_server.append_project_audit_v1(
  uuid, uuid, uuid, uuid, uuid, text, jsonb
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.append_project_audit_v1(
  uuid, uuid, uuid, uuid, uuid, text, jsonb
) TO taptime_project_administrator;

ALTER TABLE taptime_server.work_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.work_targets FORCE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.projects FORCE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.project_command_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.project_command_receipts FORCE ROW LEVEL SECURITY;

CREATE POLICY work_targets_project_admin_select ON taptime_server.work_targets
  FOR SELECT TO taptime_project_administrator
  USING (
    organization_id = NULLIF(pg_catalog.current_setting('app.organization_id', true), '')::uuid
    AND pg_catalog.current_setting('app.membership_role', true) = 'administrator'
  );
CREATE POLICY projects_project_admin_select ON taptime_server.projects
  FOR SELECT TO taptime_project_administrator
  USING (
    organization_id = NULLIF(pg_catalog.current_setting('app.organization_id', true), '')::uuid
    AND pg_catalog.current_setting('app.membership_role', true) = 'administrator'
  );
CREATE POLICY projects_project_admin_insert ON taptime_server.projects
  FOR INSERT TO taptime_project_administrator
  WITH CHECK (
    organization_id = NULLIF(pg_catalog.current_setting('app.organization_id', true), '')::uuid
    AND pg_catalog.current_setting('app.membership_role', true) = 'administrator'
  );
CREATE POLICY projects_project_admin_update ON taptime_server.projects
  FOR UPDATE TO taptime_project_administrator
  USING (
    organization_id = NULLIF(pg_catalog.current_setting('app.organization_id', true), '')::uuid
    AND pg_catalog.current_setting('app.membership_role', true) = 'administrator'
  )
  WITH CHECK (
    organization_id = NULLIF(pg_catalog.current_setting('app.organization_id', true), '')::uuid
    AND pg_catalog.current_setting('app.membership_role', true) = 'administrator'
  );
CREATE POLICY project_receipts_admin_all ON taptime_server.project_command_receipts
  FOR ALL TO taptime_project_administrator
  USING (
    organization_id = NULLIF(pg_catalog.current_setting('app.organization_id', true), '')::uuid
    AND pg_catalog.current_setting('app.membership_role', true) = 'administrator'
  )
  WITH CHECK (
    organization_id = NULLIF(pg_catalog.current_setting('app.organization_id', true), '')::uuid
    AND pg_catalog.current_setting('app.membership_role', true) = 'administrator'
  );

REVOKE ALL ON ALL TABLES IN SCHEMA taptime_server FROM
  taptime_mobile_own_time_reader, taptime_mobile_target_reader,
  taptime_project_administrator, taptime_mobile_read_function_owner,
  taptime_work_target_function_owner;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA taptime_server FROM
  taptime_mobile_own_time_reader, taptime_mobile_target_reader,
  taptime_project_administrator, taptime_mobile_read_function_owner,
  taptime_work_target_function_owner;
GRANT USAGE ON SCHEMA taptime_server TO
  taptime_mobile_own_time_reader, taptime_mobile_target_reader,
  taptime_project_administrator, taptime_mobile_read_function_owner,
  taptime_work_target_function_owner;
GRANT SELECT ON taptime_server.memberships, taptime_server.work_targets,
  taptime_server.time_entries, taptime_server.time_record_revisions
  TO taptime_mobile_read_function_owner;
GRANT SELECT ON taptime_server.effective_time_records_v2
  TO taptime_mobile_read_function_owner;
GRANT SELECT, INSERT ON taptime_server.projects
  TO taptime_project_administrator;
GRANT UPDATE (active, row_version, deactivated_at) ON taptime_server.projects
  TO taptime_project_administrator;
GRANT SELECT ON taptime_server.work_targets, taptime_server.time_entries
  TO taptime_project_administrator;
GRANT SELECT, INSERT ON taptime_server.project_command_receipts
  TO taptime_project_administrator;
GRANT INSERT, UPDATE ON taptime_server.work_targets
  TO taptime_work_target_function_owner;
GRANT SELECT ON taptime_server.work_targets
  TO taptime_work_target_function_owner;
GRANT SELECT ON taptime_server.projects, taptime_server.time_entries
  TO taptime_work_target_function_owner;
GRANT UPDATE (target_id) ON taptime_server.work_targets
  TO taptime_work_target_function_owner;
GRANT UPDATE (id) ON taptime_server.projects
  TO taptime_work_target_function_owner;
GRANT INSERT ON taptime_server.audit_events
  TO taptime_work_target_function_owner;

GRANT SELECT ON taptime_server.effective_time_records_v2,
  taptime_server.organizations, taptime_server.memberships,
  taptime_server.work_targets
  TO taptime_time_export_function_owner;

CREATE FUNCTION taptime_server.time_entry_export_v1_is_compatible(
  requested_organization_id uuid,
  requested_from_inclusive timestamptz,
  requested_to_exclusive timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $compatibility$
BEGIN
  IF pg_catalog.current_setting('role', true) <> 'taptime_time_exporter'
    OR NOT taptime_server.has_current_time_export_authority(requested_organization_id)
    OR requested_from_inclusive IS NULL
    OR requested_to_exclusive IS NULL
    OR requested_to_exclusive <= requested_from_inclusive
    OR requested_to_exclusive - requested_from_inclusive > interval '31 days'
  THEN
    RAISE EXCEPTION 'Time export v1 compatibility capability rejected' USING ERRCODE = '42501';
  END IF;
  RETURN NOT EXISTS (
    SELECT 1
    FROM taptime_server.effective_time_records_v2 AS record
    WHERE record.organization_id = requested_organization_id
      AND record.effective_started_at >= requested_from_inclusive
      AND record.effective_started_at < requested_to_exclusive
      AND record.target_type <> 'customer'
  );
END
$compatibility$;

ALTER FUNCTION taptime_server.time_entry_export_v1_is_compatible(
  uuid, timestamptz, timestamptz
) OWNER TO taptime_time_export_function_owner;
REVOKE ALL ON FUNCTION taptime_server.time_entry_export_v1_is_compatible(
  uuid, timestamptz, timestamptz
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.time_entry_export_v1_is_compatible(
  uuid, timestamptz, timestamptz
) TO taptime_time_exporter;

CREATE FUNCTION taptime_server.read_effective_time_entry_export_v2(
  requested_organization_id uuid,
  requested_from_inclusive timestamptz,
  requested_to_exclusive timestamptz,
  requested_limit integer
)
RETURNS TABLE (
  organization_id uuid,
  organization_name text,
  time_entry_id uuid,
  employee_membership_id uuid,
  employee_display_name text,
  record_source text,
  target_type text,
  target_id uuid,
  target_display_name text,
  status text,
  started_via text,
  stopped_via text,
  started_at timestamptz,
  stopped_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $export$
BEGIN
  IF pg_catalog.current_setting('role', true) <> 'taptime_time_exporter'
    OR NOT taptime_server.has_current_time_export_authority(requested_organization_id)
    OR requested_from_inclusive IS NULL
    OR requested_to_exclusive IS NULL
    OR requested_to_exclusive <= requested_from_inclusive
    OR requested_to_exclusive - requested_from_inclusive > interval '31 days'
    OR requested_limit NOT BETWEEN 1 AND 10001
  THEN
    RAISE EXCEPTION 'Time export v2 capability rejected' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT record.organization_id, organization.name, record.time_record_id,
         membership.id, COALESCE(membership.display_name, ''),
         record.source, record.target_type, record.target_id, target.display_name,
         record.status, record.started_via, record.stopped_via,
         record.effective_started_at, record.effective_stopped_at
  FROM taptime_server.effective_time_records_v2 AS record
  JOIN taptime_server.organizations AS organization
    ON organization.id = record.organization_id
  JOIN taptime_server.memberships AS membership
    ON membership.organization_id = record.organization_id
   AND membership.user_id = record.user_id
  JOIN taptime_server.work_targets AS target
    ON target.organization_id = record.organization_id
   AND target.target_type = record.target_type
   AND target.target_id = record.target_id
  WHERE record.organization_id = requested_organization_id
    AND record.effective_started_at >= requested_from_inclusive
    AND record.effective_started_at < requested_to_exclusive
  ORDER BY record.effective_started_at, record.time_record_id
  LIMIT requested_limit;
END
$export$;

ALTER FUNCTION taptime_server.read_effective_time_entry_export_v2(
  uuid, timestamptz, timestamptz, integer
) OWNER TO taptime_time_export_function_owner;
REVOKE ALL ON FUNCTION taptime_server.read_effective_time_entry_export_v2(
  uuid, timestamptz, timestamptz, integer
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.read_effective_time_entry_export_v2(
  uuid, timestamptz, timestamptz, integer
) TO taptime_time_exporter;

CREATE FUNCTION taptime_server.append_time_entry_export_audit_v2(
  requested_audit_id uuid,
  requested_organization_id uuid,
  requested_actor_user_id uuid,
  requested_correlation_id text,
  requested_from_inclusive timestamptz,
  requested_to_exclusive timestamptz,
  requested_row_count integer,
  requested_byte_count integer,
  requested_sha256 text
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog
AS $audit$
BEGIN
  IF pg_catalog.current_setting('role', true) <> 'taptime_time_exporter'
    OR requested_audit_id IS NULL
    OR requested_actor_user_id IS DISTINCT FROM NULLIF(
      pg_catalog.current_setting('app.user_id', true), ''
    )::uuid
    OR NOT taptime_server.has_current_time_export_authority(requested_organization_id)
    OR requested_correlation_id COLLATE "C"
       !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    OR requested_to_exclusive <= requested_from_inclusive
    OR requested_to_exclusive - requested_from_inclusive > interval '31 days'
    OR requested_row_count NOT BETWEEN 0 AND 10000
    OR requested_byte_count NOT BETWEEN 1 AND 8388608
    OR requested_sha256 COLLATE "C" !~ '^[0-9a-f]{64}$'
  THEN
    RAISE EXCEPTION 'Time export v2 audit capability rejected' USING ERRCODE = '42501';
  END IF;
  INSERT INTO taptime_server.audit_events (
    id, organization_id, actor_user_id, event_type, entity_type, entity_id,
    occurred_at, correlation_id, payload
  ) VALUES (
    requested_audit_id, requested_organization_id, requested_actor_user_id,
    'TimeEntryExportGenerated', 'TimeEntryExport', requested_audit_id,
    pg_catalog.transaction_timestamp(), requested_correlation_id,
    pg_catalog.jsonb_build_object(
      'schemaVersion', 2,
      'fromInclusive', requested_from_inclusive,
      'toExclusive', requested_to_exclusive,
      'rowCount', requested_row_count,
      'byteCount', requested_byte_count,
      'sha256', requested_sha256
    )
  );
END
$audit$;

ALTER FUNCTION taptime_server.append_time_entry_export_audit_v2(
  uuid, uuid, uuid, text, timestamptz, timestamptz, integer, integer, text
) OWNER TO taptime_time_export_function_owner;
REVOKE ALL ON FUNCTION taptime_server.append_time_entry_export_audit_v2(
  uuid, uuid, uuid, text, timestamptz, timestamptz, integer, integer, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.append_time_entry_export_audit_v2(
  uuid, uuid, uuid, text, timestamptz, timestamptz, integer, integer, text
) TO taptime_time_exporter;

GRANT SELECT ON taptime_server.effective_time_records_v2,
  taptime_server.work_targets
  TO taptime_time_review_read_function_owner;

CREATE FUNCTION taptime_server.read_effective_time_records_v2(
  requested_organization_id uuid,
  requested_actor_user_id uuid,
  requested_membership_id uuid,
  requested_from_inclusive timestamptz,
  requested_to_exclusive timestamptz,
  requested_after_started_at timestamptz,
  requested_after_time_record_id uuid,
  requested_limit integer
)
RETURNS TABLE (
  time_record_id uuid,
  employee_membership_id uuid,
  employee_display_name text,
  target_type text,
  target_id uuid,
  target_display_name text,
  source text,
  status text,
  started_via text,
  stopped_via text,
  started_at timestamptz,
  stopped_at timestamptz,
  base_row_version bigint,
  effective_revision_number bigint,
  overlaps_another_record boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $records$
BEGIN
  IF pg_catalog.current_setting('role', true) <> 'taptime_time_review_reader'
    OR NOT taptime_server.has_current_time_review_administrator_v1(
      requested_organization_id, requested_actor_user_id, requested_membership_id
    )
    OR requested_from_inclusive IS NULL
    OR requested_to_exclusive IS NULL
    OR requested_to_exclusive <= requested_from_inclusive
    OR requested_to_exclusive - requested_from_inclusive > interval '31 days'
    OR requested_limit NOT BETWEEN 1 AND 101
    OR (requested_after_started_at IS NULL) <> (requested_after_time_record_id IS NULL)
  THEN
    RAISE EXCEPTION 'Time review v2 read capability rejected' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT record.time_record_id, membership.id, COALESCE(membership.display_name, ''),
         record.target_type, record.target_id, target.display_name,
         record.source, record.status, record.started_via, record.stopped_via,
         record.effective_started_at, record.effective_stopped_at,
         record.base_row_version, record.effective_revision_number,
         EXISTS (
           SELECT 1 FROM taptime_server.effective_time_records_v2 AS other
           WHERE other.organization_id = record.organization_id
             AND other.user_id = record.user_id
             AND other.time_record_id <> record.time_record_id
             AND other.effective_started_at < COALESCE(
               record.effective_stopped_at, pg_catalog.transaction_timestamp()
             )
             AND COALESCE(other.effective_stopped_at, pg_catalog.transaction_timestamp())
               > record.effective_started_at
         )
  FROM taptime_server.effective_time_records_v2 AS record
  LEFT JOIN taptime_server.memberships AS membership
    ON membership.organization_id = record.organization_id
   AND membership.user_id = record.user_id
  JOIN taptime_server.work_targets AS target
    ON target.organization_id = record.organization_id
   AND target.target_type = record.target_type
   AND target.target_id = record.target_id
  WHERE record.organization_id = requested_organization_id
    AND record.effective_started_at >= requested_from_inclusive
    AND record.effective_started_at < requested_to_exclusive
    AND (
      requested_after_started_at IS NULL
      OR (record.effective_started_at, record.time_record_id)
         > (requested_after_started_at, requested_after_time_record_id)
    )
  ORDER BY record.effective_started_at, record.time_record_id
  LIMIT requested_limit;
END
$records$;

ALTER FUNCTION taptime_server.read_effective_time_records_v2(
  uuid, uuid, uuid, timestamptz, timestamptz, timestamptz, uuid, integer
) OWNER TO taptime_time_review_read_function_owner;
REVOKE ALL ON FUNCTION taptime_server.read_effective_time_records_v2(
  uuid, uuid, uuid, timestamptz, timestamptz, timestamptz, uuid, integer
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.read_effective_time_records_v2(
  uuid, uuid, uuid, timestamptz, timestamptz, timestamptz, uuid, integer
) TO taptime_time_review_reader;

CREATE FUNCTION taptime_server.read_time_review_items_v2(
  requested_organization_id uuid,
  requested_actor_user_id uuid,
  requested_membership_id uuid,
  requested_after_recorded_at timestamptz,
  requested_after_work_event_id uuid,
  requested_limit integer
)
RETURNS TABLE (
  review_item_id uuid,
  source_family text,
  employee_user_id uuid,
  employee_membership_id uuid,
  employee_display_name text,
  target_type text,
  target_id uuid,
  target_display_name text,
  trigger_type text,
  occurred_at timestamptz,
  recorded_at timestamptz,
  review_reason text,
  device_sequence bigint,
  predecessor_blocked boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $items$
BEGIN
  IF pg_catalog.current_setting('role', true) <> 'taptime_time_review_reader'
    OR NOT taptime_server.has_current_time_review_administrator_v1(
      requested_organization_id, requested_actor_user_id, requested_membership_id
    )
    OR requested_limit NOT BETWEEN 1 AND 101
    OR (requested_after_recorded_at IS NULL) <> (requested_after_work_event_id IS NULL)
  THEN
    RAISE EXCEPTION 'Time review item v2 capability rejected' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH unresolved AS (
    SELECT reconciliation.work_event_id, 'offline_v2'::text AS source_family,
           reconciliation.user_id, event.target_type, event.target_customer_id AS target_id,
           event.trigger_type, event.occurred_at, reconciliation.recorded_at,
           reconciliation.review_reason, reconciliation.device_sequence,
           EXISTS (
             SELECT 1 FROM taptime_server.offline_event_reconciliations AS later
             LEFT JOIN taptime_server.offline_review_adjudications AS later_adjudication
               ON later_adjudication.organization_id = later.organization_id
              AND later_adjudication.work_event_id = later.work_event_id
             WHERE later.organization_id = reconciliation.organization_id
               AND later.user_id = reconciliation.user_id
               AND later.installation_id = reconciliation.installation_id
               AND later.device_sequence > reconciliation.device_sequence
               AND later.result_status = 'review_pending'
               AND later.review_reason = 'predecessor_requires_review'
               AND later_adjudication.work_event_id IS NULL
           ) AS predecessor_blocked
    FROM taptime_server.offline_event_reconciliations AS reconciliation
    JOIN taptime_server.work_events AS event
      ON event.organization_id = reconciliation.organization_id
     AND event.id = reconciliation.work_event_id
    LEFT JOIN taptime_server.offline_review_adjudications AS adjudication
      ON adjudication.organization_id = reconciliation.organization_id
     AND adjudication.work_event_id = reconciliation.work_event_id
    WHERE reconciliation.organization_id = requested_organization_id
      AND reconciliation.result_status = 'review_pending'
      AND adjudication.work_event_id IS NULL
    UNION ALL
    SELECT event.id, 'server_legacy'::text, event.triggered_by_user_id,
           event.target_type, event.target_customer_id, event.trigger_type,
           event.occurred_at, event.received_at, 'server_lifecycle_deferred'::text,
           NULL::bigint, false
    FROM taptime_server.work_events AS event
    WHERE event.organization_id = requested_organization_id
      AND EXISTS (
        SELECT 1 FROM taptime_server.audit_events AS audit
        WHERE audit.organization_id = event.organization_id
          AND audit.work_event_id = event.id
          AND audit.event_type = 'LifecycleDeferred'
          AND audit.entity_type = 'WorkEvent'
      )
      AND NOT EXISTS (
        SELECT 1 FROM taptime_server.canonical_decisions AS decision
        WHERE decision.organization_id = event.organization_id
          AND decision.work_event_id = event.id
      )
      AND NOT EXISTS (
        SELECT 1 FROM taptime_server.offline_event_reconciliations AS reconciliation
        WHERE reconciliation.organization_id = event.organization_id
          AND reconciliation.work_event_id = event.id
      )
      AND NOT EXISTS (
        SELECT 1 FROM taptime_server.offline_review_adjudications AS adjudication
        WHERE adjudication.organization_id = event.organization_id
          AND adjudication.work_event_id = event.id
      )
  )
  SELECT unresolved.work_event_id, unresolved.source_family, unresolved.user_id,
         membership.id, COALESCE(membership.display_name, ''), unresolved.target_type,
         unresolved.target_id, target.display_name, unresolved.trigger_type,
         unresolved.occurred_at, unresolved.recorded_at, unresolved.review_reason,
         unresolved.device_sequence, unresolved.predecessor_blocked
  FROM unresolved
  LEFT JOIN taptime_server.memberships AS membership
    ON membership.organization_id = requested_organization_id
   AND membership.user_id = unresolved.user_id
  JOIN taptime_server.work_targets AS target
    ON target.organization_id = requested_organization_id
   AND target.target_type = unresolved.target_type
   AND target.target_id = unresolved.target_id
  WHERE requested_after_recorded_at IS NULL
     OR (unresolved.recorded_at, unresolved.work_event_id)
        > (requested_after_recorded_at, requested_after_work_event_id)
  ORDER BY unresolved.recorded_at, unresolved.work_event_id
  LIMIT requested_limit;
END
$items$;

ALTER FUNCTION taptime_server.read_time_review_items_v2(
  uuid, uuid, uuid, timestamptz, uuid, integer
) OWNER TO taptime_time_review_read_function_owner;
REVOKE ALL ON FUNCTION taptime_server.read_time_review_items_v2(
  uuid, uuid, uuid, timestamptz, uuid, integer
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.read_time_review_items_v2(
  uuid, uuid, uuid, timestamptz, uuid, integer
) TO taptime_time_review_reader;

COMMENT ON COLUMN taptime_server.work_events.target_customer_id IS
  'Legacy physical column name; DA5 stores the tenant-qualified WorkTarget ID for every target type.';
COMMENT ON COLUMN taptime_server.time_entries.target_customer_id IS
  'Legacy physical column name; DA5 stores the tenant-qualified WorkTarget ID for every target type.';

DO $roles$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'taptime_wal_archiver'
  ) THEN
    CREATE ROLE taptime_wal_archiver
      NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles
    WHERE rolname = 'taptime_wal_archive_function_owner'
  ) THEN
    CREATE ROLE taptime_wal_archive_function_owner
      NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT BYPASSRLS;
  END IF;
END
$roles$;

ALTER ROLE taptime_wal_archiver WITH
  NOLOGIN NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
ALTER ROLE taptime_wal_archive_function_owner WITH
  NOLOGIN NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION BYPASSRLS;

DO $verify_no_superuser$
DECLARE
  offending text;
BEGIN
  SELECT pg_catalog.string_agg(rolname, ', ' ORDER BY rolname) INTO offending
  FROM pg_catalog.pg_roles
  WHERE rolname IN (
    'taptime_wal_archiver',
    'taptime_wal_archive_function_owner'
  )
    AND rolsuper;
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'TapTime roles must not be SUPERUSER: %', offending;
  END IF;
END
$verify_no_superuser$;

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
    'taptime_wal_archiver',
    'taptime_wal_archive_function_owner'
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
      RAISE EXCEPTION 'WAL archive roles must have no pre-existing ownership, ACL, policy, default-ACL, role-setting or shared-object dependency in this database'
        USING ERRCODE = '42501';
    END IF;
  END LOOP;
END
$normalize_role_graph$;

-- Migration 023 can coexist with a previous application image during deploy rollback, but that
-- image must never reinstate commit-time acknowledgement. Reject it before it can inspect or
-- mutate an event; the current coordinator sets this transaction-local marker before this call.
CREATE OR REPLACE FUNCTION taptime_server.lock_offline_historical_actor_v1(
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
    OR pg_catalog.current_setting(
      'app.offline_archive_contract_version', true
    ) <> '4'
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

CREATE TABLE taptime_server.offsite_archive_cluster_identity (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  system_identifier bigint NOT NULL UNIQUE
);

INSERT INTO taptime_server.offsite_archive_cluster_identity (
  singleton, system_identifier
)
SELECT true, control.system_identifier
FROM pg_catalog.pg_control_system() AS control;

CREATE TABLE taptime_server.offline_event_archive_requirements (
  cluster_system_identifier bigint NOT NULL REFERENCES
    taptime_server.offsite_archive_cluster_identity(system_identifier),
  organization_id uuid NOT NULL,
  work_event_id uuid NOT NULL,
  receipt_id uuid NOT NULL,
  installation_id uuid NOT NULL,
  user_id uuid NOT NULL,
  membership_id uuid NOT NULL,
  device_sequence bigint NOT NULL CHECK (device_sequence > 0),
  required_wal_lsn pg_lsn NOT NULL,
  required_wal_file text NOT NULL CHECK (
    required_wal_file ~ '^[0-9A-F]{24}$'
  ),
  created_at timestamptz NOT NULL DEFAULT pg_catalog.transaction_timestamp(),
  PRIMARY KEY (organization_id, work_event_id),
  CONSTRAINT offline_archive_requirements_receipt_unique
    UNIQUE (organization_id, receipt_id),
  CONSTRAINT offline_archive_requirements_sequence_unique
    UNIQUE (organization_id, installation_id, device_sequence),
  CONSTRAINT offline_archive_requirements_reconciliation_fk FOREIGN KEY (
    organization_id, work_event_id
  ) REFERENCES taptime_server.offline_event_reconciliations (
    organization_id, work_event_id
  ) ON DELETE CASCADE
);

CREATE TABLE taptime_server.lifecycle_event_archive_requirements (
  cluster_system_identifier bigint NOT NULL REFERENCES
    taptime_server.offsite_archive_cluster_identity(system_identifier),
  organization_id uuid NOT NULL,
  work_event_id uuid NOT NULL,
  -- The first committed Receipt anchors the one durability requirement for the WorkEvent.
  -- Later append-only Receipt attempts validate against the same immutable WorkEvent proof.
  receipt_id uuid NOT NULL,
  user_id uuid NOT NULL,
  membership_id uuid NOT NULL,
  required_wal_lsn pg_lsn NOT NULL,
  required_wal_file text NOT NULL CHECK (
    required_wal_file ~ '^[0-9A-F]{24}$'
  ),
  created_at timestamptz NOT NULL DEFAULT pg_catalog.transaction_timestamp(),
  PRIMARY KEY (organization_id, work_event_id),
  CONSTRAINT lifecycle_archive_requirements_receipt_unique
    UNIQUE (organization_id, receipt_id),
  CONSTRAINT lifecycle_archive_requirements_membership_fk FOREIGN KEY (
    organization_id, user_id, membership_id
  ) REFERENCES taptime_server.memberships (organization_id, user_id, id),
  CONSTRAINT lifecycle_archive_requirements_work_event_fk FOREIGN KEY (
    organization_id, user_id, work_event_id
  ) REFERENCES taptime_server.work_events (
    organization_id, triggered_by_user_id, id
  ) ON DELETE CASCADE,
  CONSTRAINT lifecycle_archive_requirements_receipt_fk FOREIGN KEY (
    organization_id, receipt_id
  ) REFERENCES taptime_server.sync_receipts (organization_id, id)
);

CREATE TABLE taptime_server.offsite_wal_archive_receipts (
  cluster_system_identifier bigint NOT NULL REFERENCES
    taptime_server.offsite_archive_cluster_identity(system_identifier),
  wal_file text NOT NULL CHECK (wal_file ~ '^[0-9A-F]{24}$'),
  archive_name text NOT NULL CHECK (
    archive_name = 'wal-'
      || pg_catalog.lpad(pg_catalog.to_hex(cluster_system_identifier), 16, '0')
      || '-' || wal_file
  ),
  content_sha256 char(64) NOT NULL CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  archived_at timestamptz NOT NULL DEFAULT pg_catalog.transaction_timestamp(),
  PRIMARY KEY (cluster_system_identifier, wal_file),
  UNIQUE (archive_name)
);

CREATE TABLE taptime_server.offsite_base_backup_receipts (
  cluster_system_identifier bigint NOT NULL REFERENCES
    taptime_server.offsite_archive_cluster_identity(system_identifier),
  archive_name text NOT NULL CHECK (
    archive_name ~ (
      '^base-'
        || pg_catalog.lpad(pg_catalog.to_hex(cluster_system_identifier), 16, '0')
        || '-[0-9]{8}T[0-9]{6}Z$'
    )
  ),
  start_wal_lsn pg_lsn NOT NULL,
  start_wal_file text NOT NULL CHECK (start_wal_file ~ '^[0-9A-F]{24}$'),
  archived_at timestamptz NOT NULL DEFAULT pg_catalog.transaction_timestamp(),
  PRIMARY KEY (cluster_system_identifier, archive_name),
  UNIQUE (archive_name)
);

CREATE TABLE taptime_server.offsite_wal_archive_watermarks (
  cluster_system_identifier bigint NOT NULL REFERENCES
    taptime_server.offsite_archive_cluster_identity(system_identifier),
  base_archive_name text NOT NULL,
  wal_file text NOT NULL,
  predecessor_wal_file text CHECK (
    predecessor_wal_file IS NULL OR predecessor_wal_file ~ '^[0-9A-F]{24}$'
  ),
  advanced_at timestamptz NOT NULL DEFAULT pg_catalog.transaction_timestamp(),
  PRIMARY KEY (cluster_system_identifier, base_archive_name, wal_file),
  CONSTRAINT offsite_wal_watermark_base_fk FOREIGN KEY (
    cluster_system_identifier, base_archive_name
  ) REFERENCES taptime_server.offsite_base_backup_receipts (
    cluster_system_identifier, archive_name
  ),
  CONSTRAINT offsite_wal_watermark_receipt_fk FOREIGN KEY (
    cluster_system_identifier, wal_file
  ) REFERENCES taptime_server.offsite_wal_archive_receipts (
    cluster_system_identifier, wal_file
  ),
  CONSTRAINT offsite_wal_watermark_single_successor
    UNIQUE NULLS NOT DISTINCT (
      cluster_system_identifier, base_archive_name, predecessor_wal_file
    ),
  CONSTRAINT offsite_wal_watermark_predecessor_fk FOREIGN KEY (
    cluster_system_identifier, base_archive_name, predecessor_wal_file
  ) REFERENCES taptime_server.offsite_wal_archive_watermarks (
    cluster_system_identifier, base_archive_name, wal_file
  )
);

CREATE FUNCTION taptime_server.reject_offline_archive_requirement_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $immutable$
BEGIN
  RAISE EXCEPTION 'Offline archive requirements are immutable'
    USING ERRCODE = '55000';
END
$immutable$;

REVOKE ALL ON FUNCTION taptime_server.reject_offline_archive_requirement_change()
  FROM PUBLIC;

CREATE TRIGGER offline_archive_requirement_immutable
  BEFORE UPDATE ON taptime_server.offline_event_archive_requirements
  FOR EACH ROW EXECUTE FUNCTION taptime_server.reject_offline_archive_requirement_change();

CREATE TRIGGER lifecycle_archive_requirement_immutable
  BEFORE UPDATE ON taptime_server.lifecycle_event_archive_requirements
  FOR EACH ROW EXECUTE FUNCTION taptime_server.reject_offline_archive_requirement_change();

CREATE FUNCTION taptime_server.reject_offsite_wal_archive_receipt_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $immutable$
BEGIN
  RAISE EXCEPTION 'Offsite WAL archive receipts are immutable'
    USING ERRCODE = '55000';
END
$immutable$;

REVOKE ALL ON FUNCTION taptime_server.reject_offsite_wal_archive_receipt_change()
  FROM PUBLIC;

CREATE TRIGGER offsite_wal_archive_receipt_immutable
  BEFORE UPDATE OR DELETE ON taptime_server.offsite_wal_archive_receipts
  FOR EACH ROW EXECUTE FUNCTION taptime_server.reject_offsite_wal_archive_receipt_change();

CREATE TRIGGER offsite_base_backup_receipt_immutable
  BEFORE UPDATE OR DELETE ON taptime_server.offsite_base_backup_receipts
  FOR EACH ROW EXECUTE FUNCTION taptime_server.reject_offsite_wal_archive_receipt_change();

CREATE TRIGGER offsite_wal_archive_watermark_immutable
  BEFORE UPDATE OR DELETE ON taptime_server.offsite_wal_archive_watermarks
  FOR EACH ROW EXECUTE FUNCTION taptime_server.reject_offsite_wal_archive_receipt_change();

CREATE TRIGGER offsite_archive_cluster_identity_immutable
  BEFORE UPDATE OR DELETE ON taptime_server.offsite_archive_cluster_identity
  FOR EACH ROW EXECUTE FUNCTION taptime_server.reject_offsite_wal_archive_receipt_change();

ALTER TABLE taptime_server.offsite_archive_cluster_identity ENABLE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.offsite_archive_cluster_identity FORCE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.offline_event_archive_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.offline_event_archive_requirements FORCE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.lifecycle_event_archive_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.lifecycle_event_archive_requirements FORCE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.offsite_wal_archive_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.offsite_wal_archive_receipts FORCE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.offsite_base_backup_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.offsite_base_backup_receipts FORCE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.offsite_wal_archive_watermarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.offsite_wal_archive_watermarks FORCE ROW LEVEL SECURITY;

CREATE FUNCTION taptime_server.current_offsite_archive_cluster_identifier_v1()
RETURNS bigint
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $identity$
DECLARE
  stored_system_identifier bigint;
  live_system_identifier bigint;
BEGIN
  SELECT identity.system_identifier INTO stored_system_identifier
  FROM taptime_server.offsite_archive_cluster_identity AS identity
  WHERE identity.singleton;
  SELECT control.system_identifier INTO STRICT live_system_identifier
  FROM pg_catalog.pg_control_system() AS control;
  IF stored_system_identifier IS DISTINCT FROM live_system_identifier THEN
    RAISE EXCEPTION 'Offsite archive cluster identity does not match this PostgreSQL cluster'
      USING ERRCODE = '55000';
  END IF;
  RETURN live_system_identifier;
END
$identity$;

ALTER FUNCTION taptime_server.current_offsite_archive_cluster_identifier_v1()
  OWNER TO taptime_wal_archive_function_owner;
REVOKE ALL ON FUNCTION
  taptime_server.current_offsite_archive_cluster_identifier_v1() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION
  taptime_server.current_offsite_archive_cluster_identifier_v1()
  TO taptime_offline_event_function_owner;

CREATE FUNCTION taptime_server.offline_wal_requirement_is_archived_v1(
  required_cluster_system_identifier bigint,
  required_wal_lsn pg_lsn,
  required_wal_file text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $archived$
DECLARE
  current_system_identifier bigint;
  archived boolean;
BEGIN
  current_system_identifier :=
    taptime_server.current_offsite_archive_cluster_identifier_v1();
  IF required_cluster_system_identifier IS DISTINCT FROM current_system_identifier THEN
    RETURN false;
  END IF;
  SELECT EXISTS (
    SELECT
    FROM taptime_server.offsite_base_backup_receipts AS base
    WHERE base.cluster_system_identifier = required_cluster_system_identifier
      AND pg_catalog.substring(base.start_wal_file, 1, 8)
        = pg_catalog.substring(required_wal_file, 1, 8)
      AND (
        required_wal_lsn <= base.start_wal_lsn
        OR EXISTS (
          SELECT
          FROM taptime_server.offsite_wal_archive_watermarks AS watermark
          WHERE watermark.cluster_system_identifier = base.cluster_system_identifier
            AND watermark.base_archive_name = base.archive_name
            AND required_wal_file >= base.start_wal_file
            AND required_wal_file <= watermark.wal_file
        )
      )
  ) INTO archived;
  RETURN archived;
END
$archived$;

ALTER FUNCTION taptime_server.offline_wal_requirement_is_archived_v1(bigint, pg_lsn, text)
  OWNER TO taptime_wal_archive_function_owner;
REVOKE ALL ON FUNCTION
  taptime_server.offline_wal_requirement_is_archived_v1(bigint, pg_lsn, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION
  taptime_server.offline_wal_requirement_is_archived_v1(bigint, pg_lsn, text)
TO taptime_offline_event_ingestor, taptime_offline_reconciliation_reader,
  taptime_offline_event_function_owner,
  taptime_offline_reconciliation_function_owner;

CREATE POLICY offline_archive_requirements_event_policy
  ON taptime_server.offline_event_archive_requirements
  FOR SELECT TO taptime_offline_event_ingestor
  USING (
    organization_id = NULLIF(
      pg_catalog.current_setting('app.organization_id', true), ''
    )::uuid
    AND user_id = NULLIF(
      pg_catalog.current_setting('app.user_id', true), ''
    )::uuid
    AND membership_id = NULLIF(
      pg_catalog.current_setting('app.membership_id', true), ''
    )::uuid
  );

CREATE POLICY offline_archive_requirements_reconciliation_policy
  ON taptime_server.offline_event_archive_requirements
  FOR SELECT TO taptime_offline_reconciliation_reader
  USING (
    organization_id = NULLIF(
      pg_catalog.current_setting('app.organization_id', true), ''
    )::uuid
    AND user_id = NULLIF(
      pg_catalog.current_setting('app.user_id', true), ''
    )::uuid
    AND membership_id = NULLIF(
      pg_catalog.current_setting('app.membership_id', true), ''
    )::uuid
  );

GRANT SELECT ON taptime_server.offline_event_archive_requirements
  TO taptime_offline_event_ingestor;
GRANT SELECT ON taptime_server.offline_event_archive_requirements
  TO taptime_offline_reconciliation_reader;

-- A previous application image does not know that a database commit is only provisional. Hide
-- provisional retries from it and reject its new reconciliation rows, so deploy rollback fails
-- closed instead of restoring the pre-T-035 acknowledgement semantics. Archived rows remain
-- readable because acknowledging those is safe.
DROP POLICY offline_reconciliations_event_policy
  ON taptime_server.offline_event_reconciliations;
CREATE POLICY offline_reconciliations_event_select_policy
  ON taptime_server.offline_event_reconciliations
  FOR SELECT TO taptime_offline_event_ingestor
  USING (
    taptime_server.current_offline_actor_matches_v1(
      organization_id, user_id, membership_id, NULL
    )
    AND (
      pg_catalog.current_setting(
        'app.offline_archive_contract_version', true
      ) = '4'
      OR EXISTS (
        SELECT FROM taptime_server.offline_event_archive_requirements AS requirement
        WHERE requirement.organization_id = offline_event_reconciliations.organization_id
          AND requirement.work_event_id = offline_event_reconciliations.work_event_id
          AND taptime_server.offline_wal_requirement_is_archived_v1(
            requirement.cluster_system_identifier,
            requirement.required_wal_lsn, requirement.required_wal_file
          )
      )
    )
  );
CREATE POLICY offline_reconciliations_event_insert_policy
  ON taptime_server.offline_event_reconciliations
  FOR INSERT TO taptime_offline_event_ingestor
  WITH CHECK (
    taptime_server.current_offline_actor_matches_v1(
      organization_id, user_id, membership_id, NULL
    )
    AND pg_catalog.current_setting(
      'app.offline_archive_contract_version', true
    ) = '4'
  );

GRANT USAGE ON SCHEMA taptime_server TO
  taptime_wal_archiver, taptime_wal_archive_function_owner;
GRANT SELECT ON
  taptime_server.offsite_archive_cluster_identity,
  taptime_server.offline_event_archive_requirements,
  taptime_server.lifecycle_event_archive_requirements,
  taptime_server.offsite_wal_archive_receipts,
  taptime_server.offsite_base_backup_receipts,
  taptime_server.offsite_wal_archive_watermarks,
  taptime_server.work_events,
  taptime_server.sync_receipts,
  taptime_server.memberships
TO taptime_wal_archive_function_owner;
GRANT INSERT ON
  taptime_server.lifecycle_event_archive_requirements,
  taptime_server.offsite_wal_archive_receipts,
  taptime_server.offsite_base_backup_receipts,
  taptime_server.offsite_wal_archive_watermarks
  TO taptime_wal_archive_function_owner;
GRANT SELECT ON taptime_server.offline_event_archive_requirements
TO taptime_offline_reconciliation_function_owner;
GRANT SELECT ON taptime_server.offsite_archive_cluster_identity
  TO taptime_offline_event_function_owner;
GRANT SELECT, INSERT ON taptime_server.offline_event_archive_requirements
  TO taptime_offline_event_function_owner;

CREATE FUNCTION taptime_server.record_lifecycle_event_archive_requirement_v1(
  requested_work_event_id uuid,
  requested_receipt_id uuid
)
RETURNS TABLE (required_wal_file text, offsite_archived boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $requirement$
DECLARE
  committed record;
  current_cluster_system_identifier bigint;
  current_lsn pg_lsn;
  current_wal_file text;
BEGIN
  IF pg_catalog.current_setting('role', true) <> 'taptime_server_lifecycle'
    OR requested_work_event_id IS NULL
    OR requested_receipt_id IS NULL
  THEN
    RAISE EXCEPTION 'Lifecycle archive requirement rejected' USING ERRCODE = '42501';
  END IF;

  SELECT event.organization_id, event.id AS work_event_id,
         receipt.id AS receipt_id, event.triggered_by_user_id AS user_id,
         membership.id AS membership_id
  INTO committed
  FROM taptime_server.work_events AS event
  JOIN taptime_server.sync_receipts AS receipt
    ON receipt.organization_id = event.organization_id
   AND receipt.user_id = event.triggered_by_user_id
   AND receipt.work_event_id = event.id
  JOIN taptime_server.memberships AS membership
    ON membership.organization_id = event.organization_id
   AND membership.user_id = event.triggered_by_user_id
  WHERE event.organization_id = NULLIF(
      pg_catalog.current_setting('app.organization_id', true), ''
    )::uuid
    AND event.triggered_by_user_id = NULLIF(
      pg_catalog.current_setting('app.user_id', true), ''
    )::uuid
    AND membership.id = NULLIF(
      pg_catalog.current_setting('app.membership_id', true), ''
    )::uuid
    AND event.id = requested_work_event_id
    AND receipt.id = requested_receipt_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lifecycle archive requirement has no exact committed event'
      USING ERRCODE = '42501';
  END IF;

  current_cluster_system_identifier :=
    taptime_server.current_offsite_archive_cluster_identifier_v1();
  current_lsn := pg_catalog.pg_current_wal_insert_lsn();
  current_wal_file := pg_catalog.pg_walfile_name(current_lsn);
  INSERT INTO taptime_server.lifecycle_event_archive_requirements (
    cluster_system_identifier, organization_id, work_event_id, receipt_id,
    user_id, membership_id,
    required_wal_lsn, required_wal_file
  ) VALUES (
    current_cluster_system_identifier, committed.organization_id,
    committed.work_event_id, committed.receipt_id,
    committed.user_id, committed.membership_id, current_lsn, current_wal_file
  )
  ON CONFLICT (organization_id, work_event_id) DO NOTHING;

  RETURN QUERY
  SELECT requirement.required_wal_file,
         taptime_server.offline_wal_requirement_is_archived_v1(
           requirement.cluster_system_identifier,
           requirement.required_wal_lsn, requirement.required_wal_file
         )
  FROM taptime_server.lifecycle_event_archive_requirements AS requirement
  WHERE requirement.organization_id = committed.organization_id
    AND requirement.work_event_id = committed.work_event_id
    AND requirement.user_id = committed.user_id
    AND requirement.membership_id = committed.membership_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lifecycle archive requirement conflicts with immutable evidence'
      USING ERRCODE = '23505';
  END IF;
END
$requirement$;

ALTER FUNCTION taptime_server.record_lifecycle_event_archive_requirement_v1(uuid, uuid)
  OWNER TO taptime_wal_archive_function_owner;
REVOKE ALL ON FUNCTION
  taptime_server.record_lifecycle_event_archive_requirement_v1(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION
  taptime_server.record_lifecycle_event_archive_requirement_v1(uuid, uuid)
  TO taptime_server_lifecycle;

CREATE FUNCTION taptime_server.record_offline_event_archive_requirement_v1(
  requested_work_event_id uuid,
  requested_receipt_id uuid,
  requested_installation_id uuid,
  requested_device_sequence bigint
)
RETURNS TABLE (required_wal_file text, offsite_archived boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $requirement$
DECLARE
  reconciliation taptime_server.offline_event_reconciliations%ROWTYPE;
  current_cluster_system_identifier bigint;
  current_lsn pg_lsn;
  current_wal_file text;
BEGIN
  IF pg_catalog.current_setting('role', true) <> 'taptime_offline_event_ingestor'
    OR requested_work_event_id IS NULL
    OR requested_receipt_id IS NULL
    OR requested_installation_id IS NULL
    OR requested_device_sequence IS NULL
    OR requested_device_sequence <= 0
  THEN
    RAISE EXCEPTION 'Offline archive requirement rejected' USING ERRCODE = '42501';
  END IF;

  SELECT stored.* INTO reconciliation
  FROM taptime_server.offline_event_reconciliations AS stored
  WHERE stored.organization_id = NULLIF(
      pg_catalog.current_setting('app.organization_id', true), ''
    )::uuid
    AND stored.user_id = NULLIF(
      pg_catalog.current_setting('app.user_id', true), ''
    )::uuid
    AND stored.membership_id = NULLIF(
      pg_catalog.current_setting('app.membership_id', true), ''
    )::uuid
    AND stored.work_event_id = requested_work_event_id
    AND stored.receipt_id = requested_receipt_id
    AND stored.installation_id = requested_installation_id
    AND stored.device_sequence = requested_device_sequence;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Offline archive requirement has no exact committed event'
      USING ERRCODE = '42501';
  END IF;

  current_cluster_system_identifier :=
    taptime_server.current_offsite_archive_cluster_identifier_v1();
  current_lsn := pg_catalog.pg_current_wal_insert_lsn();
  current_wal_file := pg_catalog.pg_walfile_name(current_lsn);
  INSERT INTO taptime_server.offline_event_archive_requirements (
    cluster_system_identifier, organization_id, work_event_id, receipt_id,
    installation_id, user_id,
    membership_id, device_sequence, required_wal_lsn, required_wal_file
  ) VALUES (
    current_cluster_system_identifier, reconciliation.organization_id,
    reconciliation.work_event_id,
    reconciliation.receipt_id, reconciliation.installation_id,
    reconciliation.user_id, reconciliation.membership_id,
    reconciliation.device_sequence, current_lsn, current_wal_file
  )
  ON CONFLICT (organization_id, work_event_id) DO NOTHING;

  RETURN QUERY
  SELECT requirement.required_wal_file,
         taptime_server.offline_wal_requirement_is_archived_v1(
           requirement.cluster_system_identifier,
           requirement.required_wal_lsn, requirement.required_wal_file
         )
  FROM taptime_server.offline_event_archive_requirements AS requirement
  WHERE requirement.organization_id = reconciliation.organization_id
    AND requirement.work_event_id = reconciliation.work_event_id
    AND requirement.receipt_id = reconciliation.receipt_id
    AND requirement.installation_id = reconciliation.installation_id
    AND requirement.user_id = reconciliation.user_id
    AND requirement.membership_id = reconciliation.membership_id
    AND requirement.device_sequence = reconciliation.device_sequence;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Offline archive requirement conflicts with immutable evidence'
      USING ERRCODE = '23505';
  END IF;
END
$requirement$;

ALTER FUNCTION taptime_server.record_offline_event_archive_requirement_v1(
  uuid, uuid, uuid, bigint
) OWNER TO taptime_offline_event_function_owner;
REVOKE ALL ON FUNCTION taptime_server.record_offline_event_archive_requirement_v1(
  uuid, uuid, uuid, bigint
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.record_offline_event_archive_requirement_v1(
  uuid, uuid, uuid, bigint
) TO taptime_offline_event_ingestor;

CREATE FUNCTION taptime_server.record_offsite_wal_archive_v1(
  archived_wal_file text,
  archived_archive_name text,
  archived_content_sha256 text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $record$
DECLARE
  existing taptime_server.offsite_wal_archive_receipts%ROWTYPE;
  current_cluster_system_identifier bigint;
  cluster_archive_identifier text;
BEGIN
  current_cluster_system_identifier :=
    taptime_server.current_offsite_archive_cluster_identifier_v1();
  cluster_archive_identifier := pg_catalog.lpad(
    pg_catalog.to_hex(current_cluster_system_identifier), 16, '0'
  );
  IF pg_catalog.current_setting('role', true) <> 'taptime_wal_archiver'
    OR archived_wal_file !~ '^[0-9A-F]{24}$'
    OR archived_archive_name <> 'wal-' || cluster_archive_identifier
      || '-' || archived_wal_file
    OR archived_content_sha256 !~ '^[0-9a-f]{64}$'
  THEN
    RAISE EXCEPTION 'Offsite WAL archive receipt rejected' USING ERRCODE = '42501';
  END IF;

  INSERT INTO taptime_server.offsite_wal_archive_receipts (
    cluster_system_identifier, wal_file, archive_name, content_sha256
  ) VALUES (
    current_cluster_system_identifier, archived_wal_file,
    archived_archive_name, archived_content_sha256
  )
  ON CONFLICT (cluster_system_identifier, wal_file) DO NOTHING;

  SELECT receipt.* INTO existing
  FROM taptime_server.offsite_wal_archive_receipts AS receipt
  WHERE receipt.cluster_system_identifier = current_cluster_system_identifier
    AND receipt.wal_file = archived_wal_file;
  IF existing.archive_name IS DISTINCT FROM archived_archive_name
    OR existing.content_sha256 IS DISTINCT FROM archived_content_sha256
  THEN
    RAISE EXCEPTION 'Offsite WAL archive receipt conflicts with immutable evidence'
      USING ERRCODE = '23505';
  END IF;
END
$record$;

ALTER FUNCTION taptime_server.record_offsite_wal_archive_v1(text, text, text)
  OWNER TO taptime_wal_archive_function_owner;
REVOKE ALL ON FUNCTION taptime_server.record_offsite_wal_archive_v1(text, text, text)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.record_offsite_wal_archive_v1(text, text, text)
  TO taptime_wal_archiver;

CREATE FUNCTION taptime_server.wal_hex32_to_bigint_v1(hex_value text)
RETURNS bigint
LANGUAGE plpgsql
IMMUTABLE
STRICT
SET search_path = pg_catalog
AS $hex$
DECLARE
  bytes bytea;
BEGIN
  IF hex_value !~ '^[0-9A-F]{8}$' THEN
    RAISE EXCEPTION 'Invalid WAL hexadecimal component' USING ERRCODE = '22023';
  END IF;
  bytes := pg_catalog.decode(hex_value, 'hex');
  RETURN pg_catalog.get_byte(bytes, 0)::bigint * 256 * 256 * 256
    + pg_catalog.get_byte(bytes, 1)::bigint * 256 * 256
    + pg_catalog.get_byte(bytes, 2)::bigint * 256
    + pg_catalog.get_byte(bytes, 3)::bigint;
END
$hex$;

ALTER FUNCTION taptime_server.wal_hex32_to_bigint_v1(text)
  OWNER TO taptime_wal_archive_function_owner;
REVOKE ALL ON FUNCTION taptime_server.wal_hex32_to_bigint_v1(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.wal_hex32_to_bigint_v1(text)
  TO taptime_wal_archiver;

CREATE FUNCTION taptime_server.wal_files_are_adjacent_v1(
  previous_wal_file text,
  next_wal_file text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
STRICT
SET search_path = pg_catalog
AS $adjacent$
DECLARE
  segment_bytes bigint;
  segments_per_log bigint;
  previous_log bigint;
  previous_segment bigint;
  next_log bigint;
  next_segment bigint;
BEGIN
  IF previous_wal_file !~ '^[0-9A-F]{24}$'
    OR next_wal_file !~ '^[0-9A-F]{24}$'
    OR pg_catalog.substring(previous_wal_file, 1, 8)
      <> pg_catalog.substring(next_wal_file, 1, 8)
  THEN
    RETURN false;
  END IF;
  segment_bytes := pg_catalog.pg_size_bytes(
    pg_catalog.current_setting('wal_segment_size')
  );
  segments_per_log := (2::numeric ^ 32 / segment_bytes)::bigint;
  previous_log := taptime_server.wal_hex32_to_bigint_v1(
    pg_catalog.substring(previous_wal_file, 9, 8)
  );
  previous_segment := taptime_server.wal_hex32_to_bigint_v1(
    pg_catalog.substring(previous_wal_file, 17, 8)
  );
  next_log := taptime_server.wal_hex32_to_bigint_v1(
    pg_catalog.substring(next_wal_file, 9, 8)
  );
  next_segment := taptime_server.wal_hex32_to_bigint_v1(
    pg_catalog.substring(next_wal_file, 17, 8)
  );
  IF previous_segment >= segments_per_log OR next_segment >= segments_per_log THEN
    RETURN false;
  END IF;
  RETURN next_log * segments_per_log + next_segment
    = previous_log * segments_per_log + previous_segment + 1;
END
$adjacent$;

ALTER FUNCTION taptime_server.wal_files_are_adjacent_v1(text, text)
  OWNER TO taptime_wal_archive_function_owner;
REVOKE ALL ON FUNCTION taptime_server.wal_files_are_adjacent_v1(text, text)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.wal_files_are_adjacent_v1(text, text)
  TO taptime_wal_archiver;

CREATE FUNCTION taptime_server.record_offsite_base_backup_v1(
  archived_base_name text,
  archived_start_wal_lsn pg_lsn,
  archived_start_wal_file text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $record$
DECLARE
  existing taptime_server.offsite_base_backup_receipts%ROWTYPE;
  current_cluster_system_identifier bigint;
  cluster_archive_identifier text;
BEGIN
  current_cluster_system_identifier :=
    taptime_server.current_offsite_archive_cluster_identifier_v1();
  cluster_archive_identifier := pg_catalog.lpad(
    pg_catalog.to_hex(current_cluster_system_identifier), 16, '0'
  );
  IF pg_catalog.current_setting('role', true) <> 'taptime_wal_archiver'
    OR archived_base_name !~ (
      '^base-' || cluster_archive_identifier || '-[0-9]{8}T[0-9]{6}Z$'
    )
    OR archived_start_wal_lsn IS NULL
    OR archived_start_wal_file !~ '^[0-9A-F]{24}$'
    OR pg_catalog.substring(archived_start_wal_file, 9, 16)
      <> pg_catalog.substring(
        pg_catalog.pg_walfile_name(archived_start_wal_lsn), 9, 16
      )
  THEN
    RAISE EXCEPTION 'Offsite base backup receipt rejected' USING ERRCODE = '42501';
  END IF;

  INSERT INTO taptime_server.offsite_base_backup_receipts (
    cluster_system_identifier, archive_name, start_wal_lsn, start_wal_file
  ) VALUES (
    current_cluster_system_identifier, archived_base_name,
    archived_start_wal_lsn, archived_start_wal_file
  )
  ON CONFLICT (cluster_system_identifier, archive_name) DO NOTHING;

  SELECT receipt.* INTO existing
  FROM taptime_server.offsite_base_backup_receipts AS receipt
  WHERE receipt.cluster_system_identifier = current_cluster_system_identifier
    AND receipt.archive_name = archived_base_name;
  IF existing.start_wal_lsn IS DISTINCT FROM archived_start_wal_lsn
    OR existing.start_wal_file IS DISTINCT FROM archived_start_wal_file
  THEN
    RAISE EXCEPTION 'Offsite base backup receipt conflicts with immutable evidence'
      USING ERRCODE = '23505';
  END IF;
END
$record$;

ALTER FUNCTION taptime_server.record_offsite_base_backup_v1(text, pg_lsn, text)
  OWNER TO taptime_wal_archive_function_owner;
REVOKE ALL ON FUNCTION
  taptime_server.record_offsite_base_backup_v1(text, pg_lsn, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION
  taptime_server.record_offsite_base_backup_v1(text, pg_lsn, text)
  TO taptime_wal_archiver;

CREATE FUNCTION taptime_server.advance_offsite_wal_archive_watermark_v1(
  archived_base_name text,
  archived_wal_file text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $advance$
DECLARE
  base taptime_server.offsite_base_backup_receipts%ROWTYPE;
  predecessor text;
  current_cluster_system_identifier bigint;
  cluster_archive_identifier text;
BEGIN
  current_cluster_system_identifier :=
    taptime_server.current_offsite_archive_cluster_identifier_v1();
  cluster_archive_identifier := pg_catalog.lpad(
    pg_catalog.to_hex(current_cluster_system_identifier), 16, '0'
  );
  IF pg_catalog.current_setting('role', true) <> 'taptime_wal_archiver'
    OR archived_base_name !~ (
      '^base-' || cluster_archive_identifier || '-[0-9]{8}T[0-9]{6}Z$'
    )
    OR archived_wal_file !~ '^[0-9A-F]{24}$'
  THEN
    RAISE EXCEPTION 'Offsite WAL archive watermark rejected' USING ERRCODE = '42501';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(archived_base_name, 0)
  );
  SELECT receipt.* INTO base
  FROM taptime_server.offsite_base_backup_receipts AS receipt
  WHERE receipt.cluster_system_identifier = current_cluster_system_identifier
    AND receipt.archive_name = archived_base_name;
  IF NOT FOUND OR NOT EXISTS (
    SELECT FROM taptime_server.offsite_wal_archive_receipts AS receipt
    WHERE receipt.cluster_system_identifier = current_cluster_system_identifier
      AND receipt.wal_file = archived_wal_file
  ) THEN
    RAISE EXCEPTION 'Offsite WAL archive watermark lacks verified evidence'
      USING ERRCODE = '42501';
  END IF;
  IF EXISTS (
    SELECT FROM taptime_server.offsite_wal_archive_watermarks AS watermark
    WHERE watermark.cluster_system_identifier = current_cluster_system_identifier
      AND watermark.base_archive_name = archived_base_name
      AND watermark.wal_file = archived_wal_file
  ) THEN
    RETURN;
  END IF;

  IF archived_wal_file = base.start_wal_file THEN
    predecessor := NULL;
  ELSE
    SELECT watermark.wal_file INTO predecessor
    FROM taptime_server.offsite_wal_archive_watermarks AS watermark
    WHERE watermark.cluster_system_identifier = current_cluster_system_identifier
      AND watermark.base_archive_name = archived_base_name
      AND taptime_server.wal_files_are_adjacent_v1(
        watermark.wal_file, archived_wal_file
      );
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Offsite WAL archive watermark contains a gap'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  INSERT INTO taptime_server.offsite_wal_archive_watermarks (
    cluster_system_identifier, base_archive_name, wal_file, predecessor_wal_file
  ) VALUES (
    current_cluster_system_identifier, archived_base_name,
    archived_wal_file, predecessor
  );
END
$advance$;

ALTER FUNCTION taptime_server.advance_offsite_wal_archive_watermark_v1(text, text)
  OWNER TO taptime_wal_archive_function_owner;
REVOKE ALL ON FUNCTION
  taptime_server.advance_offsite_wal_archive_watermark_v1(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION
  taptime_server.advance_offsite_wal_archive_watermark_v1(text, text)
  TO taptime_wal_archiver;

CREATE FUNCTION taptime_server.read_offsite_base_backup_receipt_v1(
  requested_archive_name text
)
RETURNS TABLE (start_wal_lsn pg_lsn, start_wal_file text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $base$
DECLARE
  current_cluster_system_identifier bigint;
  cluster_archive_identifier text;
BEGIN
  current_cluster_system_identifier :=
    taptime_server.current_offsite_archive_cluster_identifier_v1();
  cluster_archive_identifier := pg_catalog.lpad(
    pg_catalog.to_hex(current_cluster_system_identifier), 16, '0'
  );
  IF pg_catalog.current_setting('role', true) <> 'taptime_wal_archiver'
    OR requested_archive_name !~ (
      '^base-' || cluster_archive_identifier || '-[0-9]{8}T[0-9]{6}Z$'
    )
  THEN
    RAISE EXCEPTION 'Offsite base backup evidence rejected' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT receipt.start_wal_lsn, receipt.start_wal_file
  FROM taptime_server.offsite_base_backup_receipts AS receipt
  WHERE receipt.cluster_system_identifier = current_cluster_system_identifier
    AND receipt.archive_name = requested_archive_name;
END
$base$;

ALTER FUNCTION taptime_server.read_offsite_base_backup_receipt_v1(text)
  OWNER TO taptime_wal_archive_function_owner;
REVOKE ALL ON FUNCTION
  taptime_server.read_offsite_base_backup_receipt_v1(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION
  taptime_server.read_offsite_base_backup_receipt_v1(text)
  TO taptime_wal_archiver;

CREATE FUNCTION taptime_server.read_offsite_wal_archive_receipt_v1(
  requested_wal_file text
)
RETURNS TABLE (content_sha256 text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $wal$
DECLARE
  current_cluster_system_identifier bigint;
BEGIN
  current_cluster_system_identifier :=
    taptime_server.current_offsite_archive_cluster_identifier_v1();
  IF pg_catalog.current_setting('role', true) <> 'taptime_wal_archiver'
    OR requested_wal_file !~ '^[0-9A-F]{24}$'
  THEN
    RAISE EXCEPTION 'Offsite WAL archive evidence rejected' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT receipt.content_sha256::text
  FROM taptime_server.offsite_wal_archive_receipts AS receipt
  WHERE receipt.cluster_system_identifier = current_cluster_system_identifier
    AND receipt.wal_file = requested_wal_file;
END
$wal$;

ALTER FUNCTION taptime_server.read_offsite_wal_archive_receipt_v1(text)
  OWNER TO taptime_wal_archive_function_owner;
REVOKE ALL ON FUNCTION
  taptime_server.read_offsite_wal_archive_receipt_v1(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION
  taptime_server.read_offsite_wal_archive_receipt_v1(text)
  TO taptime_wal_archiver;

CREATE FUNCTION taptime_server.read_pending_offsite_wal_files_v1()
RETURNS TABLE (wal_file text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $pending$
BEGIN
  IF pg_catalog.current_setting('role', true) <> 'taptime_wal_archiver' THEN
    RAISE EXCEPTION 'Offsite WAL archive backlog rejected' USING ERRCODE = '42501';
  END IF;
  PERFORM taptime_server.current_offsite_archive_cluster_identifier_v1();
  RETURN QUERY
  WITH requirements AS (
    SELECT requirement.cluster_system_identifier,
           requirement.required_wal_file, requirement.required_wal_lsn,
           requirement.created_at
    FROM taptime_server.offline_event_archive_requirements AS requirement
    UNION ALL
    SELECT requirement.cluster_system_identifier,
           requirement.required_wal_file, requirement.required_wal_lsn,
           requirement.created_at
    FROM taptime_server.lifecycle_event_archive_requirements AS requirement
  )
  SELECT requirement.required_wal_file
  FROM requirements AS requirement
  WHERE NOT taptime_server.offline_wal_requirement_is_archived_v1(
    requirement.cluster_system_identifier,
    requirement.required_wal_lsn, requirement.required_wal_file
  )
  GROUP BY requirement.cluster_system_identifier, requirement.required_wal_file
  ORDER BY pg_catalog.min(requirement.created_at), requirement.required_wal_file;
END
$pending$;

ALTER FUNCTION taptime_server.read_pending_offsite_wal_files_v1()
  OWNER TO taptime_wal_archive_function_owner;
REVOKE ALL ON FUNCTION taptime_server.read_pending_offsite_wal_files_v1() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.read_pending_offsite_wal_files_v1()
  TO taptime_wal_archiver;

CREATE FUNCTION taptime_server.read_offsite_wal_archive_backlog_v1()
RETURNS TABLE (
  oldest_required_at timestamptz,
  oldest_required_wal_file text,
  last_archived_wal_file text,
  last_archived_at timestamptz,
  pending_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $backlog$
DECLARE
  current_cluster_system_identifier bigint;
BEGIN
  IF pg_catalog.current_setting('role', true) <> 'taptime_wal_archiver' THEN
    RAISE EXCEPTION 'Offsite WAL archive backlog rejected' USING ERRCODE = '42501';
  END IF;
  current_cluster_system_identifier :=
    taptime_server.current_offsite_archive_cluster_identifier_v1();
  RETURN QUERY
  WITH requirements AS (
    SELECT requirement.cluster_system_identifier,
           requirement.required_wal_file, requirement.required_wal_lsn,
           requirement.created_at
    FROM taptime_server.offline_event_archive_requirements AS requirement
    UNION ALL
    SELECT requirement.cluster_system_identifier,
           requirement.required_wal_file, requirement.required_wal_lsn,
           requirement.created_at
    FROM taptime_server.lifecycle_event_archive_requirements AS requirement
  ), pending AS (
    SELECT requirement.required_wal_file, requirement.created_at
    FROM requirements AS requirement
    WHERE NOT taptime_server.offline_wal_requirement_is_archived_v1(
      requirement.cluster_system_identifier,
      requirement.required_wal_lsn, requirement.required_wal_file
    )
  )
  SELECT
    (SELECT candidate.created_at FROM pending AS candidate
      ORDER BY candidate.created_at, candidate.required_wal_file LIMIT 1),
    (SELECT candidate.required_wal_file FROM pending AS candidate
      ORDER BY candidate.created_at, candidate.required_wal_file LIMIT 1),
    (SELECT watermark.wal_file
      FROM taptime_server.offsite_wal_archive_watermarks AS watermark
      WHERE watermark.cluster_system_identifier = current_cluster_system_identifier
      ORDER BY watermark.advanced_at DESC, watermark.wal_file DESC LIMIT 1),
    (SELECT watermark.advanced_at
      FROM taptime_server.offsite_wal_archive_watermarks AS watermark
      WHERE watermark.cluster_system_identifier = current_cluster_system_identifier
      ORDER BY watermark.advanced_at DESC, watermark.wal_file DESC LIMIT 1),
    (SELECT pg_catalog.count(*) FROM pending);
END
$backlog$;

ALTER FUNCTION taptime_server.read_offsite_wal_archive_backlog_v1()
  OWNER TO taptime_wal_archive_function_owner;
REVOKE ALL ON FUNCTION taptime_server.read_offsite_wal_archive_backlog_v1() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.read_offsite_wal_archive_backlog_v1()
  TO taptime_wal_archiver;

CREATE OR REPLACE FUNCTION taptime_server.read_offline_event_reconciliations_v1(
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
  JOIN taptime_server.offline_event_archive_requirements AS requirement
    ON requirement.organization_id = reconciliation.organization_id
   AND requirement.work_event_id = reconciliation.work_event_id
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
    AND taptime_server.offline_wal_requirement_is_archived_v1(
      requirement.cluster_system_identifier,
      requirement.required_wal_lsn, requirement.required_wal_file
    )
  ORDER BY reconciliation.device_sequence;
END
$reconciliation$;

CREATE FUNCTION taptime_server.read_offline_event_reconciliations_v2(
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
  previous_work_event_id uuid,
  archive_status text
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
         decision.previous_work_event_id,
         CASE WHEN taptime_server.offline_wal_requirement_is_archived_v1(
           requirement.cluster_system_identifier,
           requirement.required_wal_lsn, requirement.required_wal_file
         ) THEN 'offsite_archived'::text ELSE 'archive_pending'::text END
  FROM taptime_server.offline_event_reconciliations AS reconciliation
  JOIN taptime_server.offline_event_archive_requirements AS requirement
    ON requirement.organization_id = reconciliation.organization_id
   AND requirement.work_event_id = reconciliation.work_event_id
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

ALTER FUNCTION taptime_server.read_offline_event_reconciliations_v2(uuid[])
  OWNER TO taptime_offline_reconciliation_function_owner;
REVOKE ALL ON FUNCTION taptime_server.read_offline_event_reconciliations_v2(uuid[])
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.read_offline_event_reconciliations_v2(uuid[])
  TO taptime_offline_reconciliation_reader;

-- T-123a / D-156. Administrators create, change and clear optional payroll identifiers.
-- Departure preserves personnel numbers and their tenant-wide uniqueness. Payroll history
-- and command receipts are append-only and follow the existing future retention policy.
-- This migration creates the NOLOGIN owner and capability; later migrations maintain or
-- retire its functions/grants and finally the unused role. No server file or new login.
ALTER TABLE taptime_server.memberships ADD COLUMN personnel_number text,
  ADD CONSTRAINT memberships_personnel_number_shape CHECK (personnel_number IS NULL
    OR personnel_number COLLATE "C" ~ '^[0-9A-Za-z-]{1,20}$'),
  ADD CONSTRAINT memberships_personnel_number_unique UNIQUE (organization_id, personnel_number);
ALTER TABLE taptime_server.organizations ADD COLUMN work_wage_type text,
  ADD CONSTRAINT organizations_work_wage_type_shape CHECK (work_wage_type IS NULL
    OR work_wage_type COLLATE "C" ~ '^[0-9]{1,6}$');

DO $owner$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'taptime_payroll_owner') THEN
    CREATE ROLE taptime_payroll_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION BYPASSRLS;
  END IF;
END
$owner$;
ALTER ROLE taptime_payroll_owner WITH NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION BYPASSRLS;
GRANT USAGE ON SCHEMA taptime_server TO taptime_payroll_owner;
GRANT SELECT ON taptime_server.memberships, taptime_server.organizations TO taptime_payroll_owner;
GRANT UPDATE (personnel_number, row_version) ON taptime_server.memberships TO taptime_payroll_owner;
GRANT UPDATE (work_wage_type, row_version) ON taptime_server.organizations TO taptime_payroll_owner;
GRANT INSERT ON taptime_server.audit_events TO taptime_payroll_owner;
GRANT SELECT ON taptime_server.effective_time_records_v2 TO taptime_payroll_owner;
GRANT EXECUTE ON FUNCTION taptime_server.has_current_time_export_authority(uuid),
  taptime_server.normalize_taptime_name_v1(text,text),
  taptime_server.normalize_membership_display_name_v1(text),
  taptime_server.read_effective_time_entry_export_v4(uuid,timestamptz,timestamptz,integer),
  taptime_server.read_time_entry_export_size_v1(uuid,timestamptz,timestamptz),
  taptime_server.maximum_time_entry_export_rows_v1(), taptime_server.maximum_time_entry_export_bytes_v1(),
  taptime_server.maximum_calendar_month_range() TO taptime_payroll_owner;

CREATE TABLE taptime_server.payroll_command_receipts (
  organization_id uuid NOT NULL REFERENCES taptime_server.organizations(id),
  command_id uuid NOT NULL,
  actor_user_id uuid NOT NULL,
  actor_membership_id uuid NOT NULL,
  target_membership_id uuid,
  requested_value text,
  expected_row_version bigint NOT NULL CHECK (expected_row_version > 0),
  result_row_version bigint NOT NULL CHECK (result_row_version = expected_row_version + 1),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (organization_id, command_id),
  FOREIGN KEY (organization_id, actor_user_id, actor_membership_id)
    REFERENCES taptime_server.memberships(organization_id,user_id,id),
  FOREIGN KEY (organization_id, target_membership_id)
    REFERENCES taptime_server.memberships(organization_id,id),
  CHECK (requested_value IS NULL OR (target_membership_id IS NULL AND requested_value COLLATE "C" ~ '^[0-9]{1,6}$')
    OR (target_membership_id IS NOT NULL AND requested_value COLLATE "C" ~ '^[0-9A-Za-z-]{1,20}$'))
);
ALTER TABLE taptime_server.payroll_command_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.payroll_command_receipts FORCE ROW LEVEL SECURITY;
CREATE POLICY payroll_receipts_tenant ON taptime_server.payroll_command_receipts
  USING (organization_id = taptime_server.current_organization_id())
  WITH CHECK (organization_id = taptime_server.current_organization_id());
GRANT SELECT, INSERT ON taptime_server.payroll_command_receipts TO taptime_payroll_owner;
CREATE TRIGGER payroll_receipts_append_only BEFORE UPDATE OR DELETE ON taptime_server.payroll_command_receipts
  FOR EACH ROW EXECUTE FUNCTION taptime_server.deny_membership_management_receipt_mutation_v1();

-- The only writers of nonempty payroll metadata are the capability functions below.
CREATE FUNCTION taptime_server.guard_payroll_metadata_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $guard$
DECLARE field text := CASE WHEN TG_TABLE_NAME = 'memberships' THEN 'personnel_number' ELSE 'work_wage_type' END;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF to_jsonb(NEW)->>field IS NOT NULL THEN
      RAISE EXCEPTION 'Payroll metadata requires its audited command' USING ERRCODE = '23514';
    END IF;
  ELSIF to_jsonb(NEW)->>field IS DISTINCT FROM to_jsonb(OLD)->>field THEN
    IF current_user <> 'taptime_payroll_owner'
      OR current_setting('role', true) IS DISTINCT FROM 'taptime_membership_manager'
      OR NEW.row_version <> OLD.row_version + 1
      OR (to_jsonb(NEW) - ARRAY[field,'row_version']) IS DISTINCT FROM (to_jsonb(OLD) - ARRAY[field,'row_version'])
    THEN RAISE EXCEPTION 'Payroll metadata requires its audited command' USING ERRCODE = '23514'; END IF;
  END IF;
  RETURN NEW;
END
$guard$;
REVOKE ALL ON FUNCTION taptime_server.guard_payroll_metadata_v1() FROM PUBLIC;
CREATE TRIGGER memberships_payroll_guard BEFORE INSERT OR UPDATE ON taptime_server.memberships
  FOR EACH ROW EXECUTE FUNCTION taptime_server.guard_payroll_metadata_v1();
CREATE TRIGGER organizations_payroll_guard BEFORE INSERT OR UPDATE ON taptime_server.organizations
  FOR EACH ROW EXECUTE FUNCTION taptime_server.guard_payroll_metadata_v1();

CREATE FUNCTION taptime_server.read_membership_payroll_v1(requested_target_membership_id uuid)
RETURNS TABLE(personnel_number text, row_version bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $read$
  SELECT m.personnel_number, m.row_version FROM taptime_server.memberships m
  JOIN taptime_server.organizations o ON o.id = m.organization_id AND o.status = 'active'
  WHERE current_setting('role', true) = 'taptime_membership_manager'
    AND m.id = requested_target_membership_id
    AND taptime_server.has_current_time_export_authority(m.organization_id)
$read$;
ALTER FUNCTION taptime_server.read_membership_payroll_v1(uuid) OWNER TO taptime_payroll_owner;
REVOKE ALL ON FUNCTION taptime_server.read_membership_payroll_v1(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.read_membership_payroll_v1(uuid) TO taptime_membership_manager;

CREATE FUNCTION taptime_server.is_complete_payroll_month_v1(from_inclusive timestamptz, to_exclusive timestamptz)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = pg_catalog AS $month$
  SELECT COALESCE(from_inclusive = date_trunc('month', from_inclusive AT TIME ZONE 'Europe/Berlin') AT TIME ZONE 'Europe/Berlin'
    AND to_exclusive = (date_trunc('month', from_inclusive AT TIME ZONE 'Europe/Berlin') + interval '1 month') AT TIME ZONE 'Europe/Berlin', false)
$month$;
REVOKE ALL ON FUNCTION taptime_server.is_complete_payroll_month_v1(timestamptz,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.is_complete_payroll_month_v1(timestamptz,timestamptz) TO taptime_payroll_owner;

CREATE FUNCTION taptime_server.read_payroll_settings_v1(requested_from_inclusive timestamptz, requested_to_exclusive timestamptz)
RETURNS TABLE(work_wage_type text, row_version bigint, missing_personnel_number_count bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $read$
DECLARE org uuid := NULLIF(current_setting('app.organization_id', true), '')::uuid;
BEGIN
  IF current_setting('role', true) IS DISTINCT FROM 'taptime_membership_manager'
    OR NOT taptime_server.has_current_time_export_authority(org)
    OR NOT taptime_server.is_complete_payroll_month_v1(requested_from_inclusive, requested_to_exclusive)
  THEN RAISE EXCEPTION 'Payroll settings capability rejected' USING ERRCODE = '42501'; END IF;
  RETURN QUERY SELECT o.work_wage_type, o.row_version, (
    SELECT count(*) FROM taptime_server.memberships m
    WHERE m.organization_id = org AND m.personnel_number IS NULL
      AND EXISTS (SELECT 1 FROM taptime_server.effective_time_records_v2 r WHERE r.organization_id = org AND r.user_id = m.user_id
        AND r.effective_started_at >= requested_from_inclusive AND r.effective_started_at < requested_to_exclusive)
  ) FROM taptime_server.organizations o WHERE o.id = org AND o.status = 'active';
END
$read$;
ALTER FUNCTION taptime_server.read_payroll_settings_v1(timestamptz,timestamptz) OWNER TO taptime_payroll_owner;
REVOKE ALL ON FUNCTION taptime_server.read_payroll_settings_v1(timestamptz,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.read_payroll_settings_v1(timestamptz,timestamptz) TO taptime_membership_manager;

-- One command namespace for both payroll identifiers. NULL target denotes the organization.
CREATE FUNCTION taptime_server.set_payroll_value_v1(requested_command_id uuid, requested_target_membership_id uuid,
  requested_expected_row_version bigint, requested_value text)
RETURNS TABLE(result_status text, row_version bigint, idempotent_retry boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $write$
DECLARE
  org uuid := NULLIF(current_setting('app.organization_id', true), '')::uuid;
  actor_user uuid := NULLIF(current_setting('app.user_id', true), '')::uuid;
  actor_member uuid := NULLIF(current_setting('app.membership_id', true), '')::uuid;
  receipt taptime_server.payroll_command_receipts%ROWTYPE;
  previous_value text;
  previous_version bigint;
  departed timestamptz;
BEGIN
  IF current_setting('role', true) IS DISTINCT FROM 'taptime_membership_manager'
    OR requested_command_id IS NULL OR requested_expected_row_version IS NULL OR requested_expected_row_version < 1
    OR requested_command_id::text IS DISTINCT FROM NULLIF(current_setting('app.correlation_id', true), '')
    OR (requested_value IS NOT NULL AND NOT (requested_value COLLATE "C" ~
      CASE WHEN requested_target_membership_id IS NULL THEN '^[0-9]{1,6}$' ELSE '^[0-9A-Za-z-]{1,20}$' END))
  THEN RETURN QUERY SELECT 'invalid_request', NULL::bigint, false; RETURN; END IF;
  IF NOT taptime_server.has_current_time_export_authority(org)
    OR NOT EXISTS (SELECT 1 FROM taptime_server.organizations o WHERE o.id = org AND o.status = 'active')
  THEN RETURN QUERY SELECT 'forbidden', NULL::bigint, false; RETURN; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('taptime:payroll-command:' || org::text || ':' || requested_command_id::text, 0));
  SELECT r.* INTO receipt FROM taptime_server.payroll_command_receipts r WHERE r.organization_id = org AND r.command_id = requested_command_id;
  IF FOUND THEN
    IF receipt.actor_user_id = actor_user AND receipt.actor_membership_id = actor_member
      AND receipt.target_membership_id IS NOT DISTINCT FROM requested_target_membership_id
      AND receipt.requested_value IS NOT DISTINCT FROM requested_value AND receipt.expected_row_version = requested_expected_row_version
    THEN RETURN QUERY SELECT 'succeeded', receipt.result_row_version, true;
    ELSE RETURN QUERY SELECT 'command_id_conflict', NULL::bigint, false; END IF;
    RETURN;
  END IF;
  IF requested_target_membership_id IS NULL THEN
    SELECT o.work_wage_type, o.row_version INTO previous_value, previous_version
      FROM taptime_server.organizations o WHERE o.id = org FOR UPDATE;
  ELSE
    SELECT m.personnel_number, m.row_version, m.revoked_at INTO previous_value, previous_version, departed
      FROM taptime_server.memberships m WHERE m.organization_id = org AND m.id = requested_target_membership_id FOR UPDATE;
  END IF;
  IF NOT FOUND THEN RETURN QUERY SELECT 'target_unavailable', NULL::bigint, false; RETURN; END IF;
  IF departed IS NOT NULL THEN RETURN QUERY SELECT 'already_departed', NULL::bigint, false; RETURN; END IF;
  IF previous_version <> requested_expected_row_version THEN RETURN QUERY SELECT 'stale_row_version', NULL::bigint, false; RETURN; END IF;
  IF previous_value IS NOT DISTINCT FROM requested_value THEN RETURN QUERY SELECT 'invalid_request', NULL::bigint, false; RETURN; END IF;
  IF requested_target_membership_id IS NULL THEN
    UPDATE taptime_server.organizations o SET work_wage_type = requested_value, row_version = o.row_version + 1 WHERE o.id = org;
    INSERT INTO taptime_server.audit_events(id,organization_id,actor_user_id,event_type,entity_type,entity_id,occurred_at,correlation_id,payload)
      VALUES(gen_random_uuid(),org,actor_user,'WorkWageTypeChanged','Organization',org,transaction_timestamp(),requested_command_id::text,
        jsonb_build_object('oldValue',previous_value,'newValue',requested_value,'rowVersion',previous_version+1,'membershipId',actor_member));
  ELSE
    BEGIN
      UPDATE taptime_server.memberships m SET personnel_number = requested_value, row_version = m.row_version + 1
        WHERE m.organization_id = org AND m.id = requested_target_membership_id;
    EXCEPTION WHEN unique_violation THEN
      RETURN QUERY SELECT 'personnel_number_conflict', NULL::bigint, false; RETURN;
    END;
  END IF;
  INSERT INTO taptime_server.payroll_command_receipts(organization_id,command_id,actor_user_id,actor_membership_id,target_membership_id,
    requested_value,expected_row_version,result_row_version)
    VALUES(org,requested_command_id,actor_user,actor_member,requested_target_membership_id,requested_value,previous_version,previous_version+1);
  RETURN QUERY SELECT 'succeeded', previous_version+1, false;
END
$write$;
ALTER FUNCTION taptime_server.set_payroll_value_v1(uuid,uuid,bigint,text) OWNER TO taptime_payroll_owner;
REVOKE ALL ON FUNCTION taptime_server.set_payroll_value_v1(uuid,uuid,bigint,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.set_payroll_value_v1(uuid,uuid,bigint,text) TO taptime_membership_manager;

-- A whole Berlin month, with precisely the v4 source rows and duration calculation.
-- No per-entry rounding; the serializer rounds this sum once, to hundredths of an hour.
CREATE FUNCTION taptime_server.read_effective_time_entry_export_v5(requested_organization_id uuid,
  requested_from_inclusive timestamptz, requested_to_exclusive timestamptz)
RETURNS TABLE(organization_id uuid, employee_membership_id uuid, employee_display_name text, personnel_number text,
  payroll_month text, work_duration_seconds numeric, work_wage_type text, has_running_time boolean, source_row_count bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $export$
BEGIN
  IF current_setting('role', true) IS DISTINCT FROM 'taptime_time_exporter'
    OR NOT taptime_server.has_current_time_export_authority(requested_organization_id)
    OR NOT EXISTS (SELECT 1 FROM taptime_server.organizations o WHERE o.id = requested_organization_id AND o.status = 'active')
    OR NOT taptime_server.is_complete_payroll_month_v1(requested_from_inclusive, requested_to_exclusive)
  THEN RAISE EXCEPTION 'Monthly export capability rejected' USING ERRCODE = '42501'; END IF;
  IF taptime_server.read_time_entry_export_size_v1(requested_organization_id,requested_from_inclusive,requested_to_exclusive)
    > taptime_server.maximum_time_entry_export_rows_v1()
  THEN RAISE EXCEPTION 'Monthly export size exceeded' USING ERRCODE = '54000'; END IF;
  RETURN QUERY
  WITH totals AS (
    SELECT e.organization_id, e.employee_membership_id, e.employee_display_name,
      COALESCE(sum(e.effective_work_duration_seconds) FILTER (WHERE e.status = 'stopped'),0) AS seconds,
      bool_or(e.status = 'started') AS running, count(*) AS source_count
    FROM taptime_server.read_effective_time_entry_export_v4(requested_organization_id,requested_from_inclusive,requested_to_exclusive,
      taptime_server.maximum_time_entry_export_rows_v1()+1) e
    GROUP BY e.organization_id,e.employee_membership_id,e.employee_display_name
  )
  SELECT t.organization_id,t.employee_membership_id,t.employee_display_name,m.personnel_number,
    to_char(requested_from_inclusive AT TIME ZONE 'Europe/Berlin','MM.YYYY'),t.seconds,o.work_wage_type,t.running,t.source_count
  FROM totals t JOIN taptime_server.memberships m ON m.organization_id=t.organization_id AND m.id=t.employee_membership_id
    JOIN taptime_server.organizations o ON o.id=t.organization_id
  ORDER BY t.employee_display_name COLLATE "C",t.employee_membership_id;
END
$export$;
ALTER FUNCTION taptime_server.read_effective_time_entry_export_v5(uuid,timestamptz,timestamptz) OWNER TO taptime_payroll_owner;
REVOKE ALL ON FUNCTION taptime_server.read_effective_time_entry_export_v5(uuid,timestamptz,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.read_effective_time_entry_export_v5(uuid,timestamptz,timestamptz) TO taptime_time_exporter;

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
      THEN 'MembershipRevoked'
      WHEN NEW.personnel_number IS DISTINCT FROM OLD.personnel_number THEN 'PersonnelNumberChanged'
      WHEN NEW.display_name IS DISTINCT FROM OLD.display_name THEN 'MembershipRenamed'
      ELSE 'MembershipRoleChanged' END;
    entity_name := 'Membership';
    event_payload := CASE WHEN event_name = 'PersonnelNumberChanged' THEN pg_catalog.jsonb_build_object(
      'oldValue', OLD.personnel_number, 'newValue', NEW.personnel_number, 'rowVersion', NEW.row_version,
      'membershipId', current_setting('app.membership_id', true), 'action', 'personnel_number'
    ) WHEN event_name = 'MembershipRenamed' THEN pg_catalog.jsonb_build_object(
      'oldName', OLD.display_name, 'newName', NEW.display_name, 'rowVersion', NEW.row_version,
      'membershipId', current_setting('app.membership_id', true), 'action', 'rename'
    ) ELSE pg_catalog.jsonb_build_object(
      'role', NEW.role,
      'revoked', NEW.revoked_at IS NOT NULL,
      'rowVersion', NEW.row_version
    ) END;
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


CREATE FUNCTION taptime_server.append_time_entry_export_audit_v5(
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
    OR requested_from_inclusive IS NULL OR requested_to_exclusive IS NULL
    OR requested_correlation_id IS NULL OR requested_row_count IS NULL OR requested_byte_count IS NULL OR requested_sha256 IS NULL
    OR requested_to_exclusive <= requested_from_inclusive
    OR requested_to_exclusive - requested_from_inclusive > taptime_server.maximum_calendar_month_range()
    OR requested_row_count NOT BETWEEN 0 AND taptime_server.maximum_time_entry_export_rows_v1()
    OR requested_byte_count NOT BETWEEN 1 AND taptime_server.maximum_time_entry_export_bytes_v1()
    OR requested_sha256 COLLATE "C" !~ '^[0-9a-f]{64}$'
  THEN
    RAISE EXCEPTION 'Time export v5 audit capability rejected' USING ERRCODE = '42501';
  END IF;

  INSERT INTO taptime_server.audit_events (
    id, organization_id, actor_user_id, event_type, entity_type, entity_id,
    occurred_at, correlation_id, payload
  ) VALUES (
    requested_audit_id, requested_organization_id, requested_actor_user_id,
    'TimeEntryExportGenerated', 'TimeEntryExport', requested_audit_id,
    pg_catalog.transaction_timestamp(), requested_correlation_id,
    pg_catalog.jsonb_build_object(
      'schemaVersion', 5,
      'fromInclusive', requested_from_inclusive,
      'toExclusive', requested_to_exclusive,
      'rowCount', requested_row_count,
      'byteCount', requested_byte_count,
      'sha256', requested_sha256
    )
  );
END
$audit$;
ALTER FUNCTION taptime_server.append_time_entry_export_audit_v5(uuid,uuid,uuid,text,timestamptz,timestamptz,integer,integer,text) OWNER TO taptime_payroll_owner;
REVOKE ALL ON FUNCTION taptime_server.append_time_entry_export_audit_v5(uuid,uuid,uuid,text,timestamptz,timestamptz,integer,integer,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.append_time_entry_export_audit_v5(uuid,uuid,uuid,text,timestamptz,timestamptz,integer,integer,text) TO taptime_time_exporter;

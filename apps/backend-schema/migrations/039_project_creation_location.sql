-- T-090: the Administrator creates a Project and its initial Location atomically.
-- Existing Location commands own later relocation; deactivation revokes the binding
-- through the existing WorkTarget lifecycle. Receipts retain the original Location.
ALTER TABLE taptime_server.project_command_receipts ADD COLUMN project_location_id uuid,
  ADD CONSTRAINT project_receipt_location_kind CHECK (project_location_id IS NULL OR command_type = 'create'),
  ADD CONSTRAINT project_receipt_location_fk FOREIGN KEY (organization_id, project_location_id)
    REFERENCES taptime_server.locations (organization_id, id);

-- The Project CHECK executes as its caller, including the real non-inheriting login.
GRANT EXECUTE ON FUNCTION taptime_server.normalize_taptime_name_v1(text, text)
  TO taptime_project_administrator;
GRANT EXECUTE ON FUNCTION taptime_server.has_current_admin_setup_authority(uuid)
  TO taptime_project_administrator;
GRANT SELECT (id, locations_enabled) ON taptime_server.organizations TO taptime_project_administrator;
CREATE POLICY organizations_project_setup_select ON taptime_server.organizations
  FOR SELECT TO taptime_project_administrator
  USING (taptime_server.has_current_admin_setup_authority(id));
GRANT SELECT (id, organization_id, active) ON taptime_server.locations TO taptime_project_administrator;
CREATE POLICY locations_project_setup_select ON taptime_server.locations
  FOR SELECT TO taptime_project_administrator
  USING (taptime_server.has_current_admin_setup_authority(organization_id));
ALTER POLICY projects_project_admin_insert ON taptime_server.projects
  WITH CHECK (taptime_server.has_current_admin_setup_authority(organization_id));
-- This role's only edit is deactivation. Updating an active row to itself or
-- reactivating it must not turn an existing Project's xmin into creation evidence.
ALTER POLICY projects_project_admin_update ON taptime_server.projects
  USING (active AND taptime_server.has_current_admin_setup_authority(organization_id))
  WITH CHECK (NOT active AND taptime_server.has_current_admin_setup_authority(organization_id));

-- This role may bind only a Project inserted in this transaction, at an active
-- Location in the same enabled organization. It gains no relocation/revocation right.
CREATE FUNCTION taptime_server.is_current_project_creation_v1(
  requested_organization_id uuid, requested_project_id uuid, requested_location_id uuid
) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog
AS $creation$
  SELECT taptime_server.has_current_admin_setup_authority(requested_organization_id)
    AND EXISTS (
      SELECT 1 FROM taptime_server.projects AS project
      JOIN taptime_server.organizations AS organization ON organization.id = project.organization_id
      JOIN taptime_server.locations AS location ON location.organization_id = organization.id
      WHERE project.organization_id = requested_organization_id AND project.id = requested_project_id
        AND project.active AND project.xmin = xid(pg_current_xact_id())
        AND organization.locations_enabled AND organization.status = 'active'
        AND location.id = requested_location_id AND location.active
    )
$creation$;
ALTER FUNCTION taptime_server.is_current_project_creation_v1(uuid, uuid, uuid)
  OWNER TO taptime_admin_setup_data_function_owner;
REVOKE ALL ON FUNCTION taptime_server.is_current_project_creation_v1(uuid, uuid, uuid) FROM PUBLIC;
GRANT SELECT (id, organization_id, active, xmin) ON taptime_server.projects TO taptime_admin_setup_data_function_owner;
GRANT EXECUTE ON FUNCTION taptime_server.is_current_project_creation_v1(uuid, uuid, uuid)
  TO taptime_project_administrator, taptime_admin_setup_function_owner;
GRANT INSERT (id, organization_id, target_type, target_id, location_id)
  ON taptime_server.work_target_location_assignments TO taptime_project_administrator;
CREATE POLICY work_target_locations_project_creation_insert ON taptime_server.work_target_location_assignments
  FOR INSERT TO taptime_project_administrator
  WITH CHECK (target_type = 'project'
    AND taptime_server.is_current_project_creation_v1(organization_id, target_id, location_id));

CREATE FUNCTION taptime_server.append_project_location_creation_audit_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog
AS $audit$
DECLARE
  correlation_id text := NULLIF(current_setting('app.correlation_id', true), '');
BEGIN
  IF current_setting('role', true) <> 'taptime_project_administrator' THEN RETURN NEW; END IF;
  IF NEW.target_type <> 'project'
    OR NOT taptime_server.is_current_project_creation_v1(NEW.organization_id, NEW.target_id, NEW.location_id)
    OR correlation_id IS NULL
    OR correlation_id COLLATE "C" !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  THEN RAISE EXCEPTION 'Project Location audit rejected' USING ERRCODE = '42501'; END IF;
  INSERT INTO taptime_server.audit_events(id, organization_id, actor_user_id, event_type, entity_type, entity_id, occurred_at, correlation_id, payload)
  VALUES (gen_random_uuid(), NEW.organization_id, taptime_server.current_user_id(),
    'WorkTargetLocationAssigned', 'WorkTargetLocationAssignment', NEW.id, transaction_timestamp(), correlation_id,
    jsonb_build_object('targetType', 'project', 'targetId', NEW.target_id, 'locationId', NEW.location_id));
  RETURN NEW;
END
$audit$;
ALTER FUNCTION taptime_server.append_project_location_creation_audit_v1() OWNER TO taptime_admin_setup_function_owner;
REVOKE ALL ON FUNCTION taptime_server.append_project_location_creation_audit_v1() FROM PUBLIC;
CREATE TRIGGER project_location_creation_audit AFTER INSERT ON taptime_server.work_target_location_assignments
  FOR EACH ROW EXECUTE FUNCTION taptime_server.append_project_location_creation_audit_v1();

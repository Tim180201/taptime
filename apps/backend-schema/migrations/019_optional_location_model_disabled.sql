-- T-015a: the complete Organization-subordinate Location model, default-off and unused by
-- every existing Product query. Activation is explicit, atomic and fail-closed.

ALTER TABLE taptime_server.organizations
  ADD COLUMN locations_enabled boolean NOT NULL DEFAULT false;

CREATE TABLE taptime_server.locations (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES taptime_server.organizations (id),
  display_name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  activated_at timestamptz NOT NULL DEFAULT pg_catalog.transaction_timestamp(),
  deactivated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.transaction_timestamp(),
  row_version bigint NOT NULL DEFAULT 1 CHECK (row_version > 0),
  CONSTRAINT locations_tenant_id_unique UNIQUE (organization_id, id),
  CONSTRAINT locations_display_name_shape CHECK (
    display_name = pg_catalog.btrim(display_name)
    AND pg_catalog.char_length(display_name) BETWEEN 1 AND 120
    AND pg_catalog.octet_length(display_name) <= 480
  ),
  CONSTRAINT locations_activity_shape CHECK (
    (active AND deactivated_at IS NULL)
    OR (
      NOT active
      AND deactivated_at IS NOT NULL
      AND deactivated_at >= activated_at
    )
  )
);

CREATE TABLE taptime_server.membership_home_location_assignments (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES taptime_server.organizations (id),
  membership_id uuid NOT NULL,
  location_id uuid NOT NULL,
  assigned_at timestamptz NOT NULL DEFAULT pg_catalog.transaction_timestamp(),
  revoked_at timestamptz,
  CONSTRAINT membership_home_locations_tenant_id_unique UNIQUE (organization_id, id),
  CONSTRAINT membership_home_locations_membership_fk FOREIGN KEY (
    organization_id, membership_id
  ) REFERENCES taptime_server.memberships (organization_id, id),
  CONSTRAINT membership_home_locations_location_fk FOREIGN KEY (
    organization_id, location_id
  ) REFERENCES taptime_server.locations (organization_id, id),
  CONSTRAINT membership_home_locations_revocation_order CHECK (
    revoked_at IS NULL OR revoked_at >= assigned_at
  )
);

CREATE UNIQUE INDEX membership_home_locations_one_current
  ON taptime_server.membership_home_location_assignments (
    organization_id, membership_id
  )
  WHERE revoked_at IS NULL;

CREATE TABLE taptime_server.membership_work_location_grants (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES taptime_server.organizations (id),
  membership_id uuid NOT NULL,
  location_id uuid NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT pg_catalog.transaction_timestamp(),
  revoked_at timestamptz,
  CONSTRAINT membership_work_locations_tenant_id_unique UNIQUE (organization_id, id),
  CONSTRAINT membership_work_locations_membership_fk FOREIGN KEY (
    organization_id, membership_id
  ) REFERENCES taptime_server.memberships (organization_id, id),
  CONSTRAINT membership_work_locations_location_fk FOREIGN KEY (
    organization_id, location_id
  ) REFERENCES taptime_server.locations (organization_id, id),
  CONSTRAINT membership_work_locations_revocation_order CHECK (
    revoked_at IS NULL OR revoked_at >= granted_at
  )
);

CREATE UNIQUE INDEX membership_work_locations_one_current
  ON taptime_server.membership_work_location_grants (
    organization_id, membership_id, location_id
  )
  WHERE revoked_at IS NULL;

CREATE TABLE taptime_server.membership_management_location_grants (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES taptime_server.organizations (id),
  membership_id uuid NOT NULL,
  location_id uuid NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT pg_catalog.transaction_timestamp(),
  revoked_at timestamptz,
  CONSTRAINT membership_management_locations_tenant_id_unique UNIQUE (organization_id, id),
  CONSTRAINT membership_management_locations_membership_fk FOREIGN KEY (
    organization_id, membership_id
  ) REFERENCES taptime_server.memberships (organization_id, id),
  CONSTRAINT membership_management_locations_location_fk FOREIGN KEY (
    organization_id, location_id
  ) REFERENCES taptime_server.locations (organization_id, id),
  CONSTRAINT membership_management_locations_revocation_order CHECK (
    revoked_at IS NULL OR revoked_at >= granted_at
  )
);

CREATE UNIQUE INDEX membership_management_locations_one_current
  ON taptime_server.membership_management_location_grants (
    organization_id, membership_id, location_id
  )
  WHERE revoked_at IS NULL;

CREATE TABLE taptime_server.work_target_location_assignments (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES taptime_server.organizations (id),
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  location_id uuid NOT NULL,
  assigned_at timestamptz NOT NULL DEFAULT pg_catalog.transaction_timestamp(),
  revoked_at timestamptz,
  CONSTRAINT work_target_locations_tenant_id_unique UNIQUE (organization_id, id),
  CONSTRAINT work_target_locations_target_fk FOREIGN KEY (
    organization_id, target_type, target_id
  ) REFERENCES taptime_server.work_targets (organization_id, target_type, target_id),
  CONSTRAINT work_target_locations_location_fk FOREIGN KEY (
    organization_id, location_id
  ) REFERENCES taptime_server.locations (organization_id, id),
  CONSTRAINT work_target_locations_revocation_order CHECK (
    revoked_at IS NULL OR revoked_at >= assigned_at
  )
);

CREATE UNIQUE INDEX work_target_locations_one_current
  ON taptime_server.work_target_location_assignments (
    organization_id, target_type, target_id
  )
  WHERE revoked_at IS NULL;

-- Accepted Work Location is deliberately nullable while the feature is off. Existing rows are
-- neither migrated nor inferred. Later writers must persist the server-resolved value here.
ALTER TABLE taptime_server.work_events
  ADD COLUMN accepted_work_location_id uuid,
  ADD CONSTRAINT work_events_accepted_work_location_fk FOREIGN KEY (
    organization_id, accepted_work_location_id
  ) REFERENCES taptime_server.locations (organization_id, id);

ALTER TABLE taptime_server.time_entries
  ADD COLUMN accepted_work_location_id uuid,
  ADD CONSTRAINT time_entries_accepted_work_location_fk FOREIGN KEY (
    organization_id, accepted_work_location_id
  ) REFERENCES taptime_server.locations (organization_id, id);

ALTER TABLE taptime_server.time_record_revisions
  ADD COLUMN accepted_work_location_id uuid,
  ADD CONSTRAINT time_record_revisions_accepted_work_location_fk FOREIGN KEY (
    organization_id, accepted_work_location_id
  ) REFERENCES taptime_server.locations (organization_id, id);

CREATE FUNCTION taptime_server.deny_location_history_delete_v1()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $history$
BEGIN
  RAISE EXCEPTION 'Location history is immutable' USING ERRCODE = '42501';
END
$history$;
REVOKE ALL ON FUNCTION taptime_server.deny_location_history_delete_v1() FROM PUBLIC;

CREATE TRIGGER locations_no_delete
  BEFORE DELETE ON taptime_server.locations
  FOR EACH ROW EXECUTE FUNCTION taptime_server.deny_location_history_delete_v1();
CREATE TRIGGER membership_home_locations_no_delete
  BEFORE DELETE ON taptime_server.membership_home_location_assignments
  FOR EACH ROW EXECUTE FUNCTION taptime_server.deny_location_history_delete_v1();
CREATE TRIGGER membership_work_locations_no_delete
  BEFORE DELETE ON taptime_server.membership_work_location_grants
  FOR EACH ROW EXECUTE FUNCTION taptime_server.deny_location_history_delete_v1();
CREATE TRIGGER membership_management_locations_no_delete
  BEFORE DELETE ON taptime_server.membership_management_location_grants
  FOR EACH ROW EXECUTE FUNCTION taptime_server.deny_location_history_delete_v1();
CREATE TRIGGER work_target_locations_no_delete
  BEFORE DELETE ON taptime_server.work_target_location_assignments
  FOR EACH ROW EXECUTE FUNCTION taptime_server.deny_location_history_delete_v1();

CREATE FUNCTION taptime_server.enforce_location_deactivation_v1()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $location_history$
BEGIN
  IF OLD.active IS NOT TRUE
    OR NEW.active IS NOT FALSE
    OR NEW.deactivated_at IS NULL
    OR NEW.deactivated_at < OLD.activated_at
    OR NEW.row_version <> OLD.row_version + 1
    OR (pg_catalog.to_jsonb(NEW) - ARRAY['active', 'deactivated_at', 'row_version']::text[])
       IS DISTINCT FROM
       (pg_catalog.to_jsonb(OLD) - ARRAY['active', 'deactivated_at', 'row_version']::text[])
  THEN
    RAISE EXCEPTION 'Location update must be one immutable active-to-inactive transition'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$location_history$;
REVOKE ALL ON FUNCTION taptime_server.enforce_location_deactivation_v1() FROM PUBLIC;

CREATE TRIGGER locations_deactivation_only
  BEFORE UPDATE ON taptime_server.locations
  FOR EACH ROW EXECUTE FUNCTION taptime_server.enforce_location_deactivation_v1();

CREATE FUNCTION taptime_server.enforce_location_relation_revocation_v1()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $relation_history$
DECLARE
  relation_started_at timestamptz;
BEGIN
  relation_started_at := COALESCE(
    (pg_catalog.to_jsonb(OLD) ->> 'assigned_at')::timestamptz,
    (pg_catalog.to_jsonb(OLD) ->> 'granted_at')::timestamptz
  );
  IF OLD.revoked_at IS NOT NULL
    OR NEW.revoked_at IS NULL
    OR NEW.revoked_at < relation_started_at
    OR (pg_catalog.to_jsonb(NEW) - 'revoked_at') IS DISTINCT FROM
       (pg_catalog.to_jsonb(OLD) - 'revoked_at')
  THEN
    RAISE EXCEPTION 'Location relation update must be one immutable revocation'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$relation_history$;
REVOKE ALL ON FUNCTION taptime_server.enforce_location_relation_revocation_v1() FROM PUBLIC;

CREATE TRIGGER membership_home_locations_revocation_only
  BEFORE UPDATE ON taptime_server.membership_home_location_assignments
  FOR EACH ROW EXECUTE FUNCTION taptime_server.enforce_location_relation_revocation_v1();
CREATE TRIGGER membership_work_locations_revocation_only
  BEFORE UPDATE ON taptime_server.membership_work_location_grants
  FOR EACH ROW EXECUTE FUNCTION taptime_server.enforce_location_relation_revocation_v1();
CREATE TRIGGER membership_management_locations_revocation_only
  BEFORE UPDATE ON taptime_server.membership_management_location_grants
  FOR EACH ROW EXECUTE FUNCTION taptime_server.enforce_location_relation_revocation_v1();
CREATE TRIGGER work_target_locations_revocation_only
  BEFORE UPDATE ON taptime_server.work_target_location_assignments
  FOR EACH ROW EXECUTE FUNCTION taptime_server.enforce_location_relation_revocation_v1();

CREATE FUNCTION taptime_server.enforce_work_location_is_additional_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $additional_work$
DECLARE
  affected_organization_id uuid := COALESCE(
    (pg_catalog.to_jsonb(NEW) ->> 'organization_id')::uuid,
    (pg_catalog.to_jsonb(OLD) ->> 'organization_id')::uuid
  );
  affected_membership_id uuid := COALESCE(
    (pg_catalog.to_jsonb(NEW) ->> 'membership_id')::uuid,
    (pg_catalog.to_jsonb(OLD) ->> 'membership_id')::uuid
  );
  affected_location_id uuid := COALESCE(
    (pg_catalog.to_jsonb(NEW) ->> 'location_id')::uuid,
    (pg_catalog.to_jsonb(OLD) ->> 'location_id')::uuid
  );
BEGIN
  IF EXISTS (
    SELECT 1
    FROM taptime_server.membership_home_location_assignments AS home
    JOIN taptime_server.membership_work_location_grants AS work_grant
      ON work_grant.organization_id = home.organization_id
     AND work_grant.membership_id = home.membership_id
     AND work_grant.location_id = home.location_id
     AND work_grant.revoked_at IS NULL
    WHERE home.organization_id = affected_organization_id
      AND home.membership_id = affected_membership_id
      AND home.location_id = affected_location_id
      AND home.revoked_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Work Location Grant must be additional to Home Location'
      USING ERRCODE = '23514';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END
$additional_work$;

ALTER FUNCTION taptime_server.enforce_work_location_is_additional_v1()
  OWNER TO taptime_admin_setup_data_function_owner;
REVOKE ALL ON FUNCTION taptime_server.enforce_work_location_is_additional_v1() FROM PUBLIC;

CREATE CONSTRAINT TRIGGER membership_home_locations_additional_work
  AFTER INSERT OR UPDATE OR DELETE ON taptime_server.membership_home_location_assignments
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION taptime_server.enforce_work_location_is_additional_v1();
CREATE CONSTRAINT TRIGGER membership_work_locations_additional_work
  AFTER INSERT OR UPDATE OR DELETE ON taptime_server.membership_work_location_grants
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION taptime_server.enforce_work_location_is_additional_v1();

CREATE FUNCTION taptime_server.enforce_accepted_work_location_immutable_v1()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $accepted_location$
BEGIN
  IF NEW.accepted_work_location_id IS DISTINCT FROM OLD.accepted_work_location_id THEN
    RAISE EXCEPTION 'Accepted Work Location is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$accepted_location$;
REVOKE ALL ON FUNCTION taptime_server.enforce_accepted_work_location_immutable_v1() FROM PUBLIC;

CREATE TRIGGER work_events_accepted_work_location_immutable
  BEFORE UPDATE OF accepted_work_location_id ON taptime_server.work_events
  FOR EACH ROW EXECUTE FUNCTION taptime_server.enforce_accepted_work_location_immutable_v1();
CREATE TRIGGER time_entries_accepted_work_location_immutable
  BEFORE UPDATE OF accepted_work_location_id ON taptime_server.time_entries
  FOR EACH ROW EXECUTE FUNCTION taptime_server.enforce_accepted_work_location_immutable_v1();
CREATE TRIGGER time_record_revisions_accepted_work_location_immutable
  BEFORE UPDATE OF accepted_work_location_id ON taptime_server.time_record_revisions
  FOR EACH ROW EXECUTE FUNCTION taptime_server.enforce_accepted_work_location_immutable_v1();

CREATE FUNCTION taptime_server.location_setup_is_complete_v1(
  requested_organization_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $complete$
  SELECT requested_organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM taptime_server.organizations AS organization
      WHERE organization.id = requested_organization_id
    )
    -- In the current model an active Organization user is represented by exactly one active
    -- Membership, so the Membership proof also covers the DA6-L01 Organization-user proof.
    AND NOT EXISTS (
      SELECT 1
      FROM taptime_server.memberships AS membership
      WHERE membership.organization_id = requested_organization_id
        AND membership.revoked_at IS NULL
        AND 1 <> (
          SELECT pg_catalog.count(*)
          FROM taptime_server.membership_home_location_assignments AS home
          JOIN taptime_server.locations AS location
            ON location.organization_id = home.organization_id
           AND location.id = home.location_id
           AND location.active
          WHERE home.organization_id = membership.organization_id
            AND home.membership_id = membership.id
            AND home.revoked_at IS NULL
        )
    )
    AND NOT EXISTS (
      SELECT 1
      FROM taptime_server.work_targets AS target
      WHERE target.organization_id = requested_organization_id
        AND target.active
        AND 1 <> (
          SELECT pg_catalog.count(*)
          FROM taptime_server.work_target_location_assignments AS binding
          JOIN taptime_server.locations AS location
            ON location.organization_id = binding.organization_id
           AND location.id = binding.location_id
           AND location.active
          WHERE binding.organization_id = target.organization_id
            AND binding.target_type = target.target_type
            AND binding.target_id = target.target_id
            AND binding.revoked_at IS NULL
        )
    )
    AND NOT EXISTS (
      SELECT 1
      FROM taptime_server.customers AS customer
      LEFT JOIN taptime_server.work_targets AS target
        ON target.organization_id = customer.organization_id
       AND target.target_type = 'customer'
       AND target.target_id = customer.id
      WHERE customer.organization_id = requested_organization_id
        AND customer.active
        AND (target.target_id IS NULL OR NOT target.active)
    )
    AND NOT EXISTS (
      SELECT 1
      FROM taptime_server.projects AS project
      LEFT JOIN taptime_server.work_targets AS target
        ON target.organization_id = project.organization_id
       AND target.target_type = 'project'
       AND target.target_id = project.id
      WHERE project.organization_id = requested_organization_id
        AND project.active
        AND (target.target_id IS NULL OR NOT target.active)
    )
    AND NOT EXISTS (
      SELECT 1
      FROM taptime_server.nfc_assignments AS assignment
      LEFT JOIN taptime_server.work_targets AS target
        ON target.organization_id = assignment.organization_id
       AND target.target_type = assignment.target_type
       AND target.target_id = assignment.target_customer_id
      WHERE assignment.organization_id = requested_organization_id
        AND assignment.active
        AND assignment.assignment_type = 'work'
        AND (
          target.target_id IS NULL
          OR NOT target.active
          OR 1 <> (
            SELECT pg_catalog.count(*)
            FROM taptime_server.work_target_location_assignments AS binding
            JOIN taptime_server.locations AS location
              ON location.organization_id = binding.organization_id
             AND location.id = binding.location_id
             AND location.active
            WHERE binding.organization_id = target.organization_id
              AND binding.target_type = target.target_type
              AND binding.target_id = target.target_id
              AND binding.revoked_at IS NULL
          )
        )
    )
$complete$;

ALTER FUNCTION taptime_server.location_setup_is_complete_v1(uuid)
  OWNER TO taptime_admin_setup_data_function_owner;
REVOKE ALL ON FUNCTION taptime_server.location_setup_is_complete_v1(uuid) FROM PUBLIC;

CREATE FUNCTION taptime_server.membership_has_work_location_v1(
  requested_organization_id uuid,
  requested_membership_id uuid,
  requested_location_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $work_scope$
  SELECT requested_organization_id IS NOT NULL
    AND requested_membership_id IS NOT NULL
    AND requested_location_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM taptime_server.organizations AS organization
      JOIN taptime_server.memberships AS membership
        ON membership.organization_id = organization.id
       AND membership.id = requested_membership_id
       AND membership.revoked_at IS NULL
      JOIN taptime_server.locations AS location
        ON location.organization_id = organization.id
       AND location.id = requested_location_id
       AND location.active
      WHERE organization.id = requested_organization_id
        AND organization.locations_enabled
        AND (
          EXISTS (
            SELECT 1
            FROM taptime_server.membership_home_location_assignments AS home
            WHERE home.organization_id = organization.id
              AND home.membership_id = membership.id
              AND home.location_id = location.id
              AND home.revoked_at IS NULL
          )
          OR EXISTS (
            SELECT 1
            FROM taptime_server.membership_work_location_grants AS work_grant
            WHERE work_grant.organization_id = organization.id
              AND work_grant.membership_id = membership.id
              AND work_grant.location_id = location.id
              AND work_grant.revoked_at IS NULL
          )
        )
    )
$work_scope$;

ALTER FUNCTION taptime_server.membership_has_work_location_v1(uuid, uuid, uuid)
  OWNER TO taptime_admin_setup_data_function_owner;
REVOKE ALL ON FUNCTION taptime_server.membership_has_work_location_v1(uuid, uuid, uuid)
  FROM PUBLIC;

CREATE FUNCTION taptime_server.membership_has_management_location_v1(
  requested_organization_id uuid,
  requested_membership_id uuid,
  requested_location_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $management_scope$
  SELECT requested_organization_id IS NOT NULL
    AND requested_membership_id IS NOT NULL
    AND requested_location_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM taptime_server.organizations AS organization
      JOIN taptime_server.memberships AS membership
        ON membership.organization_id = organization.id
       AND membership.id = requested_membership_id
       AND membership.revoked_at IS NULL
      JOIN taptime_server.locations AS location
        ON location.organization_id = organization.id
       AND location.id = requested_location_id
       AND location.active
      JOIN taptime_server.membership_management_location_grants AS management_grant
        ON management_grant.organization_id = organization.id
       AND management_grant.membership_id = membership.id
       AND management_grant.location_id = location.id
       AND management_grant.revoked_at IS NULL
      WHERE organization.id = requested_organization_id
        AND organization.locations_enabled
    )
$management_scope$;

ALTER FUNCTION taptime_server.membership_has_management_location_v1(uuid, uuid, uuid)
  OWNER TO taptime_admin_setup_data_function_owner;
REVOKE ALL ON FUNCTION taptime_server.membership_has_management_location_v1(uuid, uuid, uuid)
  FROM PUBLIC;

CREATE FUNCTION taptime_server.resolve_work_event_location_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $resolve_event$
DECLARE
  locations_are_enabled boolean;
  active_membership_id uuid;
  resolved_location_id uuid;
  active_target_type text;
  active_target_id uuid;
  active_record_matches boolean := false;
BEGIN
  SELECT organization.locations_enabled
  INTO STRICT locations_are_enabled
  FROM taptime_server.organizations AS organization
  WHERE organization.id = NEW.organization_id
  FOR KEY SHARE;

  IF NOT locations_are_enabled THEN
    NEW.accepted_work_location_id := NULL;
    RETURN NEW;
  END IF;

  -- Stop and break events retain the already accepted Location of the in-flight record. This
  -- keeps one TimeRecord at one immutable Location even if setup changes after Start.
  SELECT entry.accepted_work_location_id, entry.target_type, entry.target_customer_id
  INTO resolved_location_id, active_target_type, active_target_id
  FROM taptime_server.time_entries AS entry
  WHERE entry.organization_id = NEW.organization_id
    AND entry.user_id = NEW.triggered_by_user_id
    AND entry.status = 'started';

  active_record_matches := FOUND AND (
    NEW.subject_type = 'break'
    OR (
      NEW.subject_type = 'work'
      AND NEW.target_type = active_target_type
      AND NEW.target_customer_id = active_target_id
    )
  );

  IF active_record_matches THEN
    IF NEW.accepted_work_location_id IS NOT NULL
      AND NEW.accepted_work_location_id IS DISTINCT FROM resolved_location_id
    THEN
      RAISE EXCEPTION 'Client Work Location override rejected'
        USING ERRCODE = '23514';
    END IF;
  ELSE
    IF NEW.subject_type <> 'work' THEN
      RAISE EXCEPTION 'WorkEvent has no active TimeRecord Location to retain'
        USING ERRCODE = '23514';
    END IF;

    IF NEW.target_type = 'general_work' THEN
      -- General Work is the only case in which the caller supplies an explicit context. The
      -- server still verifies it and persists the verified value; it never accepts an override.
      resolved_location_id := NEW.accepted_work_location_id;
      IF resolved_location_id IS NULL THEN
        RAISE EXCEPTION 'General Work requires an explicit Work Location context'
          USING ERRCODE = '23514';
      END IF;
      PERFORM 1
      FROM taptime_server.locations AS location
      WHERE location.organization_id = NEW.organization_id
        AND location.id = resolved_location_id
        AND location.active;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'General Work Location is missing, inactive or foreign'
          USING ERRCODE = '23514';
      END IF;
    ELSE
      SELECT binding.location_id
      INTO resolved_location_id
      FROM taptime_server.work_target_location_assignments AS binding
      JOIN taptime_server.locations AS location
        ON location.organization_id = binding.organization_id
       AND location.id = binding.location_id
       AND location.active
      WHERE binding.organization_id = NEW.organization_id
        AND binding.target_type = NEW.target_type
        AND binding.target_id = NEW.target_customer_id
        AND binding.revoked_at IS NULL;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'WorkTarget Location is missing, inactive or ambiguous'
          USING ERRCODE = '23514';
      END IF;
      IF NEW.accepted_work_location_id IS NOT NULL
        AND NEW.accepted_work_location_id <> resolved_location_id
      THEN
        RAISE EXCEPTION 'Client Work Location override rejected'
          USING ERRCODE = '23514';
      END IF;
    END IF;

    SELECT membership.id
    INTO active_membership_id
    FROM taptime_server.memberships AS membership
    WHERE membership.organization_id = NEW.organization_id
      AND membership.user_id = NEW.triggered_by_user_id
      AND membership.revoked_at IS NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Active Membership required for Work Location acceptance'
        USING ERRCODE = '42501';
    END IF;

    PERFORM 1
    FROM taptime_server.membership_home_location_assignments AS home
    WHERE home.organization_id = NEW.organization_id
      AND home.membership_id = active_membership_id
      AND home.location_id = resolved_location_id
      AND home.revoked_at IS NULL;
    IF NOT FOUND THEN
      PERFORM 1
      FROM taptime_server.membership_work_location_grants AS work_grant
      WHERE work_grant.organization_id = NEW.organization_id
        AND work_grant.membership_id = active_membership_id
        AND work_grant.location_id = resolved_location_id
        AND work_grant.revoked_at IS NULL;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Membership has no Work authority for resolved Location'
          USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  NEW.accepted_work_location_id := resolved_location_id;
  RETURN NEW;
END
$resolve_event$;

ALTER FUNCTION taptime_server.resolve_work_event_location_v1()
  OWNER TO taptime_admin_setup_data_function_owner;
REVOKE ALL ON FUNCTION taptime_server.resolve_work_event_location_v1() FROM PUBLIC;

CREATE TRIGGER work_events_resolve_accepted_work_location
  BEFORE INSERT ON taptime_server.work_events
  FOR EACH ROW EXECUTE FUNCTION taptime_server.resolve_work_event_location_v1();

CREATE FUNCTION taptime_server.propagate_time_entry_location_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $propagate_entry$
DECLARE
  resolved_location_id uuid;
BEGIN
  SELECT event.accepted_work_location_id
  INTO STRICT resolved_location_id
  FROM taptime_server.work_events AS event
  WHERE event.organization_id = NEW.organization_id
    AND event.id = NEW.start_work_event_id;

  IF NEW.accepted_work_location_id IS NOT NULL
    AND NEW.accepted_work_location_id IS DISTINCT FROM resolved_location_id
  THEN
    RAISE EXCEPTION 'TimeEntry Work Location differs from its Start WorkEvent'
      USING ERRCODE = '23514';
  END IF;
  NEW.accepted_work_location_id := resolved_location_id;
  RETURN NEW;
END
$propagate_entry$;

ALTER FUNCTION taptime_server.propagate_time_entry_location_v1()
  OWNER TO taptime_admin_setup_data_function_owner;
REVOKE ALL ON FUNCTION taptime_server.propagate_time_entry_location_v1() FROM PUBLIC;

CREATE TRIGGER time_entries_propagate_accepted_work_location
  BEFORE INSERT ON taptime_server.time_entries
  FOR EACH ROW EXECUTE FUNCTION taptime_server.propagate_time_entry_location_v1();

CREATE FUNCTION taptime_server.propagate_time_record_revision_location_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $propagate_revision$
DECLARE
  resolved_location_id uuid;
BEGIN
  IF NEW.revision_number > 1 THEN
    SELECT revision.accepted_work_location_id
    INTO STRICT resolved_location_id
    FROM taptime_server.time_record_revisions AS revision
    WHERE revision.organization_id = NEW.organization_id
      AND revision.time_record_id = NEW.time_record_id
      AND revision.revision_number = NEW.revision_number - 1;
  ELSIF NEW.canonical_time_entry_id IS NOT NULL THEN
    SELECT entry.accepted_work_location_id
    INTO STRICT resolved_location_id
    FROM taptime_server.time_entries AS entry
    WHERE entry.organization_id = NEW.organization_id
      AND entry.id = NEW.canonical_time_entry_id;
  ELSE
    -- D-022: T-015a never assigns a Location to a recovered record. T-015b will derive only
    -- from the record's own WorkEvent evidence; current Resource setup is never historical proof.
    resolved_location_id := NULL;
  END IF;

  IF NEW.accepted_work_location_id IS NOT NULL
    AND NEW.accepted_work_location_id IS DISTINCT FROM resolved_location_id
  THEN
    RAISE EXCEPTION 'TimeRecord revision changed its accepted Work Location'
      USING ERRCODE = '23514';
  END IF;
  NEW.accepted_work_location_id := resolved_location_id;
  RETURN NEW;
END
$propagate_revision$;

ALTER FUNCTION taptime_server.propagate_time_record_revision_location_v1()
  OWNER TO taptime_admin_setup_data_function_owner;
REVOKE ALL ON FUNCTION taptime_server.propagate_time_record_revision_location_v1() FROM PUBLIC;

CREATE TRIGGER time_record_revisions_propagate_accepted_work_location
  BEFORE INSERT ON taptime_server.time_record_revisions
  FOR EACH ROW EXECUTE FUNCTION taptime_server.propagate_time_record_revision_location_v1();

-- The existing administrative audit trigger deliberately rejects every setup mutation that is
-- not explicitly allowlisted. Extend that closed list only for this one transition and record
-- the switch value; all existing audit branches remain unchanged.
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
  selected_role text := pg_catalog.current_setting('role', true);
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
    (TG_OP = 'INSERT' AND TG_TABLE_NAME IN ('customers', 'nfc_tags', 'nfc_assignments'))
    OR (
      TG_OP = 'UPDATE'
      AND TG_TABLE_NAME = 'organizations'
      AND (pg_catalog.to_jsonb(NEW) ->> 'locations_enabled')::boolean IS DISTINCT FROM
          (pg_catalog.to_jsonb(OLD) ->> 'locations_enabled')::boolean
      AND (pg_catalog.to_jsonb(NEW) ->> 'name') = (pg_catalog.to_jsonb(OLD) ->> 'name')
    )
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
  audit_correlation_id := NULLIF(pg_catalog.current_setting('app.correlation_id', true), '');
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
    audit_payload := CASE
      WHEN (pg_catalog.to_jsonb(NEW) ->> 'locations_enabled')::boolean IS DISTINCT FROM
           (pg_catalog.to_jsonb(OLD) ->> 'locations_enabled')::boolean THEN
        pg_catalog.jsonb_build_object(
          'changedFields', pg_catalog.jsonb_build_array('locationsEnabled'),
          'locationsEnabled', (pg_catalog.to_jsonb(NEW) ->> 'locations_enabled')::boolean,
          'rowVersion', NEW.row_version
        )
      ELSE
        pg_catalog.jsonb_build_object(
          'changedFields', pg_catalog.jsonb_build_array('name'),
          'rowVersion', NEW.row_version
        )
    END;
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

CREATE FUNCTION taptime_server.set_organization_locations_enabled_v1(
  requested_organization_id uuid,
  requested_enabled boolean
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog
AS $transition$
DECLARE
  current_enabled boolean;
BEGIN
  IF pg_catalog.current_setting('role', true) <> 'taptime_admin_setup'
    OR requested_organization_id IS NULL
    OR requested_enabled IS NULL
    OR NOT taptime_server.has_current_admin_setup_authority(requested_organization_id)
  THEN
    RAISE EXCEPTION 'Location feature transition capability rejected' USING ERRCODE = '42501';
  END IF;

  -- FOR UPDATE serializes activation with every transaction holding a foreign-key key-share on
  -- this Organization. The complete validation and flag change therefore form one transition.
  SELECT organization.locations_enabled
  INTO STRICT current_enabled
  FROM taptime_server.organizations AS organization
  WHERE organization.id = requested_organization_id
  FOR UPDATE;

  IF requested_enabled
    AND NOT taptime_server.location_setup_is_complete_v1(requested_organization_id)
  THEN
    RAISE EXCEPTION 'Location setup is incomplete or inconsistent' USING ERRCODE = '23514';
  END IF;

  IF current_enabled IS DISTINCT FROM requested_enabled THEN
    UPDATE taptime_server.organizations AS organization
    SET locations_enabled = requested_enabled,
        row_version = organization.row_version + 1
    WHERE organization.id = requested_organization_id;
  END IF;

  RETURN requested_enabled;
END
$transition$;

ALTER FUNCTION taptime_server.set_organization_locations_enabled_v1(uuid, boolean)
  OWNER TO taptime_admin_setup_data_function_owner;
REVOKE ALL ON FUNCTION taptime_server.set_organization_locations_enabled_v1(uuid, boolean)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.set_organization_locations_enabled_v1(uuid, boolean)
  TO taptime_admin_setup;

CREATE FUNCTION taptime_server.enforce_enabled_location_setup_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $enabled_invariant$
DECLARE
  affected_organization_id uuid;
  enabled boolean;
BEGIN
  affected_organization_id := CASE
    WHEN TG_TABLE_NAME = 'organizations' THEN COALESCE(
      (pg_catalog.to_jsonb(NEW) ->> 'id')::uuid,
      (pg_catalog.to_jsonb(OLD) ->> 'id')::uuid
    )
    ELSE COALESCE(
      (pg_catalog.to_jsonb(NEW) ->> 'organization_id')::uuid,
      (pg_catalog.to_jsonb(OLD) ->> 'organization_id')::uuid
    )
  END;

  SELECT organization.locations_enabled
  INTO enabled
  FROM taptime_server.organizations AS organization
  WHERE organization.id = affected_organization_id
  FOR KEY SHARE;

  IF COALESCE(enabled, false)
    AND NOT taptime_server.location_setup_is_complete_v1(affected_organization_id)
  THEN
    RAISE EXCEPTION 'Enabled Location setup became incomplete or inconsistent'
      USING ERRCODE = '23514';
  END IF;
  RETURN COALESCE(NEW, OLD);
END
$enabled_invariant$;

ALTER FUNCTION taptime_server.enforce_enabled_location_setup_v1()
  OWNER TO taptime_admin_setup_data_function_owner;
REVOKE ALL ON FUNCTION taptime_server.enforce_enabled_location_setup_v1() FROM PUBLIC;

CREATE CONSTRAINT TRIGGER organizations_enabled_location_setup
  AFTER INSERT OR UPDATE OR DELETE ON taptime_server.organizations
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION taptime_server.enforce_enabled_location_setup_v1();
CREATE CONSTRAINT TRIGGER memberships_enabled_location_setup
  AFTER INSERT OR UPDATE OR DELETE ON taptime_server.memberships
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION taptime_server.enforce_enabled_location_setup_v1();
CREATE CONSTRAINT TRIGGER customers_enabled_location_setup
  AFTER INSERT OR UPDATE OR DELETE ON taptime_server.customers
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION taptime_server.enforce_enabled_location_setup_v1();
CREATE CONSTRAINT TRIGGER projects_enabled_location_setup
  AFTER INSERT OR UPDATE OR DELETE ON taptime_server.projects
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION taptime_server.enforce_enabled_location_setup_v1();
CREATE CONSTRAINT TRIGGER nfc_assignments_enabled_location_setup
  AFTER INSERT OR UPDATE OR DELETE ON taptime_server.nfc_assignments
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION taptime_server.enforce_enabled_location_setup_v1();
CREATE CONSTRAINT TRIGGER work_targets_enabled_location_setup
  AFTER INSERT OR UPDATE OR DELETE ON taptime_server.work_targets
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION taptime_server.enforce_enabled_location_setup_v1();
CREATE CONSTRAINT TRIGGER locations_enabled_location_setup
  AFTER INSERT OR UPDATE OR DELETE ON taptime_server.locations
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION taptime_server.enforce_enabled_location_setup_v1();
CREATE CONSTRAINT TRIGGER membership_home_locations_enabled_location_setup
  AFTER INSERT OR UPDATE OR DELETE ON taptime_server.membership_home_location_assignments
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION taptime_server.enforce_enabled_location_setup_v1();
CREATE CONSTRAINT TRIGGER work_target_locations_enabled_location_setup
  AFTER INSERT OR UPDATE OR DELETE ON taptime_server.work_target_location_assignments
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION taptime_server.enforce_enabled_location_setup_v1();

ALTER TABLE taptime_server.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.locations FORCE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.membership_home_location_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.membership_home_location_assignments FORCE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.membership_work_location_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.membership_work_location_grants FORCE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.membership_management_location_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.membership_management_location_grants FORCE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.work_target_location_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.work_target_location_assignments FORCE ROW LEVEL SECURITY;

CREATE POLICY locations_admin_setup_select ON taptime_server.locations
  FOR SELECT TO taptime_admin_setup
  USING (taptime_server.has_current_admin_setup_authority(organization_id));
CREATE POLICY membership_home_locations_admin_setup_select
  ON taptime_server.membership_home_location_assignments
  FOR SELECT TO taptime_admin_setup
  USING (taptime_server.has_current_admin_setup_authority(organization_id));
CREATE POLICY membership_work_locations_admin_setup_select
  ON taptime_server.membership_work_location_grants
  FOR SELECT TO taptime_admin_setup
  USING (taptime_server.has_current_admin_setup_authority(organization_id));
CREATE POLICY membership_management_locations_admin_setup_select
  ON taptime_server.membership_management_location_grants
  FOR SELECT TO taptime_admin_setup
  USING (taptime_server.has_current_admin_setup_authority(organization_id));
CREATE POLICY work_target_locations_admin_setup_select
  ON taptime_server.work_target_location_assignments
  FOR SELECT TO taptime_admin_setup
  USING (taptime_server.has_current_admin_setup_authority(organization_id));

CREATE POLICY locations_admin_setup_insert ON taptime_server.locations
  FOR INSERT TO taptime_admin_setup
  WITH CHECK (taptime_server.has_current_admin_setup_authority(organization_id));
CREATE POLICY locations_admin_setup_update ON taptime_server.locations
  FOR UPDATE TO taptime_admin_setup
  USING (taptime_server.has_current_admin_setup_authority(organization_id))
  WITH CHECK (taptime_server.has_current_admin_setup_authority(organization_id));
CREATE POLICY membership_home_locations_admin_setup_insert
  ON taptime_server.membership_home_location_assignments
  FOR INSERT TO taptime_admin_setup
  WITH CHECK (taptime_server.has_current_admin_setup_authority(organization_id));
CREATE POLICY membership_home_locations_admin_setup_update
  ON taptime_server.membership_home_location_assignments
  FOR UPDATE TO taptime_admin_setup
  USING (taptime_server.has_current_admin_setup_authority(organization_id))
  WITH CHECK (taptime_server.has_current_admin_setup_authority(organization_id));
CREATE POLICY membership_work_locations_admin_setup_insert
  ON taptime_server.membership_work_location_grants
  FOR INSERT TO taptime_admin_setup
  WITH CHECK (taptime_server.has_current_admin_setup_authority(organization_id));
CREATE POLICY membership_work_locations_admin_setup_update
  ON taptime_server.membership_work_location_grants
  FOR UPDATE TO taptime_admin_setup
  USING (taptime_server.has_current_admin_setup_authority(organization_id))
  WITH CHECK (taptime_server.has_current_admin_setup_authority(organization_id));
CREATE POLICY membership_management_locations_admin_setup_insert
  ON taptime_server.membership_management_location_grants
  FOR INSERT TO taptime_admin_setup
  WITH CHECK (taptime_server.has_current_admin_setup_authority(organization_id));
CREATE POLICY membership_management_locations_admin_setup_update
  ON taptime_server.membership_management_location_grants
  FOR UPDATE TO taptime_admin_setup
  USING (taptime_server.has_current_admin_setup_authority(organization_id))
  WITH CHECK (taptime_server.has_current_admin_setup_authority(organization_id));
CREATE POLICY work_target_locations_admin_setup_insert
  ON taptime_server.work_target_location_assignments
  FOR INSERT TO taptime_admin_setup
  WITH CHECK (taptime_server.has_current_admin_setup_authority(organization_id));
CREATE POLICY work_target_locations_admin_setup_update
  ON taptime_server.work_target_location_assignments
  FOR UPDATE TO taptime_admin_setup
  USING (taptime_server.has_current_admin_setup_authority(organization_id))
  WITH CHECK (taptime_server.has_current_admin_setup_authority(organization_id));

GRANT SELECT ON
  taptime_server.locations,
  taptime_server.membership_home_location_assignments,
  taptime_server.membership_work_location_grants,
  taptime_server.membership_management_location_grants,
  taptime_server.work_target_location_assignments
TO taptime_admin_setup;

GRANT INSERT (id, organization_id, display_name)
  ON taptime_server.locations TO taptime_admin_setup;
GRANT UPDATE (active, deactivated_at, row_version)
  ON taptime_server.locations TO taptime_admin_setup;
GRANT INSERT (id, organization_id, membership_id, location_id), UPDATE (revoked_at)
  ON taptime_server.membership_home_location_assignments,
     taptime_server.membership_work_location_grants,
     taptime_server.membership_management_location_grants
  TO taptime_admin_setup;
GRANT INSERT (id, organization_id, target_type, target_id, location_id), UPDATE (revoked_at)
  ON taptime_server.work_target_location_assignments TO taptime_admin_setup;

GRANT SELECT (id, locations_enabled, row_version)
  ON taptime_server.organizations TO taptime_admin_setup_data_function_owner;
GRANT SELECT (id, organization_id, user_id, revoked_at)
  ON taptime_server.memberships TO taptime_admin_setup_data_function_owner;
GRANT SELECT (id, organization_id, active)
  ON taptime_server.customers TO taptime_admin_setup_data_function_owner;
GRANT SELECT (id, organization_id, active)
  ON taptime_server.projects TO taptime_admin_setup_data_function_owner;
GRANT SELECT (organization_id, target_type, target_customer_id, active)
  ON taptime_server.nfc_assignments TO taptime_admin_setup_data_function_owner;
GRANT SELECT (organization_id, target_type, target_id, active)
  ON taptime_server.work_targets TO taptime_admin_setup_data_function_owner;
GRANT SELECT (id, organization_id, triggered_by_user_id, subject_type, target_type,
              target_customer_id, accepted_work_location_id)
  ON taptime_server.work_events TO taptime_admin_setup_data_function_owner;
GRANT SELECT (id, organization_id, user_id, target_type, target_customer_id, status,
              start_work_event_id, accepted_work_location_id)
  ON taptime_server.time_entries TO taptime_admin_setup_data_function_owner;
GRANT SELECT (organization_id, time_record_id, revision_number, canonical_time_entry_id,
              accepted_work_location_id)
  ON taptime_server.time_record_revisions TO taptime_admin_setup_data_function_owner;
GRANT SELECT ON
  taptime_server.locations,
  taptime_server.membership_home_location_assignments,
  taptime_server.membership_work_location_grants,
  taptime_server.membership_management_location_grants,
  taptime_server.work_target_location_assignments
TO taptime_admin_setup_data_function_owner;
GRANT UPDATE (locations_enabled, row_version)
  ON taptime_server.organizations TO taptime_admin_setup_data_function_owner;

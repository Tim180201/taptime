-- T-091 / D-102: record location evidence; the BusinessEngine decides.

CREATE OR REPLACE FUNCTION taptime_server.location_setup_is_complete_v1(
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
        AND target.target_type <> 'general_work'
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
          OR (target.target_type <> 'general_work' AND 1 <> (
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
          ))
        )
    )
$complete$;


CREATE OR REPLACE FUNCTION taptime_server.membership_may_choose_time_target_v1(
  requested_organization_id uuid, requested_membership_id uuid,
  requested_target_type text, requested_target_id uuid
)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog
AS $target_authority$
  SELECT EXISTS (
    SELECT 1 FROM taptime_server.work_targets AS target
    JOIN taptime_server.memberships AS person
      ON person.organization_id=target.organization_id
      AND person.id=requested_membership_id AND person.revoked_at IS NULL
    JOIN taptime_server.organizations AS organization ON organization.id=target.organization_id
    WHERE target.organization_id=requested_organization_id AND target.active
      AND target.target_type=requested_target_type AND target.target_id=requested_target_id
      AND (NOT organization.locations_enabled OR target.target_type='general_work' OR EXISTS (
        SELECT 1 FROM taptime_server.work_target_location_assignments AS binding
        WHERE binding.organization_id=target.organization_id
          AND binding.target_type=target.target_type AND binding.target_id=target.target_id
          AND binding.revoked_at IS NULL
          AND taptime_server.membership_has_work_location_v1(
            requested_organization_id, requested_membership_id, binding.location_id
          )
      ))
  )
$target_authority$;

CREATE OR REPLACE FUNCTION taptime_server.read_mobile_work_targets_v1(
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
      NOT EXISTS (
        SELECT 1
        FROM taptime_server.organizations AS organization
        WHERE organization.id = requested_organization_id
          AND organization.locations_enabled
      )
      OR target.target_type = 'general_work'
      OR EXISTS (
        SELECT 1
        FROM taptime_server.work_target_location_assignments AS binding
        WHERE binding.organization_id = target.organization_id
          AND binding.target_type = target.target_type
          AND binding.target_id = target.target_id
          AND binding.revoked_at IS NULL
          AND taptime_server.membership_has_work_location_v1(
            requested_organization_id, requested_membership_id, binding.location_id
          )
      )
    )
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


CREATE OR REPLACE FUNCTION taptime_server.lock_offline_capture_projection_v3(
  requested_organization_id uuid
)
RETURNS TABLE (
  item_type text,
  subject_type text,
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
    OR requested_organization_id IS DISTINCT FROM NULLIF(
      pg_catalog.current_setting('app.organization_id', true), ''
    )::uuid
  THEN
    RAISE EXCEPTION 'Offline v3 projection capability rejected' USING ERRCODE = '42501';
  END IF;

  PERFORM target.target_id
  FROM taptime_server.work_targets AS target
  WHERE target.organization_id = requested_organization_id AND target.active
  FOR SHARE;

  PERFORM assignment.id
  FROM taptime_server.nfc_assignments AS assignment
  JOIN taptime_server.nfc_tags AS tag
    ON tag.organization_id = assignment.organization_id
   AND tag.id = assignment.nfc_tag_id
  WHERE assignment.organization_id = requested_organization_id
    AND assignment.active AND assignment.valid_to IS NULL
  FOR SHARE OF assignment, tag;

  RETURN QUERY
  SELECT 'nfc_assignment'::text, assignment.assignment_type, assignment.id, tag.id,
         target.target_type, target.target_id,
         CASE WHEN assignment.assignment_type = 'break' THEN 'Pause' ELSE target.display_name END,
         tag.payload_value, assignment.row_version, target.row_version
  FROM taptime_server.nfc_assignments AS assignment
  JOIN taptime_server.nfc_tags AS tag
    ON tag.organization_id = assignment.organization_id
   AND tag.id = assignment.nfc_tag_id
  LEFT JOIN taptime_server.work_targets AS target
    ON target.organization_id = assignment.organization_id
   AND target.target_type = assignment.target_type
   AND target.target_id = assignment.target_customer_id
  WHERE assignment.organization_id = requested_organization_id
    AND assignment.active AND assignment.valid_to IS NULL
    AND (assignment.assignment_type = 'break' OR (target.active AND
      taptime_server.membership_may_choose_time_target_v1(requested_organization_id,
        nullif(current_setting('app.membership_id',true),'')::uuid,target.target_type,target.target_id)))
  UNION ALL
  SELECT 'manual_target'::text, 'work'::text, NULL::uuid, NULL::uuid,
         target.target_type, target.target_id, target.display_name,
         NULL::text, NULL::bigint, target.row_version
  FROM taptime_server.work_targets AS target
  WHERE target.organization_id = requested_organization_id AND target.active
    AND taptime_server.membership_may_choose_time_target_v1(requested_organization_id,
      nullif(current_setting('app.membership_id',true),'')::uuid,target.target_type,target.target_id)
  UNION ALL
  SELECT 'manual_break'::text, 'break'::text, NULL::uuid, NULL::uuid,
         NULL::text, NULL::uuid, 'Pause'::text, NULL::text, NULL::bigint, NULL::bigint
  ORDER BY 1, 6 NULLS FIRST;
END
$projection$;

CREATE OR REPLACE FUNCTION taptime_server.resolve_work_event_location_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog
AS $resolve_event$
DECLARE
  enabled boolean;
  person uuid;
  resolved uuid;
BEGIN
  -- The caller supplies evidence, never a location override. Always replace its value.
  NEW.accepted_work_location_id := NULL;
  SELECT locations_enabled INTO enabled FROM taptime_server.organizations
    WHERE id=NEW.organization_id FOR KEY SHARE;
  IF NOT COALESCE(enabled,false) THEN RETURN NEW; END IF;

  -- Stop and pause retain even a historical NULL, independent of today's grants/bindings.
  SELECT entry.accepted_work_location_id INTO resolved
    FROM taptime_server.time_entries entry
    WHERE entry.organization_id=NEW.organization_id AND entry.user_id=NEW.triggered_by_user_id
      AND entry.status='started' AND (NEW.subject_type='break' OR (
        entry.target_type=NEW.target_type AND entry.target_customer_id=NEW.target_customer_id));
  IF FOUND THEN NEW.accepted_work_location_id:=resolved; RETURN NEW; END IF;
  IF NEW.subject_type='break' THEN RETURN NEW; END IF;

  SELECT id INTO person FROM taptime_server.memberships
    WHERE organization_id=NEW.organization_id AND user_id=NEW.triggered_by_user_id AND revoked_at IS NULL;
  IF person IS NULL THEN RETURN NEW; END IF;
  IF NEW.target_type='general_work' THEN
    SELECT home.location_id INTO resolved
      FROM taptime_server.membership_home_location_assignments home
      JOIN taptime_server.locations location ON location.organization_id=home.organization_id
        AND location.id=home.location_id AND location.active
      WHERE home.organization_id=NEW.organization_id AND home.membership_id=person AND home.revoked_at IS NULL;
  ELSE
    SELECT binding.location_id INTO resolved
      FROM taptime_server.work_target_location_assignments binding
      JOIN taptime_server.locations location ON location.organization_id=binding.organization_id
        AND location.id=binding.location_id AND location.active
      WHERE binding.organization_id=NEW.organization_id AND binding.target_type=NEW.target_type
        AND binding.target_id=NEW.target_customer_id AND binding.revoked_at IS NULL;
    IF resolved IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM taptime_server.membership_home_location_assignments home
        WHERE home.organization_id=NEW.organization_id AND home.membership_id=person
          AND home.location_id=resolved AND home.revoked_at IS NULL
      UNION ALL SELECT 1 FROM taptime_server.membership_work_location_grants work_grant
        WHERE work_grant.organization_id=NEW.organization_id AND work_grant.membership_id=person
          AND work_grant.location_id=resolved AND work_grant.revoked_at IS NULL
    ) THEN resolved:=NULL; END IF;
  END IF;
  NEW.accepted_work_location_id:=resolved;
  RETURN NEW;
END
$resolve_event$;

-- No new mutable state: these functions are installed/replaced by migrations. Removal is a
-- future migration; recorded locations remain under the existing append-only/retention rules.
CREATE FUNCTION taptime_server.work_event_location_unavailable_v1(requested_organization_id uuid, requested_event_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog
AS $unavailable$
  SELECT EXISTS (
    SELECT 1 FROM taptime_server.work_events event
    JOIN taptime_server.organizations organization ON organization.id=event.organization_id
    WHERE requested_organization_id = nullif(current_setting('app.organization_id',true),'')::uuid
      AND event.organization_id=requested_organization_id AND event.id=requested_event_id
      AND event.triggered_by_user_id=nullif(current_setting('app.user_id',true),'')::uuid
      AND organization.locations_enabled AND event.subject_type='work'
      AND event.target_type<>'general_work' AND event.accepted_work_location_id IS NULL
      AND NOT EXISTS (SELECT 1 FROM taptime_server.time_entries entry
        WHERE entry.organization_id=event.organization_id AND entry.user_id=event.triggered_by_user_id
          AND entry.status='started' AND entry.target_type=event.target_type
          AND entry.target_customer_id=event.target_customer_id)
  )
$unavailable$;
ALTER FUNCTION taptime_server.work_event_location_unavailable_v1(uuid,uuid)
  OWNER TO taptime_admin_setup_data_function_owner;
REVOKE ALL ON FUNCTION taptime_server.work_event_location_unavailable_v1(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.work_event_location_unavailable_v1(uuid,uuid)
  TO taptime_server_lifecycle, taptime_offline_event_ingestor;
GRANT EXECUTE ON FUNCTION taptime_server.membership_may_choose_time_target_v1(uuid,uuid,text,uuid)
  TO taptime_offline_lease_function_owner;


ALTER TABLE taptime_server.canonical_decisions DROP CONSTRAINT canonical_decisions_result_shape_v4,
  ADD CONSTRAINT canonical_decisions_result_shape_v5 CHECK (
    (
      decision_type IN ('time_entry_started', 'time_entry_stopped')
      AND subject_type = 'work'
      AND reason IS NULL
      AND time_entry_id IS NOT NULL
      AND active_time_entry_id IS NULL
      AND (decision_type='time_entry_stopped' OR break_interval_id IS NULL)
      AND active_break_interval_id IS NULL
      AND previous_work_event_id IS NULL
    )
    OR (
      decision_type IN ('break_started', 'break_stopped')
      AND subject_type = 'break'
      AND reason IS NULL
      AND time_entry_id IS NOT NULL
      AND active_time_entry_id IS NULL
      AND break_interval_id IS NOT NULL
      AND active_break_interval_id IS NULL
      AND previous_work_event_id IS NULL
    )
    OR (
      decision_type = 'duplicate_scan_ignored'
      AND reason IS NULL
      AND time_entry_id IS NULL
      AND active_time_entry_id IS NULL
      AND break_interval_id IS NULL
      AND active_break_interval_id IS NULL
      AND previous_work_event_id IS NOT NULL
      AND previous_work_event_id <> work_event_id
    )
    OR (
      decision_type = 'active_entry_for_other_target_rejected'
      AND subject_type = 'work'
      AND reason IS NULL
      AND time_entry_id IS NULL
      AND active_time_entry_id IS NOT NULL
      AND break_interval_id IS NULL
      AND active_break_interval_id IS NULL
      AND previous_work_event_id IS NULL
    )
    OR (
      decision_type = 'break_without_active_time_entry_rejected'
      AND subject_type = 'break'
      AND reason IS NULL
      AND time_entry_id IS NULL
      AND active_time_entry_id IS NULL
      AND break_interval_id IS NULL
      AND active_break_interval_id IS NULL
      AND previous_work_event_id IS NULL
    )
    OR (
      decision_type = 'work_trigger_during_break_rejected'
      AND subject_type = 'work'
      AND reason IS NULL
      AND time_entry_id IS NULL
      AND active_time_entry_id IS NOT NULL
      AND break_interval_id IS NULL
      AND active_break_interval_id IS NOT NULL
      AND previous_work_event_id IS NULL
    )
    OR (
      decision_type = 'escalation_required'
      AND reason IN (
        'work_location_unavailable',
        'administration_stopped',
        'active_time_entry_organization_mismatch',
        'active_time_entry_user_mismatch',
        'previous_work_event_organization_mismatch',
        'previous_work_event_user_mismatch',
        'previous_work_event_target_mismatch',
        'previous_work_event_subject_mismatch',
        'active_break_organization_mismatch',
        'active_break_user_mismatch',
        'active_break_time_entry_mismatch',
        'work_event_precedes_active_break',
        'work_event_precedes_active_time_entry',
        'work_event_precedes_previous_accepted_work_event'
      )
      AND time_entry_id IS NULL
      AND active_time_entry_id IS NULL
      AND break_interval_id IS NULL
      AND active_break_interval_id IS NULL
      AND previous_work_event_id IS NULL
    )
  );


CREATE OR REPLACE FUNCTION taptime_server.lock_offline_capture_projection_v1(
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
    AND taptime_server.membership_may_choose_time_target_v1(requested_organization_id,
      nullif(current_setting('app.membership_id',true),'')::uuid,assignment.target_type,assignment.target_customer_id)
  ORDER BY assignment.id
  FOR SHARE OF assignment, tag, customer;
END
$projection$;


CREATE OR REPLACE FUNCTION taptime_server.lock_offline_capture_projection_v2(
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
    AND taptime_server.membership_may_choose_time_target_v1(requested_organization_id,
      nullif(current_setting('app.membership_id',true),'')::uuid,target.target_type,target.target_id)
  UNION ALL
  SELECT 'manual_target'::text, NULL::uuid, NULL::uuid, target.target_type,
         target.target_id, target.display_name, NULL::text, NULL::bigint,
         target.row_version
  FROM taptime_server.work_targets AS target
  WHERE target.organization_id = requested_organization_id
    AND target.active
    AND taptime_server.membership_may_choose_time_target_v1(requested_organization_id,
      nullif(current_setting('app.membership_id',true),'')::uuid,target.target_type,target.target_id)
  ORDER BY 1, 5;
END
$projection$;

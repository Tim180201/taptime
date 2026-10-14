-- T-118a / D-135, Z1-Z3. Optional preferences, never capture permissions.
-- Admin/manager commands create and end assignments; nothing edits their original
-- identity or attribution. Departures/deactivation do not end them. T-016 owns
-- eventual personal-data deletion. Migrations own this table and these functions.
CREATE TABLE taptime_server.target_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES taptime_server.organizations(id),
  membership_id uuid NOT NULL,
  target_type text NOT NULL CHECK (target_type IN ('customer','project')),
  target_id uuid NOT NULL,
  assigned_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  assigned_by uuid NOT NULL,
  ended_at timestamptz,
  ended_by uuid,
  FOREIGN KEY (organization_id,membership_id) REFERENCES taptime_server.memberships(organization_id,id),
  FOREIGN KEY (organization_id,target_type,target_id) REFERENCES taptime_server.work_targets(organization_id,target_type,target_id),
  FOREIGN KEY (organization_id,assigned_by) REFERENCES taptime_server.memberships(organization_id,id),
  FOREIGN KEY (organization_id,ended_by) REFERENCES taptime_server.memberships(organization_id,id),
  CHECK ((ended_at IS NULL AND ended_by IS NULL) OR (ended_at IS NOT NULL AND ended_by IS NOT NULL AND ended_at>=assigned_at))
);
CREATE UNIQUE INDEX target_assignments_one_active ON taptime_server.target_assignments
  (organization_id,membership_id,target_type,target_id) WHERE ended_at IS NULL;
CREATE INDEX target_assignments_target_active ON taptime_server.target_assignments
  (organization_id,target_type,target_id,membership_id) WHERE ended_at IS NULL;
ALTER TABLE taptime_server.target_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.target_assignments FORCE ROW LEVEL SECURITY;
-- No runtime role has table access. Existing, non-inheritable function owners
-- bypass RLS only inside functions with explicit live tenant/person/target checks.
GRANT SELECT ON taptime_server.target_assignments TO taptime_admin_setup_data_function_owner,
  taptime_mobile_read_function_owner,taptime_time_review_read_function_owner;
GRANT INSERT ON taptime_server.target_assignments TO taptime_admin_setup_data_function_owner;
GRANT UPDATE(ended_at,ended_by) ON taptime_server.target_assignments TO taptime_admin_setup_data_function_owner;
GRANT SELECT ON taptime_server.memberships,taptime_server.work_target_location_assignments,
  taptime_server.membership_management_location_grants,taptime_server.locations
  TO taptime_admin_setup_data_function_owner;

CREATE FUNCTION taptime_server.enforce_target_assignment_history_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $history$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Assignment history is immutable' USING ERRCODE='23514'; END IF;
  IF OLD.ended_at IS NOT NULL OR NEW.ended_at IS NULL OR NEW.ended_by IS NULL
    OR (to_jsonb(NEW)-ARRAY['ended_at','ended_by']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['ended_at','ended_by'])
  THEN RAISE EXCEPTION 'Assignment can only be ended once' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $history$;
REVOKE ALL ON FUNCTION taptime_server.enforce_target_assignment_history_v1() FROM PUBLIC;
CREATE TRIGGER target_assignments_history BEFORE UPDATE OR DELETE ON taptime_server.target_assignments
  FOR EACH ROW EXECUTE FUNCTION taptime_server.enforce_target_assignment_history_v1();

-- Z1: the existing revoke authority is exactly the assignment person scope.
-- Unlike revoking access, assigning preferences may target the administrator self.
CREATE FUNCTION taptime_server.has_current_target_assignment_person_authority_v1(requested_member uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $authority$
  SELECT EXISTS (
    SELECT 1 FROM taptime_server.organizations o
    CROSS JOIN LATERAL taptime_server.has_membership_management_authority_v1(o.id,
      NULLIF(current_setting('app.user_id',true),'')::uuid,
      NULLIF(current_setting('app.membership_id',true),'')::uuid,'revoke',requested_member,NULL,NULL) scope
    WHERE o.id=NULLIF(current_setting('app.organization_id',true),'')::uuid AND o.status='active'
  )
$authority$;
ALTER FUNCTION taptime_server.has_current_target_assignment_person_authority_v1(uuid) OWNER TO taptime_time_review_read_function_owner;
REVOKE ALL ON FUNCTION taptime_server.has_current_target_assignment_person_authority_v1(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.has_current_target_assignment_person_authority_v1(uuid) TO taptime_admin_setup_data_function_owner;

-- Internal bridge: preserve the old helper's ACL and keep its single choice rule.
-- The command establishes live actor/person authority before invoking this helper.
CREATE FUNCTION taptime_server.target_assignment_is_selectable_v1(requested_member uuid,requested_type text,requested_target uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $selectable$
  SELECT taptime_server.membership_may_choose_time_target_v1(
    NULLIF(current_setting('app.organization_id',true),'')::uuid,requested_member,requested_type,requested_target)
$selectable$;
ALTER FUNCTION taptime_server.target_assignment_is_selectable_v1(uuid,text,uuid) OWNER TO taptime_mobile_read_function_owner;
REVOKE ALL ON FUNCTION taptime_server.target_assignment_is_selectable_v1(uuid,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.target_assignment_is_selectable_v1(uuid,text,uuid) TO taptime_admin_setup_data_function_owner;

CREATE FUNCTION taptime_server.has_current_target_assignment_target_authority_v1(requested_type text,requested_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $authority$
  SELECT EXISTS (
    SELECT 1 FROM taptime_server.work_targets target
    JOIN taptime_server.organizations o ON o.id=target.organization_id AND o.status='active'
    JOIN taptime_server.memberships actor ON actor.organization_id=o.id
      AND actor.id=NULLIF(current_setting('app.membership_id',true),'')::uuid
      AND actor.user_id=NULLIF(current_setting('app.user_id',true),'')::uuid AND actor.revoked_at IS NULL
    WHERE o.id=NULLIF(current_setting('app.organization_id',true),'')::uuid
      AND target.target_type=requested_type AND target.target_id=requested_id
      AND requested_type IN ('customer','project')
      AND (actor.role='administrator' OR (actor.role='standortleitung' AND o.locations_enabled AND EXISTS (
        SELECT 1 FROM taptime_server.work_target_location_assignments binding
        JOIN taptime_server.membership_management_location_grants grant_row
          ON grant_row.organization_id=binding.organization_id AND grant_row.location_id=binding.location_id
          AND grant_row.membership_id=actor.id AND grant_row.revoked_at IS NULL
        JOIN taptime_server.locations location ON location.organization_id=binding.organization_id
          AND location.id=binding.location_id AND location.active
        WHERE binding.organization_id=o.id AND binding.target_type=requested_type AND binding.target_id=requested_id
          AND binding.revoked_at IS NULL
      )))
  )
$authority$;
ALTER FUNCTION taptime_server.has_current_target_assignment_target_authority_v1(text,uuid) OWNER TO taptime_admin_setup_data_function_owner;
REVOKE ALL ON FUNCTION taptime_server.has_current_target_assignment_target_authority_v1(text,uuid) FROM PUBLIC;

CREATE FUNCTION taptime_server.change_target_assignment_v1(request jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $change$
DECLARE
  org uuid:=NULLIF(current_setting('app.organization_id',true),'')::uuid;
  actor uuid:=NULLIF(current_setting('app.membership_id',true),'')::uuid;
  member uuid; target uuid; command uuid; kind text; wanted boolean; prior jsonb;
  target_active boolean; result jsonb:=jsonb_build_object('status','succeeded');
BEGIN
  IF current_setting('role',true) IS DISTINCT FROM 'taptime_admin_setup'
  THEN RETURN jsonb_build_object('status','forbidden'); END IF;
  IF request IS NULL OR jsonb_typeof(request)<>'object'
    OR NOT (request ?& ARRAY['expectedMembershipId','commandId','membershipId','targetType','targetId','assigned'])
    OR (request-ARRAY['expectedMembershipId','commandId','membershipId','targetType','targetId','assigned'])<>'{}'::jsonb
    OR jsonb_typeof(request->'assigned') IS DISTINCT FROM 'boolean'
    OR request->>'targetType' IS NULL OR request->>'targetType' NOT IN ('customer','project')
  THEN RETURN jsonb_build_object('status','invalid_request'); END IF;
  BEGIN
    member:=(request->>'membershipId')::uuid; target:=(request->>'targetId')::uuid; command:=(request->>'commandId')::uuid;
    IF (request->>'expectedMembershipId')::uuid IS DISTINCT FROM actor
    THEN RETURN jsonb_build_object('status','forbidden'); END IF;
  EXCEPTION WHEN invalid_text_representation THEN RETURN jsonb_build_object('status','invalid_request'); END;
  IF member IS NULL OR target IS NULL OR command IS NULL
    OR command::text IS DISTINCT FROM current_setting('app.correlation_id',true)
  THEN RETURN jsonb_build_object('status','invalid_request'); END IF;
  kind:=request->>'targetType'; wanted:=(request->>'assigned')::boolean;
  -- Shares the location lifecycle lock, then serializes receipts and this pair.
  PERFORM pg_advisory_xact_lock(hashtextextended('taptime:t015e:location-setup:v1:'||org::text,0));
  IF NOT taptime_server.has_current_target_assignment_person_authority_v1(member)
  THEN RETURN jsonb_build_object('status','forbidden'); END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('target-assignment-command:'||org::text||':'||command::text,0));
  SELECT payload INTO prior FROM taptime_server.audit_events
    WHERE organization_id=org AND correlation_id=command::text AND event_type='TargetAssignmentChanged';
  IF FOUND THEN
    IF prior->'request'=request THEN RETURN prior->'result'; END IF;
    RETURN jsonb_build_object('status','command_id_conflict');
  END IF;
  SELECT active INTO target_active FROM taptime_server.work_targets
    WHERE organization_id=org AND target_type=kind AND target_id=target FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','forbidden'); END IF;
  IF wanted THEN
    IF NOT taptime_server.has_current_target_assignment_target_authority_v1(kind,target)
    THEN RETURN jsonb_build_object('status','forbidden'); END IF;
    IF NOT target_active OR NOT taptime_server.target_assignment_is_selectable_v1(member,kind,target)
    THEN RETURN jsonb_build_object('status','target_not_selectable'); END IF;
    INSERT INTO taptime_server.target_assignments(organization_id,membership_id,target_type,target_id,assigned_by)
      VALUES(org,member,kind,target,actor)
      ON CONFLICT(organization_id,membership_id,target_type,target_id) WHERE ended_at IS NULL DO NOTHING;
  ELSE
    -- Ending needs only person authority: stale/inactive/out-of-scope targets can be cleaned up.
    UPDATE taptime_server.target_assignments SET ended_at=clock_timestamp(),ended_by=actor
      WHERE organization_id=org AND membership_id=member AND target_type=kind AND target_id=target AND ended_at IS NULL;
  END IF;
  -- A no-op also needs an immutable receipt, or replay could reverse a later command.
  INSERT INTO taptime_server.audit_events(id,organization_id,actor_user_id,operator_principal,event_type,entity_type,entity_id,occurred_at,correlation_id,payload)
    VALUES(gen_random_uuid(),org,NULLIF(current_setting('app.user_id',true),'')::uuid,NULL,
      'TargetAssignmentChanged','Membership',member,clock_timestamp(),command::text,jsonb_build_object('request',request,'result',result));
  RETURN result;
END $change$;
ALTER FUNCTION taptime_server.change_target_assignment_v1(jsonb) OWNER TO taptime_admin_setup_data_function_owner;
REVOKE ALL ON FUNCTION taptime_server.change_target_assignment_v1(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.change_target_assignment_v1(jsonb) TO taptime_admin_setup;

CREATE FUNCTION taptime_server.read_target_assignments_v1(requested_member uuid,requested_type text,requested_target uuid,
  requested_search text,after_name text,after_id uuid,requested_limit integer)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $read$
DECLARE org uuid:=NULLIF(current_setting('app.organization_id',true),'')::uuid; items jsonb;
BEGIN
  IF current_setting('role',true) IS DISTINCT FROM 'taptime_admin_setup'
  THEN RETURN jsonb_build_object('status','forbidden'); END IF;
  IF requested_limit IS NULL OR requested_limit NOT BETWEEN 1 AND 51
    OR (after_name IS NULL)<>(after_id IS NULL)
    OR NOT ((requested_member IS NOT NULL AND requested_type IS NULL AND requested_target IS NULL)
      OR (requested_member IS NULL AND requested_type IN ('customer','project') AND requested_target IS NOT NULL))
    OR (requested_search IS NOT NULL AND length(requested_search) NOT BETWEEN 1 AND 80)
  THEN RAISE EXCEPTION 'Invalid assignment query' USING ERRCODE='22023'; END IF;
  IF (requested_member IS NOT NULL AND NOT taptime_server.has_current_target_assignment_person_authority_v1(requested_member))
    OR (requested_member IS NULL AND NOT taptime_server.has_current_target_assignment_target_authority_v1(requested_type,requested_target))
  THEN RETURN jsonb_build_object('status','forbidden'); END IF;
  SELECT COALESCE(jsonb_agg(page.item ORDER BY page.name COLLATE "und-x-icu",page.id),'[]'::jsonb) INTO items
  FROM (
    SELECT a.id,label.name,jsonb_build_object('assignmentId',a.id,'displayName',label.name)
      || CASE WHEN requested_member IS NOT NULL THEN jsonb_build_object('targetType',a.target_type,'targetId',a.target_id)
        ELSE jsonb_build_object('membershipId',a.membership_id) END item
    FROM taptime_server.target_assignments a
    JOIN taptime_server.memberships person ON person.organization_id=a.organization_id AND person.id=a.membership_id AND person.revoked_at IS NULL
    JOIN taptime_server.work_targets target ON target.organization_id=a.organization_id
      AND target.target_type=a.target_type AND target.target_id=a.target_id AND target.active
    CROSS JOIN LATERAL (SELECT CASE WHEN requested_member IS NOT NULL THEN target.display_name
      ELSE COALESCE(person.display_name,CASE person.role WHEN 'administrator' THEN 'Administrator' WHEN 'standortleitung' THEN 'Standortleitung' ELSE 'Mitarbeiter' END) END name) label
    WHERE a.organization_id=org AND a.ended_at IS NULL
      AND (requested_member IS NULL OR a.membership_id=requested_member)
      AND (requested_member IS NOT NULL OR (a.target_type=requested_type AND a.target_id=requested_target))
      AND taptime_server.has_current_target_assignment_person_authority_v1(a.membership_id)
      AND taptime_server.has_current_target_assignment_target_authority_v1(a.target_type,a.target_id)
      AND (requested_search IS NULL OR strpos(lower(label.name COLLATE "und-x-icu"),lower(requested_search COLLATE "und-x-icu"))>0)
      AND (after_id IS NULL OR (label.name COLLATE "und-x-icu",a.id)>(after_name COLLATE "und-x-icu",after_id))
    ORDER BY label.name COLLATE "und-x-icu",a.id LIMIT requested_limit
  ) page;
  RETURN jsonb_build_object('items',items);
END $read$;
ALTER FUNCTION taptime_server.read_target_assignments_v1(uuid,text,uuid,text,text,uuid,integer) OWNER TO taptime_admin_setup_data_function_owner;
REVOKE ALL ON FUNCTION taptime_server.read_target_assignments_v1(uuid,text,uuid,text,text,uuid,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.read_target_assignments_v1(uuid,text,uuid,text,text,uuid,integer) TO taptime_admin_setup;

-- Original visibility and authority predicates from 056, with a preference-only filter.
CREATE FUNCTION taptime_server.read_mobile_work_targets_v3(requested_organization_id uuid, requested_user_id uuid, requested_membership_id uuid, requested_after_type_rank integer, requested_after_display_name text, requested_after_target_id uuid, requested_limit integer, requested_search text, requested_target_type text, requested_assigned_only boolean)
 RETURNS TABLE(target_type text, target_id uuid, display_name text, row_version bigint, assigned boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
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

  IF requested_assigned_only IS NULL OR requested_limit IS NULL OR requested_limit NOT BETWEEN 1 AND 51
    OR (requested_after_display_name IS NULL) <> (requested_after_target_id IS NULL)
  THEN RAISE EXCEPTION 'Invalid search page' USING ERRCODE='22023'; END IF;
  IF requested_search IS NOT NULL THEN
    -- The TS boundary canonicalizes NFC/Unicode trim with normalizeTapTimeNameV1.
    -- Keep the predecessor's capabilities; no additional helper grants are needed.
    IF length(requested_search) NOT BETWEEN 1 AND 80 THEN RAISE EXCEPTION 'Invalid search' USING ERRCODE='22023'; END IF;
  END IF;
  IF requested_target_type IS NOT NULL AND requested_target_type NOT IN ('customer','project','general_work') THEN
    RAISE EXCEPTION 'Invalid target type' USING ERRCODE='22023';
  END IF;

  RETURN QUERY
  SELECT target.target_type, target.target_id, target.display_name, target.row_version, preference.assigned
  FROM taptime_server.work_targets AS target
  CROSS JOIN LATERAL (SELECT EXISTS (
    SELECT 1 FROM taptime_server.target_assignments a
    WHERE a.organization_id=target.organization_id AND a.membership_id=requested_membership_id
      AND a.target_type=target.target_type AND a.target_id=target.target_id AND a.ended_at IS NULL
  ) AS assigned) preference
  WHERE target.organization_id = requested_organization_id
    AND target.active
    AND (NOT requested_assigned_only OR preference.assigned)
    AND (requested_search IS NULL OR strpos(lower(target.display_name COLLATE "und-x-icu"),lower(requested_search COLLATE "und-x-icu"))>0)
    AND (requested_target_type IS NULL OR target.target_type=requested_target_type)
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
        target.display_name COLLATE "und-x-icu",
        target.target_id
      ) > (
        requested_after_type_rank,
        requested_after_display_name COLLATE "und-x-icu",
        requested_after_target_id
      )
    )
  ORDER BY
    CASE target.target_type WHEN 'customer' THEN 1 WHEN 'project' THEN 2 ELSE 3 END,
    target.display_name COLLATE "und-x-icu",
    target.target_id
  LIMIT requested_limit;
END
$function$;
ALTER FUNCTION taptime_server.read_mobile_work_targets_v3(uuid,uuid,uuid,integer,text,uuid,integer,text,text,boolean) OWNER TO taptime_mobile_read_function_owner;
REVOKE ALL ON FUNCTION taptime_server.read_mobile_work_targets_v3(uuid,uuid,uuid,integer,text,uuid,integer,text,text,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.read_mobile_work_targets_v3(uuid,uuid,uuid,integer,text,uuid,integer,text,text,boolean) TO taptime_mobile_target_reader;



CREATE FUNCTION taptime_server.read_time_backfill_targets_v3(
  requested_organization_id uuid, requested_actor_user_id uuid, requested_membership_id uuid,
  requested_target_membership_id uuid, requested_after_type_rank integer, requested_after_display_name text, requested_after_id uuid,
  requested_limit integer, requested_search text, requested_assigned_only boolean
)
RETURNS TABLE(target_type text,target_id uuid,display_name text,assigned boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog
AS $backfill_targets$
DECLARE target_user uuid;
BEGIN
  SELECT person.user_id INTO target_user FROM taptime_server.memberships AS person
    WHERE person.organization_id=requested_organization_id AND person.id=requested_target_membership_id;
  IF current_setting('role',true) IS DISTINCT FROM 'taptime_time_review_reader'
    OR target_user IS NULL OR requested_limit IS NULL OR requested_limit NOT BETWEEN 1 AND 51
    OR (requested_after_type_rank IS NULL) <> (requested_after_id IS NULL)
    OR (requested_after_type_rank IS NOT NULL AND requested_after_type_rank NOT BETWEEN 1 AND 3)
    OR NOT EXISTS (SELECT 1 FROM taptime_server.has_time_management_authority_v1(
      requested_organization_id,requested_actor_user_id,requested_membership_id,target_user
    )) THEN RAISE EXCEPTION 'Time target capability rejected' USING ERRCODE='42501'; END IF;
  IF requested_assigned_only IS NULL OR requested_limit IS NULL OR requested_limit NOT BETWEEN 1 AND 51
    OR (requested_after_display_name IS NULL) <> (requested_after_id IS NULL)
  THEN RAISE EXCEPTION 'Invalid search page' USING ERRCODE='22023'; END IF;
  IF requested_search IS NOT NULL THEN
    -- The TS boundary canonicalizes NFC/Unicode trim with normalizeTapTimeNameV1.
    -- Keep the predecessor's capabilities; no additional helper grants are needed.
    IF length(requested_search) NOT BETWEEN 1 AND 80 THEN RAISE EXCEPTION 'Invalid search' USING ERRCODE='22023'; END IF;
  END IF;
  RETURN QUERY
    SELECT target.target_type,target.target_id,target.display_name,preference.assigned
    FROM taptime_server.work_targets AS target
    CROSS JOIN LATERAL (SELECT EXISTS (
      SELECT 1 FROM taptime_server.target_assignments a
      JOIN taptime_server.memberships person ON person.organization_id=a.organization_id
        AND person.id=a.membership_id AND person.revoked_at IS NULL
      WHERE a.organization_id=target.organization_id AND a.membership_id=requested_target_membership_id
        AND a.target_type=target.target_type AND a.target_id=target.target_id AND a.ended_at IS NULL
    ) AS assigned) preference
    WHERE target.organization_id=requested_organization_id
      AND (NOT requested_assigned_only OR preference.assigned)
      AND taptime_server.membership_may_choose_time_target_v1(
        requested_organization_id,requested_target_membership_id,target.target_type,target.target_id
      )
      AND (requested_search IS NULL OR strpos(lower(target.display_name COLLATE "und-x-icu"),lower(requested_search COLLATE "und-x-icu"))>0)
      AND (requested_after_type_rank IS NULL OR
        (CASE target.target_type WHEN 'customer' THEN 1 WHEN 'project' THEN 2 ELSE 3 END,target.display_name COLLATE "und-x-icu",target.target_id)
        > (requested_after_type_rank,requested_after_display_name COLLATE "und-x-icu",requested_after_id))
    ORDER BY CASE target.target_type WHEN 'customer' THEN 1 WHEN 'project' THEN 2 ELSE 3 END,target.display_name COLLATE "und-x-icu",target.target_id LIMIT requested_limit;
END
$backfill_targets$;
ALTER FUNCTION taptime_server.read_time_backfill_targets_v3(uuid,uuid,uuid,uuid,integer,text,uuid,integer,text,boolean) OWNER TO taptime_time_review_read_function_owner;
REVOKE ALL ON FUNCTION taptime_server.read_time_backfill_targets_v3(uuid,uuid,uuid,uuid,integer,text,uuid,integer,text,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.read_time_backfill_targets_v3(uuid,uuid,uuid,uuid,integer,text,uuid,integer,text,boolean) TO taptime_time_review_reader;

-- Same month, scope, seconds and quota rules as read_customer_hours_v3; filter before LIMIT.
CREATE FUNCTION taptime_server.read_customer_quota_alerts_v1(from_inclusive timestamptz,to_exclusive timestamptz,after_display_name text,after_id uuid,requested_limit integer)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog
AS $function$
<<reader>>
DECLARE
  org uuid := NULLIF(current_setting('app.organization_id',true),'')::uuid;
  actor_id uuid := NULLIF(current_setting('app.membership_id',true),'')::uuid;
  actor_user uuid := NULLIF(current_setting('app.user_id',true),'')::uuid;
  actor_role text;
  locations_enabled boolean;
  result jsonb;
BEGIN
  -- No requested role, person, location or tenant. The live membership is authoritative,
  -- including when the session's role hint is stale or forged.
  SELECT member.role,organization.locations_enabled INTO actor_role,locations_enabled
    FROM taptime_server.memberships member
    JOIN taptime_server.organizations organization ON organization.id=member.organization_id AND organization.status='active'
    WHERE member.organization_id=org AND member.id=actor_id AND member.user_id=actor_user AND member.revoked_at IS NULL;
  IF current_setting('role',true) IS DISTINCT FROM 'taptime_mobile_own_time_reader'
    OR actor_role IS NULL OR actor_role NOT IN ('administrator','standortleitung','employee')
  THEN RAISE EXCEPTION 'Customer read capability rejected' USING ERRCODE='42501'; END IF;
  IF from_inclusive IS NULL OR to_exclusive IS NULL OR to_exclusive<=from_inclusive
    OR to_exclusive-from_inclusive>taptime_server.maximum_calendar_month_range()
    OR from_inclusive IS DISTINCT FROM (date_trunc('month',from_inclusive AT TIME ZONE 'Europe/Berlin') AT TIME ZONE 'Europe/Berlin')
    OR to_exclusive IS DISTINCT FROM ((from_inclusive AT TIME ZONE 'Europe/Berlin'+interval '1 month') AT TIME ZONE 'Europe/Berlin')
  THEN RAISE EXCEPTION 'Invalid calendar month' USING ERRCODE='22023'; END IF;

  IF requested_limit IS NULL OR requested_limit NOT BETWEEN 1 AND 51
    OR (after_display_name IS NULL) <> (after_id IS NULL)
  THEN RAISE EXCEPTION 'Invalid search page' USING ERRCODE='22023'; END IF;
  WITH visible_customers AS MATERIALIZED (
    SELECT customer.id,customer.display_name,customer.active
    FROM taptime_server.customers customer
    -- D-099: choose the latest binding before checking today's manager grants.
    -- Historical entry locations never determine this scope. The ID breaks time ties.
    LEFT JOIN LATERAL (
      SELECT binding.location_id
      FROM taptime_server.work_target_location_assignments binding
      WHERE binding.organization_id=org AND binding.target_type='customer' AND binding.target_id=customer.id
      ORDER BY binding.assigned_at DESC,binding.id DESC
      LIMIT 1
    ) last_binding ON NOT customer.active
    WHERE customer.organization_id=org AND (
      actor_role='administrator'
      OR (customer.active AND (
        (actor_role='employee' AND NOT locations_enabled)
        OR (locations_enabled AND EXISTS (
          SELECT 1 FROM taptime_server.work_target_location_assignments binding
          JOIN taptime_server.locations location ON location.organization_id=binding.organization_id AND location.id=binding.location_id AND location.active
          WHERE binding.organization_id=org AND binding.target_type='customer' AND binding.target_id=customer.id AND binding.revoked_at IS NULL
            AND ((actor_role='standortleitung' AND EXISTS (
              SELECT 1 FROM taptime_server.membership_management_location_grants grant_row
              WHERE grant_row.organization_id=org AND grant_row.membership_id=actor_id
                AND grant_row.location_id=binding.location_id AND grant_row.revoked_at IS NULL
            )) OR (actor_role='employee' AND EXISTS (
              SELECT 1 FROM taptime_server.membership_home_location_assignments home
              WHERE home.organization_id=org AND home.membership_id=actor_id
                AND home.location_id=binding.location_id AND home.revoked_at IS NULL
            )))
        ))
      ))
      -- Own historical hours survive deactivation even without a location binding.
      -- visible_records restricts employees to their own records; totals hides empty customers.
      OR (NOT customer.active AND (
        actor_role='employee'
        OR (actor_role='standortleitung' AND locations_enabled AND last_binding.location_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM taptime_server.membership_management_location_grants grant_row
          WHERE grant_row.organization_id=org AND grant_row.membership_id=actor_id
            AND grant_row.location_id=last_binding.location_id AND grant_row.revoked_at IS NULL
        ))
      ))
    )
  ), visible_records AS MATERIALIZED (
    SELECT record.*,duration.work_seconds
    FROM taptime_server.effective_time_records_v2 record
    JOIN visible_customers customer ON customer.id=record.target_id
    CROSS JOIN LATERAL taptime_server.time_record_duration_v1(record.organization_id,
      record.canonical_time_entry_id,record.effective_started_at,record.effective_stopped_at) duration
    WHERE record.organization_id=org AND record.target_type='customer'
      AND record.effective_started_at>=from_inclusive AND record.effective_started_at<to_exclusive
      AND (actor_role IN ('administrator','standortleitung') OR record.user_id=actor_user)
  )
  SELECT COALESCE(jsonb_agg(item.value ORDER BY item.display_name COLLATE "und-x-icu",item.id),'[]'::jsonb) INTO result
  FROM (
    SELECT customer.id,customer.display_name,
      jsonb_build_object('customerId',customer.id,'displayName',customer.display_name,'active',customer.active,
        'workDurationSeconds',totals.seconds,'running',totals.running)
      || CASE WHEN actor_role='employee' THEN '{}'::jsonb ELSE jsonb_build_object(
        'quotaSeconds',quota.minutes*60,
        'quotaStage',CASE WHEN quota.minutes IS NULL THEN 'none'
          WHEN totals.seconds>=quota.minutes*60 THEN 'exceeded'
          WHEN totals.seconds*10>=quota.minutes::bigint*60*9 THEN 'warning' ELSE 'ok' END) END AS value
    FROM visible_customers customer
    CROSS JOIN LATERAL (SELECT COALESCE(sum(record.work_seconds),0)::bigint AS seconds,
      COALESCE(bool_or(record.effective_stopped_at IS NULL),false) AS running
      FROM visible_records record WHERE record.target_id=customer.id) totals
    LEFT JOIN LATERAL (
      SELECT setting.minutes FROM taptime_server.customer_quota_settings setting
      WHERE reader.actor_role<>'employee' AND setting.organization_id=org
        AND setting.customer_id=customer.id AND setting.set_at<to_exclusive
      ORDER BY setting.set_at DESC,setting.sequence DESC LIMIT 1
    ) quota ON true
    WHERE (customer.active OR totals.seconds>0 OR totals.running)
      AND actor_role<>'employee' AND quota.minutes IS NOT NULL AND totals.seconds*10>=quota.minutes::bigint*60*9
      AND (after_id IS NULL OR (customer.display_name COLLATE "und-x-icu",customer.id)>(after_display_name COLLATE "und-x-icu",after_id))
    ORDER BY customer.display_name COLLATE "und-x-icu",customer.id LIMIT requested_limit
  ) item;
  RETURN jsonb_build_object('version','customer-quota-alerts.v1','scope',CASE WHEN actor_role='employee' THEN 'self' ELSE 'people' END,
    'asOf',to_char(transaction_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'customers',result);
END
$function$;

ALTER FUNCTION taptime_server.read_customer_quota_alerts_v1(timestamptz,timestamptz,text,uuid,integer) OWNER TO taptime_time_review_read_function_owner;
REVOKE ALL ON FUNCTION taptime_server.read_customer_quota_alerts_v1(timestamptz,timestamptz,text,uuid,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.read_customer_quota_alerts_v1(timestamptz,timestamptz,text,uuid,integer) TO taptime_mobile_own_time_reader;



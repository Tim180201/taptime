-- T-092 / D-101, D-115. No new tables or roles. Migration owns creation/replacement/removal
-- of these capabilities; retained membership/assignment history supplies the departure projection.
CREATE FUNCTION taptime_server.departure_is_visible_v1(departure timestamptz, as_at timestamptz DEFAULT transaction_timestamp())
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $visible$
 SELECT departure IS NOT NULL AND departure >= ((date_trunc('month',as_at AT TIME ZONE 'Europe/Berlin') - interval '1 month') AT TIME ZONE 'Europe/Berlin')
   AND departure <= as_at
$visible$;
REVOKE ALL ON FUNCTION taptime_server.departure_is_visible_v1(timestamptz,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.departure_is_visible_v1(timestamptz,timestamptz)
 TO taptime_membership_management_function_owner,taptime_mobile_read_function_owner,taptime_time_review_read_function_owner,taptime_time_review_write_function_owner;

CREATE FUNCTION taptime_server.membership_management_home_v1(org uuid, member uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $home$
 SELECT home.location_id FROM taptime_server.memberships person
 JOIN taptime_server.membership_home_location_assignments home ON home.organization_id=person.organization_id AND home.membership_id=person.id
 WHERE person.organization_id=org AND person.id=member
   AND ((person.revoked_at IS NULL AND home.revoked_at IS NULL) OR
        (person.revoked_at IS NOT NULL AND home.assigned_at<=person.revoked_at))
 ORDER BY home.assigned_at DESC,home.id DESC LIMIT 1
$home$;
ALTER FUNCTION taptime_server.membership_management_home_v1(uuid,uuid) OWNER TO taptime_membership_management_function_owner;
REVOKE ALL ON FUNCTION taptime_server.membership_management_home_v1(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.membership_management_home_v1(uuid,uuid)
 TO taptime_time_review_read_function_owner,taptime_time_review_write_function_owner,taptime_mobile_read_function_owner;


CREATE OR REPLACE FUNCTION taptime_server.revoke_membership_location_relations_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $membership_lifecycle$
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'taptime:t015e:location-setup:v1:' || NEW.organization_id::text,
    0
  ));
  IF OLD.revoked_at IS NULL AND NEW.revoked_at IS NOT NULL THEN
    UPDATE taptime_server.membership_home_location_assignments
    SET revoked_at = NEW.revoked_at
    WHERE organization_id = NEW.organization_id
      AND membership_id = NEW.id
      AND revoked_at IS NULL;
    UPDATE taptime_server.membership_work_location_grants
    SET revoked_at = NEW.revoked_at
    WHERE organization_id = NEW.organization_id
      AND membership_id = NEW.id
      AND revoked_at IS NULL;
    UPDATE taptime_server.membership_management_location_grants
    SET revoked_at = NEW.revoked_at
    WHERE organization_id = NEW.organization_id
      AND membership_id = NEW.id
      AND revoked_at IS NULL;
  ELSIF OLD.role = 'standortleitung' AND NEW.role <> 'standortleitung' THEN
    UPDATE taptime_server.membership_management_location_grants
    SET revoked_at = pg_catalog.transaction_timestamp()
    WHERE organization_id = NEW.organization_id
      AND membership_id = NEW.id
      AND revoked_at IS NULL;
  END IF;
  RETURN NEW;
END
$membership_lifecycle$;

GRANT SELECT ON taptime_server.time_entries,taptime_server.administration_stop_commands TO taptime_membership_management_function_owner;
CREATE OR REPLACE FUNCTION taptime_server.manage_membership_v1(
  requested_command_id uuid,
  requested_target_membership_id uuid,
  requested_expected_row_version bigint,
  requested_command_type text,
  requested_membership_role text
)
RETURNS TABLE (
  result_status text,
  result_role text,
  result_active boolean,
  result_row_version bigint,
  result_idempotent_retry boolean
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, taptime_server
AS $manage$
DECLARE
  context_organization_id uuid := NULLIF(pg_catalog.current_setting('app.organization_id', true), '')::uuid;
  context_user_id uuid := NULLIF(pg_catalog.current_setting('app.user_id', true), '')::uuid;
  context_membership_id uuid := NULLIF(pg_catalog.current_setting('app.membership_id', true), '')::uuid;
  target taptime_server.memberships%ROWTYPE;
  receipt taptime_server.membership_management_command_receipts%ROWTYPE;
  administrator_count integer;
BEGIN
  IF pg_catalog.current_setting('role', true) <> 'taptime_membership_manager'
    OR requested_command_id IS NULL
    OR requested_target_membership_id IS NULL
    OR requested_expected_row_version IS NULL OR requested_expected_row_version < 1
    OR requested_command_type NOT IN ('revoke', 'change_role')
    OR (requested_command_type = 'revoke' AND requested_membership_role IS NOT NULL)
    OR (requested_command_type = 'change_role'
      AND requested_membership_role NOT IN ('administrator', 'standortleitung', 'employee'))
    OR NULLIF(pg_catalog.current_setting('app.correlation_id', true), '')
       <> requested_command_id::text
  THEN
    RETURN QUERY SELECT 'invalid_request', NULL::text, NULL::boolean,
      NULL::bigint, false;
    RETURN;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'taptime:t009:membership-command:' || context_organization_id::text
      || ':' || requested_command_id::text, 0
  ));
  SELECT stored.* INTO receipt
  FROM taptime_server.membership_management_command_receipts AS stored
  WHERE stored.organization_id = context_organization_id
    AND stored.command_id = requested_command_id;
  IF FOUND THEN
    IF receipt.actor_user_id = context_user_id
      AND receipt.actor_membership_id = context_membership_id
      AND receipt.target_membership_id = requested_target_membership_id
      AND receipt.command_type = requested_command_type
      AND receipt.requested_role IS NOT DISTINCT FROM requested_membership_role
      AND receipt.expected_row_version = requested_expected_row_version
    THEN
      RETURN QUERY SELECT 'succeeded', receipt.result_role,
        receipt.result_revoked_at IS NULL, receipt.result_row_version, true;
    ELSE
      RETURN QUERY SELECT 'command_id_conflict', NULL::text, NULL::boolean,
        NULL::bigint, false;
    END IF;
    RETURN;
  END IF;

  SELECT membership.* INTO target
  FROM taptime_server.memberships AS membership
  WHERE membership.organization_id = context_organization_id
    AND membership.id = requested_target_membership_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'target_unavailable', NULL::text, NULL::boolean,
      NULL::bigint, false;
    RETURN;
  END IF;
  IF requested_command_type = 'revoke'
    AND target.id = context_membership_id
  THEN
    RETURN QUERY SELECT 'self_revocation_forbidden', NULL::text, NULL::boolean,
      NULL::bigint, false;
    RETURN;
  END IF;
  IF target.revoked_at IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM taptime_server.has_membership_management_authority_v1(
      context_organization_id,context_user_id,context_membership_id,'read',NULL,NULL,NULL) scope
      WHERE scope.scope_kind='organization' OR (requested_command_type='revoke' AND target.role='employee'
        AND scope.scope_kind='location' AND scope.location_id=taptime_server.membership_management_home_v1(context_organization_id,target.id))) THEN
      RETURN QUERY SELECT 'already_departed',NULL::text,NULL::boolean,NULL::bigint,false;
    ELSE
      RETURN QUERY SELECT 'forbidden',NULL::text,NULL::boolean,NULL::bigint,false;
    END IF;
    RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM taptime_server.has_membership_management_authority_v1(
      context_organization_id, context_user_id, context_membership_id,
      requested_command_type, requested_target_membership_id,
      requested_membership_role, NULL
    )
  ) THEN
    RETURN QUERY SELECT 'forbidden', NULL::text, NULL::boolean,
      NULL::bigint, false;
    RETURN;
  END IF;
  IF target.row_version <> requested_expected_row_version THEN
    RETURN QUERY SELECT 'stale_row_version', NULL::text, NULL::boolean,
      NULL::bigint, false;
    RETURN;
  END IF;
  IF requested_command_type = 'change_role'
    AND target.role = requested_membership_role
  THEN
    RETURN QUERY SELECT 'invalid_request', NULL::text, NULL::boolean,
      NULL::bigint, false;
    RETURN;
  END IF;

  IF target.role = 'administrator'
    AND (
      requested_command_type = 'revoke'
      OR (
        requested_command_type = 'change_role'
        AND requested_membership_role <> 'administrator'
      )
    )
  THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
      'taptime:t009:last-administrator:' || context_organization_id::text, 0
    ));
    SELECT pg_catalog.count(*)::integer INTO administrator_count
    FROM taptime_server.memberships AS membership
    WHERE membership.organization_id = context_organization_id
      AND membership.role = 'administrator'
      AND membership.revoked_at IS NULL;
    IF administrator_count <= 1 THEN
      RETURN QUERY SELECT 'last_administrator', NULL::text, NULL::boolean,
        NULL::bigint, false;
      RETURN;
    END IF;
  END IF;

  IF requested_command_type = 'revoke' THEN
    -- The identity resolver locks membership before the lifecycle person lock. Keep that order.
    PERFORM pg_advisory_xact_lock(hashtextextended(context_organization_id::text||chr(31)||target.user_id::text,0));
    IF EXISTS (SELECT 1 FROM taptime_server.time_entries e WHERE e.organization_id=context_organization_id
      AND e.user_id=target.user_id AND e.status='started') THEN
      RETURN QUERY SELECT 'running_time_active',NULL::text,NULL::boolean,NULL::bigint,false;
      RETURN;
    END IF;
    UPDATE taptime_server.memberships
    SET revoked_at = COALESCE((SELECT stop.stopped_at FROM taptime_server.administration_stop_commands stop
      WHERE stop.organization_id=context_organization_id AND stop.command_id=requested_command_id
        AND stop.actor_membership_id=context_membership_id AND stop.user_id=target.user_id
        AND stop.request_payload->>'revocationExpectedRowVersion'=requested_expected_row_version::text), clock_timestamp()), row_version = row_version + 1
    WHERE organization_id = context_organization_id AND id = target.id
    RETURNING * INTO target;
  ELSIF target.role <> requested_membership_role THEN
    UPDATE taptime_server.memberships
    SET role = requested_membership_role, row_version = row_version + 1
    WHERE organization_id = context_organization_id AND id = target.id
    RETURNING * INTO target;
  END IF;

  INSERT INTO taptime_server.membership_management_command_receipts (
    organization_id, command_id, actor_user_id, actor_membership_id,
    target_membership_id, command_type, requested_role, expected_row_version,
    result_role, result_revoked_at, result_row_version
  ) VALUES (
    context_organization_id, requested_command_id, context_user_id,
    context_membership_id, target.id, requested_command_type,
    requested_membership_role, requested_expected_row_version,
    target.role, target.revoked_at, target.row_version
  );
  RETURN QUERY SELECT 'succeeded', target.role, target.revoked_at IS NULL,
    target.row_version, false;
END
$manage$;

CREATE OR REPLACE FUNCTION taptime_server.prepare_administration_stop_v1(request jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog
AS $prepare$
DECLARE
  org uuid := nullif(current_setting('app.organization_id',true),'')::uuid;
  actor_user uuid := nullif(current_setting('app.user_id',true),'')::uuid;
  actor_member uuid := nullif(current_setting('app.membership_id',true),'')::uuid;
  target_user uuid;
  entry taptime_server.time_entries%ROWTYPE;
  pause taptime_server.break_intervals%ROWTYPE;
  receipt taptime_server.administration_stop_commands%ROWTYPE;
  command uuid := (request->>'commandId')::uuid;
  end_at timestamptz := (request->>'stoppedAt')::timestamptz;
  last_break_at timestamptz;
BEGIN
  IF current_setting('role',true) NOT IN ('taptime_time_review_writer','taptime_membership_manager')
    OR actor_member IS DISTINCT FROM (request->>'expectedMembershipId')::uuid
    OR NOT EXISTS (SELECT 1 FROM taptime_server.has_time_management_authority_v1(org,actor_user,actor_member,NULL)) THEN
    RETURN jsonb_build_object('status','authority_rejected');
  END IF;
  IF current_setting('role',true)='taptime_membership_manager' AND (
    request->>'reason' IS DISTINCT FROM 'Zugang entzogen'
    OR NOT EXISTS (SELECT 1 FROM taptime_server.has_membership_management_authority_v1(
      org,actor_user,actor_member,'revoke',(request->>'targetMembershipId')::uuid,NULL,NULL))
    OR NOT EXISTS (SELECT 1 FROM taptime_server.memberships m WHERE m.organization_id=org
      AND m.id=(request->>'targetMembershipId')::uuid AND m.row_version=(request->>'revocationExpectedRowVersion')::bigint)
  ) THEN RETURN jsonb_build_object('status','authority_rejected'); END IF;
  SELECT m.user_id INTO target_user FROM taptime_server.memberships m
    WHERE m.organization_id=org AND m.id=(request->>'targetMembershipId')::uuid;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','authority_rejected'); END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(org::text||chr(31)||target_user::text,0));
  PERFORM pg_advisory_xact_lock(hashtextextended(org::text||chr(30)||command::text,0));
  IF NOT EXISTS (SELECT 1 FROM taptime_server.has_time_management_authority_v1(org,actor_user,actor_member,target_user)) THEN
    RETURN jsonb_build_object('status','authority_rejected');
  END IF;
  SELECT * INTO receipt FROM taptime_server.administration_stop_commands r WHERE r.organization_id=org AND r.command_id=command;
  IF FOUND THEN
    IF receipt.actor_membership_id=actor_member AND receipt.request_payload=request THEN
      RETURN jsonb_build_object('status','committed','timeRecordId',receipt.time_entry_id,'idempotentRetry',true);
    END IF;
    RETURN jsonb_build_object('status','command_id_conflict');
  END IF;
  IF EXISTS (SELECT 1 FROM taptime_server.time_review_command_receipts r WHERE r.organization_id=org AND r.command_id=command)
    OR EXISTS (SELECT 1 FROM taptime_server.time_supplement_command_receipts r WHERE r.organization_id=org AND r.command_id=command) THEN
    RETURN jsonb_build_object('status','command_id_conflict');
  END IF;
  SELECT * INTO entry FROM taptime_server.time_entries e WHERE e.organization_id=org AND e.user_id=target_user
    AND e.id=(request->>'timeRecordId')::uuid FOR UPDATE;
  IF NOT FOUND OR entry.status<>'started' OR entry.row_version IS DISTINCT FROM (request->>'expectedRowVersion')::bigint THEN
    RETURN jsonb_build_object('status','conflict');
  END IF;
  IF command IS NULL OR end_at IS NULL OR NOT isfinite(end_at) OR end_at<=entry.started_at
    OR end_at>clock_timestamp() OR end_at>entry.started_at+interval '24 hours' THEN
    RETURN jsonb_build_object('status','invalid_interval');
  END IF;
  IF request->>'reason' IS NULL OR char_length(btrim(request->>'reason')) NOT BETWEEN 1 AND 500 THEN
    RETURN jsonb_build_object('status','reason_required');
  END IF;
  SELECT max(coalesce(b.stopped_at,b.started_at)) INTO last_break_at FROM taptime_server.break_intervals b
    WHERE b.organization_id=org AND b.time_entry_id=entry.id;
  IF end_at<last_break_at THEN RETURN jsonb_build_object('status','end_before_break'); END IF;
  SELECT * INTO pause FROM taptime_server.break_intervals b WHERE b.organization_id=org AND b.time_entry_id=entry.id AND b.status='started' FOR UPDATE;
  RETURN jsonb_build_object('status','ready',
    'activeTimeEntry',jsonb_build_object('id',entry.id,'workEventId',entry.start_work_event_id,
      'organizationId',org,'userId',target_user,'target',jsonb_build_object('targetType',entry.target_type,'targetId',entry.target_customer_id),
      'status','started','startedAt',to_char(entry.started_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'startedVia',entry.started_via),
    'activeBreakInterval',CASE WHEN pause.id IS NULL THEN NULL ELSE jsonb_build_object('id',pause.id,
      'organizationId',org,'userId',target_user,'timeEntryId',entry.id,'status','started',
      'startedAt',to_char(pause.started_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'startedByWorkEventId',pause.start_work_event_id,'startedVia',pause.started_via) END);
END
$prepare$;

GRANT EXECUTE ON FUNCTION taptime_server.has_membership_management_authority_v1(uuid,uuid,uuid,text,uuid,text,uuid)
 TO taptime_time_review_write_function_owner;
GRANT EXECUTE ON FUNCTION taptime_server.prepare_administration_stop_v1(jsonb)
 TO taptime_membership_management_function_owner;
GRANT EXECUTE ON FUNCTION taptime_server.commit_administration_stop_v1(jsonb,jsonb,jsonb)
 TO taptime_membership_manager;

CREATE FUNCTION taptime_server.prepare_membership_revocation_stop_v1(command uuid, member uuid, expected_version bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $prepare$
DECLARE
 org uuid:=nullif(current_setting('app.organization_id',true),'')::uuid;
 actor uuid:=nullif(current_setting('app.membership_id',true),'')::uuid;
 actor_user uuid:=nullif(current_setting('app.user_id',true),'')::uuid;
 person taptime_server.memberships%ROWTYPE;
 entry taptime_server.time_entries%ROWTYPE;
 end_at timestamptz;
 request jsonb;
 context jsonb;
BEGIN
 IF current_setting('role',true) IS DISTINCT FROM 'taptime_membership_manager'
   OR command IS NULL OR command::text IS DISTINCT FROM current_setting('app.correlation_id',true)
   OR member=actor THEN RETURN jsonb_build_object('status','forbidden'); END IF;
 SELECT * INTO person FROM taptime_server.memberships m WHERE m.organization_id=org AND m.id=member FOR UPDATE;
 IF NOT FOUND OR person.revoked_at IS NOT NULL OR person.row_version IS DISTINCT FROM expected_version
   OR NOT EXISTS(SELECT 1 FROM taptime_server.has_membership_management_authority_v1(org,actor_user,actor,'revoke',member,NULL,NULL))
   THEN RETURN jsonb_build_object('status','stale_row_version'); END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(org::text||chr(31)||person.user_id::text,0));
 SELECT * INTO entry FROM taptime_server.time_entries e WHERE e.organization_id=org AND e.user_id=person.user_id AND e.status='started';
 IF NOT FOUND THEN RETURN jsonb_build_object('status','running_time_active'); END IF;
 end_at:=date_trunc('milliseconds',clock_timestamp());
 IF end_at>entry.started_at+interval '24 hours' THEN RETURN jsonb_build_object('status','running_time_too_long'); END IF;
 IF end_at<=entry.started_at THEN RETURN jsonb_build_object('status','running_time_active'); END IF;
 request:=jsonb_build_object('expectedMembershipId',actor,'targetMembershipId',member,'commandId',command,
   'timeRecordId',entry.id,'expectedRowVersion',entry.row_version,'stoppedAt',to_char(end_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
   'reason','Zugang entzogen','revocationExpectedRowVersion',expected_version);
 context:=taptime_server.prepare_administration_stop_v1(request);
 IF context->>'status'<>'ready' THEN RETURN jsonb_build_object('status','running_time_active'); END IF;
 RETURN context||jsonb_build_object('request',request);
END
$prepare$;
ALTER FUNCTION taptime_server.prepare_membership_revocation_stop_v1(uuid,uuid,bigint) OWNER TO taptime_membership_management_function_owner;
REVOKE ALL ON FUNCTION taptime_server.prepare_membership_revocation_stop_v1(uuid,uuid,bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.prepare_membership_revocation_stop_v1(uuid,uuid,bigint) TO taptime_membership_manager;

CREATE FUNCTION taptime_server.membership_revocation_stop_request_v1(command uuid, member uuid, expected_version bigint)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $request$
 SELECT stop.request_payload FROM taptime_server.administration_stop_commands stop
 JOIN taptime_server.membership_management_command_receipts receipt ON receipt.organization_id=stop.organization_id
   AND receipt.command_id=stop.command_id AND receipt.actor_membership_id=stop.actor_membership_id
 WHERE current_setting('role',true)='taptime_membership_manager'
   AND stop.organization_id=nullif(current_setting('app.organization_id',true),'')::uuid
   AND stop.actor_membership_id=nullif(current_setting('app.membership_id',true),'')::uuid
   AND stop.actor_user_id=nullif(current_setting('app.user_id',true),'')::uuid
   AND receipt.target_membership_id=member AND receipt.expected_row_version=expected_version AND receipt.command_type='revoke'
   AND stop.command_id=command AND stop.request_payload->>'revocationExpectedRowVersion'=expected_version::text
$request$;
ALTER FUNCTION taptime_server.membership_revocation_stop_request_v1(uuid,uuid,bigint) OWNER TO taptime_membership_management_function_owner;
REVOKE ALL ON FUNCTION taptime_server.membership_revocation_stop_request_v1(uuid,uuid,bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.membership_revocation_stop_request_v1(uuid,uuid,bigint) TO taptime_membership_manager;


CREATE OR REPLACE FUNCTION taptime_server.record_administration_stop_archive_requirement_v1(request jsonb)
RETURNS TABLE(required_wal_file text, offsite_archived boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog
AS $requirement$
DECLARE
  committed record;
  current_cluster_system_identifier bigint;
  current_lsn pg_lsn;
  current_wal_file text;
BEGIN
  IF current_setting('role',true) NOT IN ('taptime_time_review_writer','taptime_membership_manager')
    OR current_setting('app.membership_role',true) NOT IN ('administrator','standortleitung') THEN
    RAISE EXCEPTION 'Administration archive requirement rejected' USING ERRCODE='42501';
  END IF;
  SELECT command.organization_id, command.work_event_id, command.receipt_id,
    command.user_id, target.id AS membership_id INTO committed
  FROM taptime_server.administration_stop_commands command
  JOIN taptime_server.work_events event ON event.organization_id=command.organization_id
    AND event.id=command.work_event_id AND event.triggered_by_user_id=command.user_id
    AND event.trigger_type='administration' AND event.subject_type='work'
  JOIN taptime_server.sync_receipts receipt ON receipt.organization_id=command.organization_id
    AND receipt.id=command.receipt_id AND receipt.user_id=command.user_id
    AND receipt.work_event_id=command.work_event_id AND receipt.attempt_number=1
    AND receipt.status='synchronized' AND receipt.server_decision_work_event_id=command.work_event_id
    AND receipt.server_time_entry_id=command.time_entry_id AND receipt.subject_type='work'
  JOIN taptime_server.memberships target ON target.organization_id=command.organization_id
    AND target.user_id=command.user_id AND target.id=(request->>'targetMembershipId')::uuid
  JOIN taptime_server.memberships actor ON actor.organization_id=command.organization_id
    AND actor.id=command.actor_membership_id AND actor.user_id=command.actor_user_id
    AND actor.role=current_setting('app.membership_role',true) AND actor.revoked_at IS NULL
    AND EXISTS (SELECT 1 FROM taptime_server.has_time_management_authority_v1(
      command.organization_id,actor.user_id,actor.id,target.user_id))
  WHERE command.organization_id=nullif(current_setting('app.organization_id',true),'')::uuid
    AND command.actor_user_id=nullif(current_setting('app.user_id',true),'')::uuid
    AND command.actor_membership_id=nullif(current_setting('app.membership_id',true),'')::uuid
    AND command.actor_membership_id=(request->>'expectedMembershipId')::uuid
    AND command.command_id=(request->>'commandId')::uuid AND command.request_payload=request;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Administration archive requirement has no exact committed command' USING ERRCODE='42501';
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
    AND requirement.receipt_id = committed.receipt_id
    AND requirement.user_id = committed.user_id
    AND requirement.membership_id = committed.membership_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lifecycle archive requirement conflicts with immutable evidence'
      USING ERRCODE = '23505';
  END IF;
END
$requirement$;

GRANT EXECUTE ON FUNCTION taptime_server.record_administration_stop_archive_requirement_v1(jsonb) TO taptime_membership_manager;

CREATE OR REPLACE FUNCTION taptime_server.has_time_management_authority_v1(
  requested_organization_id uuid,
  requested_actor_user_id uuid,
  requested_membership_id uuid,
  requested_target_user_id uuid
)
RETURNS TABLE(scope_kind text, location_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog
AS $authority$
  SELECT 'organization'::text, NULL::uuid
  WHERE taptime_server.has_current_time_review_administrator_v1(
    requested_organization_id, requested_actor_user_id, requested_membership_id
  )
  UNION ALL
  SELECT scope.scope_kind, scope.location_id
  FROM taptime_server.has_membership_management_authority_v1(
    requested_organization_id, requested_actor_user_id, requested_membership_id,
    'read', NULL, NULL, NULL
  ) AS scope
  WHERE scope.scope_kind='location' AND scope.location_id IS NOT NULL
    AND current_setting('app.membership_role',true)='standortleitung'
    AND requested_organization_id=NULLIF(current_setting('app.organization_id',true),'')::uuid
    AND requested_actor_user_id=NULLIF(current_setting('app.user_id',true),'')::uuid
    AND requested_membership_id=NULLIF(current_setting('app.membership_id',true),'')::uuid
    AND (requested_target_user_id IS NULL OR EXISTS (
      SELECT 1 FROM taptime_server.memberships AS target
      JOIN taptime_server.membership_home_location_assignments AS home
        ON home.organization_id=target.organization_id AND home.membership_id=target.id
        AND home.location_id=scope.location_id
        AND home.location_id=taptime_server.membership_management_home_v1(target.organization_id,target.id)
        AND (target.revoked_at IS NULL OR taptime_server.departure_is_visible_v1(target.revoked_at))
      WHERE target.organization_id=requested_organization_id
        AND target.user_id=requested_target_user_id
    ))
$authority$;

GRANT SELECT ON taptime_server.membership_work_location_grants TO taptime_mobile_read_function_owner;
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
      AND person.id=requested_membership_id
      AND (person.revoked_at IS NULL OR taptime_server.departure_is_visible_v1(person.revoked_at))
    JOIN taptime_server.organizations AS organization ON organization.id=target.organization_id
    WHERE target.organization_id=requested_organization_id AND target.active
      AND target.target_type=requested_target_type AND target.target_id=requested_target_id
      AND (NOT organization.locations_enabled OR target.target_type='general_work' OR EXISTS (
        SELECT 1 FROM taptime_server.work_target_location_assignments AS binding
        WHERE binding.organization_id=target.organization_id
          AND binding.target_type=target.target_type AND binding.target_id=target.target_id
          AND binding.revoked_at IS NULL
          AND ((person.revoked_at IS NULL AND taptime_server.membership_has_work_location_v1(
            requested_organization_id,requested_membership_id,binding.location_id)) OR
            (person.revoked_at IS NOT NULL AND (binding.location_id=taptime_server.membership_management_home_v1(requested_organization_id,requested_membership_id)
              OR EXISTS (SELECT 1 FROM taptime_server.membership_work_location_grants g
                WHERE g.organization_id=requested_organization_id AND g.membership_id=requested_membership_id
                  AND g.location_id=binding.location_id AND g.granted_at<=person.revoked_at
                  AND (g.revoked_at IS NULL OR g.revoked_at>=person.revoked_at)))))
      ))
  )
$target_authority$;

CREATE OR REPLACE FUNCTION taptime_server.read_managed_person_time_v1(
  target_membership_id uuid,
  from_inclusive timestamptz,
  to_exclusive timestamptz,
  after_started_at timestamptz,
  after_time_record_id uuid,
  requested_limit integer
)
RETURNS TABLE (
  row_kind text, time_record_id uuid, source text, target_type text,
  target_display_name text, status text, started_at timestamptz, stopped_at timestamptz,
  started_via text, stopped_via text, window_started_at timestamptz, window_ended_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog
AS $person$
DECLARE
  org uuid := NULLIF(current_setting('app.organization_id', true), '')::uuid;
  actor_user uuid := NULLIF(current_setting('app.user_id', true), '')::uuid;
  actor uuid := NULLIF(current_setting('app.membership_id', true), '')::uuid;
  target_user uuid;
BEGIN
  IF current_setting('role', true) IS DISTINCT FROM 'taptime_membership_manager' THEN
    row_kind := 'forbidden'; RETURN NEXT; RETURN;
  END IF;
  -- One authority, always live, including the active row and every cursor page.
  SELECT membership.user_id INTO target_user
  FROM taptime_server.memberships AS membership
  WHERE membership.organization_id = org AND membership.id = target_membership_id
    AND EXISTS (
      SELECT 1 FROM taptime_server.has_membership_management_authority_v1(
        org, actor_user, actor, 'read', NULL, NULL, NULL
      ) AS scope
      WHERE (scope.scope_kind = 'organization' AND scope.location_id IS NULL)
        OR (scope.scope_kind = 'location' AND EXISTS (
          SELECT 1 FROM taptime_server.membership_home_location_assignments AS home
          WHERE home.organization_id = membership.organization_id
            AND home.membership_id = membership.id
            AND home.location_id=taptime_server.membership_management_home_v1(org,membership.id)
            AND (membership.revoked_at IS NULL OR taptime_server.departure_is_visible_v1(membership.revoked_at))
            AND home.location_id = scope.location_id
        ))
    );
  IF NOT FOUND THEN
    row_kind := 'forbidden'; RETURN NEXT; RETURN;
  END IF;
  -- As in 025: bound the requested window and use an ascending (start, id) keyset.
  -- Carry-in intervals can start before that window, so their cursor may too.
  IF from_inclusive IS NULL OR to_exclusive IS NULL
    OR NOT isfinite(from_inclusive) OR NOT isfinite(to_exclusive)
    OR to_exclusive <= from_inclusive
    OR to_exclusive - from_inclusive > taptime_server.maximum_calendar_month_range()
    OR requested_limit IS NULL OR requested_limit NOT BETWEEN 1 AND 21
    OR (after_started_at IS NULL) <> (after_time_record_id IS NULL)
    OR (after_started_at IS NOT NULL AND
      (NOT isfinite(after_started_at) OR after_started_at >= to_exclusive))
  THEN row_kind := 'invalid_request'; RETURN NEXT; RETURN; END IF;

  row_kind := 'window'; window_started_at := from_inclusive; window_ended_at := to_exclusive;
  RETURN NEXT;
  RETURN QUERY
  SELECT 'active'::text, record.time_record_id, record.source, record.target_type,
    target.display_name, record.status, record.effective_started_at, record.effective_stopped_at,
    record.started_via, record.stopped_via, from_inclusive, to_exclusive
  FROM taptime_server.effective_time_records_v2 AS record
  JOIN taptime_server.work_targets AS target ON target.organization_id = record.organization_id
    AND target.target_type = record.target_type AND target.target_id = record.target_id
  WHERE record.organization_id = org AND record.user_id = target_user AND record.status = 'started'
  ORDER BY record.effective_started_at, record.time_record_id LIMIT 1;

  RETURN QUERY
  SELECT 'history'::text, record.time_record_id, record.source, record.target_type,
    target.display_name, record.status, record.effective_started_at, record.effective_stopped_at,
    record.started_via, record.stopped_via, from_inclusive, to_exclusive
  FROM taptime_server.effective_time_records_v2 AS record
  JOIN taptime_server.work_targets AS target ON target.organization_id = record.organization_id
    AND target.target_type = record.target_type AND target.target_id = record.target_id
  WHERE record.organization_id = org AND record.user_id = target_user AND record.status = 'stopped'
    AND record.effective_stopped_at > from_inclusive AND record.effective_started_at < to_exclusive
    AND (after_started_at IS NULL OR (record.effective_started_at, record.time_record_id)
      > (after_started_at, after_time_record_id))
  ORDER BY record.effective_started_at, record.time_record_id LIMIT requested_limit;
END
$person$;

CREATE OR REPLACE FUNCTION taptime_server.read_managed_active_summary_v2(
  requested_location_id uuid, requested_is_running boolean,
  after_membership_id uuid, requested_limit integer
)
RETURNS TABLE (
  result_status text, server_time timestamptz, running_count bigint, total_count bigint,
  membership_id uuid, membership_display_name text, membership_role text,
  location_id uuid, location_name text, is_running boolean,
  running_since timestamptz, running_target_display_name text, departed_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog
AS $summary$
DECLARE
  org uuid := NULLIF(current_setting('app.organization_id', true), '')::uuid;
  actor_user uuid := NULLIF(current_setting('app.user_id', true), '')::uuid;
  actor uuid := NULLIF(current_setting('app.membership_id', true), '')::uuid;
  organization_scope boolean;
  location_scope uuid[];
  locations_enabled boolean;
BEGIN
  IF current_setting('role', true) IS DISTINCT FROM 'taptime_membership_manager' THEN
    result_status := 'forbidden'; RETURN NEXT; RETURN;
  END IF;
  SELECT bool_or(scope.scope_kind = 'organization' AND scope.location_id IS NULL),
    array_agg(scope.location_id) FILTER (WHERE scope.scope_kind = 'location' AND scope.location_id IS NOT NULL)
    INTO organization_scope, location_scope
  FROM taptime_server.has_membership_management_authority_v1(
    org, actor_user, actor, 'read', NULL, NULL, NULL
  ) AS scope;
  IF NOT COALESCE(organization_scope, false) AND COALESCE(cardinality(location_scope), 0) = 0 THEN
    result_status := 'forbidden'; RETURN NEXT; RETURN;
  END IF;
  SELECT organization.locations_enabled INTO locations_enabled
    FROM taptime_server.organizations AS organization WHERE organization.id = org;
  IF requested_location_id IS NOT NULL AND NOT (
    locations_enabled AND EXISTS (SELECT 1 FROM taptime_server.locations AS location
      WHERE location.organization_id = org AND location.id = requested_location_id AND location.active)
    AND (COALESCE(organization_scope, false) OR COALESCE(requested_location_id = ANY(location_scope), false))
  ) THEN result_status := 'forbidden'; RETURN NEXT; RETURN; END IF;
  IF requested_limit IS NULL OR requested_limit NOT BETWEEN 1 AND 20 THEN
    result_status := 'invalid_request'; RETURN NEXT; RETURN;
  END IF;

  RETURN QUERY
  WITH people AS MATERIALIZED (
    SELECT membership.id, COALESCE(membership.display_name, CASE membership.role
      WHEN 'administrator' THEN 'Administrator' WHEN 'standortleitung' THEN 'Standortleitung'
      ELSE 'Mitarbeiter' END) AS display_name, membership.role, membership.revoked_at,
      home.location_id, location.display_name AS location_name,
      running.time_record_id IS NOT NULL AS is_running,
      running.effective_started_at AS running_since, running.display_name AS running_target
    FROM taptime_server.memberships AS membership
    LEFT JOIN LATERAL (SELECT membership.organization_id, taptime_server.membership_management_home_v1(org,membership.id) AS location_id) AS home ON locations_enabled
    LEFT JOIN taptime_server.locations AS location
      ON location.organization_id = home.organization_id AND location.id = home.location_id
    LEFT JOIN LATERAL (
      SELECT record.time_record_id, record.effective_started_at, target.display_name
      FROM taptime_server.effective_time_records_v2 AS record
      JOIN taptime_server.work_targets AS target ON target.organization_id = record.organization_id
        AND target.target_type = record.target_type AND target.target_id = record.target_id
      WHERE record.organization_id = membership.organization_id
        AND membership.revoked_at IS NULL AND record.user_id = membership.user_id AND record.status = 'started'
      ORDER BY record.effective_started_at, record.time_record_id LIMIT 1
    ) AS running ON true
    WHERE membership.organization_id = org AND (membership.revoked_at IS NULL OR taptime_server.departure_is_visible_v1(membership.revoked_at))
      AND (COALESCE(organization_scope, false) OR home.location_id = ANY(location_scope))
      AND (requested_location_id IS NULL OR home.location_id = requested_location_id)
  ), counts AS (
    SELECT count(*) FILTER (WHERE people.is_running AND people.revoked_at IS NULL) AS running_count, count(*) FILTER (WHERE people.revoked_at IS NULL) AS total_count FROM people
  ), page AS (
    SELECT * FROM people WHERE (people.revoked_at IS NOT NULL OR requested_is_running IS NULL OR people.is_running = requested_is_running)
      AND (after_membership_id IS NULL OR people.id > after_membership_id)
    ORDER BY people.id LIMIT requested_limit + 1
  )
  SELECT 'succeeded'::text, transaction_timestamp(), counts.running_count, counts.total_count,
    page.id, page.display_name, page.role, page.location_id, page.location_name,
    page.is_running, page.running_since, page.running_target, page.revoked_at
  FROM counts LEFT JOIN page ON true ORDER BY page.id;
END
$summary$;

ALTER FUNCTION taptime_server.read_managed_active_summary_v2(uuid,boolean,uuid,integer) OWNER TO taptime_membership_management_function_owner;
REVOKE ALL ON FUNCTION taptime_server.read_managed_active_summary_v2(uuid,boolean,uuid,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.read_managed_active_summary_v2(uuid,boolean,uuid,integer) TO taptime_membership_manager;

CREATE OR REPLACE FUNCTION taptime_server.backfill_time_record_v1(request jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog
AS $backfill$
DECLARE
  org uuid := nullif(current_setting('app.organization_id',true),'')::uuid;
  actor_user uuid := nullif(current_setting('app.user_id',true),'')::uuid;
  actor_id uuid := nullif(current_setting('app.membership_id',true),'')::uuid;
  actor_role text;
  target_user uuid;
  command uuid := (request->>'commandId')::uuid;
  target_member uuid := (request->>'targetMembershipId')::uuid;
  target uuid := (request->>'targetId')::uuid;
  start_at timestamptz := (request->>'startedAt')::timestamptz;
  stop_at timestamptz := (request->>'stoppedAt')::timestamptz;
  reason text := request->>'reason';
  comment_text text := request->>'comment';
  receipt taptime_server.time_supplement_command_receipts%ROWTYPE;
  record_id uuid := gen_random_uuid();
  result jsonb;
BEGIN
  IF current_setting('role',true) IS DISTINCT FROM 'taptime_time_review_writer'
    OR actor_id IS DISTINCT FROM (request->>'expectedMembershipId')::uuid THEN
    RETURN jsonb_build_object('status','authority_rejected');
  END IF;
  SELECT m.role INTO actor_role FROM taptime_server.memberships m
    WHERE m.organization_id=org AND m.id=actor_id AND m.user_id=actor_user AND m.revoked_at IS NULL;
  IF actor_role IS NULL OR actor_role NOT IN ('employee','administrator','standortleitung')
    OR actor_role IS DISTINCT FROM current_setting('app.membership_role',true)
    OR (actor_role='employee' AND target_member IS DISTINCT FROM actor_id) THEN
    RETURN jsonb_build_object('status','authority_rejected');
  END IF;
  SELECT m.user_id INTO target_user FROM taptime_server.memberships m
    WHERE m.organization_id=org AND m.id=target_member;
  IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM taptime_server.work_targets t
    WHERE t.organization_id=org AND t.target_type=request->>'targetType' AND t.target_id=target AND t.active) THEN
    RETURN jsonb_build_object('status','authority_rejected');
  END IF;
  -- The same person/command locks as the existing lifecycle and correction. No new Tap policy.
  PERFORM pg_advisory_xact_lock(hashtextextended(org::text||chr(31)||target_user::text,0));
  PERFORM pg_advisory_xact_lock(hashtextextended(org::text||chr(30)||command::text,0));
  -- Resolve again after the person lock; a queued request cannot retain a former home/grant.
  IF actor_role='standortleitung' AND NOT EXISTS (
    SELECT 1 FROM taptime_server.has_time_management_authority_v1(org,actor_user,actor_id,target_user)
  ) THEN RETURN jsonb_build_object('status','authority_rejected'); END IF;
  IF NOT taptime_server.membership_may_choose_time_target_v1(org,target_member,request->>'targetType',target)
    THEN RETURN jsonb_build_object('status','authority_rejected'); END IF;
  SELECT * INTO receipt FROM taptime_server.time_supplement_command_receipts r
    WHERE r.organization_id=org AND r.command_id=command;
  IF FOUND THEN
    IF receipt.actor_membership_id=actor_id AND receipt.command_type='backfill' AND receipt.request_payload=request THEN
      RETURN receipt.result_payload || jsonb_build_object('idempotentRetry',true);
    END IF;
    RETURN jsonb_build_object('status','command_id_conflict');
  END IF;
  IF EXISTS (SELECT 1 FROM taptime_server.time_review_command_receipts r WHERE r.organization_id=org AND r.command_id=command) THEN
    RETURN jsonb_build_object('status','command_id_conflict');
  END IF;
  IF EXISTS (SELECT 1 FROM taptime_server.memberships m WHERE m.organization_id=org AND m.id=target_member
    AND m.revoked_at IS NOT NULL AND stop_at>m.revoked_at) THEN
    RETURN jsonb_build_object('status','after_departure');
  END IF;
  IF command IS NULL OR start_at IS NULL OR stop_at IS NULL OR NOT isfinite(start_at) OR NOT isfinite(stop_at)
    OR start_at >= stop_at OR stop_at > transaction_timestamp() OR stop_at-start_at > interval '24 hours' THEN
    RETURN jsonb_build_object('status','invalid_interval');
  END IF;
  IF actor_role='employee' AND start_at < ((date_trunc('month',transaction_timestamp() AT TIME ZONE 'Europe/Berlin')-interval '1 month') AT TIME ZONE 'Europe/Berlin') THEN
    RETURN jsonb_build_object('status','outside_window');
  END IF;
  IF actor_role IN ('administrator','standortleitung') AND (reason IS NULL OR char_length(btrim(reason)) NOT BETWEEN 1 AND 500) THEN
    RETURN jsonb_build_object('status','reason_required');
  END IF;
  IF comment_text IS NOT NULL AND (actor_role<>'employee' OR char_length(btrim(comment_text)) NOT BETWEEN 1 AND 500) THEN
    RETURN jsonb_build_object('status','invalid_comment');
  END IF;
  IF EXISTS (SELECT 1 FROM taptime_server.effective_time_records_v2 r
    WHERE r.organization_id=org AND r.user_id=target_user AND r.effective_started_at < stop_at
      AND (r.effective_stopped_at IS NULL OR r.effective_stopped_at > start_at)) THEN
    RETURN jsonb_build_object('status','overlap');
  END IF;
  INSERT INTO taptime_server.time_record_revisions
    (organization_id,time_record_id,revision_number,user_id,target_type,target_customer_id,
     effective_started_at,effective_stopped_at,base_row_version,actor_user_id,actor_membership_id,reason,command_id,request_hash)
    VALUES (org,record_id,1,target_user,request->>'targetType',target,start_at,stop_at,0,actor_user,actor_id,
      CASE WHEN actor_role='employee' THEN 'Selbst nachgetragen' ELSE reason END,command,
      encode(sha256(convert_to(request::text,'UTF8')),'hex'));
  INSERT INTO taptime_server.time_record_origins(organization_id,time_record_id,origin,created_by) VALUES(org,record_id,'backfilled',CASE WHEN actor_role='employee' THEN 'self' ELSE 'administration' END);
  IF comment_text IS NOT NULL THEN
    INSERT INTO taptime_server.time_record_comments(organization_id,time_record_id,comment_number,user_id,actor_membership_id,comment,command_id)
      VALUES(org,record_id,1,actor_user,actor_id,comment_text,command);
  END IF;
  result := jsonb_build_object('status','committed','timeRecordId',record_id,'idempotentRetry',false);
  INSERT INTO taptime_server.time_supplement_command_receipts
    (organization_id,command_id,actor_user_id,actor_membership_id,command_type,request_payload,result_payload)
    VALUES(org,command,actor_user,actor_id,'backfill',request,result);
  RETURN result;
END
$backfill$;

CREATE OR REPLACE FUNCTION taptime_server.correct_time_record_v1(
  requested_organization_id uuid,
  requested_actor_user_id uuid,
  requested_membership_id uuid,
  requested_command_id uuid,
  requested_request_hash text,
  requested_time_record_id uuid,
  requested_expected_base_row_version bigint,
  requested_expected_revision_number bigint,
  requested_started_at timestamptz,
  requested_stopped_at timestamptz,
  requested_reason text
)
RETURNS TABLE (
  result_status text,
  time_record_id uuid,
  revision_number bigint,
  effective_started_at timestamptz,
  effective_stopped_at timestamptz,
  idempotent_retry boolean
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog
AS $correction$
DECLARE
  receipt taptime_server.time_review_command_receipts%ROWTYPE;
  record taptime_server.effective_time_records_v1%ROWTYPE;
  next_revision bigint;
BEGIN
  IF pg_catalog.current_setting('role', true) <> 'taptime_time_review_writer'
    OR requested_request_hash IS NULL
    OR requested_request_hash COLLATE "C" !~ '^[0-9a-f]{64}$'
    OR requested_command_id IS NULL
    OR requested_time_record_id IS NULL
    OR requested_expected_base_row_version IS NULL
    OR requested_expected_revision_number IS NULL
    OR requested_started_at IS NULL
    OR requested_stopped_at IS NULL
    OR requested_started_at > requested_stopped_at
    OR requested_stopped_at > pg_catalog.transaction_timestamp()
    OR requested_reason IS NULL
    OR pg_catalog.char_length(pg_catalog.btrim(requested_reason)) NOT BETWEEN 1 AND 500
  THEN
    RAISE EXCEPTION 'Time correction capability rejected' USING ERRCODE = '42501';
  END IF;

  SELECT candidate.* INTO record
  FROM taptime_server.effective_time_records_v1 AS candidate
  WHERE candidate.organization_id = requested_organization_id
    AND candidate.time_record_id = requested_time_record_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'not_adjustable'::text, NULL::uuid, NULL::bigint,
      NULL::timestamptz, NULL::timestamptz, false;
    RETURN;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    requested_organization_id::text || chr(31) || record.user_id::text, 0
  ));
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    requested_organization_id::text || chr(30) || requested_command_id::text, 0
  ));

  IF NOT EXISTS (SELECT 1 FROM taptime_server.has_time_management_authority_v1(
    requested_organization_id, requested_actor_user_id, requested_membership_id, record.user_id
  )) THEN
    RETURN QUERY SELECT 'authority_rejected'::text, NULL::uuid, NULL::bigint,
      NULL::timestamptz, NULL::timestamptz, false;
    RETURN;
  END IF;
  PERFORM 1 FROM taptime_server.memberships AS membership
  WHERE membership.organization_id = requested_organization_id
    AND membership.user_id = requested_actor_user_id
    AND membership.id = requested_membership_id
    AND membership.role = current_setting('app.membership_role',true)
    AND membership.role IN ('administrator','standortleitung')
    AND membership.revoked_at IS NULL
  ;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'authority_rejected'::text, NULL::uuid, NULL::bigint,
      NULL::timestamptz, NULL::timestamptz, false;
    RETURN;
  END IF;

  SELECT command.* INTO receipt
  FROM taptime_server.time_review_command_receipts AS command
  WHERE command.organization_id = requested_organization_id
    AND command.command_id = requested_command_id
  ;
  IF FOUND THEN
    IF receipt.command_type <> 'correction' OR receipt.request_hash <> requested_request_hash THEN
      RETURN QUERY SELECT 'command_id_conflict'::text, NULL::uuid, NULL::bigint,
        NULL::timestamptz, NULL::timestamptz, false;
    ELSE
      RETURN QUERY SELECT 'committed'::text,
        (receipt.result_payload->>'timeRecordId')::uuid,
        (receipt.result_payload->>'revisionNumber')::bigint,
        (receipt.result_payload->>'startedAt')::timestamptz,
        (receipt.result_payload->>'stoppedAt')::timestamptz,
        true;
    END IF;
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM taptime_server.memberships m WHERE m.organization_id=requested_organization_id
    AND m.user_id=record.user_id AND m.revoked_at IS NOT NULL AND requested_stopped_at>m.revoked_at) THEN
    RETURN QUERY SELECT 'after_departure'::text,NULL::uuid,NULL::bigint,NULL::timestamptz,NULL::timestamptz,false;
    RETURN;
  END IF;
  IF record.canonical_time_entry_id IS NOT NULL THEN
    PERFORM 1 FROM taptime_server.time_entries AS entry
    WHERE entry.organization_id = requested_organization_id
      AND entry.id = requested_time_record_id
    FOR SHARE;
  ELSE
    PERFORM 1 FROM taptime_server.time_record_revisions AS revision
    WHERE revision.organization_id = requested_organization_id
      AND revision.time_record_id = requested_time_record_id
      AND revision.revision_number = record.effective_revision_number
    FOR SHARE;
  END IF;

  SELECT candidate.* INTO record
  FROM taptime_server.effective_time_records_v1 AS candidate
  WHERE candidate.organization_id = requested_organization_id
    AND candidate.time_record_id = requested_time_record_id;
  IF NOT FOUND OR record.status <> 'stopped' THEN
    RETURN QUERY SELECT 'not_adjustable'::text, NULL::uuid, NULL::bigint,
      NULL::timestamptz, NULL::timestamptz, false;
    RETURN;
  END IF;
  IF record.base_row_version <> requested_expected_base_row_version
    OR record.effective_revision_number <> requested_expected_revision_number
  THEN
    RETURN QUERY SELECT 'conflict'::text, record.time_record_id,
      record.effective_revision_number, record.effective_started_at,
      record.effective_stopped_at, false;
    RETURN;
  END IF;
  IF record.effective_started_at = requested_started_at
    AND record.effective_stopped_at = requested_stopped_at
  THEN
    RETURN QUERY SELECT 'not_adjustable'::text, NULL::uuid, NULL::bigint,
      NULL::timestamptz, NULL::timestamptz, false;
    RETURN;
  END IF;

  next_revision := record.effective_revision_number + 1;
  INSERT INTO taptime_server.time_record_revisions (
    organization_id, time_record_id, revision_number, canonical_time_entry_id,
    user_id, target_type, target_customer_id, effective_started_at,
    effective_stopped_at, base_row_version, actor_user_id, actor_membership_id,
    reason, previous_revision_number, command_id, request_hash
  ) VALUES (
    requested_organization_id, requested_time_record_id, next_revision,
    record.canonical_time_entry_id, record.user_id, record.target_type,
    record.target_customer_id, requested_started_at, requested_stopped_at,
    record.base_row_version, requested_actor_user_id, requested_membership_id,
    requested_reason, NULLIF(next_revision - 1, 0), requested_command_id,
    requested_request_hash
  );

  INSERT INTO taptime_server.audit_events (
    id, organization_id, actor_user_id, event_type, entity_type, entity_id,
    occurred_at, correlation_id, payload
  ) VALUES (
    pg_catalog.gen_random_uuid(), requested_organization_id, requested_actor_user_id,
    'TimeRecordCorrected', 'TimeRecord', requested_time_record_id,
    pg_catalog.transaction_timestamp(), requested_command_id::text,
    pg_catalog.jsonb_build_object(
      'schemaVersion', 1,
      'commandId', requested_command_id,
      'timeRecordId', requested_time_record_id,
      'revisionNumber', next_revision,
      'from', pg_catalog.jsonb_build_object(
        'startedAt', record.effective_started_at,
        'stoppedAt', record.effective_stopped_at
      ),
      'to', pg_catalog.jsonb_build_object(
        'startedAt', requested_started_at,
        'stoppedAt', requested_stopped_at
      ),
      'reason', requested_reason
    )
  );

  INSERT INTO taptime_server.time_review_command_receipts (
    organization_id, command_id, actor_user_id, actor_membership_id,
    command_type, request_hash, result_payload
  ) VALUES (
    requested_organization_id, requested_command_id, requested_actor_user_id,
    requested_membership_id, 'correction', requested_request_hash,
    pg_catalog.jsonb_build_object(
      'timeRecordId', requested_time_record_id,
      'revisionNumber', next_revision,
      'startedAt', requested_started_at,
      'stoppedAt', requested_stopped_at
    )
  );

  RETURN QUERY SELECT 'committed'::text, requested_time_record_id, next_revision,
    requested_started_at, requested_stopped_at, false;
END
$correction$;

CREATE OR REPLACE FUNCTION taptime_server.adjudicate_time_review_items_legacy_v1(
  requested_organization_id uuid,
  requested_actor_user_id uuid,
  requested_membership_id uuid,
  requested_command_id uuid,
  requested_request_hash text,
  requested_review_item_ids uuid[],
  requested_resolution text,
  requested_time_record_id uuid,
  requested_expected_base_row_version bigint,
  requested_expected_revision_number bigint,
  requested_started_at timestamptz,
  requested_stopped_at timestamptz,
  requested_reason text
)
RETURNS TABLE (
  result_status text,
  resolution text,
  adjudicated_review_item_ids uuid[],
  time_record_id uuid,
  revision_number bigint,
  idempotent_retry boolean
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog
AS $adjudication$
DECLARE
  receipt taptime_server.time_review_command_receipts%ROWTYPE;
  affected_user_ids uuid[];
  affected_customer_ids uuid[];
  source_families text[];
  affected_user_id uuid;
  source_family text;
  classified_item_count bigint;
  expected_prefix uuid[];
  record taptime_server.effective_time_records_v1%ROWTYPE;
  next_revision bigint;
  resulting_time_record_id uuid;
  resulting_revision_number bigint;
  from_started_at timestamptz;
  from_stopped_at timestamptz;
BEGIN
  IF pg_catalog.current_setting('role', true) <> 'taptime_time_review_writer'
    OR requested_command_id IS NULL
    OR requested_request_hash IS NULL
    OR requested_request_hash COLLATE "C" !~ '^[0-9a-f]{64}$'
    OR requested_review_item_ids IS NULL
    OR pg_catalog.cardinality(requested_review_item_ids) NOT BETWEEN 1 AND 25
    OR (
      SELECT pg_catalog.count(DISTINCT item_id)
      FROM pg_catalog.unnest(requested_review_item_ids) AS item_id
    ) <> pg_catalog.cardinality(requested_review_item_ids)
    OR requested_resolution NOT IN (
      'no_time_record_change', 'adjust_existing_time_record', 'create_recovered_time_record'
    )
    OR requested_reason IS NULL
    OR pg_catalog.char_length(pg_catalog.btrim(requested_reason)) NOT BETWEEN 1 AND 500
    OR (
      requested_resolution = 'no_time_record_change'
      AND (
        requested_time_record_id IS NOT NULL
        OR requested_expected_base_row_version IS NOT NULL
        OR requested_expected_revision_number IS NOT NULL
        OR requested_started_at IS NOT NULL
        OR requested_stopped_at IS NOT NULL
      )
    )
    OR (
      requested_resolution = 'adjust_existing_time_record'
      AND (
        requested_time_record_id IS NULL
        OR requested_expected_base_row_version IS NULL
        OR requested_expected_revision_number IS NULL
        OR requested_started_at IS NULL
        OR requested_stopped_at IS NULL
      )
    )
    OR (
      requested_resolution = 'create_recovered_time_record'
      AND (
        requested_time_record_id IS NOT NULL
        OR requested_expected_base_row_version IS NOT NULL
        OR requested_expected_revision_number IS NOT NULL
        OR requested_started_at IS NULL
        OR requested_stopped_at IS NULL
      )
    )
    OR (
      requested_resolution <> 'no_time_record_change'
      AND (
        requested_started_at > requested_stopped_at
        OR requested_stopped_at > pg_catalog.transaction_timestamp()
      )
    )
  THEN
    RAISE EXCEPTION 'Time review adjudication capability rejected' USING ERRCODE = '42501';
  END IF;

  WITH classified AS (
    SELECT event.id,
           event.triggered_by_user_id AS user_id,
           event.target_customer_id AS customer_id,
           CASE
             WHEN reconciliation.work_event_id IS NOT NULL
               AND reconciliation.result_status = 'review_pending'
               THEN 'offline_v2'::text
             WHEN EXISTS (
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
             AND reconciliation.work_event_id IS NULL
               THEN 'server_legacy'::text
           END AS source_family
    FROM taptime_server.work_events AS event
    LEFT JOIN taptime_server.offline_event_reconciliations AS reconciliation
      ON reconciliation.organization_id = event.organization_id
     AND reconciliation.work_event_id = event.id
    WHERE event.organization_id = requested_organization_id
      AND event.id = ANY(requested_review_item_ids)
  )
  SELECT pg_catalog.array_agg(DISTINCT classified.user_id),
         pg_catalog.array_agg(DISTINCT classified.customer_id),
         pg_catalog.array_agg(DISTINCT classified.source_family),
         pg_catalog.count(*)
  INTO affected_user_ids, affected_customer_ids, source_families, classified_item_count
  FROM classified
  WHERE classified.source_family IS NOT NULL;

  IF pg_catalog.cardinality(affected_user_ids) <> 1
    OR pg_catalog.cardinality(source_families) <> 1
    OR classified_item_count <> pg_catalog.cardinality(requested_review_item_ids)
    OR (
      SELECT pg_catalog.count(*) FROM taptime_server.work_events AS event
      WHERE event.organization_id = requested_organization_id
        AND event.id = ANY(requested_review_item_ids)
    ) <> pg_catalog.cardinality(requested_review_item_ids)
  THEN
    RETURN QUERY SELECT 'invalid_evidence'::text, requested_resolution,
      NULL::uuid[], NULL::uuid, NULL::bigint, false;
    RETURN;
  END IF;
  affected_user_id := affected_user_ids[1];
  source_family := source_families[1];

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    requested_organization_id::text || chr(31) || affected_user_id::text, 0
  ));
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    requested_organization_id::text || chr(30) || requested_command_id::text, 0
  ));

  IF NOT EXISTS (SELECT 1 FROM taptime_server.has_time_management_authority_v1(
    requested_organization_id, requested_actor_user_id, requested_membership_id, affected_user_id
  )) THEN
    RETURN QUERY SELECT 'authority_rejected'::text, requested_resolution,
      NULL::uuid[], NULL::uuid, NULL::bigint, false;
    RETURN;
  END IF;
  PERFORM 1 FROM taptime_server.memberships AS membership
  WHERE membership.organization_id = requested_organization_id
    AND membership.user_id = requested_actor_user_id
    AND membership.id = requested_membership_id
    AND membership.role = current_setting('app.membership_role',true)
    AND membership.role IN ('administrator','standortleitung')
    AND membership.revoked_at IS NULL
  ;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'authority_rejected'::text, requested_resolution,
      NULL::uuid[], NULL::uuid, NULL::bigint, false;
    RETURN;
  END IF;

  SELECT command.* INTO receipt
  FROM taptime_server.time_review_command_receipts AS command
  WHERE command.organization_id = requested_organization_id
    AND command.command_id = requested_command_id
  ;
  IF FOUND THEN
    IF receipt.command_type <> 'adjudication' OR receipt.request_hash <> requested_request_hash THEN
      RETURN QUERY SELECT 'command_id_conflict'::text, requested_resolution,
        NULL::uuid[], NULL::uuid, NULL::bigint, false;
    ELSE
      RETURN QUERY SELECT 'committed'::text,
        receipt.result_payload->>'resolution',
        ARRAY(
          SELECT value::uuid
          FROM pg_catalog.jsonb_array_elements_text(
            receipt.result_payload->'reviewItemIds'
          ) AS value
        ),
        NULLIF(receipt.result_payload->>'timeRecordId', '')::uuid,
        NULLIF(receipt.result_payload->>'revisionNumber', '')::bigint,
        true;
    END IF;
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM taptime_server.memberships m WHERE m.organization_id=requested_organization_id
    AND m.user_id=affected_user_id AND m.revoked_at IS NOT NULL
    AND (requested_stopped_at>m.revoked_at OR EXISTS (SELECT 1 FROM taptime_server.work_events e
      WHERE e.organization_id=requested_organization_id AND e.id=ANY(requested_review_item_ids) AND e.occurred_at>m.revoked_at))) THEN
    RETURN QUERY SELECT 'after_departure'::text,requested_resolution,NULL::uuid[],NULL::uuid,NULL::bigint,false;
    RETURN;
  END IF;


  IF source_family = 'offline_v2' THEN
    SELECT pg_catalog.array_agg(prefix.work_event_id ORDER BY prefix.recorded_at, prefix.work_event_id)
    INTO expected_prefix
    FROM (
      SELECT reconciliation.work_event_id, reconciliation.recorded_at
      FROM taptime_server.offline_event_reconciliations AS reconciliation
      LEFT JOIN taptime_server.offline_review_adjudications AS existing_adjudication
        ON existing_adjudication.organization_id = reconciliation.organization_id
       AND existing_adjudication.work_event_id = reconciliation.work_event_id
      WHERE reconciliation.organization_id = requested_organization_id
        AND reconciliation.user_id = affected_user_id
        AND reconciliation.result_status = 'review_pending'
        AND existing_adjudication.work_event_id IS NULL
      ORDER BY reconciliation.recorded_at, reconciliation.work_event_id
      LIMIT pg_catalog.cardinality(requested_review_item_ids)
    ) AS prefix;
  ELSE
    SELECT pg_catalog.array_agg(prefix.work_event_id ORDER BY prefix.recorded_at, prefix.work_event_id)
    INTO expected_prefix
    FROM (
      SELECT event.id AS work_event_id, event.received_at AS recorded_at
      FROM taptime_server.work_events AS event
      WHERE event.organization_id = requested_organization_id
        AND event.triggered_by_user_id = affected_user_id
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
          SELECT 1 FROM taptime_server.offline_review_adjudications AS existing_adjudication
          WHERE existing_adjudication.organization_id = event.organization_id
            AND existing_adjudication.work_event_id = event.id
        )
      ORDER BY event.received_at, event.id
      LIMIT pg_catalog.cardinality(requested_review_item_ids)
    ) AS prefix;
  END IF;

  IF expected_prefix IS DISTINCT FROM requested_review_item_ids THEN
    RETURN QUERY SELECT 'conflict'::text, requested_resolution,
      NULL::uuid[], NULL::uuid, NULL::bigint, false;
    RETURN;
  END IF;

  IF requested_resolution = 'adjust_existing_time_record' THEN
    IF pg_catalog.cardinality(affected_customer_ids) <> 1 THEN
      RETURN QUERY SELECT 'invalid_evidence'::text, requested_resolution,
        NULL::uuid[], NULL::uuid, NULL::bigint, false;
      RETURN;
    END IF;
    SELECT candidate.* INTO record
    FROM taptime_server.effective_time_records_v1 AS candidate
    WHERE candidate.organization_id = requested_organization_id
      AND candidate.time_record_id = requested_time_record_id;
    IF NOT FOUND
      OR record.user_id <> affected_user_id
      OR record.target_customer_id <> affected_customer_ids[1]
      OR record.status <> 'stopped'
    THEN
      RETURN QUERY SELECT 'invalid_evidence'::text, requested_resolution,
        NULL::uuid[], NULL::uuid, NULL::bigint, false;
      RETURN;
    END IF;
    IF record.canonical_time_entry_id IS NOT NULL THEN
      PERFORM 1 FROM taptime_server.time_entries AS entry
      WHERE entry.organization_id = requested_organization_id
        AND entry.id = requested_time_record_id
      FOR SHARE;
    ELSE
      PERFORM 1 FROM taptime_server.time_record_revisions AS revision
      WHERE revision.organization_id = requested_organization_id
        AND revision.time_record_id = requested_time_record_id
        AND revision.revision_number = record.effective_revision_number
      FOR SHARE;
    END IF;
    SELECT candidate.* INTO record
    FROM taptime_server.effective_time_records_v1 AS candidate
    WHERE candidate.organization_id = requested_organization_id
      AND candidate.time_record_id = requested_time_record_id;
    IF record.base_row_version <> requested_expected_base_row_version
      OR record.effective_revision_number <> requested_expected_revision_number
    THEN
      RETURN QUERY SELECT 'conflict'::text, requested_resolution,
        NULL::uuid[], record.time_record_id, record.effective_revision_number, false;
      RETURN;
    END IF;
    IF record.effective_started_at = requested_started_at
      AND record.effective_stopped_at = requested_stopped_at
    THEN
      RETURN QUERY SELECT 'invalid_evidence'::text, requested_resolution,
        NULL::uuid[], NULL::uuid, NULL::bigint, false;
      RETURN;
    END IF;
    from_started_at := record.effective_started_at;
    from_stopped_at := record.effective_stopped_at;
    next_revision := record.effective_revision_number + 1;
    resulting_time_record_id := record.time_record_id;
    resulting_revision_number := next_revision;
    INSERT INTO taptime_server.time_record_revisions (
      organization_id, time_record_id, revision_number, canonical_time_entry_id,
      user_id, target_type, target_customer_id, effective_started_at,
      effective_stopped_at, base_row_version, actor_user_id, actor_membership_id,
      reason, previous_revision_number, command_id, request_hash
    ) VALUES (
      requested_organization_id, record.time_record_id, next_revision,
      record.canonical_time_entry_id, record.user_id, record.target_type,
      record.target_customer_id, requested_started_at, requested_stopped_at,
      record.base_row_version, requested_actor_user_id, requested_membership_id,
      requested_reason, NULLIF(next_revision - 1, 0), requested_command_id,
      requested_request_hash
    );
  ELSIF requested_resolution = 'create_recovered_time_record' THEN
    IF pg_catalog.cardinality(affected_customer_ids) <> 1 THEN
      RETURN QUERY SELECT 'invalid_evidence'::text, requested_resolution,
        NULL::uuid[], NULL::uuid, NULL::bigint, false;
      RETURN;
    END IF;
    resulting_time_record_id := pg_catalog.gen_random_uuid();
    resulting_revision_number := 1;
    INSERT INTO taptime_server.time_record_revisions (
      organization_id, time_record_id, revision_number, canonical_time_entry_id,
      user_id, target_type, target_customer_id, effective_started_at,
      effective_stopped_at, base_row_version, actor_user_id, actor_membership_id,
      reason, previous_revision_number, command_id, request_hash
    ) VALUES (
      requested_organization_id, resulting_time_record_id, 1, NULL,
      affected_user_id, 'customer', affected_customer_ids[1], requested_started_at,
      requested_stopped_at, 0, requested_actor_user_id, requested_membership_id,
      requested_reason, NULL, requested_command_id, requested_request_hash
    );
  END IF;

  INSERT INTO taptime_server.offline_review_adjudications (
    organization_id, work_event_id, user_id, target_type, target_customer_id,
    source_family, installation_id, device_sequence, actor_user_id,
    actor_membership_id, resolution, reason, command_id, time_record_id,
    revision_number
  )
  SELECT event.organization_id, event.id, event.triggered_by_user_id,
         event.target_type, event.target_customer_id, source_family,
         CASE WHEN source_family = 'offline_v2' THEN reconciliation.installation_id END,
         CASE WHEN source_family = 'offline_v2' THEN reconciliation.device_sequence END,
         requested_actor_user_id, requested_membership_id, requested_resolution,
         requested_reason, requested_command_id, resulting_time_record_id,
         resulting_revision_number
  FROM taptime_server.work_events AS event
  LEFT JOIN taptime_server.offline_event_reconciliations AS reconciliation
    ON reconciliation.organization_id = event.organization_id
   AND reconciliation.work_event_id = event.id
  WHERE event.organization_id = requested_organization_id
    AND event.id = ANY(requested_review_item_ids);

  IF source_family = 'offline_v2' THEN
    PERFORM 1
    FROM taptime_server.offline_sync_cursors AS cursor
    WHERE cursor.organization_id = requested_organization_id
      AND cursor.user_id = affected_user_id
      AND cursor.review_predecessor_sequence IS NOT NULL
    ORDER BY cursor.installation_id
    FOR UPDATE;

    UPDATE taptime_server.offline_sync_cursors AS cursor
    SET review_predecessor_sequence = NULL,
        updated_at = pg_catalog.transaction_timestamp()
    WHERE cursor.organization_id = requested_organization_id
      AND cursor.user_id = affected_user_id
      AND cursor.review_predecessor_sequence IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM taptime_server.offline_event_reconciliations AS reconciliation
        LEFT JOIN taptime_server.offline_review_adjudications AS remaining_adjudication
          ON remaining_adjudication.organization_id = reconciliation.organization_id
         AND remaining_adjudication.work_event_id = reconciliation.work_event_id
        WHERE reconciliation.organization_id = cursor.organization_id
          AND reconciliation.user_id = cursor.user_id
          AND reconciliation.installation_id = cursor.installation_id
          AND reconciliation.result_status = 'review_pending'
          AND remaining_adjudication.work_event_id IS NULL
      );
  END IF;

  INSERT INTO taptime_server.audit_events (
    id, organization_id, actor_user_id, event_type, entity_type, entity_id,
    occurred_at, correlation_id, payload
  ) VALUES (
    pg_catalog.gen_random_uuid(), requested_organization_id, requested_actor_user_id,
    'TimeReviewAdjudicated', 'TimeReviewCommand', requested_command_id,
    pg_catalog.transaction_timestamp(), requested_command_id::text,
    pg_catalog.jsonb_build_object(
      'schemaVersion', 1,
      'commandId', requested_command_id,
      'sourceFamily', source_family,
      'resolution', requested_resolution,
      'reviewItemIds', requested_review_item_ids,
      'timeRecordId', resulting_time_record_id,
      'revisionNumber', resulting_revision_number,
      'from', CASE WHEN from_started_at IS NULL THEN NULL ELSE pg_catalog.jsonb_build_object(
        'startedAt', from_started_at, 'stoppedAt', from_stopped_at
      ) END,
      'to', CASE WHEN resulting_time_record_id IS NULL THEN NULL ELSE pg_catalog.jsonb_build_object(
        'startedAt', requested_started_at, 'stoppedAt', requested_stopped_at
      ) END,
      'reason', requested_reason
    )
  );

  INSERT INTO taptime_server.time_review_command_receipts (
    organization_id, command_id, actor_user_id, actor_membership_id,
    command_type, request_hash, result_payload
  ) VALUES (
    requested_organization_id, requested_command_id, requested_actor_user_id,
    requested_membership_id, 'adjudication', requested_request_hash,
    pg_catalog.jsonb_build_object(
      'resolution', requested_resolution,
      'reviewItemIds', requested_review_item_ids,
      'timeRecordId', COALESCE(resulting_time_record_id::text, ''),
      'revisionNumber', COALESCE(resulting_revision_number::text, '')
    )
  );

  RETURN QUERY SELECT 'committed'::text, requested_resolution,
    requested_review_item_ids, resulting_time_record_id,
    resulting_revision_number, false;
END
$adjudication$;

CREATE OR REPLACE FUNCTION taptime_server.adjudicate_time_review_items_v1(
  requested_organization_id uuid,
  requested_actor_user_id uuid,
  requested_membership_id uuid,
  requested_command_id uuid,
  requested_request_hash text,
  requested_review_item_ids uuid[],
  requested_resolution text,
  requested_time_record_id uuid,
  requested_expected_base_row_version bigint,
  requested_expected_revision_number bigint,
  requested_started_at timestamptz,
  requested_stopped_at timestamptz,
  requested_reason text
)
RETURNS TABLE (
  result_status text,
  resolution text,
  adjudicated_review_item_ids uuid[],
  time_record_id uuid,
  revision_number bigint,
  idempotent_retry boolean
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog
AS $adjudication$
DECLARE
  receipt taptime_server.time_review_command_receipts%ROWTYPE;
  affected_user_ids uuid[];
  affected_target_types text[];
  affected_target_ids uuid[];
  affected_user_id uuid;
  classified_item_count bigint;
  unresolved_item_count bigint;
  expected_prefix uuid[];
  record taptime_server.effective_time_records_v1%ROWTYPE;
  next_revision bigint;
  resulting_time_record_id uuid;
  resulting_revision_number bigint;
  from_started_at timestamptz;
  from_stopped_at timestamptz;
BEGIN
  IF pg_catalog.current_setting('role', true) <> 'taptime_time_review_writer'
    OR requested_command_id IS NULL
    OR requested_request_hash IS NULL
    OR requested_request_hash COLLATE "C" !~ '^[0-9a-f]{64}$'
    OR requested_review_item_ids IS NULL
    OR pg_catalog.cardinality(requested_review_item_ids) NOT BETWEEN 1 AND 25
    OR (
      SELECT pg_catalog.count(DISTINCT item_id)
      FROM pg_catalog.unnest(requested_review_item_ids) AS item_id
    ) <> pg_catalog.cardinality(requested_review_item_ids)
    OR requested_resolution NOT IN (
      'no_time_record_change', 'adjust_existing_time_record', 'create_recovered_time_record'
    )
    OR requested_reason IS NULL
    OR pg_catalog.char_length(pg_catalog.btrim(requested_reason)) NOT BETWEEN 1 AND 500
    OR (
      requested_resolution = 'no_time_record_change'
      AND (
        requested_time_record_id IS NOT NULL
        OR requested_expected_base_row_version IS NOT NULL
        OR requested_expected_revision_number IS NOT NULL
        OR requested_started_at IS NOT NULL
        OR requested_stopped_at IS NOT NULL
      )
    )
    OR (
      requested_resolution = 'adjust_existing_time_record'
      AND (
        requested_time_record_id IS NULL
        OR requested_expected_base_row_version IS NULL
        OR requested_expected_revision_number IS NULL
        OR requested_started_at IS NULL
        OR requested_stopped_at IS NULL
      )
    )
    OR (
      requested_resolution = 'create_recovered_time_record'
      AND (
        requested_time_record_id IS NOT NULL
        OR requested_expected_base_row_version IS NOT NULL
        OR requested_expected_revision_number IS NOT NULL
        OR requested_started_at IS NULL
        OR requested_stopped_at IS NULL
      )
    )
    OR (
      requested_resolution <> 'no_time_record_change'
      AND (
        requested_started_at > requested_stopped_at
        OR requested_stopped_at > pg_catalog.transaction_timestamp()
      )
    )
  THEN
    RAISE EXCEPTION 'Time review adjudication capability rejected' USING ERRCODE = '42501';
  END IF;

  SELECT pg_catalog.array_agg(DISTINCT event.triggered_by_user_id),
         pg_catalog.array_agg(DISTINCT event.target_type),
         pg_catalog.array_agg(DISTINCT event.target_customer_id),
         pg_catalog.count(*)
  INTO affected_user_ids, affected_target_types, affected_target_ids,
       classified_item_count
  FROM taptime_server.work_events AS event
  JOIN taptime_server.canonical_decisions AS decision
    ON decision.organization_id = event.organization_id
   AND decision.actor_user_id = event.triggered_by_user_id
   AND decision.work_event_id = event.id
   AND decision.decision_type = 'escalation_required'
  WHERE event.organization_id = requested_organization_id
    AND event.id = ANY(requested_review_item_ids)
    AND NOT EXISTS (
      SELECT 1 FROM taptime_server.offline_event_reconciliations AS reconciliation
      WHERE reconciliation.organization_id = event.organization_id
        AND reconciliation.work_event_id = event.id
    );

  IF classified_item_count = 0 THEN
    RETURN QUERY
    SELECT legacy.result_status, legacy.resolution,
           legacy.adjudicated_review_item_ids, legacy.time_record_id,
           legacy.revision_number, legacy.idempotent_retry
    FROM taptime_server.adjudicate_time_review_items_legacy_v1(
      requested_organization_id, requested_actor_user_id, requested_membership_id,
      requested_command_id, requested_request_hash, requested_review_item_ids,
      requested_resolution, requested_time_record_id,
      requested_expected_base_row_version, requested_expected_revision_number,
      requested_started_at, requested_stopped_at, requested_reason
    ) AS legacy;
    RETURN;
  END IF;

  IF classified_item_count <> pg_catalog.cardinality(requested_review_item_ids)
    OR pg_catalog.cardinality(affected_user_ids) <> 1
  THEN
    RETURN QUERY SELECT 'invalid_evidence'::text, requested_resolution,
      NULL::uuid[], NULL::uuid, NULL::bigint, false;
    RETURN;
  END IF;
  affected_user_id := affected_user_ids[1];

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    requested_organization_id::text || chr(31) || affected_user_id::text, 0
  ));
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    requested_organization_id::text || chr(30) || requested_command_id::text, 0
  ));

  IF NOT EXISTS (SELECT 1 FROM taptime_server.has_time_management_authority_v1(
    requested_organization_id, requested_actor_user_id, requested_membership_id, affected_user_id
  )) THEN
    RETURN QUERY SELECT 'authority_rejected'::text, requested_resolution,
      NULL::uuid[], NULL::uuid, NULL::bigint, false;
    RETURN;
  END IF;

  SELECT command.* INTO receipt
  FROM taptime_server.time_review_command_receipts AS command
  WHERE command.organization_id = requested_organization_id
    AND command.command_id = requested_command_id;
  IF FOUND THEN
    IF receipt.command_type <> 'adjudication'
      OR receipt.request_hash <> requested_request_hash
    THEN
      RETURN QUERY SELECT 'command_id_conflict'::text, requested_resolution,
        NULL::uuid[], NULL::uuid, NULL::bigint, false;
    ELSE
      RETURN QUERY SELECT 'committed'::text,
        receipt.result_payload->>'resolution',
        ARRAY(
          SELECT value::uuid
          FROM pg_catalog.jsonb_array_elements_text(
            receipt.result_payload->'reviewItemIds'
          ) AS value
        ),
        NULLIF(receipt.result_payload->>'timeRecordId', '')::uuid,
        NULLIF(receipt.result_payload->>'revisionNumber', '')::bigint,
        true;
    END IF;
    RETURN;
  END IF;


  IF EXISTS (SELECT 1 FROM taptime_server.memberships m WHERE m.organization_id=requested_organization_id
    AND m.user_id=affected_user_id AND m.revoked_at IS NOT NULL
    AND (requested_stopped_at>m.revoked_at OR EXISTS (SELECT 1 FROM taptime_server.work_events e
      WHERE e.organization_id=requested_organization_id AND e.id=ANY(requested_review_item_ids) AND e.occurred_at>m.revoked_at))) THEN
    RETURN QUERY SELECT 'after_departure'::text,requested_resolution,NULL::uuid[],NULL::uuid,NULL::bigint,false;
    RETURN;
  END IF;
  SELECT pg_catalog.count(*)
  INTO unresolved_item_count
  FROM taptime_server.work_events AS event
  WHERE event.organization_id = requested_organization_id
    AND event.id = ANY(requested_review_item_ids)
    AND NOT EXISTS (
      SELECT 1 FROM taptime_server.offline_review_adjudications AS adjudication
      WHERE adjudication.organization_id = event.organization_id
        AND adjudication.work_event_id = event.id
    );
  IF unresolved_item_count <> pg_catalog.cardinality(requested_review_item_ids) THEN
    RETURN QUERY SELECT 'conflict'::text, requested_resolution,
      NULL::uuid[], NULL::uuid, NULL::bigint, false;
    RETURN;
  END IF;

  SELECT pg_catalog.array_agg(prefix.work_event_id ORDER BY prefix.recorded_at, prefix.work_event_id)
  INTO expected_prefix
  FROM (
    SELECT event.id AS work_event_id, event.received_at AS recorded_at
    FROM taptime_server.work_events AS event
    LEFT JOIN taptime_server.canonical_decisions AS decision
      ON decision.organization_id = event.organization_id
     AND decision.actor_user_id = event.triggered_by_user_id
     AND decision.work_event_id = event.id
     AND decision.decision_type = 'escalation_required'
    WHERE event.organization_id = requested_organization_id
      AND event.triggered_by_user_id = affected_user_id
      AND (
        decision.work_event_id IS NOT NULL
        OR (
          EXISTS (
            SELECT 1 FROM taptime_server.audit_events AS audit
            WHERE audit.organization_id = event.organization_id
              AND audit.work_event_id = event.id
              AND audit.event_type = 'LifecycleDeferred'
              AND audit.entity_type = 'WorkEvent'
          )
          AND NOT EXISTS (
            SELECT 1 FROM taptime_server.canonical_decisions AS other_decision
            WHERE other_decision.organization_id = event.organization_id
              AND other_decision.work_event_id = event.id
          )
        )
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
    ORDER BY event.received_at, event.id
    LIMIT pg_catalog.cardinality(requested_review_item_ids)
  ) AS prefix;

  IF expected_prefix IS DISTINCT FROM requested_review_item_ids THEN
    RETURN QUERY SELECT 'conflict'::text, requested_resolution,
      NULL::uuid[], NULL::uuid, NULL::bigint, false;
    RETURN;
  END IF;

  IF requested_resolution = 'adjust_existing_time_record' THEN
    IF pg_catalog.cardinality(affected_target_types) <> 1
      OR pg_catalog.cardinality(affected_target_ids) <> 1
    THEN
      RETURN QUERY SELECT 'invalid_evidence'::text, requested_resolution,
        NULL::uuid[], NULL::uuid, NULL::bigint, false;
      RETURN;
    END IF;
    SELECT candidate.* INTO record
    FROM taptime_server.effective_time_records_v1 AS candidate
    WHERE candidate.organization_id = requested_organization_id
      AND candidate.time_record_id = requested_time_record_id;
    IF NOT FOUND
      OR record.user_id <> affected_user_id
      OR record.target_type <> affected_target_types[1]
      OR record.target_customer_id <> affected_target_ids[1]
      OR record.status <> 'stopped'
    THEN
      RETURN QUERY SELECT 'invalid_evidence'::text, requested_resolution,
        NULL::uuid[], NULL::uuid, NULL::bigint, false;
      RETURN;
    END IF;
    IF record.canonical_time_entry_id IS NOT NULL THEN
      PERFORM 1 FROM taptime_server.time_entries AS entry
      WHERE entry.organization_id = requested_organization_id
        AND entry.id = requested_time_record_id
      FOR SHARE;
    ELSE
      PERFORM 1 FROM taptime_server.time_record_revisions AS revision
      WHERE revision.organization_id = requested_organization_id
        AND revision.time_record_id = requested_time_record_id
        AND revision.revision_number = record.effective_revision_number
      FOR SHARE;
    END IF;
    SELECT candidate.* INTO record
    FROM taptime_server.effective_time_records_v1 AS candidate
    WHERE candidate.organization_id = requested_organization_id
      AND candidate.time_record_id = requested_time_record_id;
    IF record.base_row_version <> requested_expected_base_row_version
      OR record.effective_revision_number <> requested_expected_revision_number
    THEN
      RETURN QUERY SELECT 'conflict'::text, requested_resolution,
        NULL::uuid[], record.time_record_id, record.effective_revision_number, false;
      RETURN;
    END IF;
    IF record.effective_started_at = requested_started_at
      AND record.effective_stopped_at = requested_stopped_at
    THEN
      RETURN QUERY SELECT 'invalid_evidence'::text, requested_resolution,
        NULL::uuid[], NULL::uuid, NULL::bigint, false;
      RETURN;
    END IF;
    from_started_at := record.effective_started_at;
    from_stopped_at := record.effective_stopped_at;
    next_revision := record.effective_revision_number + 1;
    resulting_time_record_id := record.time_record_id;
    resulting_revision_number := next_revision;
    INSERT INTO taptime_server.time_record_revisions (
      organization_id, time_record_id, revision_number, canonical_time_entry_id,
      user_id, target_type, target_customer_id, effective_started_at,
      effective_stopped_at, base_row_version, actor_user_id, actor_membership_id,
      reason, previous_revision_number, command_id, request_hash
    ) VALUES (
      requested_organization_id, record.time_record_id, next_revision,
      record.canonical_time_entry_id, record.user_id, record.target_type,
      record.target_customer_id, requested_started_at, requested_stopped_at,
      record.base_row_version, requested_actor_user_id, requested_membership_id,
      requested_reason, NULLIF(next_revision - 1, 0), requested_command_id,
      requested_request_hash
    );
  ELSIF requested_resolution = 'create_recovered_time_record' THEN
    IF pg_catalog.cardinality(affected_target_types) <> 1
      OR pg_catalog.cardinality(affected_target_ids) <> 1
    THEN
      RETURN QUERY SELECT 'invalid_evidence'::text, requested_resolution,
        NULL::uuid[], NULL::uuid, NULL::bigint, false;
      RETURN;
    END IF;
    resulting_time_record_id := pg_catalog.gen_random_uuid();
    resulting_revision_number := 1;
    INSERT INTO taptime_server.time_record_revisions (
      organization_id, time_record_id, revision_number, canonical_time_entry_id,
      user_id, target_type, target_customer_id, effective_started_at,
      effective_stopped_at, base_row_version, actor_user_id, actor_membership_id,
      reason, previous_revision_number, command_id, request_hash
    ) VALUES (
      requested_organization_id, resulting_time_record_id, 1, NULL,
      affected_user_id, affected_target_types[1], affected_target_ids[1],
      requested_started_at, requested_stopped_at, 0, requested_actor_user_id,
      requested_membership_id, requested_reason, NULL, requested_command_id,
      requested_request_hash
    );
  END IF;

  INSERT INTO taptime_server.offline_review_adjudications (
    organization_id, work_event_id, user_id, target_type, target_customer_id,
    source_family, installation_id, device_sequence, actor_user_id,
    actor_membership_id, resolution, reason, command_id, time_record_id,
    revision_number
  )
  SELECT event.organization_id, event.id, event.triggered_by_user_id,
         event.target_type, event.target_customer_id, 'server_legacy', NULL, NULL,
         requested_actor_user_id, requested_membership_id, requested_resolution,
         requested_reason, requested_command_id, resulting_time_record_id,
         resulting_revision_number
  FROM taptime_server.work_events AS event
  WHERE event.organization_id = requested_organization_id
    AND event.id = ANY(requested_review_item_ids);

  INSERT INTO taptime_server.audit_events (
    id, organization_id, actor_user_id, event_type, entity_type, entity_id,
    occurred_at, correlation_id, payload
  ) VALUES (
    pg_catalog.gen_random_uuid(), requested_organization_id, requested_actor_user_id,
    'TimeReviewAdjudicated', 'TimeReviewCommand', requested_command_id,
    pg_catalog.transaction_timestamp(), requested_command_id::text,
    pg_catalog.jsonb_build_object(
      'schemaVersion', 1,
      'commandId', requested_command_id,
      'sourceFamily', 'server_legacy',
      'resolution', requested_resolution,
      'reviewItemIds', requested_review_item_ids,
      'timeRecordId', resulting_time_record_id,
      'revisionNumber', resulting_revision_number,
      'from', CASE WHEN from_started_at IS NULL THEN NULL ELSE pg_catalog.jsonb_build_object(
        'startedAt', from_started_at, 'stoppedAt', from_stopped_at
      ) END,
      'to', CASE WHEN resulting_time_record_id IS NULL THEN NULL ELSE pg_catalog.jsonb_build_object(
        'startedAt', requested_started_at, 'stoppedAt', requested_stopped_at
      ) END,
      'reason', requested_reason
    )
  );

  INSERT INTO taptime_server.time_review_command_receipts (
    organization_id, command_id, actor_user_id, actor_membership_id,
    command_type, request_hash, result_payload
  ) VALUES (
    requested_organization_id, requested_command_id, requested_actor_user_id,
    requested_membership_id, 'adjudication', requested_request_hash,
    pg_catalog.jsonb_build_object(
      'resolution', requested_resolution,
      'reviewItemIds', requested_review_item_ids,
      'timeRecordId', COALESCE(resulting_time_record_id::text, ''),
      'revisionNumber', COALESCE(resulting_revision_number::text, '')
    )
  );

  RETURN QUERY SELECT 'committed'::text, requested_resolution,
    requested_review_item_ids, resulting_time_record_id,
    resulting_revision_number, false;
END
$adjudication$;


-- The detail projection must follow the same last-home scope as the person calendar.
CREATE OR REPLACE FUNCTION taptime_server.read_time_record_details_v1(requested_ids uuid[])
RETURNS TABLE(time_record_id uuid, details jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog
AS $details$
DECLARE
  org uuid := nullif(current_setting('app.organization_id',true),'')::uuid;
  actor_user uuid := nullif(current_setting('app.user_id',true),'')::uuid;
  actor_id uuid := nullif(current_setting('app.membership_id',true),'')::uuid;
  runtime_role text := current_setting('role',true);
  actor_role text;
  own_only boolean := false;
  location_scope uuid[];
BEGIN
  IF requested_ids IS NULL OR cardinality(requested_ids)>10001 THEN RETURN; END IF;
  SELECT m.role INTO actor_role FROM taptime_server.memberships m
    WHERE m.organization_id=org AND m.id=actor_id AND m.user_id=actor_user AND m.revoked_at IS NULL;
  IF NOT FOUND THEN RETURN; END IF;
  -- Resolve row-independent authority once, including when PostgreSQL uses a generic plan.
  CASE runtime_role
    WHEN 'taptime_mobile_own_time_reader' THEN own_only := true;
    WHEN 'taptime_time_review_reader' THEN
      SELECT CASE WHEN coalesce(bool_or(s.scope_kind='organization'),false) THEN NULL::uuid[]
        ELSE coalesce(array_agg(s.location_id) FILTER (WHERE s.scope_kind='location' AND s.location_id IS NOT NULL),ARRAY[]::uuid[]) END
        INTO location_scope
        FROM taptime_server.has_time_management_authority_v1(org,actor_user,actor_id,NULL) s;
      IF cardinality(location_scope)=0 THEN RETURN; END IF;
    WHEN 'taptime_time_exporter' THEN
      IF taptime_server.has_current_time_export_authority(org) IS NOT TRUE THEN RETURN; END IF;
    WHEN 'taptime_membership_manager' THEN
      SELECT CASE WHEN coalesce(bool_or(s.scope_kind='organization'),false) THEN NULL::uuid[]
        ELSE coalesce(array_agg(s.location_id) FILTER (WHERE s.scope_kind='location' AND s.location_id IS NOT NULL),ARRAY[]::uuid[]) END
        INTO location_scope
        FROM taptime_server.has_membership_management_authority_v1(org,actor_user,actor_id,'read',NULL,NULL,NULL) s
        WHERE s.scope_kind IN ('organization','location');
      IF cardinality(location_scope)=0 THEN RETURN; END IF;
    ELSE RETURN;
  END CASE;
  RETURN QUERY
  SELECT r.time_record_id,jsonb_build_object(
    'origin',CASE WHEN o.origin='backfilled' THEN 'backfilled' WHEN r.source='recovered' THEN 'recovered'
      WHEN r.started_via='manual' OR r.stopped_via='manual' THEN 'manual' ELSE 'nfc' END,
    'baseRowVersion',r.base_row_version,'effectiveRevisionNumber',r.effective_revision_number,
    'comment',c.comment,
    'changed',stopped.time_entry_id IS NOT NULL OR r.effective_revision_number > CASE WHEN r.source='recovered' THEN 1 ELSE 0 END,
    'change',CASE WHEN rev.time_record_id IS NULL THEN NULL ELSE jsonb_build_object(
      'at',to_char(rev.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'reason',rev.reason,'actor',CASE WHEN o.origin='backfilled' AND rev.revision_number=1
        THEN o.created_by ELSE 'administration' END) END,
    'overlapsAnotherRecord',EXISTS(
      -- Unrevised canonical entries can use their indexed original start directly.
      SELECT 1 FROM taptime_server.time_entries other
      WHERE other.organization_id=r.organization_id AND other.user_id=r.user_id AND other.id<>r.time_record_id
        AND other.started_at < coalesce(r.effective_stopped_at,'infinity'::timestamptz)
        AND (other.status='started' OR other.stopped_at>r.effective_started_at)
        AND NOT EXISTS (SELECT 1 FROM taptime_server.time_record_revisions revised
          WHERE revised.organization_id=other.organization_id AND revised.time_record_id=other.id)
      UNION ALL
      -- A revision in the interval counts only if no newer revision exists, even outside it.
      SELECT 1 FROM taptime_server.time_record_revisions other
      LEFT JOIN taptime_server.time_entries canonical
        ON canonical.organization_id=other.organization_id AND canonical.id=other.canonical_time_entry_id
      WHERE other.organization_id=r.organization_id AND other.user_id=r.user_id AND other.time_record_id<>r.time_record_id
        AND other.effective_started_at < coalesce(r.effective_stopped_at,'infinity'::timestamptz)
        AND (canonical.status='started' OR other.effective_stopped_at>r.effective_started_at)
        AND NOT EXISTS (SELECT 1 FROM taptime_server.time_record_revisions newer
          WHERE newer.organization_id=other.organization_id AND newer.time_record_id=other.time_record_id
            AND newer.revision_number>other.revision_number)))
    || CASE WHEN stopped.time_entry_id IS NULL THEN '{}'::jsonb ELSE jsonb_build_object(
      'administrationStop',jsonb_build_object('at',to_char(stopped.action_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'reason',stopped.reason)) END
  FROM taptime_server.effective_time_records_v2 r
  LEFT JOIN taptime_server.administration_stop_commands stopped ON stopped.organization_id=r.organization_id AND stopped.time_entry_id=r.time_record_id
  LEFT JOIN taptime_server.time_record_origins o ON o.organization_id=r.organization_id AND o.time_record_id=r.time_record_id
  LEFT JOIN taptime_server.time_record_revisions rev ON rev.organization_id=r.organization_id AND rev.time_record_id=r.time_record_id AND rev.revision_number=r.effective_revision_number
  LEFT JOIN LATERAL (SELECT c.comment FROM taptime_server.time_record_comments c WHERE c.organization_id=r.organization_id AND c.time_record_id=r.time_record_id ORDER BY c.comment_number DESC LIMIT 1) c ON true
  WHERE r.organization_id=org AND r.time_record_id=ANY(requested_ids)
    AND (NOT own_only OR r.user_id=actor_user)
    AND (location_scope IS NULL OR EXISTS (
      SELECT 1 FROM taptime_server.memberships target JOIN taptime_server.membership_home_location_assignments h
        ON h.organization_id=target.organization_id AND h.membership_id=target.id
        AND h.location_id=taptime_server.membership_management_home_v1(org,target.id)
        AND (target.revoked_at IS NULL OR taptime_server.departure_is_visible_v1(target.revoked_at))
      WHERE target.organization_id=org AND target.user_id=r.user_id AND h.location_id=ANY(location_scope)));
END
$details$;

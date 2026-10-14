-- T-116b: linguistic name ordering and own-time writes for location managers.
-- Full definitions preserve function ownership, ACLs, roles, history and read authority.
-- Both deployed image families must provide the same named ICU collation.
DO $collation$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_collation WHERE collname='und-x-icu' AND collprovider='i') THEN
    RAISE EXCEPTION 'T-116b requires ICU collation und-x-icu';
  END IF;
END
$collation$;

CREATE OR REPLACE FUNCTION taptime_server.backfill_time_record_v1(request jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
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
  IF actor_role='standortleitung' AND actor_user IS DISTINCT FROM target_user AND NOT EXISTS (
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
  IF char_length(reason) > 500 THEN
    RETURN jsonb_build_object('status','reason_required');
  END IF;
  IF reason IS NULL OR reason !~ U&'[^\0001-\0020\007f-\00a0\1680\2000-\200f\2028-\202f\205f\2060-\206f\3000\feff]' THEN
    IF actor_role='standortleitung' AND actor_user IS DISTINCT FROM target_user THEN
      RETURN jsonb_build_object('status','reason_required');
    END IF;
    reason := CASE WHEN actor_user=target_user THEN 'Selbst nachgetragen' ELSE 'Kein Grund angegeben' END;
  END IF;
  IF comment_text IS NOT NULL AND (comment_text !~ U&'[^\0001-\0020\007f-\00a0\1680\2000-\200f\2028-\202f\205f\2060-\206f\3000\feff]' OR actor_user IS DISTINCT FROM target_user OR char_length(btrim(comment_text)) NOT BETWEEN 1 AND 500) THEN
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
      reason,command,
      encode(sha256(convert_to(request::text,'UTF8')),'hex'));
  INSERT INTO taptime_server.time_record_origins(organization_id,time_record_id,origin,created_by) VALUES(org,record_id,'backfilled',CASE WHEN actor_user=target_user THEN 'self' ELSE 'administration' END);
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
$function$;

CREATE OR REPLACE FUNCTION taptime_server.correct_time_record_v1(requested_organization_id uuid, requested_actor_user_id uuid, requested_membership_id uuid, requested_command_id uuid, requested_request_hash text, requested_time_record_id uuid, requested_expected_base_row_version bigint, requested_expected_revision_number bigint, requested_started_at timestamp with time zone, requested_stopped_at timestamp with time zone, requested_reason text)
 RETURNS TABLE(result_status text, time_record_id uuid, revision_number bigint, effective_started_at timestamp with time zone, effective_stopped_at timestamp with time zone, idempotent_retry boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  receipt taptime_server.time_review_command_receipts%ROWTYPE;
  record taptime_server.effective_time_records_v1%ROWTYPE;
  next_revision bigint;
  actor_role text;
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
    requested_organization_id, requested_actor_user_id, requested_membership_id,
    CASE WHEN record.user_id = requested_actor_user_id THEN NULL ELSE record.user_id END
  )) THEN
    RETURN QUERY SELECT 'authority_rejected'::text, NULL::uuid, NULL::bigint,
      NULL::timestamptz, NULL::timestamptz, false;
    RETURN;
  END IF;
  SELECT membership.role INTO actor_role FROM taptime_server.memberships AS membership
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


  -- Ownership is determined from the loaded record, after authority and receipt checks.
  IF char_length(requested_reason) > 500 THEN
    RETURN QUERY SELECT 'reason_required'::text,NULL::uuid,NULL::bigint,NULL::timestamptz,NULL::timestamptz,false;
    RETURN;
  END IF;
  IF requested_reason IS NULL OR requested_reason !~ U&'[^\0001-\0020\007f-\00a0\1680\2000-\200f\2028-\202f\205f\2060-\206f\3000\feff]' THEN
    IF actor_role='standortleitung' AND record.user_id IS DISTINCT FROM requested_actor_user_id THEN
      RETURN QUERY SELECT 'reason_required'::text,NULL::uuid,NULL::bigint,NULL::timestamptz,NULL::timestamptz,false;
      RETURN;
    END IF;
    requested_reason := CASE WHEN record.user_id=requested_actor_user_id THEN 'Selbst geändert' ELSE 'Kein Grund angegeben' END;
  END IF;


  IF NOT isfinite(requested_started_at) OR NOT isfinite(requested_stopped_at)
    OR requested_started_at > requested_stopped_at
    OR requested_stopped_at > transaction_timestamp()
    OR requested_stopped_at - requested_started_at > interval '24 hours' THEN
    RETURN QUERY SELECT 'invalid_interval'::text,NULL::uuid,NULL::bigint,NULL::timestamptz,NULL::timestamptz,false;
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
$function$;

CREATE OR REPLACE FUNCTION taptime_server.prepare_administration_stop_v1(request jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
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
  actor_role text;
  reason text := request->>'reason';
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
  IF actor_user IS DISTINCT FROM target_user AND NOT EXISTS (SELECT 1 FROM taptime_server.has_time_management_authority_v1(org,actor_user,actor_member,target_user)) THEN
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
  SELECT m.role INTO actor_role FROM taptime_server.memberships m
    WHERE m.organization_id=org AND m.id=actor_member AND m.user_id=actor_user AND m.revoked_at IS NULL;
  IF ((reason IS NULL OR reason !~ U&'[^\0001-\0020\007f-\00a0\1680\2000-\200f\2028-\202f\205f\2060-\206f\3000\feff]')
      AND actor_role='standortleitung' AND entry.user_id IS DISTINCT FROM actor_user)
    OR char_length(reason)>500 THEN
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
$function$;

CREATE OR REPLACE FUNCTION taptime_server.read_customer_hours_v1(from_inclusive timestamp with time zone, to_exclusive timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
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
      || CASE WHEN actor_role='employee' THEN jsonb_build_object('days',(
        SELECT COALESCE(jsonb_agg(jsonb_build_object('date',day.date,'workDurationSeconds',day.seconds,'running',day.running) ORDER BY day.date),'[]'::jsonb)
        FROM (SELECT (record.effective_started_at AT TIME ZONE 'Europe/Berlin')::date AS date,
          sum(record.work_seconds)::bigint AS seconds,bool_or(record.effective_stopped_at IS NULL) AS running
          FROM visible_records record WHERE record.target_id=customer.id GROUP BY 1) day
      )) ELSE jsonb_build_object('people',(
        SELECT COALESCE(jsonb_agg(jsonb_build_object('membershipId',person.id,'displayName',person.display_name,
          'workDurationSeconds',person.seconds,'running',person.running) ORDER BY person.display_name COLLATE "und-x-icu",person.id),'[]'::jsonb)
        FROM (SELECT member.id,COALESCE(NULLIF(member.display_name,''),CASE member.role WHEN 'administrator' THEN 'Administrator' WHEN 'standortleitung' THEN 'Standortleitung' ELSE 'Mitarbeiter' END) AS display_name,
          sum(record.work_seconds)::bigint AS seconds,bool_or(record.effective_stopped_at IS NULL) AS running
          FROM visible_records record JOIN taptime_server.memberships member ON member.organization_id=org AND member.user_id=record.user_id
          WHERE record.target_id=customer.id GROUP BY member.id,member.display_name) person
      )) END AS value
    FROM visible_customers customer
    CROSS JOIN LATERAL (SELECT COALESCE(sum(record.work_seconds),0)::bigint AS seconds,
      COALESCE(bool_or(record.effective_stopped_at IS NULL),false) AS running
      FROM visible_records record WHERE record.target_id=customer.id) totals
    WHERE customer.active OR totals.seconds>0 OR totals.running
  ) item;
  RETURN jsonb_build_object('version','customer-hours.v1','scope',CASE WHEN actor_role='employee' THEN 'self' ELSE 'people' END,
    'asOf',to_char(transaction_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'customers',result);
END
$function$;

CREATE OR REPLACE FUNCTION taptime_server.read_managed_active_summary_v3(requested_location_id uuid, requested_is_running boolean, after_membership_id uuid, requested_limit integer)
 RETURNS TABLE(result_status text, server_time timestamp with time zone, running_count bigint, total_count bigint, membership_id uuid, membership_display_name text, membership_role text, location_id uuid, location_name text, is_running boolean, running_since timestamp with time zone, running_target_display_name text, departed_at timestamp with time zone, month_work_duration_seconds bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
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
    SELECT membership.id, membership.user_id, COALESCE(membership.display_name, CASE membership.role
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
  ), sorted_people AS MATERIALIZED (
    SELECT people.*, people.revoked_at IS NOT NULL AS departed,
      people.location_id IS NULL AS without_location,
      COALESCE(people.location_name,'') COLLATE "und-x-icu" AS location_sort,
      people.display_name COLLATE "und-x-icu" AS name_sort
    FROM people
  ), anchor AS (
    -- A visible anchor keeps its boundary even when its running state changes.
    SELECT * FROM sorted_people WHERE sorted_people.id = after_membership_id
  ), page AS MATERIALIZED (
    SELECT * FROM sorted_people
    WHERE (sorted_people.revoked_at IS NOT NULL OR requested_is_running IS NULL OR sorted_people.is_running = requested_is_running)
      AND (after_membership_id IS NULL OR
        (sorted_people.departed,sorted_people.without_location,sorted_people.location_sort,sorted_people.name_sort,sorted_people.id) >
        (SELECT anchor.departed,anchor.without_location,anchor.location_sort,anchor.name_sort,anchor.id FROM anchor))
    ORDER BY sorted_people.departed,sorted_people.without_location,sorted_people.location_sort,sorted_people.name_sort,sorted_people.id
    LIMIT requested_limit + 1
  ), month AS (
    SELECT date_trunc('month',transaction_timestamp() AT TIME ZONE 'Europe/Berlin') AS start_local
  ), totals AS (
    -- One set-based aggregate for the page, using the same start-month assignment
    -- and duration as 036 and payroll v3. Cancellations are absent from the view.
    SELECT record.user_id, sum(duration.work_seconds)::bigint AS seconds
    FROM taptime_server.effective_time_records_v2 record
    JOIN page ON page.user_id=record.user_id
    CROSS JOIN month
    CROSS JOIN LATERAL taptime_server.time_record_duration_v1(record.organization_id,
      record.canonical_time_entry_id,record.effective_started_at,record.effective_stopped_at) duration
    WHERE record.organization_id=org AND record.status='stopped' AND record.effective_stopped_at IS NOT NULL
      AND record.effective_started_at >= (month.start_local AT TIME ZONE 'Europe/Berlin')
      AND record.effective_started_at < ((month.start_local+interval '1 month') AT TIME ZONE 'Europe/Berlin')
    GROUP BY record.user_id
  )
  SELECT CASE WHEN after_membership_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM anchor)
      THEN 'invalid_request' ELSE 'succeeded' END,
    transaction_timestamp(), counts.running_count, counts.total_count,
    page.id, page.display_name, page.role, page.location_id, page.location_name,
    page.is_running, page.running_since, page.running_target, page.revoked_at,COALESCE(totals.seconds,0::bigint)
  FROM counts LEFT JOIN page ON true LEFT JOIN totals ON totals.user_id=page.user_id
  ORDER BY page.departed,page.without_location,page.location_sort,page.name_sort,page.id;
END
$function$;

CREATE OR REPLACE FUNCTION taptime_server.read_managed_active_summary_v4(requested_location_id uuid, requested_is_running boolean, after_membership_id uuid, requested_limit integer, from_inclusive timestamp with time zone, to_exclusive timestamp with time zone)
 RETURNS TABLE(result_status text, server_time timestamp with time zone, running_count bigint, total_count bigint, membership_id uuid, membership_display_name text, membership_role text, location_id uuid, location_name text, is_running boolean, running_since timestamp with time zone, running_target_display_name text, departed_at timestamp with time zone, month_work_duration_seconds bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
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
  IF requested_limit IS NULL OR requested_limit NOT BETWEEN 1 AND 20
    OR from_inclusive IS NULL OR to_exclusive IS NULL
    OR NOT isfinite(from_inclusive) OR NOT isfinite(to_exclusive)
    OR from_inclusive <> (date_trunc('month',from_inclusive AT TIME ZONE 'Europe/Berlin') AT TIME ZONE 'Europe/Berlin')
    OR to_exclusive <> ((date_trunc('month',from_inclusive AT TIME ZONE 'Europe/Berlin') + interval '1 month') AT TIME ZONE 'Europe/Berlin') THEN
    result_status := 'invalid_request'; RETURN NEXT; RETURN;
  END IF;

  RETURN QUERY
  WITH people AS MATERIALIZED (
    SELECT membership.id, membership.user_id, COALESCE(membership.display_name, CASE membership.role
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
  ), sorted_people AS MATERIALIZED (
    SELECT people.*, people.revoked_at IS NOT NULL AS departed,
      people.location_id IS NULL AS without_location,
      COALESCE(people.location_name,'') COLLATE "und-x-icu" AS location_sort,
      people.display_name COLLATE "und-x-icu" AS name_sort
    FROM people
  ), anchor AS (
    -- A visible anchor keeps its boundary even when its running state changes.
    SELECT * FROM sorted_people WHERE sorted_people.id = after_membership_id
  ), page AS MATERIALIZED (
    SELECT * FROM sorted_people
    WHERE (sorted_people.revoked_at IS NOT NULL OR requested_is_running IS NULL OR sorted_people.is_running = requested_is_running)
      AND (after_membership_id IS NULL OR
        (sorted_people.departed,sorted_people.without_location,sorted_people.location_sort,sorted_people.name_sort,sorted_people.id) >
        (SELECT anchor.departed,anchor.without_location,anchor.location_sort,anchor.name_sort,anchor.id FROM anchor))
    ORDER BY sorted_people.departed,sorted_people.without_location,sorted_people.location_sort,sorted_people.name_sort,sorted_people.id
    LIMIT requested_limit + 1
  ), totals AS (
    -- One set-based aggregate for the page, using the same start-month assignment
    -- and duration as 036 and payroll v3. Cancellations are absent from the view.
    SELECT record.user_id, sum(duration.work_seconds)::bigint AS seconds
    FROM taptime_server.effective_time_records_v2 record
    JOIN page ON page.user_id=record.user_id
    CROSS JOIN LATERAL taptime_server.time_record_duration_v1(record.organization_id,
      record.canonical_time_entry_id,record.effective_started_at,record.effective_stopped_at) duration
    WHERE record.organization_id=org AND record.status='stopped' AND record.effective_stopped_at IS NOT NULL
      AND record.effective_started_at >= from_inclusive
      AND record.effective_started_at < to_exclusive
    GROUP BY record.user_id
  )
  SELECT CASE WHEN after_membership_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM anchor)
      THEN 'invalid_request' ELSE 'succeeded' END,
    transaction_timestamp(), counts.running_count, counts.total_count,
    page.id, page.display_name, page.role, page.location_id, page.location_name,
    page.is_running, page.running_since, page.running_target, page.revoked_at,COALESCE(totals.seconds,0::bigint)
  FROM counts LEFT JOIN page ON true LEFT JOIN totals ON totals.user_id=page.user_id
  ORDER BY page.departed,page.without_location,page.location_sort,page.name_sort,page.id;
END
$function$;

CREATE OR REPLACE FUNCTION taptime_server.read_mobile_work_targets_v1(requested_organization_id uuid, requested_user_id uuid, requested_membership_id uuid, requested_after_type_rank integer, requested_after_display_name text, requested_after_target_id uuid, requested_limit integer)
 RETURNS TABLE(target_type text, target_id uuid, display_name text, row_version bigint)
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


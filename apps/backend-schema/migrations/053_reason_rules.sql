-- T-116a / D-134: live role and loaded ownership determine required reasons.
-- Full bodies from 052 (backfill/correction), 049 (prepare/void), 031 (commit).
-- Existing history is immutable; no data rows are changed by this migration.
ALTER TABLE taptime_server.time_record_voids
  DROP CONSTRAINT time_record_voids_reason_code_check,
  ADD CONSTRAINT time_record_voids_reason_code_check CHECK(reason_code IN ('duplicate','misscan','other','none')),
  DROP CONSTRAINT time_record_voids_check1,
  ADD CONSTRAINT time_record_voids_check1 CHECK(
    (reason_code='other' AND reason_text IS NOT NULL AND reason_text ~ '[^[:space:]]' AND char_length(reason_text) BETWEEN 1 AND 500)
    OR (reason_code IN ('duplicate','misscan','none') AND reason_text IS NULL));

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
$backfill$;
ALTER FUNCTION taptime_server.backfill_time_record_v1(jsonb)
  OWNER TO taptime_time_review_write_function_owner;
REVOKE ALL ON FUNCTION taptime_server.backfill_time_record_v1(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.backfill_time_record_v1(jsonb)
  TO taptime_time_review_writer;

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
    requested_organization_id, requested_actor_user_id, requested_membership_id, record.user_id
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
$correction$;
ALTER FUNCTION taptime_server.correct_time_record_v1(uuid, uuid, uuid, uuid, text, uuid, bigint, bigint, timestamp with time zone, timestamp with time zone, text)
  OWNER TO taptime_time_review_write_function_owner;
REVOKE ALL ON FUNCTION taptime_server.correct_time_record_v1(uuid, uuid, uuid, uuid, text, uuid, bigint, bigint, timestamp with time zone, timestamp with time zone, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.correct_time_record_v1(uuid, uuid, uuid, uuid, text, uuid, bigint, bigint, timestamp with time zone, timestamp with time zone, text)
  TO taptime_time_review_writer;

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
$prepare$;
ALTER FUNCTION taptime_server.prepare_administration_stop_v1(jsonb)
  OWNER TO taptime_time_review_write_function_owner;
REVOKE ALL ON FUNCTION taptime_server.prepare_administration_stop_v1(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.prepare_administration_stop_v1(jsonb)
  TO taptime_time_review_writer;
GRANT EXECUTE ON FUNCTION taptime_server.prepare_administration_stop_v1(jsonb)
  TO taptime_membership_management_function_owner;

CREATE OR REPLACE FUNCTION taptime_server.commit_administration_stop_v1(request jsonb, event jsonb, decision jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog
AS $commit$
DECLARE
  context jsonb := taptime_server.prepare_administration_stop_v1(request);
  entry jsonb := context->'activeTimeEntry';
  pause jsonb := context->'activeBreakInterval';
  org uuid := (entry->>'organizationId')::uuid;
  target_user uuid := (entry->>'userId')::uuid;
  event_id uuid := (event->>'id')::uuid;
  record_id uuid := (entry->>'id')::uuid;
  end_at timestamptz := (request->>'stoppedAt')::timestamptz;
  actor_user uuid := nullif(current_setting('app.user_id',true),'')::uuid;
  actor_member uuid := nullif(current_setting('app.membership_id',true),'')::uuid;
  acted_at timestamptz := clock_timestamp();
  receipt_id uuid := gen_random_uuid();
  expected_stop jsonb;
  expected_break jsonb;
  reason text := request->>'reason';
BEGIN
  IF context->>'status'<>'ready' THEN RETURN context; END IF;
  IF reason IS NULL OR reason !~ U&'[^\0001-\0020\007f-\00a0\1680\2000-\200f\2028-\202f\205f\2060-\206f\3000\feff]' THEN
    reason := CASE WHEN target_user=actor_user THEN 'Selbst beendet' ELSE 'Kein Grund angegeben' END;
  END IF;
  -- Consume the engine's exact result; never select a different record or fabricate a stop.
  expected_stop := entry || jsonb_build_object('status','stopped','stoppedAt',request->>'stoppedAt','stoppedByWorkEventId',event_id,'stoppedVia','administration');
  expected_break := CASE WHEN pause='null'::jsonb THEN NULL ELSE pause || jsonb_build_object('status','stopped',
    'stoppedAt',request->>'stoppedAt','stoppedByWorkEventId',event_id,'stoppedVia','administration') END;
  IF event_id IS NULL OR event IS DISTINCT FROM jsonb_build_object('id',event_id,'organizationId',org,
      'triggeredBy',target_user,'target',entry->'target','occurredAt',request->>'stoppedAt','trigger',jsonb_build_object('type','administration'))
    OR decision->>'status' IS DISTINCT FROM 'time_entry_stopped'
    OR decision->'timeEntry' IS DISTINCT FROM expected_stop
    OR decision->'closedBreakInterval' IS DISTINCT FROM expected_break THEN
    RETURN jsonb_build_object('status','invalid_request');
  END IF;
  INSERT INTO taptime_server.work_events(id,organization_id,triggered_by_user_id,target_type,target_customer_id,
    occurred_at,received_at,trigger_type,subject_type,content_hash,content_hash_algorithm,content_hash_version)
    VALUES(event_id,org,target_user,entry->'target'->>'targetType',(entry->'target'->>'targetId')::uuid,
      end_at,acted_at,'administration','work',encode(sha256(convert_to(event::text,'UTF8')),'hex'),'sha256',4);
  IF expected_break IS NOT NULL THEN
    UPDATE taptime_server.break_intervals SET status='stopped',stop_work_event_id=event_id,stopped_at=end_at,
      stopped_via='administration',row_version=row_version+1 WHERE organization_id=org AND id=(pause->>'id')::uuid;
  END IF;
  UPDATE taptime_server.time_entries SET status='stopped',stop_work_event_id=event_id,stopped_at=end_at,
    stopped_via='administration',row_version=row_version+1 WHERE organization_id=org AND id=record_id;
  INSERT INTO taptime_server.canonical_decisions(work_event_id,organization_id,actor_user_id,target_type,target_customer_id,
    decision_type,time_entry_id,break_interval_id,engine_version,decision_payload,subject_type)
    VALUES(event_id,org,target_user,entry->'target'->>'targetType',(entry->'target'->>'targetId')::uuid,
      'time_entry_stopped',record_id,(pause->>'id')::uuid,'taptime-core-t069',decision,'work');
  INSERT INTO taptime_server.sync_receipts(id,organization_id,user_id,target_type,target_customer_id,
    work_event_id,attempt_number,status,server_decision_work_event_id,server_time_entry_id,subject_type)
    VALUES(receipt_id,org,target_user,entry->'target'->>'targetType',(entry->'target'->>'targetId')::uuid,
      event_id,1,'synchronized',event_id,record_id,'work');
  INSERT INTO taptime_server.administration_stop_commands(organization_id,command_id,actor_user_id,actor_membership_id,
    user_id,time_entry_id,work_event_id,receipt_id,started_at,stopped_at,action_at,reason,request_payload)
    VALUES(org,(request->>'commandId')::uuid,actor_user,actor_member,target_user,record_id,event_id,receipt_id,
      (entry->>'startedAt')::timestamptz,end_at,acted_at,reason,request);
  INSERT INTO taptime_server.audit_events(id,organization_id,actor_user_id,work_event_user_id,work_event_id,
    event_type,entity_type,entity_id,occurred_at,correlation_id,payload)
    VALUES(gen_random_uuid(),org,actor_user,target_user,event_id,'TimeEntryStoppedByAdministration','TimeEntry',record_id,
      acted_at,request->>'commandId',jsonb_build_object('actorMembershipId',actor_member,'targetMembershipId',request->>'targetMembershipId',
        'timeRecordId',record_id,'stoppedAt',request->>'stoppedAt','reason',reason));
  -- Validate deferred lifecycle links while the narrow write function still owns the
  -- table-reading capability; the runtime login must not gain direct table access.
  SET CONSTRAINTS ALL IMMEDIATE;
  RETURN jsonb_build_object('status','committed','timeRecordId',record_id,'idempotentRetry',false);
END
$commit$;
ALTER FUNCTION taptime_server.commit_administration_stop_v1(jsonb,jsonb,jsonb) OWNER TO taptime_time_review_write_function_owner;
REVOKE ALL ON FUNCTION taptime_server.commit_administration_stop_v1(jsonb,jsonb,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.commit_administration_stop_v1(jsonb,jsonb,jsonb) TO taptime_time_review_writer;


CREATE OR REPLACE FUNCTION taptime_server.void_time_record_v1(request jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $void$
DECLARE
  org uuid:=NULLIF(current_setting('app.organization_id',true),'')::uuid;
  actor uuid:=NULLIF(current_setting('app.membership_id',true),'')::uuid;
  actor_user uuid:=NULLIF(current_setting('app.user_id',true),'')::uuid;
  command uuid; record_id uuid; live_role text; record_user uuid;
  record taptime_server.effective_time_records_v1%ROWTYPE;
  prior taptime_server.time_record_voids%ROWTYPE;
BEGIN
  IF current_setting('role',true) IS DISTINCT FROM 'taptime_time_review_writer'
    OR request->>'expectedMembershipId' IS DISTINCT FROM actor::text
    OR NOT taptime_server.has_time_void_authority_v1(org,actor_user)
  THEN RETURN jsonb_build_object('status','forbidden'); END IF;
  IF current_setting('transaction_isolation')<>'read committed' THEN RETURN jsonb_build_object('status','invalid_request'); END IF;
  IF jsonb_typeof(request) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(request))<>5 OR NOT request ?& ARRAY['expectedMembershipId','commandId','timeRecordId','reasonCode','reasonText'] THEN
    RETURN jsonb_build_object('status','invalid_request');
  END IF;
  command:=(request->>'commandId')::uuid;record_id:=(request->>'timeRecordId')::uuid;
  IF command IS NULL OR record_id IS NULL OR request->>'reasonCode' NOT IN ('duplicate','misscan','other')
    OR (request->>'reasonCode'='other' AND (jsonb_typeof(request->'reasonText') IS DISTINCT FROM 'string'
      OR char_length(request->>'reasonText') NOT BETWEEN 1 AND 500 OR request->>'reasonText' !~ U&'[^\0001-\0020\007f-\00a0\1680\2000-\200f\2028-\202f\205f\2060-\206f\3000\feff]'))
    OR (request->>'reasonCode' IS DISTINCT FROM 'other' AND request->'reasonText' IS DISTINCT FROM 'null'::jsonb)
  THEN RETURN jsonb_build_object('status','invalid_request'); END IF;
  SELECT * INTO record FROM taptime_server.effective_time_records_v1 r WHERE r.organization_id=org AND r.time_record_id=record_id;
  record_user:=record.user_id;
  IF NOT FOUND THEN SELECT user_id INTO record_user FROM taptime_server.time_record_voids WHERE organization_id=org AND time_record_id=record_id; END IF;
  IF record_user IS NULL OR NOT taptime_server.has_time_void_authority_v1(org,record_user)
    THEN RETURN jsonb_build_object('status','forbidden'); END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(org::text||chr(31)||record_user::text,0));
  PERFORM pg_advisory_xact_lock(hashtextextended(org::text||chr(30)||command::text,0));
  IF NOT taptime_server.has_time_void_authority_v1(org,record_user) THEN RETURN jsonb_build_object('status','forbidden'); END IF;
  SELECT role INTO live_role FROM taptime_server.memberships WHERE organization_id=org AND id=actor;
  SELECT * INTO prior FROM taptime_server.time_record_voids WHERE organization_id=org AND command_id=command;
  IF FOUND THEN
    IF prior.time_record_id=record_id AND prior.reason_code=coalesce(request->>'reasonCode','none')
      AND prior.reason_text IS NOT DISTINCT FROM request->>'reasonText' AND prior.actor_membership_id=actor THEN
      RETURN jsonb_build_object('status','committed','timeRecordId',record_id,'idempotentRetry',true);
    END IF;
    RETURN jsonb_build_object('status','command_id_conflict');
  END IF;
  IF EXISTS(SELECT 1 FROM taptime_server.time_record_voids WHERE organization_id=org AND time_record_id=record_id)
    THEN RETURN jsonb_build_object('status','already_voided'); END IF;
  SELECT * INTO record FROM taptime_server.effective_time_records_v1 r WHERE r.organization_id=org AND r.time_record_id=record_id;
  IF record.status<>'stopped' THEN RETURN jsonb_build_object('status','running'); END IF;
  IF taptime_server.has_open_time_review_in_interval_v1(org,record.user_id,record.effective_started_at,record.effective_stopped_at)
    THEN RETURN jsonb_build_object('status','review_open'); END IF;
  INSERT INTO taptime_server.time_record_voids(organization_id,time_record_id,reason_code,reason_text,actor_membership_id,actor_role,command_id)
    VALUES(org,record_id,coalesce(request->>'reasonCode','none'),request->>'reasonText',actor,live_role,command);
  RETURN jsonb_build_object('status','committed','timeRecordId',record_id,'idempotentRetry',false);
EXCEPTION WHEN invalid_text_representation THEN RETURN jsonb_build_object('status','invalid_request');
END $void$;
ALTER FUNCTION taptime_server.void_time_record_v1(jsonb)
  OWNER TO taptime_time_review_write_function_owner;
REVOKE ALL ON FUNCTION taptime_server.void_time_record_v1(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.void_time_record_v1(jsonb)
  TO taptime_time_review_writer;

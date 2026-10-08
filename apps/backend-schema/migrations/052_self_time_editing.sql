-- T-113 / D-131: optional reasons for own time, unchanged authority and history.
-- Explicit bodies from 049 (backfill/correction) and 042 (details).

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
  IF (actor_user IS DISTINCT FROM target_user OR reason IS NOT NULL) AND ((reason IS NULL OR reason !~ U&'[^\0001-\0020\007f-\00a0\1680\2000-\200f\2028-\202f\205f\2060-\206f\3000\feff]') OR char_length(btrim(reason)) NOT BETWEEN 1 AND 500) THEN
    RETURN jsonb_build_object('status','reason_required');
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
      coalesce(reason,'Selbst nachgetragen'),command,
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


  -- Ownership is determined from the loaded record, after authority and receipt checks.
  IF requested_reason IS NULL OR requested_reason !~ U&'[^\0001-\0020\007f-\00a0\1680\2000-\200f\2028-\202f\205f\2060-\206f\3000\feff]' THEN
    IF record.user_id IS DISTINCT FROM requested_actor_user_id THEN
      RETURN QUERY SELECT 'reason_required'::text,NULL::uuid,NULL::bigint,NULL::timestamptz,NULL::timestamptz,false;
      RETURN;
    END IF;
    requested_reason := 'Selbst geändert';
  END IF;
  IF char_length(btrim(requested_reason)) NOT BETWEEN 1 AND 500 THEN
    RETURN QUERY SELECT 'reason_required'::text,NULL::uuid,NULL::bigint,NULL::timestamptz,NULL::timestamptz,false;
    RETURN;
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
      'reason',rev.reason,'actor',CASE WHEN rev.actor_user_id=r.user_id THEN 'self' ELSE 'administration' END) END,
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

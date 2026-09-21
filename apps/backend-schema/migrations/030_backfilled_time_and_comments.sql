-- T-066 / D-070 / D-071. Supplemental evidence never enters the WorkEvent lifecycle.
-- Created by the commands below; revisions/comments append, origins never change.
-- Removal follows the time-record retention lifecycle (T-016), not an interactive delete.
CREATE TABLE taptime_server.time_record_origins (
  organization_id uuid NOT NULL,
  time_record_id uuid NOT NULL,
  revision_number bigint NOT NULL DEFAULT 1 CHECK (revision_number = 1),
  origin text NOT NULL CHECK (origin = 'backfilled'),
  created_by text NOT NULL CHECK (created_by IN ('self','administration')),
  PRIMARY KEY (organization_id,time_record_id),
  FOREIGN KEY (organization_id,time_record_id,revision_number)
    REFERENCES taptime_server.time_record_revisions(organization_id,time_record_id,revision_number)
);
CREATE TABLE taptime_server.time_record_comments (
  organization_id uuid NOT NULL,
  time_record_id uuid NOT NULL,
  comment_number bigint NOT NULL CHECK (comment_number > 0),
  user_id uuid NOT NULL,
  actor_membership_id uuid NOT NULL,
  comment text NOT NULL CHECK (char_length(btrim(comment)) BETWEEN 1 AND 500),
  command_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (organization_id,time_record_id,comment_number),
  UNIQUE (organization_id,command_id),
  FOREIGN KEY (organization_id,user_id,actor_membership_id)
    REFERENCES taptime_server.memberships(organization_id,user_id,id)
);
CREATE TABLE taptime_server.time_supplement_command_receipts (
  organization_id uuid NOT NULL,
  command_id uuid NOT NULL,
  actor_user_id uuid NOT NULL,
  actor_membership_id uuid NOT NULL,
  command_type text NOT NULL CHECK (command_type IN ('backfill','comment')),
  request_payload jsonb NOT NULL,
  result_payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (organization_id,command_id),
  FOREIGN KEY (organization_id,actor_user_id,actor_membership_id)
    REFERENCES taptime_server.memberships(organization_id,user_id,id)
);
DO $tables$
DECLARE name text;
BEGIN
  FOREACH name IN ARRAY ARRAY['time_record_origins','time_record_comments','time_supplement_command_receipts'] LOOP
    EXECUTE format('ALTER TABLE taptime_server.%I ENABLE ROW LEVEL SECURITY',name);
    EXECUTE format('ALTER TABLE taptime_server.%I FORCE ROW LEVEL SECURITY',name);
    EXECUTE format('CREATE TRIGGER immutable BEFORE UPDATE OR DELETE ON taptime_server.%I FOR EACH ROW EXECUTE FUNCTION taptime_server.reject_time_review_immutable_change()',name);
    EXECUTE format('REVOKE ALL ON taptime_server.%I FROM PUBLIC',name);
    EXECUTE format('GRANT SELECT, INSERT ON taptime_server.%I TO taptime_time_review_write_function_owner',name);
  END LOOP;
END
$tables$;
GRANT SELECT ON taptime_server.time_record_origins,taptime_server.time_record_comments,
  taptime_server.membership_home_location_assignments TO taptime_time_review_read_function_owner;
GRANT SELECT ON taptime_server.work_targets,taptime_server.effective_time_records_v2 TO taptime_time_review_write_function_owner;

CREATE FUNCTION taptime_server.backfill_time_record_v1(request jsonb)
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
  IF actor_role IS NULL OR actor_role NOT IN ('employee','administrator')
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
  IF command IS NULL OR start_at IS NULL OR stop_at IS NULL OR NOT isfinite(start_at) OR NOT isfinite(stop_at)
    OR start_at >= stop_at OR stop_at > transaction_timestamp() OR stop_at-start_at > interval '24 hours' THEN
    RETURN jsonb_build_object('status','invalid_interval');
  END IF;
  IF actor_role='employee' AND start_at < ((date_trunc('month',transaction_timestamp() AT TIME ZONE 'Europe/Berlin')-interval '1 month') AT TIME ZONE 'Europe/Berlin') THEN
    RETURN jsonb_build_object('status','outside_window');
  END IF;
  IF actor_role='administrator' AND (reason IS NULL OR char_length(btrim(reason)) NOT BETWEEN 1 AND 500) THEN
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

CREATE FUNCTION taptime_server.comment_time_record_v1(request jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog
AS $comment$
DECLARE
  org uuid := nullif(current_setting('app.organization_id',true),'')::uuid;
  actor_user uuid := nullif(current_setting('app.user_id',true),'')::uuid;
  actor_id uuid := nullif(current_setting('app.membership_id',true),'')::uuid;
  command uuid := (request->>'commandId')::uuid;
  record_id uuid := (request->>'timeRecordId')::uuid;
  comment_text text := request->>'comment';
  receipt taptime_server.time_supplement_command_receipts%ROWTYPE;
  result jsonb;
BEGIN
  IF current_setting('role',true) IS DISTINCT FROM 'taptime_time_review_writer'
    OR actor_id IS DISTINCT FROM (request->>'expectedMembershipId')::uuid
    OR NOT EXISTS (SELECT 1 FROM taptime_server.memberships m WHERE m.organization_id=org
      AND m.id=actor_id AND m.user_id=actor_user AND m.role IN ('employee','administrator') AND m.revoked_at IS NULL)
    OR NOT EXISTS (SELECT 1 FROM taptime_server.effective_time_records_v2 r WHERE r.organization_id=org
      AND r.time_record_id=record_id AND r.user_id=actor_user) THEN
    RETURN jsonb_build_object('status','authority_rejected');
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(org::text||chr(31)||actor_user::text,0));
  PERFORM pg_advisory_xact_lock(hashtextextended(org::text||chr(30)||command::text,0));
  SELECT * INTO receipt FROM taptime_server.time_supplement_command_receipts r
    WHERE r.organization_id=org AND r.command_id=command;
  IF FOUND THEN
    IF receipt.actor_membership_id=actor_id AND receipt.command_type='comment' AND receipt.request_payload=request THEN
      RETURN receipt.result_payload || jsonb_build_object('idempotentRetry',true);
    END IF;
    RETURN jsonb_build_object('status','command_id_conflict');
  END IF;
  IF command IS NULL OR comment_text IS NULL OR char_length(btrim(comment_text)) NOT BETWEEN 1 AND 500 THEN
    RETURN jsonb_build_object('status','invalid_comment');
  END IF;
  IF EXISTS (SELECT 1 FROM taptime_server.time_review_command_receipts r WHERE r.organization_id=org AND r.command_id=command) THEN
    RETURN jsonb_build_object('status','command_id_conflict');
  END IF;
  INSERT INTO taptime_server.time_record_comments(organization_id,time_record_id,comment_number,user_id,actor_membership_id,comment,command_id)
    SELECT org,record_id,coalesce(max(c.comment_number),0)+1,actor_user,actor_id,comment_text,command
    FROM taptime_server.time_record_comments c WHERE c.organization_id=org AND c.time_record_id=record_id;
  result := jsonb_build_object('status','committed','timeRecordId',record_id,'idempotentRetry',false);
  INSERT INTO taptime_server.time_supplement_command_receipts
    (organization_id,command_id,actor_user_id,actor_membership_id,command_type,request_payload,result_payload)
    VALUES(org,command,actor_user,actor_id,'comment',request,result);
  RETURN result;
END
$comment$;
ALTER FUNCTION taptime_server.backfill_time_record_v1(jsonb) OWNER TO taptime_time_review_write_function_owner;
ALTER FUNCTION taptime_server.comment_time_record_v1(jsonb) OWNER TO taptime_time_review_write_function_owner;
REVOKE ALL ON FUNCTION taptime_server.backfill_time_record_v1(jsonb),taptime_server.comment_time_record_v1(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.backfill_time_record_v1(jsonb),taptime_server.comment_time_record_v1(jsonb) TO taptime_time_review_writer;

-- Separate opt-in metadata: the old views, representations and v3 export remain untouched.
CREATE FUNCTION taptime_server.read_time_record_details_v1(requested_ids uuid[])
RETURNS TABLE(time_record_id uuid, details jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog
AS $details$
DECLARE
  org uuid := nullif(current_setting('app.organization_id',true),'')::uuid;
  actor_user uuid := nullif(current_setting('app.user_id',true),'')::uuid;
  actor_id uuid := nullif(current_setting('app.membership_id',true),'')::uuid;
  runtime_role text := current_setting('role',true);
BEGIN
  IF requested_ids IS NULL OR cardinality(requested_ids)>10001 THEN RETURN; END IF;
  RETURN QUERY
  SELECT r.time_record_id,jsonb_build_object(
    'origin',CASE WHEN o.origin='backfilled' THEN 'backfilled' WHEN r.source='recovered' THEN 'recovered'
      WHEN r.started_via='manual' OR r.stopped_via='manual' THEN 'manual' ELSE 'nfc' END,
    'baseRowVersion',r.base_row_version,'effectiveRevisionNumber',r.effective_revision_number,
    'comment',c.comment,
    'changed',r.effective_revision_number > CASE WHEN r.source='recovered' THEN 1 ELSE 0 END,
    'change',CASE WHEN rev.time_record_id IS NULL THEN NULL ELSE jsonb_build_object(
      'at',to_char(rev.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'reason',rev.reason,'actor',CASE WHEN o.origin='backfilled' AND rev.revision_number=1
        THEN o.created_by ELSE 'administration' END) END,
    'overlapsAnotherRecord',EXISTS(SELECT 1 FROM taptime_server.effective_time_records_v2 other
      WHERE other.organization_id=r.organization_id AND other.user_id=r.user_id AND other.time_record_id<>r.time_record_id
        AND other.effective_started_at < coalesce(r.effective_stopped_at,'infinity'::timestamptz)
        AND coalesce(other.effective_stopped_at,'infinity'::timestamptz)>r.effective_started_at))
  FROM taptime_server.effective_time_records_v2 r
  LEFT JOIN taptime_server.time_record_origins o ON o.organization_id=r.organization_id AND o.time_record_id=r.time_record_id
  LEFT JOIN taptime_server.time_record_revisions rev ON rev.organization_id=r.organization_id AND rev.time_record_id=r.time_record_id AND rev.revision_number=r.effective_revision_number
  LEFT JOIN taptime_server.memberships m ON m.organization_id=rev.organization_id AND m.id=rev.actor_membership_id
  LEFT JOIN LATERAL (SELECT c.comment FROM taptime_server.time_record_comments c WHERE c.organization_id=r.organization_id AND c.time_record_id=r.time_record_id ORDER BY c.comment_number DESC LIMIT 1) c ON true
  WHERE r.organization_id=org AND r.time_record_id=ANY(requested_ids)
    AND EXISTS (SELECT 1 FROM taptime_server.memberships live WHERE live.organization_id=org AND live.id=actor_id AND live.user_id=actor_user AND live.revoked_at IS NULL)
    AND CASE runtime_role
      WHEN 'taptime_mobile_own_time_reader' THEN r.user_id=actor_user
      WHEN 'taptime_time_review_reader' THEN EXISTS (SELECT 1 FROM taptime_server.memberships m WHERE m.organization_id=org AND m.id=actor_id AND m.user_id=actor_user AND m.role='administrator' AND m.revoked_at IS NULL)
      WHEN 'taptime_time_exporter' THEN taptime_server.has_current_time_export_authority(org)
      WHEN 'taptime_membership_manager' THEN EXISTS (
        SELECT 1 FROM taptime_server.has_membership_management_authority_v1(org,actor_user,actor_id,'read',NULL,NULL,NULL) s
        WHERE s.scope_kind='organization' OR (s.scope_kind='location' AND EXISTS (
          SELECT 1 FROM taptime_server.memberships target JOIN taptime_server.membership_home_location_assignments h
            ON h.organization_id=target.organization_id AND h.membership_id=target.id AND h.revoked_at IS NULL
          WHERE target.organization_id=org AND target.user_id=r.user_id AND h.location_id=s.location_id)))
      ELSE false END;
END
$details$;
GRANT EXECUTE ON FUNCTION taptime_server.has_current_time_export_authority(uuid),
  taptime_server.has_membership_management_authority_v1(uuid,uuid,uuid,text,uuid,text,uuid)
  TO taptime_time_review_read_function_owner;
ALTER FUNCTION taptime_server.read_time_record_details_v1(uuid[]) OWNER TO taptime_time_review_read_function_owner;
REVOKE ALL ON FUNCTION taptime_server.read_time_record_details_v1(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.read_time_record_details_v1(uuid[])
  TO taptime_mobile_own_time_reader,taptime_membership_manager,taptime_time_exporter,taptime_time_review_reader;

CREATE FUNCTION taptime_server.append_time_entry_export_audit_v4(
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
    OR requested_to_exclusive <= requested_from_inclusive
    OR requested_to_exclusive - requested_from_inclusive > taptime_server.maximum_calendar_month_range()
    OR requested_row_count NOT BETWEEN 0 AND 10000
    OR requested_byte_count NOT BETWEEN 1 AND 8388608
    OR requested_sha256 COLLATE "C" !~ '^[0-9a-f]{64}$'
  THEN
    RAISE EXCEPTION 'Time export v4 audit capability rejected' USING ERRCODE = '42501';
  END IF;

  INSERT INTO taptime_server.audit_events (
    id, organization_id, actor_user_id, event_type, entity_type, entity_id,
    occurred_at, correlation_id, payload
  ) VALUES (
    requested_audit_id, requested_organization_id, requested_actor_user_id,
    'TimeEntryExportGenerated', 'TimeEntryExport', requested_audit_id,
    pg_catalog.transaction_timestamp(), requested_correlation_id,
    pg_catalog.jsonb_build_object(
      'schemaVersion', 4,
      'fromInclusive', requested_from_inclusive,
      'toExclusive', requested_to_exclusive,
      'rowCount', requested_row_count,
      'byteCount', requested_byte_count,
      'sha256', requested_sha256
    )
  );
END
$audit$;

ALTER FUNCTION taptime_server.append_time_entry_export_audit_v4(
  uuid, uuid, uuid, text, timestamptz, timestamptz, integer, integer, text
) OWNER TO taptime_time_export_function_owner;
REVOKE ALL ON FUNCTION taptime_server.append_time_entry_export_audit_v4(
  uuid, uuid, uuid, text, timestamptz, timestamptz, integer, integer, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.append_time_entry_export_audit_v4(
  uuid, uuid, uuid, text, timestamptz, timestamptz, integer, integer, text
) TO taptime_time_exporter;

-- The new own-time window includes every date an employee may backfill.
CREATE FUNCTION taptime_server.read_mobile_own_time_v2(
  requested_organization_id uuid,
  requested_user_id uuid,
  requested_membership_id uuid,
  requested_window_started_at timestamptz,
  requested_window_ended_at timestamptz,
  requested_after_started_at timestamptz,
  requested_after_time_record_id uuid,
  requested_limit integer
)
RETURNS TABLE (
  row_kind text,
  time_record_id uuid,
  source text,
  target_type text,
  target_display_name text,
  status text,
  started_at timestamptz,
  stopped_at timestamptz,
  started_via text,
  stopped_via text,
  window_started_at timestamptz,
  window_ended_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $own_time$
DECLARE
  request_time timestamptz := pg_catalog.transaction_timestamp();
  boundary timestamptz := COALESCE(requested_window_ended_at, request_time);
  window_start timestamptz := COALESCE(
    requested_window_started_at,
    ((date_trunc('month',boundary AT TIME ZONE 'Europe/Berlin')-interval '1 month') AT TIME ZONE 'Europe/Berlin')
  );
BEGIN
  IF pg_catalog.current_setting('role', true) <> 'taptime_mobile_own_time_reader'
    OR NOT taptime_server.has_current_mobile_self_v1(
      requested_organization_id, requested_user_id, requested_membership_id
    )
    OR requested_limit NOT BETWEEN 1 AND 21
    OR (requested_after_started_at IS NULL) <> (requested_after_time_record_id IS NULL)
    OR (requested_window_started_at IS NULL) <> (requested_window_ended_at IS NULL)
    OR (requested_after_started_at IS NULL) <> (requested_window_ended_at IS NULL)
    OR (
      requested_window_ended_at IS NOT NULL
      AND (
        requested_window_started_at <> ((date_trunc('month',boundary AT TIME ZONE 'Europe/Berlin')-interval '1 month') AT TIME ZONE 'Europe/Berlin')
        OR requested_window_ended_at > request_time
        OR requested_window_ended_at < request_time - interval '63 days'
        OR requested_after_started_at < requested_window_started_at
        OR requested_after_started_at >= requested_window_ended_at
      )
    )
  THEN
    RAISE EXCEPTION 'Mobile own-time capability rejected' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT 'active'::text, record.time_record_id, record.source,
         record.target_type, target.display_name, record.status,
         record.effective_started_at, record.effective_stopped_at,
         record.started_via, record.stopped_via,
         window_start, boundary
  FROM taptime_server.effective_time_records_v2 AS record
  JOIN taptime_server.work_targets AS target
    ON target.organization_id = record.organization_id
   AND target.target_type = record.target_type
   AND target.target_id = record.target_id
  WHERE record.organization_id = requested_organization_id
    AND record.user_id = requested_user_id
    AND record.status = 'started'
  LIMIT 1;

  RETURN QUERY
  SELECT 'history'::text, record.time_record_id, record.source,
         record.target_type, target.display_name, record.status,
         record.effective_started_at, record.effective_stopped_at,
         record.started_via, record.stopped_via,
         window_start, boundary
  FROM taptime_server.effective_time_records_v2 AS record
  JOIN taptime_server.work_targets AS target
    ON target.organization_id = record.organization_id
   AND target.target_type = record.target_type
   AND target.target_id = record.target_id
  WHERE record.organization_id = requested_organization_id
    AND record.user_id = requested_user_id
    AND record.status = 'stopped'
    AND record.effective_started_at >= window_start
    AND record.effective_started_at < boundary
    AND (
      requested_after_started_at IS NULL
      OR (record.effective_started_at, record.time_record_id)
         < (requested_after_started_at, requested_after_time_record_id)
    )
  ORDER BY record.effective_started_at DESC, record.time_record_id DESC
  LIMIT requested_limit;
END
$own_time$;

ALTER FUNCTION taptime_server.read_mobile_own_time_v2(
  uuid, uuid, uuid, timestamptz, timestamptz, timestamptz, uuid, integer
) OWNER TO taptime_mobile_read_function_owner;
REVOKE ALL ON FUNCTION taptime_server.read_mobile_own_time_v2(
  uuid, uuid, uuid, timestamptz, timestamptz, timestamptz, uuid, integer
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.read_mobile_own_time_v2(
  uuid, uuid, uuid, timestamptz, timestamptz, timestamptz, uuid, integer
) TO taptime_mobile_own_time_reader;

-- T-069 / D-073 / D-076. The server's BusinessEngine supplies the stop decision.
-- Commands are created on successful administrative stops and are immutable thereafter.
-- Removal follows time-record retention (T-016); there is no interactive delete.
CREATE TABLE taptime_server.administration_stop_commands (
  organization_id uuid NOT NULL,
  command_id uuid NOT NULL,
  actor_user_id uuid NOT NULL,
  actor_membership_id uuid NOT NULL,
  user_id uuid NOT NULL,
  time_entry_id uuid NOT NULL,
  work_event_id uuid NOT NULL,
  receipt_id uuid NOT NULL,
  started_at timestamptz NOT NULL,
  stopped_at timestamptz NOT NULL,
  action_at timestamptz NOT NULL,
  reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 1 AND 500),
  request_payload jsonb NOT NULL,
  PRIMARY KEY (organization_id, command_id),
  UNIQUE (organization_id, time_entry_id),
  FOREIGN KEY (organization_id, actor_user_id, actor_membership_id)
    REFERENCES taptime_server.memberships(organization_id,user_id,id),
  FOREIGN KEY (organization_id,user_id,time_entry_id)
    REFERENCES taptime_server.time_entries(organization_id,user_id,id),
  FOREIGN KEY (organization_id,receipt_id)
    REFERENCES taptime_server.sync_receipts(organization_id,id),
  FOREIGN KEY (organization_id,user_id,work_event_id)
    REFERENCES taptime_server.work_events(organization_id,triggered_by_user_id,id)
);
CREATE INDEX administration_stop_person_boundary ON taptime_server.administration_stop_commands(organization_id,user_id,action_at);
ALTER TABLE taptime_server.administration_stop_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.administration_stop_commands FORCE ROW LEVEL SECURITY;
CREATE TRIGGER immutable BEFORE UPDATE OR DELETE ON taptime_server.administration_stop_commands
  FOR EACH ROW EXECUTE FUNCTION taptime_server.reject_time_review_immutable_change();
REVOKE ALL ON taptime_server.administration_stop_commands FROM PUBLIC;
GRANT SELECT, INSERT ON taptime_server.administration_stop_commands TO taptime_time_review_write_function_owner;
GRANT SELECT ON taptime_server.administration_stop_commands TO taptime_time_review_read_function_owner;
GRANT SELECT, INSERT ON taptime_server.sync_receipts TO taptime_time_review_write_function_owner;
GRANT SELECT ON taptime_server.administration_stop_commands TO taptime_wal_archive_function_owner;
GRANT SELECT ON taptime_server.break_intervals TO taptime_time_review_write_function_owner;
GRANT INSERT ON taptime_server.work_events,taptime_server.canonical_decisions TO taptime_time_review_write_function_owner;
GRANT UPDATE(status,stop_work_event_id,stopped_at,stopped_via,row_version)
  ON taptime_server.time_entries,taptime_server.break_intervals TO taptime_time_review_write_function_owner;

ALTER TABLE taptime_server.work_events
  DROP CONSTRAINT work_events_trigger_shape_v3,
  DROP CONSTRAINT work_events_content_hash_version_v3,
  ADD CONSTRAINT work_events_trigger_shape_v4 CHECK (
    (trigger_type='nfc' AND assignment_id IS NOT NULL AND nfc_tag_id IS NOT NULL)
    OR (trigger_type='manual' AND assignment_id IS NULL AND nfc_tag_id IS NULL)
    OR (trigger_type='administration' AND subject_type='work' AND assignment_id IS NULL AND nfc_tag_id IS NULL)
  ),
  ADD CONSTRAINT work_events_content_hash_version_v4 CHECK (
    content_hash_version IN (1,2,3,4)
    AND (content_hash_version=1)=(subject_type='work' AND trigger_type='nfc' AND target_type='customer')
    AND (content_hash_version=3)=(subject_type='break')
    AND (content_hash_version=4)=(trigger_type='administration')
  );
ALTER TABLE taptime_server.time_entries DROP CONSTRAINT time_entries_provenance_v2,
  ADD CONSTRAINT time_entries_provenance_v3 CHECK (
    started_via IN ('nfc','manual') AND (
      (status='started' AND stopped_via IS NULL)
      OR (status='stopped' AND stopped_via IN ('nfc','manual','administration'))));
ALTER TABLE taptime_server.break_intervals DROP CONSTRAINT break_intervals_stopped_via_check,
  ADD CONSTRAINT break_intervals_stopped_via_v2 CHECK (stopped_via IN ('nfc','manual','administration'));

CREATE FUNCTION taptime_server.prepare_administration_stop_v1(request jsonb)
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
  IF current_setting('role',true) IS DISTINCT FROM 'taptime_time_review_writer'
    OR actor_member IS DISTINCT FROM (request->>'expectedMembershipId')::uuid
    OR current_setting('app.membership_role',true) IS DISTINCT FROM 'administrator'
    OR NOT EXISTS (SELECT 1 FROM taptime_server.memberships m WHERE m.organization_id=org
      AND m.user_id=actor_user AND m.id=actor_member AND m.role='administrator' AND m.revoked_at IS NULL) THEN
    RETURN jsonb_build_object('status','authority_rejected');
  END IF;
  SELECT m.user_id INTO target_user FROM taptime_server.memberships m
    WHERE m.organization_id=org AND m.id=(request->>'targetMembershipId')::uuid;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','authority_rejected'); END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(org::text||chr(31)||target_user::text,0));
  PERFORM pg_advisory_xact_lock(hashtextextended(org::text||chr(30)||command::text,0));
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
ALTER FUNCTION taptime_server.prepare_administration_stop_v1(jsonb) OWNER TO taptime_time_review_write_function_owner;
REVOKE ALL ON FUNCTION taptime_server.prepare_administration_stop_v1(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.prepare_administration_stop_v1(jsonb) TO taptime_time_review_writer;

CREATE FUNCTION taptime_server.commit_administration_stop_v1(request jsonb, event jsonb, decision jsonb)
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
BEGIN
  IF context->>'status'<>'ready' THEN RETURN context; END IF;
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
      (entry->>'startedAt')::timestamptz,end_at,acted_at,request->>'reason',request);
  INSERT INTO taptime_server.audit_events(id,organization_id,actor_user_id,work_event_user_id,work_event_id,
    event_type,entity_type,entity_id,occurred_at,correlation_id,payload)
    VALUES(gen_random_uuid(),org,actor_user,target_user,event_id,'TimeEntryStoppedByAdministration','TimeEntry',record_id,
      acted_at,request->>'commandId',jsonb_build_object('actorMembershipId',actor_member,'targetMembershipId',request->>'targetMembershipId',
        'timeRecordId',record_id,'stoppedAt',request->>'stoppedAt','reason',request->>'reason'));
  -- Validate deferred lifecycle links while the narrow write function still owns the
  -- table-reading capability; the runtime login must not gain direct table access.
  SET CONSTRAINTS ALL IMMEDIATE;
  RETURN jsonb_build_object('status','committed','timeRecordId',record_id,'idempotentRetry',false);
END
$commit$;
ALTER FUNCTION taptime_server.commit_administration_stop_v1(jsonb,jsonb,jsonb) OWNER TO taptime_time_review_write_function_owner;
REVOKE ALL ON FUNCTION taptime_server.commit_administration_stop_v1(jsonb,jsonb,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.commit_administration_stop_v1(jsonb,jsonb,jsonb) TO taptime_time_review_writer;

ALTER TABLE taptime_server.canonical_decisions DROP CONSTRAINT canonical_decisions_result_shape_v3,
  ADD CONSTRAINT canonical_decisions_result_shape_v4 CHECK (
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

CREATE OR REPLACE FUNCTION taptime_server.validate_canonical_decision_result()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $validation$
DECLARE
  related_time_entry taptime_server.time_entries%ROWTYPE;
  related_break_interval taptime_server.break_intervals%ROWTYPE;
  related_work_event_occurred_at timestamptz;
BEGIN
  IF NEW.result_time_entry_id IS NOT NULL THEN
    SELECT entry.* INTO related_time_entry
    FROM taptime_server.time_entries AS entry
    WHERE entry.organization_id = NEW.organization_id
      AND entry.user_id = NEW.actor_user_id
      AND entry.id = NEW.result_time_entry_id;
  END IF;

  IF NEW.decision_type IN (
    'time_entry_started', 'time_entry_stopped', 'break_started', 'break_stopped'
  ) THEN
    SELECT event.occurred_at INTO related_work_event_occurred_at
    FROM taptime_server.work_events AS event
    WHERE event.organization_id = NEW.organization_id
      AND event.triggered_by_user_id = NEW.actor_user_id
      AND event.id = NEW.work_event_id;
  END IF;

  IF NEW.decision_type = 'time_entry_started' AND related_time_entry.id IS NOT NULL THEN
    IF related_time_entry.status <> 'started'
      OR related_time_entry.start_work_event_id <> NEW.work_event_id
      OR related_time_entry.started_at IS DISTINCT FROM related_work_event_occurred_at
      OR related_time_entry.target_type <> NEW.target_type
      OR related_time_entry.target_customer_id <> NEW.target_customer_id
    THEN
      RAISE EXCEPTION 'time_entry_started Decision does not match its started TimeEntry'
        USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.decision_type = 'time_entry_stopped' AND related_time_entry.id IS NOT NULL THEN
    IF related_time_entry.status <> 'stopped'
      OR related_time_entry.stop_work_event_id IS DISTINCT FROM NEW.work_event_id
      OR related_time_entry.stopped_at IS DISTINCT FROM related_work_event_occurred_at
      OR related_time_entry.target_type <> NEW.target_type
      OR related_time_entry.target_customer_id <> NEW.target_customer_id
    THEN
      RAISE EXCEPTION 'time_entry_stopped Decision does not match its stopped TimeEntry'
        USING ERRCODE = '23514';
    END IF;
    IF NEW.break_interval_id IS NOT NULL THEN
      SELECT b.* INTO related_break_interval FROM taptime_server.break_intervals b
        WHERE b.organization_id=NEW.organization_id AND b.user_id=NEW.actor_user_id AND b.id=NEW.break_interval_id;
      IF related_break_interval.id IS NULL OR related_break_interval.time_entry_id<>NEW.time_entry_id
        OR related_break_interval.status<>'stopped' OR related_break_interval.stop_work_event_id IS DISTINCT FROM NEW.work_event_id
        OR related_break_interval.stopped_at IS DISTINCT FROM related_work_event_occurred_at
        OR related_break_interval.stopped_via IS DISTINCT FROM 'administration'
        OR NOT EXISTS (SELECT 1 FROM taptime_server.work_events e WHERE e.organization_id=NEW.organization_id
          AND e.id=NEW.work_event_id AND e.trigger_type='administration') THEN
        RAISE EXCEPTION 'Administration decision does not match its closed break' USING ERRCODE='23514';
      END IF;
    END IF;
  ELSIF NEW.decision_type IN ('break_started', 'break_stopped') THEN
    SELECT interval.* INTO related_break_interval
    FROM taptime_server.break_intervals AS interval
    WHERE interval.organization_id = NEW.organization_id
      AND interval.user_id = NEW.actor_user_id
      AND interval.id = NEW.break_interval_id;
    IF related_break_interval.id IS NULL
      OR related_break_interval.time_entry_id <> NEW.time_entry_id
      OR (
        NEW.decision_type = 'break_started'
        AND (
          related_break_interval.start_work_event_id <> NEW.work_event_id
          OR related_break_interval.started_at IS DISTINCT FROM related_work_event_occurred_at
        )
      )
      OR (
        NEW.decision_type = 'break_stopped'
        AND (
          related_break_interval.status <> 'stopped'
          OR related_break_interval.stop_work_event_id IS DISTINCT FROM NEW.work_event_id
          OR related_break_interval.stopped_at IS DISTINCT FROM related_work_event_occurred_at
        )
      )
    THEN
      RAISE EXCEPTION 'Break Decision does not match its BreakInterval'
        USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.decision_type = 'active_entry_for_other_target_rejected'
    AND related_time_entry.id IS NOT NULL
  THEN
    IF related_time_entry.status <> 'started'
      OR (
        related_time_entry.target_type = NEW.target_type
        AND related_time_entry.target_customer_id = NEW.target_customer_id
      )
    THEN
      RAISE EXCEPTION 'other-target rejection does not match an active TimeEntry for another target'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END
$validation$;

-- Called after the same per-person advisory lock as lifecycle and administrative stop.
-- No target filter: a late device trigger must not silently start at another target either.
CREATE FUNCTION taptime_server.was_stopped_by_administration_v1(event_at timestamptz)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog
AS $boundary$
  SELECT current_setting('role',true) IN ('taptime_server_lifecycle','taptime_offline_event_ingestor')
    AND EXISTS (SELECT 1 FROM taptime_server.administration_stop_commands stopped
      WHERE stopped.organization_id=nullif(current_setting('app.organization_id',true),'')::uuid
        AND stopped.user_id=nullif(current_setting('app.user_id',true),'')::uuid
        AND event_at > stopped.started_at AND event_at < stopped.action_at);
$boundary$;
ALTER FUNCTION taptime_server.was_stopped_by_administration_v1(timestamptz) OWNER TO taptime_time_review_read_function_owner;
REVOKE ALL ON FUNCTION taptime_server.was_stopped_by_administration_v1(timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.was_stopped_by_administration_v1(timestamptz)
  TO taptime_server_lifecycle,taptime_offline_event_ingestor;

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
      IF actor_role <> 'administrator' THEN RETURN; END IF;
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
        ON h.organization_id=target.organization_id AND h.membership_id=target.id AND h.revoked_at IS NULL
      WHERE target.organization_id=org AND target.user_id=r.user_id AND h.location_id=ANY(location_scope)));
END
$details$;

CREATE OR REPLACE FUNCTION taptime_server.read_time_record_export_details_v1(requested_ids uuid[])
RETURNS TABLE(time_record_id uuid,details jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog
AS $export_details$
DECLARE
  org uuid := nullif(current_setting('app.organization_id',true),'')::uuid;
BEGIN
  IF current_setting('role',true) IS DISTINCT FROM 'taptime_time_exporter'
    OR requested_ids IS NULL OR cardinality(requested_ids)>10001 THEN RETURN; END IF;
  IF taptime_server.has_current_time_export_authority(org) IS NOT TRUE THEN RETURN; END IF;
  RETURN QUERY
  SELECT r.time_record_id,jsonb_build_object(
    'origin',CASE WHEN o.origin='backfilled' THEN 'backfilled' WHEN r.source='recovered' THEN 'recovered'
      WHEN r.started_via='manual' OR r.stopped_via='manual' THEN 'manual' ELSE 'nfc' END,
    'changed',stopped.time_entry_id IS NOT NULL OR r.effective_revision_number > CASE WHEN r.source='recovered' THEN 1 ELSE 0 END,
    'comment',c.comment)
  FROM taptime_server.effective_time_records_v2 r
  LEFT JOIN taptime_server.administration_stop_commands stopped ON stopped.organization_id=r.organization_id AND stopped.time_entry_id=r.time_record_id
  LEFT JOIN taptime_server.time_record_origins o ON o.organization_id=r.organization_id AND o.time_record_id=r.time_record_id
  LEFT JOIN LATERAL (SELECT c.comment FROM taptime_server.time_record_comments c
    WHERE c.organization_id=r.organization_id AND c.time_record_id=r.time_record_id
    ORDER BY c.comment_number DESC LIMIT 1) c ON true
  WHERE r.organization_id=org AND r.time_record_id=ANY(requested_ids);
END
$export_details$;



-- D-078: called only after the stop transaction commits. The command binds the
-- administrator to the target's immutable event and server-generated receipt.
CREATE FUNCTION taptime_server.record_administration_stop_archive_requirement_v1(request jsonb)
RETURNS TABLE(required_wal_file text, offsite_archived boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog
AS $requirement$
DECLARE
  committed record;
  current_cluster_system_identifier bigint;
  current_lsn pg_lsn;
  current_wal_file text;
BEGIN
  IF current_setting('role',true) IS DISTINCT FROM 'taptime_time_review_writer'
    OR current_setting('app.membership_role',true) IS DISTINCT FROM 'administrator' THEN
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
    AND actor.role='administrator' AND actor.revoked_at IS NULL
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
ALTER FUNCTION taptime_server.record_administration_stop_archive_requirement_v1(jsonb)
  OWNER TO taptime_wal_archive_function_owner;
REVOKE ALL ON FUNCTION taptime_server.record_administration_stop_archive_requirement_v1(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.record_administration_stop_archive_requirement_v1(jsonb)
  TO taptime_time_review_writer;

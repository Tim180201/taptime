-- T-088 / D-098. Members append a void within their current authority. There is
-- no update, deletion or undo capability. Migrations own the schema lifecycle.
CREATE TABLE taptime_server.time_record_voids (
  organization_id uuid NOT NULL REFERENCES taptime_server.organizations(id),
  time_record_id uuid NOT NULL,
  reason_code text NOT NULL CHECK(reason_code IN ('duplicate','misscan','other')),
  reason_text text,
  actor_membership_id uuid NOT NULL,
  actor_role text NOT NULL CHECK(actor_role IN ('employee','standortleitung','administrator')),
  voided_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  command_id uuid NOT NULL,
  -- Snapshot of the effective interval at cancellation; later legacy corrections
  -- cannot move the history marker to another day or person.
  user_id uuid NOT NULL REFERENCES taptime_server.users(id),
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  started_at timestamptz NOT NULL,
  stopped_at timestamptz NOT NULL,
  PRIMARY KEY(organization_id,time_record_id),
  UNIQUE(organization_id,command_id),
  FOREIGN KEY(organization_id,actor_membership_id) REFERENCES taptime_server.memberships(organization_id,id),
  FOREIGN KEY(organization_id,target_type,target_id) REFERENCES taptime_server.work_targets(organization_id,target_type,target_id),
  CHECK(stopped_at>=started_at),
  CHECK((reason_code='other' AND reason_text IS NOT NULL AND reason_text ~ '[^[:space:]]' AND char_length(reason_text) BETWEEN 1 AND 500)
    OR (reason_code<>'other' AND reason_text IS NULL))
);
ALTER TABLE taptime_server.time_record_voids ENABLE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.time_record_voids FORCE ROW LEVEL SECURITY;
CREATE TRIGGER time_record_voids_immutable BEFORE UPDATE OR DELETE ON taptime_server.time_record_voids
  FOR EACH ROW EXECUTE FUNCTION taptime_server.reject_time_review_immutable_change();

GRANT SELECT,INSERT ON taptime_server.time_record_voids TO taptime_time_review_write_function_owner;
GRANT SELECT ON taptime_server.organizations TO taptime_time_review_write_function_owner;
GRANT EXECUTE ON FUNCTION taptime_server.maximum_calendar_month_range() TO taptime_time_review_write_function_owner;

-- Both the write function and RLS resolve live membership, never trust a supplied
-- role. Own history is available to every role; management reuses migration 033.
CREATE FUNCTION taptime_server.has_time_void_authority_v1(requested_org uuid,requested_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $authority$
  SELECT EXISTS (
    SELECT 1 FROM taptime_server.memberships actor
    JOIN taptime_server.organizations org ON org.id=actor.organization_id AND org.status='active'
    WHERE actor.organization_id=requested_org
      AND actor.organization_id=NULLIF(current_setting('app.organization_id',true),'')::uuid
      AND actor.user_id=NULLIF(current_setting('app.user_id',true),'')::uuid
      AND actor.id=NULLIF(current_setting('app.membership_id',true),'')::uuid
      AND actor.role=current_setting('app.membership_role',true) AND actor.revoked_at IS NULL
      AND (actor.user_id=requested_user OR EXISTS (
        SELECT 1 FROM taptime_server.has_time_management_authority_v1(requested_org,actor.user_id,actor.id,requested_user)
      ))
  )
$authority$;
ALTER FUNCTION taptime_server.has_time_void_authority_v1(uuid,uuid) OWNER TO taptime_time_review_write_function_owner;
REVOKE ALL ON FUNCTION taptime_server.has_time_void_authority_v1(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.has_time_void_authority_v1(uuid,uuid) TO taptime_time_review_writer;

GRANT SELECT ON taptime_server.time_record_voids TO taptime_time_review_writer;
GRANT INSERT(organization_id,time_record_id,reason_code,reason_text,actor_membership_id,actor_role,command_id)
  ON taptime_server.time_record_voids TO taptime_time_review_writer;
CREATE POLICY time_void_read ON taptime_server.time_record_voids FOR SELECT TO taptime_time_review_writer
  USING(taptime_server.has_time_void_authority_v1(organization_id,user_id));
CREATE POLICY time_void_insert ON taptime_server.time_record_voids FOR INSERT TO taptime_time_review_writer
  WITH CHECK(taptime_server.has_time_void_authority_v1(organization_id,user_id)
    AND actor_membership_id=NULLIF(current_setting('app.membership_id',true),'')::uuid
    AND actor_role=current_setting('app.membership_role',true));

-- D-100: occurrence time in the effective interval, both endpoints included.
-- Match the unresolved definitions in 033 for offline, engine and legacy cases.
-- Only the write owner calls this helper; it has no direct runtime grant.
CREATE FUNCTION taptime_server.has_open_time_review_in_interval_v1(
  requested_org uuid,requested_user uuid,from_time timestamptz,to_time timestamptz
) RETURNS boolean LANGUAGE sql STABLE SET search_path=pg_catalog AS $open_review$
  SELECT EXISTS (
    SELECT 1 FROM taptime_server.work_events event
    WHERE event.organization_id=requested_org AND event.triggered_by_user_id=requested_user
      AND event.occurred_at BETWEEN from_time AND to_time
      AND NOT EXISTS (
        SELECT 1 FROM taptime_server.offline_review_adjudications adjudication
        WHERE adjudication.organization_id=event.organization_id AND adjudication.work_event_id=event.id
      )
      AND (
        EXISTS (
          SELECT 1 FROM taptime_server.offline_event_reconciliations reconciliation
          WHERE reconciliation.organization_id=event.organization_id AND reconciliation.work_event_id=event.id
            AND reconciliation.result_status='review_pending'
        ) OR (
          NOT EXISTS (
            SELECT 1 FROM taptime_server.offline_event_reconciliations reconciliation
            WHERE reconciliation.organization_id=event.organization_id AND reconciliation.work_event_id=event.id
          ) AND (
            EXISTS (
              SELECT 1 FROM taptime_server.canonical_decisions decision
              WHERE decision.organization_id=event.organization_id AND decision.work_event_id=event.id
                AND decision.decision_type='escalation_required'
            ) OR (
              NOT EXISTS (
                SELECT 1 FROM taptime_server.canonical_decisions decision
                WHERE decision.organization_id=event.organization_id AND decision.work_event_id=event.id
              ) AND EXISTS (
                SELECT 1 FROM taptime_server.audit_events audit
                WHERE audit.organization_id=event.organization_id AND audit.work_event_id=event.id
                  AND audit.event_type='LifecycleDeferred' AND audit.entity_type='WorkEvent'
              )
            )
          )
        )
      )
  )
$open_review$;
ALTER FUNCTION taptime_server.has_open_time_review_in_interval_v1(uuid,uuid,timestamptz,timestamptz)
  OWNER TO taptime_time_review_write_function_owner;
REVOKE ALL ON FUNCTION taptime_server.has_open_time_review_in_interval_v1(uuid,uuid,timestamptz,timestamptz) FROM PUBLIC;

-- Lifecycle ingestion (NFC/manual/offline), correction, adjudication and void
-- all lock hash(org || chr(31) || affected user). Keep this transaction lock at
-- the SQL sources too, so direct INSERT cannot race past the void predicate.
-- Review first: void waits, then reads the committed case with READ COMMITTED.
-- Void first: case insertion waits until the void commits; later evidence is
-- preserved as a later case, without rewriting/reverting the earlier void.
CREATE FUNCTION taptime_server.lock_time_review_creation_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $lock_review$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(
    NEW.organization_id::text||chr(31)||(to_jsonb(NEW)->>TG_ARGV[0]),0
  ));
  RETURN NEW;
END $lock_review$;
REVOKE ALL ON FUNCTION taptime_server.lock_time_review_creation_v1() FROM PUBLIC;
CREATE TRIGGER canonical_review_creation_lock BEFORE INSERT ON taptime_server.canonical_decisions
  FOR EACH ROW WHEN (NEW.decision_type='escalation_required')
  EXECUTE FUNCTION taptime_server.lock_time_review_creation_v1('actor_user_id');
CREATE TRIGGER offline_review_creation_lock BEFORE INSERT ON taptime_server.offline_event_reconciliations
  FOR EACH ROW WHEN (NEW.result_status='review_pending')
  EXECUTE FUNCTION taptime_server.lock_time_review_creation_v1('user_id');
CREATE TRIGGER legacy_review_creation_lock BEFORE INSERT ON taptime_server.audit_events
  FOR EACH ROW WHEN (NEW.event_type='LifecycleDeferred' AND NEW.entity_type='WorkEvent' AND NEW.work_event_user_id IS NOT NULL)
  EXECUTE FUNCTION taptime_server.lock_time_review_creation_v1('work_event_user_id');

-- The insert guard runs also for direct capability-role INSERTs. Snapshot fields
-- and timestamps are always derived in SQL, and the original record is untouched.
CREATE FUNCTION taptime_server.prepare_time_record_void_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $guard$
DECLARE record taptime_server.effective_time_records_v1%ROWTYPE; live_role text;
BEGIN
  IF current_setting('transaction_isolation')<>'read committed' THEN
    RAISE EXCEPTION 'Time void requires READ COMMITTED' USING ERRCODE='25001';
  END IF;
  SELECT * INTO record FROM taptime_server.effective_time_records_v1 r
    WHERE r.organization_id=NEW.organization_id AND r.time_record_id=NEW.time_record_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Void authority rejected' USING ERRCODE='42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.organization_id::text||chr(31)||record.user_id::text,0));
  IF NOT taptime_server.has_time_void_authority_v1(NEW.organization_id,record.user_id)
    OR NEW.actor_membership_id IS DISTINCT FROM NULLIF(current_setting('app.membership_id',true),'')::uuid
  THEN RAISE EXCEPTION 'Void authority rejected' USING ERRCODE='42501'; END IF;
  SELECT role INTO live_role FROM taptime_server.memberships WHERE organization_id=NEW.organization_id AND id=NEW.actor_membership_id;
  IF NEW.actor_role IS DISTINCT FROM live_role THEN RAISE EXCEPTION 'Void role rejected' USING ERRCODE='42501'; END IF;
  SELECT * INTO record FROM taptime_server.effective_time_records_v1 r
    WHERE r.organization_id=NEW.organization_id AND r.time_record_id=NEW.time_record_id;
  IF record.status<>'stopped' THEN RAISE EXCEPTION 'Running record' USING ERRCODE='23514'; END IF;
  IF taptime_server.has_open_time_review_in_interval_v1(NEW.organization_id,record.user_id,record.effective_started_at,record.effective_stopped_at)
    THEN RAISE EXCEPTION 'review_open' USING ERRCODE='23514'; END IF;
  NEW.user_id:=record.user_id; NEW.target_type:=record.target_type; NEW.target_id:=record.target_customer_id;
  NEW.started_at:=record.effective_started_at; NEW.stopped_at:=record.effective_stopped_at; NEW.voided_at:=clock_timestamp();
  RETURN NEW;
END $guard$;
ALTER FUNCTION taptime_server.prepare_time_record_void_v1() OWNER TO taptime_time_review_write_function_owner;
REVOKE ALL ON FUNCTION taptime_server.prepare_time_record_void_v1() FROM PUBLIC;
CREATE TRIGGER time_record_voids_prepare BEFORE INSERT ON taptime_server.time_record_voids
  FOR EACH ROW EXECUTE FUNCTION taptime_server.prepare_time_record_void_v1();

-- The audit is attached to insertion, so direct RLS writes have the same history.
CREATE FUNCTION taptime_server.audit_time_record_void_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $audit$
BEGIN
  INSERT INTO taptime_server.audit_events(id,organization_id,actor_user_id,event_type,entity_type,entity_id,occurred_at,correlation_id,payload)
    SELECT gen_random_uuid(),NEW.organization_id,m.user_id,'TimeRecordVoided','TimeRecord',NEW.time_record_id,NEW.voided_at,NEW.command_id::text,
      jsonb_build_object('schemaVersion',1,'timeRecordId',NEW.time_record_id,'commandId',NEW.command_id,
        'actorMembershipId',NEW.actor_membership_id,'actorRole',NEW.actor_role,'reasonCode',NEW.reason_code,'reasonText',NEW.reason_text)
    FROM taptime_server.memberships m WHERE m.organization_id=NEW.organization_id AND m.id=NEW.actor_membership_id;
  RETURN NEW;
END $audit$;
ALTER FUNCTION taptime_server.audit_time_record_void_v1() OWNER TO taptime_time_review_write_function_owner;
REVOKE ALL ON FUNCTION taptime_server.audit_time_record_void_v1() FROM PUBLIC;
CREATE TRIGGER time_record_voids_audit AFTER INSERT ON taptime_server.time_record_voids
  FOR EACH ROW EXECUTE FUNCTION taptime_server.audit_time_record_void_v1();

CREATE FUNCTION taptime_server.void_time_record_v1(request jsonb)
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
    OR request->>'reasonCode' IS NULL
    OR (request->>'reasonCode'='other' AND (jsonb_typeof(request->'reasonText') IS DISTINCT FROM 'string'
      OR char_length(request->>'reasonText') NOT BETWEEN 1 AND 500 OR request->>'reasonText' !~ '[^[:space:]]'))
    OR (request->>'reasonCode'<>'other' AND request->'reasonText' IS DISTINCT FROM 'null'::jsonb)
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
    IF prior.time_record_id=record_id AND prior.reason_code=request->>'reasonCode'
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
    VALUES(org,record_id,request->>'reasonCode',request->>'reasonText',actor,live_role,command);
  RETURN jsonb_build_object('status','committed','timeRecordId',record_id,'idempotentRetry',false);
EXCEPTION WHEN invalid_text_representation THEN RETURN jsonb_build_object('status','invalid_request');
END $void$;
ALTER FUNCTION taptime_server.void_time_record_v1(jsonb) OWNER TO taptime_time_review_write_function_owner;
REVOKE ALL ON FUNCTION taptime_server.void_time_record_v1(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.void_time_record_v1(jsonb) TO taptime_time_review_writer;

CREATE FUNCTION taptime_server.read_voided_time_records_v1(request jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $read$
DECLARE org uuid:=NULLIF(current_setting('app.organization_id',true),'')::uuid;
  actor uuid:=NULLIF(current_setting('app.membership_id',true),'')::uuid;
  target_user uuid; from_time timestamptz; to_time timestamptz; after_id uuid; page_limit integer; result jsonb;
BEGIN
  IF current_setting('role',true) IS DISTINCT FROM 'taptime_time_review_writer'
    OR request->>'expectedMembershipId' IS DISTINCT FROM actor::text
    THEN RETURN jsonb_build_object('status','forbidden'); END IF;
  SELECT user_id INTO target_user FROM taptime_server.memberships WHERE organization_id=org AND id=(request->>'targetMembershipId')::uuid;
  IF target_user IS NULL OR NOT taptime_server.has_time_void_authority_v1(org,target_user)
    THEN RETURN jsonb_build_object('status','forbidden'); END IF;
  from_time:=(request->>'fromInclusive')::timestamptz; to_time:=(request->>'toExclusive')::timestamptz;
  after_id:=(request->>'afterId')::uuid;page_limit:=(request->>'limit')::integer;
  IF from_time IS NULL OR to_time IS NULL OR NOT isfinite(from_time) OR NOT isfinite(to_time)
    OR to_time<=from_time OR to_time-from_time>taptime_server.maximum_calendar_month_range()
    OR page_limit IS NULL OR page_limit NOT BETWEEN 1 AND 100
    THEN RETURN jsonb_build_object('status','invalid_request'); END IF;
  WITH page AS (
    SELECT v.*,target.display_name AS target_name,coalesce(nullif(member.display_name,''),'Unbenannter Zugang') AS actor_name
    FROM taptime_server.time_record_voids v
    JOIN taptime_server.work_targets target ON target.organization_id=v.organization_id AND target.target_type=v.target_type AND target.target_id=v.target_id
    JOIN taptime_server.memberships member ON member.organization_id=v.organization_id AND member.id=v.actor_membership_id
    WHERE v.organization_id=org AND v.user_id=target_user AND v.started_at<to_time AND (v.stopped_at>from_time OR (v.started_at=v.stopped_at AND v.started_at>=from_time))
      AND (after_id IS NULL OR v.time_record_id>after_id)
    ORDER BY v.time_record_id LIMIT page_limit+1
  ), limited AS (SELECT * FROM page ORDER BY time_record_id LIMIT page_limit)
  SELECT jsonb_build_object('status','ready','records',coalesce(jsonb_agg(jsonb_build_object(
    'timeRecordId',time_record_id,'targetDisplayName',target_name,
    'startedAt',to_char(started_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'stoppedAt',to_char(stopped_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'voidedAt',to_char(voided_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'actorDisplayName',actor_name,'reasonCode',reason_code,'reasonText',reason_text) ORDER BY time_record_id),'[]'::jsonb),
    'nextAfterId',CASE WHEN (SELECT count(*) FROM page)>page_limit THEN (array_agg(time_record_id ORDER BY time_record_id DESC))[1] ELSE NULL END)
    INTO result FROM limited;
  RETURN result;
EXCEPTION WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow OR numeric_value_out_of_range
  THEN RETURN jsonb_build_object('status','invalid_request');
END $read$;
ALTER FUNCTION taptime_server.read_voided_time_records_v1(jsonb) OWNER TO taptime_time_review_write_function_owner;
REVOKE ALL ON FUNCTION taptime_server.read_voided_time_records_v1(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.read_voided_time_records_v1(jsonb) TO taptime_time_review_writer;

-- Every existing V2 reader inherits this exclusion; no duration formula changes.
CREATE OR REPLACE VIEW taptime_server.effective_time_records_v2
WITH (security_barrier = true)
AS
WITH latest_revision AS (
  SELECT DISTINCT ON (revision.organization_id, revision.time_record_id)
    revision.*
  FROM taptime_server.time_record_revisions AS revision
  ORDER BY revision.organization_id, revision.time_record_id, revision.revision_number DESC
)
SELECT entry.organization_id, entry.id AS time_record_id, entry.id AS canonical_time_entry_id,
       entry.user_id, entry.target_type, entry.target_customer_id AS target_id,
       COALESCE(revision.effective_started_at, entry.started_at) AS effective_started_at,
       CASE WHEN entry.status = 'started' THEN NULL
            ELSE COALESCE(revision.effective_stopped_at, entry.stopped_at) END AS effective_stopped_at,
       entry.status, entry.row_version AS base_row_version,
       COALESCE(revision.revision_number, 0::bigint) AS effective_revision_number,
       'canonical'::text AS source,
       COALESCE(entry.started_via, 'nfc'::text) AS started_via,
       CASE
         WHEN entry.status = 'started' THEN NULL::text
         ELSE COALESCE(entry.stopped_via, 'nfc'::text)
       END AS stopped_via
FROM taptime_server.time_entries AS entry
LEFT JOIN latest_revision AS revision
  ON revision.organization_id = entry.organization_id
 AND revision.time_record_id = entry.id
WHERE NOT EXISTS (SELECT 1 FROM taptime_server.time_record_voids v WHERE v.organization_id=entry.organization_id AND v.time_record_id=entry.id)
UNION ALL
SELECT revision.organization_id, revision.time_record_id, NULL::uuid,
       revision.user_id, revision.target_type, revision.target_customer_id,
       revision.effective_started_at, revision.effective_stopped_at,
       'stopped'::text, 0::bigint, revision.revision_number,
       'recovered'::text, NULL::text, NULL::text
FROM latest_revision AS revision
WHERE revision.canonical_time_entry_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM taptime_server.time_record_voids v WHERE v.organization_id=revision.organization_id AND v.time_record_id=revision.time_record_id);


-- Legacy export/read and correction paths retain V1 semantics and also exclude voids.
CREATE OR REPLACE VIEW taptime_server.effective_time_records_v1
WITH (security_invoker = true)
AS
WITH latest_revision AS (
  SELECT DISTINCT ON (revision.organization_id, revision.time_record_id)
    revision.organization_id,
    revision.time_record_id,
    revision.revision_number,
    revision.canonical_time_entry_id,
    revision.user_id,
    revision.target_type,
    revision.target_customer_id,
    revision.effective_started_at,
    revision.effective_stopped_at,
    revision.base_row_version
  FROM taptime_server.time_record_revisions AS revision
  ORDER BY revision.organization_id, revision.time_record_id, revision.revision_number DESC
)
SELECT
  entry.organization_id,
  entry.id AS time_record_id,
  entry.id AS canonical_time_entry_id,
  entry.user_id,
  entry.target_type,
  entry.target_customer_id,
  entry.status,
  COALESCE(revision.effective_started_at, entry.started_at) AS effective_started_at,
  CASE
    WHEN entry.status = 'started' THEN NULL
    ELSE COALESCE(revision.effective_stopped_at, entry.stopped_at)
  END AS effective_stopped_at,
  entry.row_version AS base_row_version,
  COALESCE(revision.revision_number, 0::bigint) AS effective_revision_number,
  'canonical'::text AS source
FROM taptime_server.time_entries AS entry
LEFT JOIN latest_revision AS revision
  ON revision.organization_id = entry.organization_id
 AND revision.time_record_id = entry.id
WHERE NOT EXISTS (SELECT 1 FROM taptime_server.time_record_voids v WHERE v.organization_id=entry.organization_id AND v.time_record_id=entry.id)
UNION ALL
SELECT
  revision.organization_id,
  revision.time_record_id,
  NULL::uuid AS canonical_time_entry_id,
  revision.user_id,
  revision.target_type,
  revision.target_customer_id,
  'stopped'::text AS status,
  revision.effective_started_at,
  revision.effective_stopped_at,
  0::bigint AS base_row_version,
  revision.revision_number AS effective_revision_number,
  'recovered'::text AS source
FROM latest_revision AS revision
WHERE revision.canonical_time_entry_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM taptime_server.time_record_voids v WHERE v.organization_id=revision.organization_id AND v.time_record_id=revision.time_record_id);


GRANT SELECT ON taptime_server.time_record_voids TO taptime_time_review_read_function_owner;

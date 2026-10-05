-- T-097: complete reader and note-only break adjudication. Older readers remain intact.
CREATE FUNCTION taptime_server.read_time_review_items_v4(
  requested_organization_id uuid,
  requested_actor_user_id uuid,
  requested_membership_id uuid,
  requested_after_recorded_at timestamptz,
  requested_after_work_event_id uuid,
  requested_limit integer
)
RETURNS TABLE (
  review_item_id uuid,
  source_family text,
  employee_user_id uuid,
  employee_membership_id uuid,
  employee_display_name text,
  target_type text,
  target_id uuid,
  target_display_name text,
  trigger_type text,
  occurred_at timestamptz,
  recorded_at timestamptz,
  review_reason text,
  device_sequence bigint,
  predecessor_blocked boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $items$
BEGIN
  IF pg_catalog.current_setting('role', true) IS DISTINCT FROM 'taptime_time_review_reader'
    OR NOT EXISTS (SELECT 1 FROM taptime_server.has_time_management_authority_v1(
      requested_organization_id, requested_actor_user_id, requested_membership_id, NULL
    ))
    OR requested_limit IS NULL OR requested_limit NOT BETWEEN 1 AND 101
    OR (requested_after_recorded_at IS NULL) <> (requested_after_work_event_id IS NULL)
  THEN
    RAISE EXCEPTION 'Time review item v4 capability rejected' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH unresolved AS (
    SELECT reconciliation.work_event_id, 'offline_v2'::text AS source_family,
           reconciliation.user_id, COALESCE(event.target_type, 'break') AS target_type,
           event.target_customer_id AS target_id, event.trigger_type,
           event.occurred_at, reconciliation.recorded_at,
           CASE WHEN reconciliation.review_reason = 'business_engine_escalation'
             THEN decision.reason ELSE reconciliation.review_reason END AS review_reason,
           reconciliation.device_sequence,
           EXISTS (
             SELECT 1 FROM taptime_server.offline_event_reconciliations AS later
             LEFT JOIN taptime_server.offline_review_adjudications AS later_adjudication
               ON later_adjudication.organization_id = later.organization_id
              AND later_adjudication.work_event_id = later.work_event_id
             WHERE later.organization_id = reconciliation.organization_id
               AND later.user_id = reconciliation.user_id
               AND later.installation_id = reconciliation.installation_id
               AND later.device_sequence > reconciliation.device_sequence
               AND later.result_status = 'review_pending'
               AND later.review_reason = 'predecessor_requires_review'
               AND later_adjudication.work_event_id IS NULL
           ) AS predecessor_blocked
    FROM taptime_server.offline_event_reconciliations AS reconciliation
    JOIN taptime_server.work_events AS event
      ON event.organization_id = reconciliation.organization_id
     AND event.id = reconciliation.work_event_id
    LEFT JOIN taptime_server.canonical_decisions AS decision
      ON decision.organization_id = reconciliation.organization_id
     AND decision.actor_user_id = reconciliation.user_id
     AND decision.work_event_id = reconciliation.decision_work_event_id
    LEFT JOIN taptime_server.offline_review_adjudications AS adjudication
      ON adjudication.organization_id = reconciliation.organization_id
     AND adjudication.work_event_id = reconciliation.work_event_id
    WHERE reconciliation.organization_id = requested_organization_id
      AND reconciliation.result_status = 'review_pending'
      AND adjudication.work_event_id IS NULL
    UNION ALL
    SELECT event.id, 'server_legacy'::text, event.triggered_by_user_id,
           COALESCE(event.target_type, 'break'), event.target_customer_id, event.trigger_type,
           event.occurred_at, event.received_at,
           COALESCE(decision.reason, 'server_lifecycle_deferred'::text), NULL::bigint, false
    FROM taptime_server.work_events AS event
    LEFT JOIN taptime_server.canonical_decisions AS decision
      ON decision.organization_id = event.organization_id
     AND decision.actor_user_id = event.triggered_by_user_id
     AND decision.work_event_id = event.id
     AND decision.decision_type = 'escalation_required'
    WHERE event.organization_id = requested_organization_id
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
    UNION ALL
    SELECT skipped.work_event_id, 'offline_skip'::text, skipped.user_id,
           COALESCE(item.target_type, 'break'), item.target_customer_id,
           CASE WHEN item.item_type = 'nfc_assignment' THEN 'nfc' ELSE 'manual' END,
           skipped.occurred_at, skipped.recorded_at, skipped.reason, skipped.device_sequence, false
    FROM taptime_server.offline_skipped_sequences AS skipped
    JOIN taptime_server.offline_capture_lease_items AS item
      ON item.organization_id = skipped.organization_id AND item.id = skipped.lease_item_id
    WHERE skipped.organization_id = requested_organization_id
      AND NOT EXISTS (
        SELECT 1 FROM taptime_server.offline_skip_resolutions AS resolution
        WHERE resolution.organization_id = skipped.organization_id
          AND resolution.work_event_id = skipped.work_event_id
      )
  )
  SELECT unresolved.work_event_id, unresolved.source_family, unresolved.user_id,
         membership.id, COALESCE(membership.display_name, ''), unresolved.target_type,
         unresolved.target_id, CASE WHEN unresolved.target_type = 'break' THEN 'Pause' ELSE target.display_name END, unresolved.trigger_type,
         unresolved.occurred_at, unresolved.recorded_at, unresolved.review_reason,
         unresolved.device_sequence, unresolved.predecessor_blocked
  FROM unresolved
  LEFT JOIN taptime_server.memberships AS membership
    ON membership.organization_id = requested_organization_id
   AND membership.user_id = unresolved.user_id
  LEFT JOIN taptime_server.work_targets AS target
    ON target.organization_id = requested_organization_id
   AND target.target_type = unresolved.target_type
   AND target.target_id = unresolved.target_id
  WHERE (unresolved.target_type = 'break' OR target.target_id IS NOT NULL)
    AND EXISTS (SELECT 1 FROM taptime_server.has_time_management_authority_v1(
      requested_organization_id, requested_actor_user_id, requested_membership_id, unresolved.user_id
    ))
    AND (requested_after_recorded_at IS NULL
     OR (unresolved.recorded_at, unresolved.work_event_id)
        > (requested_after_recorded_at, requested_after_work_event_id))
  ORDER BY unresolved.recorded_at, unresolved.work_event_id
  LIMIT requested_limit;
END
$items$;

ALTER FUNCTION taptime_server.read_time_review_items_v4(uuid,uuid,uuid,timestamptz,uuid,integer)
  OWNER TO taptime_time_review_read_function_owner;
REVOKE ALL ON FUNCTION taptime_server.read_time_review_items_v4(uuid,uuid,uuid,timestamptz,uuid,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.read_time_review_items_v4(uuid,uuid,uuid,timestamptz,uuid,integer)
  TO taptime_time_review_reader;

-- Existing rows are work evidence (their target was NOT NULL). No original values are updated.
-- The source event determines subject_type on INSERT; a client cannot classify work as a break.
ALTER TABLE taptime_server.offline_review_adjudications
  ALTER COLUMN target_type DROP NOT NULL,
  ALTER COLUMN target_customer_id DROP NOT NULL,
  ADD COLUMN subject_type text NOT NULL DEFAULT 'work',
  ADD CONSTRAINT offline_review_adjudications_subject_shape CHECK (
    (subject_type = 'work' AND target_type IS NOT NULL AND target_customer_id IS NOT NULL)
    OR (subject_type = 'break' AND target_type IS NULL AND target_customer_id IS NULL
      AND resolution = 'no_time_record_change')
  );

CREATE FUNCTION taptime_server.validate_review_adjudication_subject_v1()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $subject$
DECLARE
  source_event taptime_server.work_events%ROWTYPE;
BEGIN
  SELECT event.* INTO source_event FROM taptime_server.work_events AS event
  WHERE event.organization_id = NEW.organization_id
    AND event.id = NEW.work_event_id AND event.triggered_by_user_id = NEW.user_id;
  -- The old composite FK contains nullable targets, so it cannot authenticate break evidence.
  IF NOT FOUND OR NEW.target_type IS DISTINCT FROM source_event.target_type
    OR NEW.target_customer_id IS DISTINCT FROM source_event.target_customer_id THEN
    RAISE EXCEPTION 'Review adjudication does not match its source event' USING ERRCODE = '23514';
  END IF;
  NEW.subject_type := source_event.subject_type;
  RETURN NEW;
END
$subject$;
ALTER FUNCTION taptime_server.validate_review_adjudication_subject_v1()
  OWNER TO taptime_time_review_write_function_owner;
REVOKE ALL ON FUNCTION taptime_server.validate_review_adjudication_subject_v1() FROM PUBLIC;
CREATE TRIGGER offline_review_adjudications_subject
  BEFORE INSERT ON taptime_server.offline_review_adjudications
  FOR EACH ROW EXECUTE FUNCTION taptime_server.validate_review_adjudication_subject_v1();

-- Check the immutable source before any time revision can be written. The existing writer
-- retains authority, prefix, retry, audit and queue-release handling for all accepted commands.
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
  skipped taptime_server.offline_skipped_sequences%ROWTYPE;
  closed taptime_server.offline_skip_resolutions%ROWTYPE;
BEGIN
  IF requested_resolution IS DISTINCT FROM 'no_time_record_change' AND EXISTS (
    SELECT 1 FROM taptime_server.work_events AS event
    WHERE event.organization_id = requested_organization_id
      AND event.id = ANY(requested_review_item_ids) AND event.subject_type = 'break'
  ) THEN
    RETURN QUERY SELECT 'invalid_evidence'::text, requested_resolution,
      NULL::uuid[], NULL::uuid, NULL::bigint, false;
    RETURN;
  END IF;
  SELECT * INTO skipped FROM taptime_server.offline_skipped_sequences s
    WHERE s.organization_id=requested_organization_id AND s.work_event_id=ANY(requested_review_item_ids) LIMIT 1;
  IF NOT FOUND THEN
    IF EXISTS(SELECT 1 FROM taptime_server.offline_skip_resolutions r
      WHERE r.organization_id=requested_organization_id AND r.command_id=requested_command_id) THEN
      RETURN QUERY SELECT 'command_id_conflict'::text,requested_resolution,NULL::uuid[],NULL::uuid,NULL::bigint,false; RETURN;
    END IF;
    RETURN QUERY SELECT * FROM taptime_server.adjudicate_time_review_items_before_skip_v1(requested_organization_id,requested_actor_user_id,requested_membership_id,requested_command_id,
        requested_request_hash,requested_review_item_ids,requested_resolution,requested_time_record_id,
        requested_expected_base_row_version,requested_expected_revision_number,requested_started_at,requested_stopped_at,requested_reason); RETURN;
  END IF;
  IF current_setting('role',true) IS DISTINCT FROM 'taptime_time_review_writer'
    OR requested_command_id IS NULL OR requested_request_hash IS NULL OR requested_request_hash COLLATE "C" !~ '^[0-9a-f]{64}$'
    OR cardinality(requested_review_item_ids)<>1 OR requested_reason IS NULL OR char_length(btrim(requested_reason)) NOT BETWEEN 1 AND 500
    OR requested_resolution IS DISTINCT FROM 'no_time_record_change'
    OR requested_time_record_id IS NOT NULL OR requested_expected_base_row_version IS NOT NULL OR requested_expected_revision_number IS NOT NULL
    OR requested_started_at IS NOT NULL OR requested_stopped_at IS NOT NULL
    THEN RETURN QUERY SELECT 'invalid_evidence'::text,requested_resolution,NULL::uuid[],NULL::uuid,NULL::bigint,false; RETURN; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(requested_organization_id::text||chr(31)||skipped.user_id::text,0));
  PERFORM pg_advisory_xact_lock(hashtextextended(requested_organization_id::text||chr(30)||requested_command_id::text,0));
  IF NOT EXISTS(SELECT 1 FROM taptime_server.has_time_management_authority_v1(
    requested_organization_id,requested_actor_user_id,requested_membership_id,skipped.user_id)) THEN
    RETURN QUERY SELECT 'authority_rejected'::text,requested_resolution,NULL::uuid[],NULL::uuid,NULL::bigint,false; RETURN;
  END IF;
  SELECT * INTO closed FROM taptime_server.offline_skip_resolutions r
    WHERE r.organization_id=requested_organization_id AND r.command_id=requested_command_id;
  IF FOUND THEN
    IF closed.work_event_id<>skipped.work_event_id OR closed.request_hash<>requested_request_hash
      OR closed.actor_membership_id<>requested_membership_id THEN
      RETURN QUERY SELECT 'command_id_conflict'::text,requested_resolution,NULL::uuid[],NULL::uuid,NULL::bigint,false; RETURN;
    END IF;
    RETURN QUERY SELECT 'committed'::text,closed.resolution,requested_review_item_ids,closed.time_record_id,
      CASE WHEN closed.time_record_id IS NULL THEN NULL::bigint ELSE 1::bigint END,true; RETURN;
  END IF;
  IF EXISTS(SELECT 1 FROM taptime_server.offline_skip_resolutions r
      WHERE r.organization_id=requested_organization_id AND r.work_event_id=skipped.work_event_id) THEN
    RETURN QUERY SELECT 'conflict'::text,requested_resolution,NULL::uuid[],NULL::uuid,NULL::bigint,false; RETURN;
  END IF;
  IF EXISTS(SELECT 1 FROM taptime_server.time_review_command_receipts r WHERE r.organization_id=requested_organization_id AND r.command_id=requested_command_id)
    OR EXISTS(SELECT 1 FROM taptime_server.time_supplement_command_receipts r WHERE r.organization_id=requested_organization_id AND r.command_id=requested_command_id) THEN
    RETURN QUERY SELECT 'command_id_conflict'::text,requested_resolution,NULL::uuid[],NULL::uuid,NULL::bigint,false; RETURN;
  END IF;
  INSERT INTO taptime_server.offline_skip_resolutions(organization_id,work_event_id,actor_user_id,actor_membership_id,
    command_id,request_hash,reason,resolution,time_record_id) VALUES(requested_organization_id,skipped.work_event_id,
    requested_actor_user_id,requested_membership_id,requested_command_id,requested_request_hash,requested_reason,requested_resolution,NULL);
  RETURN QUERY SELECT 'committed'::text,requested_resolution,requested_review_item_ids,NULL::uuid,NULL::bigint,false;
END $adjudication$;
ALTER FUNCTION taptime_server.adjudicate_time_review_items_v1(uuid,uuid,uuid,uuid,text,uuid[],text,uuid,bigint,bigint,timestamptz,timestamptz,text) OWNER TO taptime_time_review_write_function_owner;
REVOKE ALL ON FUNCTION taptime_server.adjudicate_time_review_items_v1(uuid,uuid,uuid,uuid,text,uuid[],text,uuid,bigint,bigint,timestamptz,timestamptz,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.adjudicate_time_review_items_v1(uuid,uuid,uuid,uuid,text,uuid[],text,uuid,bigint,bigint,timestamptz,timestamptz,text) TO taptime_time_review_writer;

-- Only the checked entry point is callable by the runtime role. The owner still delegates.
REVOKE EXECUTE ON FUNCTION taptime_server.adjudicate_time_review_items_before_skip_v1(
  uuid,uuid,uuid,uuid,text,uuid[],text,uuid,bigint,bigint,timestamptz,timestamptz,text
) FROM taptime_time_review_writer;

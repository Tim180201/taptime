-- T-106 / D-122: explicit, reviewable definitions; preserve authority and history.
-- Each function is copied from its last explicit definition, with only the T-106
-- interval/visible-text guards changed. Later migrations must continue from here.
-- Visible text uses the same locale-independent set as core.hasVisibleText.
-- From 042_membership_departure.sql.
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
    OR (requested_reason IS NULL OR requested_reason !~ U&'[^\0001-\0020\007f-\00a0\1680\2000-\200f\2028-\202f\205f\2060-\206f\3000\feff]')
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

-- From 042_membership_departure.sql.
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
    OR (requested_reason IS NULL OR requested_reason !~ U&'[^\0001-\0020\007f-\00a0\1680\2000-\200f\2028-\202f\205f\2060-\206f\3000\feff]')
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

  IF requested_resolution <> 'no_time_record_change' AND (
    NOT isfinite(requested_started_at) OR NOT isfinite(requested_stopped_at)
    OR requested_started_at > requested_stopped_at
    OR requested_stopped_at > transaction_timestamp()
    OR requested_stopped_at - requested_started_at > interval '24 hours') THEN
    RETURN QUERY SELECT 'invalid_interval'::text,requested_resolution,NULL::uuid[],NULL::uuid,NULL::bigint,false;
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
ALTER FUNCTION taptime_server.adjudicate_time_review_items_legacy_v1(uuid, uuid, uuid, uuid, text, uuid[], text, uuid, bigint, bigint, timestamp with time zone, timestamp with time zone, text)
  OWNER TO taptime_time_review_write_function_owner;
REVOKE ALL ON FUNCTION taptime_server.adjudicate_time_review_items_legacy_v1(uuid, uuid, uuid, uuid, text, uuid[], text, uuid, bigint, bigint, timestamp with time zone, timestamp with time zone, text) FROM PUBLIC;

-- From 042_membership_departure.sql (renamed in 044).
CREATE OR REPLACE FUNCTION taptime_server.adjudicate_time_review_items_before_skip_v1(
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
    OR (requested_reason IS NULL OR requested_reason !~ U&'[^\0001-\0020\007f-\00a0\1680\2000-\200f\2028-\202f\205f\2060-\206f\3000\feff]')
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



  IF requested_resolution <> 'no_time_record_change' AND (
    NOT isfinite(requested_started_at) OR NOT isfinite(requested_stopped_at)
    OR requested_started_at > requested_stopped_at
    OR requested_stopped_at > transaction_timestamp()
    OR requested_stopped_at - requested_started_at > interval '24 hours') THEN
    RETURN QUERY SELECT 'invalid_interval'::text,requested_resolution,NULL::uuid[],NULL::uuid,NULL::bigint,false;
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
ALTER FUNCTION taptime_server.adjudicate_time_review_items_before_skip_v1(uuid, uuid, uuid, uuid, text, uuid[], text, uuid, bigint, bigint, timestamp with time zone, timestamp with time zone, text)
  OWNER TO taptime_time_review_write_function_owner;
REVOKE ALL ON FUNCTION taptime_server.adjudicate_time_review_items_before_skip_v1(uuid, uuid, uuid, uuid, text, uuid[], text, uuid, bigint, bigint, timestamp with time zone, timestamp with time zone, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION taptime_server.adjudicate_time_review_items_before_skip_v1(uuid, uuid, uuid, uuid, text, uuid[], text, uuid, bigint, bigint, timestamp with time zone, timestamp with time zone, text) FROM taptime_time_review_writer;

-- From 045_complete_time_review_reader.sql.
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
    OR cardinality(requested_review_item_ids)<>1 OR (requested_reason IS NULL OR requested_reason !~ U&'[^\0001-\0020\007f-\00a0\1680\2000-\200f\2028-\202f\205f\2060-\206f\3000\feff]') OR char_length(btrim(requested_reason)) NOT BETWEEN 1 AND 500
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
ALTER FUNCTION taptime_server.adjudicate_time_review_items_v1(uuid, uuid, uuid, uuid, text, uuid[], text, uuid, bigint, bigint, timestamp with time zone, timestamp with time zone, text)
  OWNER TO taptime_time_review_write_function_owner;
REVOKE ALL ON FUNCTION taptime_server.adjudicate_time_review_items_v1(uuid, uuid, uuid, uuid, text, uuid[], text, uuid, bigint, bigint, timestamp with time zone, timestamp with time zone, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.adjudicate_time_review_items_v1(uuid, uuid, uuid, uuid, text, uuid[], text, uuid, bigint, bigint, timestamp with time zone, timestamp with time zone, text)
  TO taptime_time_review_writer;

-- From 042_membership_departure.sql.
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
  IF actor_role IN ('administrator','standortleitung') AND ((reason IS NULL OR reason !~ U&'[^\0001-\0020\007f-\00a0\1680\2000-\200f\2028-\202f\205f\2060-\206f\3000\feff]') OR char_length(btrim(reason)) NOT BETWEEN 1 AND 500) THEN
    RETURN jsonb_build_object('status','reason_required');
  END IF;
  IF comment_text IS NOT NULL AND (comment_text !~ U&'[^\0001-\0020\007f-\00a0\1680\2000-\200f\2028-\202f\205f\2060-\206f\3000\feff]' OR actor_role<>'employee' OR char_length(btrim(comment_text)) NOT BETWEEN 1 AND 500) THEN
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
ALTER FUNCTION taptime_server.backfill_time_record_v1(jsonb)
  OWNER TO taptime_time_review_write_function_owner;
REVOKE ALL ON FUNCTION taptime_server.backfill_time_record_v1(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.backfill_time_record_v1(jsonb)
  TO taptime_time_review_writer;

-- From 033_location_manager_time_authority.sql.
CREATE OR REPLACE FUNCTION taptime_server.comment_time_record_v1(request jsonb)
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
      AND m.id=actor_id AND m.user_id=actor_user AND m.role IN ('employee','administrator','standortleitung')
      AND (m.role<>'standortleitung' OR current_setting('app.membership_role',true)=m.role) AND m.revoked_at IS NULL)
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
  IF command IS NULL OR (comment_text IS NULL OR comment_text !~ U&'[^\0001-\0020\007f-\00a0\1680\2000-\200f\2028-\202f\205f\2060-\206f\3000\feff]') OR char_length(btrim(comment_text)) NOT BETWEEN 1 AND 500 THEN
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
ALTER FUNCTION taptime_server.comment_time_record_v1(jsonb)
  OWNER TO taptime_time_review_write_function_owner;
REVOKE ALL ON FUNCTION taptime_server.comment_time_record_v1(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.comment_time_record_v1(jsonb)
  TO taptime_time_review_writer;

-- From 042_membership_departure.sql.
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
  IF (request->>'reason' IS NULL OR request->>'reason' !~ U&'[^\0001-\0020\007f-\00a0\1680\2000-\200f\2028-\202f\205f\2060-\206f\3000\feff]') OR char_length(btrim(request->>'reason')) NOT BETWEEN 1 AND 500 THEN
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

-- From 038_time_record_voids.sql.
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
    OR request->>'reasonCode' IS NULL
    OR (request->>'reasonCode'='other' AND (jsonb_typeof(request->'reasonText') IS DISTINCT FROM 'string'
      OR char_length(request->>'reasonText') NOT BETWEEN 1 AND 500 OR request->>'reasonText' !~ U&'[^\0001-\0020\007f-\00a0\1680\2000-\200f\2028-\202f\205f\2060-\206f\3000\feff]'))
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
ALTER FUNCTION taptime_server.void_time_record_v1(jsonb)
  OWNER TO taptime_time_review_write_function_owner;
REVOKE ALL ON FUNCTION taptime_server.void_time_record_v1(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.void_time_record_v1(jsonb)
  TO taptime_time_review_writer;

-- From 032_platform_operator.sql.
CREATE OR REPLACE FUNCTION taptime_server.operator_set_organization_status_v1(command uuid,org uuid,desired_status text,reason text,expected_version bigint)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid := taptime_server.require_platform_operator_v1(); fingerprint bytea;
  receipt taptime_server.platform_command_receipts%ROWTYPE; existing taptime_server.organizations%ROWTYPE; result jsonb;
BEGIN
  IF command IS NULL OR org IS NULL OR desired_status IS NULL OR desired_status NOT IN ('active','paused')
    OR (reason IS NULL OR reason !~ U&'[^\0001-\0020\007f-\00a0\1680\2000-\200f\2028-\202f\205f\2060-\206f\3000\feff]') OR length(btrim(reason)) NOT BETWEEN 1 AND 500 OR expected_version IS NULL OR expected_version<1
    THEN RETURN jsonb_build_object('status','invalid_request'); END IF;
  fingerprint := sha256(convert_to(jsonb_build_array('status',org,desired_status,btrim(reason),expected_version)::text,'UTF8'));
  PERFORM pg_advisory_xact_lock(hashtextextended('taptime:operator-command:'||command::text,0));
  SELECT * INTO receipt FROM taptime_server.platform_command_receipts WHERE command_id=command;
  IF FOUND THEN
    IF receipt.operator_id=actor AND receipt.request_hash=fingerprint THEN RETURN receipt.result; END IF;
    RETURN jsonb_build_object('status','command_id_conflict');
  END IF;
  SELECT * INTO existing FROM taptime_server.organizations WHERE id=org FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','not_found'); END IF;
  IF existing.row_version<>expected_version OR existing.status=desired_status THEN RETURN jsonb_build_object('status','conflict'); END IF;
  UPDATE taptime_server.organizations SET status=desired_status,row_version=row_version+1,
    paused_at=CASE WHEN desired_status='paused' THEN now() ELSE NULL END,
    pause_reason=CASE WHEN desired_status='paused' THEN btrim(reason) ELSE NULL END WHERE id=org;
  result := jsonb_build_object('status','succeeded','organization_id',org,'row_version',expected_version+1);
  INSERT INTO taptime_server.platform_command_receipts(command_id,operator_id,request_hash,result) VALUES(command,actor,fingerprint,result);
  INSERT INTO taptime_server.platform_audit_events(operator_id,operator_principal,organization_id,command_id,action,reason)
    VALUES(actor,'operator',org,command,CASE WHEN desired_status='paused' THEN 'organization_paused' ELSE 'organization_resumed' END,btrim(reason));
  RETURN result;
END $$;
ALTER FUNCTION taptime_server.operator_set_organization_status_v1(uuid, uuid, text, text, bigint)
  OWNER TO taptime_platform_operator_owner;
REVOKE ALL ON FUNCTION taptime_server.operator_set_organization_status_v1(uuid, uuid, text, text, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.operator_set_organization_status_v1(uuid, uuid, text, text, bigint)
  TO taptime_platform_operator;

-- From 048_organization_packages.sql.
CREATE OR REPLACE FUNCTION taptime_server.operator_set_organization_package_v1(command uuid,org uuid,requested_package_size integer,reason text,expected_version bigint)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid := taptime_server.require_platform_operator_v1(); fingerprint bytea;
  receipt taptime_server.platform_command_receipts%ROWTYPE; existing taptime_server.organizations%ROWTYPE; result jsonb;
BEGIN
  IF command IS NULL OR org IS NULL OR requested_package_size<1
    OR (reason IS NULL OR reason !~ U&'[^\0001-\0020\007f-\00a0\1680\2000-\200f\2028-\202f\205f\2060-\206f\3000\feff]') OR length(btrim(reason)) NOT BETWEEN 1 AND 500 OR expected_version IS NULL OR expected_version<1
    THEN RETURN jsonb_build_object('status','invalid_request'); END IF;
  fingerprint := sha256(convert_to(jsonb_build_array('package',org,requested_package_size,btrim(reason),expected_version)::text,'UTF8'));
  PERFORM pg_advisory_xact_lock(hashtextextended('taptime:operator-command:'||command::text,0));
  SELECT * INTO receipt FROM taptime_server.platform_command_receipts WHERE command_id=command;
  IF FOUND THEN
    IF receipt.operator_id=actor AND receipt.request_hash=fingerprint THEN RETURN receipt.result; END IF;
    RETURN jsonb_build_object('status','command_id_conflict');
  END IF;
  SELECT * INTO existing FROM taptime_server.organizations WHERE id=org FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','not_found'); END IF;
  IF existing.row_version<>expected_version OR existing.package_size IS NOT DISTINCT FROM requested_package_size THEN RETURN jsonb_build_object('status','conflict'); END IF;
  UPDATE taptime_server.organizations SET package_size=requested_package_size,row_version=row_version+1 WHERE id=org;
  result := jsonb_build_object('status','succeeded','organization_id',org,'row_version',expected_version+1);
  INSERT INTO taptime_server.platform_command_receipts(command_id,operator_id,request_hash,result) VALUES(command,actor,fingerprint,result);
  INSERT INTO taptime_server.platform_audit_events(operator_id,operator_principal,organization_id,command_id,action,reason,package_size_before,package_size_after)
    VALUES(actor,'operator',org,command,'organization_package_changed',btrim(reason),existing.package_size,requested_package_size);
  RETURN result;
END $$;
ALTER FUNCTION taptime_server.operator_set_organization_package_v1(uuid, uuid, integer, text, bigint)
  OWNER TO taptime_platform_operator_owner;
REVOKE ALL ON FUNCTION taptime_server.operator_set_organization_package_v1(uuid, uuid, integer, text, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.operator_set_organization_package_v1(uuid, uuid, integer, text, bigint)
  TO taptime_platform_operator;

-- Protect new writes without rewriting pre-existing reasons or notes.
ALTER TABLE taptime_server.time_record_revisions
  ADD CONSTRAINT time_record_revisions_visible_text
  CHECK (reason ~ U&'[^\0001-\0020\007f-\00a0\1680\2000-\200f\2028-\202f\205f\2060-\206f\3000\feff]') NOT VALID;
ALTER TABLE taptime_server.offline_review_adjudications
  ADD CONSTRAINT offline_review_adjudications_visible_text
  CHECK (reason ~ U&'[^\0001-\0020\007f-\00a0\1680\2000-\200f\2028-\202f\205f\2060-\206f\3000\feff]') NOT VALID;
ALTER TABLE taptime_server.offline_skip_resolutions
  ADD CONSTRAINT offline_skip_resolutions_visible_text
  CHECK (reason ~ U&'[^\0001-\0020\007f-\00a0\1680\2000-\200f\2028-\202f\205f\2060-\206f\3000\feff]') NOT VALID;
ALTER TABLE taptime_server.time_record_comments
  ADD CONSTRAINT time_record_comments_visible_text
  CHECK (comment ~ U&'[^\0001-\0020\007f-\00a0\1680\2000-\200f\2028-\202f\205f\2060-\206f\3000\feff]') NOT VALID;
ALTER TABLE taptime_server.administration_stop_commands
  ADD CONSTRAINT administration_stop_commands_visible_text
  CHECK (reason ~ U&'[^\0001-\0020\007f-\00a0\1680\2000-\200f\2028-\202f\205f\2060-\206f\3000\feff]') NOT VALID;
ALTER TABLE taptime_server.time_record_voids
  ADD CONSTRAINT time_record_voids_visible_text
  CHECK (reason_text ~ U&'[^\0001-\0020\007f-\00a0\1680\2000-\200f\2028-\202f\205f\2060-\206f\3000\feff]') NOT VALID;
ALTER TABLE taptime_server.platform_audit_events
  ADD CONSTRAINT platform_audit_events_visible_text
  CHECK (reason ~ U&'[^\0001-\0020\007f-\00a0\1680\2000-\200f\2028-\202f\205f\2060-\206f\3000\feff]') NOT VALID;

-- Existing offline reason also applies at the canonical engine boundary.
ALTER TABLE taptime_server.canonical_decisions DROP CONSTRAINT canonical_decisions_result_shape_v5,
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
        'capture_time_out_of_bounds',
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

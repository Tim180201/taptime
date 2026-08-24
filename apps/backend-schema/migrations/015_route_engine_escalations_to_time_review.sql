-- Engine escalations are durable canonical decisions and must also be unresolved
-- review evidence. They remain synchronized from the device's perspective so an
-- escalation never creates an offline review predecessor.

ALTER TABLE taptime_server.offline_event_reconciliations
  DROP CONSTRAINT offline_event_reconciliations_review_reason_check,
  DROP CONSTRAINT offline_reconciliations_result_shape,
  ADD CONSTRAINT offline_reconciliations_review_reason_v2 CHECK (review_reason IN (
    'identity_or_membership_not_current',
    'capture_time_out_of_bounds',
    'automatic_window_elapsed',
    'historical_configuration_not_valid',
    'predecessor_requires_review',
    'business_engine_escalation'
  )),
  ADD CONSTRAINT offline_reconciliations_result_shape_v2 CHECK (
    (
      result_status = 'synchronized'
      AND review_reason IS NULL
      AND decision_work_event_id = work_event_id
    )
    OR
    (
      result_status = 'review_pending'
      AND review_reason <> 'business_engine_escalation'
      AND decision_work_event_id IS NULL
      AND server_time_entry_id IS NULL
    )
    OR
    (
      result_status = 'review_pending'
      AND review_reason = 'business_engine_escalation'
      AND decision_work_event_id = work_event_id
      AND server_time_entry_id IS NULL
    )
  );

CREATE OR REPLACE FUNCTION taptime_server.has_offline_review_predecessor_v1(
  requested_organization_id uuid,
  requested_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $predecessor$
BEGIN
  IF pg_catalog.current_setting('role', true) <> 'taptime_offline_event_ingestor'
    OR requested_organization_id IS NULL
    OR requested_user_id IS NULL
    OR requested_organization_id <> NULLIF(
      pg_catalog.current_setting('app.organization_id', true), ''
    )::uuid
    OR requested_user_id <> NULLIF(
      pg_catalog.current_setting('app.user_id', true), ''
    )::uuid
  THEN
    RAISE EXCEPTION 'Offline review predecessor capability rejected'
      USING ERRCODE = '42501';
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM taptime_server.offline_event_reconciliations AS reconciliation
    LEFT JOIN taptime_server.offline_review_adjudications AS adjudication
      ON adjudication.organization_id = reconciliation.organization_id
     AND adjudication.work_event_id = reconciliation.work_event_id
    WHERE reconciliation.organization_id = requested_organization_id
      AND reconciliation.user_id = requested_user_id
      AND reconciliation.result_status = 'review_pending'
      AND reconciliation.review_reason <> 'business_engine_escalation'
      AND adjudication.work_event_id IS NULL
  );
END
$predecessor$;

CREATE OR REPLACE FUNCTION taptime_server.read_current_offline_review_state_v1(
  requested_installation_id uuid
)
RETURNS TABLE (
  review_status text,
  earliest_unresolved_sequence bigint,
  confirmed_through_sequence bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $state$
DECLARE
  unresolved_sequence bigint;
  durable_sequence bigint;
BEGIN
  IF pg_catalog.current_setting('role', true) <> 'taptime_offline_reconciliation_reader'
    OR requested_installation_id IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM taptime_server.offline_installations AS installation
      JOIN taptime_server.identity_bindings AS binding
        ON binding.id = installation.identity_binding_id
       AND binding.user_id = installation.user_id
      JOIN taptime_server.memberships AS membership
        ON membership.organization_id = installation.organization_id
       AND membership.user_id = installation.user_id
       AND membership.id = installation.membership_id
      WHERE installation.id = requested_installation_id
        AND installation.organization_id = NULLIF(
          pg_catalog.current_setting('app.organization_id', true), ''
        )::uuid
        AND installation.user_id = NULLIF(
          pg_catalog.current_setting('app.user_id', true), ''
        )::uuid
        AND installation.membership_id = NULLIF(
          pg_catalog.current_setting('app.membership_id', true), ''
        )::uuid
        AND binding.id = NULLIF(
          pg_catalog.current_setting('app.identity_binding_id', true), ''
        )::uuid
        AND binding.revoked_at IS NULL
        AND membership.revoked_at IS NULL
    )
  THEN
    RAISE EXCEPTION 'Offline review-state capability rejected' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(cursor.last_durable_sequence, 0)
  INTO STRICT durable_sequence
  FROM taptime_server.offline_installations AS installation
  LEFT JOIN taptime_server.offline_sync_cursors AS cursor
    ON cursor.organization_id = installation.organization_id
   AND cursor.installation_id = installation.id
  WHERE installation.organization_id = NULLIF(
      pg_catalog.current_setting('app.organization_id', true), ''
    )::uuid
    AND installation.user_id = NULLIF(
      pg_catalog.current_setting('app.user_id', true), ''
    )::uuid
    AND installation.membership_id = NULLIF(
      pg_catalog.current_setting('app.membership_id', true), ''
    )::uuid
    AND installation.id = requested_installation_id;

  SELECT MIN(reconciliation.device_sequence) INTO unresolved_sequence
  FROM taptime_server.offline_event_reconciliations AS reconciliation
  LEFT JOIN taptime_server.offline_review_adjudications AS adjudication
    ON adjudication.organization_id = reconciliation.organization_id
   AND adjudication.work_event_id = reconciliation.work_event_id
  WHERE reconciliation.organization_id = NULLIF(
      pg_catalog.current_setting('app.organization_id', true), ''
    )::uuid
    AND reconciliation.user_id = NULLIF(
      pg_catalog.current_setting('app.user_id', true), ''
    )::uuid
    AND reconciliation.membership_id = NULLIF(
      pg_catalog.current_setting('app.membership_id', true), ''
    )::uuid
    AND reconciliation.installation_id = requested_installation_id
    AND reconciliation.result_status = 'review_pending'
    AND reconciliation.review_reason <> 'business_engine_escalation'
    AND adjudication.work_event_id IS NULL;

  RETURN QUERY SELECT
    CASE WHEN unresolved_sequence IS NULL THEN 'clear'::text ELSE 'review_pending'::text END,
    unresolved_sequence,
    durable_sequence;
END
$state$;

CREATE OR REPLACE FUNCTION taptime_server.read_time_review_items_v1(
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
  customer_id uuid,
  customer_display_name text,
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
  IF pg_catalog.current_setting('role', true) <> 'taptime_time_review_reader'
    OR NOT taptime_server.has_current_time_review_administrator_v1(
      requested_organization_id, requested_actor_user_id, requested_membership_id
    )
    OR requested_limit NOT BETWEEN 1 AND 101
    OR (requested_after_recorded_at IS NULL) <> (requested_after_work_event_id IS NULL)
  THEN
    RAISE EXCEPTION 'Time review item capability rejected' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH unresolved AS (
    SELECT reconciliation.work_event_id, 'offline_v2'::text AS source_family,
           reconciliation.user_id, event.target_customer_id, event.occurred_at,
           reconciliation.recorded_at,
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
           event.target_customer_id, event.occurred_at, event.received_at,
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
  )
  SELECT unresolved.work_event_id, unresolved.source_family, unresolved.user_id,
         membership.id, COALESCE(membership.display_name, ''), customer.id,
         customer.display_name, unresolved.occurred_at, unresolved.recorded_at,
         unresolved.review_reason, unresolved.device_sequence,
         unresolved.predecessor_blocked
  FROM unresolved
  LEFT JOIN taptime_server.memberships AS membership
    ON membership.organization_id = requested_organization_id
   AND membership.user_id = unresolved.user_id
  LEFT JOIN taptime_server.customers AS customer
    ON customer.organization_id = requested_organization_id
   AND customer.id = unresolved.target_customer_id
  WHERE requested_after_recorded_at IS NULL
     OR (unresolved.recorded_at, unresolved.work_event_id)
        > (requested_after_recorded_at, requested_after_work_event_id)
  ORDER BY unresolved.recorded_at, unresolved.work_event_id
  LIMIT requested_limit;
END
$items$;

ALTER FUNCTION taptime_server.adjudicate_time_review_items_v1(
  uuid, uuid, uuid, uuid, text, uuid[], text, uuid, bigint, bigint,
  timestamptz, timestamptz, text
) RENAME TO adjudicate_time_review_items_legacy_v1;
REVOKE ALL ON FUNCTION taptime_server.adjudicate_time_review_items_legacy_v1(
  uuid, uuid, uuid, uuid, text, uuid[], text, uuid, bigint, bigint,
  timestamptz, timestamptz, text
) FROM PUBLIC, taptime_time_review_writer;

CREATE FUNCTION taptime_server.adjudicate_time_review_items_v1(
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

  IF NOT taptime_server.has_current_time_review_administrator_v1(
    requested_organization_id, requested_actor_user_id, requested_membership_id
  ) THEN
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

ALTER FUNCTION taptime_server.adjudicate_time_review_items_v1(
  uuid, uuid, uuid, uuid, text, uuid[], text, uuid, bigint, bigint,
  timestamptz, timestamptz, text
) OWNER TO taptime_time_review_write_function_owner;
REVOKE ALL ON FUNCTION taptime_server.adjudicate_time_review_items_v1(
  uuid, uuid, uuid, uuid, text, uuid[], text, uuid, bigint, bigint,
  timestamptz, timestamptz, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.adjudicate_time_review_items_v1(
  uuid, uuid, uuid, uuid, text, uuid[], text, uuid, bigint, bigint,
  timestamptz, timestamptz, text
) TO taptime_time_review_writer;

CREATE OR REPLACE FUNCTION taptime_server.read_time_review_items_v2(
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
  IF pg_catalog.current_setting('role', true) <> 'taptime_time_review_reader'
    OR NOT taptime_server.has_current_time_review_administrator_v1(
      requested_organization_id, requested_actor_user_id, requested_membership_id
    )
    OR requested_limit NOT BETWEEN 1 AND 101
    OR (requested_after_recorded_at IS NULL) <> (requested_after_work_event_id IS NULL)
  THEN
    RAISE EXCEPTION 'Time review item v2 capability rejected' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH unresolved AS (
    SELECT reconciliation.work_event_id, 'offline_v2'::text AS source_family,
           reconciliation.user_id, event.target_type,
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
           event.target_type, event.target_customer_id, event.trigger_type,
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
  )
  SELECT unresolved.work_event_id, unresolved.source_family, unresolved.user_id,
         membership.id, COALESCE(membership.display_name, ''), unresolved.target_type,
         unresolved.target_id, target.display_name, unresolved.trigger_type,
         unresolved.occurred_at, unresolved.recorded_at, unresolved.review_reason,
         unresolved.device_sequence, unresolved.predecessor_blocked
  FROM unresolved
  LEFT JOIN taptime_server.memberships AS membership
    ON membership.organization_id = requested_organization_id
   AND membership.user_id = unresolved.user_id
  JOIN taptime_server.work_targets AS target
    ON target.organization_id = requested_organization_id
   AND target.target_type = unresolved.target_type
   AND target.target_id = unresolved.target_id
  WHERE requested_after_recorded_at IS NULL
     OR (unresolved.recorded_at, unresolved.work_event_id)
        > (requested_after_recorded_at, requested_after_work_event_id)
  ORDER BY unresolved.recorded_at, unresolved.work_event_id
  LIMIT requested_limit;
END
$items$;

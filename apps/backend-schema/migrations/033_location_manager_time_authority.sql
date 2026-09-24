-- T-062 / D-091. Functions are created, changed and eventually removed by migrations.
-- No new stored data or roles. Keep the administrator proof and all export/setup grants intact.
-- The current home of the person, never the historical event location, defines management scope.
CREATE FUNCTION taptime_server.has_time_management_authority_v1(
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
        AND home.revoked_at IS NULL AND home.location_id=scope.location_id
      WHERE target.organization_id=requested_organization_id
        AND target.user_id=requested_target_user_id
    ))
$authority$;
ALTER FUNCTION taptime_server.has_time_management_authority_v1(uuid,uuid,uuid,uuid)
  OWNER TO taptime_membership_management_function_owner;
REVOKE ALL ON FUNCTION taptime_server.has_time_management_authority_v1(uuid,uuid,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.has_time_management_authority_v1(uuid,uuid,uuid,uuid)
  TO taptime_time_review_reader, taptime_time_review_writer,
     taptime_time_review_read_function_owner, taptime_time_review_write_function_owner,
     taptime_wal_archive_function_owner;


-- D-092: the target person's work permissions are independent of actor management grants.
-- Internal only: callers must establish actor/tenant/person authority first.
CREATE FUNCTION taptime_server.membership_may_choose_time_target_v1(
  requested_organization_id uuid, requested_membership_id uuid,
  requested_target_type text, requested_target_id uuid
)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog
AS $target_authority$
  SELECT EXISTS (
    SELECT 1 FROM taptime_server.work_targets AS target
    JOIN taptime_server.memberships AS person
      ON person.organization_id=target.organization_id
      AND person.id=requested_membership_id AND person.revoked_at IS NULL
    JOIN taptime_server.organizations AS organization ON organization.id=target.organization_id
    WHERE target.organization_id=requested_organization_id AND target.active
      AND target.target_type=requested_target_type AND target.target_id=requested_target_id
      AND (NOT organization.locations_enabled OR EXISTS (
        SELECT 1 FROM taptime_server.work_target_location_assignments AS binding
        WHERE binding.organization_id=target.organization_id
          AND binding.target_type=target.target_type AND binding.target_id=target.target_id
          AND binding.revoked_at IS NULL
          AND taptime_server.membership_has_work_location_v1(
            requested_organization_id, requested_membership_id, binding.location_id
          )
      ))
  )
$target_authority$;
ALTER FUNCTION taptime_server.membership_may_choose_time_target_v1(uuid,uuid,text,uuid)
  OWNER TO taptime_mobile_read_function_owner;
REVOKE ALL ON FUNCTION taptime_server.membership_may_choose_time_target_v1(uuid,uuid,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.membership_may_choose_time_target_v1(uuid,uuid,text,uuid)
  TO taptime_time_review_read_function_owner, taptime_time_review_write_function_owner;

CREATE FUNCTION taptime_server.read_time_backfill_targets_v1(
  requested_organization_id uuid, requested_actor_user_id uuid, requested_membership_id uuid,
  requested_target_membership_id uuid, requested_after_type text, requested_after_id uuid,
  requested_limit integer
)
RETURNS TABLE(target_type text,target_id uuid,display_name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog
AS $backfill_targets$
DECLARE target_user uuid;
BEGIN
  SELECT person.user_id INTO target_user FROM taptime_server.memberships AS person
    WHERE person.organization_id=requested_organization_id AND person.id=requested_target_membership_id;
  IF current_setting('role',true) IS DISTINCT FROM 'taptime_time_review_reader'
    OR target_user IS NULL OR requested_limit IS NULL OR requested_limit NOT BETWEEN 1 AND 51
    OR (requested_after_type IS NULL) <> (requested_after_id IS NULL)
    OR (requested_after_type IS NOT NULL AND requested_after_type NOT IN ('customer','project','general_work'))
    OR NOT EXISTS (SELECT 1 FROM taptime_server.has_time_management_authority_v1(
      requested_organization_id,requested_actor_user_id,requested_membership_id,target_user
    )) THEN RAISE EXCEPTION 'Time target capability rejected' USING ERRCODE='42501'; END IF;
  RETURN QUERY
    SELECT target.target_type,target.target_id,target.display_name
    FROM taptime_server.work_targets AS target
    WHERE target.organization_id=requested_organization_id
      AND taptime_server.membership_may_choose_time_target_v1(
        requested_organization_id,requested_target_membership_id,target.target_type,target.target_id
      )
      AND (requested_after_type IS NULL OR (target.target_type COLLATE "C",target.target_id)
        > (requested_after_type COLLATE "C",requested_after_id))
    ORDER BY target.target_type COLLATE "C",target.target_id LIMIT requested_limit;
END
$backfill_targets$;
ALTER FUNCTION taptime_server.read_time_backfill_targets_v1(uuid,uuid,uuid,uuid,text,uuid,integer)
  OWNER TO taptime_time_review_read_function_owner;
REVOKE ALL ON FUNCTION taptime_server.read_time_backfill_targets_v1(uuid,uuid,uuid,uuid,text,uuid,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.read_time_backfill_targets_v1(uuid,uuid,uuid,uuid,text,uuid,integer)
  TO taptime_time_review_reader;

CREATE OR REPLACE FUNCTION taptime_server.read_effective_time_records_v1(
  requested_organization_id uuid,
  requested_actor_user_id uuid,
  requested_membership_id uuid,
  requested_from_inclusive timestamptz,
  requested_to_exclusive timestamptz,
  requested_after_started_at timestamptz,
  requested_after_time_record_id uuid,
  requested_limit integer
)
RETURNS TABLE (
  time_record_id uuid,
  employee_membership_id uuid,
  employee_display_name text,
  customer_id uuid,
  customer_display_name text,
  source text,
  status text,
  started_at timestamptz,
  stopped_at timestamptz,
  base_row_version bigint,
  effective_revision_number bigint,
  overlaps_another_record boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $records$
BEGIN
  IF pg_catalog.current_setting('role', true) <> 'taptime_time_review_reader'
    OR NOT EXISTS (SELECT 1 FROM taptime_server.has_time_management_authority_v1(
      requested_organization_id, requested_actor_user_id, requested_membership_id, NULL
    ))
    OR requested_from_inclusive IS NULL
    OR requested_to_exclusive IS NULL
    OR requested_to_exclusive <= requested_from_inclusive
    OR requested_to_exclusive - requested_from_inclusive > taptime_server.maximum_calendar_month_range()
    OR requested_limit NOT BETWEEN 1 AND 101
    OR (requested_after_started_at IS NULL) <> (requested_after_time_record_id IS NULL)
  THEN
    RAISE EXCEPTION 'Time review read capability rejected' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT record.time_record_id, membership.id, COALESCE(membership.display_name, ''),
         customer.id, customer.display_name, record.source, record.status,
         record.effective_started_at, record.effective_stopped_at,
         record.base_row_version, record.effective_revision_number,
         EXISTS (
           SELECT 1 FROM taptime_server.effective_time_records_v1 AS other
           WHERE other.organization_id = record.organization_id
             AND other.user_id = record.user_id
             AND other.time_record_id <> record.time_record_id
             AND other.effective_started_at < COALESCE(
               record.effective_stopped_at, pg_catalog.transaction_timestamp()
             )
             AND COALESCE(other.effective_stopped_at, pg_catalog.transaction_timestamp())
               > record.effective_started_at
         )
  FROM taptime_server.effective_time_records_v1 AS record
  LEFT JOIN taptime_server.memberships AS membership
    ON membership.organization_id = record.organization_id
   AND membership.user_id = record.user_id
  LEFT JOIN taptime_server.customers AS customer
    ON customer.organization_id = record.organization_id
   AND customer.id = record.target_customer_id
  WHERE record.organization_id = requested_organization_id
    AND EXISTS (SELECT 1 FROM taptime_server.has_time_management_authority_v1(
      requested_organization_id, requested_actor_user_id, requested_membership_id, record.user_id
    ))
    AND record.effective_started_at >= requested_from_inclusive
    AND record.effective_started_at < requested_to_exclusive
    AND (
      requested_after_started_at IS NULL
      OR (record.effective_started_at, record.time_record_id)
         > (requested_after_started_at, requested_after_time_record_id)
    )
  ORDER BY record.effective_started_at, record.time_record_id
  LIMIT requested_limit;
END
$records$;

CREATE OR REPLACE FUNCTION taptime_server.read_effective_time_records_v2(
  requested_organization_id uuid,
  requested_actor_user_id uuid,
  requested_membership_id uuid,
  requested_from_inclusive timestamptz,
  requested_to_exclusive timestamptz,
  requested_after_started_at timestamptz,
  requested_after_time_record_id uuid,
  requested_limit integer
)
RETURNS TABLE (
  time_record_id uuid,
  employee_membership_id uuid,
  employee_display_name text,
  target_type text,
  target_id uuid,
  target_display_name text,
  source text,
  status text,
  started_via text,
  stopped_via text,
  started_at timestamptz,
  stopped_at timestamptz,
  base_row_version bigint,
  effective_revision_number bigint,
  overlaps_another_record boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $records$
BEGIN
  IF pg_catalog.current_setting('role', true) <> 'taptime_time_review_reader'
    OR NOT EXISTS (SELECT 1 FROM taptime_server.has_time_management_authority_v1(
      requested_organization_id, requested_actor_user_id, requested_membership_id, NULL
    ))
    OR requested_from_inclusive IS NULL
    OR requested_to_exclusive IS NULL
    OR requested_to_exclusive <= requested_from_inclusive
    OR requested_to_exclusive - requested_from_inclusive > taptime_server.maximum_calendar_month_range()
    OR requested_limit NOT BETWEEN 1 AND 101
    OR (requested_after_started_at IS NULL) <> (requested_after_time_record_id IS NULL)
  THEN
    RAISE EXCEPTION 'Time review v2 read capability rejected' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT record.time_record_id, membership.id, COALESCE(membership.display_name, ''),
         record.target_type, record.target_id, target.display_name,
         record.source, record.status, record.started_via, record.stopped_via,
         record.effective_started_at, record.effective_stopped_at,
         record.base_row_version, record.effective_revision_number,
         EXISTS (
           SELECT 1 FROM taptime_server.effective_time_records_v2 AS other
           WHERE other.organization_id = record.organization_id
             AND other.user_id = record.user_id
             AND other.time_record_id <> record.time_record_id
             AND other.effective_started_at < COALESCE(
               record.effective_stopped_at, pg_catalog.transaction_timestamp()
             )
             AND COALESCE(other.effective_stopped_at, pg_catalog.transaction_timestamp())
               > record.effective_started_at
         )
  FROM taptime_server.effective_time_records_v2 AS record
  LEFT JOIN taptime_server.memberships AS membership
    ON membership.organization_id = record.organization_id
   AND membership.user_id = record.user_id
  JOIN taptime_server.work_targets AS target
    ON target.organization_id = record.organization_id
   AND target.target_type = record.target_type
   AND target.target_id = record.target_id
  WHERE record.organization_id = requested_organization_id
    AND EXISTS (SELECT 1 FROM taptime_server.has_time_management_authority_v1(
      requested_organization_id, requested_actor_user_id, requested_membership_id, record.user_id
    ))
    AND record.effective_started_at >= requested_from_inclusive
    AND record.effective_started_at < requested_to_exclusive
    AND (
      requested_after_started_at IS NULL
      OR (record.effective_started_at, record.time_record_id)
         > (requested_after_started_at, requested_after_time_record_id)
    )
  ORDER BY record.effective_started_at, record.time_record_id
  LIMIT requested_limit;
END
$records$;

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
    OR NOT EXISTS (SELECT 1 FROM taptime_server.has_time_management_authority_v1(
      requested_organization_id, requested_actor_user_id, requested_membership_id, NULL
    ))
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
  WHERE EXISTS (SELECT 1 FROM taptime_server.has_time_management_authority_v1(
      requested_organization_id, requested_actor_user_id, requested_membership_id, unresolved.user_id
    ))
    AND (requested_after_recorded_at IS NULL
     OR (unresolved.recorded_at, unresolved.work_event_id)
        > (requested_after_recorded_at, requested_after_work_event_id))
  ORDER BY unresolved.recorded_at, unresolved.work_event_id
  LIMIT requested_limit;
END
$items$;

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
    OR NOT EXISTS (SELECT 1 FROM taptime_server.has_time_management_authority_v1(
      requested_organization_id, requested_actor_user_id, requested_membership_id, NULL
    ))
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
  WHERE EXISTS (SELECT 1 FROM taptime_server.has_time_management_authority_v1(
      requested_organization_id, requested_actor_user_id, requested_membership_id, unresolved.user_id
    ))
    AND (requested_after_recorded_at IS NULL
     OR (unresolved.recorded_at, unresolved.work_event_id)
        > (requested_after_recorded_at, requested_after_work_event_id))
  ORDER BY unresolved.recorded_at, unresolved.work_event_id
  LIMIT requested_limit;
END
$items$;

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
  IF current_setting('role',true) IS DISTINCT FROM 'taptime_time_review_writer'
    OR actor_member IS DISTINCT FROM (request->>'expectedMembershipId')::uuid
    OR NOT EXISTS (SELECT 1 FROM taptime_server.has_time_management_authority_v1(org,actor_user,actor_member,NULL)) THEN
    RETURN jsonb_build_object('status','authority_rejected');
  END IF;
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
        ON h.organization_id=target.organization_id AND h.membership_id=target.id AND h.revoked_at IS NULL
      WHERE target.organization_id=org AND target.user_id=r.user_id AND h.location_id=ANY(location_scope)));
END
$details$;

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
  IF current_setting('role',true) IS DISTINCT FROM 'taptime_time_review_writer'
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

CREATE OR REPLACE FUNCTION taptime_server.read_administration_session_v2(
  requested_organization_id uuid,
  requested_actor_user_id uuid,
  requested_actor_membership_id uuid
)
RETURNS TABLE (
  locations_enabled boolean,
  setup_available boolean,
  employees_available boolean,
  time_records_available boolean,
  time_export_available boolean,
  review_items_available boolean,
  management_scope_kind text,
  management_location_id uuid,
  management_location_name text,
  nfc_setup_available boolean,
  role text,
  own_time_available boolean,
  manual_capture_available boolean
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, taptime_server
AS $session$
DECLARE
  actor_role text;
  feature_enabled boolean;
BEGIN
  IF pg_catalog.current_setting('role', true) <> 'taptime_identity_resolver'
    OR requested_organization_id IS NULL
    OR requested_actor_user_id IS NULL
    OR requested_actor_membership_id IS NULL
  THEN
    RETURN;
  END IF;

  SELECT membership.role, organization.locations_enabled
  INTO actor_role, feature_enabled
  FROM taptime_server.organizations AS organization
  JOIN taptime_server.memberships AS membership
    ON membership.organization_id = organization.id
   AND membership.user_id = requested_actor_user_id
   AND membership.id = requested_actor_membership_id
   AND membership.revoked_at IS NULL
  WHERE organization.id = requested_organization_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  PERFORM pg_catalog.set_config(
    'app.organization_id', requested_organization_id::text, true
  );
  PERFORM pg_catalog.set_config('app.user_id', requested_actor_user_id::text, true);
  PERFORM pg_catalog.set_config(
    'app.membership_id', requested_actor_membership_id::text, true
  );
  PERFORM pg_catalog.set_config('app.membership_role', actor_role, true);

  RETURN QUERY
  WITH membership_scope AS MATERIALIZED (
    SELECT authority.scope_kind, authority.location_id
    FROM taptime_server.has_membership_management_authority_v1(
      requested_organization_id, requested_actor_user_id,
      requested_actor_membership_id, 'read', NULL, NULL, NULL
    ) AS authority
  ),
  section_authority AS MATERIALIZED (
    SELECT
      taptime_server.has_current_admin_setup_authority(
        requested_organization_id
      ) AS setup_available,
      EXISTS (SELECT 1 FROM membership_scope) AS employees_available,
      EXISTS (SELECT 1 FROM taptime_server.has_time_management_authority_v1(
        requested_organization_id, requested_actor_user_id,
        requested_actor_membership_id, NULL
      )) AS time_review_available,
      taptime_server.has_current_time_export_authority(
        requested_organization_id
      ) AS time_export_available
  ),
  scope_shape AS MATERIALIZED (
    SELECT CASE
      WHEN EXISTS (
        SELECT 1 FROM membership_scope
        WHERE scope_kind = 'organization' AND location_id IS NULL
      ) THEN 'organization'::text
      ELSE 'locations'::text
    END AS scope_kind
  ),
  location_scope AS (
    SELECT scope.location_id, location.display_name
    FROM membership_scope AS scope
    JOIN taptime_server.locations AS location
      ON scope.scope_kind = 'location'
     AND scope.location_id = location.id
     AND location.organization_id = requested_organization_id
     AND location.active
  )
  SELECT feature_enabled,
         section_authority.setup_available,
         section_authority.employees_available,
         section_authority.time_review_available,
         section_authority.time_export_available,
         section_authority.time_review_available,
         scope_shape.scope_kind,
         location_scope.location_id,
         location_scope.display_name,
         taptime_server.has_current_nfc_setup_authority_v1(requested_organization_id, NULL),
         actor_role, true, true
  FROM section_authority
  CROSS JOIN scope_shape
  LEFT JOIN location_scope ON scope_shape.scope_kind = 'locations'
  ORDER BY location_scope.display_name, location_scope.location_id;
END
$session$;

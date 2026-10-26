-- T-135: migrations create, replace and retire this read capability. No stored
-- business data, roles or policies are introduced. Old readers stay unchanged.
CREATE FUNCTION taptime_server.read_review_days_v1(
  requested_ids uuid[], after_review_id uuid, after_kind integer,
  after_started_at timestamptz, after_record_id uuid, requested_limit integer
)
RETURNS TABLE (
  review_item_id uuid, row_kind integer, window_started_at timestamptz, window_ended_at timestamptz,
  time_record_id uuid, target_display_name text, started_at timestamptz, stopped_at timestamptz,
  cursor_started_at text, cursor_record_id uuid
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog
AS $days$
DECLARE
  org uuid := nullif(current_setting('app.organization_id',true),'')::uuid;
  actor uuid := nullif(current_setting('app.user_id',true),'')::uuid;
  member uuid := nullif(current_setting('app.membership_id',true),'')::uuid;
BEGIN
  IF current_setting('role',true) IS DISTINCT FROM 'taptime_time_review_reader'
    OR NOT EXISTS (SELECT 1 FROM taptime_server.has_time_management_authority_v1(org,actor,member,NULL))
  THEN RAISE EXCEPTION 'Time target capability rejected' USING ERRCODE='42501'; END IF;
  IF requested_ids IS NULL OR cardinality(requested_ids) NOT BETWEEN 1 AND 20
    OR array_ndims(requested_ids) <> 1 OR array_position(requested_ids,NULL) IS NOT NULL
    OR (SELECT count(DISTINCT id) FROM unnest(requested_ids) id) <> cardinality(requested_ids)
    OR requested_limit IS NULL OR requested_limit NOT BETWEEN 1 AND 51
    OR num_nonnulls(after_review_id,after_kind,after_started_at,after_record_id) NOT IN (0,4)
    OR (after_review_id IS NOT NULL AND (NOT after_review_id=ANY(requested_ids) OR after_kind NOT BETWEEN 0 AND 2))
  THEN RAISE EXCEPTION 'Invalid review day page' USING ERRCODE='22023'; END IF;

  RETURN QUERY
  WITH unresolved AS (
    SELECT event.id, reconciliation.user_id, event.occurred_at,
      COALESCE(event.target_type,'break') AS target_type, event.target_customer_id AS target_id
    FROM taptime_server.offline_event_reconciliations reconciliation
    JOIN taptime_server.work_events event ON event.organization_id=reconciliation.organization_id AND event.id=reconciliation.work_event_id
    WHERE reconciliation.organization_id=org AND reconciliation.work_event_id=ANY(requested_ids)
      AND reconciliation.result_status='review_pending'
      AND NOT EXISTS (SELECT 1 FROM taptime_server.offline_review_adjudications adjudication
        WHERE adjudication.organization_id=org AND adjudication.work_event_id=reconciliation.work_event_id)
    UNION ALL
    SELECT event.id,event.triggered_by_user_id,event.occurred_at,COALESCE(event.target_type,'break'),event.target_customer_id
    FROM taptime_server.work_events event
    WHERE event.organization_id=org AND event.id=ANY(requested_ids)
      AND (EXISTS (SELECT 1 FROM taptime_server.canonical_decisions decision
        WHERE decision.organization_id=org AND decision.work_event_id=event.id
          AND decision.actor_user_id=event.triggered_by_user_id AND decision.decision_type='escalation_required')
        OR (EXISTS (SELECT 1 FROM taptime_server.audit_events audit WHERE audit.organization_id=org AND audit.work_event_id=event.id
          AND audit.event_type='LifecycleDeferred' AND audit.entity_type='WorkEvent')
          AND NOT EXISTS (SELECT 1 FROM taptime_server.canonical_decisions decision WHERE decision.organization_id=org AND decision.work_event_id=event.id)))
      AND NOT EXISTS (SELECT 1 FROM taptime_server.offline_event_reconciliations reconciliation
        WHERE reconciliation.organization_id=org AND reconciliation.work_event_id=event.id)
      AND NOT EXISTS (SELECT 1 FROM taptime_server.offline_review_adjudications adjudication
        WHERE adjudication.organization_id=org AND adjudication.work_event_id=event.id)
    UNION ALL
    SELECT skipped.work_event_id,skipped.user_id,skipped.occurred_at,COALESCE(item.target_type,'break'),item.target_customer_id
    FROM taptime_server.offline_skipped_sequences skipped
    JOIN taptime_server.offline_capture_lease_items item ON item.organization_id=org AND item.id=skipped.lease_item_id
    WHERE skipped.organization_id=org AND skipped.work_event_id=ANY(requested_ids)
      AND NOT EXISTS (SELECT 1 FROM taptime_server.offline_skip_resolutions resolution
        WHERE resolution.organization_id=org AND resolution.work_event_id=skipped.work_event_id)
  ), authorized AS MATERIALIZED (
    SELECT evidence.id,evidence.user_id,array_position(requested_ids,evidence.id) AS ordinal,
      (evidence.occurred_at AT TIME ZONE 'Europe/Berlin')::date AS business_day
    FROM unresolved evidence
    WHERE (evidence.target_type='break' OR EXISTS (SELECT 1 FROM taptime_server.work_targets target
      WHERE target.organization_id=org AND target.target_type=evidence.target_type AND target.target_id=evidence.target_id))
      AND EXISTS (SELECT 1 FROM taptime_server.has_time_management_authority_v1(org,actor,member,evidence.user_id))
  ), days AS (
    SELECT authorized.*,business_day::timestamp AT TIME ZONE 'Europe/Berlin' AS day_start,
      (business_day+1)::timestamp AT TIME ZONE 'Europe/Berlin' AS day_end FROM authorized
  )
  SELECT day.id,row.kind,day.day_start,day.day_end,row.record_id,row.display_name,row.start_at,row.stop_at,
    to_char(row.sort_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),row.sort_id
  FROM days day
  CROSS JOIN LATERAL (
    SELECT 0 AS kind,NULL::uuid AS record_id,NULL::text AS display_name,NULL::timestamptz AS start_at,
      NULL::timestamptz AS stop_at,day.day_start AS sort_at,day.id AS sort_id
    UNION ALL
    SELECT CASE WHEN record.status='started' THEN 1 ELSE 2 END,record.time_record_id,target.display_name,
      record.effective_started_at,record.effective_stopped_at,record.effective_started_at,record.time_record_id
    FROM taptime_server.effective_time_records_v2 record
    JOIN taptime_server.work_targets target ON target.organization_id=record.organization_id
      AND target.target_type=record.target_type AND target.target_id=record.target_id
    WHERE record.organization_id=org AND record.user_id=day.user_id AND record.effective_started_at<day.day_end
      AND (record.status='started' OR record.effective_stopped_at>day.day_start)
  ) row
  WHERE after_review_id IS NULL OR (day.ordinal,row.kind,row.sort_at,row.sort_id)
    > (array_position(requested_ids,after_review_id),after_kind,after_started_at,after_record_id)
  ORDER BY day.ordinal,row.kind,row.sort_at,row.sort_id
  LIMIT requested_limit;
END $days$;
ALTER FUNCTION taptime_server.read_review_days_v1(uuid[],uuid,integer,timestamptz,uuid,integer)
  OWNER TO taptime_time_review_read_function_owner;
REVOKE ALL ON FUNCTION taptime_server.read_review_days_v1(uuid[],uuid,integer,timestamptz,uuid,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.read_review_days_v1(uuid[],uuid,integer,timestamptz,uuid,integer) TO taptime_time_review_reader;

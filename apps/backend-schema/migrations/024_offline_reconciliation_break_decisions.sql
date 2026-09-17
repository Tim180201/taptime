-- v2 carries the complete decision union, including break identifiers, before/after archival.
-- Keep v1 and historical migration checksums unchanged.
DROP FUNCTION taptime_server.read_offline_event_reconciliations_v2(uuid[]);

CREATE FUNCTION taptime_server.read_offline_event_reconciliations_v2(
  requested_work_event_ids uuid[]
)
RETURNS TABLE (
  work_event_id uuid,
  receipt_id uuid,
  device_sequence bigint,
  result_status text,
  review_reason text,
  decision_type text,
  reason text,
  time_entry_id uuid,
  active_time_entry_id uuid,
  previous_work_event_id uuid,
  archive_status text,
  break_interval_id uuid,
  active_break_interval_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $reconciliation$
BEGIN
  IF pg_catalog.current_setting('role', true) <> 'taptime_offline_reconciliation_reader'
    OR requested_work_event_ids IS NULL
    OR pg_catalog.cardinality(requested_work_event_ids) NOT BETWEEN 1 AND 25
  THEN
    RAISE EXCEPTION 'Offline reconciliation capability rejected' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT reconciliation.work_event_id, reconciliation.receipt_id,
         reconciliation.device_sequence, reconciliation.result_status,
         reconciliation.review_reason, decision.decision_type, decision.reason,
         decision.time_entry_id, decision.active_time_entry_id,
         decision.previous_work_event_id,
         CASE WHEN taptime_server.offline_wal_requirement_is_archived_v1(
           requirement.cluster_system_identifier,
           requirement.required_wal_lsn, requirement.required_wal_file
         ) THEN 'offsite_archived'::text ELSE 'archive_pending'::text END,
         decision.break_interval_id, decision.active_break_interval_id
  FROM taptime_server.offline_event_reconciliations AS reconciliation
  JOIN taptime_server.offline_event_archive_requirements AS requirement
    ON requirement.organization_id = reconciliation.organization_id
   AND requirement.work_event_id = reconciliation.work_event_id
  LEFT JOIN taptime_server.canonical_decisions AS decision
    ON decision.organization_id = reconciliation.organization_id
   AND decision.actor_user_id = reconciliation.user_id
   AND decision.work_event_id = reconciliation.decision_work_event_id
  WHERE reconciliation.organization_id = NULLIF(
      pg_catalog.current_setting('app.organization_id', true), ''
    )::uuid
    AND reconciliation.user_id = NULLIF(
      pg_catalog.current_setting('app.user_id', true), ''
    )::uuid
    AND reconciliation.membership_id = NULLIF(
      pg_catalog.current_setting('app.membership_id', true), ''
    )::uuid
    AND reconciliation.work_event_id = ANY(requested_work_event_ids)
  ORDER BY reconciliation.device_sequence;
END
$reconciliation$;

ALTER FUNCTION taptime_server.read_offline_event_reconciliations_v2(uuid[])
  OWNER TO taptime_offline_reconciliation_function_owner;
REVOKE ALL ON FUNCTION taptime_server.read_offline_event_reconciliations_v2(uuid[])
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.read_offline_event_reconciliations_v2(uuid[])
  TO taptime_offline_reconciliation_reader;

-- T-103: migrations create, update and eventually remove this read-only projection.
-- No event, lifecycle writer or historical reader is changed.
GRANT EXECUTE ON FUNCTION taptime_server.has_current_mobile_self_v1(uuid,uuid,uuid) TO taptime_time_review_read_function_owner;
CREATE FUNCTION taptime_server.read_mobile_active_capture_v1(requested_ids uuid[])
RETURNS TABLE(time_record_id uuid, target_id uuid, break_started_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog
AS $capture$
  SELECT record.time_record_id, record.target_id, pause.started_at
  FROM taptime_server.read_time_record_details_v1(requested_ids) authorized
  JOIN taptime_server.effective_time_records_v2 record USING(time_record_id)
  LEFT JOIN taptime_server.break_intervals pause
    ON pause.organization_id=record.organization_id
    AND pause.time_entry_id=record.canonical_time_entry_id AND pause.status='started'
  WHERE current_setting('role',true)='taptime_mobile_own_time_reader'
    AND record.status='started'
    AND taptime_server.has_current_mobile_self_v1(
      record.organization_id,record.user_id,NULLIF(current_setting('app.membership_id',true),'')::uuid);
$capture$;
ALTER FUNCTION taptime_server.read_mobile_active_capture_v1(uuid[]) OWNER TO taptime_time_review_read_function_owner;
REVOKE ALL ON FUNCTION taptime_server.read_mobile_active_capture_v1(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.read_mobile_active_capture_v1(uuid[]) TO taptime_mobile_own_time_reader;

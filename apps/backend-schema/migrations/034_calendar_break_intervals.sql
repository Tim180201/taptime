-- T-079: opt-in calendar projection. Migrations create, replace and eventually
-- remove this reader/policy; it stores no data and changes no legacy reader.
GRANT SELECT ON taptime_server.break_intervals TO taptime_time_review_read_function_owner;
CREATE POLICY break_intervals_calendar_select ON taptime_server.break_intervals
  FOR SELECT TO taptime_time_review_read_function_owner
  USING (organization_id = NULLIF(current_setting('app.organization_id',true),'')::uuid);

CREATE FUNCTION taptime_server.read_time_record_calendar_v1(requested_ids uuid[])
RETURNS TABLE(time_record_id uuid, details jsonb, calendar jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog
AS $calendar$
  -- Reuse the live self/tenant/home-location authorization from 033. Arbitrary
  -- record IDs cannot widen that scope. One snapshot covers details and breaks.
  WITH authorized AS MATERIALIZED (
    SELECT * FROM taptime_server.read_time_record_details_v1(requested_ids)
    WHERE current_setting('role',true) IN ('taptime_mobile_own_time_reader','taptime_membership_manager')
  )
  SELECT record.time_record_id, authorized.details, jsonb_build_object(
    'asOf',to_char(transaction_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'workDurationSeconds',GREATEST(0::bigint,
      floor(extract(epoch FROM (COALESCE(record.effective_stopped_at,transaction_timestamp())-record.effective_started_at)))::bigint
      - pauses.seconds),
    'breakDurationSeconds',pauses.seconds,
    'breakIntervals',pauses.intervals)
  FROM authorized JOIN taptime_server.effective_time_records_v2 record USING(time_record_id)
  CROSS JOIN LATERAL (
    -- Identical clipping and per-interval floor as export v3 (018/025).
    -- Totals retain PostgreSQL precision; JSON timestamps are display weights only.
    SELECT COALESCE(sum(floor(extract(epoch FROM (clipped.stop-clipped.start)))::bigint),0)::bigint AS seconds,
      COALESCE(jsonb_agg(jsonb_build_object(
        'startedAt',to_char(clipped.start AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'stoppedAt',to_char(clipped.stop AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
      ) ORDER BY clipped.start,clipped.id),'[]'::jsonb) AS intervals
    FROM (
      SELECT pause.id,GREATEST(pause.started_at,record.effective_started_at) AS start,
        LEAST(COALESCE(pause.stopped_at,transaction_timestamp()),
          COALESCE(record.effective_stopped_at,transaction_timestamp())) AS stop
      FROM taptime_server.break_intervals pause
      WHERE pause.organization_id=record.organization_id AND pause.time_entry_id=record.canonical_time_entry_id
        AND pause.started_at<COALESCE(record.effective_stopped_at,transaction_timestamp())
        AND COALESCE(pause.stopped_at,transaction_timestamp())>record.effective_started_at
    ) clipped
  ) pauses
  WHERE record.organization_id=NULLIF(current_setting('app.organization_id',true),'')::uuid;
$calendar$;
ALTER FUNCTION taptime_server.read_time_record_calendar_v1(uuid[]) OWNER TO taptime_time_review_read_function_owner;
REVOKE ALL ON FUNCTION taptime_server.read_time_record_calendar_v1(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.read_time_record_calendar_v1(uuid[])
  TO taptime_mobile_own_time_reader,taptime_membership_manager;

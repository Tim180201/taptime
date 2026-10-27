-- T-138: additive customer/person day projection. No stored data or new write path.
CREATE FUNCTION taptime_server.read_customer_person_days_v1(
  from_inclusive timestamptz, to_exclusive timestamptz,
  requested_customer_id uuid, requested_membership_id uuid
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog
AS $function$
DECLARE
  org uuid := nullif(current_setting('app.organization_id',true),'')::uuid;
  actor uuid := nullif(current_setting('app.membership_id',true),'')::uuid;
  customer_detail jsonb;
  person taptime_server.memberships%ROWTYPE;
  result jsonb;
BEGIN
  -- This existing entry point checks the live actor, tenant, role, Berlin month,
  -- and current/latest customer location. D-097 deliberately includes work by
  -- people from other home locations at a customer in the manager's scope.
  customer_detail := taptime_server.read_customer_hours_detail_v1(
    from_inclusive,to_exclusive,requested_customer_id,NULL,NULL,1);
  IF customer_detail->>'status'='not_found' THEN RETURN customer_detail; END IF;

  SELECT * INTO person FROM taptime_server.memberships m
    WHERE m.organization_id=org AND m.id=requested_membership_id;
  IF person.id IS NULL OR (customer_detail->>'scope'='self' AND person.id IS DISTINCT FROM actor) THEN
    RETURN jsonb_build_object('status','not_found');
  END IF;

  -- A month switch may be empty, but it must not become a directory of people
  -- who have never appeared at this customer. Own days need no prior entry.
  IF person.id<>actor AND NOT EXISTS (
    SELECT 1 FROM taptime_server.effective_time_records_v2 r
    WHERE r.organization_id=org AND r.user_id=person.user_id
      AND r.target_type='customer' AND r.target_id=requested_customer_id
  ) THEN RETURN jsonb_build_object('status','not_found'); END IF;

  WITH records AS MATERIALIZED (
    SELECT record.effective_started_at,record.effective_stopped_at,duration.work_seconds
    FROM taptime_server.effective_time_records_v2 record
    CROSS JOIN LATERAL taptime_server.time_record_duration_v1(record.organization_id,
      record.canonical_time_entry_id,record.effective_started_at,record.effective_stopped_at) duration
    WHERE record.organization_id=org AND record.user_id=person.user_id
      AND record.target_type='customer' AND record.target_id=requested_customer_id
      AND record.effective_started_at>=from_inclusive AND record.effective_started_at<to_exclusive
  ), days AS (
    SELECT (effective_started_at AT TIME ZONE 'Europe/Berlin')::date AS date,
      sum(work_seconds)::bigint AS seconds,bool_or(effective_stopped_at IS NULL) AS running
    FROM records GROUP BY 1
  )
  SELECT jsonb_build_object(
    'version','customer-hours.person-days.v1','asOf',customer_detail->'asOf',
    'customer',jsonb_build_object('customerId',requested_customer_id,'displayName',customer_detail->'customer'->'displayName'),
    'person',jsonb_build_object('membershipId',person.id,
      'displayName',coalesce(nullif(person.display_name,''),CASE person.role WHEN 'administrator' THEN 'Administrator' WHEN 'standortleitung' THEN 'Standortleitung' ELSE 'Mitarbeiter' END),
      'workDurationSeconds',coalesce(sum(days.seconds),0)::bigint,'running',coalesce(bool_or(days.running),false)),
    'days',coalesce(jsonb_agg(jsonb_build_object('date',days.date,'workDurationSeconds',days.seconds,'running',days.running) ORDER BY days.date) FILTER (WHERE days.date IS NOT NULL),'[]'::jsonb)
  ) INTO result FROM days;
  RETURN result;
END
$function$;
ALTER FUNCTION taptime_server.read_customer_person_days_v1(timestamptz,timestamptz,uuid,uuid) OWNER TO taptime_time_review_read_function_owner;
REVOKE ALL ON FUNCTION taptime_server.read_customer_person_days_v1(timestamptz,timestamptz,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.read_customer_person_days_v1(timestamptz,timestamptz,uuid,uuid) TO taptime_mobile_own_time_reader;

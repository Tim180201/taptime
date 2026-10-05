-- D-121: device reports a gap; no WorkEvent or TimeEntry is created.
-- Ingestor appends evidence; time managers append resolutions. Both histories are immutable.
-- Retention/removal belongs to T-016; no interactive deletion capability is granted.
CREATE TABLE taptime_server.offline_skipped_sequences (
  organization_id uuid NOT NULL,
  installation_id uuid NOT NULL,
  user_id uuid NOT NULL,
  membership_id uuid NOT NULL,
  device_sequence bigint NOT NULL CHECK(device_sequence > 0),
  work_event_id uuid NOT NULL,
  receipt_id uuid NOT NULL,
  lease_id uuid NOT NULL,
  lease_item_id uuid NOT NULL,
  occurred_at timestamptz NOT NULL CHECK(isfinite(occurred_at)),
  reason text NOT NULL CHECK(reason IN ('event_content_conflict','sequence_content_conflict','lease_binding_conflict',
    'receipt_metadata_conflict','invalid_response','http_400','http_409','http_422')),
  evidence_sha256 text NOT NULL CHECK(evidence_sha256 COLLATE "C" ~ '^[0-9a-f]{64}$'),
  request_hash text NOT NULL CHECK(request_hash COLLATE "C" ~ '^[0-9a-f]{64}$'),
  recorded_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY(organization_id,installation_id,device_sequence),
  UNIQUE(organization_id,work_event_id), UNIQUE(organization_id,receipt_id),
  FOREIGN KEY(organization_id,user_id,membership_id,installation_id) REFERENCES taptime_server.offline_installations(organization_id,user_id,membership_id,id),
  FOREIGN KEY(organization_id,user_id,membership_id) REFERENCES taptime_server.memberships(organization_id,user_id,id),
  FOREIGN KEY(organization_id,installation_id,lease_id) REFERENCES taptime_server.offline_capture_leases(organization_id,installation_id,id),
  FOREIGN KEY(organization_id,lease_id,lease_item_id) REFERENCES taptime_server.offline_capture_lease_items(organization_id,lease_id,id)
);
CREATE TABLE taptime_server.offline_skip_resolutions (
  organization_id uuid NOT NULL,
  work_event_id uuid NOT NULL,
  actor_user_id uuid NOT NULL,
  actor_membership_id uuid NOT NULL,
  command_id uuid NOT NULL,
  request_hash text NOT NULL CHECK(request_hash COLLATE "C" ~ '^[0-9a-f]{64}$'),
  reason text NOT NULL CHECK(char_length(btrim(reason)) BETWEEN 1 AND 500),
  resolution text NOT NULL CHECK(resolution IN ('no_time_record_change','create_recovered_time_record')),
  time_record_id uuid,
  recorded_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY(organization_id,work_event_id), UNIQUE(organization_id,command_id),
  FOREIGN KEY(organization_id,work_event_id) REFERENCES taptime_server.offline_skipped_sequences(organization_id,work_event_id),
  FOREIGN KEY(organization_id,actor_user_id,actor_membership_id) REFERENCES taptime_server.memberships(organization_id,user_id,id),
  CHECK((resolution='no_time_record_change')=(time_record_id IS NULL))
);
ALTER TABLE taptime_server.offline_skipped_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.offline_skipped_sequences FORCE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.offline_skip_resolutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.offline_skip_resolutions FORCE ROW LEVEL SECURITY;
CREATE TRIGGER immutable BEFORE UPDATE OR DELETE ON taptime_server.offline_skipped_sequences
  FOR EACH ROW EXECUTE FUNCTION taptime_server.reject_offline_immutable_change();
CREATE TRIGGER immutable BEFORE UPDATE OR DELETE ON taptime_server.offline_skip_resolutions
  FOR EACH ROW EXECUTE FUNCTION taptime_server.reject_offline_immutable_change();
REVOKE ALL ON taptime_server.offline_skipped_sequences,taptime_server.offline_skip_resolutions FROM PUBLIC;
CREATE POLICY offline_skips_actor ON taptime_server.offline_skipped_sequences TO taptime_offline_event_ingestor
  USING(taptime_server.current_offline_actor_matches_v1(organization_id,user_id,membership_id,NULL))
  WITH CHECK(taptime_server.current_offline_actor_matches_v1(organization_id,user_id,membership_id,NULL));
GRANT SELECT,INSERT ON taptime_server.offline_skipped_sequences TO taptime_offline_event_ingestor;
GRANT SELECT ON taptime_server.offline_skipped_sequences,taptime_server.offline_skip_resolutions
  TO taptime_time_review_read_function_owner,taptime_time_review_write_function_owner;
GRANT INSERT ON taptime_server.offline_skip_resolutions TO taptime_time_review_write_function_owner;
GRANT SELECT ON taptime_server.offline_capture_lease_items TO taptime_time_review_read_function_owner,taptime_time_review_write_function_owner;

CREATE FUNCTION taptime_server.read_time_review_items_v3(
  requested_organization_id uuid, requested_actor_user_id uuid, requested_membership_id uuid,
  requested_after_recorded_at timestamptz, requested_after_work_event_id uuid, requested_limit integer
)
RETURNS TABLE(review_item_id uuid,source_family text,employee_user_id uuid,employee_membership_id uuid,
  employee_display_name text,target_type text,target_id uuid,target_display_name text,trigger_type text,
  occurred_at timestamptz,recorded_at timestamptz,review_reason text,device_sequence bigint,predecessor_blocked boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $items$
BEGIN
  IF current_setting('role',true) IS DISTINCT FROM 'taptime_time_review_reader'
    OR NOT EXISTS(SELECT 1 FROM taptime_server.has_time_management_authority_v1(
      requested_organization_id,requested_actor_user_id,requested_membership_id,NULL))
    OR requested_limit IS NULL OR requested_limit NOT BETWEEN 1 AND 101
    OR (requested_after_recorded_at IS NULL)<>(requested_after_work_event_id IS NULL)
    THEN RAISE EXCEPTION 'Review capability rejected' USING ERRCODE='42501'; END IF;
  RETURN QUERY SELECT * FROM (
    SELECT * FROM taptime_server.read_time_review_items_v2(requested_organization_id,requested_actor_user_id,
      requested_membership_id,requested_after_recorded_at,requested_after_work_event_id,requested_limit)
    UNION ALL
    SELECT s.work_event_id,'offline_skip'::text,s.user_id,s.membership_id,coalesce(m.display_name,''),
      coalesce(i.target_type,'break'),coalesce(i.target_customer_id,i.id),coalesce(t.display_name,'Pause'),
      CASE WHEN i.item_type='nfc_assignment' THEN 'nfc' ELSE 'manual' END,s.occurred_at,s.recorded_at,s.reason,s.device_sequence,false
    FROM taptime_server.offline_skipped_sequences s
    JOIN taptime_server.memberships m ON m.organization_id=s.organization_id AND m.id=s.membership_id
    JOIN taptime_server.offline_capture_lease_items i ON i.organization_id=s.organization_id AND i.id=s.lease_item_id
    LEFT JOIN taptime_server.work_targets t ON t.organization_id=s.organization_id AND t.target_type=i.target_type AND t.target_id=i.target_customer_id
    WHERE s.organization_id=requested_organization_id
      AND NOT EXISTS(SELECT 1 FROM taptime_server.offline_skip_resolutions r WHERE r.organization_id=s.organization_id AND r.work_event_id=s.work_event_id)
      AND EXISTS(SELECT 1 FROM taptime_server.has_time_management_authority_v1(requested_organization_id,requested_actor_user_id,requested_membership_id,s.user_id))
      AND (requested_after_recorded_at IS NULL OR (s.recorded_at,s.work_event_id)>(requested_after_recorded_at,requested_after_work_event_id))
  ) combined ORDER BY combined.recorded_at,combined.review_item_id LIMIT requested_limit;
END $items$;
ALTER FUNCTION taptime_server.read_time_review_items_v3(uuid,uuid,uuid,timestamptz,uuid,integer)
  OWNER TO taptime_time_review_read_function_owner;
REVOKE ALL ON FUNCTION taptime_server.read_time_review_items_v3(uuid,uuid,uuid,timestamptz,uuid,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.read_time_review_items_v3(uuid,uuid,uuid,timestamptz,uuid,integer) TO taptime_time_review_reader;

-- Keep the existing adjudication unchanged for lifecycle-backed cases.
ALTER FUNCTION taptime_server.adjudicate_time_review_items_v1(uuid,uuid,uuid,uuid,text,uuid[],text,uuid,bigint,bigint,timestamptz,timestamptz,text)
  RENAME TO adjudicate_time_review_items_before_skip_v1;
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

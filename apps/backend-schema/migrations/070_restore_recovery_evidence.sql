-- T-055b / D-162. The authenticated ingress creates immutable recovery envelopes.
-- T-055c appends resolutions; T-016 will remove closed evidence under its retention rules.
-- Claimed identifiers in the envelope are NOT foreign keys proving historical ownership.
CREATE TABLE taptime_server.restore_recovery_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  membership_id uuid NOT NULL,
  operation_id uuid NOT NULL REFERENCES taptime_server.restore_recovery_operations(id),
  installation_id uuid,
  binding_digest bytea NOT NULL CHECK(octet_length(binding_digest)=32),
  device_sequence bigint NOT NULL CHECK(device_sequence>0),
  claimed_work_event_id uuid NOT NULL,
  claimed_receipt_id uuid NOT NULL,
  envelope jsonb NOT NULL,
  request_hash text NOT NULL CHECK(request_hash ~ '^[0-9a-f]{64}$'),
  evidence_digest text NOT NULL CHECK(evidence_digest ~ '^[0-9a-f]{64}$'),
  reason text NOT NULL CHECK(reason IN ('origin_lost','decision_lost')),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(organization_id,id), UNIQUE(claimed_work_event_id), UNIQUE(claimed_receipt_id),
  UNIQUE(binding_digest,device_sequence),
  FOREIGN KEY(organization_id,user_id,membership_id) REFERENCES taptime_server.memberships(organization_id,user_id,id),
  FOREIGN KEY(organization_id,user_id,membership_id,installation_id)
    REFERENCES taptime_server.offline_installations(organization_id,user_id,membership_id,id)
);
CREATE TABLE taptime_server.restore_evidence_archive_requirements (
  organization_id uuid NOT NULL,
  evidence_id uuid PRIMARY KEY,
  cluster_system_identifier bigint NOT NULL,
  required_wal_lsn pg_lsn NOT NULL,
  required_wal_file text NOT NULL CHECK(required_wal_file ~ '^[0-9A-F]{24}$'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY(organization_id,evidence_id) REFERENCES taptime_server.restore_recovery_evidence(organization_id,id)
);
CREATE TABLE taptime_server.offline_review_restore_references (
  organization_id uuid NOT NULL,
  work_event_id uuid NOT NULL,
  operation_id uuid NOT NULL REFERENCES taptime_server.restore_recovery_operations(id),
  PRIMARY KEY(organization_id,work_event_id),
  FOREIGN KEY(organization_id,work_event_id) REFERENCES taptime_server.offline_event_reconciliations(organization_id,work_event_id)
);
ALTER TABLE taptime_server.restore_recovery_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.restore_recovery_evidence FORCE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.restore_evidence_archive_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.restore_evidence_archive_requirements FORCE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.offline_review_restore_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.offline_review_restore_references FORCE ROW LEVEL SECURITY;
CREATE TRIGGER immutable BEFORE UPDATE OR DELETE ON taptime_server.restore_recovery_evidence
  FOR EACH STATEMENT EXECUTE FUNCTION taptime_server.reject_restore_operation_change_v1();
CREATE TRIGGER immutable BEFORE UPDATE OR DELETE ON taptime_server.restore_evidence_archive_requirements
  FOR EACH STATEMENT EXECUTE FUNCTION taptime_server.reject_restore_operation_change_v1();
CREATE TRIGGER immutable BEFORE UPDATE OR DELETE ON taptime_server.offline_review_restore_references
  FOR EACH STATEMENT EXECUTE FUNCTION taptime_server.reject_restore_operation_change_v1();
REVOKE ALL ON taptime_server.restore_recovery_evidence,taptime_server.restore_evidence_archive_requirements,
  taptime_server.offline_review_restore_references FROM PUBLIC;
GRANT SELECT,INSERT ON taptime_server.restore_recovery_evidence,taptime_server.restore_evidence_archive_requirements,
  taptime_server.offline_review_restore_references TO taptime_offline_event_function_owner;
GRANT SELECT(id,activated_at,activation_order) ON taptime_server.restore_recovery_operations TO taptime_offline_event_function_owner;
GRANT SELECT ON taptime_server.offline_skipped_sequences,
  taptime_server.work_targets TO taptime_offline_event_function_owner;
GRANT SELECT ON taptime_server.restore_evidence_archive_requirements TO taptime_wal_archive_function_owner;
GRANT SELECT ON taptime_server.restore_recovery_evidence TO taptime_lock_screen_owner;
CREATE POLICY recovery_actor_read ON taptime_server.restore_recovery_evidence TO taptime_offline_event_ingestor
  USING(organization_id=nullif(current_setting('app.organization_id',true),'')::uuid
    AND taptime_server.current_offline_actor_matches_v1(organization_id,user_id,membership_id,NULL));
GRANT SELECT ON taptime_server.restore_recovery_evidence TO taptime_offline_event_ingestor;

-- Cross-tenant collision checks return only an undifferentiated conflict. No claimed
-- ID is used to choose the owner; the locked authenticated actor supplies that owner.
CREATE FUNCTION taptime_server.receive_restore_evidence_v1(requested jsonb, requested_hash text, requested_binding bytea, requested_digest text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $receive$
DECLARE
  org uuid:=nullif(current_setting('app.organization_id',true),'')::uuid;
  person uuid:=nullif(current_setting('app.user_id',true),'')::uuid;
  member uuid:=nullif(current_setting('app.membership_id',true),'')::uuid;
  c jsonb:=requested->'evidence';
  v_event_id uuid:=(c->'workEvent'->>'id')::uuid;
  v_receipt_id uuid:=(c->'receipt'->>'id')::uuid;
  v_lease_id uuid:=(c->>'leaseId')::uuid;
  v_item_id uuid:=(c->>'leaseItemId')::uuid;
  sequence_no bigint:=(c->>'deviceSequence')::bigint;
  v_target_id uuid:=(c->'workEvent'->'target'->>'targetId')::uuid;
  v_assignment_id uuid:=coalesce(c->'workEvent'->>'assignmentId',c->'workEvent'->'trigger'->>'assignmentId')::uuid;
  v_tag_id uuid:=coalesce(c->'workEvent'->>'nfcTagId',c->'workEvent'->'trigger'->>'nfcTagId')::uuid;
  operation record;
  installation taptime_server.offline_installations%ROWTYPE;
  lease taptime_server.offline_capture_leases%ROWTYPE;
  item taptime_server.offline_capture_lease_items%ROWTYPE;
  existing taptime_server.restore_recovery_evidence%ROWTYPE;
  reconciliation taptime_server.offline_event_reconciliations%ROWTYPE;
  complete_origin boolean;
  retry boolean:=false;
  conflict jsonb:=jsonb_build_object('status','conflict','reason','event_content_conflict');
BEGIN
  IF current_setting('role',true) IS DISTINCT FROM 'taptime_offline_event_ingestor'
    OR org IS NULL OR person IS NULL OR member IS NULL
    OR (c->>'organizationId')::uuid IS DISTINCT FROM org OR (c->>'expectedMembershipId')::uuid IS DISTINCT FROM member
    OR requested_digest IS NULL OR requested_digest !~ '^[0-9a-f]{64}$'
    OR requested_hash IS NULL OR requested_hash !~ '^[0-9a-f]{64}$'
    OR requested_binding IS NULL OR octet_length(requested_binding)<>32
    OR requested->>'localState' NOT IN ('confirmed','pending') OR sequence_no IS NULL OR sequence_no<=0
    OR NOT EXISTS(SELECT FROM taptime_server.memberships m WHERE m.organization_id=org AND m.user_id=person AND m.id=member)
  THEN RAISE EXCEPTION 'Recovery authority rejected' USING ERRCODE='42501'; END IF;
  SELECT id,activated_at INTO operation FROM taptime_server.restore_recovery_operations WHERE id=(requested->>'operationId')::uuid;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','recovery_rejected','reason','operation_unavailable'); END IF;
  IF (c->'workEvent'->>'occurredAt')::timestamptz>operation.activated_at
    THEN RETURN jsonb_build_object('status','recovery_rejected','reason','capture_after_activation'); END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(org::text||chr(31)||person::text,0));
  -- Shared UUIDs and installation binding serialize even attempted cross-owner collisions.
  PERFORM pg_advisory_xact_lock(hashtextextended('restore-evidence:'||key,0))
    FROM unnest(ARRAY[v_event_id::text,v_receipt_id::text,encode(requested_binding,'hex')]) key ORDER BY key;
  SELECT * INTO installation FROM taptime_server.offline_installations WHERE binding_digest=requested_binding;
  IF FOUND AND (installation.organization_id,installation.user_id,installation.membership_id) IS DISTINCT FROM (org,person,member)
    THEN RETURN conflict; END IF;
  SELECT * INTO lease FROM taptime_server.offline_capture_leases WHERE id=v_lease_id;
  IF FOUND AND (lease.organization_id,lease.user_id,lease.membership_id,lease.installation_id)
    IS DISTINCT FROM (org,person,member,installation.id) THEN RETURN conflict; END IF;
  SELECT * INTO item FROM taptime_server.offline_capture_lease_items WHERE id=v_item_id;
  IF FOUND AND (item.organization_id,item.lease_id,item.installation_id)
    IS DISTINCT FROM (org,v_lease_id,installation.id) THEN RETURN conflict; END IF;
  IF EXISTS(SELECT FROM taptime_server.work_targets t WHERE t.target_id=v_target_id AND t.organization_id<>org)
    OR EXISTS(SELECT FROM taptime_server.nfc_assignments a WHERE a.id=v_assignment_id AND a.organization_id<>org)
    OR EXISTS(SELECT FROM taptime_server.nfc_tags t WHERE t.id=v_tag_id AND t.organization_id<>org)
    THEN RETURN conflict; END IF;
  complete_origin:=installation.id IS NOT NULL AND lease.id IS NOT NULL AND item.id IS NOT NULL;
  IF complete_origin AND (
    lease.lease_schema_version IS DISTINCT FROM (c->>'provenanceVersion')::int
    OR item.subject_type IS DISTINCT FROM coalesce(c->'workEvent'->'subject'->>'type','work')
    OR item.target_type IS DISTINCT FROM c->'workEvent'->'target'->>'targetType'
    OR item.target_customer_id IS DISTINCT FROM v_target_id
    OR item.assignment_id IS DISTINCT FROM v_assignment_id OR item.nfc_tag_id IS DISTINCT FROM v_tag_id
    OR item.item_type IS DISTINCT FROM CASE WHEN v_assignment_id IS NOT NULL THEN 'nfc_assignment'
      WHEN c->'workEvent'->'subject'->>'type'='break' THEN 'manual_break' ELSE 'manual_target' END
  ) THEN RETURN conflict; END IF;
  SELECT * INTO existing FROM taptime_server.restore_recovery_evidence e
    WHERE e.claimed_work_event_id=v_event_id OR e.claimed_receipt_id=v_receipt_id
      OR (e.binding_digest=requested_binding AND e.device_sequence=sequence_no) LIMIT 1;
  IF FOUND THEN
    IF (existing.organization_id,existing.user_id,existing.membership_id,existing.request_hash,existing.envelope->>'localState')
      IS DISTINCT FROM (org,person,member,requested_hash,requested->>'localState')
      OR existing.envelope->'evidence' IS DISTINCT FROM c THEN RETURN conflict; END IF;
    retry:=true;
  ELSE
    SELECT * INTO reconciliation FROM taptime_server.offline_event_reconciliations r
      WHERE r.work_event_id=v_event_id OR r.receipt_id=v_receipt_id
        OR (r.installation_id=installation.id AND r.device_sequence=sequence_no) LIMIT 1;
    IF FOUND THEN
      IF (reconciliation.organization_id,reconciliation.user_id,reconciliation.membership_id,reconciliation.request_content_hash)
        IS DISTINCT FROM (org,person,member,requested_hash) THEN RETURN conflict; END IF;
      RETURN jsonb_build_object('status','normal');
    END IF;
    IF EXISTS(SELECT FROM taptime_server.work_events WHERE id=v_event_id)
      OR EXISTS(SELECT FROM taptime_server.sync_receipts WHERE id=v_receipt_id)
      OR EXISTS(SELECT FROM taptime_server.offline_skipped_sequences s WHERE s.work_event_id=v_event_id OR s.receipt_id=v_receipt_id
        OR (s.installation_id=installation.id AND s.device_sequence=sequence_no)) THEN RETURN conflict; END IF;
    IF complete_origin AND requested->>'localState'='pending' THEN RETURN jsonb_build_object('status','normal'); END IF;
    INSERT INTO taptime_server.restore_recovery_evidence(organization_id,user_id,membership_id,operation_id,installation_id,
      binding_digest,device_sequence,claimed_work_event_id,claimed_receipt_id,envelope,request_hash,evidence_digest,reason)
    VALUES(org,person,member,operation.id,installation.id,requested_binding,sequence_no,v_event_id,v_receipt_id,requested,
      requested_hash,requested_digest,
      CASE WHEN complete_origin THEN 'decision_lost' ELSE 'origin_lost' END) RETURNING * INTO existing;
  END IF;
  RETURN jsonb_build_object('status','recovery_pending','operationId',existing.operation_id,'evidenceId',existing.id,
    'evidenceDigest',existing.evidence_digest,'workEventId',existing.claimed_work_event_id,'receiptId',existing.claimed_receipt_id,
    'deviceSequence',existing.device_sequence,'reason',existing.reason,'idempotentRetry',retry);
END $receive$;
ALTER FUNCTION taptime_server.receive_restore_evidence_v1(jsonb,text,bytea,text) OWNER TO taptime_offline_event_function_owner;
REVOKE ALL ON FUNCTION taptime_server.receive_restore_evidence_v1(jsonb,text,bytea,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.receive_restore_evidence_v1(jsonb,text,bytea,text) TO taptime_offline_event_ingestor;

-- Called in a new transaction AFTER the envelope commit; a retry repairs the gap.
CREATE FUNCTION taptime_server.require_restore_evidence_archive_v1(requested_id uuid,requested_digest text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $archive$
DECLARE e taptime_server.restore_recovery_evidence%ROWTYPE; lsn pg_lsn; archived boolean;
BEGIN
  IF current_setting('role',true) IS DISTINCT FROM 'taptime_offline_event_ingestor'
    THEN RAISE EXCEPTION 'Recovery archive authority rejected' USING ERRCODE='42501'; END IF;
  SELECT * INTO e FROM taptime_server.restore_recovery_evidence WHERE id=requested_id AND evidence_digest=requested_digest;
  IF NOT FOUND OR (e.organization_id,e.user_id,e.membership_id) IS DISTINCT FROM
    (nullif(current_setting('app.organization_id',true),'')::uuid,nullif(current_setting('app.user_id',true),'')::uuid,
     nullif(current_setting('app.membership_id',true),'')::uuid)
    THEN RAISE EXCEPTION 'Recovery archive evidence rejected' USING ERRCODE='42501'; END IF;
  lsn:=pg_current_wal_insert_lsn();
  INSERT INTO taptime_server.restore_evidence_archive_requirements(organization_id,evidence_id,cluster_system_identifier,
    required_wal_lsn,required_wal_file) VALUES(e.organization_id,e.id,
    taptime_server.current_offsite_archive_cluster_identifier_v1(),lsn,pg_walfile_name(lsn)) ON CONFLICT DO NOTHING;
  SELECT taptime_server.offline_wal_requirement_is_archived_v1(r.cluster_system_identifier,r.required_wal_lsn,r.required_wal_file)
    INTO archived FROM taptime_server.restore_evidence_archive_requirements r WHERE r.evidence_id=e.id;
  RETURN archived;
END $archive$;
ALTER FUNCTION taptime_server.require_restore_evidence_archive_v1(uuid,text) OWNER TO taptime_offline_event_function_owner;
REVOKE ALL ON FUNCTION taptime_server.require_restore_evidence_archive_v1(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.require_restore_evidence_archive_v1(uuid,text) TO taptime_offline_event_ingestor;

-- An original review keeps its reason; its separate immutable reference explains the restore.
CREATE FUNCTION taptime_server.link_offline_review_restore_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $link$
BEGIN
  IF NEW.result_status='review_pending' THEN
    INSERT INTO taptime_server.offline_review_restore_references(organization_id,work_event_id,operation_id)
    SELECT NEW.organization_id,NEW.work_event_id,o.id FROM taptime_server.restore_recovery_operations o
      JOIN taptime_server.work_events e ON e.organization_id=NEW.organization_id AND e.id=NEW.work_event_id
      WHERE e.occurred_at<=o.activated_at AND o.activated_at<=clock_timestamp()
      ORDER BY o.activation_order DESC LIMIT 1;
  END IF;
  RETURN NEW;
END $link$;
ALTER FUNCTION taptime_server.link_offline_review_restore_v1() OWNER TO taptime_offline_event_function_owner;
REVOKE ALL ON FUNCTION taptime_server.link_offline_review_restore_v1() FROM PUBLIC;
CREATE TRIGGER offline_review_restore AFTER INSERT ON taptime_server.offline_event_reconciliations
  FOR EACH ROW EXECUTE FUNCTION taptime_server.link_offline_review_restore_v1();

-- T-055c will append authorized resolutions. Until then all received cases remain open.
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

  RETURN EXISTS (SELECT FROM taptime_server.restore_recovery_evidence e
    WHERE e.organization_id=requested_organization_id AND e.user_id=requested_user_id) OR EXISTS (
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


CREATE OR REPLACE FUNCTION taptime_server.read_pending_offsite_wal_files_v1()
RETURNS TABLE (wal_file text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $pending$
BEGIN
  IF pg_catalog.current_setting('role', true) <> 'taptime_wal_archiver' THEN
    RAISE EXCEPTION 'Offsite WAL archive backlog rejected' USING ERRCODE = '42501';
  END IF;
  PERFORM taptime_server.current_offsite_archive_cluster_identifier_v1();
  RETURN QUERY
  WITH requirements AS (
    SELECT requirement.cluster_system_identifier,
           requirement.required_wal_file, requirement.required_wal_lsn,
           requirement.created_at
    FROM taptime_server.offline_event_archive_requirements AS requirement
    UNION ALL
    SELECT requirement.cluster_system_identifier,
           requirement.required_wal_file, requirement.required_wal_lsn,
           requirement.created_at
    FROM taptime_server.lifecycle_event_archive_requirements AS requirement
    UNION ALL
    SELECT requirement.cluster_system_identifier, requirement.required_wal_file,
           requirement.required_wal_lsn, requirement.created_at
    FROM taptime_server.restore_evidence_archive_requirements AS requirement
  )
  SELECT requirement.required_wal_file
  FROM requirements AS requirement
  WHERE NOT taptime_server.offline_wal_requirement_is_archived_v1(
    requirement.cluster_system_identifier,
    requirement.required_wal_lsn, requirement.required_wal_file
  )
  GROUP BY requirement.cluster_system_identifier, requirement.required_wal_file
  ORDER BY pg_catalog.min(requirement.created_at), requirement.required_wal_file;
END
$pending$;

ALTER FUNCTION taptime_server.read_pending_offsite_wal_files_v1()
  OWNER TO taptime_wal_archive_function_owner;
REVOKE ALL ON FUNCTION taptime_server.read_pending_offsite_wal_files_v1() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.read_pending_offsite_wal_files_v1()
  TO taptime_wal_archiver;


CREATE OR REPLACE FUNCTION taptime_server.read_offsite_wal_archive_backlog_v1()
RETURNS TABLE (
  oldest_required_at timestamptz,
  oldest_required_wal_file text,
  last_archived_wal_file text,
  last_archived_at timestamptz,
  pending_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $backlog$
DECLARE
  current_cluster_system_identifier bigint;
BEGIN
  IF pg_catalog.current_setting('role', true) <> 'taptime_wal_archiver' THEN
    RAISE EXCEPTION 'Offsite WAL archive backlog rejected' USING ERRCODE = '42501';
  END IF;
  current_cluster_system_identifier :=
    taptime_server.current_offsite_archive_cluster_identifier_v1();
  RETURN QUERY
  WITH requirements AS (
    SELECT requirement.cluster_system_identifier,
           requirement.required_wal_file, requirement.required_wal_lsn,
           requirement.created_at
    FROM taptime_server.offline_event_archive_requirements AS requirement
    UNION ALL
    SELECT requirement.cluster_system_identifier,
           requirement.required_wal_file, requirement.required_wal_lsn,
           requirement.created_at
    FROM taptime_server.lifecycle_event_archive_requirements AS requirement
    UNION ALL
    SELECT requirement.cluster_system_identifier, requirement.required_wal_file,
           requirement.required_wal_lsn, requirement.created_at
    FROM taptime_server.restore_evidence_archive_requirements AS requirement
  ), pending AS (
    SELECT requirement.required_wal_file, requirement.created_at
    FROM requirements AS requirement
    WHERE NOT taptime_server.offline_wal_requirement_is_archived_v1(
      requirement.cluster_system_identifier,
      requirement.required_wal_lsn, requirement.required_wal_file
    )
  )
  SELECT
    (SELECT candidate.created_at FROM pending AS candidate
      ORDER BY candidate.created_at, candidate.required_wal_file LIMIT 1),
    (SELECT candidate.required_wal_file FROM pending AS candidate
      ORDER BY candidate.created_at, candidate.required_wal_file LIMIT 1),
    (SELECT watermark.wal_file
      FROM taptime_server.offsite_wal_archive_watermarks AS watermark
      WHERE watermark.cluster_system_identifier = current_cluster_system_identifier
      ORDER BY watermark.advanced_at DESC, watermark.wal_file DESC LIMIT 1),
    (SELECT watermark.advanced_at
      FROM taptime_server.offsite_wal_archive_watermarks AS watermark
      WHERE watermark.cluster_system_identifier = current_cluster_system_identifier
      ORDER BY watermark.advanced_at DESC, watermark.wal_file DESC LIMIT 1),
    (SELECT pg_catalog.count(*) FROM pending);
END
$backlog$;

ALTER FUNCTION taptime_server.read_offsite_wal_archive_backlog_v1()
  OWNER TO taptime_wal_archive_function_owner;
REVOKE ALL ON FUNCTION taptime_server.read_offsite_wal_archive_backlog_v1() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.read_offsite_wal_archive_backlog_v1()
  TO taptime_wal_archiver;


CREATE OR REPLACE FUNCTION taptime_server.issue_lock_screen_capability_v1(requested_entry uuid, requested_installation uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $issue$
DECLARE
  org uuid := nullif(current_setting('app.organization_id',true),'')::uuid;
  person uuid := nullif(current_setting('app.user_id',true),'')::uuid;
  member uuid := nullif(current_setting('app.membership_id',true),'')::uuid;
  secret_bytes bytea;
  issued timestamptz;
BEGIN
  IF current_setting('role',true) IS DISTINCT FROM 'taptime_server_lifecycle' THEN RETURN jsonb_build_object('status','unauthorized'); END IF;
  PERFORM 1 FROM taptime_server.memberships WHERE organization_id=org AND user_id=person AND id=member AND revoked_at IS NULL FOR SHARE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','unauthorized'); END IF;
  PERFORM 1 FROM taptime_server.organizations WHERE id=org AND status='active' FOR SHARE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','unauthorized'); END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(org::text||chr(31)||person::text,0));
  IF EXISTS(SELECT FROM taptime_server.restore_recovery_evidence e WHERE e.organization_id=org AND e.user_id=person)
    THEN RETURN jsonb_build_object('status','unauthorized'); END IF;
  PERFORM 1 FROM taptime_server.time_entries WHERE organization_id=org AND user_id=person AND id=requested_entry AND status='started';
  IF NOT FOUND OR (requested_installation IS NOT NULL AND NOT EXISTS (
    SELECT FROM taptime_server.offline_installations WHERE organization_id=org AND user_id=person AND membership_id=member AND id=requested_installation
  )) THEN RETURN jsonb_build_object('status','unauthorized'); END IF;
  issued := date_trunc('milliseconds',clock_timestamp());
  DELETE FROM taptime_server.lock_screen_capabilities WHERE expires_at < issued-interval '7 days';
  UPDATE taptime_server.lock_screen_capabilities SET revoked_at=issued
    WHERE time_entry_id=requested_entry AND installation_id IS NOT DISTINCT FROM requested_installation AND revoked_at IS NULL;
  secret_bytes := taptime_crypto.gen_random_bytes(32);
  INSERT INTO taptime_server.lock_screen_capabilities(organization_id,user_id,membership_id,time_entry_id,installation_id,key_sha256,issued_at,expires_at)
    VALUES(org,person,member,requested_entry,requested_installation,sha256(secret_bytes),issued,issued+interval '24 hours');
  RETURN jsonb_build_object('status','issued','capability',rtrim(translate(encode(secret_bytes,'base64'),'+/','-_'),'='),
    'expiresAt',to_char((issued+interval '24 hours') AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'state',taptime_server.lock_screen_state_v1(org,person,requested_entry));
END
$issue$;

CREATE OR REPLACE FUNCTION taptime_server.perform_lock_screen_action_v1(requested_key_sha256 bytea, requested_action text, requested_command uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $perform$
DECLARE
  capability taptime_server.lock_screen_capabilities%ROWTYPE;
  previous taptime_server.lock_screen_commands%ROWTYPE;
  member_role text;
  instant timestamptz;
  state jsonb;
  envelope jsonb;
  result_status text;
BEGIN
  IF current_setting('role',true) IS DISTINCT FROM 'taptime_server_lifecycle'
    OR requested_key_sha256 IS NULL OR octet_length(requested_key_sha256)<>32 OR requested_command IS NULL
    OR requested_action IS NULL OR requested_action NOT IN ('pause','resume','stop')
  THEN RETURN jsonb_build_object('status','unauthorized'); END IF;
  SELECT * INTO capability FROM taptime_server.lock_screen_capabilities WHERE key_sha256=requested_key_sha256;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','unauthorized'); END IF;
  SELECT role INTO member_role FROM taptime_server.memberships
    WHERE organization_id=capability.organization_id AND user_id=capability.user_id AND id=capability.membership_id AND revoked_at IS NULL FOR SHARE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','unauthorized'); END IF;
  PERFORM 1 FROM taptime_server.organizations WHERE id=capability.organization_id AND status='active' FOR SHARE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','unauthorized'); END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(capability.organization_id::text||chr(31)||capability.user_id::text,0));
  IF EXISTS(SELECT FROM taptime_server.restore_recovery_evidence e WHERE e.organization_id=capability.organization_id AND e.user_id=capability.user_id)
    THEN RETURN jsonb_build_object('status','unauthorized'); END IF;
  SELECT * INTO capability FROM taptime_server.lock_screen_capabilities WHERE key_sha256=requested_key_sha256 FOR UPDATE;
  instant := date_trunc('milliseconds',clock_timestamp());
  IF NOT FOUND OR capability.revoked_at IS NOT NULL OR capability.expires_at<=instant THEN RETURN jsonb_build_object('status','unauthorized'); END IF;
  IF capability.rate_window_started_at IS NULL OR capability.rate_window_started_at<=instant-interval '1 minute' THEN
    capability.rate_window_started_at:=instant; capability.rate_count:=0;
  END IF;
  IF capability.rate_count>=10 THEN RETURN jsonb_build_object('status','rate_limited','retryAfterSeconds',
    greatest(1,ceil(extract(epoch FROM (capability.rate_window_started_at+interval '1 minute'-instant)))::integer)); END IF;
  UPDATE taptime_server.lock_screen_capabilities SET last_used_at=instant,rate_window_started_at=capability.rate_window_started_at,
    rate_count=capability.rate_count+1 WHERE id=capability.id;
  -- Ignore all incoming tenant GUCs: authority comes only from the key's immutable binding.
  PERFORM set_config('app.organization_id',capability.organization_id::text,true),set_config('app.user_id',capability.user_id::text,true),
    set_config('app.membership_id',capability.membership_id::text,true),set_config('app.membership_role',member_role,true),
    set_config('app.correlation_id',requested_command::text,true);
  state:=taptime_server.lock_screen_state_v1(capability.organization_id,capability.user_id,capability.time_entry_id);
  envelope:=jsonb_build_object('state',state,'actor',jsonb_build_object('organization_id',capability.organization_id,
    'user_id',capability.user_id,'membership_id',capability.membership_id,'membership_role',member_role));
  SELECT * INTO previous FROM taptime_server.lock_screen_commands WHERE organization_id=capability.organization_id
    AND user_id=capability.user_id AND command_id=requested_command;
  IF FOUND THEN
    IF previous.action<>requested_action OR previous.time_entry_id<>capability.time_entry_id THEN RETURN jsonb_build_object('status','command_id_conflict'); END IF;
    IF previous.result_status IS NULL THEN RAISE EXCEPTION 'Incomplete lock screen command'; END IF;
    RETURN envelope||jsonb_build_object('status',previous.result_status,'idempotentRetry',true,'events',previous.events);
  END IF;
  -- A stale stop can NEVER become a new start, even if another entry now runs.
  result_status:=CASE WHEN state->>'status'='stopped'
    OR (requested_action='pause' AND state->>'status'<>'running')
    OR (requested_action='resume' AND state->>'status'<>'paused') THEN 'state_changed' ELSE NULL END;
  INSERT INTO taptime_server.lock_screen_commands(organization_id,user_id,command_id,capability_id,time_entry_id,action,result_status)
    VALUES(capability.organization_id,capability.user_id,requested_command,capability.id,capability.time_entry_id,requested_action,result_status);
  RETURN envelope||jsonb_build_object('status',coalesce(result_status,'prepared'),'idempotentRetry',false,'events','[]'::jsonb);
END
$perform$;

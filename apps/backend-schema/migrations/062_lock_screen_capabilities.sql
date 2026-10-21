-- T-104a / D-146. Issue creates/rotates capabilities; action updates use/rate state.
-- Membership revocation withdraws them; a stopped entry never authorizes another event.
-- Issue purges rows seven days after expiry, cascading only ephemeral command receipts.
-- WorkEvents/audits remain immutable history. Migrations maintain/drop functions and owner.
-- Keep extension routines outside the application catalog and inaccessible to runtime roles.
-- A retiring migration removes this private schema/extension when no longer used.
CREATE SCHEMA IF NOT EXISTS taptime_crypto;
REVOKE ALL ON SCHEMA taptime_crypto FROM PUBLIC;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA taptime_crypto;
DO $owner$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname='taptime_lock_screen_owner') THEN
    CREATE ROLE taptime_lock_screen_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION BYPASSRLS;
  END IF;
END
$owner$;
ALTER ROLE taptime_lock_screen_owner WITH NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION BYPASSRLS;
GRANT USAGE ON SCHEMA taptime_server,taptime_crypto TO taptime_lock_screen_owner;

CREATE TABLE taptime_server.lock_screen_capabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  membership_id uuid NOT NULL,
  time_entry_id uuid NOT NULL,
  installation_id uuid,
  key_sha256 bytea NOT NULL UNIQUE CHECK (octet_length(key_sha256)=32),
  issued_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  last_used_at timestamptz,
  revoked_at timestamptz,
  rate_window_started_at timestamptz,
  rate_count integer NOT NULL DEFAULT 0 CHECK (rate_count BETWEEN 0 AND 10),
  UNIQUE (organization_id,user_id,id),
  FOREIGN KEY (organization_id,user_id,membership_id) REFERENCES taptime_server.memberships(organization_id,user_id,id),
  FOREIGN KEY (organization_id,user_id,time_entry_id) REFERENCES taptime_server.time_entries(organization_id,user_id,id),
  FOREIGN KEY (organization_id,user_id,membership_id,installation_id)
    REFERENCES taptime_server.offline_installations(organization_id,user_id,membership_id,id),
  CHECK (expires_at > issued_at AND expires_at <= issued_at + interval '24 hours')
);
CREATE UNIQUE INDEX lock_screen_one_current_installation ON taptime_server.lock_screen_capabilities
  (time_entry_id,installation_id) NULLS NOT DISTINCT WHERE revoked_at IS NULL;
CREATE INDEX lock_screen_expiry ON taptime_server.lock_screen_capabilities(expires_at);
CREATE INDEX lock_screen_membership ON taptime_server.lock_screen_capabilities(organization_id,membership_id) WHERE revoked_at IS NULL;
ALTER TABLE taptime_server.lock_screen_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.lock_screen_capabilities FORCE ROW LEVEL SECURITY;

CREATE TABLE taptime_server.lock_screen_commands (
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  command_id uuid NOT NULL,
  capability_id uuid NOT NULL,
  time_entry_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('pause','resume','stop')),
  result_status text CHECK (result_status IN ('applied','state_changed')),
  events jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(events)='array'),
  PRIMARY KEY (organization_id,user_id,command_id),
  FOREIGN KEY (organization_id,user_id,capability_id)
    REFERENCES taptime_server.lock_screen_capabilities(organization_id,user_id,id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id,user_id,time_entry_id) REFERENCES taptime_server.time_entries(organization_id,user_id,id)
);
ALTER TABLE taptime_server.lock_screen_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.lock_screen_commands FORCE ROW LEVEL SECURITY;
-- No runtime table grants or policies. Only the narrowly privileged NOLOGIN owner can access keys/receipts.
GRANT SELECT,INSERT,UPDATE,DELETE ON taptime_server.lock_screen_capabilities,taptime_server.lock_screen_commands TO taptime_lock_screen_owner;
GRANT SELECT (id,organization_id,user_id,role,revoked_at), UPDATE(id) ON taptime_server.memberships TO taptime_lock_screen_owner;
GRANT SELECT (id,status), UPDATE(id) ON taptime_server.organizations TO taptime_lock_screen_owner;
GRANT SELECT (organization_id,user_id,membership_id,id) ON taptime_server.offline_installations TO taptime_lock_screen_owner;
GRANT SELECT ON taptime_server.time_entries,taptime_server.break_intervals,taptime_server.work_targets TO taptime_lock_screen_owner;
GRANT EXECUTE ON FUNCTION taptime_crypto.gen_random_bytes(integer) TO taptime_lock_screen_owner;

ALTER TABLE taptime_server.work_events ADD COLUMN lock_screen_action text
  CHECK (lock_screen_action IS NULL OR (trigger_type='manual' AND
    ((lock_screen_action IN ('pause','resume') AND subject_type='break') OR (lock_screen_action='stop' AND subject_type='work'))));

-- Internal projection: no caller-supplied identity reaches it through a runtime grant.
CREATE FUNCTION taptime_server.lock_screen_state_v1(org uuid, person uuid, entry_id uuid)
RETURNS jsonb LANGUAGE sql VOLATILE SET search_path=pg_catalog AS $state$
  WITH instant AS MATERIALIZED (SELECT date_trunc('milliseconds',clock_timestamp()) AS at)
  SELECT jsonb_build_object('timeEntryId',e.id,
    'status',CASE WHEN e.status='stopped' THEN 'stopped' WHEN b.id IS NOT NULL THEN 'paused' ELSE 'running' END,
    'startedAt',to_char(e.started_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'breakStartedAt',to_char(b.started_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'stoppedAt',to_char(e.stopped_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'asOf',to_char(instant.at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'workDurationSeconds',greatest(0,floor(extract(epoch FROM (coalesce(e.stopped_at,instant.at)-e.started_at)))::bigint-d.break_seconds),
    'breakDurationSeconds',d.break_seconds,
    'target',jsonb_build_object('targetType',e.target_type,'targetId',e.target_customer_id,'displayName',t.display_name))
  FROM taptime_server.time_entries e CROSS JOIN instant
  JOIN taptime_server.work_targets t ON t.organization_id=e.organization_id AND t.target_type=e.target_type AND t.target_id=e.target_customer_id
  LEFT JOIN taptime_server.break_intervals b ON b.organization_id=e.organization_id AND b.time_entry_id=e.id AND b.status='started'
  -- Same clipping/per-interval floor as export. Use this post-lock server instant also
  -- for open breaks: transaction_timestamp() can precede a newly booked break.
  CROSS JOIN LATERAL (
    SELECT coalesce(sum(greatest(0,floor(extract(epoch FROM (
      least(coalesce(p.stopped_at,instant.at),coalesce(e.stopped_at,instant.at))-greatest(p.started_at,e.started_at)
    ))))::bigint),0)::bigint AS break_seconds
    FROM taptime_server.break_intervals p WHERE p.organization_id=e.organization_id AND p.time_entry_id=e.id
      AND p.started_at<coalesce(e.stopped_at,instant.at) AND coalesce(p.stopped_at,instant.at)>e.started_at
  ) d
  WHERE e.organization_id=org AND e.user_id=person AND e.id=entry_id;
$state$;
ALTER FUNCTION taptime_server.lock_screen_state_v1(uuid,uuid,uuid) OWNER TO taptime_lock_screen_owner;
REVOKE ALL ON FUNCTION taptime_server.lock_screen_state_v1(uuid,uuid,uuid) FROM PUBLIC;

CREATE FUNCTION taptime_server.issue_lock_screen_capability_v1(requested_entry uuid, requested_installation uuid)
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

-- The HTTP boundary hashes the key before SQL: plaintext never occurs in SQL parameters,
-- PostgreSQL error details, stored rows, command receipts or diagnostic logs.
-- This function locks/authorizes the intent. The existing TypeScript BusinessEngine books
-- its manual events and finish completes the command in THIS SAME transaction.
CREATE FUNCTION taptime_server.perform_lock_screen_action_v1(requested_key_sha256 bytea, requested_action text, requested_command uuid)
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

CREATE FUNCTION taptime_server.finish_lock_screen_action_v1(requested_command uuid, requested_events jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $finish$
DECLARE
  org uuid := nullif(current_setting('app.organization_id',true),'')::uuid;
  person uuid := nullif(current_setting('app.user_id',true),'')::uuid;
  command taptime_server.lock_screen_commands%ROWTYPE;
  state jsonb;
BEGIN
  IF current_setting('role',true) IS DISTINCT FROM 'taptime_server_lifecycle' THEN RAISE EXCEPTION 'Lock screen authority unavailable'; END IF;
  SELECT * INTO command FROM taptime_server.lock_screen_commands
    WHERE organization_id=org AND user_id=person AND command_id=requested_command AND result_status IS NULL FOR UPDATE;
  IF NOT FOUND OR jsonb_typeof(requested_events) IS DISTINCT FROM 'array' OR jsonb_array_length(requested_events) NOT BETWEEN 1 AND 2
    THEN RAISE EXCEPTION 'Lock screen command unavailable'; END IF;
  state:=taptime_server.lock_screen_state_v1(org,person,command.time_entry_id);
  IF (command.action='pause' AND state->>'status'<>'paused') OR (command.action='resume' AND state->>'status'<>'running')
    OR (command.action='stop' AND state->>'status'<>'stopped') THEN RAISE EXCEPTION 'Lock screen state changed'; END IF;
  UPDATE taptime_server.lock_screen_commands SET result_status='applied',events=requested_events
    WHERE organization_id=org AND user_id=person AND command_id=requested_command;
  RETURN jsonb_build_object('status','applied','state',state,'idempotentRetry',false);
END
$finish$;

CREATE FUNCTION taptime_server.revoke_lock_screen_membership_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $revoke$
BEGIN
  UPDATE taptime_server.lock_screen_capabilities SET revoked_at=coalesce(revoked_at,NEW.revoked_at)
    WHERE organization_id=NEW.organization_id AND membership_id=NEW.id AND revoked_at IS NULL;
  RETURN NEW;
END
$revoke$;
CREATE TRIGGER lock_screen_membership_revoked AFTER UPDATE OF revoked_at ON taptime_server.memberships
  FOR EACH ROW WHEN (NEW.revoked_at IS NOT NULL AND OLD.revoked_at IS DISTINCT FROM NEW.revoked_at)
  EXECUTE FUNCTION taptime_server.revoke_lock_screen_membership_v1();

ALTER FUNCTION taptime_server.issue_lock_screen_capability_v1(uuid,uuid) OWNER TO taptime_lock_screen_owner;
ALTER FUNCTION taptime_server.perform_lock_screen_action_v1(bytea,text,uuid) OWNER TO taptime_lock_screen_owner;
ALTER FUNCTION taptime_server.finish_lock_screen_action_v1(uuid,jsonb) OWNER TO taptime_lock_screen_owner;
ALTER FUNCTION taptime_server.revoke_lock_screen_membership_v1() OWNER TO taptime_lock_screen_owner;
REVOKE ALL ON FUNCTION taptime_server.issue_lock_screen_capability_v1(uuid,uuid),taptime_server.perform_lock_screen_action_v1(bytea,text,uuid),
  taptime_server.finish_lock_screen_action_v1(uuid,jsonb),taptime_server.revoke_lock_screen_membership_v1() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.issue_lock_screen_capability_v1(uuid,uuid),taptime_server.perform_lock_screen_action_v1(bytea,text,uuid),
  taptime_server.finish_lock_screen_action_v1(uuid,jsonb) TO taptime_server_lifecycle;

-- Opt-in managed-person history only; old mobile/detail/export replies remain byte-compatible.
GRANT SELECT ON taptime_server.work_events,taptime_server.canonical_decisions TO taptime_membership_management_function_owner;
CREATE FUNCTION taptime_server.read_lock_screen_history_v1(requested_ids uuid[])
RETURNS TABLE(time_record_id uuid, events jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $history$
  SELECT d.result_time_entry_id,jsonb_agg(jsonb_build_object('workEventId',e.id,'action',e.lock_screen_action,
    'at',to_char(e.occurred_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) ORDER BY e.occurred_at,e.received_at,CASE WHEN e.lock_screen_action='stop' THEN 1 ELSE 0 END,e.id)
  FROM taptime_server.work_events e JOIN taptime_server.canonical_decisions d
    ON d.organization_id=e.organization_id AND d.work_event_id=e.id
  JOIN taptime_server.memberships m ON m.organization_id=e.organization_id AND m.user_id=e.triggered_by_user_id
  WHERE current_setting('role',true)='taptime_membership_manager' AND cardinality(requested_ids)<=22
    AND e.organization_id=nullif(current_setting('app.organization_id',true),'')::uuid
    AND e.lock_screen_action IS NOT NULL AND d.result_time_entry_id=ANY(requested_ids)
    AND EXISTS (SELECT FROM taptime_server.has_membership_management_authority_v1(e.organization_id,
      nullif(current_setting('app.user_id',true),'')::uuid,nullif(current_setting('app.membership_id',true),'')::uuid,'read',NULL,NULL,NULL) scope
      WHERE scope.scope_kind='organization' OR (scope.scope_kind='location'
        AND scope.location_id=taptime_server.membership_management_home_v1(e.organization_id,m.id)))
  GROUP BY d.result_time_entry_id;
$history$;
ALTER FUNCTION taptime_server.read_lock_screen_history_v1(uuid[]) OWNER TO taptime_membership_management_function_owner;
REVOKE ALL ON FUNCTION taptime_server.read_lock_screen_history_v1(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.read_lock_screen_history_v1(uuid[]) TO taptime_membership_manager;

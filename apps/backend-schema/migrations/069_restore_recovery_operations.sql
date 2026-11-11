-- T-055a: operational metadata only. The activation creates immutable operations;
-- later recovery work appends separate events. No production deletion before T-016.
-- Migration owns the NOLOGIN roles; future migrations maintain/retire them.
DO $roles$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname='taptime_restore_activator') THEN
    CREATE ROLE taptime_restore_activator NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname='taptime_restore_operation_owner') THEN
    CREATE ROLE taptime_restore_operation_owner NOLOGIN;
  END IF;
END $roles$;
ALTER ROLE taptime_restore_activator WITH NOLOGIN NOSUPERUSER NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
ALTER ROLE taptime_restore_operation_owner WITH NOLOGIN NOSUPERUSER NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION BYPASSRLS;
DO $isolated_roles$
BEGIN
  IF EXISTS (
    SELECT FROM pg_catalog.pg_auth_members AS edge
    JOIN pg_catalog.pg_roles AS role ON role.oid IN (edge.roleid,edge.member)
    WHERE role.rolname IN ('taptime_restore_activator','taptime_restore_operation_owner')
  ) THEN RAISE EXCEPTION 'Restore roles must have no memberships' USING ERRCODE='42501'; END IF;
END $isolated_roles$;
GRANT USAGE ON SCHEMA taptime_server TO taptime_restore_activator,taptime_restore_operation_owner;
GRANT EXECUTE ON FUNCTION pg_catalog.pg_control_system(), pg_catalog.pg_control_checkpoint()
  TO taptime_restore_operation_owner;

CREATE TABLE taptime_server.restore_recovery_operations (
  id uuid PRIMARY KEY,
  activation_order bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  cluster_identifier text NOT NULL CHECK (cluster_identifier ~ '^[0-9a-f]{16}$'),
  timeline_id bigint NOT NULL CHECK (timeline_id BETWEEN 1 AND 4294967295),
  target_kind text NOT NULL CHECK (target_kind IN ('latest','point_in_time')),
  target_time timestamptz,
  replay_lsn pg_lsn NOT NULL CHECK (replay_lsn > '0/0'::pg_lsn),
  replayed_transaction_at timestamptz,
  time_basis text NOT NULL CHECK (time_basis IN ('last_replayed_transaction','no_replayed_transaction')),
  activated_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  CHECK ((target_kind='latest' AND target_time IS NULL)
    OR (target_kind='point_in_time' AND target_time IS NOT NULL AND pg_catalog.isfinite(target_time))),
  CHECK ((time_basis='last_replayed_transaction' AND replayed_transaction_at IS NOT NULL
      AND pg_catalog.isfinite(replayed_transaction_at))
    OR (time_basis='no_replayed_transaction' AND replayed_transaction_at IS NULL)),
  CHECK (pg_catalog.isfinite(activated_at))
);
ALTER TABLE taptime_server.restore_recovery_operations OWNER TO taptime_restore_operation_owner;
ALTER TABLE taptime_server.restore_recovery_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.restore_recovery_operations FORCE ROW LEVEL SECURITY;
-- No table privileges or policy for runtime roles: only the narrow functions below.
CREATE FUNCTION taptime_server.reject_restore_operation_change_v1() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $immutable$
BEGIN RAISE EXCEPTION 'Restore operations are immutable' USING ERRCODE='42501'; END $immutable$;
REVOKE ALL ON FUNCTION taptime_server.reject_restore_operation_change_v1() FROM PUBLIC;
CREATE TRIGGER restore_operation_immutable BEFORE UPDATE OR DELETE OR TRUNCATE
  ON taptime_server.restore_recovery_operations FOR EACH STATEMENT
  EXECUTE FUNCTION taptime_server.reject_restore_operation_change_v1();

CREATE FUNCTION taptime_server.record_restore_recovery_v1(
  requested_id uuid, requested_cluster text, requested_timeline bigint,
  requested_target_kind text, requested_target_time timestamptz,
  requested_replay_lsn pg_lsn, requested_replayed_transaction_at timestamptz
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $record$
DECLARE existing taptime_server.restore_recovery_operations%ROWTYPE;
BEGIN
  IF pg_catalog.current_setting('role',true) IS DISTINCT FROM 'taptime_restore_activator' THEN
    RAISE EXCEPTION 'Restore activation authority rejected' USING ERRCODE='42501';
  END IF;
  IF pg_catalog.pg_is_in_recovery()
    OR requested_cluster IS DISTINCT FROM (SELECT pg_catalog.lpad(pg_catalog.to_hex(system_identifier),16,'0') FROM pg_catalog.pg_control_system())
    OR requested_timeline IS DISTINCT FROM (SELECT timeline_id::bigint FROM pg_catalog.pg_control_checkpoint())
    OR requested_replay_lsn > pg_catalog.pg_current_wal_lsn()
  THEN RAISE EXCEPTION 'Restore evidence differs from running cluster' USING ERRCODE='22023'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('taptime:restore-recovery:v1',0));
  SELECT * INTO existing FROM taptime_server.restore_recovery_operations WHERE id=requested_id;
  IF FOUND THEN
    IF ROW(existing.cluster_identifier,existing.timeline_id,existing.target_kind,existing.target_time,
        existing.replay_lsn,existing.replayed_transaction_at)
      IS DISTINCT FROM ROW(requested_cluster,requested_timeline,requested_target_kind,requested_target_time,
        requested_replay_lsn,requested_replayed_transaction_at)
    THEN RAISE EXCEPTION 'Restore operation evidence conflict' USING ERRCODE='22023'; END IF;
    RETURN existing.id;
  END IF;
  INSERT INTO taptime_server.restore_recovery_operations
    (id,cluster_identifier,timeline_id,target_kind,target_time,replay_lsn,replayed_transaction_at,time_basis)
    VALUES (requested_id,requested_cluster,requested_timeline,requested_target_kind,requested_target_time,
      requested_replay_lsn,requested_replayed_transaction_at,
      CASE WHEN requested_replayed_transaction_at IS NULL THEN 'no_replayed_transaction' ELSE 'last_replayed_transaction' END);
  RETURN requested_id;
END $record$;
ALTER FUNCTION taptime_server.record_restore_recovery_v1(uuid,text,bigint,text,timestamptz,pg_lsn,timestamptz)
  OWNER TO taptime_restore_operation_owner;
REVOKE ALL ON FUNCTION taptime_server.record_restore_recovery_v1(uuid,text,bigint,text,timestamptz,pg_lsn,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.record_restore_recovery_v1(uuid,text,bigint,text,timestamptz,pg_lsn,timestamptz)
  TO taptime_restore_activator;

GRANT SELECT (id,user_id,organization_id,revoked_at) ON taptime_server.memberships TO taptime_restore_operation_owner;
GRANT SELECT (id,status) ON taptime_server.organizations TO taptime_restore_operation_owner;
CREATE FUNCTION taptime_server.read_latest_restore_recovery_v1(
  requested_organization_id uuid, requested_user_id uuid, requested_membership_id uuid
) RETURNS TABLE (id uuid,target_kind text,target_time timestamptz,activated_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $read$
BEGIN
  IF pg_catalog.current_setting('role',true) IS DISTINCT FROM 'taptime_identity_resolver'
    OR NOT EXISTS (SELECT FROM taptime_server.memberships AS membership
      JOIN taptime_server.organizations AS organization ON organization.id=membership.organization_id
      WHERE membership.id=requested_membership_id AND membership.organization_id=requested_organization_id
        AND membership.user_id=requested_user_id AND membership.revoked_at IS NULL AND organization.status='active')
  THEN RAISE EXCEPTION 'Restore read authority rejected' USING ERRCODE='42501'; END IF;
  RETURN QUERY SELECT operation.id,operation.target_kind,operation.target_time,operation.activated_at
    FROM taptime_server.restore_recovery_operations AS operation ORDER BY operation.activation_order DESC LIMIT 1;
END $read$;
ALTER FUNCTION taptime_server.read_latest_restore_recovery_v1(uuid,uuid,uuid) OWNER TO taptime_restore_operation_owner;
REVOKE ALL ON FUNCTION taptime_server.read_latest_restore_recovery_v1(uuid,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.read_latest_restore_recovery_v1(uuid,uuid,uuid) TO taptime_identity_resolver;

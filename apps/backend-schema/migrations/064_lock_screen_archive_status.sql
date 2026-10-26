-- T-104e: authenticated app reconciliation reads archive evidence, never repeats a command.
-- No new stored state. This function is installed/changed/retired through schema migrations.
CREATE FUNCTION taptime_server.lock_screen_archive_status_v1(requested_entry uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $archive$
DECLARE
  org uuid := nullif(current_setting('app.organization_id',true),'')::uuid;
  person uuid := nullif(current_setting('app.user_id',true),'')::uuid;
  member uuid := nullif(current_setting('app.membership_id',true),'')::uuid;
BEGIN
  IF current_setting('role',true) IS DISTINCT FROM 'taptime_server_lifecycle' OR requested_entry IS NULL
    OR NOT EXISTS (SELECT FROM taptime_server.memberships WHERE organization_id=org AND user_id=person AND id=member AND revoked_at IS NULL)
  THEN RETURN NULL; END IF;
  RETURN (SELECT coalesce(bool_and(coalesce(taptime_server.offline_wal_requirement_is_archived_v1(
      a.cluster_system_identifier,a.required_wal_lsn,a.required_wal_file),false)),true)
    FROM taptime_server.sync_receipts r JOIN taptime_server.work_events e
      ON e.organization_id=r.organization_id AND e.id=r.work_event_id AND e.triggered_by_user_id=r.user_id
    LEFT JOIN taptime_server.lifecycle_event_archive_requirements a
      ON a.organization_id=r.organization_id AND a.work_event_id=r.work_event_id AND a.receipt_id=r.id
      AND a.user_id=person AND a.membership_id=member
    WHERE r.organization_id=org AND r.user_id=person AND r.server_time_entry_id=requested_entry
      AND e.lock_screen_action IS NOT NULL);
END
$archive$;
ALTER FUNCTION taptime_server.lock_screen_archive_status_v1(uuid) OWNER TO taptime_wal_archive_function_owner;
REVOKE ALL ON FUNCTION taptime_server.lock_screen_archive_status_v1(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.lock_screen_archive_status_v1(uuid) TO taptime_server_lifecycle;

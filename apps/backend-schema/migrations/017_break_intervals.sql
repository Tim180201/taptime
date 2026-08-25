-- T-012: one break trigger, interpreted by the Business Engine as interval start or stop.
-- Work targets remain booking dimensions only; a break is an event subject, never a target.

ALTER TABLE taptime_server.work_events
  DROP CONSTRAINT work_events_assignment_snapshot_fk,
  DROP CONSTRAINT work_events_target_fk_v2;

ALTER TABLE taptime_server.offline_capture_lease_items
  DROP CONSTRAINT offline_lease_items_assignment_snapshot_fk,
  DROP CONSTRAINT offline_lease_items_target_fk_v2,
  DROP CONSTRAINT offline_lease_items_item_shape_v2,
  ALTER COLUMN target_type DROP NOT NULL,
  ALTER COLUMN target_customer_id DROP NOT NULL,
  ALTER COLUMN target_row_version DROP NOT NULL,
  ADD COLUMN subject_type text NOT NULL DEFAULT 'work';

ALTER TABLE taptime_server.nfc_assignments
  DROP CONSTRAINT nfc_assignments_snapshot_unique,
  DROP CONSTRAINT nfc_assignments_target_type_check,
  DROP CONSTRAINT nfc_assignments_customer_fk,
  ALTER COLUMN target_type DROP NOT NULL,
  ALTER COLUMN target_customer_id DROP NOT NULL,
  ADD COLUMN assignment_type text NOT NULL DEFAULT 'work',
  ADD CONSTRAINT nfc_assignments_subject_shape_v3 CHECK (
    (
      assignment_type = 'work'
      AND target_type = 'customer'
      AND target_customer_id IS NOT NULL
    )
    OR (
      assignment_type = 'break'
      AND target_type IS NULL
      AND target_customer_id IS NULL
    )
  ),
  ADD CONSTRAINT nfc_assignments_customer_fk FOREIGN KEY (
    organization_id, target_customer_id
  ) REFERENCES taptime_server.customers (organization_id, id),
  ADD CONSTRAINT nfc_assignments_snapshot_unique UNIQUE (
    organization_id, id, nfc_tag_id, target_type, target_customer_id
  ),
  ADD CONSTRAINT nfc_assignments_subject_snapshot_unique UNIQUE (
    organization_id, id, nfc_tag_id, assignment_type
  );

ALTER TABLE taptime_server.offline_capture_lease_items
  ADD CONSTRAINT offline_lease_items_shape_v3 CHECK (
    (
      item_type = 'nfc_assignment' AND subject_type = 'work'
      AND lookup_value IS NOT NULL AND assignment_id IS NOT NULL AND nfc_tag_id IS NOT NULL
      AND target_type = 'customer' AND target_customer_id IS NOT NULL
      AND assignment_row_version > 0 AND target_row_version > 0
    ) OR (
      item_type = 'nfc_assignment' AND subject_type = 'break'
      AND lookup_value IS NOT NULL AND assignment_id IS NOT NULL AND nfc_tag_id IS NOT NULL
      AND target_type IS NULL AND target_customer_id IS NULL
      AND assignment_row_version > 0 AND target_row_version IS NULL
    ) OR (
      item_type = 'manual_target' AND subject_type = 'work'
      AND lookup_value IS NULL AND assignment_id IS NULL AND nfc_tag_id IS NULL
      AND target_type IN ('customer', 'project', 'general_work')
      AND target_customer_id IS NOT NULL AND assignment_row_version IS NULL
      AND target_row_version > 0
    ) OR (
      item_type = 'manual_break' AND subject_type = 'break'
      AND lookup_value IS NULL AND assignment_id IS NULL AND nfc_tag_id IS NULL
      AND target_type IS NULL AND target_customer_id IS NULL
      AND assignment_row_version IS NULL AND target_row_version IS NULL
    )
  ),
  ADD CONSTRAINT offline_lease_items_assignment_snapshot_fk FOREIGN KEY (
    organization_id, assignment_id, nfc_tag_id, target_type, target_customer_id
  ) REFERENCES taptime_server.nfc_assignments (
    organization_id, id, nfc_tag_id, target_type, target_customer_id
  ),
  ADD CONSTRAINT offline_lease_items_assignment_subject_fk FOREIGN KEY (
    organization_id, assignment_id, nfc_tag_id, subject_type
  ) REFERENCES taptime_server.nfc_assignments (
    organization_id, id, nfc_tag_id, assignment_type
  ),
  ADD CONSTRAINT offline_lease_items_target_fk_v3 FOREIGN KEY (
    organization_id, target_type, target_customer_id
  ) REFERENCES taptime_server.work_targets (organization_id, target_type, target_id);

ALTER TABLE taptime_server.offline_capture_leases
  DROP CONSTRAINT offline_capture_leases_version_v2,
  ADD CONSTRAINT offline_capture_leases_version_v3 CHECK (
    (lease_schema_version = 1 AND manifest_version = 1)
    OR (lease_schema_version = 2 AND manifest_version = 2)
    OR (lease_schema_version = 3 AND manifest_version = 3)
  );

ALTER TABLE taptime_server.offline_capture_lease_receipts
  DROP CONSTRAINT offline_capture_lease_receipts_version_v2,
  ADD CONSTRAINT offline_capture_lease_receipts_version_v3 CHECK (
    lease_schema_version IN (1, 2, 3)
  );

ALTER TABLE taptime_server.offline_event_reconciliations
  DROP CONSTRAINT offline_event_reconciliations_provenance_version_v2,
  ADD CONSTRAINT offline_event_reconciliations_provenance_version_v3 CHECK (
    provenance_version IN (1, 2, 3)
  );

ALTER TABLE taptime_server.work_events
  DROP CONSTRAINT work_events_content_hash_version_v2,
  DROP CONSTRAINT work_events_trigger_shape_v2,
  DROP CONSTRAINT work_events_target_type_v2,
  ALTER COLUMN target_type DROP NOT NULL,
  ALTER COLUMN target_customer_id DROP NOT NULL,
  ADD COLUMN subject_type text NOT NULL DEFAULT 'work',
  ADD CONSTRAINT work_events_subject_shape_v3 CHECK (
    (
      subject_type = 'work'
      AND target_type IN ('customer', 'project', 'general_work')
      AND target_customer_id IS NOT NULL
    )
    OR (
      subject_type = 'break'
      AND target_type IS NULL
      AND target_customer_id IS NULL
    )
  ),
  ADD CONSTRAINT work_events_content_hash_version_v3 CHECK (
    content_hash_version IN (1, 2, 3)
    AND (content_hash_version = 1) = (
      subject_type = 'work' AND trigger_type = 'nfc' AND target_type = 'customer'
    )
    AND (content_hash_version = 3) = (subject_type = 'break')
  ),
  ADD CONSTRAINT work_events_trigger_shape_v3 CHECK (
    (trigger_type = 'nfc' AND assignment_id IS NOT NULL AND nfc_tag_id IS NOT NULL)
    OR (trigger_type = 'manual' AND assignment_id IS NULL AND nfc_tag_id IS NULL)
  ),
  ADD CONSTRAINT work_events_assignment_snapshot_fk FOREIGN KEY (
    organization_id, assignment_id, nfc_tag_id, target_type, target_customer_id
  ) REFERENCES taptime_server.nfc_assignments (
    organization_id, id, nfc_tag_id, target_type, target_customer_id
  ),
  ADD CONSTRAINT work_events_assignment_subject_fk FOREIGN KEY (
    organization_id, assignment_id, nfc_tag_id, subject_type
  ) REFERENCES taptime_server.nfc_assignments (
    organization_id, id, nfc_tag_id, assignment_type
  ),
  ADD CONSTRAINT work_events_target_fk_v3 FOREIGN KEY (
    organization_id, target_type, target_customer_id
  ) REFERENCES taptime_server.work_targets (organization_id, target_type, target_id);

CREATE INDEX work_events_latest_user_subject
  ON taptime_server.work_events (
    organization_id, triggered_by_user_id, subject_type, occurred_at DESC
  );

CREATE TABLE taptime_server.break_intervals (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES taptime_server.organizations (id),
  user_id uuid NOT NULL REFERENCES taptime_server.users (id),
  time_entry_id uuid NOT NULL,
  status text NOT NULL CHECK (status IN ('started', 'stopped')),
  start_work_event_id uuid NOT NULL,
  started_at timestamptz NOT NULL,
  started_via text NOT NULL CHECK (started_via IN ('nfc', 'manual')),
  stop_work_event_id uuid,
  stopped_at timestamptz,
  stopped_via text CHECK (stopped_via IN ('nfc', 'manual')),
  row_version bigint NOT NULL DEFAULT 1 CHECK (row_version > 0),
  CONSTRAINT break_intervals_tenant_id_unique UNIQUE (organization_id, id),
  CONSTRAINT break_intervals_tenant_user_id_unique UNIQUE (
    organization_id, user_id, id
  ),
  CONSTRAINT break_intervals_time_entry_fk FOREIGN KEY (
    organization_id, user_id, time_entry_id
  ) REFERENCES taptime_server.time_entries (organization_id, user_id, id),
  CONSTRAINT break_intervals_start_work_event_fk FOREIGN KEY (
    organization_id, user_id, start_work_event_id
  ) REFERENCES taptime_server.work_events (
    organization_id, triggered_by_user_id, id
  ),
  CONSTRAINT break_intervals_stop_work_event_fk FOREIGN KEY (
    organization_id, user_id, stop_work_event_id
  ) REFERENCES taptime_server.work_events (
    organization_id, triggered_by_user_id, id
  ),
  CONSTRAINT break_intervals_state_shape CHECK (
    (
      status = 'started'
      AND stop_work_event_id IS NULL
      AND stopped_at IS NULL
      AND stopped_via IS NULL
    )
    OR (
      status = 'stopped'
      AND stop_work_event_id IS NOT NULL
      AND stopped_at IS NOT NULL
      AND stopped_via IS NOT NULL
    )
  ),
  CONSTRAINT break_intervals_event_order CHECK (
    stopped_at IS NULL OR stopped_at >= started_at
  ),
  CONSTRAINT break_intervals_distinct_events CHECK (
    stop_work_event_id IS NULL OR stop_work_event_id <> start_work_event_id
  )
);

CREATE UNIQUE INDEX break_intervals_one_active_per_time_entry
  ON taptime_server.break_intervals (organization_id, time_entry_id)
  WHERE status = 'started';

CREATE FUNCTION taptime_server.enforce_break_interval_stop_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $transition$
BEGIN
  IF OLD.status <> 'started'
    OR NEW.status <> 'stopped'
    OR NEW.row_version <> OLD.row_version + 1
    OR NEW.id <> OLD.id
    OR NEW.organization_id <> OLD.organization_id
    OR NEW.user_id <> OLD.user_id
    OR NEW.time_entry_id <> OLD.time_entry_id
    OR NEW.start_work_event_id <> OLD.start_work_event_id
    OR NEW.started_at <> OLD.started_at
    OR NEW.started_via <> OLD.started_via
  THEN
    RAISE EXCEPTION 'BreakInterval update must be one immutable started-to-stopped transition'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$transition$;
REVOKE ALL ON FUNCTION taptime_server.enforce_break_interval_stop_transition() FROM PUBLIC;

CREATE TRIGGER break_intervals_stop_transition
  BEFORE UPDATE ON taptime_server.break_intervals
  FOR EACH ROW EXECUTE FUNCTION taptime_server.enforce_break_interval_stop_transition();

ALTER TABLE taptime_server.canonical_decisions
  DROP CONSTRAINT canonical_decisions_target_type_v2,
  DROP CONSTRAINT canonical_decisions_decision_type_check,
  DROP CONSTRAINT canonical_decisions_result_shape,
  ALTER COLUMN target_type DROP NOT NULL,
  ALTER COLUMN target_customer_id DROP NOT NULL,
  ADD COLUMN subject_type text NOT NULL DEFAULT 'work',
  ADD COLUMN break_interval_id uuid,
  ADD COLUMN active_break_interval_id uuid,
  ADD CONSTRAINT canonical_decisions_break_mapping_unique UNIQUE (
    organization_id, actor_user_id, work_event_id, break_interval_id
  ),
  ADD CONSTRAINT canonical_decisions_subject_shape_v3 CHECK (
    (
      subject_type = 'work'
      AND target_type IN ('customer', 'project', 'general_work')
      AND target_customer_id IS NOT NULL
    )
    OR (
      subject_type = 'break'
      AND target_type IS NULL
      AND target_customer_id IS NULL
    )
  ),
  ADD CONSTRAINT canonical_decisions_decision_type_v3 CHECK (decision_type IN (
    'time_entry_started',
    'time_entry_stopped',
    'break_started',
    'break_stopped',
    'duplicate_scan_ignored',
    'active_entry_for_other_target_rejected',
    'break_without_active_time_entry_rejected',
    'work_trigger_during_break_rejected',
    'escalation_required'
  )),
  ADD CONSTRAINT canonical_decisions_break_interval_fk FOREIGN KEY (
    organization_id, actor_user_id, break_interval_id
  ) REFERENCES taptime_server.break_intervals (organization_id, user_id, id)
    DEFERRABLE INITIALLY DEFERRED,
  ADD CONSTRAINT canonical_decisions_active_break_interval_fk FOREIGN KEY (
    organization_id, actor_user_id, active_break_interval_id
  ) REFERENCES taptime_server.break_intervals (organization_id, user_id, id)
    DEFERRABLE INITIALLY DEFERRED,
  ADD CONSTRAINT canonical_decisions_work_event_subject_fk FOREIGN KEY (
    organization_id, actor_user_id, work_event_id
  ) REFERENCES taptime_server.work_events (
    organization_id, triggered_by_user_id, id
  ),
  ADD CONSTRAINT canonical_decisions_time_entry_direct_fk FOREIGN KEY (
    organization_id, actor_user_id, time_entry_id
  ) REFERENCES taptime_server.time_entries (organization_id, user_id, id)
    DEFERRABLE INITIALLY DEFERRED,
  ADD CONSTRAINT canonical_decisions_result_shape_v3 CHECK (
    (
      decision_type IN ('time_entry_started', 'time_entry_stopped')
      AND subject_type = 'work'
      AND reason IS NULL
      AND time_entry_id IS NOT NULL
      AND active_time_entry_id IS NULL
      AND break_interval_id IS NULL
      AND active_break_interval_id IS NULL
      AND previous_work_event_id IS NULL
    )
    OR (
      decision_type IN ('break_started', 'break_stopped')
      AND subject_type = 'break'
      AND reason IS NULL
      AND time_entry_id IS NOT NULL
      AND active_time_entry_id IS NULL
      AND break_interval_id IS NOT NULL
      AND active_break_interval_id IS NULL
      AND previous_work_event_id IS NULL
    )
    OR (
      decision_type = 'duplicate_scan_ignored'
      AND reason IS NULL
      AND time_entry_id IS NULL
      AND active_time_entry_id IS NULL
      AND break_interval_id IS NULL
      AND active_break_interval_id IS NULL
      AND previous_work_event_id IS NOT NULL
      AND previous_work_event_id <> work_event_id
    )
    OR (
      decision_type = 'active_entry_for_other_target_rejected'
      AND subject_type = 'work'
      AND reason IS NULL
      AND time_entry_id IS NULL
      AND active_time_entry_id IS NOT NULL
      AND break_interval_id IS NULL
      AND active_break_interval_id IS NULL
      AND previous_work_event_id IS NULL
    )
    OR (
      decision_type = 'break_without_active_time_entry_rejected'
      AND subject_type = 'break'
      AND reason IS NULL
      AND time_entry_id IS NULL
      AND active_time_entry_id IS NULL
      AND break_interval_id IS NULL
      AND active_break_interval_id IS NULL
      AND previous_work_event_id IS NULL
    )
    OR (
      decision_type = 'work_trigger_during_break_rejected'
      AND subject_type = 'work'
      AND reason IS NULL
      AND time_entry_id IS NULL
      AND active_time_entry_id IS NOT NULL
      AND break_interval_id IS NULL
      AND active_break_interval_id IS NOT NULL
      AND previous_work_event_id IS NULL
    )
    OR (
      decision_type = 'escalation_required'
      AND reason IN (
        'active_time_entry_organization_mismatch',
        'active_time_entry_user_mismatch',
        'previous_work_event_organization_mismatch',
        'previous_work_event_user_mismatch',
        'previous_work_event_target_mismatch',
        'previous_work_event_subject_mismatch',
        'active_break_organization_mismatch',
        'active_break_user_mismatch',
        'active_break_time_entry_mismatch',
        'work_event_precedes_active_break',
        'work_event_precedes_active_time_entry',
        'work_event_precedes_previous_accepted_work_event'
      )
      AND time_entry_id IS NULL
      AND active_time_entry_id IS NULL
      AND break_interval_id IS NULL
      AND active_break_interval_id IS NULL
      AND previous_work_event_id IS NULL
    )
  );

ALTER TABLE taptime_server.break_intervals
  ADD CONSTRAINT break_intervals_start_decision_fk FOREIGN KEY (
    organization_id, user_id, start_work_event_id, id
  ) REFERENCES taptime_server.canonical_decisions (
    organization_id, actor_user_id, work_event_id, break_interval_id
  ) DEFERRABLE INITIALLY DEFERRED,
  ADD CONSTRAINT break_intervals_stop_decision_fk FOREIGN KEY (
    organization_id, user_id, stop_work_event_id, id
  ) REFERENCES taptime_server.canonical_decisions (
    organization_id, actor_user_id, work_event_id, break_interval_id
  ) DEFERRABLE INITIALLY DEFERRED;

CREATE OR REPLACE FUNCTION taptime_server.validate_canonical_decision_result()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $validation$
DECLARE
  related_time_entry taptime_server.time_entries%ROWTYPE;
  related_break_interval taptime_server.break_intervals%ROWTYPE;
  related_work_event_occurred_at timestamptz;
BEGIN
  IF NEW.result_time_entry_id IS NOT NULL THEN
    SELECT entry.* INTO related_time_entry
    FROM taptime_server.time_entries AS entry
    WHERE entry.organization_id = NEW.organization_id
      AND entry.user_id = NEW.actor_user_id
      AND entry.id = NEW.result_time_entry_id;
  END IF;

  IF NEW.decision_type IN (
    'time_entry_started', 'time_entry_stopped', 'break_started', 'break_stopped'
  ) THEN
    SELECT event.occurred_at INTO related_work_event_occurred_at
    FROM taptime_server.work_events AS event
    WHERE event.organization_id = NEW.organization_id
      AND event.triggered_by_user_id = NEW.actor_user_id
      AND event.id = NEW.work_event_id;
  END IF;

  IF NEW.decision_type = 'time_entry_started' AND related_time_entry.id IS NOT NULL THEN
    IF related_time_entry.status <> 'started'
      OR related_time_entry.start_work_event_id <> NEW.work_event_id
      OR related_time_entry.started_at IS DISTINCT FROM related_work_event_occurred_at
      OR related_time_entry.target_type <> NEW.target_type
      OR related_time_entry.target_customer_id <> NEW.target_customer_id
    THEN
      RAISE EXCEPTION 'time_entry_started Decision does not match its started TimeEntry'
        USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.decision_type = 'time_entry_stopped' AND related_time_entry.id IS NOT NULL THEN
    IF related_time_entry.status <> 'stopped'
      OR related_time_entry.stop_work_event_id IS DISTINCT FROM NEW.work_event_id
      OR related_time_entry.stopped_at IS DISTINCT FROM related_work_event_occurred_at
      OR related_time_entry.target_type <> NEW.target_type
      OR related_time_entry.target_customer_id <> NEW.target_customer_id
    THEN
      RAISE EXCEPTION 'time_entry_stopped Decision does not match its stopped TimeEntry'
        USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.decision_type IN ('break_started', 'break_stopped') THEN
    SELECT interval.* INTO related_break_interval
    FROM taptime_server.break_intervals AS interval
    WHERE interval.organization_id = NEW.organization_id
      AND interval.user_id = NEW.actor_user_id
      AND interval.id = NEW.break_interval_id;
    IF related_break_interval.id IS NULL
      OR related_break_interval.time_entry_id <> NEW.time_entry_id
      OR (
        NEW.decision_type = 'break_started'
        AND (
          related_break_interval.start_work_event_id <> NEW.work_event_id
          OR related_break_interval.started_at IS DISTINCT FROM related_work_event_occurred_at
        )
      )
      OR (
        NEW.decision_type = 'break_stopped'
        AND (
          related_break_interval.status <> 'stopped'
          OR related_break_interval.stop_work_event_id IS DISTINCT FROM NEW.work_event_id
          OR related_break_interval.stopped_at IS DISTINCT FROM related_work_event_occurred_at
        )
      )
    THEN
      RAISE EXCEPTION 'Break Decision does not match its BreakInterval'
        USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.decision_type = 'active_entry_for_other_target_rejected'
    AND related_time_entry.id IS NOT NULL
  THEN
    IF related_time_entry.status <> 'started'
      OR (
        related_time_entry.target_type = NEW.target_type
        AND related_time_entry.target_customer_id = NEW.target_customer_id
      )
    THEN
      RAISE EXCEPTION 'other-target rejection does not match an active TimeEntry for another target'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END
$validation$;

ALTER TABLE taptime_server.sync_receipts
  DROP CONSTRAINT sync_receipts_target_type_v2,
  ALTER COLUMN target_type DROP NOT NULL,
  ALTER COLUMN target_customer_id DROP NOT NULL,
  ADD COLUMN subject_type text NOT NULL DEFAULT 'work',
  ADD CONSTRAINT sync_receipts_subject_shape_v3 CHECK (
    (
      subject_type = 'work'
      AND target_type IN ('customer', 'project', 'general_work')
      AND target_customer_id IS NOT NULL
    )
    OR (
      subject_type = 'break'
      AND target_type IS NULL
      AND target_customer_id IS NULL
    )
  ),
  ADD CONSTRAINT sync_receipts_work_event_subject_fk FOREIGN KEY (
    organization_id, user_id, work_event_id
  ) REFERENCES taptime_server.work_events (
    organization_id, triggered_by_user_id, id
  );

CREATE OR REPLACE FUNCTION taptime_server.enforce_time_entry_stop_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $transition$
BEGIN
  IF OLD.status <> 'started' OR NEW.status <> 'stopped' THEN
    RAISE EXCEPTION 'TimeEntry update must be a started-to-stopped transition'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.row_version <> OLD.row_version + 1 THEN
    RAISE EXCEPTION 'TimeEntry row_version must increment exactly once'
      USING ERRCODE = '23514';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM taptime_server.break_intervals AS interval
    WHERE interval.organization_id = OLD.organization_id
      AND interval.time_entry_id = OLD.id
      AND interval.status = 'started'
  ) THEN
    RAISE EXCEPTION 'TimeEntry cannot stop while a BreakInterval is active'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$transition$;

CREATE FUNCTION taptime_server.effective_work_duration_seconds_v1(
  requested_time_entry_id uuid
)
RETURNS bigint
LANGUAGE sql
STABLE
SET search_path = pg_catalog
AS $duration$
  SELECT GREATEST(
    0::bigint,
    pg_catalog.floor(extract(epoch FROM (
      COALESCE(entry.stopped_at, pg_catalog.transaction_timestamp()) - entry.started_at
    )))::bigint
    - COALESCE((
      SELECT SUM(pg_catalog.floor(extract(epoch FROM (
        COALESCE(interval.stopped_at, pg_catalog.transaction_timestamp()) - interval.started_at
      )))::bigint)::bigint
      FROM taptime_server.break_intervals AS interval
      WHERE interval.organization_id = entry.organization_id
        AND interval.time_entry_id = entry.id
    ), 0::bigint)
  )
  FROM taptime_server.time_entries AS entry
  WHERE entry.id = requested_time_entry_id
$duration$;
REVOKE ALL ON FUNCTION taptime_server.effective_work_duration_seconds_v1(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.effective_work_duration_seconds_v1(uuid)
  TO taptime_employee, taptime_administrator, taptime_server_lifecycle,
     taptime_offline_event_ingestor;

ALTER TABLE taptime_server.break_intervals ENABLE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.break_intervals FORCE ROW LEVEL SECURITY;
CREATE POLICY break_intervals_employee_self_select ON taptime_server.break_intervals
  FOR SELECT TO taptime_employee
  USING (
    organization_id = taptime_server.current_organization_id()
    AND user_id = taptime_server.current_user_id()
    AND taptime_server.has_active_membership(organization_id)
  );
CREATE POLICY break_intervals_administrator_select ON taptime_server.break_intervals
  FOR SELECT TO taptime_administrator
  USING (
    organization_id = taptime_server.current_organization_id()
    AND taptime_server.has_active_administrator_membership(organization_id)
  );
CREATE POLICY break_intervals_lifecycle_select ON taptime_server.break_intervals
  FOR SELECT TO taptime_server_lifecycle
  USING (
    organization_id = taptime_server.current_organization_id()
    AND user_id = taptime_server.current_user_id()
  );
CREATE POLICY break_intervals_lifecycle_insert ON taptime_server.break_intervals
  FOR INSERT TO taptime_server_lifecycle
  WITH CHECK (
    organization_id = taptime_server.current_organization_id()
    AND user_id = taptime_server.current_user_id()
    AND taptime_server.has_active_membership(organization_id)
  );
CREATE POLICY break_intervals_lifecycle_update ON taptime_server.break_intervals
  FOR UPDATE TO taptime_server_lifecycle
  USING (
    organization_id = taptime_server.current_organization_id()
    AND user_id = taptime_server.current_user_id()
    AND taptime_server.has_active_membership(organization_id)
  )
  WITH CHECK (
    organization_id = taptime_server.current_organization_id()
    AND user_id = taptime_server.current_user_id()
    AND taptime_server.has_active_membership(organization_id)
  );
CREATE POLICY break_intervals_offline_select ON taptime_server.break_intervals
  FOR SELECT TO taptime_offline_event_ingestor
  USING (
    organization_id = taptime_server.current_organization_id()
    AND user_id = taptime_server.current_user_id()
  );
CREATE POLICY break_intervals_offline_insert ON taptime_server.break_intervals
  FOR INSERT TO taptime_offline_event_ingestor
  WITH CHECK (
    organization_id = taptime_server.current_organization_id()
    AND user_id = taptime_server.current_user_id()
  );
CREATE POLICY break_intervals_offline_update ON taptime_server.break_intervals
  FOR UPDATE TO taptime_offline_event_ingestor
  USING (
    organization_id = taptime_server.current_organization_id()
    AND user_id = taptime_server.current_user_id()
  )
  WITH CHECK (
    organization_id = taptime_server.current_organization_id()
    AND user_id = taptime_server.current_user_id()
  );

GRANT SELECT ON taptime_server.break_intervals
  TO taptime_employee, taptime_administrator, taptime_server_lifecycle,
     taptime_offline_event_ingestor;
GRANT INSERT ON taptime_server.break_intervals
  TO taptime_server_lifecycle, taptime_offline_event_ingestor;
GRANT UPDATE (status, stop_work_event_id, stopped_at, stopped_via, row_version)
  ON taptime_server.break_intervals
  TO taptime_server_lifecycle, taptime_offline_event_ingestor;

GRANT INSERT (id, organization_id, nfc_tag_id, target_type, target_customer_id,
  assignment_type, active)
  ON taptime_server.nfc_assignments TO taptime_admin_setup;

CREATE FUNCTION taptime_server.admin_provision_break_nfc_tag_digest_v1(
  requested_organization_id uuid,
  requested_actor_user_id uuid,
  requested_membership_id uuid,
  canonical_display_name text,
  canonical_payload text
)
RETURNS bytea
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog
AS $digest_contract$
DECLARE
  framed bytea := pg_catalog.convert_to('taptime:c3:v1', 'UTF8')
    || pg_catalog.decode('00', 'hex');
  field text;
  encoded bytea;
BEGIN
  IF requested_organization_id IS NULL OR requested_actor_user_id IS NULL
    OR requested_membership_id IS NULL OR canonical_display_name IS NULL
    OR canonical_display_name IS DISTINCT FROM taptime_server.normalize_taptime_name_v1(
      canonical_display_name, 'tag'
    )
    OR canonical_payload IS NULL
    OR canonical_payload COLLATE "C" !~ '^nfc:uid:v1:(?:[0-9A-F]{2}){1,32}$'
  THEN
    RAISE EXCEPTION 'Invalid canonical Break Tag command data' USING ERRCODE = '22023';
  END IF;
  FOREACH field IN ARRAY ARRAY[
    'provisionBreakNfcTag', requested_organization_id::text,
    requested_actor_user_id::text, requested_membership_id::text,
    canonical_display_name, canonical_payload
  ] LOOP
    encoded := pg_catalog.convert_to(field, 'UTF8');
    framed := framed || pg_catalog.int4send(pg_catalog.octet_length(encoded)) || encoded;
  END LOOP;
  RETURN pg_catalog.sha256(framed);
END
$digest_contract$;
REVOKE ALL ON FUNCTION taptime_server.admin_provision_break_nfc_tag_digest_v1(
  uuid, uuid, uuid, text, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.admin_provision_break_nfc_tag_digest_v1(
  uuid, uuid, uuid, text, text
) TO taptime_admin_setup, taptime_admin_setup_data_function_owner;

CREATE TABLE taptime_server.admin_break_tag_command_receipts (
  organization_id uuid NOT NULL REFERENCES taptime_server.organizations (id),
  command_id uuid NOT NULL,
  actor_user_id uuid NOT NULL,
  membership_id uuid NOT NULL,
  request_hash bytea NOT NULL CHECK (pg_catalog.octet_length(request_hash) = 32),
  nfc_tag_id uuid NOT NULL,
  nfc_assignment_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.transaction_timestamp(),
  PRIMARY KEY (organization_id, command_id),
  CONSTRAINT admin_break_receipt_membership_fk FOREIGN KEY (
    organization_id, actor_user_id, membership_id
  ) REFERENCES taptime_server.memberships (organization_id, user_id, id),
  CONSTRAINT admin_break_receipt_tag_fk FOREIGN KEY (
    organization_id, nfc_tag_id
  ) REFERENCES taptime_server.nfc_tags (organization_id, id),
  CONSTRAINT admin_break_receipt_assignment_fk FOREIGN KEY (
    organization_id, nfc_assignment_id
  ) REFERENCES taptime_server.nfc_assignments (organization_id, id)
);

GRANT SELECT (assignment_type)
  ON taptime_server.nfc_assignments
  TO taptime_admin_setup, taptime_admin_setup_data_function_owner;

CREATE FUNCTION taptime_server.enforce_admin_break_tag_receipt_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $receipt_integrity$
DECLARE
  stored_display_name text;
  stored_payload text;
  expected_request_hash bytea;
  audit_total bigint;
  tag_audit_total bigint;
  assignment_audit_total bigint;
BEGIN
  SELECT tag.display_name, tag.payload_value
  INTO stored_display_name, stored_payload
  FROM taptime_server.nfc_tags AS tag
  JOIN taptime_server.nfc_assignments AS assignment
    ON assignment.organization_id = tag.organization_id
   AND assignment.id = NEW.nfc_assignment_id
   AND assignment.nfc_tag_id = tag.id
   AND assignment.assignment_type = 'break'
   AND assignment.target_type IS NULL
   AND assignment.target_customer_id IS NULL
   AND assignment.active
  WHERE tag.organization_id = NEW.organization_id
    AND tag.id = NEW.nfc_tag_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Break Tag receipt integrity rejected' USING ERRCODE = '23514';
  END IF;

  expected_request_hash := taptime_server.admin_provision_break_nfc_tag_digest_v1(
    NEW.organization_id, NEW.actor_user_id, NEW.membership_id,
    stored_display_name, stored_payload
  );
  IF NEW.request_hash IS DISTINCT FROM expected_request_hash THEN
    RAISE EXCEPTION 'Break Tag receipt integrity rejected' USING ERRCODE = '23514';
  END IF;

  SELECT
    pg_catalog.count(*),
    pg_catalog.count(*) FILTER (WHERE
      audit.actor_user_id = NEW.actor_user_id
      AND audit.operator_principal IS NULL
      AND audit.event_type = 'NfcTagRegistered'
      AND audit.entity_type = 'NfcTag'
      AND audit.entity_id = NEW.nfc_tag_id
      AND audit.payload = '{}'::jsonb
    ),
    pg_catalog.count(*) FILTER (WHERE
      audit.actor_user_id = NEW.actor_user_id
      AND audit.operator_principal IS NULL
      AND audit.event_type = 'NfcTagAssigned'
      AND audit.entity_type = 'NfcAssignment'
      AND audit.entity_id = NEW.nfc_assignment_id
      AND audit.payload = '{}'::jsonb
    )
  INTO audit_total, tag_audit_total, assignment_audit_total
  FROM taptime_server.audit_events AS audit
  WHERE audit.organization_id = NEW.organization_id
    AND audit.correlation_id = NEW.command_id::text;
  IF audit_total <> 2 OR tag_audit_total <> 1 OR assignment_audit_total <> 1 THEN
    RAISE EXCEPTION 'Break Tag receipt integrity rejected' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$receipt_integrity$;
ALTER FUNCTION taptime_server.enforce_admin_break_tag_receipt_integrity()
  OWNER TO taptime_admin_setup_data_function_owner;
REVOKE ALL ON FUNCTION taptime_server.enforce_admin_break_tag_receipt_integrity() FROM PUBLIC;

CREATE TRIGGER admin_break_tag_receipt_integrity
  BEFORE INSERT ON taptime_server.admin_break_tag_command_receipts
  FOR EACH ROW EXECUTE FUNCTION taptime_server.enforce_admin_break_tag_receipt_integrity();

ALTER TABLE taptime_server.admin_break_tag_command_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE taptime_server.admin_break_tag_command_receipts FORCE ROW LEVEL SECURITY;
CREATE POLICY admin_break_receipts_setup_select
  ON taptime_server.admin_break_tag_command_receipts FOR SELECT TO taptime_admin_setup
  USING (
    organization_id = taptime_server.current_organization_id()
    AND taptime_server.has_current_admin_setup_authority(organization_id)
  );
CREATE POLICY admin_break_receipts_setup_insert
  ON taptime_server.admin_break_tag_command_receipts FOR INSERT TO taptime_admin_setup
  WITH CHECK (
    organization_id = taptime_server.current_organization_id()
    AND actor_user_id = taptime_server.current_user_id()
    AND membership_id = NULLIF(
      pg_catalog.current_setting('app.membership_id', true), ''
    )::uuid
    AND taptime_server.has_current_admin_setup_authority(organization_id)
  );
GRANT SELECT, INSERT ON taptime_server.admin_break_tag_command_receipts
  TO taptime_admin_setup;

DROP FUNCTION taptime_server.lock_lifecycle_configuration(uuid, uuid);
CREATE FUNCTION taptime_server.lock_lifecycle_configuration(
  requested_organization_id uuid,
  requested_assignment_id uuid
)
RETURNS TABLE (
  assignment_id uuid,
  nfc_tag_id uuid,
  assignment_type text,
  target_type text,
  target_customer_id uuid,
  assignment_active boolean,
  assignment_valid_from timestamptz,
  assignment_valid_to timestamptz,
  tag_created_at timestamptz,
  customer_active boolean,
  customer_activated_at timestamptz,
  customer_deactivated_at timestamptz
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, taptime_server, pg_temp
ROWS 1
AS $configuration$
DECLARE
  locked_customer_id uuid;
BEGIN
  SELECT assignment.target_customer_id INTO locked_customer_id
  FROM taptime_server.nfc_assignments AS assignment
  JOIN taptime_server.nfc_tags AS tag
    ON tag.organization_id = assignment.organization_id
   AND tag.id = assignment.nfc_tag_id
  WHERE requested_organization_id = NULLIF(
      pg_catalog.current_setting('app.organization_id', true), ''
    )::uuid
    AND assignment.organization_id = requested_organization_id
    AND assignment.id = requested_assignment_id
    AND EXISTS (
      SELECT 1 FROM taptime_server.memberships AS membership
      WHERE membership.organization_id = requested_organization_id
        AND membership.user_id = NULLIF(
          pg_catalog.current_setting('app.user_id', true), ''
        )::uuid
        AND membership.id = NULLIF(
          pg_catalog.current_setting('app.membership_id', true), ''
        )::uuid
        AND membership.revoked_at IS NULL
    )
  FOR SHARE OF assignment, tag;
  IF NOT FOUND THEN RETURN; END IF;
  IF locked_customer_id IS NOT NULL THEN
    PERFORM 1 FROM taptime_server.customers AS customer
    WHERE customer.organization_id = requested_organization_id
      AND customer.id = locked_customer_id
    FOR SHARE;
  END IF;

  RETURN QUERY
  SELECT assignment.id, tag.id, assignment.assignment_type,
         assignment.target_type, assignment.target_customer_id,
         assignment.active, assignment.valid_from, assignment.valid_to,
         tag.created_at, customer.active, customer.activated_at,
         customer.deactivated_at
  FROM taptime_server.nfc_assignments AS assignment
  JOIN taptime_server.nfc_tags AS tag
    ON tag.organization_id = assignment.organization_id
   AND tag.id = assignment.nfc_tag_id
  LEFT JOIN taptime_server.customers AS customer
    ON customer.organization_id = assignment.organization_id
   AND customer.id = assignment.target_customer_id
  WHERE requested_organization_id = NULLIF(
      pg_catalog.current_setting('app.organization_id', true), ''
    )::uuid
    AND assignment.organization_id = requested_organization_id
    AND assignment.id = requested_assignment_id
    AND EXISTS (
      SELECT 1 FROM taptime_server.memberships AS membership
      WHERE membership.organization_id = requested_organization_id
        AND membership.user_id = NULLIF(
          pg_catalog.current_setting('app.user_id', true), ''
        )::uuid
        AND membership.id = NULLIF(
          pg_catalog.current_setting('app.membership_id', true), ''
        )::uuid
        AND membership.revoked_at IS NULL
    )
  ;
END
$configuration$;
REVOKE ALL ON FUNCTION taptime_server.lock_lifecycle_configuration(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.lock_lifecycle_configuration(uuid, uuid)
  TO taptime_server_lifecycle;

CREATE FUNCTION taptime_server.lock_offline_capture_projection_v3(
  requested_organization_id uuid
)
RETURNS TABLE (
  item_type text,
  subject_type text,
  assignment_id uuid,
  nfc_tag_id uuid,
  target_type text,
  target_id uuid,
  display_name text,
  canonical_payload text,
  assignment_row_version bigint,
  target_row_version bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $projection$
BEGIN
  IF pg_catalog.current_setting('role', true) <> 'taptime_offline_lease_issuer'
    OR requested_organization_id IS DISTINCT FROM NULLIF(
      pg_catalog.current_setting('app.organization_id', true), ''
    )::uuid
  THEN
    RAISE EXCEPTION 'Offline v3 projection capability rejected' USING ERRCODE = '42501';
  END IF;

  PERFORM target.target_id
  FROM taptime_server.work_targets AS target
  WHERE target.organization_id = requested_organization_id AND target.active
  FOR SHARE;

  PERFORM assignment.id
  FROM taptime_server.nfc_assignments AS assignment
  JOIN taptime_server.nfc_tags AS tag
    ON tag.organization_id = assignment.organization_id
   AND tag.id = assignment.nfc_tag_id
  WHERE assignment.organization_id = requested_organization_id
    AND assignment.active AND assignment.valid_to IS NULL
  FOR SHARE OF assignment, tag;

  RETURN QUERY
  SELECT 'nfc_assignment'::text, assignment.assignment_type, assignment.id, tag.id,
         target.target_type, target.target_id,
         CASE WHEN assignment.assignment_type = 'break' THEN 'Pause' ELSE target.display_name END,
         tag.payload_value, assignment.row_version, target.row_version
  FROM taptime_server.nfc_assignments AS assignment
  JOIN taptime_server.nfc_tags AS tag
    ON tag.organization_id = assignment.organization_id
   AND tag.id = assignment.nfc_tag_id
  LEFT JOIN taptime_server.work_targets AS target
    ON target.organization_id = assignment.organization_id
   AND target.target_type = assignment.target_type
   AND target.target_id = assignment.target_customer_id
  WHERE assignment.organization_id = requested_organization_id
    AND assignment.active AND assignment.valid_to IS NULL
    AND (assignment.assignment_type = 'break' OR target.active)
  UNION ALL
  SELECT 'manual_target'::text, 'work'::text, NULL::uuid, NULL::uuid,
         target.target_type, target.target_id, target.display_name,
         NULL::text, NULL::bigint, target.row_version
  FROM taptime_server.work_targets AS target
  WHERE target.organization_id = requested_organization_id AND target.active
  UNION ALL
  SELECT 'manual_break'::text, 'break'::text, NULL::uuid, NULL::uuid,
         NULL::text, NULL::uuid, 'Pause'::text, NULL::text, NULL::bigint, NULL::bigint
  ORDER BY 1, 6 NULLS FIRST;
END
$projection$;
ALTER FUNCTION taptime_server.lock_offline_capture_projection_v3(uuid)
  OWNER TO taptime_offline_lease_function_owner;
REVOKE ALL ON FUNCTION taptime_server.lock_offline_capture_projection_v3(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.lock_offline_capture_projection_v3(uuid)
  TO taptime_offline_lease_issuer;

CREATE FUNCTION taptime_server.lock_offline_historical_configuration_v3(
  requested_organization_id uuid,
  requested_subject_type text,
  requested_target_type text,
  requested_target_id uuid,
  requested_assignment_id uuid,
  requested_nfc_tag_id uuid
)
RETURNS TABLE (
  subject_type text,
  target_type text,
  target_id uuid,
  target_active boolean,
  target_created_at timestamptz,
  target_deactivated_at timestamptz,
  target_row_version bigint,
  assignment_active boolean,
  assignment_valid_from timestamptz,
  assignment_valid_to timestamptz,
  assignment_row_version bigint,
  tag_created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $configuration$
BEGIN
  IF pg_catalog.current_setting('role', true) <> 'taptime_offline_event_ingestor'
    OR requested_organization_id IS DISTINCT FROM NULLIF(
      pg_catalog.current_setting('app.organization_id', true), ''
    )::uuid
    OR requested_subject_type NOT IN ('work', 'break')
    OR (requested_subject_type = 'work' AND (
      requested_target_type NOT IN ('customer', 'project', 'general_work')
      OR requested_target_id IS NULL
    ))
    OR (requested_subject_type = 'break' AND (
      requested_target_type IS NOT NULL OR requested_target_id IS NOT NULL
    ))
    OR (requested_assignment_id IS NULL) <> (requested_nfc_tag_id IS NULL)
  THEN
    RAISE EXCEPTION 'Offline v3 historical configuration capability rejected'
      USING ERRCODE = '42501';
  END IF;

  IF requested_subject_type = 'work' THEN
    PERFORM target.target_id FROM taptime_server.work_targets AS target
    WHERE target.organization_id = requested_organization_id
      AND target.target_type = requested_target_type
      AND target.target_id = requested_target_id
    FOR UPDATE;
  END IF;
  IF requested_assignment_id IS NOT NULL THEN
    PERFORM assignment.id
    FROM taptime_server.nfc_assignments AS assignment
    JOIN taptime_server.nfc_tags AS tag
      ON tag.organization_id = assignment.organization_id
     AND tag.id = assignment.nfc_tag_id
    WHERE assignment.organization_id = requested_organization_id
      AND assignment.id = requested_assignment_id
      AND assignment.assignment_type = requested_subject_type
      AND tag.id = requested_nfc_tag_id
    FOR UPDATE OF assignment, tag;
  END IF;

  IF requested_subject_type = 'break' AND requested_assignment_id IS NULL THEN
    RETURN QUERY SELECT 'break'::text, NULL::text, NULL::uuid, true,
      '-infinity'::timestamptz, NULL::timestamptz, NULL::bigint,
      NULL::boolean, NULL::timestamptz, NULL::timestamptz, NULL::bigint, NULL::timestamptz;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT requested_subject_type, target.target_type, target.target_id,
         COALESCE(target.active, true), COALESCE(target.created_at, '-infinity'::timestamptz),
         target.deactivated_at, target.row_version,
         assignment.active, assignment.valid_from, assignment.valid_to,
         assignment.row_version, tag.created_at
  FROM (SELECT 1) AS singleton
  LEFT JOIN taptime_server.work_targets AS target
    ON requested_subject_type = 'work'
   AND target.organization_id = requested_organization_id
   AND target.target_type = requested_target_type
   AND target.target_id = requested_target_id
  LEFT JOIN taptime_server.nfc_assignments AS assignment
    ON assignment.organization_id = requested_organization_id
   AND assignment.id = requested_assignment_id
   AND assignment.assignment_type = requested_subject_type
  LEFT JOIN taptime_server.nfc_tags AS tag
    ON tag.organization_id = assignment.organization_id
   AND tag.id = requested_nfc_tag_id;
END
$configuration$;
ALTER FUNCTION taptime_server.lock_offline_historical_configuration_v3(
  uuid, text, text, uuid, uuid, uuid
) OWNER TO taptime_offline_lease_function_owner;
REVOKE ALL ON FUNCTION taptime_server.lock_offline_historical_configuration_v3(
  uuid, text, text, uuid, uuid, uuid
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION taptime_server.lock_offline_historical_configuration_v3(
  uuid, text, text, uuid, uuid, uuid
) TO taptime_offline_event_ingestor;

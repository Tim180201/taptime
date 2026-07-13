CREATE TABLE taptime_server.customers (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES taptime_server.organizations (id),
  active boolean NOT NULL,
  activated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  deactivated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  row_version bigint NOT NULL DEFAULT 1 CHECK (row_version > 0),
  CONSTRAINT customers_tenant_id_unique UNIQUE (organization_id, id),
  CONSTRAINT customers_validity_state CHECK (
    (active AND deactivated_at IS NULL)
    OR (NOT active AND deactivated_at IS NOT NULL AND deactivated_at >= activated_at)
  )
);

CREATE TABLE taptime_server.nfc_tags (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES taptime_server.organizations (id),
  payload_value text NOT NULL CHECK (length(payload_value) > 0),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  CONSTRAINT nfc_tags_tenant_id_unique UNIQUE (organization_id, id),
  CONSTRAINT nfc_tags_organization_payload_unique UNIQUE (organization_id, payload_value)
);

CREATE TABLE taptime_server.nfc_assignments (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES taptime_server.organizations (id),
  nfc_tag_id uuid NOT NULL,
  target_type text NOT NULL CHECK (target_type = 'customer'),
  target_customer_id uuid NOT NULL,
  active boolean NOT NULL,
  valid_from timestamptz NOT NULL DEFAULT transaction_timestamp(),
  valid_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  row_version bigint NOT NULL DEFAULT 1 CHECK (row_version > 0),
  CONSTRAINT nfc_assignments_tenant_id_unique UNIQUE (organization_id, id),
  CONSTRAINT nfc_assignments_snapshot_unique UNIQUE (
    organization_id, id, nfc_tag_id, target_type, target_customer_id
  ),
  CONSTRAINT nfc_assignments_tag_fk FOREIGN KEY (organization_id, nfc_tag_id)
    REFERENCES taptime_server.nfc_tags (organization_id, id),
  CONSTRAINT nfc_assignments_customer_fk FOREIGN KEY (organization_id, target_customer_id)
    REFERENCES taptime_server.customers (organization_id, id),
  CONSTRAINT nfc_assignments_validity_state CHECK (
    (active AND valid_to IS NULL)
    OR (NOT active AND valid_to IS NOT NULL AND valid_to >= valid_from)
  )
);

CREATE UNIQUE INDEX nfc_assignments_one_active_per_tag
  ON taptime_server.nfc_assignments (organization_id, nfc_tag_id)
  WHERE active;

CREATE TABLE taptime_server.work_events (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES taptime_server.organizations (id),
  assignment_id uuid NOT NULL,
  nfc_tag_id uuid NOT NULL,
  target_type text NOT NULL CHECK (target_type = 'customer'),
  target_customer_id uuid NOT NULL,
  triggered_by_user_id uuid NOT NULL REFERENCES taptime_server.users (id),
  occurred_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  content_hash char(64) NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  content_hash_algorithm text NOT NULL CHECK (content_hash_algorithm = 'sha256'),
  content_hash_version smallint NOT NULL CHECK (content_hash_version = 1),
  CONSTRAINT work_events_tenant_id_unique UNIQUE (organization_id, id),
  CONSTRAINT work_events_tenant_user_id_unique UNIQUE (organization_id, triggered_by_user_id, id),
  CONSTRAINT work_events_tenant_user_target_id_unique UNIQUE (
    organization_id, triggered_by_user_id, target_type, target_customer_id, id
  ),
  CONSTRAINT work_events_assignment_snapshot_fk FOREIGN KEY (
    organization_id, assignment_id, nfc_tag_id, target_type, target_customer_id
  ) REFERENCES taptime_server.nfc_assignments (
    organization_id, id, nfc_tag_id, target_type, target_customer_id
  ),
  CONSTRAINT work_events_membership_user_fk FOREIGN KEY (organization_id, triggered_by_user_id)
    REFERENCES taptime_server.memberships (organization_id, user_id)
);

CREATE INDEX work_events_latest_user_target
  ON taptime_server.work_events (
    organization_id, triggered_by_user_id, target_type, target_customer_id, occurred_at DESC
  );

CREATE TABLE taptime_server.time_entries (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES taptime_server.organizations (id),
  user_id uuid NOT NULL REFERENCES taptime_server.users (id),
  target_type text NOT NULL CHECK (target_type = 'customer'),
  target_customer_id uuid NOT NULL,
  status text NOT NULL CHECK (status IN ('started', 'stopped')),
  start_work_event_id uuid NOT NULL,
  started_at timestamptz NOT NULL,
  stop_work_event_id uuid,
  stopped_at timestamptz,
  row_version bigint NOT NULL DEFAULT 1 CHECK (row_version > 0),
  CONSTRAINT time_entries_tenant_id_unique UNIQUE (organization_id, id),
  CONSTRAINT time_entries_tenant_user_id_unique UNIQUE (organization_id, user_id, id),
  CONSTRAINT time_entries_tenant_user_target_id_unique UNIQUE (
    organization_id, user_id, target_type, target_customer_id, id
  ),
  CONSTRAINT time_entries_target_fk FOREIGN KEY (organization_id, target_customer_id)
    REFERENCES taptime_server.customers (organization_id, id),
  CONSTRAINT time_entries_start_work_event_user_fk FOREIGN KEY (
    organization_id, user_id, target_type, target_customer_id, start_work_event_id
  ) REFERENCES taptime_server.work_events (
    organization_id, triggered_by_user_id, target_type, target_customer_id, id
  ),
  CONSTRAINT time_entries_stop_work_event_user_fk FOREIGN KEY (
    organization_id, user_id, target_type, target_customer_id, stop_work_event_id
  ) REFERENCES taptime_server.work_events (
    organization_id, triggered_by_user_id, target_type, target_customer_id, id
  ),
  CONSTRAINT time_entries_state_consistent CHECK (
    (status = 'started' AND stopped_at IS NULL AND stop_work_event_id IS NULL)
    OR
    (status = 'stopped' AND stopped_at IS NOT NULL AND stop_work_event_id IS NOT NULL)
  ),
  CONSTRAINT time_entries_distinct_lifecycle_events CHECK (
    stop_work_event_id IS NULL OR stop_work_event_id <> start_work_event_id
  ),
  CONSTRAINT time_entries_stop_order CHECK (stopped_at IS NULL OR stopped_at >= started_at)
);

CREATE UNIQUE INDEX time_entries_one_active_per_organization_user
  ON taptime_server.time_entries (organization_id, user_id)
  WHERE status = 'started';

CREATE FUNCTION taptime_server.enforce_time_entry_stop_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status <> 'started' OR NEW.status <> 'stopped' THEN
    RAISE EXCEPTION 'TimeEntry update must be a started-to-stopped transition'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.row_version <> OLD.row_version + 1 THEN
    RAISE EXCEPTION 'TimeEntry row_version must increment exactly once'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER time_entries_stop_transition
  BEFORE UPDATE ON taptime_server.time_entries
  FOR EACH ROW
  EXECUTE FUNCTION taptime_server.enforce_time_entry_stop_transition();

CREATE TABLE taptime_server.canonical_decisions (
  work_event_id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES taptime_server.organizations (id),
  actor_user_id uuid NOT NULL REFERENCES taptime_server.users (id),
  target_type text NOT NULL CHECK (target_type = 'customer'),
  target_customer_id uuid NOT NULL,
  decision_type text NOT NULL CHECK (decision_type IN (
    'time_entry_started',
    'time_entry_stopped',
    'duplicate_scan_ignored',
    'active_entry_for_other_target_rejected',
    'escalation_required'
  )),
  reason text,
  time_entry_id uuid,
  active_time_entry_id uuid,
  previous_work_event_id uuid,
  result_time_entry_id uuid GENERATED ALWAYS AS (COALESCE(time_entry_id, active_time_entry_id)) STORED,
  engine_version text NOT NULL CHECK (length(btrim(engine_version)) > 0),
  decided_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  decision_payload jsonb NOT NULL,
  CONSTRAINT canonical_decisions_tenant_id_unique UNIQUE (organization_id, work_event_id),
  CONSTRAINT canonical_decisions_tenant_user_id_unique UNIQUE (organization_id, actor_user_id, work_event_id),
  CONSTRAINT canonical_decisions_tenant_user_target_id_unique UNIQUE (
    organization_id, actor_user_id, target_type, target_customer_id, work_event_id
  ),
  CONSTRAINT canonical_decisions_receipt_mapping_unique UNIQUE (
    organization_id, actor_user_id, target_type, target_customer_id, work_event_id, result_time_entry_id
  ),
  CONSTRAINT canonical_decisions_work_event_user_fk FOREIGN KEY (
    organization_id, actor_user_id, target_type, target_customer_id, work_event_id
  ) REFERENCES taptime_server.work_events (
    organization_id, triggered_by_user_id, target_type, target_customer_id, id
  ),
  CONSTRAINT canonical_decisions_time_entry_user_fk FOREIGN KEY (
    organization_id, actor_user_id, target_type, target_customer_id, time_entry_id
  ) REFERENCES taptime_server.time_entries (
    organization_id, user_id, target_type, target_customer_id, id
  ) DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT canonical_decisions_active_time_entry_user_fk FOREIGN KEY (
    organization_id, actor_user_id, active_time_entry_id
  ) REFERENCES taptime_server.time_entries (
    organization_id, user_id, id
  ) DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT canonical_decisions_previous_work_event_user_fk FOREIGN KEY (
    organization_id, actor_user_id, target_type, target_customer_id, previous_work_event_id
  ) REFERENCES taptime_server.work_events (
    organization_id, triggered_by_user_id, target_type, target_customer_id, id
  ),
  CONSTRAINT canonical_decisions_result_shape CHECK (
    (
      decision_type IN ('time_entry_started', 'time_entry_stopped')
      AND reason IS NULL
      AND time_entry_id IS NOT NULL
      AND active_time_entry_id IS NULL
      AND previous_work_event_id IS NULL
    )
    OR (
      decision_type = 'duplicate_scan_ignored'
      AND reason IS NULL
      AND time_entry_id IS NULL
      AND active_time_entry_id IS NULL
      AND previous_work_event_id IS NOT NULL
      AND previous_work_event_id <> work_event_id
    )
    OR (
      decision_type = 'active_entry_for_other_target_rejected'
      AND reason IS NULL
      AND time_entry_id IS NULL
      AND active_time_entry_id IS NOT NULL
      AND previous_work_event_id IS NULL
    )
    OR (
      decision_type = 'escalation_required'
      AND reason IS NOT NULL
      AND reason IN (
        'active_time_entry_organization_mismatch',
        'active_time_entry_user_mismatch',
        'previous_work_event_organization_mismatch',
        'previous_work_event_user_mismatch',
        'previous_work_event_target_mismatch',
        'work_event_precedes_active_time_entry',
        'work_event_precedes_previous_accepted_work_event'
      )
      AND time_entry_id IS NULL
      AND active_time_entry_id IS NULL
      AND previous_work_event_id IS NULL
    )
  )
);

CREATE FUNCTION taptime_server.validate_canonical_decision_result()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  related_time_entry taptime_server.time_entries%ROWTYPE;
  related_work_event_occurred_at timestamptz;
BEGIN
  IF NEW.result_time_entry_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT entry.*
  INTO related_time_entry
  FROM taptime_server.time_entries AS entry
  WHERE entry.organization_id = NEW.organization_id
    AND entry.user_id = NEW.actor_user_id
    AND entry.id = NEW.result_time_entry_id;

  -- Missing or foreign entries remain the responsibility of the Organization/User FK.
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF NEW.decision_type IN ('time_entry_started', 'time_entry_stopped') THEN
    SELECT event.occurred_at
    INTO related_work_event_occurred_at
    FROM taptime_server.work_events AS event
    WHERE event.organization_id = NEW.organization_id
      AND event.triggered_by_user_id = NEW.actor_user_id
      AND event.target_type = NEW.target_type
      AND event.target_customer_id = NEW.target_customer_id
      AND event.id = NEW.work_event_id;

    -- Missing or foreign WorkEvents remain the responsibility of the qualified FK.
    IF NOT FOUND THEN
      RETURN NEW;
    END IF;
  END IF;

  IF NEW.decision_type = 'time_entry_started' THEN
    IF related_time_entry.status <> 'started'
      OR related_time_entry.start_work_event_id <> NEW.work_event_id
      OR related_time_entry.started_at IS DISTINCT FROM related_work_event_occurred_at
      OR related_time_entry.target_type <> NEW.target_type
      OR related_time_entry.target_customer_id <> NEW.target_customer_id
    THEN
      RAISE EXCEPTION 'time_entry_started Decision does not match its started TimeEntry'
        USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.decision_type = 'time_entry_stopped' THEN
    IF related_time_entry.status <> 'stopped'
      OR related_time_entry.stop_work_event_id IS DISTINCT FROM NEW.work_event_id
      OR related_time_entry.stopped_at IS DISTINCT FROM related_work_event_occurred_at
      OR related_time_entry.target_type <> NEW.target_type
      OR related_time_entry.target_customer_id <> NEW.target_customer_id
    THEN
      RAISE EXCEPTION 'time_entry_stopped Decision does not match its stopped TimeEntry'
        USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.decision_type = 'active_entry_for_other_target_rejected' THEN
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
$$;

CREATE CONSTRAINT TRIGGER canonical_decisions_result_consistency
  AFTER INSERT OR UPDATE ON taptime_server.canonical_decisions
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION taptime_server.validate_canonical_decision_result();

-- These reverse, deferred links make the selected Core result and its TimeEntry traceability
-- atomic in both directions. They validate persisted engine output; they do not choose a result.
ALTER TABLE taptime_server.time_entries
  ADD CONSTRAINT time_entries_start_decision_fk FOREIGN KEY (
    organization_id, user_id, target_type, target_customer_id, start_work_event_id, id
  ) REFERENCES taptime_server.canonical_decisions (
    organization_id, actor_user_id, target_type, target_customer_id,
    work_event_id, result_time_entry_id
  ) DEFERRABLE INITIALLY DEFERRED,
  ADD CONSTRAINT time_entries_stop_decision_fk FOREIGN KEY (
    organization_id, user_id, target_type, target_customer_id, stop_work_event_id, id
  ) REFERENCES taptime_server.canonical_decisions (
    organization_id, actor_user_id, target_type, target_customer_id,
    work_event_id, result_time_entry_id
  ) DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE taptime_server.sync_receipts (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES taptime_server.organizations (id),
  user_id uuid NOT NULL REFERENCES taptime_server.users (id),
  target_type text NOT NULL CHECK (target_type = 'customer'),
  target_customer_id uuid NOT NULL,
  work_event_id uuid NOT NULL,
  attempt_number integer NOT NULL CHECK (attempt_number > 0),
  attempted_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  status text NOT NULL CHECK (status IN ('received', 'synchronized', 'retryable_failure', 'conflict')),
  client_decision_hash text,
  server_decision_work_event_id uuid,
  conflict_code text,
  client_time_entry_id uuid,
  server_time_entry_id uuid,
  CONSTRAINT sync_receipts_tenant_id_unique UNIQUE (organization_id, id),
  CONSTRAINT sync_receipts_attempt_unique UNIQUE (organization_id, work_event_id, attempt_number),
  CONSTRAINT sync_receipts_tenant_user_target_attempt_unique UNIQUE (
    organization_id, user_id, target_type, target_customer_id, work_event_id, attempt_number
  ),
  CONSTRAINT sync_receipts_work_event_user_fk FOREIGN KEY (
    organization_id, user_id, target_type, target_customer_id, work_event_id
  ) REFERENCES taptime_server.work_events (
    organization_id, triggered_by_user_id, target_type, target_customer_id, id
  ),
  CONSTRAINT sync_receipts_decision_user_fk FOREIGN KEY (
    organization_id, user_id, target_type, target_customer_id, server_decision_work_event_id
  ) REFERENCES taptime_server.canonical_decisions (
    organization_id, actor_user_id, target_type, target_customer_id, work_event_id
  ),
  CONSTRAINT sync_receipts_decision_time_entry_mapping_fk FOREIGN KEY (
    organization_id, user_id, target_type, target_customer_id,
    server_decision_work_event_id, server_time_entry_id
  ) REFERENCES taptime_server.canonical_decisions (
    organization_id, actor_user_id, target_type, target_customer_id,
    work_event_id, result_time_entry_id
  ),
  CONSTRAINT sync_receipts_time_entry_user_fk FOREIGN KEY (
    organization_id, user_id, server_time_entry_id
  ) REFERENCES taptime_server.time_entries (
    organization_id, user_id, id
  ),
  CONSTRAINT sync_receipts_canonical_link CHECK (
    server_decision_work_event_id IS NULL OR server_decision_work_event_id = work_event_id
  ),
  CONSTRAINT sync_receipts_time_entry_requires_decision CHECK (
    server_time_entry_id IS NULL OR server_decision_work_event_id IS NOT NULL
  ),
  CONSTRAINT sync_receipts_result_shape CHECK (
    (
      status IN ('received', 'retryable_failure')
      AND server_decision_work_event_id IS NULL
      AND server_time_entry_id IS NULL
      AND conflict_code IS NULL
    )
    OR (
      status = 'synchronized'
      AND server_decision_work_event_id IS NOT NULL
      AND conflict_code IS NULL
    )
    OR (
      status = 'conflict'
      AND conflict_code IS NOT NULL
      AND length(btrim(conflict_code)) > 0
    )
  )
);

CREATE TABLE taptime_server.audit_events (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES taptime_server.organizations (id),
  actor_user_id uuid REFERENCES taptime_server.users (id),
  work_event_user_id uuid,
  work_event_id uuid,
  event_type text NOT NULL CHECK (length(btrim(event_type)) > 0),
  entity_type text NOT NULL CHECK (length(btrim(entity_type)) > 0),
  entity_id uuid NOT NULL,
  occurred_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  correlation_id text NOT NULL CHECK (length(btrim(correlation_id)) > 0),
  payload jsonb NOT NULL,
  CONSTRAINT audit_events_tenant_id_unique UNIQUE (organization_id, id),
  CONSTRAINT audit_events_actor_organization_fk FOREIGN KEY (organization_id, actor_user_id)
    REFERENCES taptime_server.memberships (organization_id, user_id),
  CONSTRAINT audit_events_work_event_pair CHECK (
    (work_event_id IS NULL AND work_event_user_id IS NULL)
    OR (work_event_id IS NOT NULL AND work_event_user_id IS NOT NULL)
  ),
  CONSTRAINT audit_events_work_event_user_fk FOREIGN KEY (
    organization_id, work_event_user_id, work_event_id
  ) REFERENCES taptime_server.work_events (organization_id, triggered_by_user_id, id)
);

CREATE FUNCTION taptime_server.enforce_administrator_update_shape()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_TABLE_NAME = 'organizations' THEN
    IF NEW.id <> OLD.id OR NEW.created_at <> OLD.created_at OR NEW.row_version <> OLD.row_version + 1 THEN
      RAISE EXCEPTION 'Invalid Organization update shape' USING ERRCODE = '23514';
    END IF;
  ELSIF TG_TABLE_NAME = 'memberships' THEN
    IF NEW.id <> OLD.id
      OR NEW.organization_id <> OLD.organization_id
      OR NEW.user_id <> OLD.user_id
      OR NEW.created_at <> OLD.created_at
      OR NEW.created_by_user_id IS DISTINCT FROM OLD.created_by_user_id
      OR NEW.row_version <> OLD.row_version + 1
      OR OLD.revoked_at IS NOT NULL
      OR (NEW.revoked_at IS NOT NULL AND NEW.revoked_at < OLD.created_at)
    THEN
      RAISE EXCEPTION 'Invalid Membership update shape' USING ERRCODE = '23514';
    END IF;
  ELSIF TG_TABLE_NAME = 'customers' THEN
    IF NEW.id <> OLD.id
      OR NEW.organization_id <> OLD.organization_id
      OR NEW.activated_at <> OLD.activated_at
      OR NEW.created_at <> OLD.created_at
      OR NEW.row_version <> OLD.row_version + 1
      OR NOT OLD.active
      OR NEW.active
      OR NEW.deactivated_at IS NULL
    THEN
      RAISE EXCEPTION 'Invalid Customer update shape' USING ERRCODE = '23514';
    END IF;
    NEW.updated_at := transaction_timestamp();
  ELSIF TG_TABLE_NAME = 'nfc_assignments' THEN
    IF NEW.id <> OLD.id
      OR NEW.organization_id <> OLD.organization_id
      OR NEW.nfc_tag_id <> OLD.nfc_tag_id
      OR NEW.target_type <> OLD.target_type
      OR NEW.target_customer_id <> OLD.target_customer_id
      OR NEW.valid_from <> OLD.valid_from
      OR NEW.created_at <> OLD.created_at
      OR NEW.row_version <> OLD.row_version + 1
      OR NOT OLD.active
      OR NEW.active
      OR NEW.valid_to IS NULL
    THEN
      RAISE EXCEPTION 'Invalid NfcAssignment update shape' USING ERRCODE = '23514';
    END IF;
    NEW.updated_at := transaction_timestamp();
  ELSE
    RAISE EXCEPTION 'Unsupported administrative table: %', TG_TABLE_NAME USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$$;

CREATE FUNCTION taptime_server.append_administrative_audit_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, taptime_server
AS $$
DECLARE
  audit_organization_id uuid;
  audit_entity_id uuid;
  audit_event_type text;
  audit_entity_type text;
  audit_payload jsonb;
  audit_correlation_id text;
BEGIN
  IF current_setting('role', true) <> 'taptime_administrator' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'organizations' THEN
    audit_organization_id := NEW.id;
  ELSE
    audit_organization_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.organization_id ELSE NEW.organization_id END;
  END IF;
  audit_entity_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END;
  audit_correlation_id := NULLIF(current_setting('app.correlation_id', true), '');
  IF audit_correlation_id IS NULL THEN
    RAISE EXCEPTION 'Administrative audit correlation context is required' USING ERRCODE = '42501';
  END IF;

  IF TG_TABLE_NAME = 'organizations' AND TG_OP = 'UPDATE' THEN
    audit_event_type := 'OrganizationUpdated';
    audit_entity_type := 'Organization';
    audit_payload := jsonb_build_object('changedFields', jsonb_build_array('name'), 'rowVersion', NEW.row_version);
  ELSIF TG_TABLE_NAME = 'memberships' AND TG_OP = 'INSERT' THEN
    audit_event_type := 'MembershipGranted';
    audit_entity_type := 'Membership';
    audit_payload := jsonb_build_object('role', NEW.role);
  ELSIF TG_TABLE_NAME = 'memberships' AND TG_OP = 'UPDATE' THEN
    audit_event_type := CASE WHEN NEW.revoked_at IS NOT NULL THEN 'MembershipRevoked' ELSE 'MembershipRoleChanged' END;
    audit_entity_type := 'Membership';
    audit_payload := jsonb_build_object(
      'role', NEW.role,
      'revoked', NEW.revoked_at IS NOT NULL,
      'rowVersion', NEW.row_version
    );
  ELSIF TG_TABLE_NAME = 'customers' THEN
    audit_event_type := CASE TG_OP
      WHEN 'INSERT' THEN 'CustomerCreated'
      WHEN 'UPDATE' THEN 'CustomerDeactivated'
      WHEN 'DELETE' THEN 'CustomerDeleted'
    END;
    audit_entity_type := 'Customer';
    audit_payload := CASE WHEN TG_OP = 'UPDATE'
      THEN jsonb_build_object('active', NEW.active, 'rowVersion', NEW.row_version)
      ELSE '{}'::jsonb
    END;
  ELSIF TG_TABLE_NAME = 'nfc_tags' THEN
    audit_event_type := CASE WHEN TG_OP = 'INSERT' THEN 'NfcTagRegistered' ELSE 'NfcTagDeleted' END;
    audit_entity_type := 'NfcTag';
    audit_payload := '{}'::jsonb;
  ELSIF TG_TABLE_NAME = 'nfc_assignments' THEN
    audit_event_type := CASE WHEN TG_OP = 'INSERT' THEN 'NfcTagAssigned' ELSE 'NfcAssignmentDeactivated' END;
    audit_entity_type := 'NfcAssignment';
    audit_payload := CASE WHEN TG_OP = 'UPDATE'
      THEN jsonb_build_object('active', NEW.active, 'rowVersion', NEW.row_version)
      ELSE '{}'::jsonb
    END;
  ELSE
    RAISE EXCEPTION 'Administrative operation is not audit-allowlisted: %.%', TG_TABLE_NAME, TG_OP
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO taptime_server.audit_events (
    id, organization_id, actor_user_id, event_type, entity_type, entity_id,
    occurred_at, correlation_id, payload
  ) VALUES (
    gen_random_uuid(), audit_organization_id, taptime_server.current_user_id(), audit_event_type,
    audit_entity_type, audit_entity_id, transaction_timestamp(), audit_correlation_id, audit_payload
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER organizations_administrator_update_shape
  BEFORE UPDATE ON taptime_server.organizations
  FOR EACH ROW EXECUTE FUNCTION taptime_server.enforce_administrator_update_shape();
CREATE TRIGGER organizations_administrative_audit
  AFTER UPDATE ON taptime_server.organizations
  FOR EACH ROW EXECUTE FUNCTION taptime_server.append_administrative_audit_event();

CREATE TRIGGER memberships_administrator_update_shape
  BEFORE UPDATE ON taptime_server.memberships
  FOR EACH ROW EXECUTE FUNCTION taptime_server.enforce_administrator_update_shape();
CREATE TRIGGER memberships_administrative_audit
  AFTER INSERT OR UPDATE ON taptime_server.memberships
  FOR EACH ROW EXECUTE FUNCTION taptime_server.append_administrative_audit_event();

CREATE TRIGGER customers_administrator_update_shape
  BEFORE UPDATE ON taptime_server.customers
  FOR EACH ROW EXECUTE FUNCTION taptime_server.enforce_administrator_update_shape();
CREATE TRIGGER customers_administrative_audit
  AFTER INSERT OR UPDATE OR DELETE ON taptime_server.customers
  FOR EACH ROW EXECUTE FUNCTION taptime_server.append_administrative_audit_event();

CREATE TRIGGER nfc_tags_administrative_audit
  AFTER INSERT OR DELETE ON taptime_server.nfc_tags
  FOR EACH ROW EXECUTE FUNCTION taptime_server.append_administrative_audit_event();

CREATE TRIGGER nfc_assignments_administrator_update_shape
  BEFORE UPDATE ON taptime_server.nfc_assignments
  FOR EACH ROW EXECUTE FUNCTION taptime_server.enforce_administrator_update_shape();
CREATE TRIGGER nfc_assignments_administrative_audit
  AFTER INSERT OR UPDATE ON taptime_server.nfc_assignments
  FOR EACH ROW EXECUTE FUNCTION taptime_server.append_administrative_audit_event();

// Frozen historical SQLite schemas; independent of the production migration under test.

// Source: 4f51918, OFFLINE_SCHEMA_V1.
const OFFLINE_SCHEMA_V1 = `
CREATE TABLE offline_owner (
  singleton_id INTEGER PRIMARY KEY CHECK (singleton_id = 1),
  organization_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  membership_id TEXT NOT NULL,
  installation_binding_digest TEXT NOT NULL CHECK (length(installation_binding_digest) = 64),
  installation_id TEXT,
  identity_binding_id TEXT,
  next_device_sequence INTEGER NOT NULL DEFAULT 0 CHECK (next_device_sequence >= 0),
  capture_invalidated INTEGER NOT NULL DEFAULT 0 CHECK (capture_invalidated IN (0, 1))
) STRICT;

CREATE TABLE offline_lease_generations (
  lease_id TEXT PRIMARY KEY,
  installation_id TEXT NOT NULL,
  identity_binding_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  membership_id TEXT NOT NULL,
  membership_row_version INTEGER NOT NULL CHECK (membership_row_version > 0),
  membership_role TEXT NOT NULL CHECK (membership_role IN ('administrator', 'employee')),
  issued_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  configuration_revision TEXT NOT NULL CHECK (length(configuration_revision) = 64),
  item_count INTEGER NOT NULL CHECK (item_count BETWEEN 0 AND 4096),
  serialized_bytes INTEGER NOT NULL CHECK (serialized_bytes BETWEEN 0 AND 4194304),
  manifest_digest TEXT NOT NULL CHECK (length(manifest_digest) = 64),
  activation_boot_marker TEXT NOT NULL CHECK (length(activation_boot_marker) BETWEEN 1 AND 256),
  activation_monotonic_milliseconds INTEGER NOT NULL CHECK (activation_monotonic_milliseconds >= 0),
  generation_state TEXT NOT NULL CHECK (generation_state IN ('assembling', 'active', 'retired'))
) STRICT;

CREATE UNIQUE INDEX one_active_offline_lease
  ON offline_lease_generations (generation_state)
  WHERE generation_state = 'active';

CREATE TABLE offline_lease_items (
  lease_id TEXT NOT NULL REFERENCES offline_lease_generations (lease_id),
  item_id TEXT NOT NULL,
  lookup_value TEXT NOT NULL CHECK (length(lookup_value) = 64),
  assignment_id TEXT NOT NULL,
  nfc_tag_id TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type = 'customer'),
  target_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  PRIMARY KEY (lease_id, item_id),
  UNIQUE (lease_id, lookup_value)
) STRICT;

CREATE TABLE offline_event_queue (
  device_sequence INTEGER PRIMARY KEY CHECK (device_sequence > 0),
  work_event_id TEXT NOT NULL UNIQUE,
  receipt_id TEXT NOT NULL UNIQUE,
  lease_id TEXT NOT NULL,
  lease_item_id TEXT NOT NULL,
  command_json TEXT NOT NULL,
  serialized_bytes INTEGER NOT NULL CHECK (serialized_bytes BETWEEN 1 AND 4096),
  queue_state TEXT NOT NULL CHECK (
    queue_state IN ('pending', 'in_flight', 'retry_wait', 'protected_review_predecessor')
  ),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_attempt_at INTEGER,
  FOREIGN KEY (lease_id, lease_item_id)
    REFERENCES offline_lease_items (lease_id, item_id)
) STRICT;

CREATE TABLE offline_legacy_queue (
  legacy_order INTEGER PRIMARY KEY AUTOINCREMENT,
  work_event_id TEXT NOT NULL UNIQUE,
  receipt_id TEXT NOT NULL UNIQUE,
  submission_json TEXT NOT NULL,
  serialized_bytes INTEGER NOT NULL CHECK (serialized_bytes BETWEEN 1 AND 4096),
  queue_state TEXT NOT NULL CHECK (
    queue_state IN ('pending', 'in_flight', 'retry_wait', 'protected_review_predecessor')
  ),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_attempt_at INTEGER
) STRICT;

CREATE TABLE offline_scheduler_metadata (
  singleton_id INTEGER PRIMARY KEY CHECK (singleton_id = 1),
  last_trigger TEXT,
  last_attempt_at INTEGER
) STRICT;

CREATE TABLE offline_protected_quarantine (
  quarantine_id TEXT PRIMARY KEY,
  reason TEXT NOT NULL,
  evidence_json TEXT NOT NULL,
  created_at TEXT NOT NULL
) STRICT;

CREATE TRIGGER offline_lease_item_update_rejected
BEFORE UPDATE ON offline_lease_items
BEGIN
  SELECT RAISE(ABORT, 'offline lease items are immutable');
END;

CREATE TRIGGER offline_lease_item_delete_rejected
BEFORE DELETE ON offline_lease_items
BEGIN
  SELECT RAISE(ABORT, 'offline lease items are immutable');
END;

CREATE TRIGGER offline_lease_generation_immutable_fields
BEFORE UPDATE ON offline_lease_generations
WHEN NEW.lease_id <> OLD.lease_id
  OR NEW.installation_id <> OLD.installation_id
  OR NEW.identity_binding_id <> OLD.identity_binding_id
  OR NEW.organization_id <> OLD.organization_id
  OR NEW.user_id <> OLD.user_id
  OR NEW.membership_id <> OLD.membership_id
  OR NEW.membership_row_version <> OLD.membership_row_version
  OR NEW.membership_role <> OLD.membership_role
  OR NEW.issued_at <> OLD.issued_at
  OR NEW.expires_at <> OLD.expires_at
  OR NEW.configuration_revision <> OLD.configuration_revision
  OR NEW.item_count <> OLD.item_count
  OR NEW.serialized_bytes <> OLD.serialized_bytes
  OR NEW.manifest_digest <> OLD.manifest_digest
  OR NEW.activation_boot_marker <> OLD.activation_boot_marker
  OR NEW.activation_monotonic_milliseconds <> OLD.activation_monotonic_milliseconds
BEGIN
  SELECT RAISE(ABORT, 'offline lease generation is immutable');
END;

CREATE TRIGGER offline_queue_immutable_fields
BEFORE UPDATE ON offline_event_queue
WHEN NEW.device_sequence <> OLD.device_sequence
  OR NEW.work_event_id <> OLD.work_event_id
  OR NEW.receipt_id <> OLD.receipt_id
  OR NEW.lease_id <> OLD.lease_id
  OR NEW.lease_item_id <> OLD.lease_item_id
  OR NEW.command_json <> OLD.command_json
  OR NEW.serialized_bytes <> OLD.serialized_bytes
BEGIN
  SELECT RAISE(ABORT, 'offline queue evidence is immutable');
END;

CREATE TRIGGER offline_legacy_queue_immutable_fields
BEFORE UPDATE ON offline_legacy_queue
WHEN NEW.legacy_order <> OLD.legacy_order
  OR NEW.work_event_id <> OLD.work_event_id
  OR NEW.receipt_id <> OLD.receipt_id
  OR NEW.submission_json <> OLD.submission_json
  OR NEW.serialized_bytes <> OLD.serialized_bytes
BEGIN
  SELECT RAISE(ABORT, 'legacy queue evidence is immutable');
END;

CREATE TRIGGER offline_protected_quarantine_update_rejected
BEFORE UPDATE ON offline_protected_quarantine
BEGIN
  SELECT RAISE(ABORT, 'protected evidence is immutable');
END;

CREATE TRIGGER offline_protected_quarantine_delete_rejected
BEFORE DELETE ON offline_protected_quarantine
BEGIN
  SELECT RAISE(ABORT, 'protected evidence cannot be deleted automatically');
END;
`;

// Source: 7dbda3b, OFFLINE_SCHEMA_V1_TO_V2.
const OFFLINE_SCHEMA_V1_TO_V2 = `
ALTER TABLE offline_owner
ADD COLUMN review_pending_sequence INTEGER CHECK (
  review_pending_sequence IS NULL
  OR (
    review_pending_sequence > 0
    AND review_pending_sequence <= next_device_sequence
  )
);
`;

// Source: 4cd4718, OFFLINE_SCHEMA_V2_TO_V3.
const OFFLINE_SCHEMA_V2_TO_V3 = `
ALTER TABLE offline_lease_generations
ADD COLUMN lease_schema_version INTEGER NOT NULL DEFAULT 1
CHECK (lease_schema_version IN (1, 2));
ALTER TABLE offline_lease_generations
ADD COLUMN manifest_version INTEGER NOT NULL DEFAULT 1
CHECK (manifest_version IN (1, 2));

DROP TRIGGER offline_queue_immutable_fields;
DROP TRIGGER offline_lease_item_update_rejected;
DROP TRIGGER offline_lease_item_delete_rejected;
DROP TRIGGER offline_lease_generation_immutable_fields;
ALTER TABLE offline_event_queue RENAME TO offline_event_queue_v2;
ALTER TABLE offline_lease_items RENAME TO offline_lease_items_v2;

CREATE TABLE offline_lease_items (
  lease_id TEXT NOT NULL REFERENCES offline_lease_generations (lease_id),
  item_id TEXT NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('nfc_assignment', 'manual_target')),
  lookup_value TEXT CHECK (lookup_value IS NULL OR length(lookup_value) = 64),
  assignment_id TEXT,
  nfc_tag_id TEXT,
  target_type TEXT NOT NULL CHECK (target_type IN ('customer', 'project', 'general_work')),
  target_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  assignment_row_version INTEGER CHECK (
    assignment_row_version IS NULL OR assignment_row_version > 0
  ),
  target_row_version INTEGER CHECK (target_row_version IS NULL OR target_row_version > 0),
  CHECK (
    (item_type = 'nfc_assignment' AND lookup_value IS NOT NULL
      AND assignment_id IS NOT NULL AND nfc_tag_id IS NOT NULL
      AND target_type = 'customer')
    OR
    (item_type = 'manual_target' AND lookup_value IS NULL
      AND assignment_id IS NULL AND nfc_tag_id IS NULL
      AND target_row_version IS NOT NULL)
  ),
  PRIMARY KEY (lease_id, item_id),
  UNIQUE (lease_id, lookup_value)
) STRICT;

INSERT INTO offline_lease_items (
  lease_id, item_id, item_type, lookup_value, assignment_id, nfc_tag_id,
  target_type, target_id, display_name, assignment_row_version, target_row_version
)
SELECT lease_id, item_id, 'nfc_assignment', lookup_value, assignment_id, nfc_tag_id,
       target_type, target_id, display_name, NULL, NULL
FROM offline_lease_items_v2;

CREATE TABLE offline_event_queue (
  device_sequence INTEGER PRIMARY KEY CHECK (device_sequence > 0),
  work_event_id TEXT NOT NULL UNIQUE,
  receipt_id TEXT NOT NULL UNIQUE,
  lease_id TEXT NOT NULL,
  lease_item_id TEXT NOT NULL,
  command_json TEXT NOT NULL,
  serialized_bytes INTEGER NOT NULL CHECK (serialized_bytes BETWEEN 1 AND 4096),
  queue_state TEXT NOT NULL CHECK (
    queue_state IN ('pending', 'in_flight', 'retry_wait', 'protected_review_predecessor')
  ),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_attempt_at INTEGER,
  FOREIGN KEY (lease_id, lease_item_id)
    REFERENCES offline_lease_items (lease_id, item_id)
) STRICT;

INSERT INTO offline_event_queue
SELECT * FROM offline_event_queue_v2;
DROP TABLE offline_event_queue_v2;
DROP TABLE offline_lease_items_v2;

CREATE TRIGGER offline_lease_item_update_rejected
BEFORE UPDATE ON offline_lease_items
BEGIN
  SELECT RAISE(ABORT, 'offline lease items are immutable');
END;
CREATE TRIGGER offline_lease_item_delete_rejected
BEFORE DELETE ON offline_lease_items
BEGIN
  SELECT RAISE(ABORT, 'offline lease items are immutable');
END;
CREATE TRIGGER offline_queue_immutable_fields
BEFORE UPDATE ON offline_event_queue
WHEN NEW.device_sequence <> OLD.device_sequence
  OR NEW.work_event_id <> OLD.work_event_id
  OR NEW.receipt_id <> OLD.receipt_id
  OR NEW.lease_id <> OLD.lease_id
  OR NEW.lease_item_id <> OLD.lease_item_id
  OR NEW.command_json <> OLD.command_json
  OR NEW.serialized_bytes <> OLD.serialized_bytes
BEGIN
  SELECT RAISE(ABORT, 'offline queue evidence is immutable');
END;
CREATE TRIGGER offline_lease_generation_immutable_fields
BEFORE UPDATE ON offline_lease_generations
WHEN NEW.lease_id <> OLD.lease_id
  OR NEW.installation_id <> OLD.installation_id
  OR NEW.identity_binding_id <> OLD.identity_binding_id
  OR NEW.organization_id <> OLD.organization_id
  OR NEW.user_id <> OLD.user_id
  OR NEW.membership_id <> OLD.membership_id
  OR NEW.membership_row_version <> OLD.membership_row_version
  OR NEW.membership_role <> OLD.membership_role
  OR NEW.issued_at <> OLD.issued_at
  OR NEW.expires_at <> OLD.expires_at
  OR NEW.configuration_revision <> OLD.configuration_revision
  OR NEW.item_count <> OLD.item_count
  OR NEW.serialized_bytes <> OLD.serialized_bytes
  OR NEW.manifest_digest <> OLD.manifest_digest
  OR NEW.activation_boot_marker <> OLD.activation_boot_marker
  OR NEW.activation_monotonic_milliseconds <> OLD.activation_monotonic_milliseconds
  OR NEW.lease_schema_version <> OLD.lease_schema_version
  OR NEW.manifest_version <> OLD.manifest_version
BEGIN
  SELECT RAISE(ABORT, 'offline lease generation is immutable');
END;
`;

export const legacyOfflineSchemas = ["", OFFLINE_SCHEMA_V1,
  OFFLINE_SCHEMA_V1 + OFFLINE_SCHEMA_V1_TO_V2,
  OFFLINE_SCHEMA_V1 + OFFLINE_SCHEMA_V1_TO_V2 + OFFLINE_SCHEMA_V2_TO_V3];

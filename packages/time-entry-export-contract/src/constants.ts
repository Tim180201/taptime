export const TIME_ENTRY_EXPORT_SCHEMA_VERSION = '1' as const;
export const TIME_ENTRY_EXPORT_SCHEMA_VERSION_V2 = '2' as const;
export const TIME_ENTRY_EXPORT_SCHEMA_VERSION_V3 = '3' as const;
export const TIME_ENTRY_EXPORT_MAXIMUM_RANGE_MILLISECONDS = 31 * 24 * 60 * 60 * 1_000;
export const TIME_ENTRY_EXPORT_MAXIMUM_ROWS = 10_000;
export const TIME_ENTRY_EXPORT_MAXIMUM_BYTES = 8 * 1_024 * 1_024;

export const TIME_ENTRY_EXPORT_HEADERS = Object.freeze([
  'schema_version',
  'organization_id',
  'organization_name',
  'time_entry_id',
  'employee_membership_id',
  'employee_display_name',
  'customer_id',
  'customer_display_name',
  'status',
  'started_at_utc',
  'stopped_at_utc',
  'duration_seconds',
] as const);

export const TIME_ENTRY_EXPORT_HEADERS_V2 = Object.freeze([
  'schema_version',
  'organization_id',
  'organization_name',
  'time_entry_id',
  'employee_membership_id',
  'employee_display_name',
  'record_source',
  'target_type',
  'target_id',
  'target_display_name',
  'status',
  'started_via',
  'stopped_via',
  'started_at_utc',
  'stopped_at_utc',
  'duration_seconds',
] as const);

// D-017 fixes the payroll export at twelve columns. The route and filename carry the
// schema version; structured cells retain both boundary values without adding settings.
export const TIME_ENTRY_EXPORT_HEADERS_V3 = Object.freeze([
  'person_identifier',
  'employee_display_name',
  'date_europe_berlin',
  'started_at_europe_berlin',
  'stopped_at_europe_berlin',
  'started_at_utc',
  'stopped_at_utc',
  'break_duration_seconds',
  'effective_work_duration_seconds',
  'target',
  'capture_types',
  'correction',
] as const);

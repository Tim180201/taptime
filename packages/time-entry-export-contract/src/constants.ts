export const TIME_ENTRY_EXPORT_SCHEMA_VERSION = '1' as const;
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

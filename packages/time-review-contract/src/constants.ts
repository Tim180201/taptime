import { LONGEST_BERLIN_CALENDAR_MONTH_MILLISECONDS } from '@taptime/core';

export const TIME_REVIEW_SCHEMA_VERSION = 1 as const;
export const TIME_REVIEW_ROLES = ['administrator', 'standortleitung'] as const;
export const TIME_REVIEW_MAXIMUM_RANGE_MILLISECONDS = LONGEST_BERLIN_CALENDAR_MONTH_MILLISECONDS;
export const TIME_REVIEW_MAXIMUM_QUERY_ROWS = 100;
export const TIME_REVIEW_MAXIMUM_ADJUDICATION_ITEMS = 25;
export const TIME_REVIEW_MAXIMUM_REASON_CHARACTERS = 500;
export const TIME_REVIEW_MAXIMUM_CURSOR_CHARACTERS = 512;

export { BUSINESS_ENGINE_ESCALATION_REASONS } from '@taptime/core';
import { BUSINESS_ENGINE_ESCALATION_REASONS } from '@taptime/core';
export const TIME_REVIEW_REASONS = [
  'event_content_conflict', 'sequence_content_conflict', 'lease_binding_conflict',
  'receipt_metadata_conflict', 'invalid_response', 'http_400', 'http_409', 'http_422',
  'identity_or_membership_not_current', 'capture_time_out_of_bounds', 'automatic_window_elapsed',
  'customer_deleted', 'historical_configuration_not_valid', 'predecessor_requires_review', 'server_lifecycle_deferred',
  ...BUSINESS_ENGINE_ESCALATION_REASONS,
] as const;

// D-056: one business calendar for boundaries, input and display.
export const BUSINESS_TIME_ZONE = 'Europe/Berlin' as const;

// The longest Berlin calendar month has 31 days and the repeated autumn hour.
export const LONGEST_BERLIN_CALENDAR_MONTH_MILLISECONDS = (31 * 24 + 1) * 60 * 60 * 1_000;

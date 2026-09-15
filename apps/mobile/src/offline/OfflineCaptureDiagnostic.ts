import type { ProductScanProtectionClass } from '../scan/contracts';

export type OfflineMigrationFailureReporter = (error: unknown) => void;

interface SanitizedSqliteError {
  readonly sqliteErrorCode: string;
  readonly message: string;
}

const SQLITE_UNKNOWN_CODE = 'SQLITE_UNKNOWN';
const SQLITE_FALLBACK_MESSAGE = 'SQLite migration failed';
const CONFIRMED_SCHEMA_ERROR = 'near "generation_state": syntax error';
const SAFE_SQLITE_CODES = new Set([
  'ERR_INTERNAL_SQLITE_ERROR',
  'ERR_SQLITE_ERROR',
]);
const SAFE_SQLITE_MESSAGE_CATEGORIES: ReadonlyArray<readonly [RegExp, string]> = [
  [/syntax error/iu, 'syntax error'],
  [/no such table/iu, 'no such table'],
  [/no such column/iu, 'no such column'],
  [/duplicate column name/iu, 'duplicate column name'],
  [/(?:unique|not null|check|foreign key) constraint failed/iu, 'constraint failed'],
  [/database is locked/iu, 'database is locked'],
  [/database is busy/iu, 'database is busy'],
  [/database disk image is malformed/iu, 'database disk image is malformed'],
  [/file is not a database/iu, 'file is not a database'],
  [/database or disk is full/iu, 'database or disk is full'],
  [/attempt to write a readonly database/iu, 'attempt to write a readonly database'],
  [/disk I\/O error/iu, 'disk I/O error'],
  [/cannot (?:start|commit|rollback)/iu, 'transaction failed'],
];

export function sanitizeSqliteError(error: unknown): SanitizedSqliteError {
  const rawMessage = readOwnString(error, 'message');
  const sqliteMessage = extractSqliteMessage(rawMessage);
  const rawErrcode = readOwnValue(error, 'errcode');
  const rawCode = readOwnString(error, 'code');
  const sqliteErrorCode = sqliteMessage.resultCode
    ?? (Number.isSafeInteger(rawErrcode)
      && Number(rawErrcode) >= 0
      && Number(rawErrcode) <= 65_535
      ? String(rawErrcode)
      : rawCode !== null && SAFE_SQLITE_CODES.has(rawCode)
        ? rawCode
        : SQLITE_UNKNOWN_CODE);
  return Object.freeze({
    sqliteErrorCode,
    message: classifySqliteMessage(sqliteMessage.message),
  });
}

export function reportOfflineProtectionDiagnostic(
  protectionClass: ProductScanProtectionClass,
  error: unknown,
): void {
  const sqliteError = sanitizeSqliteError(error);
  const diagnostic = Object.freeze({
    protectionClass,
    sqliteErrorCode: sqliteError.sqliteErrorCode,
    message: sqliteError.message,
  });
  try {
    console.error(JSON.stringify(diagnostic));
  } catch {
    // Diagnostics must never change the fail-closed product state.
  }
}

function extractSqliteMessage(value: string | null): {
  readonly resultCode: string | null;
  readonly message: string | null;
} {
  if (value === null) return { resultCode: null, message: null };
  const bounded = value.slice(0, 4_096).replaceAll('\r\n', '\n');
  const marker = '\n→ Caused by: ';
  const causeIndex = bounded.lastIndexOf(marker);
  const cause = causeIndex === -1 ? bounded : bounded.slice(causeIndex + marker.length);
  const result = /^Error code ([0-9]{1,5}):\s*([\s\S]*)$/u.exec(cause);
  if (result === null || Number(result[1]) > 65_535) {
    return { resultCode: null, message: cause };
  }
  return { resultCode: result[1]!, message: result[2]! };
}

function classifySqliteMessage(value: string | null): string {
  if (value === null) return SQLITE_FALLBACK_MESSAGE;
  const normalized = value.replace(/[\u0000-\u001f\u007f]+/gu, ' ').trim();
  if (normalized === CONFIRMED_SCHEMA_ERROR) return CONFIRMED_SCHEMA_ERROR;
  return SAFE_SQLITE_MESSAGE_CATEGORIES.find(([pattern]) => pattern.test(normalized))?.[1]
    ?? SQLITE_FALLBACK_MESSAGE;
}

function readOwnString(value: unknown, property: string): string | null {
  const candidate = readOwnValue(value, property);
  return typeof candidate === 'string' ? candidate : null;
}

function readOwnValue(value: unknown, property: string): unknown {
  if (
    value === null
    || (typeof value !== 'object' && typeof value !== 'function')
  ) return undefined;
  try {
    return Object.prototype.hasOwnProperty.call(value, property)
      ? Reflect.get(value, property)
      : undefined;
  } catch {
    return undefined;
  }
}

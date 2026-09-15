import { describe, expect, it, vi } from 'vitest';
import {
  reportOfflineProtectionDiagnostic,
  sanitizeSqliteError,
} from '../../src/offline/OfflineCaptureDiagnostic';

describe('Offline capture SQLite diagnostics', () => {
  it('extracts the bundled Android Expo code and underlying schema message', () => {
    const error = Object.assign(new Error(
      "Call to function 'NativeDatabase.execAsync' has been rejected.\n"
      + '→ Caused by: near "generation_state": syntax error',
    ), { code: 'ERR_INTERNAL_SQLITE_ERROR' });

    expect(sanitizeSqliteError(error)).toEqual({
      sqliteErrorCode: 'ERR_INTERNAL_SQLITE_ERROR',
      message: 'near "generation_state": syntax error',
    });
  });

  it('maps free SQL, secrets, database paths, and person data to a closed fallback', () => {
    const sentinel = 'ab'.repeat(32);
    const error = Object.assign(new Error(
      'Call to function \'NativeDatabase.execAsync\' has been rejected.\n'
      + '→ Caused by: SQL logic error while executing '
      + 'SELECT * FROM employees WHERE source = /data/user/0/app/taptime-offline-v1.db '
      + `AND display_name = Alice Smith AND key = ${sentinel}`,
    ), { code: 'ERR_INTERNAL_SQLITE_ERROR' });

    const diagnostic = sanitizeSqliteError(error);
    const rendered = JSON.stringify(diagnostic);
    expect(diagnostic).toEqual({
      sqliteErrorCode: 'ERR_INTERNAL_SQLITE_ERROR',
      message: 'SQLite migration failed',
    });
    expect(rendered).not.toContain(sentinel);
    expect(rendered).not.toContain('SELECT');
    expect(rendered).not.toContain('employees');
    expect(rendered).not.toContain('/data/user');
    expect(rendered).not.toContain('taptime-offline-v1.db');
    expect(rendered).not.toContain('Alice Smith');
  });

  it('keeps a known SQLite category but never its untrusted detail', () => {
    const diagnostic = sanitizeSqliteError(Object.assign(
      new Error('near "Alice Smith": syntax error'),
      { code: 'ERR_INTERNAL_SQLITE_ERROR' },
    ));

    expect(diagnostic).toEqual({
      sqliteErrorCode: 'ERR_INTERNAL_SQLITE_ERROR',
      message: 'syntax error',
    });
    expect(JSON.stringify(diagnostic)).not.toContain('Alice Smith');
  });

  it('logs one JSON value with exactly class, SQLite code, and message', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      reportOfflineProtectionDiagnostic('P04', Object.assign(new Error(
        "Call to function 'NativeDatabase.execAsync' has been rejected.\n"
        + '→ Caused by: near "generation_state": syntax error',
      ), { code: 'ERR_INTERNAL_SQLITE_ERROR' }));
      expect(consoleError).toHaveBeenCalledTimes(1);
      const [serialized] = consoleError.mock.calls[0]!;
      expect(JSON.parse(String(serialized))).toEqual({
        protectionClass: 'P04',
        sqliteErrorCode: 'ERR_INTERNAL_SQLITE_ERROR',
        message: 'near "generation_state": syntax error',
      });
    } finally {
      consoleError.mockRestore();
    }
  });
});

import { describe, expect, it, vi } from 'vitest';
import {
  closePoolAndDropTestDatabase,
  type TestDatabaseInstallerPool,
} from './support/postgresTestDatabaseCleanup.mjs';

describe('PostgreSQL test-database cleanup', () => {
  it('waits for the exact database to reach zero sessions before dropping it without FORCE', async () => {
    const events: string[] = [];
    const sessionCounts = [1, 0];
    const targetPool = {
      end: vi.fn(async () => {
        events.push('pool:end');
      }),
    };
    const installerPool: TestDatabaseInstallerPool = {
      query: vi.fn(async (text, values) => {
        if (text.includes('pg_stat_activity')) {
          events.push(`sessions:${sessionCounts[0]}`);
          return { rows: [{ session_count: sessionCounts.shift() }] };
        }
        events.push('database:drop');
        return { rows: [] };
      }),
    };

    await closePoolAndDropTestDatabase({
      targetPool,
      installerPool,
      databaseName: 'taptime_cleanup_regression',
      maxChecks: 2,
      delayMs: 0,
      waitForNextCheck: async () => {
        events.push('wait');
      },
    });

    expect(events).toEqual([
      'pool:end',
      'sessions:1',
      'wait',
      'sessions:0',
      'database:drop',
    ]);
    expect(installerPool.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('FROM pg_catalog.pg_stat_activity'),
      ['taptime_cleanup_regression'],
    );
    expect(installerPool.query).toHaveBeenLastCalledWith(
      'DROP DATABASE "taptime_cleanup_regression"',
    );
    expect(installerPool.query).not.toHaveBeenCalledWith(expect.stringContaining('FORCE'));
  });

  it('fails closed without dropping when sessions remain at the bounded deadline', async () => {
    const targetPool = { end: vi.fn(async () => undefined) };
    const installerPool: TestDatabaseInstallerPool = {
      query: vi.fn(async () => ({ rows: [{ session_count: 1 }] })),
    };

    await expect(closePoolAndDropTestDatabase({
      targetPool,
      installerPool,
      databaseName: 'taptime_cleanup_regression',
      maxChecks: 2,
      delayMs: 0,
      waitForNextCheck: async () => undefined,
    })).rejects.toThrow('did not drain within the bounded cleanup window');

    expect(targetPool.end).toHaveBeenCalledOnce();
    expect(installerPool.query).toHaveBeenCalledTimes(2);
    expect(installerPool.query).not.toHaveBeenCalledWith(expect.stringContaining('DROP DATABASE'));
  });
});

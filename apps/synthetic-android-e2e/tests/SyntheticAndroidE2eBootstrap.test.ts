import { describe, expect, it, vi } from 'vitest';

const bootstrapSpies = vi.hoisted(() => ({
  authCreate: vi.fn(),
  poolCreate: vi.fn(),
}));

vi.mock('pg', () => ({
  Pool: class {
    constructor(options: unknown) {
      bootstrapSpies.poolCreate(options);
    }
  },
}));

vi.mock('../src/SyntheticLocalAuthServer.js', () => ({
  SyntheticLocalAuthServer: {
    create: bootstrapSpies.authCreate,
  },
}));

import {
  SYNTHETIC_DATABASE_NAME,
  createSyntheticAndroidE2eEnvironment,
} from '../src/index.js';

describe('synthetic environment fail-closed database bootstrap', () => {
  it.each([
    ['remote host', `postgresql://installer:test@db.example/${SYNTHETIC_DATABASE_NAME}`],
    ['hostname alias', `postgresql://installer:test@localhost/${SYNTHETIC_DATABASE_NAME}`],
    ['wrong database', 'postgresql://installer:test@127.0.0.1/postgres'],
    ['malformed URL', 'not-a-database-url'],
  ])('rejects %s before Auth creation, Pool creation, or any listener', async (_name, url) => {
    bootstrapSpies.authCreate.mockClear();
    bootstrapSpies.poolCreate.mockClear();

    await expect(createSyntheticAndroidE2eEnvironment({
      installerDatabaseUrl: url,
      password: '0'.repeat(64),
    })).rejects.toThrow(/database URL|numeric-loopback/u);

    expect(bootstrapSpies.authCreate).not.toHaveBeenCalled();
    expect(bootstrapSpies.poolCreate).not.toHaveBeenCalled();
  });
});

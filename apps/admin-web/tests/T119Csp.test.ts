// @vitest-environment node
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('T119 allows only the build-configured Supabase origin in every auth CSP', () => {
  const eas = JSON.parse(readFileSync(new URL('../../mobile/eas.json', import.meta.url), 'utf8'));
  const origin = new URL(eas.build['production-validation'].env.EXPO_PUBLIC_SUPABASE_URL).origin;
  const caddy = readFileSync(new URL('../../../infrastructure/caddy/Caddyfile', import.meta.url), 'utf8');
  const policies = [...caddy.matchAll(/Content-Security-Policy "([^"]+)"/g)]
    .map((match) => match[1]!).filter((policy) => policy.includes('supabase.co'));
  expect(policies.length).toBeGreaterThan(0);
  for (const policy of policies) {
    const connect = policy.split(';').map((part) => part.trim())
      .find((part) => part.startsWith('connect-src '));
    expect(connect?.split(/\s+/).slice(1)).toEqual(["'self'", origin]);
  }
  expect(caddy).not.toContain('*.supabase.co');
});

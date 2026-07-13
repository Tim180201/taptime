import { createSessionApiRuntime } from './runtime.js';

const databaseUrl = requiredEnvironmentValue('TAPTIME_DATABASE_URL');
const supabaseIssuer = requiredEnvironmentValue('SUPABASE_ISSUER');
const port = parsePort(process.env.PORT ?? '3000');
const runtime = createSessionApiRuntime({ databaseUrl, supabaseIssuer });

runtime.server.listen(port, '0.0.0.0');

let shuttingDown = false;
async function shutdown(): Promise<void> {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  try {
    await runtime.close();
  } finally {
    process.exitCode = 0;
  }
}

process.once('SIGINT', () => void shutdown());
process.once('SIGTERM', () => void shutdown());
runtime.server.once('error', () => {
  process.stderr.write('TapTim.e session API failed to start\n');
  void shutdown().finally(() => {
    process.exitCode = 1;
  });
});

function requiredEnvironmentValue(name: 'SUPABASE_ISSUER' | 'TAPTIME_DATABASE_URL'): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new Error(`Required C1 runtime environment variable is missing: ${name}`);
  }
  return value;
}

function parsePort(value: string): number {
  if (!/^\d{1,5}$/.test(value)) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }
  const port = Number(value);
  if (port < 1 || port > 65_535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }
  return port;
}

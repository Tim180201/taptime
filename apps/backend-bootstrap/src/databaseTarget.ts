import { X509Certificate } from 'node:crypto';
import { isAbsolute } from 'node:path';
import { createSecureContext } from 'node:tls';
import { openSecureRegularFile } from './secureFile.js';

export type BootstrapDatabaseTarget =
  | {
      readonly mode: 'loopback-test';
      readonly host: string;
      readonly port: number;
      readonly database: string;
      readonly ssl: false;
    }
  | {
      readonly mode: 'remote';
      readonly host: string;
      readonly port: number;
      readonly database: string;
      readonly ssl: {
        readonly ca: string;
        readonly rejectUnauthorized: true;
        readonly servername: string;
        readonly minVersion: 'TLSv1.2';
      };
    };

export interface BootstrapTargetProfile {
  readonly version: 1;
  readonly supabaseIssuer: string;
  readonly database: BootstrapDatabaseTarget;
}

interface RawProfile {
  readonly version?: unknown;
  readonly supabaseIssuer?: unknown;
  readonly database?: {
    readonly mode?: unknown;
    readonly host?: unknown;
    readonly port?: unknown;
    readonly name?: unknown;
    readonly rootCaPath?: unknown;
  };
}

export interface RemoteDatabaseProfileFields {
  readonly mode: 'remote';
  readonly host: string;
  readonly port: number;
  readonly name: string;
  readonly rootCaPath: string;
}

const numericLoopbackV4 = /^127(?:\.\d{1,3}){3}$/;
const databaseNamePattern = /^[a-z][a-z0-9_]{0,62}$/;

export async function loadBootstrapTargetProfile(path: string): Promise<BootstrapTargetProfile> {
  if (!isAbsolute(path)) {
    throw new Error('invalid_profile');
  }
  const profileFile = await openSecureRegularFile(path, false);
  let source: string;
  try {
    source = await profileFile.readBounded(65_536);
  } finally {
    await profileFile.close();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(source) as unknown;
  } catch {
    throw new Error('invalid_profile');
  }
  if (!hasExactKeys(parsed, ['version', 'supabaseIssuer', 'database'])) {
    throw new Error('invalid_profile');
  }
  const raw = parsed as RawProfile;
  if (
    raw.version !== 1
    || typeof raw.supabaseIssuer !== 'string'
    || !isRecord(raw.database)
    || (raw.database.mode !== 'loopback-test' && raw.database.mode !== 'remote')
    || typeof raw.database.host !== 'string'
    || !Number.isInteger(raw.database.port)
    || (raw.database.port as number) < 1
    || (raw.database.port as number) > 65_535
    || typeof raw.database.name !== 'string'
    || !databaseNamePattern.test(raw.database.name)
  ) {
    throw new Error('invalid_profile');
  }
  const databaseKeys = raw.database.mode === 'remote'
    ? ['mode', 'host', 'port', 'name', 'rootCaPath']
    : ['mode', 'host', 'port', 'name'];
  if (!hasExactKeys(raw.database, databaseKeys)) {
    throw new Error('invalid_profile');
  }

  const issuer = canonicalIssuer(raw.supabaseIssuer, raw.database.mode);
  if (raw.database.mode === 'loopback-test') {
    if (!isNumericLoopback(raw.database.host) || raw.database.rootCaPath !== undefined) {
      throw new Error('invalid_profile');
    }
    return Object.freeze({
      version: 1,
      supabaseIssuer: issuer,
      database: Object.freeze({
        mode: 'loopback-test',
        host: raw.database.host === '[::1]' ? '::1' : raw.database.host,
        port: raw.database.port as number,
        database: raw.database.name,
        ssl: false,
      }),
    });
  }

  const remoteFields = raw.database as RemoteDatabaseProfileFields;
  validateRemoteDatabaseProfile(remoteFields, profileFile.uid);
  const rootCaFile = await openSecureRegularFile(remoteFields.rootCaPath, true);
  let rootCa: string;
  try {
    rootCa = await rootCaFile.readBounded(65_536);
  } finally {
    await rootCaFile.close();
  }
  return Object.freeze({
    version: 1,
    supabaseIssuer: issuer,
    database: buildRemoteDatabaseTarget(remoteFields, profileFile.uid, rootCa),
  });
}

export function buildRemoteDatabaseTarget(
  profile: RemoteDatabaseProfileFields,
  profileUid: number,
  rootCa: string,
): BootstrapDatabaseTarget {
  validateRemoteDatabaseProfile(profile, profileUid);
  if (!rootCa.includes('-----BEGIN CERTIFICATE-----')) {
    throw new Error('invalid_profile');
  }
  try {
    const certificate = new X509Certificate(rootCa);
    if (!certificate.ca) {
      throw new Error('invalid_profile');
    }
    createSecureContext({ ca: rootCa, minVersion: 'TLSv1.2' });
  } catch {
    throw new Error('invalid_profile');
  }
  return Object.freeze({
    mode: 'remote',
    host: profile.host,
    port: profile.port,
    database: profile.name,
    ssl: Object.freeze({
      ca: rootCa,
      rejectUnauthorized: true,
      servername: profile.host,
      minVersion: 'TLSv1.2',
    }),
  });
}

export function copyValidatedBootstrapDatabaseTarget(target: BootstrapDatabaseTarget): BootstrapDatabaseTarget {
  if (
    target === null
    || typeof target !== 'object'
    || !hasExactKeys(target, ['mode', 'host', 'port', 'database', 'ssl'])
    || typeof target.host !== 'string'
    || !Number.isInteger(target.port)
    || target.port < 1
    || target.port > 65_535
    || typeof target.database !== 'string'
    || !databaseNamePattern.test(target.database)
  ) {
    throw new Error('invalid_database_target');
  }
  if (target.mode === 'loopback-test') {
    if (target.ssl !== false || target.host === '[::1]' || !isNumericLoopback(target.host)) {
      throw new Error('invalid_database_target');
    }
    return Object.freeze({
      mode: 'loopback-test',
      host: target.host,
      port: target.port,
      database: target.database,
      ssl: false,
    });
  }
  if (
    target.mode !== 'remote'
    || !isRemoteDnsHostname(target.host)
    || !hasExactKeys(target.ssl, ['ca', 'rejectUnauthorized', 'servername', 'minVersion'])
    || typeof target.ssl.ca !== 'string'
    || target.ssl.rejectUnauthorized !== true
    || target.ssl.servername !== target.host
    || target.ssl.minVersion !== 'TLSv1.2'
  ) {
    throw new Error('invalid_database_target');
  }
  try {
    const certificate = new X509Certificate(target.ssl.ca);
    if (!certificate.ca) {
      throw new Error('invalid_database_target');
    }
    createSecureContext({ ca: target.ssl.ca, minVersion: 'TLSv1.2' });
  } catch {
    throw new Error('invalid_database_target');
  }
  return Object.freeze({
    mode: 'remote',
    host: target.host,
    port: target.port,
    database: target.database,
    ssl: Object.freeze({
      ca: target.ssl.ca,
      rejectUnauthorized: true,
      servername: target.host,
      minVersion: 'TLSv1.2',
    }),
  });
}

function validateRemoteDatabaseProfile(profile: RemoteDatabaseProfileFields, profileUid: number): void {
  if (
    profileUid !== 0
    || profile.mode !== 'remote'
    || !isRemoteDnsHostname(profile.host)
    || !Number.isInteger(profile.port)
    || profile.port < 1
    || profile.port > 65_535
    || !databaseNamePattern.test(profile.name)
    || typeof profile.rootCaPath !== 'string'
    || !isAbsolute(profile.rootCaPath)
  ) {
    throw new Error('invalid_profile');
  }
}

export function assertNoAmbientSecretConfiguration(
  environment: Readonly<Record<string, string | undefined>>,
): void {
  const forbiddenExact = new Set([
    'DATABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'TAPTIME_BOOTSTRAP_ACCESS_TOKEN',
    'TAPTIME_BOOTSTRAP_DATABASE_PASSWORD',
  ]);
  if (Object.keys(environment).some((name) => name.startsWith('PG') || forbiddenExact.has(name))) {
    throw new Error('ambient_secret_configuration_rejected');
  }
}

export function assertOperatorPrincipal(value: string): void {
  if (!/^taptime_bootstrap_operator_[a-z0-9]{12,36}$/.test(value)) {
    throw new Error('invalid_operator_principal');
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(value: unknown, expectedKeys: readonly string[]): boolean {
  if (!isRecord(value)) {
    return false;
  }
  const actualKeys = Object.keys(value);
  return actualKeys.length === expectedKeys.length
    && expectedKeys.every((key) => Object.hasOwn(value, key));
}

function canonicalIssuer(value: string, mode: 'loopback-test' | 'remote'): string {
  let issuer: URL;
  try {
    issuer = new URL(value);
  } catch {
    throw new Error('invalid_profile');
  }
  if (
    issuer.username.length > 0
    || issuer.password.length > 0
    || issuer.search.length > 0
    || issuer.hash.length > 0
  ) {
    throw new Error('invalid_profile');
  }
  if (
    (mode === 'remote' && issuer.protocol !== 'https:')
    || (mode === 'loopback-test'
      && !(issuer.protocol === 'https:' || (issuer.protocol === 'http:' && isNumericLoopback(issuer.hostname))))
  ) {
    throw new Error('invalid_profile');
  }
  return issuer.href.replace(/\/+$/, '');
}

function isNumericLoopback(host: string): boolean {
  if (host === '::1' || host === '[::1]') {
    return true;
  }
  if (!numericLoopbackV4.test(host)) {
    return false;
  }
  return host.split('.').every((octet) => Number(octet) <= 255);
}

function isRemoteDnsHostname(host: string): boolean {
  return host === host.toLowerCase()
    && host.length <= 253
    && host.includes('.')
    && !host.endsWith('.')
    && host !== 'localhost'
    && !/^\d+(?:\.\d+){3}$/.test(host)
    && host.split('.').every((label) => (
      /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)
    ));
}

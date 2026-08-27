#!/usr/bin/env node

import { readFile } from 'node:fs/promises';

const VERSION_PATTERN = /^[0-9a-f]{7}$/;
const ADMIN_WEB_TAG_PREFIX = 'admin-web-';

function fail(message) {
  throw new Error(message);
}

function flattenVersions(value) {
  if (!Array.isArray(value)) {
    fail('GHCR versions response must be an array.');
  }
  return value.flatMap((entry) => (Array.isArray(entry) ? flattenVersions(entry) : [entry]));
}

function validateProtectedVersions(value) {
  if (value?.schema_version !== 1) {
    fail('Protected-version snapshot has an unsupported schema.');
  }
  if (!VERSION_PATTERN.test(value.current_version ?? '')) {
    fail('Protected-version snapshot has no valid current version.');
  }
  if (!VERSION_PATTERN.test(value.previous_version ?? '')) {
    fail('Protected-version snapshot has no valid previous version.');
  }
  if (!Array.isArray(value.known_versions) || value.known_versions.length === 0) {
    fail('Protected-version snapshot has no known versions.');
  }
  for (const version of value.known_versions) {
    if (!VERSION_PATTERN.test(version)) {
      fail(`Protected-version snapshot contains invalid version ${String(version)}.`);
    }
  }
  const protectedVersions = new Set(value.known_versions);
  if (!protectedVersions.has(value.current_version) || !protectedVersions.has(value.previous_version)) {
    fail('Current and previous versions must both be present in known_versions.');
  }
  return protectedVersions;
}

export function selectGhcrDeletions(snapshot, response, keepNewest) {
  if (!Number.isSafeInteger(keepNewest) || keepNewest < 0 || keepNewest > 20) {
    fail('keepNewest must be an integer from zero through twenty.');
  }
  const protectedVersions = validateProtectedVersions(snapshot);
  const versions = flattenVersions(response);
  const seenIds = new Set();
  for (const version of versions) {
    if ((typeof version?.id !== 'number' && typeof version?.id !== 'string') ||
        Number.isNaN(Date.parse(version?.created_at ?? ''))) {
      fail('GHCR versions response contains an invalid package version.');
    }
    if (seenIds.has(String(version.id))) {
      fail(`GHCR versions response contains duplicate id ${String(version.id)}.`);
    }
    seenIds.add(String(version.id));
  }

  versions.sort((left, right) => {
    const byDate = Date.parse(right.created_at) - Date.parse(left.created_at);
    return byDate || String(right.id).localeCompare(String(left.id));
  });

  const newestIds = new Set(versions.slice(0, keepNewest).map((version) => String(version.id)));
  return versions.filter((version) => {
    if (newestIds.has(String(version.id))) {
      return false;
    }
    const tags = version?.metadata?.container?.tags;
    if (!Array.isArray(tags)) {
      fail(`GHCR package version ${String(version.id)} has no container tag list.`);
    }
    return !tags.some((tag) => protectedVersions.has(tag) || (
      tag.startsWith(ADMIN_WEB_TAG_PREFIX) &&
      protectedVersions.has(tag.slice(ADMIN_WEB_TAG_PREFIX.length))
    ));
  });
}

async function main() {
  if (process.argv.length !== 5) {
    fail('Usage: select-ghcr-deletions.mjs <protected.json> <versions.json> <keep-newest>');
  }
  const snapshot = JSON.parse(await readFile(process.argv[2], 'utf8'));
  const response = JSON.parse(await readFile(process.argv[3], 'utf8'));
  const deletions = selectGhcrDeletions(snapshot, response, Number(process.argv[4]));
  for (const version of deletions) {
    process.stdout.write(`${String(version.id)}\n`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    process.stderr.write(`ERROR: ${error.message}\n`);
    process.exitCode = 1;
  });
}

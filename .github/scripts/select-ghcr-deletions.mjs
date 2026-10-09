#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { DIGEST_PATTERN, GhcrHttpError, manifestParts } from './ghcr-manifests.mjs';

const VERSION_PATTERN = /^[0-9a-f]{7}$/;
const WEB_TAG_PREFIXES = ['admin-web-', 'operator-web-', 'landing-web-'];
const OPERATIONS_TAG_PREFIX = 'operations-';
const OPERATIONS_SHORTCUT_TAG = 'ops';

function fail(message) {
  throw new Error(message);
}

export function flattenVersions(value) {
  if (!Array.isArray(value)) {
    fail('GHCR versions response must be an array.');
  }
  return value.flatMap((entry) => (Array.isArray(entry) ? flattenVersions(entry) : [entry]));
}

export function validateProtectedVersions(value) {
  if (value?.schema_version !== 1) {
    fail('Protected-version snapshot has an unsupported schema.');
  }
  if (!VERSION_PATTERN.test(value.current_version ?? '')) {
    fail('Protected-version snapshot has no valid current version.');
  }
  if (!VERSION_PATTERN.test(value.previous_version ?? '')) {
    fail('Protected-version snapshot has no valid previous version.');
  }
  if (value.operations_version !== undefined &&
      !VERSION_PATTERN.test(value.operations_version ?? '')) {
    fail('Protected-version snapshot has an invalid operations version.');
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
  return {
    applicationVersions: protectedVersions,
    operationsVersion: value.operations_version,
  };
}

export function isProtectedVersion(snapshot, version) {
  const { applicationVersions, operationsVersion } = validateProtectedVersions(snapshot);
  return version.metadata.container.tags.some(tag => tag === OPERATIONS_SHORTCUT_TAG || applicationVersions.has(tag) ||
    WEB_TAG_PREFIXES.some(prefix => tag.startsWith(prefix) && applicationVersions.has(tag.slice(prefix.length))) ||
    (operationsVersion !== undefined && tag === `${OPERATIONS_TAG_PREFIX}${operationsVersion}`));
}

function sortedVersions(snapshot, response, keepNewest) {
  if (!Number.isSafeInteger(keepNewest) || keepNewest < 0 || keepNewest > 20) {
    fail('keepNewest must be an integer from zero through twenty.');
  }
  validateProtectedVersions(snapshot);
  const versions = flattenVersions(response);
  const seenIds = new Set();
  for (const version of versions) {
    if (!/^[1-9][0-9]*$/.test(String(version?.id)) ||
        !DIGEST_PATTERN.test(version?.name ?? '') ||
        Number.isNaN(Date.parse(version?.created_at ?? ''))) {
      fail('GHCR versions response contains an invalid package version.');
    }
    if (seenIds.has(String(version.id))) {
      fail(`GHCR versions response contains duplicate id ${String(version.id)}.`);
    }
    seenIds.add(String(version.id));
    const tags = version?.metadata?.container?.tags;
    if (!Array.isArray(tags) || tags.some(tag => typeof tag !== 'string' || !/^[\w][\w.-]{0,127}$/.test(tag))) {
      fail('GHCR package version has an invalid container tag list.');
    }
  }

  versions.sort((left, right) => {
    const byDate = Date.parse(right.created_at) - Date.parse(left.created_at);
    return byDate || String(right.id).localeCompare(String(left.id));
  });
  return versions;
}

// These roots need verification even when an incomplete graph prevents cleanup.
// Reading their children recursively does not require inspecting obsolete orphans.
export function selectGhcrVerificationRoots(snapshot, response, keepNewest = 20) {
  const strictSnapshot = { ...snapshot, known_versions: [snapshot.current_version, snapshot.previous_version] };
  return sortedVersions(snapshot, response, keepNewest)
    .filter((version, index) => index < keepNewest || isProtectedVersion(strictSnapshot, version));
}

export async function validateProtectedInventory(snapshot, versions, registry) {
  const listedTags = new Set(versions.flatMap(version => version.metadata.container.tags));
  const tags = new Set(snapshot.known_versions.flatMap(version =>
    [version, ...WEB_TAG_PREFIXES.map(prefix => `${prefix}${version}`)]));
  tags.add(OPERATIONS_SHORTCUT_TAG);
  if (snapshot.operations_version) tags.add(`${OPERATIONS_TAG_PREFIX}${snapshot.operations_version}`);
  for (const tag of tags) {
    if (listedTags.has(tag)) continue;
    try {
      await registry.readManifest(tag);
    } catch (error) {
      // Older releases may predate a web image. A real absent tag has no parent
      // whose children could be deleted; every other lookup failure is uncertain.
      if (error instanceof GhcrHttpError && error.status === 404) continue;
      throw error;
    }
    fail(`GHCR inventory is incomplete: existing protected tag ${tag} is not listed.`);
  }
}

export class ProtectedManifestMissingError extends Error {}

export function selectGhcrDeletions(snapshot, response, keepNewest, manifests = {}) {
  const versions = sortedVersions(snapshot, response, keepNewest);

  // Validate the complete graph before planning any mutation. Unknown/missing manifests
  // cannot be assumed to be leaf images, even when they currently have no tags.
  const children = new Map();
  const visiting = new Set();
  const ordered = [];
  function visit(digest) {
    if (visiting.has(digest)) fail('Cyclic manifest graph.');
    if (children.has(digest)) return;
    visiting.add(digest);
    // null is evidence of HTTP 404, not an inferred leaf. Missing dictionary
    // entries, malformed manifests and unreadable inventory roots remain fatal.
    const references = manifests[digest] === null ? [] : manifestParts(manifests[digest]).manifests.map(value => value.digest);
    for (const child of references) visit(child);
    visiting.delete(digest);
    children.set(digest, references);
    ordered.push(digest);
  }
  for (const version of versions) {
    if (manifests[version.name] === null) fail('Listed package manifest is missing.');
    visit(version.name);
  }

  const strict = new Set();
  function checkStrict(digest) {
    if (strict.has(digest)) return;
    strict.add(digest);
    if (manifests[digest] === null) throw new ProtectedManifestMissingError(`Protected manifest ${digest} is missing (404).`);
    for (const child of children.get(digest)) checkStrict(child);
  }
  for (const version of selectGhcrVerificationRoots(snapshot, versions, keepNewest)) checkStrict(version.name);

  const retained = new Set();
  function retain(digest) {
    if (retained.has(digest)) return;
    retained.add(digest);
    for (const child of children.get(digest)) retain(child);
  }
  for (const [index, version] of versions.entries()) {
    if (index < keepNewest || isProtectedVersion(snapshot, version)) retain(version.name);
  }
  // Parents precede children: an interrupted deletion never leaves a surviving index
  // pointing at a child removed earlier in this run.
  const byDigest = new Map();
  for (const version of versions) {
    if (byDigest.has(version.name)) fail('Duplicate package manifest digest.');
    byDigest.set(version.name, version);
  }
  // A referenced index absent from the package inventory cannot be deleted here.
  // Its children must therefore survive even if its own parent is obsolete.
  for (const digest of children.keys()) if (!byDigest.has(digest)) retain(digest);
  return ordered.reverse().flatMap(digest => {
    if (retained.has(digest) || !byDigest.has(digest)) {
      return [];
    }
    return [byDigest.get(digest)];
  });
}

export function knownMissingChildren(snapshot, versions, manifests) {
  const missing = new Set();
  const affected = new Set();
  for (const release of snapshot.known_versions) {
    if (release === snapshot.current_version || release === snapshot.previous_version) continue;
    const tags = new Set([release, ...WEB_TAG_PREFIXES.map(prefix => `${prefix}${release}`)]);
    const visited = new Set();
    function visit(digest) {
      if (visited.has(digest)) return;
      visited.add(digest);
      if (manifests[digest] === null) {
        missing.add(digest);
        affected.add(release);
        return;
      }
      for (const child of manifestParts(manifests[digest]).manifests) visit(child.digest);
    }
    for (const version of versions) {
      if (version.metadata.container.tags.some(tag => tags.has(tag))) visit(version.name);
    }
  }
  return { count: missing.size, versions: [...affected].sort() };
}

async function main() {
  if (process.argv.length !== 6) {
    fail('Usage: select-ghcr-deletions.mjs <protected.json> <versions.json> <keep-newest> <manifests.json>');
  }
  const snapshot = JSON.parse(await readFile(process.argv[2], 'utf8'));
  const response = JSON.parse(await readFile(process.argv[3], 'utf8'));
  const manifests = JSON.parse(await readFile(process.argv[5], 'utf8'));
  const deletions = selectGhcrDeletions(snapshot, response, Number(process.argv[4]), manifests);
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

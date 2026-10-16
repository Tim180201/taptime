import { execFile } from 'node:child_process';
import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { isDeepStrictEqual, promisify } from 'node:util';
import { collectManifests, createGhcrRegistry, GhcrHttpError, verifyProtectedImages } from './ghcr-manifests.mjs';
import { flattenVersions, KEEP_NEWEST_RELEASES, knownMissingChildren, ProtectedManifestMissingError, selectGhcrDeletions, selectGhcrVerificationRoots, validateProtectedInventory, validateProtectedVersions } from './select-ghcr-deletions.mjs';

const execute = promisify(execFile);

// Shared by the workflow and read-only previews; this function has no mutation port.
export async function planGhcrCleanup({ snapshot, listVersions, registry, warn, keepReleases = KEEP_NEWEST_RELEASES }) {
  let versions;
  let protectedVersions;
  let deletions;
  let missingKnown;
  let strictVerified = false;
  try {
    validateProtectedVersions(snapshot);
    versions = flattenVersions(await listVersions());
    protectedVersions = selectGhcrVerificationRoots(snapshot, versions, keepReleases);
    // Missing strict content (including configs/layers and required tags absent
    // from the inventory) is fatal before the first deletion, not only afterwards.
    await verifyProtectedImages(snapshot, protectedVersions, registry);
    strictVerified = true;
    await validateProtectedInventory(snapshot, versions, registry, keepReleases);
    const manifests = await collectManifests(versions, registry.readManifest);
    deletions = selectGhcrDeletions(snapshot, versions, keepReleases, manifests);
    missingKnown = knownMissingChildren(snapshot, versions, manifests);
  } catch (error) {
    if (error instanceof ProtectedManifestMissingError) throw error;
    // A 404 encountered during strict verification must not become a green skip.
    if (!strictVerified && error instanceof GhcrHttpError && error.status === 404) throw error;
    await warn(`GHCR cleanup skipped: ${error.message}`);
    return { skipped: true };
  }
  if (missingKnown.count) {
    await warn(`GHCR older known/reserved versions: ${missingKnown.count} missing child manifests (404); retained releases: ${missingKnown.versions.join(', ')}.`);
  }
  const deletedIds = new Set(deletions.map(version => version.id));
  return { skipped: false, snapshot, protectedVersions, deletions,
    retainedVersions: versions.filter(version => !deletedIds.has(version.id)), deleted: deletions.length };
}

export async function cleanupGhcr({ snapshot, listVersions, registry, deleteVersion, warn, readSnapshot, keepReleases = KEEP_NEWEST_RELEASES, beforeDelete = async (_plan) => {} }) {
  const plan = await planGhcrCleanup({ snapshot, listVersions, registry, warn, keepReleases });
  if (plan.skipped) return plan;
  await beforeDelete(plan);
  // Check after verification, planning and durable diagnostics, immediately before
  // mutation. Any uncertainty or content change cancels the entire deletion plan.
  try {
    const latest = await readSnapshot();
    validateProtectedVersions(latest);
    if (!isDeepStrictEqual(snapshot, latest)) throw new Error('production protection changed before deletion');
  } catch (error) {
    await warn(`GHCR cleanup skipped: ${error.message}`);
    return { ...plan, skipped: true, deleted: 0 };
  }
  // Mutation failures are not converted into a successful skip.
  for (const version of plan.deletions) await deleteVersion(version.id, version);
  return plan;
}

async function main() {
  const mode = process.argv[2];
  const owner = process.env.PACKAGE_OWNER;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9-]*$/.test(owner ?? '')) throw new Error('Invalid package owner.');
  const registry = createGhcrRegistry(`${owner.toLowerCase()}/taptime-backend-api`);
  const planPath = join(process.env.RUNNER_TEMP, 'ghcr-retained.json');
  const snapshotPath = join(process.env.RUNNER_TEMP, 'ghcr-protected-versions.json');
  const api = `/users/${owner}/packages/container/taptime-backend-api/versions`;
  const listVersions = async () => JSON.parse((await execute('gh', ['api', '--paginate', '--slurp', `${api}?per_page=100`],
    { maxBuffer: 20 * 1024 * 1024 })).stdout);
  const summary = message => appendFile(process.env.GITHUB_STEP_SUMMARY, `${message}\n`);
  const warn = async message => {
    const line = message.replace(/[\r\n]/g, ' ');
    process.stdout.write(`::warning::${line}\n`);
    await summary(line);
  };
  if (mode === 'verify') {
    let plan;
    try {
      plan = JSON.parse(await readFile(planPath, 'utf8'));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      // Cleanup can stop before producing a plan. Verify production tags and the
      // retained roots independently; verification failures must remain fatal.
      const snapshot = JSON.parse(await readFile(snapshotPath, 'utf8'));
      validateProtectedVersions(snapshot);
      plan = { snapshot, protectedVersions: selectGhcrVerificationRoots(snapshot, await listVersions()) };
    }
    validateProtectedVersions(plan.snapshot);
    await verifyProtectedImages(plan.snapshot, plan.protectedVersions, registry);
    await summary('Protected images verified: all indices, child manifests, configs and layers downloaded and checked by digest/size.');
    return;
  }
  if (mode !== 'cleanup') throw new Error('Usage: clean-ghcr.mjs cleanup|verify');
  let snapshot;
  try {
    snapshot = JSON.parse(await readFile(snapshotPath, 'utf8'));
  } catch {
    await warn('GHCR cleanup skipped: production protection is not valid JSON. Images were published.');
    await appendFile(process.env.GITHUB_OUTPUT, 'performed=false\n');
    return;
  }
  const result = await cleanupGhcr({ snapshot, registry, warn,
    readSnapshot: async () => {
      await summary(`Second protection query: ${new Date().toISOString()}`);
      const response = await fetch('https://admin.tb-infra.de/status/ghcr-protected-versions.json', {
        headers: { 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new Error(`second protection query failed (${response.status})`);
      const latest = await response.json();
      await summary(`Second protection snapshot:\n\n\`\`\`json\n${JSON.stringify(latest, null, 2)}\n\`\`\``);
      return latest;
    },
    beforeDelete: async plan => {
      await writeFile(planPath, JSON.stringify(plan));
      await summary(`Deletion plan (id, digest, tags):\n\n\`\`\`json\n${JSON.stringify(plan.deletions.map(({ id, name, metadata }) => ({ id, digest: name, tags: metadata.container.tags })), null, 2)}\n\`\`\``);
    },
    listVersions,
    deleteVersion: async (id, version) => {
      process.stdout.write(`Deleting obsolete unprotected GHCR package version ${id}: digest=${version.name} tags=${JSON.stringify(version.metadata.container.tags)}.\n`);
      await execute('gh', ['api', '--method', 'DELETE', `${api}/${id}`]);
    },
  });
  if (!result.skipped) {
    await appendFile(process.env.GITHUB_OUTPUT, 'performed=true\n');
    await summary(`GHCR cleanup removed ${result.deleted} obsolete package versions.`);
  } else {
    await appendFile(process.env.GITHUB_OUTPUT, 'performed=false\n');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => { process.stderr.write(`ERROR: ${error.message}\n`); process.exitCode = 1; });
}

import { execFile } from 'node:child_process';
import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { collectManifests, createGhcrRegistry, verifyProtectedImages } from './ghcr-manifests.mjs';
import { flattenVersions, selectGhcrDeletions, validateProtectedVersions } from './select-ghcr-deletions.mjs';

const execute = promisify(execFile);

export async function cleanupGhcr({ snapshot, listVersions, registry, deleteVersion, warn, keepNewest = 20, beforeDelete = async (_plan) => {} }) {
  let versions;
  let deletions;
  try {
    validateProtectedVersions(snapshot);
    versions = flattenVersions(await listVersions());
    const manifests = await collectManifests(versions, registry.readManifest);
    deletions = selectGhcrDeletions(snapshot, versions, keepNewest, manifests);
  } catch (error) {
    await warn(`GHCR cleanup skipped: ${error.message}`);
    return { skipped: true };
  }
  const deletedIds = new Set(deletions.map(version => version.id));
  const plan = { skipped: false, snapshot, protectedVersions: versions.filter(version => !deletedIds.has(version.id)), deleted: deletions.length };
  await beforeDelete(plan);
  // Mutation failures are not converted into a successful skip.
  for (const version of deletions) await deleteVersion(version.id);
  return plan;
}

async function main() {
  const mode = process.argv[2];
  const owner = process.env.PACKAGE_OWNER;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9-]*$/.test(owner ?? '')) throw new Error('Invalid package owner.');
  const registry = createGhcrRegistry(`${owner.toLowerCase()}/taptime-backend-api`);
  const planPath = join(process.env.RUNNER_TEMP, 'ghcr-retained.json');
  const summary = message => appendFile(process.env.GITHUB_STEP_SUMMARY, `${message}\n`);
  const warn = async message => {
    const line = message.replace(/[\r\n]/g, ' ');
    process.stdout.write(`::warning::${line}\n`);
    await summary(line);
  };
  if (mode === 'verify') {
    const plan = JSON.parse(await readFile(planPath, 'utf8'));
    await verifyProtectedImages(plan.snapshot, plan.protectedVersions, registry);
    await summary('Protected images verified: all indices, child manifests, configs and layers downloaded and checked by digest/size.');
    return;
  }
  if (mode !== 'cleanup') throw new Error('Usage: clean-ghcr.mjs cleanup|verify');
  let snapshot;
  try {
    snapshot = JSON.parse(await readFile(join(process.env.RUNNER_TEMP, 'ghcr-protected-versions.json'), 'utf8'));
  } catch {
    await warn('GHCR cleanup skipped: production protection is not valid JSON. Images were published.');
    await appendFile(process.env.GITHUB_OUTPUT, 'performed=false\n');
    return;
  }
  const api = `/users/${owner}/packages/container/taptime-backend-api/versions`;
  const result = await cleanupGhcr({ snapshot, registry, warn,
    beforeDelete: async plan => {
      await writeFile(planPath, JSON.stringify(plan));
      await appendFile(process.env.GITHUB_OUTPUT, 'performed=true\n');
    },
    listVersions: async () => JSON.parse((await execute('gh', ['api', '--paginate', '--slurp', `${api}?per_page=100`],
      { maxBuffer: 20 * 1024 * 1024 })).stdout),
    deleteVersion: async id => {
      process.stdout.write(`Deleting obsolete unprotected GHCR package version ${id}.\n`);
      await execute('gh', ['api', '--method', 'DELETE', `${api}/${id}`]);
    },
  });
  if (!result.skipped) {
    await summary(`GHCR cleanup removed ${result.deleted} obsolete package versions.`);
  } else {
    await appendFile(process.env.GITHUB_OUTPUT, 'performed=false\n');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => { process.stderr.write(`ERROR: ${error.message}\n`); process.exitCode = 1; });
}

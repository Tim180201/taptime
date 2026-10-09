import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { cleanupGhcr } from './clean-ghcr.mjs';
import { createGhcrRegistry, GhcrHttpError, verifyProtectedImages } from './ghcr-manifests.mjs';
import { selectGhcrDeletions, selectGhcrVerificationRoots } from './select-ghcr-deletions.mjs';

const snapshot = { schema_version: 1, current_version: 'aaaaaaa', previous_version: 'aaaaaaa', known_versions: ['aaaaaaa'] };
const imageType = 'application/vnd.oci.image.manifest.v1+json';
const indexType = 'application/vnd.oci.image.index.v1+json';
const configType = 'application/vnd.oci.image.config.v1+json';
const layerType = 'application/vnd.oci.image.layer.v1.tar+gzip';
const hash = bytes => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

// OCI Distribution fixtures use actual JSON bytes, content digests and descriptor sizes.
// A fake transport is the only replacement: the production parser/downloader runs unchanged.
function fixture() {
  const blobs = new Map();
  const manifests = new Map();
  const tags = new Map();
  const calls = [];
  function blob(bytes, mediaType) {
    const value = Buffer.from(bytes);
    const digest = hash(value);
    blobs.set(digest, value);
    return { digest, size: value.length, mediaType };
  }
  function manifest(value, tag) {
    const bytes = Buffer.from(JSON.stringify(value));
    const digest = hash(bytes);
    manifests.set(digest, bytes);
    if (tag) tags.set(tag, digest);
    return { digest, size: bytes.length, mediaType: value.mediaType };
  }
  const config = blob(JSON.stringify({ config: { Labels: {} } }), configType);
  const layer = blob('compressed layer fixture', layerType);
  const leaf = manifest({ schemaVersion: 2, mediaType: imageType, config, layers: [layer] });
  const attestation = manifest({ schemaVersion: 2, mediaType: imageType, config, layers: [blob('SBOM', 'application/vnd.in-toto+json')] });
  const root = manifest({ schemaVersion: 2, mediaType: indexType, manifests: [leaf, attestation] }, 'aaaaaaa');
  tags.set('admin-web-aaaaaaa', root.digest);
  tags.set('ops', root.digest);
  const orphan = manifest({ schemaVersion: 2, mediaType: imageType, config, layers: [blob('obsolete', layerType)] });
  const versions = [root, leaf, attestation, orphan].map((descriptor, index) => ({
    id: index + 1, name: descriptor.digest, created_at: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
    metadata: { container: { tags: index === 0 ? ['aaaaaaa', 'admin-web-aaaaaaa', 'ops'] : [] } },
  }));
  const fetcher = async (url, options) => {
    calls.push(url);
    assert.ok(options.signal, 'every request has a deadline');
    if (url.startsWith('https://ghcr.io/token?')) return Response.json({ token: 'public-pull-token' });
    assert.equal(options.headers.Authorization, 'Bearer public-pull-token');
    const [, kind, reference] = new URL(url).pathname.match(/^\/v2\/owner\/taptime-backend-api\/(manifests|blobs)\/(.+)$/);
    const digest = tags.get(reference) ?? reference;
    const bytes = (kind === 'manifests' ? manifests : blobs).get(digest);
    return new Response(bytes ?? null, { status: bytes ? 200 : 404,
      headers: kind === 'manifests' && bytes ? { 'docker-content-digest': digest } : {} });
  };
  return { blobs, manifests, tags, calls, versions, leaf, root, layer, config, attestation, orphan, manifest, blob, fetcher,
    registry: () => createGhcrRegistry('owner/taptime-backend-api', fetcher) };
}

// Run the real CLI with local transport fixtures only. No inherited GitHub credentials
// or network access: gh accepts exactly the read-only inventory command; fetch rejects
// every URL other than the fixture's public pull endpoint and manifest/blob paths.
function verifyCli(f, protection = snapshot, plan = undefined) {
  const root = mkdtempSync(join(tmpdir(), 't098b-verify-'));
  try {
    const data = join(root, 'registry.json');
    writeFileSync(data, JSON.stringify({
      manifests: [...f.manifests].map(([key, bytes]) => [key, bytes.toString('base64')]),
      blobs: [...f.blobs].map(([key, bytes]) => [key, bytes.toString('base64')]), tags: [...f.tags],
    }));
    writeFileSync(join(root, 'versions.json'), JSON.stringify([f.versions]));
    writeFileSync(join(root, 'ghcr-protected-versions.json'), JSON.stringify(protection));
    if (plan !== undefined) writeFileSync(join(root, 'ghcr-retained.json'), JSON.stringify(plan));
    const preload = join(root, 'transport.mjs');
    writeFileSync(preload, `
      import assert from 'node:assert/strict';
      import { appendFileSync, readFileSync } from 'node:fs';
      const data = JSON.parse(readFileSync(process.env.REGISTRY_FIXTURE, 'utf8'));
      globalThis.fetch = async (url, options) => {
        assert.equal(options.method ?? 'GET', 'GET');
        appendFileSync(process.env.REQUEST_LOG, url + '\\n');
        if (url === 'https://ghcr.io/token?service=ghcr.io&scope=repository:owner/taptime-backend-api:pull') {
          return Response.json({ token: 'fixture-only' });
        }
        const match = url.match(/^https:\\/\\/ghcr.io\\/v2\\/owner\\/taptime-backend-api\\/(manifests|blobs)\\/(.+)$/);
        assert.ok(match, 'unexpected network request: ' + url);
        const [, kind, reference] = match;
        const digest = new Map(data.tags).get(reference) ?? reference;
        const encoded = new Map(data[kind]).get(digest);
        return new Response(encoded === undefined ? null : Buffer.from(encoded, 'base64'), {
          status: encoded === undefined ? 404 : 200,
          headers: kind === 'manifests' && encoded !== undefined ? { 'docker-content-digest': digest } : {},
        });
      };
    `);
    mkdirSync(join(root, 'bin'));
    writeFileSync(join(root, 'bin/gh'), `#!/usr/bin/env node
      const assert = require('node:assert/strict');
      const fs = require('node:fs');
      assert.deepEqual(process.argv.slice(2), ['api', '--paginate', '--slurp',
        '/users/owner/packages/container/taptime-backend-api/versions?per_page=100']);
      fs.appendFileSync(process.env.REQUEST_LOG, 'inventory GET\\n');
      process.stdout.write(fs.readFileSync(process.env.VERSIONS_FIXTURE));
    `, { mode: 0o755 });
    const summary = join(root, 'summary');
    const requests = join(root, 'requests');
    const result = spawnSync(process.execPath, ['--import', preload, resolve('.github/scripts/clean-ghcr.mjs'), 'verify'], {
      encoding: 'utf8', timeout: 10_000, env: {
        PATH: `${join(root, 'bin')}:${process.env.PATH}`, PACKAGE_OWNER: 'owner', RUNNER_TEMP: root,
        GITHUB_STEP_SUMMARY: summary, REGISTRY_FIXTURE: data, REQUEST_LOG: requests,
        VERSIONS_FIXTURE: join(root, 'versions.json'),
      },
    });
    return { ...result, summary: existsSync(summary) ? readFileSync(summary, 'utf8') : '',
      requests: existsSync(requests) ? readFileSync(requests, 'utf8') : '' };
  } finally { rmSync(root, { recursive: true, force: true }); }
}

test('verification CLI works without a cleanup plan and still checks retained images and full blobs', () => {
  const f = fixture();
  const result = verifyCli(f);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.summary, /Protected images verified/);
  for (const descriptor of [f.root, f.leaf, f.attestation, f.orphan]) {
    assert.ok(result.requests.includes(`/manifests/${descriptor.digest}`), descriptor.digest);
  }
  for (const descriptor of [f.config, f.layer]) assert.ok(result.requests.includes(`/blobs/${descriptor.digest}`));
});

test('verification CLI fails loudly on missing protected content even without a cleanup plan', () => {
  for (const missing of ['index', 'platform', 'attestation', 'config', 'layer', 'tag', 'retained']) {
    const f = fixture();
    if (missing === 'index') {
      f.manifests.delete(f.root.digest);
      f.versions.shift(); // Missing inventory entries must not hide required production tags.
    }
    if (missing === 'platform') f.manifests.delete(f.leaf.digest);
    if (missing === 'attestation') f.manifests.delete(f.attestation.digest);
    if (missing === 'config') f.blobs.delete(f.config.digest);
    if (missing === 'layer') f.blobs.delete(f.layer.digest);
    if (missing === 'tag') f.tags.delete('admin-web-aaaaaaa');
    if (missing === 'retained') f.manifests.delete(f.orphan.digest);
    const result = verifyCli(f);
    assert.equal(result.status, 1, missing);
    assert.match(result.stderr, /ERROR: GHCR .+ failed \(404\)/, `${missing}: ${result.stderr}`);
    assert.doesNotMatch(result.summary, /Protected images verified/);
  }
});

test('verification after skipped cleanup ignores a missing obsolete orphan but checks protected roots', async () => {
  const f = fixture();
  for (let index = 0; index < 20; index++) {
    const value = f.manifest({ schemaVersion: 2, mediaType: indexType, manifests: [f.leaf], annotations: { release: String(index) } });
    f.versions.push({ id: index + 5, name: value.digest, created_at: new Date(Date.UTC(2027, 0, index + 1)).toISOString(),
      metadata: { container: { tags: [] } } });
  }
  f.manifests.delete(f.orphan.digest);
  const cleanup = await cleanupGhcr({ snapshot, listVersions: async () => f.versions, registry: f.registry(),
    deleteVersion: () => assert.fail('no deletion with an incomplete graph'), warn: () => {},
  });
  assert.equal(cleanup.skipped, true);
  const result = verifyCli(f);
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.requests.includes('/manifests/aaaaaaa'), 'production still checked outside newest retention');
  assert.ok(!result.requests.includes(`/manifests/${f.orphan.digest}`), 'obsolete orphan is not protected');
  f.versions.find(version => version.name === f.orphan.digest).metadata.container.tags = ['ops'];
  const protectedOps = verifyCli(f);
  assert.equal(protectedOps.status, 1, 'the ops shortcut stays protected even outside newest retention');
  assert.match(protectedOps.stderr, /404/);
});

test('verification CLI rejects invalid protection and corrupt saved plans instead of reporting success', () => {
  const f = fixture();
  const invalidProtection = verifyCli(f, { ...snapshot, schema_version: 0 });
  assert.equal(invalidProtection.status, 1);
  assert.match(invalidProtection.stderr, /Protected-version snapshot/);
  assert.equal(invalidProtection.requests, '', 'validate protection before accessing the registry');
  const invalidPlan = verifyCli(f, snapshot, {});
  assert.equal(invalidPlan.status, 1);
  assert.match(invalidPlan.stderr, /Protected-version snapshot/);
  assert.equal(invalidPlan.requests, '', 'a corrupt plan is not silently replaced');
});

test('verification CLI still uses the saved retained set after partial cleanup failure', () => {
  const f = fixture();
  const plan = { snapshot, protectedVersions: f.versions.slice(0, 3) };
  f.manifests.delete(f.orphan.digest);
  const result = verifyCli(f, snapshot, plan);
  assert.equal(result.status, 0, result.stderr);
  assert.ok(!result.requests.includes('inventory GET'), 'saved pre-deletion retention plan stays authoritative');
  f.blobs.delete(f.layer.digest);
  const broken = verifyCli(f, snapshot, plan);
  assert.equal(broken.status, 1);
  assert.match(broken.stderr, /404/);
});

test('cleanup and fresh verification retain Buildx image and attestation children; only orphan is removed', async () => {
  const f = fixture();
  const deleted = [];
  const plan = await cleanupGhcr({ snapshot, listVersions: async () => [f.versions], registry: f.registry(), keepNewest: 0,
    deleteVersion: async id => { deleted.push(id); f.manifests.delete(f.versions.find(value => value.id === id).name); },
    warn: message => assert.fail(message),
  });
  assert.deepEqual(deleted, [4]);
  const before = f.calls.length;
  await verifyProtectedImages(snapshot, plan.protectedVersions, f.registry());
  const after = f.calls.slice(before);
  for (const descriptor of [f.leaf, f.attestation]) assert.ok(after.some(url => url.endsWith(`/manifests/${descriptor.digest}`)));
  for (const descriptor of [f.layer, f.config]) {
    assert.ok(after.some(url => url.endsWith(`/blobs/${descriptor.digest}`)), 'full GET includes configs and layers');
  }
});

test('uncertain protection, package inventory or manifest graph skips all deletion', async () => {
  for (const failure of ['snapshot', 'inventory', 'schema', 'digest']) {
    const f = fixture();
    if (failure === 'schema') {
      const unknown = f.manifest({ schemaVersion: 2, mediaType: 'application/unknown', manifests: [f.leaf] });
      f.versions.push({ ...f.versions[0], id: 5, name: unknown.digest });
    }
    if (failure === 'digest') f.manifests.set(f.root.digest, Buffer.from('{}'));
    const warnings = [];
    const result = await cleanupGhcr({ snapshot: failure === 'snapshot' ? {} : snapshot,
      listVersions: async () => { if (failure === 'inventory') throw new Error('inventory unavailable'); return f.versions; },
      registry: f.registry(), keepNewest: 0, warn: message => warnings.push(message),
      deleteVersion: () => assert.fail('no deletion on uncertainty'),
    });
    assert.equal(result.skipped, true, failure);
    assert.match(warnings.join('\n'), /cleanup skipped/);
  }
});

test('verification detects missing children, unavailable or corrupt layers and missing protected tags', async () => {
  for (const failure of ['child', 'layer', 'corrupt-layer', 'tag', 'optional-web']) {
    const f = fixture();
    if (failure === 'child') f.manifests.delete(f.attestation.digest);
    if (failure === 'layer') f.blobs.delete(f.layer.digest);
    if (failure === 'corrupt-layer') f.blobs.set(f.layer.digest, Buffer.from('X'.repeat(f.layer.size)));
    if (failure === 'tag') f.tags.delete('admin-web-aaaaaaa');
    if (failure === 'optional-web') {
      const config = f.blob(JSON.stringify({ config: { Labels: { 'io.taptime.landing-web': 'true' } } }), configType);
      f.manifest({ schemaVersion: 2, mediaType: imageType, config, layers: [] }, 'aaaaaaa');
    }
    await assert.rejects(verifyProtectedImages(snapshot, f.versions.slice(0, 1), f.registry()), /404|digest\/size/, failure);
  }
});

test('newest retained indices and unlisted nested indices protect their children', () => {
  const f = fixture();
  const records = Object.fromEntries([...f.manifests].map(([key, value]) => [key, JSON.parse(value)]));
  const changed = f.versions.map(value => ({ ...value, metadata: { container: { tags: [] } } }));
  changed[0].created_at = new Date(Date.UTC(2027, 0, 1)).toISOString();
  assert.deepEqual(selectGhcrDeletions(snapshot, changed, 1, records).map(value => value.id), [4]);
  const nested = f.manifest({ schemaVersion: 2, mediaType: indexType, manifests: [f.leaf] });
  const parent = f.manifest({ schemaVersion: 2, mediaType: indexType, manifests: [nested] });
  records[nested.digest] = JSON.parse(f.manifests.get(nested.digest));
  records[parent.digest] = JSON.parse(f.manifests.get(parent.digest));
  const versions = [ { ...changed[0], name: parent.digest }, changed[1] ];
  assert.deepEqual(selectGhcrDeletions(snapshot, versions, 0, records).map(value => value.id), [1],
    'nested index cannot be deleted without a package version id, so its child survives');
});

test('deletion failure stays red and verification data is prepared before the first mutation', async () => {
  const f = fixture();
  let plan;
  await assert.rejects(cleanupGhcr({ snapshot, listVersions: async () => f.versions, registry: f.registry(), keepNewest: 0,
    beforeDelete: async value => { plan = value; }, warn: message => assert.fail(message),
    deleteVersion: async () => { assert.ok(plan.protectedVersions.length); throw new Error('DELETE denied'); },
  }), /DELETE denied/);
});

function addIndex(f, tag, children, id, date = '2025-01-01T00:00:00.000Z') {
  for (const version of f.versions) version.metadata.container.tags = version.metadata.container.tags.filter(value => value !== tag);
  const value = f.manifest({ schemaVersion: 2, mediaType: indexType, manifests: children, annotations: { release: tag } }, tag);
  f.versions.push({ id, name: value.digest, created_at: date, metadata: { container: { tags: [tag] } } });
  return value;
}

function missingChild(f, label) {
  const value = f.manifest({ schemaVersion: 2, mediaType: imageType, config: f.config, layers: [], annotations: { missing: label } });
  f.manifests.delete(value.digest);
  return value;
}

test('T-098c: obsolete parent with a 404 child is deleted before its existing exclusive children', async () => {
  const f = fixture();
  addIndex(f, 'bbbbbbb', [missingChild(f, 'obsolete'), f.orphan, f.leaf], 5);
  const deleted = [];
  const result = await cleanupGhcr({ snapshot, listVersions: async () => f.versions, registry: f.registry(), keepNewest: 0,
    warn: message => assert.fail(message), deleteVersion: async id => { deleted.push(id); },
  });
  assert.equal(result.skipped, false);
  assert.deepEqual(deleted, [5, 4], 'obsolete parent precedes its child; shared protected child remains');
});

test('T-098c: missing strict content fails before any deletion for current, previous, operations, ops and newest', async t => {
  for (const category of ['current', 'previous', 'operations', 'ops', 'newest', 'shared-known', 'platform', 'attestation', 'config', 'layer', 'required-tag']) {
    await t.test(category, async () => {
      const f = fixture();
      let protection = snapshot;
      const missing = missingChild(f, category);
      let keepNewest = 0;
      if (category === 'current') addIndex(f, 'aaaaaaa', [missing], 5);
      if (category === 'previous') {
        protection = { ...snapshot, previous_version: 'bbbbbbb', known_versions: ['aaaaaaa', 'bbbbbbb'] };
        addIndex(f, 'bbbbbbb', [missing], 5);
      }
      if (category === 'operations') {
        protection = { ...snapshot, operations_version: 'bbbbbbb' };
        addIndex(f, 'operations-bbbbbbb', [missing], 5);
      }
      if (category === 'ops') addIndex(f, 'ops', [missing], 5);
      if (category === 'newest' || category === 'shared-known') {
        const tag = category === 'shared-known' ? 'bbbbbbb' : 'ccccccc';
        if (category === 'shared-known') protection = { ...snapshot, known_versions: ['aaaaaaa', 'bbbbbbb'] };
        addIndex(f, tag, [missing], 5, '2027-01-01T00:00:00.000Z');
        keepNewest = 1;
      }
      if (category === 'platform') f.manifests.delete(f.leaf.digest);
      if (category === 'attestation') f.manifests.delete(f.attestation.digest);
      if (category === 'config') f.blobs.delete(f.config.digest);
      if (category === 'layer') f.blobs.delete(f.layer.digest);
      if (category === 'required-tag') f.tags.delete('admin-web-aaaaaaa');
      let deleted = 0;
      await assert.rejects(cleanupGhcr({ snapshot: protection, listVersions: async () => f.versions,
        registry: f.registry(), keepNewest, warn: () => {}, deleteVersion: async () => { deleted++; },
      }), /404/, category);
      assert.equal(deleted, 0, category);
    });
  }
});

test('T-098c: older known missing children produce one counted warning, retain indices and existing children', async () => {
  const f = fixture();
  const first = missingChild(f, 'first');
  const second = missingChild(f, 'second');
  addIndex(f, 'bbbbbbb', [first, f.orphan, f.leaf], 5);
  addIndex(f, 'admin-web-bbbbbbb', [first, second], 6);
  addIndex(f, 'ccccccc', [second], 7);
  const protection = { ...snapshot, known_versions: ['aaaaaaa', 'bbbbbbb', 'ccccccc'] };
  const original = structuredClone(protection);
  const warnings = [];
  const result = await cleanupGhcr({ snapshot: protection, listVersions: async () => f.versions,
    registry: f.registry(), keepNewest: 0, warn: message => warnings.push(message),
    deleteVersion: () => assert.fail('all listed manifests belong to a retained root'),
  });
  assert.equal(result.skipped, false);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /2.*bbbbbbb.*ccccccc/);
  assert.doesNotMatch(warnings[0], /skipped/);
  assert.deepEqual(protection, original, 'known_versions must stay intact');
  await verifyProtectedImages(protection, result.protectedVersions, f.registry());
  const strictIds = selectGhcrVerificationRoots(protection, f.versions, 0).map(value => value.id);
  assert.deepEqual(strictIds, [1], 'older known roots are retained but not strict');
});

test('T-098c: verification fallback tolerates older known child gaps while retaining strict latest roots', () => {
  const f = fixture();
  addIndex(f, 'bbbbbbb', [missingChild(f, 'historical')], 5);
  // The old root must fall outside the newest twenty package versions.
  for (let index = 0; index < 20; index++) addIndex(f, `recent-${index}`, [f.leaf], index + 6, new Date(Date.UTC(2027, 0, index + 1)).toISOString());
  const protection = { ...snapshot, known_versions: ['aaaaaaa', 'bbbbbbb'] };
  const result = verifyCli(f, protection);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.summary, /Protected images verified/);
  f.tags.delete('ops');
  const broken = verifyCli(f, protection);
  assert.equal(broken.status, 1, 'ops must be fetched even when absent from the inventory');
  assert.match(broken.stderr, /manifests\/ops.*404/);
});

test('T-098c: only a real manifest HTTP 404 is tolerable; subsequent non-404 or timeout skips cleanup', async () => {
  for (const status of [401, 403, 429, 500, 503, 'timeout']) {
    const f = fixture();
    const missing = missingChild(f, 'ordinary404');
    const failed = missingChild(f, 'transport');
    addIndex(f, 'bbbbbbb', [missing, failed], 5);
    const registry = createGhcrRegistry('owner/taptime-backend-api', async (url, options) => {
      if (url.endsWith(`/manifests/${failed.digest}`)) {
        if (typeof status !== 'number') throw new Error('fixture timeout');
        return new Response(null, { status });
      }
      return f.fetcher(url, options);
    });
    if (typeof status === 'number') await assert.rejects(registry.readManifest(failed.digest), error => error instanceof GhcrHttpError && error.status === status,
      'HTTP status must remain structured; a message mentioning 404 is not sufficient');
    const warnings = [];
    const result = await cleanupGhcr({ snapshot, listVersions: async () => f.versions, registry, keepNewest: 0,
      warn: message => warnings.push(message), deleteVersion: () => assert.fail('uncertain graph must never delete'),
    });
    assert.equal(result.skipped, true);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], new RegExp(`cleanup skipped:.*${status}`));
  }
});

test('T-098c review: incomplete inventory cannot delete children of an omitted protected parent', async t => {
  for (const category of ['current', 'previous', 'operations', 'ops', 'known', 'known-web']) {
    await t.test(category, async () => {
      const f = fixture();
      let protection = snapshot;
      if (category === 'current') f.versions.shift();
      else {
        let tag = 'bbbbbbb';
        if (category === 'previous') protection = { ...snapshot, previous_version: tag, known_versions: ['aaaaaaa', tag] };
        if (category === 'operations') { protection = { ...snapshot, operations_version: tag }; tag = `operations-${tag}`; }
        if (category === 'ops') tag = 'ops';
        if (category.startsWith('known')) {
          protection = { ...snapshot, known_versions: ['aaaaaaa', tag] };
          if (category === 'known-web') tag = `landing-web-${tag}`;
        }
        // The image and tag exist in GHCR, but a truncated API listing omitted
        // their package row. Its old, untagged child is still listed.
        addIndex(f, tag, [f.orphan], 5);
        f.versions.pop();
        if (category === 'previous') f.tags.set('admin-web-bbbbbbb', f.tags.get(tag));
      }
      const warnings = [];
      const deleted = [];
      const result = await cleanupGhcr({ snapshot: protection, listVersions: async () => f.versions, registry: f.registry(), keepNewest: 0,
        warn: message => warnings.push(message), deleteVersion: async id => { deleted.push(id); },
      });
      assert.equal(result.skipped, true);
      assert.deepEqual(deleted, []);
      assert.equal(warnings.length, 1);
      assert.match(warnings[0], /cleanup skipped:.*inventory.*incomplete/i);
    });
  }
});

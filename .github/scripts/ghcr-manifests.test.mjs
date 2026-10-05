import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { cleanupGhcr } from './clean-ghcr.mjs';
import { createGhcrRegistry, verifyProtectedImages } from './ghcr-manifests.mjs';
import { selectGhcrDeletions } from './select-ghcr-deletions.mjs';

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
  const orphan = manifest({ schemaVersion: 2, mediaType: imageType, config, layers: [blob('obsolete', layerType)] });
  const versions = [root, leaf, attestation, orphan].map((descriptor, index) => ({
    id: index + 1, name: descriptor.digest, created_at: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
    metadata: { container: { tags: index === 0 ? ['aaaaaaa', 'admin-web-aaaaaaa'] : [] } },
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
  return { blobs, manifests, tags, calls, versions, leaf, root, layer, config, attestation, orphan, manifest, blob,
    registry: () => createGhcrRegistry('owner/taptime-backend-api', fetcher) };
}

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
  for (const failure of ['snapshot', 'inventory', 'manifest', 'schema', 'digest']) {
    const f = fixture();
    if (failure === 'manifest') f.manifests.delete(f.leaf.digest);
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

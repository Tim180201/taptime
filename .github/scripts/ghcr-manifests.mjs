import { createHash } from 'node:crypto';

// Maintained with the release workflow; removed with GHCR publication.
const INDEX_TYPES = ['application/vnd.oci.image.index.v1+json', 'application/vnd.docker.distribution.manifest.list.v2+json'];
const IMAGE_TYPES = ['application/vnd.oci.image.manifest.v1+json', 'application/vnd.docker.distribution.manifest.v2+json'];
export const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;
const digestOf = bytes => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

export class GhcrHttpError extends Error {
  constructor(path, status) {
    super(`GHCR ${path} failed (${status}).`);
    this.path = path;
    this.status = status;
  }
}

function descriptor(value) {
  if (!DIGEST_PATTERN.test(value?.digest ?? '') || !Number.isSafeInteger(value.size) || value.size < 0 ||
      typeof value.mediaType !== 'string' || !value.mediaType) {
    throw new Error('Invalid manifest descriptor; refusing cleanup.');
  }
  return value;
}

export function manifestParts(manifest) {
  if (manifest?.schemaVersion !== 2) throw new Error('Unsupported manifest schema.');
  let manifests = [];
  let blobs = [];
  if (INDEX_TYPES.includes(manifest.mediaType)) {
    if (!Array.isArray(manifest.manifests)) throw new Error('Invalid index manifests.');
    manifests = manifest.manifests.map(descriptor);
  } else if (IMAGE_TYPES.includes(manifest.mediaType)) {
    if (!Array.isArray(manifest.layers)) throw new Error('Invalid manifest layers.');
    blobs = [descriptor(manifest.config), ...manifest.layers.map(descriptor)];
  } else {
    throw new Error('Unknown manifest type; refusing cleanup.');
  }
  if (manifest.subject !== undefined) manifests = [...manifests, descriptor(manifest.subject)];
  return { manifests, blobs };
}

export async function collectManifests(versions, readManifest) {
  const manifests = {};
  const roots = new Set(versions.map(version => version.name));
  const pending = new Set(roots);
  while (pending.size) {
    const batch = [...pending].slice(0, 8);
    for (const digest of batch) {
      if (!DIGEST_PATTERN.test(digest ?? '')) throw new Error('Package version has no valid manifest digest.');
      pending.delete(digest);
    }
    await Promise.all(batch.map(async digest => {
      try {
        manifests[digest] = await readManifest(digest);
      } catch (error) {
        // Only an absent referenced child is a known gap. An unreadable listed
        // package root still makes the inventory/graph uncertain.
        if (!(error instanceof GhcrHttpError) || error.status !== 404 || roots.has(digest)) throw error;
        manifests[digest] = null;
      }
    }));
    for (const digest of batch) {
      if (manifests[digest] === null) continue;
      for (const child of manifestParts(manifests[digest]).manifests) {
        if (!Object.hasOwn(manifests, child.digest)) pending.add(child.digest);
      }
    }
  }
  return manifests;
}

// Public GHCR images are deliberately verified anonymously, as the deploy host pulls them.
// OCI Distribution: GET manifests/<reference> and GET blobs/<digest>; no Docker cache.
export function createGhcrRegistry(repository, fetcher = fetch) {
  if (!/^[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*$/.test(repository)) throw new Error('Invalid GHCR repository.');
  let token;
  async function request(path, accept) {
    if (!token) {
      const response = await fetcher(`https://ghcr.io/token?service=ghcr.io&scope=repository:${repository}:pull`,
        { signal: AbortSignal.timeout(15_000) });
      if (!response.ok) throw new Error(`GHCR token request failed (${response.status}).`);
      token = (await response.json()).token;
      if (typeof token !== 'string' || !token) throw new Error('Missing GHCR pull token.');
    }
    const response = await fetcher(`https://ghcr.io/v2/${repository}/${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: accept }, signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) throw new GhcrHttpError(path, response.status);
    return response;
  }
  return {
    async readManifest(reference, expected) {
      if (!DIGEST_PATTERN.test(reference) && !/^[\w][\w.-]{0,127}$/.test(reference)) throw new Error('Invalid manifest reference.');
      const response = await request(`manifests/${reference}`, [...INDEX_TYPES, ...IMAGE_TYPES].join(', '));
      const bytes = Buffer.from(await response.arrayBuffer());
      const digest = digestOf(bytes);
      const header = response.headers.get('docker-content-digest');
      if ((DIGEST_PATTERN.test(reference) && digest !== reference) || (header && digest !== header) ||
          (expected && (expected.digest !== digest || expected.size !== bytes.length))) {
        throw new Error('Manifest content does not match its digest/size.');
      }
      const manifest = JSON.parse(bytes.toString('utf8'));
      manifestParts(manifest);
      if (expected && expected.mediaType !== manifest.mediaType) throw new Error('Manifest type differs from descriptor.');
      return manifest;
    },
    async readBlob(value, json = false) {
      descriptor(value);
      const response = await request(`blobs/${value.digest}`, 'application/octet-stream');
      const hash = createHash('sha256');
      let size = 0;
      const chunks = [];
      for await (const chunk of response.body) {
        size += chunk.length;
        if (size > value.size) throw new Error('Blob exceeds descriptor size.');
        hash.update(chunk);
        if (json) chunks.push(chunk);
      }
      if (size !== value.size || `sha256:${hash.digest('hex')}` !== value.digest) throw new Error('Blob content does not match its digest/size.');
      return json ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : undefined;
    },
  };
}

export async function verifyProtectedImages(snapshot, protectedVersions, registry) {
  const checkedManifests = new Map();
  const checkedBlobs = new Map();
  async function verify(reference, expected, ancestors = new Set()) {
    if (ancestors.has(reference)) throw new Error('Cyclic manifest graph.');
    if (checkedManifests.has(reference)) return checkedManifests.get(reference);
    const nextAncestors = new Set([...ancestors, reference]);
    const manifest = await registry.readManifest(reference, expected);
    const parts = manifestParts(manifest);
    const capabilities = new Set();
    for (const child of parts.manifests) {
      for (const capability of await verify(child.digest, child, nextAncestors)) capabilities.add(capability);
    }
    for (const blob of parts.blobs) {
      const isConfig = blob === manifest.config;
      if (!checkedBlobs.has(blob.digest)) checkedBlobs.set(blob.digest, await registry.readBlob(blob, isConfig));
      const config = checkedBlobs.get(blob.digest);
      if (isConfig) {
        for (const feature of ['operator-web', 'landing-web']) {
          if (config?.config?.Labels?.[`io.taptime.${feature}`] === 'true') capabilities.add(feature);
        }
      }
    }
    checkedManifests.set(reference, capabilities);
    return capabilities;
  }
  // Require tags implied by the production snapshot, even if missing in the package listing.
  for (const version of new Set([snapshot.current_version, snapshot.previous_version])) {
    const features = await verify(version);
    await verify(`admin-web-${version}`);
    for (const feature of features) await verify(`${feature}-${version}`);
  }
  if (snapshot.operations_version) await verify(`operations-${snapshot.operations_version}`);
  await verify('ops');
  for (const version of protectedVersions) {
    await verify(version.name);
    for (const tag of version.metadata.container.tags) await verify(tag);
  }
}

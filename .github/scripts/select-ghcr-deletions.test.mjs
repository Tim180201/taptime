import assert from 'node:assert/strict';
import test from 'node:test';

import { selectGhcrDeletions } from './select-ghcr-deletions.mjs';

function packageVersion(id, tag, ageInDays) {
  return {
    id,
    name: `sha256:${id.toString(16).padStart(64, '0')}`,
    created_at: new Date(Date.UTC(2026, 7, 25 - ageInDays)).toISOString(),
    metadata: { container: { tags: tag ? [tag] : [] } },
  };
}

function selectLeafVersions(snapshot, versions, keepReleases) {
  const manifests = Object.fromEntries(versions.map(version => [version.name, {
    schemaVersion: 2, mediaType: 'application/vnd.oci.image.manifest.v1+json',
    config: { digest: `sha256:${'f'.repeat(64)}`, size: 2, mediaType: 'application/vnd.oci.image.config.v1+json' }, layers: [],
  }]));
  return selectGhcrDeletions(snapshot, versions, keepReleases, manifests);
}

test('cleanup protects application and independent operations versions outside the newest set', () => {
  const snapshot = {
    schema_version: 1,
    current_version: '8094744',
    previous_version: '7070707',
    operations_version: '4040404',
    known_versions: ['8094744', '7070707', '6060606'],
  };
  const versions = [
    ...Array.from({ length: 11 }, (_, index) => [
      packageVersion(index + 1, `${(0xaaaaaa0 + index).toString(16)}`, index),
      packageVersion(index + 101, `admin-web-${(0xaaaaaa0 + index).toString(16)}`, index),
      packageVersion(index + 201, `operations-${(0xaaaaaa0 + index).toString(16)}`, index),
    ]).flat(),
    packageVersion(80, '6060606', 20),
    packageVersion(87, 'admin-web-6060606', 20),
    packageVersion(88, 'operations-6060606', 20),
    packageVersion(81, '7070707', 21),
    packageVersion(82, '8094744', 22),
    packageVersion(84, 'admin-web-8094744', 22),
    packageVersion(85, 'admin-web-7070707', 21),
    packageVersion(89, 'operations-4040404', 22),
    packageVersion(90, 'operations-7070707', 21),
    packageVersion(93, 'operations-8094744', 22),
    packageVersion(92, 'ops', 23),
    packageVersion(83, '5050505', 23),
    packageVersion(86, 'admin-web-5050505', 23),
    packageVersion(91, 'operations-5050505', 23),
  ];

  const deletions = selectLeafVersions(snapshot, versions, 10);
  const deletedIds = deletions.map(({ id }) => id);

  assert(!deletedIds.includes(82), 'the running image must not be deleted');
  assert(!deletedIds.includes(84), 'the running Admin Web image must not be deleted');
  assert(!deletedIds.includes(81), 'the previous image must not be deleted');
  assert(!deletedIds.includes(85), 'the previous Admin Web image must not be deleted');
  assert(!deletedIds.includes(89), 'the independently selected operations image must not be deleted');
  assert(!deletedIds.includes(92), 'the console shortcut target must not be deleted before it moves');
  assert(!deletedIds.includes(80), 'every known version must be retained');
  assert(!deletedIds.includes(87), 'every known Admin Web version must be retained');
  assert(deletedIds.includes(88), 'an app version does not implicitly protect an operations tag');
  assert(!deletedIds.includes(90), 'the previous application also protects its operations image');
  assert(!deletedIds.includes(93), 'the current application also protects its operations image');
  assert(deletedIds.includes(83), 'an old unknown image should be deleted');
  assert(deletedIds.includes(86), 'an old unknown Admin Web image should be deleted');
  assert(deletedIds.includes(91), 'an old unknown operations image should be deleted');
  process.stdout.write(
    'Proof: app 8094744 and independent operations 4040404 remain protected.\n',
  );
});

test('cleanup fails closed when current or previous is absent from known_versions', () => {
  assert.throws(
    () => selectLeafVersions({
      schema_version: 1,
      current_version: '8094744',
      previous_version: '7070707',
      known_versions: ['8094744'],
    }, [], 10),
    /Current and previous versions must both be present/,
  );
});

test('cleanup accepts the pre-T-028 snapshot but rejects a malformed operations version', () => {
  assert.deepEqual(selectLeafVersions({
    schema_version: 1,
    current_version: '8094744',
    previous_version: '7070707',
    known_versions: ['8094744', '7070707'],
  }, [], 10), []);
  assert.throws(
    () => selectLeafVersions({
      schema_version: 1,
      current_version: '8094744',
      previous_version: '7070707',
      operations_version: 'latest',
      known_versions: ['8094744', '7070707'],
    }, [], 10),
    /invalid operations version/,
  );
});

test('every known operator web image is protected, unknown ones can expire',()=>{
  const known=['aaaaaaa','bbbbbbb','ccccccc'];
  const snapshot={schema_version:1,current_version:known[0],previous_version:known[1],known_versions:known};
  const versions=[...known.map((value,index)=>packageVersion(index+1,`operator-web-${value}`,20)),packageVersion(99,'operator-web-ddddddd',30)];
  assert.deepEqual(selectLeafVersions(snapshot,versions,0).map(value=>value.id),[99]);
});

test('every known landing web image is protected, unknown ones can expire',()=>{
  const known=['aaaaaaa','bbbbbbb','ccccccc'];
  const snapshot={schema_version:1,current_version:known[0],previous_version:known[1],known_versions:known};
  const versions=[...known.map((value,index)=>packageVersion(index+1,`landing-web-${value}`,20)),packageVersion(99,'landing-web-ddddddd',30)];
  assert.deepEqual(selectLeafVersions(snapshot,versions,0).map(value=>value.id),[99]);
});

test('retained indices protect untagged children, nested indices and shared manifests', () => {
  const digest = value => `sha256:${value.repeat(64)}`;
  const version = (id, tag, age, value) => ({ ...packageVersion(id, tag, age), name: digest(value) });
  const child = value => ({ digest: digest(value), size: 10, mediaType: 'application/vnd.oci.image.manifest.v1+json' });
  const index = (...children) => ({ schemaVersion: 2, mediaType: 'application/vnd.oci.image.index.v1+json', manifests: children.map(child) });
  const leaf = { schemaVersion: 2, mediaType: 'application/vnd.oci.image.manifest.v1+json', config: child('f'), layers: [] };
  const versions = [version(1, 'aaaaaaa', 20, 'a'), version(2, '', 20, 'b'), version(3, '', 20, 'c'),
    version(4, 'ddddddd', 30, 'd'), version(5, '', 30, 'e')];
  const manifests = { [digest('a')]: index('b'), [digest('b')]: index('c'), [digest('c')]: leaf,
    [digest('d')]: index('c', 'e'), [digest('e')]: leaf };
  const snapshot = { schema_version: 1, current_version: 'aaaaaaa', previous_version: 'aaaaaaa', known_versions: ['aaaaaaa'] };
  assert.deepEqual(selectGhcrDeletions(snapshot, versions, 0, manifests).map(value => value.id), [4, 5],
    'delete the obsolete parent before its exclusive child, retain shared and nested children');
  assert.throws(() => selectGhcrDeletions(snapshot, versions, 0, { ...manifests, [digest('b')]: undefined }),
    /manifest/i, 'unreadable manifest knowledge must prevent deletion');
});

// Five Buildx outputs per release: each index owns its platform and attestation.
function releaseInventory(releases) {
  const versions = [];
  const manifests = {};
  for (const [age, release] of releases.entries()) {
    for (const prefix of ['', 'admin-web-', 'operator-web-', 'landing-web-', 'operations-']) {
      const root = packageVersion(versions.length + 1, `${prefix}${release}`, age);
      const platform = packageVersion(versions.length + 2, '', age);
      const attestation = packageVersion(versions.length + 3, '', age);
      versions.push(root, platform, attestation);
      manifests[root.name] = {
        schemaVersion: 2, mediaType: 'application/vnd.oci.image.index.v1+json',
        manifests: [platform, attestation].map(child => ({ digest: child.name, size: 10,
          mediaType: 'application/vnd.oci.image.manifest.v1+json' })),
      };
      for (const child of [platform, attestation]) manifests[child.name] = {
        schemaVersion: 2, mediaType: 'application/vnd.oci.image.manifest.v1+json',
        config: { digest: `sha256:${'f'.repeat(64)}`, size: 2, mediaType: 'application/vnd.oci.image.config.v1+json' }, layers: [],
      };
    }
  }
  return { versions, manifests };
}

const incidentSnapshot = { schema_version: 1, current_version: 'd193725', previous_version: 'aaaaaaa',
  operations_version: 'd193725', known_versions: ['d193725', 'aaaaaaa'] };

test('T-131 incident: two newer releases cannot evict any fb28166 image or child', () => {
  const { versions, manifests } = releaseInventory(['df76957', '7e36c58', 'fb28166']);
  // On the old selector 10 meant individual package rows; with T-131 it means releases.
  const deletions = selectGhcrDeletions(incidentSnapshot, versions, 10, manifests);
  assert.deepEqual(deletions, [], 'the entire in-flight release must survive, without being in the snapshot');
});

test('T-131 retains ten complete releases and deletes the unknown eleventh', () => {
  const releases = Array.from({ length: 11 }, (_, i) => (0xbbbbbb0 + i).toString(16));
  const { versions, manifests } = releaseInventory(releases);
  const deletions = selectGhcrDeletions(incidentSnapshot, versions, 10, manifests);
  const oldest = releaseInventory([releases.at(-1)]).versions.length;
  assert.deepEqual(new Set(deletions.map(v => v.id)), new Set(versions.slice(-oldest).map(v => v.id)));
});

test('T-131 pending protects every tag and graph, including operations, outside retention', () => {
  const { versions, manifests } = releaseInventory(['fb28166']);
  assert.deepEqual(selectGhcrDeletions({ ...incidentSnapshot, pending_versions: ['fb28166'] }, versions, 0, manifests), []);
  assert.equal(selectGhcrDeletions(incidentSnapshot, versions, 0, manifests).length, versions.length);
  assert.deepEqual(selectGhcrDeletions({ ...incidentSnapshot, pending_versions: [] }, versions, 0, manifests),
    selectGhcrDeletions(incidentSnapshot, versions, 0, manifests), 'missing pending_versions means empty');
});

test('T-131 release age is first tagged image, ties use release id, independent of inventory order', () => {
  const { versions, manifests } = releaseInventory(['bbbbbbb', 'ccccccc', 'ddddddd']);
  // Equal release dates; a late child or repaired tagged image must not rejuvenate a release.
  for (const version of versions) version.created_at = '2026-01-01T00:00:00Z';
  versions.at(-1).created_at = '2027-01-01T00:00:00Z';
  versions.at(-3).created_at = '2027-01-01T00:00:00Z';
  const retainedIds = new Set(versions.slice(0, versions.length / 3).map(v => v.id));
  const expected = new Set(versions.filter(v => !retainedIds.has(v.id)).map(v => v.id));
  for (const inventory of [versions, [...versions].reverse()]) {
    assert.deepEqual(new Set(selectGhcrDeletions(incidentSnapshot, inventory, 1, manifests).map(v => v.id)), expected);
  }
});

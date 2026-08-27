import assert from 'node:assert/strict';
import test from 'node:test';

import { selectGhcrDeletions } from './select-ghcr-deletions.mjs';

function packageVersion(id, tag, ageInDays) {
  return {
    id,
    created_at: new Date(Date.UTC(2026, 7, 25 - ageInDays)).toISOString(),
    metadata: { container: { tags: tag ? [tag] : [] } },
  };
}

test('cleanup protects both release images outside the newest eighteen package versions', () => {
  const snapshot = {
    schema_version: 1,
    current_version: '8094744',
    previous_version: '7070707',
    known_versions: ['8094744', '7070707', '6060606'],
  };
  const versions = [
    ...Array.from({ length: 11 }, (_, index) => [
      packageVersion(index + 1, `${(0xaaaaaa0 + index).toString(16)}`, index),
      packageVersion(index + 101, `admin-web-${(0xaaaaaa0 + index).toString(16)}`, index),
    ]).flat(),
    packageVersion(80, '6060606', 20),
    packageVersion(87, 'admin-web-6060606', 20),
    packageVersion(81, '7070707', 21),
    packageVersion(82, '8094744', 22),
    packageVersion(84, 'admin-web-8094744', 22),
    packageVersion(85, 'admin-web-7070707', 21),
    packageVersion(83, '5050505', 23),
    packageVersion(86, 'admin-web-5050505', 23),
  ];

  const deletions = selectGhcrDeletions(snapshot, versions, 18);
  const deletedIds = deletions.map(({ id }) => id);

  assert(!deletedIds.includes(82), 'the running image must not be deleted');
  assert(!deletedIds.includes(84), 'the running Admin Web image must not be deleted');
  assert(!deletedIds.includes(81), 'the previous image must not be deleted');
  assert(!deletedIds.includes(85), 'the previous Admin Web image must not be deleted');
  assert(!deletedIds.includes(80), 'every known version must be retained');
  assert(!deletedIds.includes(87), 'every known Admin Web version must be retained');
  assert(deletedIds.includes(83), 'an old unknown image should be deleted');
  assert(deletedIds.includes(86), 'an old unknown Admin Web image should be deleted');
  process.stdout.write(
    'Proof: both running 8094744 images are older than the newest eighteen and remain protected.\n',
  );
});

test('cleanup fails closed when current or previous is absent from known_versions', () => {
  assert.throws(
    () => selectGhcrDeletions({
      schema_version: 1,
      current_version: '8094744',
      previous_version: '7070707',
      known_versions: ['8094744'],
    }, [], 10),
    /Current and previous versions must both be present/,
  );
});

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
    packageVersion(92, 'ops', 23),
    packageVersion(83, '5050505', 23),
    packageVersion(86, 'admin-web-5050505', 23),
    packageVersion(91, 'operations-5050505', 23),
  ];

  const deletions = selectGhcrDeletions(snapshot, versions, 17);
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
  assert(deletedIds.includes(90), 'the previous app does not implicitly protect an operations tag');
  assert(deletedIds.includes(83), 'an old unknown image should be deleted');
  assert(deletedIds.includes(86), 'an old unknown Admin Web image should be deleted');
  assert(deletedIds.includes(91), 'an old unknown operations image should be deleted');
  process.stdout.write(
    'Proof: app 8094744 and independent operations 4040404 remain protected.\n',
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

test('cleanup accepts the pre-T-028 snapshot but rejects a malformed operations version', () => {
  assert.deepEqual(selectGhcrDeletions({
    schema_version: 1,
    current_version: '8094744',
    previous_version: '7070707',
    known_versions: ['8094744', '7070707'],
  }, [], 10), []);
  assert.throws(
    () => selectGhcrDeletions({
      schema_version: 1,
      current_version: '8094744',
      previous_version: '7070707',
      operations_version: 'latest',
      known_versions: ['8094744', '7070707'],
    }, [], 10),
    /invalid operations version/,
  );
});

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

test('cleanup spares running and previous versions even outside the newest ten', () => {
  const snapshot = {
    schema_version: 1,
    current_version: '8094744',
    previous_version: '7070707',
    known_versions: ['8094744', '7070707', '6060606'],
  };
  const versions = [
    ...Array.from({ length: 11 }, (_, index) =>
      packageVersion(index + 1, `${(0xaaaaaa0 + index).toString(16)}`, index)),
    packageVersion(80, '6060606', 20),
    packageVersion(81, '7070707', 21),
    packageVersion(82, '8094744', 22),
    packageVersion(83, '5050505', 23),
  ];

  const deletions = selectGhcrDeletions(snapshot, versions, 9);
  const deletedIds = deletions.map(({ id }) => id);

  assert(!deletedIds.includes(82), 'the running image must not be deleted');
  assert(!deletedIds.includes(81), 'the previous image must not be deleted');
  assert(!deletedIds.includes(80), 'every known version must be retained');
  assert(deletedIds.includes(83), 'an old unknown image should be deleted');
  process.stdout.write(
    'Proof: running 8094744 (id 82) is older than the newest ten and remains protected.\n',
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

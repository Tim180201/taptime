import assert from 'node:assert/strict';
import test from 'node:test';
import { createLayoutShard } from './sharding.mjs';

for (const parts of [1, 2, 3]) {
  test(`layout sharding: every registration appears exactly once with ${parts} parts`, () => {
    // Include unequal part sizes and grow the registry: no fixed suite-size oracle.
    for (let count = parts; count <= parts * 10; count += 1) {
      const numbers = Array.from({ length: count }, (_, number) => number);
      const selections = Array.from({ length: parts }, (_, index) => {
        const shard = createLayoutShard(`${index + 1}/${parts}`);
        const selected = numbers.filter(() => shard.register());
        shard.assertNotEmpty();
        assert.deepEqual(selected, numbers.filter(number => number % parts === index));
        assert.deepEqual(shard.summary(), { part: index + 1, parts, selected: selected.length, total: count });
        return selected;
      });
      assert.deepEqual(selections.flat().sort((a, b) => a - b), numbers);
    }
  });
}

test('without a shard value every registered test is selected', () => {
  const shard = createLayoutShard(undefined);
  for (const name of ['first', 'second', 'third']) assert.equal(shard.register(), true, name);
  shard.assertNotEmpty();
  assert.deepEqual(shard.summary(), { part: 1, parts: 1, selected: 3, total: 3 });
});

test('invalid shard values fail before registration', () => {
  for (const value of ['', '0/3', '1/0', '4/3', '-1/3', '1.5/3', '1', '1/3/2',
    ' 1/3', '1/3\n', '01/3', '1/03', '1/3x', '1/9007199254740992', '9007199254740992/9007199254740992']) {
    assert.throws(() => createLayoutShard(value), /TAPTIME_LAYOUT_SHARD/, JSON.stringify(value));
  }
});

test('empty shards fail after registration, including an empty registry', () => {
  const empty = createLayoutShard('3/3');
  assert.equal(empty.register(), false);
  assert.equal(empty.register(), false);
  assert.throws(() => empty.assertNotEmpty(), /selects no tests \(2 registered\)/);
  assert.throws(() => createLayoutShard(undefined).assertNotEmpty(), /selects no tests \(0 registered\)/);
});

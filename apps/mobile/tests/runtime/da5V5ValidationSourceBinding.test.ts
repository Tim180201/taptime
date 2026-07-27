import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import {
  DA5_V5_VALIDATION_SOURCE_CLOSURE,
} from '../../scripts/da5V5ValidationRuntimeContract.mjs';
import {
  createDa5V5ValidationSourceClosure,
} from '../../scripts/da5V5ValidationSourceBinding.mjs';

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { force: true, recursive: true });
  }
});

describe('DA5 V5 exact source closure', () => {
  it('binds every closed source path byte-equal to its HEAD object', () => {
    const fixture = createFixture();
    const result = createDa5V5ValidationSourceClosure(fixture);
    expect(result.map(({ path }) => path)).toEqual(
      DA5_V5_VALIDATION_SOURCE_CLOSURE,
    );
    expect(result[0]?.sha256).toBe(
      createHash('sha256').update(fixture.contents[0]!).digest('hex'),
    );
  });

  it('rejects a worktree object mismatch before publication', () => {
    const fixture = createFixture();
    const objectIds = fixture.worktreeObjectIds.trim().split('\n');
    objectIds[0] = 'f'.repeat(40);
    expect(() => createDa5V5ValidationSourceClosure({
      ...fixture,
      worktreeObjectIds: `${objectIds.join('\n')}\n`,
    })).toThrow(/differs from HEAD/u);
  });
});

function createFixture() {
  const repositoryRoot = mkdtempSync(
    join(tmpdir(), 'taptime-da5-source-binding-'),
  );
  roots.push(repositoryRoot);
  const contents = DA5_V5_VALIDATION_SOURCE_CLOSURE.map(
    (path, index) => Buffer.from(`${index}:${path}`, 'utf8'),
  );
  const objectIds = contents.map(
    (bytes) => createHash('sha1')
      .update(Buffer.concat([
        Buffer.from(`blob ${bytes.length}\0`, 'utf8'),
        bytes,
      ]))
      .digest('hex'),
  );
  for (
    let index = 0;
    index < DA5_V5_VALIDATION_SOURCE_CLOSURE.length;
    index += 1
  ) {
    const path = join(
      repositoryRoot,
      DA5_V5_VALIDATION_SOURCE_CLOSURE[index]!,
    );
    mkdirSync(join(path, '..'), { recursive: true });
    writeFileSync(path, contents[index]!);
  }
  return {
    contents,
    repositoryRoot,
    treeListing: `${DA5_V5_VALIDATION_SOURCE_CLOSURE.map(
      (path, index) => `100644 blob ${objectIds[index]}\t${path}`,
    ).join('\n')}\n`,
    worktreeObjectIds: `${objectIds.join('\n')}\n`,
  };
}

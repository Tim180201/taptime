import { createHash } from 'node:crypto';
import {
  lstatSync,
  readFileSync,
  realpathSync,
} from 'node:fs';
import { join, relative, sep } from 'node:path';

import {
  DA5_V5_VALIDATION_SOURCE_CLOSURE,
} from './da5V5ValidationRuntimeContract.mjs';

const TREE_LINE =
  /^(100644|100755) blob ([0-9a-f]{40})\t([^\u0000\r\n]+)$/u;

export function createDa5V5ValidationSourceClosure({
  repositoryRoot,
  treeListing,
  worktreeObjectIds,
}) {
  const canonicalRepositoryRoot = realpathSync(repositoryRoot);
  const tree = new Map();
  for (const line of treeListing.trim().split('\n').filter(Boolean)) {
    const match = TREE_LINE.exec(line);
    if (match === null || tree.has(match[3])) {
      throw new Error('DA5 V5 Validation source tree listing mismatch');
    }
    tree.set(match[3], match[2]);
  }
  if (
    tree.size !== DA5_V5_VALIDATION_SOURCE_CLOSURE.length
    || DA5_V5_VALIDATION_SOURCE_CLOSURE.some((path) => !tree.has(path))
  ) {
    throw new Error('DA5 V5 Validation source closure is incomplete');
  }
  const objectIds = worktreeObjectIds.trim().split('\n').filter(Boolean);
  if (
    objectIds.length !== DA5_V5_VALIDATION_SOURCE_CLOSURE.length
    || objectIds.some((value) => !/^[0-9a-f]{40}$/u.test(value))
  ) {
    throw new Error('DA5 V5 Validation worktree binding is unavailable');
  }

  return Object.freeze(DA5_V5_VALIDATION_SOURCE_CLOSURE.map(
    (path, index) => {
      if (objectIds[index] !== tree.get(path)) {
        throw new Error(
          `DA5 V5 Validation source differs from HEAD: ${path}`,
        );
      }
      const sourcePath = join(canonicalRepositoryRoot, path);
      const stat = lstatSync(sourcePath);
      const canonical = realpathSync(sourcePath);
      const delta = relative(canonicalRepositoryRoot, canonical);
      if (
        !stat.isFile()
        || stat.isSymbolicLink()
        || delta === '..'
        || delta.startsWith(`..${sep}`)
      ) {
        throw new Error(
          `DA5 V5 Validation source path is unsafe: ${path}`,
        );
      }
      return Object.freeze({
        path,
        sha256: createHash('sha256')
          .update(readFileSync(sourcePath))
          .digest('hex'),
      });
    },
  ));
}

import { constants, type BigIntStats } from 'node:fs';
import { open, type FileHandle } from 'node:fs/promises';

export interface SecureRegularFile {
  readonly uid: number;
  readBounded(maximumBytes: number): Promise<string>;
  close(): Promise<void>;
}

export async function openSecureRegularFile(
  path: string,
  requireRootOwner: boolean,
): Promise<SecureRegularFile> {
  let handle: FileHandle | undefined;
  try {
    handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    const initialStats = await handle.stat({ bigint: true });
    assertSecureStats(initialStats, requireRootOwner);
    let closed = false;

    return Object.freeze({
      uid: Number(initialStats.uid),
      async readBounded(maximumBytes: number): Promise<string> {
        if (closed || !Number.isSafeInteger(maximumBytes) || maximumBytes < 1) {
          throw new Error('invalid_profile');
        }
        return readBoundedFromHandle(handle!, initialStats, maximumBytes);
      },
      async close(): Promise<void> {
        if (!closed) {
          closed = true;
          try {
            await handle!.close();
          } catch {
            throw new Error('invalid_profile');
          }
        }
      },
    });
  } catch {
    if (handle !== undefined) {
      await handle.close().catch(() => undefined);
    }
    throw new Error('invalid_profile');
  }
}

async function readBoundedFromHandle(
  handle: FileHandle,
  initialStats: BigIntStats,
  maximumBytes: number,
): Promise<string> {
  try {
    if (initialStats.size < 1n || initialStats.size > BigInt(maximumBytes)) {
      throw new Error('invalid_profile');
    }

    const buffer = Buffer.alloc(maximumBytes + 1);
    let offset = 0;
    while (offset < buffer.length) {
      const { bytesRead } = await handle.read(buffer, offset, buffer.length - offset, offset);
      if (bytesRead === 0) {
        break;
      }
      offset += bytesRead;
    }

    const finalStats = await handle.stat({ bigint: true });
    if (
      offset !== Number(initialStats.size)
      || offset > maximumBytes
      || !sameStableSnapshot(initialStats, finalStats)
    ) {
      throw new Error('invalid_profile');
    }

    const value = buffer.subarray(0, offset);
    if (value.includes(0)) {
      throw new Error('invalid_profile');
    }
    return new TextDecoder('utf-8', { fatal: true }).decode(value);
  } catch {
    throw new Error('invalid_profile');
  }
}

function assertSecureStats(stats: BigIntStats, requireRootOwner: boolean): void {
  if (
    !stats.isFile()
    || stats.isSymbolicLink()
    || (stats.mode & 0o022n) !== 0n
    || (requireRootOwner && stats.uid !== 0n)
  ) {
    throw new Error('invalid_profile');
  }
}

function sameStableSnapshot(left: BigIntStats, right: BigIntStats): boolean {
  return left.dev === right.dev
    && left.ino === right.ino
    && left.mode === right.mode
    && left.nlink === right.nlink
    && left.uid === right.uid
    && left.gid === right.gid
    && left.size === right.size
    && left.mtimeNs === right.mtimeNs
    && left.ctimeNs === right.ctimeNs;
}

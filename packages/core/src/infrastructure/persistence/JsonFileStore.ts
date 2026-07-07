import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';

// DT-015. Minimal, dependency-free JSON array file store shared by all durable adapters
// (Extend Before Create - one helper, not three ad hoc copies). Synchronous, matching the
// existing synchronous port signatures (OfflineQueue/WorkEventRepository/TimeEntryRepository
// were never async) - no port changes required. "Read whole file, modify, write whole file":
// sufficient for this sprint's single-process, single-writer scenario; no atomic-write or
// file-locking handling (documented limitation, Development Sprint 010 Plan Section 12).
export function readJsonArray<T>(filePath: string): T[] {
  if (!existsSync(filePath)) {
    return [];
  }

  const raw = readFileSync(filePath, 'utf-8');
  if (raw.trim().length === 0) {
    return [];
  }

  return JSON.parse(raw) as T[];
}

export function writeJsonArray<T>(filePath: string, records: readonly T[]): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(records, null, 2), 'utf-8');
}

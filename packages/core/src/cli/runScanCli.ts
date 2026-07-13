import { join } from 'path';
import { buildScanDemoPipeline, isDemoSyncOutcome } from './runScan';
import { FileOfflineQueue } from '../infrastructure/persistence/FileOfflineQueue';
import { FileWorkEventRepository } from '../infrastructure/persistence/FileWorkEventRepository';
import { FileTimeEntryRepository } from '../infrastructure/persistence/FileTimeEntryRepository';
import type { ScanDemoStorageOptions } from './runScan';

// DT-015 Node CLI entry point (`npm run demo:scan`). Deliberately separate from runScan.ts:
// this file is the only place that imports `fs`/`path` (via the File*-adapter classes) and
// reads `process.argv`/`process.env` - runScan.ts (re-exported by packages/core/src/index.ts
// and imported by apps/mobile) must stay free of Node-only imports so Metro can bundle the
// mobile app; see runScan.ts's own comment on ScanDemoStorageOptions for why.

function buildDurableStorage(directory: string): ScanDemoStorageOptions {
  return {
    workEventRepository: new FileWorkEventRepository(join(directory, 'work-events.json')),
    timeEntryRepository: new FileTimeEntryRepository(join(directory, 'time-entries.json')),
    offlineQueue: new FileOfflineQueue(join(directory, 'offline-queue.json')),
  };
}

// Only runs when this file is executed directly (as a Node CLI script), not when imported by
// tests - `process.argv`/`import.meta.url` are read unconditionally here because this module
// is never reached from a non-Node runtime such as Expo/Metro/Hermes (Development Sprint 006,
// Section 12 precedent, applied by keeping this logic out of the barrel-exported runScan.ts).
const [, , rawPayload, syncOutcomeArg] = process.argv;
// DT-015: TAPTIME_DEMO_STORAGE_DIR selects durable file-based storage for manual verification
// (e.g. run twice with the same directory to prove a queued record survives across two
// separate process invocations); omitted, the CLI's existing in-memory default is unchanged.
const storageDirectory = process.env.TAPTIME_DEMO_STORAGE_DIR;
const pipeline = buildScanDemoPipeline(undefined, storageDirectory ? buildDurableStorage(storageDirectory) : undefined);
await pipeline.scan(rawPayload);
await pipeline.synchronizePending(isDemoSyncOutcome(syncOutcomeArg) ? syncOutcomeArg : 'success');

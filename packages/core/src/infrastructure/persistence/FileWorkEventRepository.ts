import type { WorkEventRepository } from '../../ports/WorkEventRepository';
import type { WorkEvent } from '../../domain/WorkEvent';
import { readJsonArray, writeJsonArray } from './JsonFileStore';

// DT-015. Durable, file-based WorkEventRepository adapter - matches
// InMemoryWorkEventRepository's exact behavior/semantics, but survives process restart.
export class FileWorkEventRepository implements WorkEventRepository {
  constructor(private readonly filePath: string) {}

  save(workEvent: WorkEvent): void {
    const workEvents = readJsonArray<WorkEvent>(this.filePath);
    workEvents.push(workEvent);
    writeJsonArray(this.filePath, workEvents);
  }

  findAll(): readonly WorkEvent[] {
    return readJsonArray<WorkEvent>(this.filePath);
  }
}

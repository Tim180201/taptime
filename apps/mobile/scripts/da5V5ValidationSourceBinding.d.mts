export interface Da5V5ValidationSourceRecord {
  readonly path: string;
  readonly sha256: string;
}

export function createDa5V5ValidationSourceClosure(options: Readonly<{
  repositoryRoot: string;
  treeListing: string;
  worktreeObjectIds: string;
}>): readonly Da5V5ValidationSourceRecord[];

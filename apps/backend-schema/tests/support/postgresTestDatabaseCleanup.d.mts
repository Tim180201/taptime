export interface TestDatabaseTargetPool {
  end(): Promise<void>;
}

export interface TestDatabaseInstallerPool {
  query(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: Array<Record<string, unknown>> }>;
}

export interface ClosePoolAndDropTestDatabaseOptions {
  targetPool: TestDatabaseTargetPool;
  installerPool: TestDatabaseInstallerPool;
  databaseName: string;
  maxChecks?: number;
  delayMs?: number;
  waitForNextCheck?: (delayMs: number) => Promise<void>;
}

export declare function closePoolAndDropTestDatabase(
  options: ClosePoolAndDropTestDatabaseOptions,
): Promise<void>;

export interface Da5V5ValidationBuildProcessResult {
  readonly stderr: string;
  readonly stdout: string;
}

export class Da5V5ValidationBuildProcessController {
  constructor(dependencies?: Readonly<Record<string, unknown>>);
  run(
    command: string,
    args: readonly string[],
    options?: Readonly<{
      capture?: boolean;
      cwd?: string;
      environment?: NodeJS.ProcessEnv | Readonly<Record<string, string>>;
    }>,
  ): Promise<Da5V5ValidationBuildProcessResult>;
  interrupt(signal: 'SIGINT' | 'SIGTERM'): Promise<void>;
  checkpoint(label?: string): Promise<void>;
  commitPublication(publication: Readonly<{
    commit(): void;
    isRevocable(): boolean;
  }>): void;
  settle(): Promise<void>;
  getInterruptedSignal(): 'SIGINT' | 'SIGTERM' | null;
}

export const DA5_V5_VALIDATION_INSTALL_STREAM_ERROR_CATEGORIES:
  Readonly<{
    childExitMismatch: 'adb_child_exit_mismatch';
    childTimeoutMismatch: 'adb_child_timeout_mismatch';
    childTransportMismatch: 'adb_child_transport_mismatch';
    stdinPipeAbortMismatch: 'adb_stdin_pipe_abort_mismatch';
  }>;
export const DA5_V5_VALIDATION_INSTALL_STREAM_TERMINAL_CAUSES:
  Readonly<{
    signalAbort: 'signal_abort';
  }>;

export type Da5V5ValidationInstallStreamOutcome =
  | Readonly<{
    status: 'match';
    stdinTerminal:
      | 'all_bytes_submitted_then_pipe_closed'
      | 'finished'
      | 'partial_then_pipe_closed';
    stdout: string;
  }>
  | Readonly<{
    category:
      | 'adb_child_exit_mismatch'
      | 'adb_child_timeout_mismatch'
      | 'adb_child_transport_mismatch'
      | 'adb_stdin_pipe_abort_mismatch';
    childTerminal: boolean;
    status: 'mismatch';
    stdoutTerminal: boolean;
    terminalCause?: 'signal_abort';
  }>;

export interface Da5V5ValidationInstallStreamRunner {
  write(
    arguments_: readonly string[],
    options: Readonly<{
      signal?: AbortSignal;
      stdinBytes: Buffer;
      timeoutMilliseconds: number;
    }>,
  ): Promise<Da5V5ValidationInstallStreamOutcome>;
}

export class SystemDa5V5ValidationInstallStreamRunner
implements Da5V5ValidationInstallStreamRunner {
  constructor(dependencies?: Readonly<{
    adbPath?: string;
    environment?: Readonly<Record<string, string | undefined>>;
    spawn?: typeof import('node:child_process').spawn;
  }>);
  write(
    arguments_: readonly string[],
    options: Readonly<{
      signal?: AbortSignal;
      stdinBytes: Buffer;
      timeoutMilliseconds: number;
    }>,
  ): Promise<Da5V5ValidationInstallStreamOutcome>;
}

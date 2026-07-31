export function assertSyntheticE2eRuntimeCompleteness(bytecodeDump: string): void;
export function resolveSyntheticE2eHermesCompilerPath(): string;
export function verifySyntheticE2eAndroidRuntime(
  apkPath?: string,
  options?: Readonly<{
    dependencies?: Readonly<{
      exists(path: string): boolean;
      mkdtemp(prefix: string): string;
      remove(path: string): void;
      run(
        command: string,
        arguments_: readonly string[],
        options?: Readonly<{
          capture?: boolean;
          encoding?: null;
          maxBuffer?: number;
        }>,
      ): Readonly<{ stdout: Buffer | string }>;
      tmpdir(): string;
      writeFile(path: string, data: Buffer | string): void;
      writeOutput(value: string): void;
    }>;
    emitSuccess?: boolean;
    hermesCompilerPath?: string;
    unzipPath?: string;
  }>,
): void;

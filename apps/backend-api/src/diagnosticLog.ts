import type { BackendApiDiagnostic, BackendApiDiagnosticSink } from './types.js';

export interface BackendApiDiagnosticLogOptions {
  readonly now?: () => Date;
  readonly output?: Pick<NodeJS.WritableStream, 'write'>;
}

export function createBackendApiDiagnosticLogSink(
  options: BackendApiDiagnosticLogOptions = {},
): BackendApiDiagnosticSink {
  const now = options.now ?? (() => new Date());
  const output = options.output ?? process.stderr;

  return (diagnostic) => {
    const record = {
      timestamp: now().toISOString(),
      error_class: diagnostic.code,
      ...(diagnostic.route === undefined ? {} : { route: diagnostic.route }),
      correlation_id: diagnostic.correlationId,
    };
    output.write(`${JSON.stringify(record)}\n`);
  };
}

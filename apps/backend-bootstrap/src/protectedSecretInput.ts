import { Writable } from 'node:stream';
import { createInterface, type Interface } from 'node:readline/promises';
import { InvalidBootstrapRequestError } from './types.js';

export interface ProtectedSecretSource {
  readAccessToken(): Promise<string>;
  readDatabasePassword(): Promise<string>;
  finish(): Promise<void>;
  close(): void;
}

const maximumStdinSecretBytes = 131_072 + 1 + 4_096 + 1;

export function createProtectedSecretSource(
  useStandardInput: boolean,
  input: NodeJS.ReadableStream & AsyncIterable<Uint8Array> = process.stdin,
  diagnosticOutput: NodeJS.WritableStream = process.stderr,
): ProtectedSecretSource {
  if (useStandardInput) {
    if ((input as NodeJS.ReadableStream & { readonly isTTY?: boolean }).isTTY === true) {
      throw new Error('protected_tty_required');
    }
    return new BoundedStdinSecretSource(input);
  }
  if (input !== process.stdin || !process.stdin.isTTY) {
    throw new Error('protected_tty_required');
  }
  return new TtySecretSource(process.stdin, diagnosticOutput);
}

class BoundedStdinSecretSource implements ProtectedSecretSource {
  private readonly iterator: AsyncIterator<Uint8Array>;
  private pending = Buffer.alloc(0);
  private consumed = 0;
  private receivedBytes = 0;
  private ended = false;

  constructor(input: AsyncIterable<Uint8Array>) {
    this.iterator = input[Symbol.asyncIterator]();
  }

  readAccessToken(): Promise<string> {
    if (this.consumed !== 0) {
      throw new InvalidBootstrapRequestError('invalid_secret_input');
    }
    this.consumed = 1;
    return this.readLine(131_072);
  }

  readDatabasePassword(): Promise<string> {
    if (this.consumed !== 1) {
      throw new InvalidBootstrapRequestError('invalid_secret_input');
    }
    this.consumed = 2;
    return this.readLine(4_096);
  }

  async finish(): Promise<void> {
    if (this.consumed !== 2 || this.pending.length > 0) {
      throw new InvalidBootstrapRequestError('invalid_secret_input');
    }
    if (!this.ended) {
      while (!this.ended) {
        const extra = await this.iterator.next();
        if (extra.done) {
          this.ended = true;
        } else if (extra.value.length > 0) {
          throw new InvalidBootstrapRequestError('invalid_secret_input');
        }
      }
    }
  }

  close(): void {
    void this.iterator.return?.();
  }

  private async readLine(maximumBytes: number): Promise<string> {
    while (true) {
      const newline = this.pending.indexOf(0x0a);
      if (newline >= 0) {
        const line = this.pending.subarray(0, newline);
        this.pending = this.pending.subarray(newline + 1);
        return decodeSecretLine(line, maximumBytes);
      }
      if (this.pending.length > maximumBytes) {
        throw new InvalidBootstrapRequestError('invalid_secret_input');
      }
      const next = await this.iterator.next();
      if (next.done) {
        this.ended = true;
        if (this.pending.length === 0) {
          throw new InvalidBootstrapRequestError('invalid_secret_input');
        }
        const line = this.pending;
        this.pending = Buffer.alloc(0);
        return decodeSecretLine(line, maximumBytes);
      }
      this.receivedBytes += next.value.length;
      if (this.receivedBytes > maximumStdinSecretBytes) {
        throw new InvalidBootstrapRequestError('invalid_secret_input');
      }
      this.pending = Buffer.concat([this.pending, Buffer.from(next.value)]);
    }
  }
}

class TtySecretSource implements ProtectedSecretSource {
  private readonly readline: Interface;
  private consumed = 0;

  constructor(
    input: NodeJS.ReadableStream,
    private readonly diagnosticOutput: NodeJS.WritableStream,
  ) {
    const mutedOutput = new Writable({ write(_chunk, _encoding, callback) { callback(); } });
    this.readline = createInterface({ input, output: mutedOutput, terminal: true, historySize: 0 });
  }

  readAccessToken(): Promise<string> {
    return this.question('Access token: ', 131_072, 0);
  }

  readDatabasePassword(): Promise<string> {
    return this.question('Database password: ', 4_096, 1);
  }

  async finish(): Promise<void> {
    if (this.consumed !== 2) {
      throw new InvalidBootstrapRequestError('invalid_secret_input');
    }
    this.close();
  }

  close(): void {
    this.readline.close();
  }

  private async question(prompt: string, maximumBytes: number, expectedConsumed: number): Promise<string> {
    if (this.consumed !== expectedConsumed) {
      throw new InvalidBootstrapRequestError('invalid_secret_input');
    }
    this.consumed += 1;
    this.diagnosticOutput.write(prompt);
    const value = await this.readline.question('');
    this.diagnosticOutput.write('\n');
    return decodeSecretLine(Buffer.from(value, 'utf8'), maximumBytes);
  }
}

function decodeSecretLine(value: Buffer, maximumBytes: number): string {
  if (
    value.length < 1
    || value.length > maximumBytes
    || value.includes(0)
    || value.includes(0x0d)
  ) {
    throw new InvalidBootstrapRequestError('invalid_secret_input');
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(value);
  } catch {
    throw new InvalidBootstrapRequestError('invalid_secret_input');
  }
}

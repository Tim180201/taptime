import { execFile } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { promisify } from 'node:util';

const execute = promisify(execFile);
const executable = resolve('dist/main.js');
const metadata = await stat(executable);
const source = await readFile(executable, 'utf8');

if ((metadata.mode & 0o111) === 0 || !source.startsWith('#!/usr/bin/env node\n')) {
  throw new Error('built_cli_not_executable');
}

try {
  await execute(executable, [], {
    encoding: 'utf8',
    env: { PATH: `${dirname(process.execPath)}:/usr/bin:/bin` },
    maxBuffer: 4_096,
  });
  throw new Error('built_cli_invalid_invocation_unexpectedly_succeeded');
} catch (error) {
  if (
    typeof error !== 'object'
    || error === null
    || !('code' in error)
    || error.code !== 2
    || !('stdout' in error)
    || error.stdout !== '{"status":"rejected","reason":"invalid_request"}\n'
    || !('stderr' in error)
    || error.stderr !== ''
  ) {
    throw new Error('built_cli_contract_failed');
  }
}

process.stdout.write('c3b_built_cli_verified\n');

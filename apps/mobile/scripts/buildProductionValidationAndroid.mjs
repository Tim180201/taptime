import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const mobileDirectory = fileURLToPath(new URL('..', import.meta.url));
const repositoryRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  cwd: mobileDirectory,
  encoding: 'utf8',
}).trim();
const sourcePathspec = [
  'apps/mobile',
  'packages/core',
  'packages/mobile-work-contract',
  'packages/offline-sync-contract',
  'packages/time-review-contract',
  'package.json',
  'package-lock.json',
];

const trackedStatus = spawnSync(
  'git',
  ['diff', '--quiet', 'HEAD', '--', ...sourcePathspec],
  { cwd: repositoryRoot, stdio: 'ignore' },
);
if (trackedStatus.status !== 0) {
  throw new Error(
    'Production validation build requires all non-ADO source changes to be committed.',
  );
}

const untrackedSource = execFileSync(
  'git',
  ['ls-files', '--others', '--exclude-standard', '--', ...sourcePathspec],
  { cwd: repositoryRoot, encoding: 'utf8' },
).trim();
if (untrackedSource.length > 0) {
  throw new Error(
    `Production validation build rejects untracked source: ${untrackedSource.split('\n')[0]}`,
  );
}

const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: repositoryRoot,
  encoding: 'utf8',
}).trim();
if (!/^[0-9a-f]{40}$/u.test(sourceCommit)) {
  throw new Error('Production validation build could not resolve an exact source commit.');
}

process.stdout.write(`production_validation_source_commit=${sourceCommit}\n`);
const build = spawnSync(
  'npx',
  [
    '--yes',
    'eas-cli@23.0.0',
    'build',
    '--platform',
    'android',
    '--profile',
    'production-validation',
  ],
  {
    cwd: mobileDirectory,
    env: { ...process.env, EAS_BUILD_GIT_COMMIT_HASH: sourceCommit },
    stdio: 'inherit',
  },
);
if (build.error !== undefined) throw build.error;
if (build.status !== 0) process.exit(build.status ?? 1);

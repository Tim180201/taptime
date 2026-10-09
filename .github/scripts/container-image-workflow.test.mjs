import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { globSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { parse } from 'yaml';

const workflow = parse(readFileSync('.github/workflows/container-image.yml', 'utf8'));
const job = workflow.jobs.publish;
const steps = job.steps;
const repository = 'Tim180201/taptime';
function context(eventName = 'workflow_run', run = {}, ref = 'refs/heads/main') {
  return { github: { event_name: eventName, ref, repository, event: { workflow_run: {
    conclusion: 'success', event: 'push', head_branch: 'main', head_repository: { full_name: repository }, ...run,
  } } } };
}
const allowed = (expression, values) => runInNewContext(expression.replace(/^\$\{\{|\}\}$/g, ''), values);

test('publication accepts only successful own-repository main push CI or manual runs from main', () => {
  assert.equal(allowed(job.if, context()), true);
  for (const run of [
    { conclusion: 'failure' }, { conclusion: 'cancelled' }, { event: 'pull_request' },
    { event: 'workflow_dispatch' }, { head_branch: 'feature' },
    { head_repository: { full_name: 'someone/fork' } },
  ]) assert.equal(allowed(job.if, context('workflow_run', run)), false, JSON.stringify(run));
  assert.equal(allowed(job.if, context('push')), false);
  assert.equal(allowed(job.if, context('workflow_dispatch')), true);
  assert.equal(allowed(job.if, context('workflow_dispatch', {}, 'refs/heads/feature')), false);
  assert.equal(allowed(job.if, context('workflow_dispatch', {}, 'refs/tags/main')), false);
});

test('source ancestry gate rejects a side-branch commit and accepts an older main commit using real Git', () => {
  const gate = steps.find(step => step.name === 'Verify the source commit belongs to main');
  assert.ok(gate, 'a main ancestry gate must execute before any build');
  assert.ok(steps.indexOf(gate) < steps.findIndex(step => step.uses?.startsWith('docker/build-push-action@')));
  const checkout = steps.find(step => step.with?.path === 'source');
  assert.equal(checkout.with['fetch-depth'], 0, 'ancestry needs complete history');
  const root = mkdtempSync(join(tmpdir(), 't098-git-'));
  const git = (...args) => {
    const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  try {
    git('init', '-b', 'main'); git('config', 'user.email', 'test@example.invalid'); git('config', 'user.name', 'Test');
    git('commit', '--allow-empty', '-m', 'base');
    const oldMain = git('rev-parse', 'HEAD');
    git('switch', '-c', 'side'); git('commit', '--allow-empty', '-m', 'side');
    const side = git('rev-parse', 'HEAD');
    git('switch', 'main'); git('commit', '--allow-empty', '-m', 'main');
    git('remote', 'add', 'origin', root);
    for (const { sha, requested, accepted } of [
      { sha: oldMain, requested: oldMain, accepted: true },
      { sha: side, requested: side, accepted: false },
      { sha: oldMain, requested: 'main', accepted: false },
      { sha: oldMain, requested: oldMain.slice(0, 7), accepted: false },
      { sha: oldMain, requested: side, accepted: false },
    ]) {
      const result = spawnSync('bash', ['-c', gate.run], {
        cwd: root, encoding: 'utf8', env: { ...process.env, SOURCE_SHA: sha, REQUESTED_SOURCE: requested },
      });
      assert.equal(result.status === 0, accepted, result.stderr);
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('verification runs with available protection even after skipped or failed cleanup, unless cancelled', () => {
  const verify = steps.find(step => step.name === 'Verify protected images remain fully retrievable');
  assert.ok(verify);
  for (const available of ['true', 'false', undefined]) {
    for (const performed of ['true', 'false', undefined]) {
      for (const cancelled of [false, true]) {
        assert.equal(allowed(verify.if, { cancelled: () => cancelled, steps: {
          protection: { outputs: { available } }, cleanup: { outputs: { performed } },
        } }), available === 'true' && !cancelled, JSON.stringify({ available, performed, cancelled }));
      }
    }
  }
  assert.match(verify.if, /!cancelled\(\)/, 'override implicit success() after a failed deletion');
  assert.notEqual(verify['continue-on-error'], true);
  assert.notEqual(job['continue-on-error'], true);
  assert.equal(verify.run.trim(), 'node control/.github/scripts/clean-ghcr.mjs verify', 'propagate verification exit status');
  assert.equal(verify.env.GH_TOKEN, steps.find(step => step.id === 'cleanup').env.GH_TOKEN,
    'fallback inventory uses the existing workflow token');
  assert.doesNotMatch(workflow.concurrency.group, /\$\{\{/, 'all publishing commits share one lock');
  assert.equal(workflow.concurrency['cancel-in-progress'], false);
});

test('manual repair gate evaluates complete CI pages and rejects wrong event, source, commit or result', () => {
  const gate = steps.find(step => step.name === 'Verify successful exact-commit CI for a manual rollback build');
  assert.ok(gate);
  const sha = 'a'.repeat(40);
  const valid = { head_sha: sha, event: 'push', head_branch: 'main', conclusion: 'success', head_repository: { full_name: repository } };
  const cases = [
    { pages: [[valid]], accepted: true },
    { pages: [[], [valid]], accepted: true },
    { pages: [[valid], [valid]], accepted: true },
    { pages: [[]], accepted: false },
    ...[
      { head_sha: 'b'.repeat(40) }, { event: 'pull_request' }, { event: 'workflow_dispatch' },
      { head_branch: 'feature' }, { conclusion: 'failure' }, { conclusion: 'cancelled' },
      { head_repository: { full_name: 'someone/fork' } },
    ].map(fields => ({ pages: [[{ ...valid, ...fields }]], accepted: false })),
  ];
  const root = mkdtempSync(join(tmpdir(), 't098-ci-runs-'));
  try {
    mkdirSync(join(root, 'bin'));
    // Only the transport is substituted. Match gh's documented flag restriction,
    // verified against the real CLI: --slurp cannot be combined with --jq.
    writeFileSync(join(root, 'bin/gh'), `#!/usr/bin/env node\nconst fs = require('node:fs');\nconst args = process.argv.slice(2);\nif (args.includes('--slurp') && args.includes('--jq')) {\n  process.stderr.write('the --slurp option is not supported with --jq'); process.exit(1);\n}\nprocess.stdout.write(fs.readFileSync(process.env.CI_FIXTURE));\n`, { mode: 0o755 });
    const fixture = join(root, 'fixture.json');
    for (const scenario of cases) {
      writeFileSync(fixture, JSON.stringify(scenario.pages.map(workflow_runs => ({ workflow_runs }))));
      const result = spawnSync('bash', ['-c', gate.run], { encoding: 'utf8',
        env: { ...process.env, PATH: `${join(root, 'bin')}:${process.env.PATH}`, RUNNER_TEMP: root,
          SOURCE_SHA: sha, GITHUB_REPOSITORY: repository, CI_FIXTURE: fixture },
      });
      assert.equal(result.status === 0, scenario.accepted, `${JSON.stringify(scenario)}: ${result.stderr}`);
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('unavailable production protection does not stop builds and skips deletion visibly', () => {
  const fetchStep = steps.find(step => step.name === 'Fetch the production rollback protection set');
  const cleanup = steps.find(step => step.name === 'Remove obsolete unprotected release images');
  const verify = steps.find(step => step.name === 'Verify protected images remain fully retrievable');
  const builds = steps.filter(step => step.uses?.startsWith('docker/build-push-action@'));
  assert.ok(builds.length > 0);
  for (const build of builds) assert.ok(steps.indexOf(build) < steps.indexOf(fetchStep), `${build.name} must precede production access`);
  const root = mkdtempSync(join(tmpdir(), 't098-protection-'));
  try {
    mkdirSync(join(root, 'bin'));
    writeFileSync(join(root, 'bin/curl'), '#!/bin/sh\nexit 22\n', { mode: 0o755 });
    const output = join(root, 'outputs');
    const summary = join(root, 'summary');
    const result = spawnSync('bash', ['-c', fetchStep.run], { encoding: 'utf8',
      env: { ...process.env, PATH: `${join(root, 'bin')}:${process.env.PATH}`, RUNNER_TEMP: root,
        GITHUB_OUTPUT: output, GITHUB_STEP_SUMMARY: summary },
    });
    assert.equal(result.status, 0, result.stderr);
    const outputs = Object.fromEntries(readFileSync(output, 'utf8').trim().split('\n').map(line => line.split('=')));
    assert.equal(allowed(cleanup.if, { steps: { [fetchStep.id]: { outputs } } }), false);
    assert.equal(allowed(verify.if, { cancelled: () => false,
      steps: { [fetchStep.id]: { outputs }, cleanup: { outputs: {} } },
    }), false);
    assert.match(result.stdout + result.stderr, /::warning::/);
    assert.match(readFileSync(summary, 'utf8'), /skip|übersprungen/i);
    for (const build of builds) {
      const state = Object.fromEntries(steps.filter(step => step.id).map(step => [step.id, { outputs: { publish: 'true' } }]));
      state[fetchStep.id] = { outputs };
      assert.equal(allowed(build.if, { steps: state }), true);
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('all remote Actions have full commit pins with version comments and Dependabot updates them', () => {
  for (const file of globSync('.github/workflows/*.{yml,yaml}')) {
    const source = readFileSync(file, 'utf8');
    const remote = [...source.matchAll(/^\s*(?:-\s*)?uses:\s*([^\s#]+)(.*)$/gm)]
      .filter(([, action]) => !action.startsWith('./'));
    assert.ok(remote.length > 0, `${file}: expected Actions`);
    for (const [, action, comment] of remote) {
      assert.match(action, /^[\w-]+\/[\w./-]+@[0-9a-f]{40}$/, `${file}: ${action}`);
      assert.match(comment, /#\s*v\d+(?:\.\d+)*/);
    }
  }
  const config = parse(readFileSync('.github/dependabot.yml', 'utf8'));
  assert.equal(config.version, 2);
  assert.ok(config.updates.some(update => update['package-ecosystem'] === 'github-actions' && update.directory === '/'));
});

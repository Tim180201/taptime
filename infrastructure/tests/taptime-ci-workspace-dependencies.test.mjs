import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { globSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { parse as parseYaml } from 'yaml';
import { parse as parseShell } from 'shell-quote';

// Maintained with ci.yml and workspace scripts; remove only with workspace CI.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const readJson = (path) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
const rootPackage = readJson('package.json');
const packages = new Map(globSync(rootPackage.workspaces.map(path => `${path}/package.json`), { cwd: root })
  .map(path => {
    const manifest = readJson(path);
    return [manifest.name, { ...manifest, directory: dirname(path) }];
  }));
const workflow = parseYaml(readFileSync(resolve(root, '.github/workflows/ci.yml'), 'utf8'));

function dependencies(name, manifests, includeDevelopment) {
  const required = new Set();
  // Test-only cycles are allowed: all members must be built before testing any
  // member. Production builds exclude tests and use the acyclic runtime graph.
  const visited = new Set([name]);
  function visit(current) {
    const manifest = manifests.get(current);
    assert.ok(manifest, `Workspace ${current}: package.json fehlt`);
    const edges = { ...manifest.dependencies, ...manifest.optionalDependencies, ...manifest.peerDependencies,
      ...(includeDevelopment ? manifest.devDependencies : {}) };
    for (const dependency of Object.keys(edges).filter(value => value.startsWith('@taptime/'))) {
      assert.ok(manifests.has(dependency), `${current}: Workspace ${dependency} fehlt`);
      if (visited.has(dependency)) continue;
      visited.add(dependency);
      required.add(dependency);
      visit(dependency);
    }
  }
  visit(name);
  return required;
}

function commands(source, location) {
  const result = [];
  if (!/\bnpm\b/.test(source)) return result;
  for (const line of source.replace(/\\\r?\n/g, ' ').split(/\r?\n/)) {
    // Only standalone command lines / && chains are supported. Let Bash reject
    // incomplete lines (multiline conditions, trailing &&, multiline quotes),
    // without executing anything; unknown complete wrappers fail below.
    const syntax = spawnSync('bash', ['-n'], { input: line, encoding: 'utf8' });
    assert.equal(syntax.status, 0, `${location}: nicht unterstützte mehrzeilige Shell-Syntax`);
    // Parse quoting/comments instead of treating a name in echo or a comment as a build.
    const tokens = parseShell(line, name => ({ variable: name })).filter(token => !token?.comment);
    if (tokens.length === 0) continue;
    let command = [];
    for (const token of [...tokens, { op: '&&' }]) {
      if (token?.op === '&&') {
        if (command.length) result.push(command);
        command = [];
      } else {
        assert.equal(typeof token, 'string', `${location}: nicht unterstützte Shell-Syntax im npm-Befehl`);
        command.push(token);
      }
    }
  }
  return result;
}

function npmOperations(source, directory, manifests, scripts, location, stack = []) {
  return commands(source, location).flatMap(tokens => {
    if (tokens[0] !== 'npm') {
      // A quoted echo is not execution. Other wrappers must be modelled explicitly.
      assert.ok(['echo', 'printf'].includes(tokens[0]), `${location}: nicht unterstützter npm-Wrapper: ${tokens[0]}`);
      return [];
    }
    if (tokens.length === 2 && tokens[1] === 'ci') return [];
    const action = tokens[1] === 'run' ? tokens[2] : tokens[1] === 'test' ? 'test' : null;
    assert.ok(action, `${location}: nicht unterstützter npm-Befehl: ${tokens.join(' ')}`);
    const args = tokens.slice(tokens[1] === 'run' ? 3 : 2);
    const selectors = [];
    for (let i = 0; i < args.length && args[i] !== '--'; i += 1) {
      const arg = args[i];
      if (arg === '--workspace' || arg === '-w') selectors.push(args[++i]);
      else if (arg.startsWith('--workspace=') || arg.startsWith('-w=')) selectors.push(arg.slice(arg.indexOf('=') + 1));
      else assert.fail(`${location}: nicht unterstützte npm-Option: ${arg}`);
    }
    const local = [...manifests].find(([, manifest]) => resolve(root, manifest.directory) === resolve(root, directory))?.[0];
    if (selectors.length === 0 && local) selectors.push(local);
    if (selectors.length === 0) {
      assert.equal(resolve(root, directory), root, `${location}: unbekanntes Arbeitsverzeichnis ${directory}`);
      assert.ok(scripts[action], `${location}: Root-Skript ${action} fehlt`);
      assert.ok(!stack.includes(action), `${location}: zyklisches Root-Skript ${action}`);
      return npmOperations(scripts[action], '.', manifests, scripts, `${location} → package.json#${action}`, [...stack, action]);
    }
    return selectors.map(selector => {
      const name = manifests.has(selector) ? selector
        : [...manifests].find(([, manifest]) => manifest.directory === selector)?.[0];
      assert.ok(name, `${location}: unbekannter Workspace ${selector}`);
      assert.ok(manifests.get(name).scripts?.[action], `${location}: ${name} hat kein Skript ${action}`);
      return { name, action };
    });
  });
}

function verifyJob(id, job, manifests, scripts, defaults = {}) {
  const built = new Set();
  const errors = [];
  for (const step of job.steps ?? []) {
    if (!step.run) continue;
    const location = `${id} (${job.name ?? id}) / ${step.name ?? 'run'}`;
    const directory = step['working-directory'] ?? job.defaults?.run?.['working-directory']
      ?? defaults.run?.['working-directory'] ?? '.';
    const operations = npmOperations(step.run, directory, manifests, scripts, location);
    for (const { name, action } of operations) {
      const checksWorkspace = /^(?:typecheck|test)(?::|$)/.test(action);
      if (action !== 'build' && !checksWorkspace) continue;
      if (action === 'build') {
        // A skipped or allowed-to-fail build cannot supply declarations reliably.
        assert.ok(!Object.hasOwn(step, 'if') && !step['continue-on-error'], `${location}: Build ist bedingt oder darf fehlschlagen`);
      }
      const required = dependencies(name, manifests, checksWorkspace);
      const missing = [...required].filter(dependency => !built.has(dependency));
      if (missing.length) errors.push(`${location}: vor ${action} ${name} fehlen Builds: ${missing.join(', ')}`);
      if (action === 'build') built.add(name);
    }
  }
  assert.equal(errors.length, 0, errors.join('\n'));
}

// Discover jobs, scripts and dependencies from their source, never a fixed job/package count.
for (const [id, job] of Object.entries(workflow.jobs)) {
  test(`CI ${id} (${job.name}): Abhängigkeiten vor Build, Typecheck und Tests`, () => {
    verifyJob(id, job, packages, rootPackage.scripts, workflow.defaults);
  });
}

const fixture = new Map([
  ['@taptime/app', { directory: 'apps/app', scripts: { build: 'tsc', typecheck: 'tsc', test: 'vitest' },
    dependencies: { '@taptime/source': '*' }, devDependencies: { '@taptime/helper': '*' } }],
  ['@taptime/source', { directory: 'packages/source', main: './src/index.ts', scripts: { build: 'tsc' },
    dependencies: { '@taptime/contract': '*' } }],
  ['@taptime/contract', { directory: 'packages/contract', types: './dist/index.d.ts', scripts: { build: 'tsc' },
    devDependencies: { '@taptime/transitive-test': '*' } }],
  ['@taptime/helper', { directory: 'packages/helper', scripts: { build: 'tsc' }, devDependencies: { '@taptime/app': '*' } }],
  ['@taptime/transitive-test', { directory: 'packages/transitive-test', scripts: { build: 'tsc' } }],
]);
const build = name => `npm run build --workspace=@taptime/${name}`;
const preparation = ['contract', 'source', 'helper', 'transitive-test'].map(build).join('\n');
const check = 'npm run typecheck --workspace=@taptime/app';
const job = run => ({ name: 'Fixture', steps: [{ run }] });
const verify = (source, scripts = {}) => verifyJob('fixture', job(source), fixture, scripts);

test('transitive Entwicklungsabhängigkeiten und src-Pakete zählen; Testzyklen terminieren', () => {
  assert.deepEqual(dependencies('@taptime/app', fixture, true),
    new Set(['@taptime/source', '@taptime/contract', '@taptime/transitive-test', '@taptime/helper']));
  verify(`${preparation}\n${check}\nnpm test -w @taptime/app`);
  assert.throws(() => verify(`${preparation.replace(build('transitive-test'), '')}\n${check}`), /transitive-test/);
});

test('fehlender, später, auskommentierter oder nur ausgegebener Build wird erkannt', () => {
  const incomplete = preparation.replace(build('helper'), '');
  for (const source of [
    `${incomplete}\n${check}`,
    `${incomplete}\n${check}\n${build('helper')}`,
    `${incomplete}\n# ${build('helper')}\n${check}`,
    `${incomplete}\necho '${build('helper')}'\n${check}`,
  ]) assert.throws(() => verify(source), /vor typecheck.*@taptime\/helper/);
});

test('Produktionsabhängigkeiten müssen auch vor dem Build der Abhängigkeit bereitstehen', () => {
  assert.throws(() => verify(`${build('source')}\n${preparation}\n${check}`), /vor build @taptime\/source.*contract/);
});

test('Root-Skripte werden in Aufrufreihenfolge expandiert; bedingte Builds zählen nicht', () => {
  const scripts = { prepare: preparation, typecheck: check, test: 'npm test --workspace=@taptime/app' };
  verify('npm run prepare && npm run typecheck && npm test', scripts);
  assert.throws(() => verify('npm run typecheck && npm run prepare', scripts), /fehlen Builds/);
  assert.throws(() => verify('npm run prepare', { prepare: 'npm run prepare' }), /zyklisches Root-Skript/);
  for (const condition of [false, 'false', '${{ false }}']) {
    assert.throws(() => verifyJob('fixture', { steps: [{ run: preparation, if: condition }, { run: check }] }, fixture, {}), /bedingt/);
  }
});

test('jeder Job besitzt einen leeren Buildzustand; working-directory und Kurzoptionen werden erfasst', () => {
  verify(preparation);
  assert.throws(() => verify(check), /fehlen Builds/);
  verifyJob('fixture', { steps: [{ run: preparation }, { 'working-directory': 'apps/app', run: 'npm test' }] }, fixture, {});
  verify(`${preparation}\nnpm run typecheck -w apps/app`);
});

test('unbekannte Workspace-/Shell-Syntax fällt nicht unbemerkt aus der Prüfung', () => {
  assert.throws(() => verify('npm run typecheck --workspace=@taptime/new'), /unbekannter Workspace/);
  assert.throws(() => verify(`false || ${build('helper')}`), /Shell-Syntax/);
  assert.throws(() => verify('bash -c "npm test --workspace=@taptime/app"'), /npm-Wrapper/);
  assert.throws(() => verify('npm run typecheck --workspace=$TARGET'), /Shell-Syntax/);
});

test('mehrzeilige Shell-Bedingungen, Fortsetzungen und zitierte Scheinkommandos zählen nicht als Build', () => {
  const incomplete = preparation.replace(build('helper'), '');
  for (const hidden of [
    `if false; then\n${build('helper')}\nfi`,
    `false &&\n${build('helper')}`,
    `echo '\n${build('helper')}\n'`,
  ]) assert.throws(() => verify(`${incomplete}\n${hidden}\n${check}`), /Shell-Syntax|npm-Wrapper/);
});

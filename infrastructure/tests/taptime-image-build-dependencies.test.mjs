import assert from 'node:assert/strict';
import { globSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

// Created in T-064; maintain with the image build paths, remove with those images.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const readJson = (path) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
const rootPackage = readJson('package.json');
const packages = new Map(
  globSync(rootPackage.workspaces.map((workspace) => `${workspace}/package.json`), { cwd: root })
    .map((path) => {
      const manifest = readJson(path);
      return [manifest.name, { ...manifest, path }];
    }),
);

function distDependencies(application, manifests) {
  const visited = new Set([application]);
  const required = new Set();
  function visit(name) {
    const manifest = manifests.get(name);
    assert.ok(manifest, `Workspace ${name}: package.json fehlt`);
    // The root application's build can typecheck its tests (as admin-web does),
    // so conservatively include its devDependencies. A consumed workspace's
    // devDependencies belong to its own tests/tools (e.g. backend-bootstrap),
    // which are not part of the application's build graph.
    const dependencies = {
      ...manifest.dependencies,
      ...manifest.optionalDependencies,
      ...manifest.peerDependencies,
      ...(name === application ? manifest.devDependencies : {}),
    };
    for (const dependency of Object.keys(dependencies).filter((value) => value.startsWith('@taptime/'))) {
      if (visited.has(dependency)) continue;
      visited.add(dependency);
      const target = manifests.get(dependency);
      assert.ok(target, `${manifest.path ?? name}: package.json für ${dependency} fehlt`);
      if ([target.main, target.types].some((entry) => /^\.\/dist(?:\/|$)/.test(entry ?? ''))) {
        required.add(dependency);
      }
      // Source-entry packages can themselves depend on dist-entry packages.
      visit(dependency);
    }
  }
  visit(application);
  return required;
}

function buildCommands(command, scripts, location, stack = []) {
  return command.split(/\s*&&\s*/).flatMap((value) => {
    const part = value.trim();
    const workspace = part.match(/^npm run build --workspace=(@taptime\/[\w-]+)(?: -- [^;&|]+)?$/);
    if (workspace) return [workspace[1]];
    const script = part.match(/^npm run ([\w:-]+)$/)?.[1];
    if (script) {
      assert.ok(scripts[script], `${location}: Root-Skript ${script} fehlt`);
      assert.ok(!stack.includes(script), `${location}: zyklisches Root-Skript ${script}`);
      return buildCommands(scripts[script], scripts, `package.json#scripts.${script}`, [...stack, script]);
    }
    // Fail closed on a changed npm build syntax instead of counting textual mentions.
    if (/^npm\s/.test(part) && part !== 'npm ci') {
      assert.fail(`${location}: nicht unterstützter Baubefehl: ${part}`);
    }
    return [];
  });
}

function verifyImage(application, dockerfile, source, scripts, manifests) {
  const required = distDependencies(application, manifests);
  let built = new Set();
  let foundApplication = false;
  const instructions = source.replace(/^\s*#.*$/gm, '').replace(/\\\r?\n\s*/g, ' ').split(/\r?\n/);
  for (const instruction of instructions) {
    // A build in an unrelated stage does not supply this stage's declarations.
    if (/^FROM\s/i.test(instruction)) built = new Set();
    const command = instruction.match(/^RUN\s+(.+)$/i)?.[1];
    if (!command) continue;
    for (const workspace of buildCommands(command, scripts, dockerfile)) {
      if (workspace === application) {
        foundApplication = true;
        const missing = [...required].filter((dependency) => !built.has(dependency));
        assert.equal(missing.length, 0,
          `${dockerfile}: vor ${application} fehlen gebaute dist-Abhängigkeiten: ${missing.join(', ')}`);
      }
      built.add(workspace);
    }
  }
  assert.ok(foundApplication, `${dockerfile}: Baubefehl für ${application} fehlt`);
}

for (const application of ['admin-web', 'operator-web', 'landing-web', 'backend-api']) {
  const dockerfile = `infrastructure/${application}/Dockerfile`;
  test(`${dockerfile}: alle transitiven dist-Abhängigkeiten vor der Anwendung`, () => {
    verifyImage(`@taptime/${application}`, dockerfile, readFileSync(resolve(root, dockerfile), 'utf8'),
      rootPackage.scripts, packages);
  });
}

// Mutation cases demonstrate that the guard checks dependencies and ordering,
// rather than approving a frozen list or a package name in a comment.
const fixture = new Map([
  ['@taptime/app', { dependencies: { '@taptime/source': '*' } }],
  ['@taptime/source', { main: './src/index.ts', dependencies: { '@taptime/contract': '*' } }],
  ['@taptime/contract', { types: './dist/index.d.ts', devDependencies: { '@taptime/test-only': '*' } }],
]);
const buildContract = 'npm run build --workspace=@taptime/contract';
const buildApp = 'npm run build --workspace=@taptime/app';
const verifyFixture = (source, scripts = {}) => verifyImage('@taptime/app', 'fixture/Dockerfile', source, scripts, fixture);

test('transitive dist-Abhängigkeit durch ein src-Paket; main oder types genügt', () => {
  assert.deepEqual([...distDependencies('@taptime/app', fixture)], ['@taptime/contract']);
  const mainOnly = new Map(fixture);
  mainOnly.set('@taptime/contract', { main: './dist/index.js' });
  assert.deepEqual([...distDependencies('@taptime/app', mainOnly)], ['@taptime/contract']);
  verifyFixture(`FROM node AS build\nRUN ${buildContract} && ${buildApp}`);
});

test('dist-Entwicklungsabhängigkeit zählt nur an der Wurzelanwendung', () => {
  const developmentDependency = '@taptime/development-contract';
  const consumed = new Map(fixture);
  consumed.set(developmentDependency, { types: './dist/index.d.ts' });
  consumed.set('@taptime/source', {
    ...consumed.get('@taptime/source'),
    devDependencies: { [developmentDependency]: '*' },
  });
  const image = `RUN ${buildContract} && ${buildApp}`;
  assert.ok(!distDependencies('@taptime/app', consumed).has(developmentDependency));
  verifyImage('@taptime/app', 'fixture/Dockerfile', image, {}, consumed);

  const atRoot = new Map(consumed);
  atRoot.set('@taptime/app', {
    ...atRoot.get('@taptime/app'),
    devDependencies: { [developmentDependency]: '*' },
  });
  assert.ok(distDependencies('@taptime/app', atRoot).has(developmentDependency),
    `Wurzelanwendung muss ${developmentDependency} als dist-Entwicklungsabhängigkeit fordern`);
  assert.throws(() => verifyImage('@taptime/app', 'fixture/Dockerfile', image, {}, atRoot),
    /fixture\/Dockerfile:.*@taptime\/development-contract/);
  verifyImage('@taptime/app', 'fixture/Dockerfile',
    `RUN ${buildContract} && npm run build --workspace=${developmentDependency} && ${buildApp}`, {}, atRoot);
});

test('fehlender, verspäteter, auskommentierter oder fremdstufiger Bau wird abgelehnt', () => {
  for (const source of [
    `RUN ${buildApp}`,
    `RUN ${buildApp} && ${buildContract}`,
    `# RUN ${buildContract}\nRUN ${buildApp}`,
    `RUN echo '${buildContract}'\nRUN ${buildApp}`,
    `FROM node AS unused\nRUN ${buildContract}\nFROM node AS build\nRUN ${buildApp}`,
  ]) {
    assert.throws(() => verifyFixture(source), /fixture\/Dockerfile:.*@taptime\/contract/);
  }
});

test('Root-Skripte werden an ihrer Aufrufstelle in Reihenfolge aufgelöst', () => {
  const scripts = { 'build:contracts': buildContract };
  verifyFixture(`RUN npm run build:contracts && ${buildApp}`, scripts);
  assert.throws(() => verifyFixture(`RUN ${buildApp} && npm run build:contracts`, scripts), /@taptime\/contract/);
  assert.throws(() => verifyFixture(`RUN ${buildApp}`, scripts), /@taptime\/contract/);
  assert.throws(() => verifyFixture('RUN npm run build:contracts', { 'build:contracts': 'npm run build:contracts' }), /zyklisch/);
});

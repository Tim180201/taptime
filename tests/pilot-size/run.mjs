import { build } from 'esbuild';
import { mkdir, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

// Check before importing any database, HTTP or browser code. Never run in CI.
if (process.env.TAPTIME_PILOT_SIZE !== 'synthetic-local-only' || process.env.CI) {
  throw new Error('Local opt-in required: TAPTIME_PILOT_SIZE=synthetic-local-only; CI is forbidden');
}
const output = resolve(process.env.TAPTIME_PILOT_OUTPUT ?? '.t099a-review');
await mkdir(output, { recursive: true });
const temporary = await mkdtemp(join(output, '.runner-'));
const workspaces = new Map();
for (const parent of ['apps', 'packages']) for (const name of await readdir(parent)) {
  try {
    const directory = resolve(parent, name);
    const pkg = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'));
    workspaces.set(pkg.name, { directory, pkg });
  } catch { /* Not a workspace. */ }
}
try {
  const entry = resolve(temporary, 'main.mjs');
  await build({ entryPoints: [process.argv.includes('--payroll') ? 'tests/pilot-size/payroll.ts' : 'tests/pilot-size/main.ts'], outfile: entry, bundle: true,
    platform: 'node', target: 'node24', format: 'esm', packages: 'external', sourcemap: 'inline',
    plugins: [{ name: 'current-workspace-source', setup(builder) {
      builder.onResolve({ filter: /^@taptime\// }, args => {
        const [scope, name, ...subpath] = args.path.split('/');
        const workspace = workspaces.get(`${scope}/${name}`);
        if (!workspace) throw new Error(`Unknown workspace ${args.path}`);
        const target = workspace.pkg.exports?.[subpath.length ? `./${subpath.join('/')}` : '.']?.import
          ?? (subpath.length ? null : workspace.pkg.main);
        if (!target) throw new Error(`Unknown workspace export ${args.path}`);
        return { path: resolve(workspace.directory, target.replace('./dist/', './src/').replace(/\.js$/, '.ts')) };
      });
    } }],
  });
  await import(pathToFileURL(entry).href);
} finally { await rm(temporary, { recursive: true, force: true }); }

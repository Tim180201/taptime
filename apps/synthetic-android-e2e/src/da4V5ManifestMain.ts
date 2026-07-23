import { writeFile } from 'node:fs/promises';
import { createDa4V5ArtifactManifest } from './Da4V5AdminWebServer.js';

const argumentsByName = new Map<string, string>();
for (let index = 2; index < process.argv.length; index += 2) {
  const name = process.argv[index];
  const value = process.argv[index + 1];
  if (name === undefined || value === undefined || !name.startsWith('--')) {
    throw new Error('DA4 V5 manifest arguments are invalid');
  }
  argumentsByName.set(name, value);
}
if (
  argumentsByName.size !== 2
  || !argumentsByName.has('--root')
  || !argumentsByName.has('--output')
) {
  throw new Error('DA4 V5 manifest requires --root and --output');
}
const root = argumentsByName.get('--root') as string;
const output = argumentsByName.get('--output') as string;
const manifest = await createDa4V5ArtifactManifest(root);
await writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`, {
  encoding: 'utf8',
  flag: 'wx',
  mode: 0o444,
});
process.stdout.write('da4_v5_admin_web_manifest_created\n');

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = process.argv[2];
if (!output) throw new Error('Usage: node scripts/renderStoreDrafts.mjs <output-directory>');
const source = resolve(root, 'docs/store');
const destination = resolve(output);
if (destination === source) throw new Error('Keep generated output separate from the source templates');
const { name } = JSON.parse(readFileSync(resolve(root, 'shared/product.json'), 'utf8'));
mkdirSync(destination, { recursive: true });
for (const file of readdirSync(source).filter(file => file.endsWith('.md') && file !== 'README.md')) {
  const template = readFileSync(resolve(source, file), 'utf8');
  writeFileSync(resolve(destination, file), template.replaceAll('{{APP_NAME}}', name));
}

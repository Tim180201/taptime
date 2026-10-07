// @vitest-environment node
import { readFileSync, readdirSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import ts from 'typescript';
import { expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../../..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
  entry.isDirectory() ? files(join(dir, entry.name)) : /\.(tsx?|html)$/.test(entry.name) ? [join(dir, entry.name)] : []);

it('uses one product-name source and detects literal spellings in visible application strings', () => {
  const product = JSON.parse(read('shared/product.json'));
  expect(product.name.trim()).not.toBe('');
  const failures: string[] = [];
  const diagnosticOnly = /^(?:TapTim\.e (?:response body|CSV response) exceeded its byte limit)$/;
  const literalBrand = /\b(?:taptura|taptim\.?e)\b/iu;
  const paths = ['apps/admin-web/src', 'apps/operator-web/src', 'apps/mobile/src'].flatMap(dir => files(join(root, dir)));
  for (const path of paths) {
    const ast = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true);
    const visit = (node: ts.Node) => {
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return;
      if ((ts.isStringLiteralLike(node) || ts.isJsxText(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node))
        && literalBrand.test(node.text) && !diagnosticOnly.test(node.text) && !/^(?:@taptime\/|taptime[-.:/]|application\/vnd\.taptime\.|X-TapTime-|\^attachment; filename=|\.\.\/)/.test(node.text)) failures.push(`${path.slice(root.length + 1)}: ${node.text.trim()}`);
      ts.forEachChild(node, visit);
    };
    visit(ast);
  }
  for (const path of ['apps/landing-web/index.html', 'apps/landing-web/tag.html', 'apps/landing-web/app.html', 'apps/admin-web/index.html', 'apps/operator-web/index.html']) {
    expect(read(path), path).toContain('%APP_NAME%');
    if (literalBrand.test(read(path))) failures.push(path);
  }
  expect(failures).toEqual([]);
});

it('adds the token-free app download after the invitation link', () => {
  const template = read('docs/T-047-Einladungsvorlage.md');
  expect(template).toContain('<a href="https://tb-infra.de/app">App laden</a>');
  expect(template.indexOf('>App laden</a>')).toBeGreaterThan(template.indexOf('>Passwort setzen</a>'));
  expect(template).not.toContain('Der einzige Link');
});

it('provides marked store drafts with privacy evidence and no invented review credentials', () => {
  for (const file of ['listing.md', 'privacy.md', 'review.md']) {
    const source = read(`docs/store/${file}`);
    expect(source).toContain('Entwurf, rechtliche Prüfung mit B15');
    expect(source).toContain('{{APP_NAME}}');
    expect(source).not.toMatch(/\b(?:taptura|TapTim\.e)\b/iu);
  }
  const privacy = read('docs/store/privacy.md');
  expect(privacy).toContain('Apple');
  expect(privacy).toContain('Google');
  expect(privacy).toContain('apps/mobile/src/');
  expect(read('docs/store/review.md')).toContain('Demo-Zugang');
});

it('renders the store material from the same name source without changing its templates', () => {
  const output = mkdtempSync(join(tmpdir(), 't109-store-'));
  const product = JSON.parse(read('shared/product.json'));
  try {
    execFileSync(process.execPath, ['scripts/renderStoreDrafts.mjs', output], { cwd: root });
    for (const file of readdirSync(output)) {
      expect(readFileSync(join(output, file), 'utf8')).toBe(read(`docs/store/${file}`).replaceAll('{{APP_NAME}}', product.name));
    }
  } finally { rmSync(output, { recursive: true, force: true }); }
});

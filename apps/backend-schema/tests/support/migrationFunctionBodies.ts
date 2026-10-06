import type { Migration } from '../../src/migrations.js';

interface Token { readonly text: string; readonly body?: string }
export interface FunctionBody {
  readonly name: string;
  readonly body: string;
  readonly migration: string;
}

// Only top-level SQL is inspected. Quoted bodies/strings are opaque, so CREATE text
// inside a DO block or a function cannot masquerade as an explicit definition.
function* statements(sql: string): Generator<readonly Token[]> {
  let tokens: Token[] = [], position = 0;
  while (position < sql.length) {
    const remaining = sql.slice(position);
    const whitespace = /^\s+/.exec(remaining);
    if (whitespace) { position += whitespace[0].length; continue; }
    if (remaining.startsWith('--')) {
      const end = sql.indexOf('\n', position);
      position = end < 0 ? sql.length : end + 1;
      continue;
    }
    if (remaining.startsWith('/*')) {
      let depth = 1; position += 2;
      while (depth && position < sql.length) {
        if (sql.startsWith('/*', position)) { depth++; position += 2; }
        else if (sql.startsWith('*/', position)) { depth--; position += 2; }
        else position++;
      }
      if (depth) throw new Error('Unterminated SQL comment');
      continue;
    }
    const dollar = /^(\$(?:[A-Za-z_][A-Za-z_0-9]*)?\$)/.exec(remaining)?.[0];
    if (dollar) {
      const end = sql.indexOf(dollar, position + dollar.length);
      if (end < 0) throw new Error('Unterminated SQL dollar quote');
      tokens.push({ text: dollar, body: sql.slice(position + dollar.length, end) });
      position = end + dollar.length;
      continue;
    }
    const quoted = /^(?:E'(?:\\[\s\S]|''|[^'])*'|'(?:''|[^'])*'|"(?:""|[^"])*")/i.exec(remaining);
    if (quoted) { tokens.push({ text: quoted[0] }); position += quoted[0].length; continue; }
    const word = /^[A-Za-z_][A-Za-z_0-9$]*/.exec(remaining)?.[0];
    if (word) { tokens.push({ text: word }); position += word.length; continue; }
    const character = sql[position++]!;
    if (character === ';') { yield tokens; tokens = []; }
    else tokens.push({ text: character });
  }
  if (tokens.length) yield tokens;
}

export function latestFunctionBodies(migrations: readonly Migration[]): ReadonlyMap<string, FunctionBody> {
  const bodies = new Map<string, FunctionBody>();
  for (const migration of migrations) for (const statement of statements(migration.sql)) {
    const words = statement.map(token => token.text.toLowerCase());
    const create = words[0] === 'create';
    if (!create && words[0] !== 'alter' && words[0] !== 'drop') continue;
    const index = create && words[1] === 'or' && words[2] === 'replace' ? 3 : 1;
    if (words[index] !== 'function' || words[index + 1] !== 'taptime_server' || words[index + 2] !== '.') continue;
    const name = words[index + 3]!;
    if (words[index + 4] !== '(') throw new Error(`Unsupported function declaration: ${name}`);
    let depth = 1, end = index + 5, arity = words[end] === ')' ? 0 : 1;
    for (; end < words.length && depth; end++) {
      if (words[end] === '(') depth++;
      else if (words[end] === ')') depth--;
      else if (words[end] === ',' && depth === 1) arity++;
    }
    const key = `${name}/${arity}`;
    if (create) {
      const as = words.indexOf('as', end), body = statement[as + 1]?.body;
      if (as < 0 || body === undefined) throw new Error(`Expected explicit dollar-quoted body: ${name}`);
      bodies.set(key, { name, body, migration: `${migration.version}_${migration.name}` });
    } else if (words[0] === 'drop') bodies.delete(key);
    else if (words[end] === 'rename' && words[end + 1] === 'to') {
      const prior = bodies.get(key), renamed = words[end + 2]!;
      if (!prior) throw new Error(`No explicit body before rename: ${name}`);
      bodies.delete(key);
      bodies.set(`${renamed}/${arity}`, { ...prior, name: renamed });
    }
  }
  return bodies;
}

export interface StoredFunction { readonly name: string; readonly arity: number; readonly body: string }
export function functionBodyDrift(actual: readonly StoredFunction[], expected: ReadonlyMap<string, FunctionBody>): string[] {
  const seen = new Set<string>();
  return actual.flatMap(row => {
    const key = `${row.name}/${row.arity}`;
    // Current overloads have distinct arities. Fail explicitly if that ever changes.
    if (seen.has(key)) throw new Error(`Same-arity overload requires signature matching: ${key}`);
    seen.add(key);
    const declared = expected.get(key);
    return declared?.body === row.body ? [] : [`${key}: ${declared?.migration ?? 'no explicit CREATE'} differs from prosrc`];
  });
}

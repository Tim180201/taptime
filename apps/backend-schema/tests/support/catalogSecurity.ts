import type { PoolClient } from 'pg';
import { tenantPolicyExceptions } from './tenantPolicyExceptions.js';

export async function definerFindings(client: PoolClient): Promise<{ signature: string; kind: string }[]> {
  const result = await client.query<{ signature: string; kind: string }>(`
    WITH definers AS (
      SELECT p.*, r.rolcanlogin, r.rolsuper
      FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_roles r ON r.oid = p.proowner
      WHERE p.pronamespace = 'taptime_server'::regnamespace AND p.prosecdef
    )
    SELECT oid::regprocedure::text AS signature, 'path' AS kind FROM definers
      WHERE NOT COALESCE((SELECT array_agg(setting) FROM unnest(proconfig) setting
        WHERE setting LIKE 'search_path=%') = ARRAY['search_path=pg_catalog'], false)
    UNION ALL
    SELECT oid::regprocedure::text, 'owner' FROM definers WHERE rolcanlogin OR rolsuper
    UNION ALL
    SELECT DISTINCT d.oid::regprocedure::text, 'execute' FROM definers d
      CROSS JOIN LATERAL pg_catalog.aclexplode(COALESCE(d.proacl, pg_catalog.acldefault('f', d.proowner))) acl
      LEFT JOIN pg_catalog.pg_roles grantee ON grantee.oid = acl.grantee
      WHERE acl.privilege_type = 'EXECUTE' AND (acl.grantee = 0 OR grantee.rolcanlogin)
    ORDER BY signature, kind`);
  return result.rows;
}

// Deliberately a conservative recognizer, not a general SQL validator. Only an exact
// tenant equality at the top level, or a mandatory AND operand, proves this invariant.
// In particular an equality inside OR, NOT, a string or a subquery proves nothing.
function tenantBound(expression: string | null): boolean {
  if (expression === null) return false;
  let value = expression.trim();
  const scan = (text: string) => {
    let depth = 0, quoted = false;
    const and: number[] = [], or: number[] = [], closes: number[] = [];
    for (let i = 0; i < text.length; i++) {
      if (text[i] === "'") {
        if (quoted && text[i + 1] === "'") { i++; continue; }
        quoted = !quoted;
      }
      if (quoted) continue;
      if (text[i] === '(') depth++;
      if (text[i] === ')') { depth--; if (depth === 0) closes.push(i); }
      if (depth === 0 && text.startsWith(' AND ', i)) and.push(i);
      if (depth === 0 && text.startsWith(' OR ', i)) or.push(i);
    }
    return { and, or, closes };
  };
  while (value.startsWith('(') && scan(value).closes[0] === value.length - 1) value = value.slice(1, -1).trim();
  const tokens = scan(value);
  if (tokens.or.length > 0) return false;
  if (tokens.and.length > 0) {
    let start = 0;
    for (const end of [...tokens.and, value.length]) {
      if (tenantBound(value.slice(start, end))) return true;
      start = end + ' AND '.length;
    }
    return false;
  }
  return value === 'organization_id = taptime_server.current_organization_id()'
    || value === "organization_id = (NULLIF(current_setting('app.organization_id'::text, true), ''::text))::uuid";
}

export async function tenantPolicyFindings(client: PoolClient): Promise<string[]> {
  const result = await client.query<{
    table: string; policy: string; command: string; roles: string[];
    using: string | null; check: string | null; permissive: boolean;
  }>(`
    SELECT p.polrelid::regclass::text AS table, p.polname AS policy, p.polcmd AS command,
      ARRAY(SELECT CASE WHEN role_id = 0 THEN 'PUBLIC' ELSE pg_catalog.pg_get_userbyid(role_id)::text END
        FROM unnest(p.polroles) role_id ORDER BY 1) AS roles,
      pg_catalog.pg_get_expr(p.polqual, p.polrelid) AS using,
      pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid) AS check, p.polpermissive AS permissive
    FROM pg_catalog.pg_policy p
    JOIN pg_catalog.pg_class c ON c.oid = p.polrelid
    WHERE c.relnamespace = 'taptime_server'::regnamespace
      AND EXISTS (SELECT FROM pg_catalog.pg_attribute a
        WHERE a.attrelid = c.oid AND a.attname = 'organization_id' AND NOT a.attisdropped)
    ORDER BY 1, 2`);
  const findings: string[] = [];
  for (const row of result.rows) {
    const expressions: (string | null)[] = [];
    if (['r', 'w', 'd', '*'].includes(row.command)) expressions.push(row.using);
    if (['a', 'w', '*'].includes(row.command)) expressions.push(row.check ?? row.using);
    if (expressions.length > 0 && expressions.every(tenantBound)) continue;
    const exception = tenantPolicyExceptions.find(entry => entry.table === row.table && entry.policy === row.policy);
    if (exception?.reason && exception.command === row.command && row.permissive
      && JSON.stringify(exception.roles) === JSON.stringify(row.roles)
      && exception.using === row.using && exception.check === row.check) continue;
    findings.push(`${row.table}.${row.policy}`);
  }
  for (const exception of tenantPolicyExceptions) {
    if (!result.rows.some(row => row.table === exception.table && row.policy === exception.policy)) {
      findings.push(`stale exception: ${exception.table}.${exception.policy}`);
    }
  }
  return findings;
}

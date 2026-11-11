/** Additive discovery contract. Existing capture/reconciliation contracts are unchanged. */
export interface RestoreRecoveryStateV1 {
  readonly contractVersion: 1;
  readonly operation: null | {
    readonly id: string;
    readonly target: { readonly kind: 'latest' } | { readonly kind: 'point_in_time'; readonly time: string };
    readonly activatedAt: string;
  };
}

export function parseRestoreRecoveryStateV1(value: unknown): RestoreRecoveryStateV1 | null {
  if (!fields(value, ['contractVersion', 'operation']) || value.contractVersion !== 1) return null;
  if (value.operation === null) return { contractVersion: 1, operation: null };
  const operation = value.operation;
  if (!fields(operation, ['id', 'target', 'activatedAt']) || typeof operation.id !== 'string'
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(operation.id)
    || !timestamp(operation.activatedAt)) return null;
  const target = operation.target;
  if (fields(target, ['kind']) && target.kind === 'latest') {
    return { contractVersion: 1, operation: { id: operation.id, activatedAt: operation.activatedAt, target: { kind: 'latest' } } };
  }
  if (fields(target, ['kind', 'time']) && target.kind === 'point_in_time' && timestamp(target.time)) {
    return { contractVersion: 1, operation: { id: operation.id, activatedAt: operation.activatedAt,
      target: { kind: 'point_in_time', time: target.time } } };
  }
  return null;
}

function fields(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}
function timestamp(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3,6}Z$/.test(value)
    && Number.isFinite(Date.parse(value))
    && new Date(value).toISOString() === value.replace(/(\.\d{3})\d*Z$/, '$1Z');
}

// Zero-based registration order is shared by every shard. This helper owns only
// selection/counting; the caller keeps the original test options and bodies.
export function createLayoutShard(value) {
  let part = 1, parts = 1;
  if (value !== undefined) {
    if (value.trim() !== value || !/^[1-9]\d*\/[1-9]\d*$/.test(value)) {
      throw new Error('TAPTIME_LAYOUT_SHARD must be n/m with 1 <= n <= m');
    }
    [part, parts] = value.split('/').map(Number);
    if (!Number.isSafeInteger(part) || !Number.isSafeInteger(parts) || part > parts) {
      throw new Error('TAPTIME_LAYOUT_SHARD must use safe integers with 1 <= n <= m');
    }
  }
  let total = 0, selected = 0;
  return {
    register() {
      const included = total++ % parts === part - 1;
      if (included) selected += 1;
      return included;
    },
    assertNotEmpty() {
      if (selected === 0) throw new Error(`TAPTIME_LAYOUT_SHARD ${part}/${parts} selects no tests (${total} registered)`);
    },
    summary() { return { part, parts, selected, total }; },
  };
}

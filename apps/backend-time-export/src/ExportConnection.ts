import { Socket } from 'node:net';
import { Client, type Pool } from 'pg';

// The export owns its socket, including PostgreSQL startup. pg-pool cannot cancel
// a queued checkout or a handshake. Keep its configured concurrency, with an
// abortable admission queue, and never retain a connection after this request.
const capacity = new WeakMap<Pool, { active: number; waiting: (() => void)[] }>();
async function admit(pool: Pool, signal: AbortSignal): Promise<() => void> {
  if (signal.aborted || pool.ending) throw new Error('Export cancelled');
  let state = capacity.get(pool);
  if (!state) { state = { active: 0, waiting: [] }; capacity.set(pool, state); }
  const slots = state;
  await new Promise<void>((resolve, reject) => {
    const aborted = () => {
      slots.waiting = slots.waiting.filter(candidate => candidate !== start);
      reject(new Error('Export cancelled'));
    };
    const start = () => {
      signal.removeEventListener('abort', aborted);
      slots.active += 1;
      resolve();
    };
    signal.addEventListener('abort', aborted, { once: true });
    if (slots.active < (pool.options.max ?? 10)) start();
    else slots.waiting.push(start);
  });
  return () => { slots.active -= 1; slots.waiting.shift()?.(); };
}

export async function exportConnection(pool: Pool, signal: AbortSignal) {
  const leave = await admit(pool, signal);
  const socket = new Socket();
  // Abort may win immediately after admission, before pg installs its listeners.
  // The rejected operation carries that error; the owned socket must be safe too.
  socket.on('error', () => {});
  const client = new Client({ ...pool.options, password: pool.options.password, stream: () => socket,
    connectionTimeoutMillis: 0, query_timeout: 0, statement_timeout: 0 });
  let pid: number | undefined, failure: Error | undefined;
  let closed = false;
  let cancellation: Promise<void> | undefined, closing: Promise<void> | undefined;
  const failed = (error: Error) => { failure = error; };
  client.on('error', failed);
  const abort = () => {
    if (cancellation || closed) return;
    cancellation = (async () => {
      if (pid !== undefined) {
        // Separate from the admission queue. Same login: no wider cancel right.
        const cancel = new Client({ ...pool.options, password: pool.options.password, connectionTimeoutMillis: 250, query_timeout: 250, statement_timeout: 250 });
        cancel.on('error', () => {});
        try { await cancel.connect(); await cancel.query('SELECT pg_cancel_backend($1)', [pid]); }
        catch { /* The absolute transaction/statement deadline is the final bound. */ }
        finally { await cancel.end().catch(() => {}); }
      }
      socket.destroy(new Error('Export cancelled'));
    })();
  };
  signal.addEventListener('abort', abort, { once: true });
  const assertActive = () => {
    if (signal.aborted || failure || closing) throw failure ?? new Error('Export cancelled');
  };
  const close = (transactionOpen: boolean) => {
    if (signal.aborted) abort();
    return closing ??= (async () => {
      try {
        await cancellation;
        if (!signal.aborted && !failure && transactionOpen) await client.query('ROLLBACK');
      } finally {
        signal.removeEventListener('abort', abort);
        await client.end().catch(() => {});
        socket.destroy();
        client.off('error', failed);
        closed = true;
        leave();
      }
    })();
  };
  try {
    assertActive();
    await client.connect();
    assertActive();
    pid = (await client.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0]!.pid;
    assertActive();
  } catch (error) { await close(false); throw error; }
  return { client, assertActive, close };
}

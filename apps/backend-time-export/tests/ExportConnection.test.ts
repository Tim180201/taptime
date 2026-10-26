import { createServer, type Socket } from 'node:net';
import { once } from 'node:events';
import { Pool } from 'pg';
import { expect, it } from 'vitest';
import { exportConnection } from '../src/ExportConnection.js';

it('destroys a stalled PostgreSQL startup and removes an aborted capacity waiter', async () => {
  const sockets = new Set<Socket>();
  const server = createServer(socket => { sockets.add(socket); socket.resume(); socket.once('close', () => sockets.delete(socket)); });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing test address');
  const pool = new Pool({ host: '127.0.0.1', port: address.port, user: 'synthetic', max: 1 });
  const first = new AbortController(), queued = new AbortController(), third = new AbortController();
  try {
    const accepted = once(server, 'connection');
    const firstResult = exportConnection(pool, first.signal).catch(error => error);
    await accepted;
    const queuedResult = exportConnection(pool, queued.signal).catch(error => error);
    queued.abort();
    expect(await queuedResult).toBeInstanceOf(Error);
    expect(sockets.size).toBe(1);
    const closed = once([...sockets][0]!, 'close');
    first.abort();
    expect(await firstResult).toBeInstanceOf(Error);
    await closed;
    expect(sockets.size).toBe(0);
    // A later request can acquire capacity; the cancelled waiter cannot consume it.
    const acceptedAgain = once(server, 'connection');
    const thirdResult = exportConnection(pool, third.signal).catch(error => error);
    await acceptedAgain;
    const closedAgain = once([...sockets][0]!, 'close');
    third.abort();
    expect(await thirdResult).toBeInstanceOf(Error);
    await closedAgain;
  } finally {
    first.abort(); queued.abort(); third.abort();
    for (const socket of sockets) socket.destroy();
    await pool.end();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

it('handles an immediate abort before pg attaches its startup listeners', async () => {
  const pool = new Pool({host:'127.0.0.1',port:1,user:'synthetic',max:1});
  try {
    const abort = new AbortController();
    const pending = exportConnection(pool,abort.signal);
    abort.abort();
    await expect(pending).rejects.toThrow('Export cancelled');
    // Surface socket events queued after the rejection, not just the promise.
    await new Promise<void>(resolve => setImmediate(resolve));
  } finally { await pool.end(); }
});

import { expect, it, vi } from 'vitest';
import { ProductRuntimeStartup } from '../../src/runtime/ProductRuntimeStartup';

it.each(['active','button'] as const)('T-115 recovers a thrown runtime start via %s, with a restoring state and single flight',async trigger=>{
  let active=()=>{};
  const runtime={start:vi.fn(async()=>{}).mockRejectedValueOnce(new Error('startup')),stop:vi.fn()};
  const startup=new ProductRuntimeStartup(runtime,listener=>{active=listener;return()=>{};});
  await startup.start();expect(startup.getState()).toBe('failed');
  let done!:()=>void;runtime.start.mockImplementation(()=>new Promise(r=>{done=r;}));
  if(trigger==='active')active();else void startup.retry();
  expect(startup.getState()).toBe('starting');active();void startup.retry();
  expect(runtime.stop).toHaveBeenCalledOnce();expect(runtime.start).toHaveBeenCalledTimes(2);
  done();await vi.waitFor(()=>expect(startup.getState()).toBe('ready'));
  active();expect(runtime.start).toHaveBeenCalledTimes(2);startup.stop();
});

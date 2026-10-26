import { randomBytes, randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { expect, it, vi } from 'vitest';
import { LockScreenCoordinator } from '../src/LockScreenCoordinator.js';

it.each([false,true])('T104e R2: preserves the archive-read error and discards only a failed rollback (rollback fails=%s)',async rollbackFails=>{
  const id=randomUUID(),capability=randomBytes(32).toString('base64url');
  const state={timeEntryId:id,status:'running',startedAt:'2026-10-21T06:00:00.000Z',stoppedAt:null,
    breakStartedAt:null,asOf:'2026-10-21T06:01:00.000Z',workDurationSeconds:60,breakDurationSeconds:0,
    target:{targetType:'customer',targetId:id,displayName:'Testziel'}};
  const original=Object.assign(new Error('original database detail'),{code:'P0068'});
  const client={release:vi.fn(),query:vi.fn(async(sql:string)=>{
    if(sql.includes('perform_lock_screen_action_v1'))return {rows:[{value:{status:'state_changed',state,
      actor:{organization_id:id,user_id:id,membership_id:id,membership_role:'employee'},events:[],idempotentRetry:false}}]};
    if(sql.includes('lock_screen_archive_status_v1'))throw original;
    if(sql==='ROLLBACK'&&rollbackFails)throw Error('rollback database detail');
    return {rows:[]};
  })};
  const coordinator=new LockScreenCoordinator({connect:async()=>client} as unknown as Pool,
    {verify:async()=>{throw Error('Capability actions must not use JWT verification');}});
  // The original P0068 must still determine the sanitized public error, never the rollback failure.
  await expect(coordinator.perform(capability,{action:'pause',commandId:randomUUID()},'lock-screen-action.v2'))
    .rejects.toThrow('Lock screen authority unavailable');
  expect(client.query).toHaveBeenCalledWith('ROLLBACK');
  expect(client.release).toHaveBeenCalledExactlyOnceWith(rollbackFails);
});

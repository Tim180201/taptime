import {NodeSqliteOfflineConnection} from '../support/NodeSqliteOfflineConnection';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { OfflineCaptureDatabase,OFFLINE_LOCAL_SCHEMA_VERSION_V8,OFFLINE_SCHEMA_V7,OFFLINE_SCHEMA_V8 } from '../../src/offline/OfflineCaptureDatabase';

describe('OfflineCaptureDatabase production schema', () => {
  it('executes the complete production schema with real SQLite', () => {
    expect(() => executeWithRealSqlite(OFFLINE_SCHEMA_V8)).not.toThrow();
  });

  it('rejects an intentional syntax error through the same real SQLite path', () => {
    const invalidSchema = OFFLINE_SCHEMA_V8.replace(
      'CREATE TABLE offline_owner',
      'CREATE TABL offline_owner',
    );
    expect(invalidSchema).not.toBe(OFFLINE_SCHEMA_V8);
    expect(() => executeWithRealSqlite(invalidSchema)).toThrow(/syntax error/u);
  });
});

function executeWithRealSqlite(schema: string): void {
  const database = new DatabaseSync(':memory:');
  try {
    database.exec(schema);
  } finally {
    database.close();
  }
}

it('T140 migrates an existing V7 owner and stores exactly one owner-bound confirmed baseline',async()=>{
  const connection=new NodeSqliteOfflineConnection();
  await connection.execAsync(OFFLINE_SCHEMA_V7+'PRAGMA user_version=7;');
  const owner={organizationId:'10000000-0000-4000-8000-000000000001',userId:'20000000-0000-4000-8000-000000000001',membershipId:'30000000-0000-4000-8000-000000000001'};
  await connection.runAsync('INSERT INTO offline_owner(singleton_id,organization_id,user_id,membership_id,installation_binding_digest) VALUES (1,?,?,?,?)',[owner.organizationId,owner.userId,owner.membershipId,'a'.repeat(64)]);
  const before=await connection.getFirstAsync<Record<string,unknown>>('SELECT * FROM offline_owner');
  const db=new OfflineCaptureDatabase(async()=>connection,new Uint8Array(32));
  try{
    expect(await db.initialize()).toEqual({status:'ready'});
    expect(await connection.getFirstAsync('PRAGMA user_version')).toEqual({user_version:OFFLINE_LOCAL_SCHEMA_VERSION_V8});
    expect(await connection.getFirstAsync('SELECT * FROM offline_owner')).toEqual({...before,confirmed_own_time_json:null});
    const value={activeTimeId:'40000000-0000-4000-8000-000000000001',target:{targetType:'customer' as const,targetId:'50000000-0000-4000-8000-000000000001',displayName:'Werkstatt'},startedAt:'2026-10-29T08:00:00.000Z',breakStartedAt:'2026-10-29T09:00:00.000Z',confirmedAt:'2026-10-29T09:01:00.000Z'};
    expect(await db.saveConfirmedOwnTime(owner,value)).toBe(true);
    expect(await db.readConfirmedOwnTime(owner)).toEqual(value);
    for(const field of ['organizationId','userId','membershipId'] as const){
      const foreign={...owner,[field]:value.activeTimeId};
      expect(await db.readConfirmedOwnTime(foreign)).toBeNull();
      expect(await db.saveConfirmedOwnTime(foreign,value)).toBe(false);
    }
    await expect(db.saveConfirmedOwnTime(owner,{...value,history:[]} as typeof value)).rejects.toThrow('Invalid');
    const idle={activeTimeId:null,target:null,startedAt:null,breakStartedAt:null,confirmedAt:'2026-10-29T10:00:00.000Z'};
    expect(await db.saveConfirmedOwnTime(owner,idle)).toBe(true);
    expect(await connection.getAllAsync('SELECT confirmed_own_time_json FROM offline_owner')).toEqual([{confirmed_own_time_json:JSON.stringify(idle)}]);
    await db.invalidateCapture();
    expect(await connection.getFirstAsync('SELECT confirmed_own_time_json FROM offline_owner')).toEqual({confirmed_own_time_json:null});
  }finally{await db.close();}
});

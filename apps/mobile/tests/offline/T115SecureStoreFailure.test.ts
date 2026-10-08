import { describe, expect, it, vi } from 'vitest';
vi.mock('expo-secure-store',()=>({WHEN_UNLOCKED_THIS_DEVICE_ONLY:'device'}));
vi.mock('expo-crypto',()=>({getRandomBytesAsync:vi.fn()}));
import { OfflineAccountStorage } from '../../src/offline/OfflineAccountStorage';
import { OfflineInstallationIdentityStore } from '../../src/offline/OfflineInstallationIdentityStore';
import { OfflineCaptureDatabase } from '../../src/offline/OfflineCaptureDatabase';
import { MemoryOfflineDatabase, memorySecureStore } from '../support/MemoryOfflinePlatform';
import { encodeBase64Url } from '../../src/offline/encoding';

const key='taptime.offline.generations.v1';
const bytes=encodeBase64Url(new Uint8Array(32).fill(6));
const generation={name:`taptime-offline-g-${bytes}.db`,installationBinding:bytes,databaseKey:bytes,lookupKey:null,initializing:true};

describe('T-115 TL native read/write error boundary',()=>{
  it.each(['legacy-read','legacy-write','generation-read','generation-write','readback'] as const)('retains the native cause from loadOrCreate: %s',async(failure)=>{
    const secure=memorySecureStore();let writes=0;
    if(failure.startsWith('generation') || failure==='readback') secure.values.set(key,JSON.stringify({version:1,active:generation,retired:[],prepared:null}));
    const port={...secure.port,getItemAsync:async(...args:Parameters<typeof secure.port.getItemAsync>)=>{
      if(failure==='legacy-read' && args[0]!==key || failure==='generation-read' && args[0]===key || failure==='readback' && writes>0)throw new Error('native read failed');
      return secure.port.getItemAsync(...args);
    },setItemAsync:async(...args:Parameters<typeof secure.port.setItemAsync>)=>{
      if(failure==='legacy-write' || failure==='generation-write')throw new Error('native write failed');
      writes++;return secure.port.setItemAsync(...args);
    }};
    const storage=new OfflineAccountStorage(port,async n=>new Uint8Array(n).fill(6),()=>new OfflineCaptureDatabase(async()=>new MemoryOfflineDatabase(),new Uint8Array(32)),{list:async()=>[],remove:async()=>{}});
    await expect(storage.loadOrCreate()).rejects.toMatchObject({name:'OfflineSecureStoreError'});
  });
  it.each(['read','write'] as const)('marks the direct identity-store native %s failure',async(failure)=>{
    const secure=memorySecureStore();
    const port={...secure.port,getItemAsync:async(...args:Parameters<typeof secure.port.getItemAsync>)=>{
      if(failure==='read')throw new Error('native read failed');return secure.port.getItemAsync(...args);
    },setItemAsync:async()=>{throw new Error('native write failed');}};
    await expect(new OfflineInstallationIdentityStore(port,async n=>new Uint8Array(n).fill(6)).loadOrCreate()).rejects.toMatchObject({name:'OfflineSecureStoreError'});
  });
  it.each(['prepared','files','legacy-not-ready','readback-mismatch','random','unavailable'] as const)('keeps its own %s protection nonretryable',async(failure)=>{
    const secure=memorySecureStore();
    if(failure==='prepared' || failure==='readback-mismatch')secure.values.set(key,JSON.stringify({version:1,active:generation,retired:[],prepared:failure==='prepared'?{...generation,name:'taptime-offline.db'}:null}));
    const port={...secure.port,isAvailableAsync:async()=>failure!=='unavailable',setItemAsync:async(...args:Parameters<typeof secure.port.setItemAsync>)=>{
      if(failure!=='readback-mismatch')await secure.port.setItemAsync(...args);
    }};
    const storage=new OfflineAccountStorage(port,async n=>{if(failure==='random')throw new Error('random failed');return new Uint8Array(n).fill(6);},()=>new OfflineCaptureDatabase(async()=>new MemoryOfflineDatabase(),new Uint8Array(32)),{list:async()=>failure==='files'?['unknown.db']:failure==='legacy-not-ready'?['taptime-offline.db']:[],remove:async()=>{}});
    await expect(storage.loadOrCreate()).resolves.toEqual({status:'protected',reason:'missing_key'});
  });
});

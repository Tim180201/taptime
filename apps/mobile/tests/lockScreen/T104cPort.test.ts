import { expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({platform:{OS:'ios'},lookup:vi.fn(),settings:vi.fn(async()=>{})}));
vi.mock('react-native',()=>({Platform:mocks.platform,Linking:{openSettings:mocks.settings}}));
vi.mock('expo-modules-core',()=>({requireOptionalNativeModule:mocks.lookup}));
import { createIosLockScreen } from '../../src/lockScreen/IosLockScreen';
it('uses the iOS module, allowlists bridge data, never prompts and uses the variant link',async()=>{
  const native={read:()=>JSON.stringify({permissionGranted:false,permissionAsked:true,capability:'hidden',keyID:'hidden'}),issue:vi.fn(async()=> 'unauthorized')};
  mocks.lookup.mockReturnValue(native);
  const port=createIosLockScreen('https://example.invalid','ios-version','taptime-production-validation')!;
  expect(mocks.lookup).toHaveBeenCalledWith('TapTimeIosLockScreen');
  expect(port.foregroundOnly).toBe(true);expect(port.read()).not.toHaveProperty('capability');expect(port.read()).not.toHaveProperty('keyID');
  expect(port.read()?.permissionGranted).toBe(false);
  expect(port.isCaptureUrl?.('taptime-production-validation://lock-screen/capture')).toBe(true);
  expect(port.isCaptureUrl?.('taptime://lock-screen/capture')).toBe(false);
  await expect(port.ensurePermission()).resolves.toBeUndefined();
  port.openSettings();expect(mocks.settings).toHaveBeenCalledOnce();
});
it('never loads an iOS module on Android',()=>{
  mocks.lookup.mockClear();mocks.platform.OS='android';
  expect(createIosLockScreen('https://example.invalid','ios-version','taptime')).toBeNull();expect(mocks.lookup).not.toHaveBeenCalled();
});
it('only bridges the fixed last-tap shape and outcome codes',()=>{
  mocks.platform.OS='ios';
  const lastTap={at:'2026-11-10T07:00:00.000Z',performRan:true,appState:'background',protectedDataAvailable:false,result:'nonce_changed'};
  let raw:unknown=lastTap;
  mocks.lookup.mockReturnValue({read:()=>JSON.stringify({permissionGranted:true,permissionAsked:true,lastTap:raw})});
  const port=createIosLockScreen('https://example.invalid','test','taptime')!;
  expect(port.read()?.lastTap).toEqual(lastTap);
  for(const invalid of [{...lastTap,capability:'secret'},{...lastTap,result:'server response body'},
    {...lastTap,appState:'owner'},{...lastTap,at:'invalid'},{...lastTap,protectedDataAvailable:'yes'}]){
    raw=invalid;expect(port.read()?.lastTap).toBeUndefined();
  }
});

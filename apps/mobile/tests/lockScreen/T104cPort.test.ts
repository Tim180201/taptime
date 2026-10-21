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

import { expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({platform:{OS:'ios',Version:33},lookup:vi.fn(),request:vi.fn(),alert:vi.fn(),settings:vi.fn()}));
vi.mock('react-native',()=>({Platform:mocks.platform,PermissionsAndroid:{request:mocks.request,PERMISSIONS:{POST_NOTIFICATIONS:'android.permission.POST_NOTIFICATIONS'}},Alert:{alert:mocks.alert},Linking:{openSettings:mocks.settings}}));
vi.mock('expo-modules-core',()=>({requireOptionalNativeModule:mocks.lookup}));
import { createNativeLockScreen } from '../../src/lockScreen/NativeLockScreen';
it('iOS never loads the Android module and cannot request, send or change permissions',()=>{
  mocks.platform.OS='ios';expect(createNativeLockScreen('https://example.test','test')).toBeNull();
  expect(mocks.lookup).not.toHaveBeenCalled();expect(mocks.request).not.toHaveBeenCalled();expect(mocks.alert).not.toHaveBeenCalled();
});
it('Android asks only once after explaining, and rejects extra secret fields in the bridge result',async()=>{
  mocks.platform.OS='android';let asked=false;
  const native={read:()=>JSON.stringify({permissionGranted:false,permissionAsked:asked,capability:'must-not-cross'}),
    claimPermissionPrompt:()=>{if(asked)return false;asked=true;return true;}};
  mocks.lookup.mockReturnValue(native);mocks.alert.mockImplementation((_title,_message,buttons)=>buttons[0].onPress());
  const port=createNativeLockScreen('https://example.test','test')!;
  expect(port.read()).not.toHaveProperty('capability');
  await port.ensurePermission();await port.ensurePermission();
  expect(mocks.alert).toHaveBeenCalledOnce();expect(mocks.request).toHaveBeenCalledExactlyOnceWith('android.permission.POST_NOTIFICATIONS');
});

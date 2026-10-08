import { beforeEach, expect, it, vi } from 'vitest';
const h=vi.hoisted(()=>({os:'ios',registered:true,register:vi.fn(),unregister:vi.fn(),trigger:vi.fn(),close:vi.fn(),define:vi.fn()}));
vi.mock('react-native',()=>({Platform:{get OS(){return h.os;}}}));
vi.mock('expo-background-task',()=>({BackgroundTaskStatus:{Available:1},BackgroundTaskResult:{Failed:0,Success:1},getStatusAsync:async()=>1,registerTaskAsync:h.register,unregisterTaskAsync:h.unregister}));
vi.mock('expo-task-manager',()=>({isTaskDefined:()=>false,defineTask:h.define,isTaskRegisteredAsync:async()=>h.registered}));
vi.mock('../../modules/taptime-nfc-ingress',()=>({default:{closeProcessStartIntentWindow:h.close}}));
beforeEach(()=>{vi.resetModules();vi.clearAllMocks();h.registered=true;});
it('T-115 removes an old iOS registration and never registers it again',async()=>{
  h.os='ios';const m=await import('../../src/offline/registerOfflineBackgroundTask');await m.registerOfflineBackgroundTask();
  expect(h.unregister).toHaveBeenCalledWith(m.OFFLINE_BACKGROUND_TASK_NAME);expect(h.register).not.toHaveBeenCalled();
  h.registered=false;await m.registerOfflineBackgroundTask();expect(h.register).not.toHaveBeenCalled();
});
it('T-115 leaves Android registration and headless ingress closure intact',async()=>{
  h.os='android';h.registered=false;const m=await import('../../src/offline/registerOfflineBackgroundTask');await m.registerOfflineBackgroundTask();
  expect(h.register).toHaveBeenCalledWith(m.OFFLINE_BACKGROUND_TASK_NAME,expect.any(Object));expect(h.unregister).not.toHaveBeenCalled();
  await h.define.mock.calls[0][1]({error:null});expect(h.close).toHaveBeenCalledOnce();
});

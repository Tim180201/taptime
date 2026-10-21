import { expect, it, vi } from 'vitest';
import { MobileSessionCoordinator } from '../../src/auth/MobileSessionCoordinator';
import { issueCapability } from '../../src/lockScreen/issueCapability';
import type { ProviderAuthPort, RefreshTokenStore } from '../../src/auth/contracts';

it('two capability 401s keep a real authenticated MobileSessionCoordinator signed in',async()=>{
  const provider:ProviderAuthPort={signInWithPassword:async()=>({status:'authenticated',tokens:{accessToken:'first',refreshToken:'refresh'}}),
    refreshSession:vi.fn(async()=>({status:'refreshed' as const,tokens:{accessToken:'second',refreshToken:'rotated'}})),
    signOutLocal:vi.fn(async()=>{}),subscribe:()=>()=>{},startAutoRefresh:async()=>{},stopAutoRefresh:async()=>{}};
  const store:RefreshTokenStore={isAvailable:async()=>true,read:async()=>null,write:vi.fn(async()=>{}),clear:vi.fn(async()=>{}),readIdentity:async()=>null,writeIdentity:async()=>{}};
  const session={userId:'10000000-0000-4000-8000-000000000001',membershipId:'12000000-0000-4000-8000-000000000001',organizationId:'00000000-0000-4000-8000-000000000001',role:'employee' as const,nfcSetupAvailable:false};
  const auth=new MobileSessionCoordinator(provider,store,{resolve:async()=>({status:'resolved',session}),recordPasswordReset:async()=>({status:'recorded'})},{redeem:async()=>({status:'enrollment_unavailable'})},()=> '99000000-0000-4000-8000-000000000001');
  await auth.start();await auth.signIn('test@example.invalid','test-password');
  expect(auth.getState().status).toBe('authenticated');
  const clearCalls=vi.mocked(store.clear).mock.calls.length;
  const tokens:string[]=[];
  const result=await issueCapability(auth,async token=>{tokens.push(token);return 'unauthorized';},()=>auth.getState().status==='authenticated');
  expect(result).toBe('unauthorized');expect(tokens).toEqual(['first','second']);
  expect(auth.getState()).toMatchObject({status:'authenticated',session});
  expect(provider.signOutLocal).not.toHaveBeenCalled();expect(store.clear).toHaveBeenCalledTimes(clearCalls);
  expect(provider.refreshSession).toHaveBeenCalledOnce();auth.stop();
});

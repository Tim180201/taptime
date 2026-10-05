import { describe, expect, it, vi } from 'vitest';
import { versionedAppFetch } from '../../src/transport/versionedAppFetch';
describe('T-096 request metadata',()=>{
  it('adds native platform, build and commit to every request and reports 426',async()=>{
    const send=vi.fn<typeof fetch>(async()=>new Response('{}',{status:426}));const outdated=vi.fn();
    const request=versionedAppFetch(send,{platform:'android',build:12,commit:'a'.repeat(40)},outdated);
    await request('https://api.example/v1/session',{headers:{Authorization:'Bearer aaa.bbb.ccc'}});
    expect(new Headers(send.mock.calls[0]![1]!.headers).get('X-TapTime-App')).toBe(`v1;android;12;${'a'.repeat(40)}`);
    expect(outdated).toHaveBeenCalledWith('aaa.bbb.ccc');
  });
});

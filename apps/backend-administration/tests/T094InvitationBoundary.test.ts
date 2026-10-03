import { randomUUID, createHash } from 'node:crypto';
import { expect, it, vi } from 'vitest';
import { SupabaseAccountInviter, normalizeInvitationEmail, accountInvitationEmailHash } from '../src/SupabaseAccountInviter.js';
const subject = '93000000-0000-4000-8000-000000000094';
const email = 'person@example.test';
const context = () => ({ correlationId: randomUUID(), deadlineEpochMilliseconds: Date.now() + 8000 });
it('normalizes NFC before case folding and locks canonically equivalent addresses together', () => {
  expect(normalizeInvitationEmail(' E\u0301@example.test ')).toBe('é@example.test');
  expect(accountInvitationEmailHash('E\u0301@example.test')).toEqual(accountInvitationEmailHash('é@example.test'));
});
it('never exposes an address fingerprint in provider diagnostics', async () => {
  const diagnostics: unknown[] = [];
  const remote = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({users:[]}))
    .mockResolvedValueOnce(Response.json({id:subject,email,invited_at:'2026-10-03T10:00:00Z'}));
  const inviter = new SupabaseAccountInviter('https://synthetic.invalid/auth/v1', 'synthetic-key',
    'https://admin.example.test/willkommen', d => diagnostics.push(d), async(input,init)=>new URL(String(input)).pathname.endsWith('/settings')?Response.json({disable_signup:true,mailer_autoconfirm:false}):remote(input,init),'synthetic-public-key');
  await inviter.invite(email,context());
  const fingerprint = createHash('sha256').update('taptime:invitation-email:v1\0').update(email).digest('hex');
  expect(JSON.stringify(diagnostics)).not.toContain(fingerprint);
  expect(JSON.stringify(diagnostics)).not.toContain(email);
});
it.each([{disable_signup:false,mailer_autoconfirm:false},{disable_signup:true,mailer_autoconfirm:true},{}])('blocks unsafe settings before any privileged request: %j', async settings=>{
  const diagnostics:unknown[]=[];
  const remote=vi.fn<typeof fetch>().mockImplementation(async input=>{
    const path=new URL(String(input)).pathname;
    if(path.endsWith('/settings')) return Response.json(settings);
    if(path.endsWith('/admin/users')) return Response.json({users:[]});
    return Response.json({id:subject,email,invited_at:'2026-10-03T10:00:00Z'});
  });
  const inviter=new SupabaseAccountInviter('https://synthetic.invalid/auth/v1','synthetic-secret',
    'https://admin.example.test/willkommen',d=>diagnostics.push(d),remote,'synthetic-public');
  expect(await inviter.invite(email,context())).toEqual({status:'account_creation_not_configured'});
  expect(remote.mock.calls).toHaveLength(1);
  expect(new Headers(remote.mock.calls[0]![1]?.headers).get('apikey')).toBe('synthetic-public');
  expect(new Headers(remote.mock.calls[0]![1]?.headers).has('Authorization')).toBe(false);
  expect(diagnostics).toContainEqual(expect.objectContaining({reason: expect.stringMatching(/^settings_/)}));
});
it('bounds public settings at 64 KiB and reports settings_unavailable without privileged requests', async()=>{
  const diagnostics:unknown[]=[];
  const remote=vi.fn<typeof fetch>().mockImplementation(async()=>new Response(JSON.stringify({disable_signup:true,mailer_autoconfirm:false,padding:'x'.repeat(65_536)})));
  const inviter=new SupabaseAccountInviter('https://synthetic.invalid/auth/v1','synthetic-secret',
    'https://admin.example.test/willkommen',d=>diagnostics.push(d),remote,'synthetic-public');
  expect(await inviter.invite(email,context())).toEqual({status:'account_creation_not_configured'});
  expect(remote).toHaveBeenCalledTimes(1);
  expect(diagnostics).toContainEqual(expect.objectContaining({reason:'settings_unavailable'}));
});

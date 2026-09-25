// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EmployeeAccountInvitationForm, EmployeeAccountInvitationClient } from '../src/EmployeeAccountInvitationForm';
import type { EmployeeAccountInvitationCapability } from '../src/EmployeeAccountInvitationForm';
import { ACCOUNT_INVITATION_NOTICES, ACCOUNT_INVITATION_SUCCESS_NOTICES } from '../src/accountInvitation';
import { AdminWebApiClient } from '../src/AdminWebApiClient';
const membershipId = '93000000-0000-4000-8000-000000000047';
afterEach(cleanup);
function Harness({ capability }: { capability: EmployeeAccountInvitationCapability }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  return <>{message === null ? null : <p role="status">{message}</p>}
    <EmployeeAccountInvitationForm capability={capability} open={open} setOpen={setOpen}
      onCreated={async (status) => { setMessage(ACCOUNT_INVITATION_SUCCESS_NOTICES[status]); }}
      state={{ locationsEnabled: false, selectedLocation: null, assignableLocations: [] }} /></>;
}
function fill() {
  fireEvent.click(screen.getByRole('button', { name: 'Mitarbeiter hinzufügen' }));
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Neue Person' } });
  fireEvent.change(screen.getByLabelText('E-Mail'), { target: { value: 'person@example.test' } });
  fireEvent.click(screen.getByRole('button', { name: 'Einladung senden' }));
}

describe('T-047 employee account interface', () => {
  it('submits name and email, clears only after success, and never asks for a code or role', async () => {
    const invite = vi.fn<EmployeeAccountInvitationCapability['invite']>(async () => ({ status: 'succeeded' }));
    render(<Harness capability={{ invite }} />);
    fill();
    expect(await screen.findByRole('status')).toHaveTextContent('Einladung verschickt.');
    expect(invite).toHaveBeenCalledWith('Neue Person', 'person@example.test', null);
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Code|Rolle|Geheimnis/);
  });
  it('explains existing-account success without claiming a mail and asks the administrator to inform the person', async () => {
    render(<Harness capability={{ invite: async () => ({ status: 'succeeded_existing_account' }) }} />);
    fill();
    const message = await screen.findByRole('status');
    expect(message).toHaveTextContent('Das Konto besteht bereits; es wurde keine E-Mail verschickt.');
    expect(message).toHaveTextContent('ihr Passwort');
    expect(message).toHaveTextContent('Passwort vergessen');
    expect(message).toHaveTextContent('Informieren Sie die Person,');
    expect(message).not.toHaveTextContent('Einladung verschickt.');
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
  });
  it('describes email_exists only as belonging to another organization', async () => {
    render(<Harness capability={{ invite: async () => ({ status: 'failed', code: 'email_exists' }) }} />);
    fill();
    const error=await screen.findByRole('alert');
    expect(error).toHaveTextContent('Diese Adresse gehört bereits zu einem anderen Betrieb.');
    expect(screen.getByRole('dialog',{name:'Beschäftigte Person einladen'})).toContainElement(error);
  });
  it.each(Object.entries(ACCOUNT_INVITATION_NOTICES))('shows %s by name and retains the inputs', async (code, text) => {
    render(<Harness capability={{ invite: async () => ({ status: 'failed', code: code as keyof typeof ACCOUNT_INVITATION_NOTICES }) }} />);
    fill();
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(text));
    expect(screen.getByLabelText('Name')).toHaveValue('Neue Person');
    expect(screen.getByLabelText('E-Mail')).toHaveValue('person@example.test');
  });
  it.each(Object.keys(ACCOUNT_INVITATION_NOTICES))('parses the exact backend error envelope %s', async (code) => {
    const client = new AdminWebApiClient(async () => new Response(JSON.stringify({ error: { code } }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }));
    expect(await client.createEmployeeAccountInvitation('token', membershipId, membershipId,
      'Neue Person', 'person@example.test', null)).toEqual({ status: 'failed', code });
  });
  it.each(['succeeded', 'succeeded_existing_account'] as const)('parses %s without expecting an invitation code', async (status) => {
    const request = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ status, membershipId }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const client = new AdminWebApiClient(request);
    expect(await client.createEmployeeAccountInvitation('token', membershipId, membershipId,
      'Neue Person', 'person@example.test', null)).toEqual({ status });
    expect(request.mock.calls[0]?.[0]).toBe('/v1/administration/employee-account-invitations');
  });
});

it('T049: an employee cannot submit invitations through the capability directly',async()=>{
 const request=vi.fn<typeof fetch>(async()=>Response.json({userId:membershipId,membershipId,organizationId:membershipId,
   role:'employee',locationsEnabled:false,availableSections:['own_time','manual_capture'],managementScope:{kind:'locations',locations:[]}}));
 const client=new EmployeeAccountInvitationClient({withAccessToken:async operation=>operation('token')},new AdminWebApiClient(request));
 expect(await client.invite('Neue Person','person@example.test',null)).toEqual({status:'rejected'});
 expect(request).toHaveBeenCalledOnce();expect(request.mock.calls[0]![0]).toBe('/v2/session');
});

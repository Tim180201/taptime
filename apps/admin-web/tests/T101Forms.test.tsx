// @vitest-environment jsdom
import { cleanup,fireEvent,render,screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach,expect,it,vi } from 'vitest';
import { useState } from 'react';
import { CustomerManagement } from '../src/views/CustomerManagement';
import { CustomerQuota } from '../src/views/CustomerQuota';
import { RequiredForm } from '../src/RequiredForm';
import type { AdminWebCapability } from '../src/contracts';
afterEach(cleanup);
it('T101 customer rename has a field hint and no management call',()=>{
 const manageCustomer=vi.fn();render(<CustomerManagement customer={{customerId:'one',displayName:'Alex'}} administration={{manageCustomer} as unknown as AdminWebCapability} onSaved={()=>{}}/>);
 fireEvent.click(screen.getByText('Kunde umbenennen'));const field=screen.getByLabelText('Neuer Kundenname');fireEvent.change(field,{target:{value:' '}});fireEvent.click(screen.getByText('Namen speichern'));
 expect(manageCustomer).not.toHaveBeenCalled();expect(field).toHaveFocus();expect(field).toHaveAttribute('aria-invalid','true');expect(document.getElementById(field.getAttribute('aria-describedby')!)).toHaveAttribute('role','alert');fireEvent.change(field,{target:{value:'Alex B'}});expect(field).not.toHaveAttribute('aria-invalid');
});
it('T101 quota hint clears when optional input becomes empty',()=>{
 const setCustomerQuota=vi.fn();render(<CustomerQuota customer={{customerId:'one',workDurationSeconds:0}} administration={{setCustomerQuota} as unknown as AdminWebCapability} onSaved={()=>{}} editable/>);
 fireEvent.click(screen.getByText('Ändern'));const field=screen.getByLabelText('Stunden pro Monat (optional)');fireEvent.change(field,{target:{value:'bad'}});fireEvent.click(screen.getByText('Kontingent speichern'));expect(setCustomerQuota).not.toHaveBeenCalled();expect(field).toHaveAttribute('aria-invalid','true');fireEvent.change(field,{target:{value:''}});expect(field).not.toHaveAttribute('aria-invalid');expect(screen.queryByRole('alert')).toBeNull();
});
it('T101 repeated invalid submission reattaches the hint and retains other descriptions',()=>{
 function Form(){const [value,setValue]=useState('');return <RequiredForm><label>Name<input required aria-describedby="help" value={value} onChange={e=>setValue(e.target.value)}/></label><small id="help">Hilfe</small><button>Speichern</button></RequiredForm>;}
 render(<Form/>);const field=screen.getByLabelText('Name');fireEvent.click(screen.getByText('Speichern'));expect(screen.getByRole('alert')).toBeVisible();fireEvent.change(field,{target:{value:'Alex'}});expect(field).toHaveAttribute('aria-describedby','help');fireEvent.change(field,{target:{value:''}});fireEvent.click(screen.getByText('Speichern'));expect(screen.getByRole('alert')).toBeVisible();expect(field.getAttribute('aria-describedby')).toContain('help');
});

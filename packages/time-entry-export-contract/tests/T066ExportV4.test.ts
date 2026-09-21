import { expect, it } from 'vitest';
import { serializeTimeEntryExportCsvV4, serializeTimeEntryExportCsvV3, type TimeEntryExportRowV3 } from '../src/index.js';
const base: TimeEntryExportRowV3 = {personIdentifier:'33333333-3333-4333-8333-333333333333',employeeDisplayName:'Test',timeEntryId:'22222222-2222-4222-8222-222222222222',
  localDate:'2026-07-24',startedAtLocal:'10:00:00.000',stoppedAtLocal:'11:00:00.000',startedAtUtc:'2026-07-24T08:00:00.000Z',stoppedAtUtc:'2026-07-24T09:00:00.000Z',
  breakDurationSeconds:'0',effectiveWorkDurationSeconds:'3600',targetType:'customer',targetDisplayName:'Kunde',startedVia:'nfc',stoppedVia:'nfc',revisionNumber:'0'};
it('exports four distinct origins, correction and a safely quoted current comment; v3 stays byte-identical',()=>{
  const before=serializeTimeEntryExportCsvV3([base]).bytes;
  for (const [origin,label] of [['nfc','gescannt'],['manual','manuell'],['backfilled','nachgetragen'],['recovered','wiederhergestellt']] as const) {
    const csv=new TextDecoder().decode(serializeTimeEntryExportCsvV4([{...base,origin,changed:true,comment:'=1+1; "Kommentar"\nzweite Zeile'}]).bytes);
    expect(csv).toContain(`"${label}"`); expect(csv).toContain('"yes"'); expect(csv).toContain('"\'=1+1; ""Kommentar""\nzweite Zeile"');
  }
  expect(serializeTimeEntryExportCsvV3([base]).bytes).toEqual(before);
});

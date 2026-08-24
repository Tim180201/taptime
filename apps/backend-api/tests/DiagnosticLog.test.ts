import { describe, expect, it } from 'vitest';
import { createBackendApiDiagnosticLogSink } from '../src/diagnosticLog.js';

describe('backend diagnostic production log sink', () => {
  it('writes only the timestamp, fixed error class, closed route, and correlation id', () => {
    let output = '';
    const sink = createBackendApiDiagnosticLogSink({
      now: () => new Date('2026-08-24T17:00:00.000Z'),
      output: { write: (chunk) => { output += String(chunk); return true; } },
    });

    sink({
      code: 'session_resolution_failed',
      route: 'session',
      correlationId: '00000000-0000-4000-8000-000000000001',
    });

    expect(output).toBe(
      '{"timestamp":"2026-08-24T17:00:00.000Z","error_class":"session_resolution_failed",'
      + '"route":"session","correlation_id":"00000000-0000-4000-8000-000000000001"}\n',
    );
  });

  it('cannot serialize personal content carried only by the underlying failure', () => {
    let output = '';
    const personalContent = [
      'Erika Mustermann',
      'erika@example.test',
      'Kundenbezeichnung Nord',
      '2026-08-24T08:00:00Z/2026-08-24T17:00:00Z',
      'Bearer personal-access-token',
      '{"request":"personal content"}',
    ];
    const sink = createBackendApiDiagnosticLogSink({
      now: () => new Date('2026-08-24T17:01:00.000Z'),
      output: { write: (chunk) => { output += String(chunk); return true; } },
    });

    const failure = new Error(personalContent.join(' | '));
    expect(failure.message).toContain(personalContent[0]);
    sink({
      code: 'administration_failed',
      route: 'admin_create_employee_invitation',
      correlationId: '00000000-0000-4000-8000-000000000002',
    });

    expect(JSON.parse(output)).toEqual({
      timestamp: '2026-08-24T17:01:00.000Z',
      error_class: 'administration_failed',
      route: 'admin_create_employee_invitation',
      correlation_id: '00000000-0000-4000-8000-000000000002',
    });
    for (const forbidden of personalContent) {
      expect(output).not.toContain(forbidden);
    }
    expect(output).not.toContain('organization');
  });
});

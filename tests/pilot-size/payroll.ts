import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { shiftMonth } from '@taptime/core';
import { serializeTimeEntryExportCsvV5, TIME_ENTRY_EXPORT_MAXIMUM_ROWS } from '@taptime/time-entry-export-contract';
import { environment, save, output, localDatabaseUrl } from './support.js';
import { generate, people, organization } from './dataset.js';
import { Http, monthWindow, quantile, sizeAndCounts } from './measure.js';
import { writeLoad } from './load.js';

// Opt-in run.mjs validates synthetic-local-only before loading this module.
// Full historical profiles; compressed current-day writes add real running/admin-stop data.
localDatabaseUrl();
for (const profile of ['expected', 'peak'] as const) {
  const env = await environment(profile);
  try {
    const dataset = await generate(env, profile, false);
    await save(`${profile}/dataset.json`, dataset);
    const http = new Http(env);
    await writeLoad(http, profile, true);
    await env.db.query('ANALYZE');
    await sizeAndCounts(env, profile);
    const actor = people[0]!;
    const currentMonth = monthWindow(dataset.reference.slice(0, 7));
    // Exercise actual HTTP mutations with least-privileged runtime logins.
    const settings = await http.request('/v1/administration/payroll/query', { expectedMembershipId: actor.member, ...currentMonth }, actor);
    assert.equal(settings.status, 200, settings.text);
    const wage = await http.request('/v1/administration/payroll/work-wage-type', {
      expectedMembershipId: actor.member, commandId: crypto.randomUUID(), expectedRowVersion: JSON.parse(settings.text).rowVersion, workWageType: '001',
    }, actor);
    assert.equal(wage.status, 200, wage.text);
    for (const person of people.filter(p => !p.former && p.index % 2 === 0)) {
      const read = await http.request('/v1/administration/memberships/payroll', { expectedMembershipId: actor.member, targetMembershipId: person.member }, actor);
      assert.equal(read.status, 200, read.text);
      const result = await http.request('/v1/administration/memberships/personnel-number', {
        expectedMembershipId: actor.member, targetMembershipId: person.member, commandId: crypto.randomUUID(),
        expectedRowVersion: JSON.parse(read.text).rowVersion, personnelNumber: String(person.index + 1).padStart(5, '0'),
      }, actor);
      assert.equal(result.status, 200, result.text);
    }
    const proofs = [], measurements = [];
    for (const offset of [-3, -2, -1, 0]) {
      const month = shiftMonth(dataset.reference.slice(0, 7), offset), window = monthWindow(month);
      const c = await env.db.connect();
      let expectedCsv: string;
      try {
        await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
        await c.query("SELECT set_config('app.organization_id',$1,true),set_config('app.user_id',$2,true),set_config('app.membership_id',$3,true),set_config('app.membership_role','administrator',true)", [organization, actor.user, actor.member]);
        await c.query('SET LOCAL ROLE taptime_time_exporter');
        const v4 = (await c.query('SELECT * FROM taptime_server.read_effective_time_entry_export_v4($1,$2,$3,$4)',
          [organization, window.fromInclusive, window.toExclusive, TIME_ENTRY_EXPORT_MAXIMUM_ROWS + 1])).rows;
        const v5 = (await c.query('SELECT * FROM taptime_server.read_effective_time_entry_export_v5($1,$2,$3)',
          [organization, window.fromInclusive, window.toExclusive])).rows;
        assert.deepEqual(v5.map(r => r.employee_membership_id).sort(), [...new Set(v4.map(r => r.employee_membership_id))].sort());
        for (const row of v5) {
          const entries = v4.filter(e => e.employee_membership_id === row.employee_membership_id);
          const seconds = entries.filter(e => e.status === 'stopped').reduce((total, e) => total + BigInt(e.effective_work_duration_seconds), 0n);
          assert.equal(BigInt(row.work_duration_seconds), seconds);
          assert.equal(row.has_running_time, entries.some(e => e.status === 'started'));
          assert.equal(Number(row.source_row_count), entries.length);
        }
        expectedCsv = Buffer.from(serializeTimeEntryExportCsvV5(v5.map(r => ({ personIdentifier: r.employee_membership_id,
          personnelNumber: r.personnel_number, employeeDisplayName: r.employee_display_name, month: r.payroll_month,
          workDurationSeconds: r.work_duration_seconds, workWageType: r.work_wage_type, hasRunningTime: r.has_running_time }))).bytes).toString('utf8');
        proofs.push({ month, equal: true, individualRows: v4.length, monthlyRows: v5.length,
          formerPeople: v5.filter(r => people.some(p => p.former && p.member === r.employee_membership_id)).length,
          runningPeople: v5.filter(r => r.has_running_time).length });
        await c.query('COMMIT');
      } catch (error) { await c.query('ROLLBACK'); throw error; } finally { c.release(); }
      const samples = [];
      for (let i = 0; i < 20; i++) {
        const response = await http.request('/v5/time-entries/export', { expectedMembershipId: actor.member, ...window }, actor, 'text/csv');
        assert.equal(response.status, 200, response.text);
        // Fetch's UTF-8 text decoder strips the BOM. Verify bytes independently below.
        assert.equal(response.text, expectedCsv.replace(/^\uFEFF/, ''));
        samples.push(response.milliseconds);
      }
      const p95 = quantile(samples, .95);
      measurements.push({ month, samples, p50: quantile(samples, .5), p95, targetMs: 1000 });
      await save(`${profile}/payroll-proof.json`, { postgres: env.version, proofs, measurements });
      await writeFile(resolve(output, profile, `synthetische-monatsuebersicht-${month}.csv`), expectedCsv);
      console.log(`${profile} ${month}: ${proofs.at(-1)!.individualRows} Einzelzeiten, ${proofs.at(-1)!.monthlyRows} Personen; gleich; p95 ${p95.toFixed(1)} ms`);
      assert.ok(p95 < 1000, `${profile} ${month}: p95 ${p95} ms exceeds 1 s`);
    }
    // HTTP permissions and exact month validation use the actual production route.
    for (const person of [people[1]!, people[6]!]) assert.equal((await http.request('/v5/time-entries/export', {
      expectedMembershipId: person.member, ...currentMonth,
    }, person, 'text/csv')).status, 403);
    assert.equal((await http.request('/v5/time-entries/export', {
      expectedMembershipId: actor.member, ...currentMonth, fromInclusive: dataset.reference + 'T00:00:00.000Z',
    }, actor, 'text/csv')).status, 400);
    await save(`${profile}/completion.json`, { complete: true, mode: 'payroll', fullHistory: true, compressedCurrentDay: true, proofs, measurements });
  } finally { await env.cleanup(); }
}

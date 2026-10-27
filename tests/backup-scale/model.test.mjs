import assert from 'node:assert/strict';
import test from 'node:test';
import { calendar, demandDay, readInputs } from './model.mjs';

test('source inputs describe a finite schedule and weekly deadline', () => {
  const inputs = readInputs();
  assert.ok(inputs.people > 0 && inputs.expectedUnits < inputs.peakUnits);
  assert.ok(inputs.burstSpacingSeconds < inputs.minimumCyclePauseSeconds);
  assert.ok(inputs.expectedDays.every(day => inputs.peakDays.includes(day)));
  assert.ok(inputs.backupTimeoutSeconds < inputs.weeklyTimeoutSeconds);
});

test('simultaneous arrivals share segments, events are not archives', () => {
  const inputs = { ...readInputs(), people: 1 };
  const one = demandDay(inputs, inputs.expectedUnits, 0, 0);
  const simultaneous = demandDay({ ...inputs, people: 2 }, inputs.expectedUnits, 0, 0);
  assert.equal(simultaneous.events, one.events * 2);
  assert.equal(simultaneous.demandSegments, one.demandSegments);
  const separated = demandDay({ ...inputs, people: 2 }, inputs.expectedUnits, 0, inputs.minimumCyclePauseSeconds);
  assert.equal(separated.demandSegments, 2 * one.demandSegments);
});

test('calendar includes hourly bases on non-working days and no historical former people', () => {
  const inputs = readInputs();
  const data = calendar(inputs, 1, 'expected', 2);
  for (const day of data.days.filter(day => !day.working)) {
    assert.equal(day.events, 0);
    assert.equal(day.segments, day.baseSegments);
  }
  assert.ok(data.days.some(day => day.working) && data.days.some(day => !day.working));
  assert.equal(data.generatedWal, data.days.reduce((sum, day) => sum + day.segments, 0));
  for (const day of data.days.filter(day => day.working)) {
    assert.equal(day.events + 2 * day.backfills, inputs.people * (2 * inputs.expectedUnits + 2));
  }
});

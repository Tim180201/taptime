import { describe, expect, it } from 'vitest';
import { buildScanDemoPipeline, DEMO_KNOWN_PAYLOAD } from '../../src/cli/runScan';

// DT-011 consolidated demonstration test: drives the real, unmodified DT-001-DT-008
// production classes through the composition root (not mocks) and proves every outcome
// reachable from the demo's single seeded scenario is produced and rendered end-to-end.
describe('DT-011 composition root (buildScanDemoPipeline)', () => {
  it('renders an unreadable outcome for missing input', async () => {
    const lines: string[] = [];
    const pipeline = buildScanDemoPipeline((line) => lines.push(line));

    const outcome = await pipeline.scan(undefined);

    expect(outcome).toEqual({ stage: 'capture', status: 'unreadable' });
    expect(lines).toContain('Scan rejected: unreadable NFC payload.');
  });

  it('renders an unknown_tag rejection for a payload that does not match the seeded tag', async () => {
    const lines: string[] = [];
    const pipeline = buildScanDemoPipeline((line) => lines.push(line));

    const outcome = await pipeline.scan('some-unrelated-payload');

    expect(outcome).toEqual({ stage: 'resolution', status: 'rejected', reason: 'unknown_tag' });
    expect(lines).toContain('Scan rejected: the scanned tag is not known to this organization.');
  });

  it('accepts the known payload, starts a TimeEntry, queues it and synchronizes it end-to-end', async () => {
    const lines: string[] = [];
    const pipeline = buildScanDemoPipeline((line) => lines.push(line));

    const outcome = await pipeline.scan(DEMO_KNOWN_PAYLOAD);

    expect(outcome.stage).toBe('validation');
    expect(lines.some((line) => line.includes('created for organization'))).toBe(true);
    expect(lines.some((line) => line.includes('TimeEntry') && line.includes('started'))).toBe(true);
    expect(lines.some((line) => line.includes('accepted and started') && line.includes('queued for synchronization'))).toBe(
      true,
    );

    await pipeline.synchronizePending('success');

    expect(lines.some((line) => line.includes('synchronized successfully'))).toBe(true);
  });

  it('ignores a second scan of the same target inside the duplicate window and still queues/synchronizes it', async () => {
    const lines: string[] = [];
    const pipeline = buildScanDemoPipeline((line) => lines.push(line));

    await pipeline.scan(DEMO_KNOWN_PAYLOAD);
    const secondOutcome = await pipeline.scan(DEMO_KNOWN_PAYLOAD);

    expect(secondOutcome.stage).toBe('validation');
    expect(lines.some((line) => line.includes('accepted but ignored as a duplicate'))).toBe(true);

    await pipeline.synchronizePending('success');

    const synchronizedCount = lines.filter((line) => line.includes('synchronized successfully')).length;
    expect(synchronizedCount).toBe(2);
  });

  it('demonstrates a retryable synchronization failure without dropping the record', async () => {
    const lines: string[] = [];
    const pipeline = buildScanDemoPipeline((line) => lines.push(line));
    await pipeline.scan(DEMO_KNOWN_PAYLOAD);

    await pipeline.synchronizePending('retryable_failure');

    expect(lines.some((line) => line.includes('synchronization failed (retryable'))).toBe(true);
  });

  it('demonstrates a distinct, observable synchronization conflict', async () => {
    const lines: string[] = [];
    const pipeline = buildScanDemoPipeline((line) => lines.push(line));
    await pipeline.scan(DEMO_KNOWN_PAYLOAD);

    await pipeline.synchronizePending('conflict');

    expect(lines.some((line) => line.includes('has a synchronization conflict'))).toBe(true);
  });
});

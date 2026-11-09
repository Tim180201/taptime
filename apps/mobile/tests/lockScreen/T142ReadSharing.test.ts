import { expect, it, vi } from 'vitest';
import { harness, initial, ready } from './lockScreenHarness';

it('T142: a native change behind an older tab read gets one fresh read after suspend, without a third loop',async()=>{
  const h=harness();let release=()=>{};
  try {
    await ready(h);
    const read=vi.mocked(h.api.read).getMockImplementation()!;
    const started=vi.fn();
    vi.mocked(h.api.read).mockClear().mockImplementationOnce(async(...args)=>{
      const old=await read(...args);await new Promise<void>(done=>{release=done;started();});return old;
    });
    vi.mocked(h.native.project).mockClear();vi.mocked(h.native.issue).mockClear();
    const tab=h.work.refresh();await vi.waitFor(()=>expect(started).toHaveBeenCalled());
    const paused={...initial,status:'paused' as const,breakStartedAt:initial.asOf};
    h.setServer(paused);h.setStand({revision:'native-paused',state:paused});
    const authority=h.controller.refresh();
    await Promise.resolve();await Promise.resolve();
    expect(h.native.project).not.toHaveBeenCalled();expect(h.native.issue).not.toHaveBeenCalled();
    release();await Promise.all([tab,authority]);
    expect(h.getStand().state).toMatchObject({status:'paused',breakStartedAt:initial.asOf});
    expect(h.native.project).toHaveBeenCalled();expect(h.native.issue).toHaveBeenCalled();
    expect(h.api.read).toHaveBeenCalledTimes(2);
  } finally {release();h.controller.stop();h.work.stop();}
});

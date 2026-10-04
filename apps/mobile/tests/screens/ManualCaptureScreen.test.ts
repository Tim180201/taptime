// @vitest-environment jsdom
import { act, createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MobileWorkCapability, MobileWorkState } from '../../src/work/contracts';

vi.mock('react-native', () => {
  const element = ({ children, accessibilityRole }: {
    children?: ReactNode; accessibilityRole?: string;
  }) => createElement('div', { role: accessibilityRole }, children);
  return {
    View: element, Text: element, ScrollView: element, TextInput: () => null,
    ActivityIndicator: () => null,
    StyleSheet: { create: (value: unknown) => value, flatten: () => ({}) },
    Pressable: ({ children, onPress, disabled, accessibilityState, accessibilityHint }: {
      children?: ReactNode; onPress?: () => void; disabled?: boolean;
      accessibilityState?: { selected?: boolean }; accessibilityHint?: string;
    }) => createElement('button', { onClick: onPress, disabled,
      'aria-pressed': accessibilityState?.selected, 'aria-description': accessibilityHint }, children),
  };
});

const { ManualCaptureScreen } = await import('../../src/screens/ManualCaptureScreen');
const target = { targetType: 'general_work' as const, targetId: 'general', displayName: 'Allgemeine Arbeit' };
const state: MobileWorkState = {
  status: 'ready', submitting: false, loadingMore: false, outcome: null,
  targets: { targets: [target], nextCursor: null },
  ownTime: { activeRecord: null, records: [], nextCursor: null,
    windowStartedAt: '2026-09-01T00:00:00Z', windowEndedAt: '2026-09-18T12:00:00Z' },
};
let container: HTMLDivElement;
let root: Root;
let work: MobileWorkCapability;

beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  container = document.createElement('div');
  root = createRoot(container);
  work = { getState: () => state, subscribe: () => () => {},
    refresh: vi.fn(async () => {}), loadMoreOwnTime: vi.fn(async () => {}),
    triggerManual: vi.fn(async () => {}), triggerBreak: vi.fn(async () => {}), stopActiveTime: vi.fn(async () => {}) };
  await act(async () => { root.render(createElement(ManualCaptureScreen, { work })); });
});
afterEach(async () => {
  await act(async () => { root.unmount(); });
  vi.unstubAllGlobals();
});
function button(label: string): HTMLButtonElement {
  const found = [...container.querySelectorAll('button')].find((item) => item.textContent === label);
  expect(found, `button ${label}`).toBeDefined();
  return found!;
}
async function press(label: string) {
  await act(async () => { button(label).click(); });
}

describe('T103 ManualCaptureScreen states', () => {
  it('starts only a selected work target, without a pause entry', async () => {
    expect([...container.querySelectorAll('button')].some(b=>b.textContent==='Pause')).toBe(false);
    await press('Zeit starten');
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Wähle ein Arbeitsziel');
    await press(target.displayName); await press('Zeit starten');
    expect(work.triggerManual).toHaveBeenCalledExactlyOnceWith(target);
  });
  it.each([null,'2026-10-04T08:30:00.000Z'])('shows the running state and locks every button (%s)', async breakStartedAt => {
    const active={timeRecordId:'entry',source:'canonical' as const,targetType:'general_work' as const,targetId:'general',targetDisplayName:'Allgemeine Arbeit',status:'started' as const,startedAt:'2026-10-04T06:12:00.000Z',stoppedAt:null,startedVia:'manual' as const,stoppedVia:null,breakStartedAt};
    const running={...state,status:'ready' as const,ownTime:{...(state as Extract<MobileWorkState,{status:'ready'}>).ownTime,activeRecord:active},submitting:false};
    work.getState=()=>running;
    await act(async()=>root.render(createElement(ManualCaptureScreen,{work})));
    expect(container.textContent).toContain(breakStartedAt?'Pause seit 10:30 · Allgemeine Arbeit':'Läuft seit 08:12 · Allgemeine Arbeit');
    expect(button('Zeit beenden')).toBeDefined();expect(button(breakStartedAt?'Pause beenden':'Pause starten')).toBeDefined();
    const busy={...running,submitting:true};
    work.getState=()=>busy;
    await act(async()=>root.render(createElement(ManualCaptureScreen,{work})));
    expect([...container.querySelectorAll('button')].every(b=>b.disabled)).toBe(true);
  });
});

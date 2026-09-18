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
    triggerManual: vi.fn(async () => {}), triggerBreak: vi.fn(async () => {}) };
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

describe('ManualCaptureScreen selection', () => {
  it('replaces the work target with a pause and sends only the pause trigger', async () => {
    await press(target.displayName);
    await press('Pause');
    expect(button(target.displayName).getAttribute('aria-pressed')).toBe('false');
    expect(button('Pause').getAttribute('aria-pressed')).toBe('true');
    expect(button('Jetzt erfassen').getAttribute('aria-description'))
      .toBe('Der Server entscheidet, ob die Pause beginnt oder endet.');
    await press('Jetzt erfassen');
    expect(work.triggerBreak).toHaveBeenCalledExactlyOnceWith();
    expect(work.triggerManual).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it('clears the pause selection when choosing a work target', async () => {
    await press('Pause');
    await press(target.displayName);
    expect(button('Pause').getAttribute('aria-pressed')).toBe('false');
    expect(button(target.displayName).getAttribute('aria-pressed')).toBe('true');
    await press('Jetzt erfassen');
    expect(work.triggerManual).toHaveBeenCalledExactlyOnceWith(target);
    expect(work.triggerBreak).not.toHaveBeenCalled();
  });

  it('asks for a work target without sending a trigger when nothing is selected', async () => {
    await press('Jetzt erfassen');
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Wähle ein Arbeitsziel');
    expect(work.triggerManual).not.toHaveBeenCalled();
    expect(work.triggerBreak).not.toHaveBeenCalled();
    await press('Pause');
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });
});

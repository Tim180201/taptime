// @vitest-environment jsdom
import { act, createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const motion = vi.hoisted(() => ({
  initial: Promise.resolve(false),
  listener: null as null | ((value: boolean) => void),
  remove: vi.fn(),
  animations: [] as Array<{ kind: string; config: Record<string, unknown>; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }>,
  values: [] as Array<{ value: number; stopAnimation: ReturnType<typeof vi.fn> }>,
}));
vi.mock('react-native', () => {
  const flatten = (value: unknown): Record<string, unknown> => Array.isArray(value)
    ? Object.assign({}, ...value.map(flatten)) : value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const element = ({ children, style, accessibilityRole, accessibilityLabel }: {
    children?: ReactNode; style?: unknown; accessibilityRole?: string; accessibilityLabel?: string;
  }) => createElement('div', { 'data-style': JSON.stringify(flatten(typeof style === 'function' ? style({ pressed: false }) : style)),
    role: accessibilityRole, 'aria-label': accessibilityLabel }, children);
  const animation = (kind: string, config: Record<string, unknown> = {}) => {
    const value = { kind, config, start: vi.fn(), stop: vi.fn() };
    motion.animations.push(value); return value;
  };
  return {
    View: element, Text: element, Pressable: element, TextInput: element, ScrollView: element,
    StyleSheet: { create: (value: unknown) => value, flatten },
    AccessibilityInfo: { isReduceMotionEnabled: () => motion.initial,
      addEventListener: (_: string, listener: (value: boolean) => void) => {
        motion.listener = listener; return { remove: motion.remove };
      } },
    Easing: { inOut: () => 'inOut', out: () => 'out', sin: 'sin', quad: 'quad' },
    Animated: {
      View: element,
      Value: class {
        constructor(public value: number) { motion.values.push(this); }
        setValue(value: number) { this.value = value; }
        stopAnimation = vi.fn();
        interpolate({ inputRange, outputRange }: { inputRange: number[]; outputRange: number[] }) {
          return outputRange[0]! + (this.value - inputRange[0]!) / (inputRange.at(-1)! - inputRange[0]!) * (outputRange.at(-1)! - outputRange[0]!);
        }
      },
      timing: (value: unknown, config: Record<string, unknown>) => animation('timing', { ...config, value }),
      delay: (duration: number) => animation('delay', { duration }),
      sequence: (children: unknown[]) => animation('sequence', { children }),
      loop: (child: unknown) => animation('loop', { child }),
    },
  };
});
const { ScanRing } = await import('../../src/design/ScanRing');
const { ActionButton, Screen, EmbeddedScreenContext } = await import('../../src/design/primitives');
const { mobileTokens } = await import('../../src/design/tokens');
let root: Root;
let container: HTMLDivElement;
const styles = () => [...container.querySelectorAll('[data-style]')].map((node) => JSON.parse(node.getAttribute('data-style')!));
const draw = async (result: 'confirmed' | 'pending' | null = null, scanning = false) => {
  await act(async () => root.render(createElement(ScanRing, { animate: true, scanning, result })));
};
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  motion.initial = Promise.resolve(false); motion.listener = null; motion.remove.mockClear();
  motion.animations.length = 0; motion.values.length = 0;
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

describe('T-061 rendered motion and safe area contracts', () => {
  it('runs B at two seconds with two ripples 650 ms apart, then stops and resets on a live preference change', async () => {
    await draw(null, true);
    expect(motion.animations.filter(a => a.kind === 'timing' && a.config.duration === 1000).map(a => a.config.toValue)).toEqual([1, 0]);
    expect(motion.animations.filter(a => a.kind === 'timing' && a.config.duration === 2000)).toHaveLength(2);
    expect(motion.animations.find(a => a.kind === 'delay')?.config.duration).toBe(650);
    expect(styles().find(s => s.width === 236 && s.alignItems === 'center').transform).toEqual([{ scale: 0.94 }]);
    expect(styles().some(s => s.boxShadow)).toBe(true);
    const running = motion.animations.filter(a => a.start.mock.calls.length);
    expect(running.length).toBeGreaterThan(0);
    await act(async () => motion.listener!(true));
    for (const animation of running) expect(animation.stop).toHaveBeenCalledOnce();
    const animatedValues = new Set(motion.animations.filter(a => a.kind === 'timing').map(a => a.config.value as typeof motion.values[number]));
    for (const value of animatedValues) { expect(value.stopAnimation).toHaveBeenCalled(); expect(value.value).toBe(0); }
    expect(styles().find(s => s.width === 236 && s.alignItems === 'center').transform).toEqual([{ scale: 1 }]);
    expect(styles().some(s => s.boxShadow)).toBe(false);
    const started = motion.animations.length;
    await draw(null, false); await draw(null, true);
    expect(motion.animations).toHaveLength(started);
  });

  it('stays still while the initial preference is pending, and an older read cannot override a newer reduce-motion event', async () => {
    let resolve!: (value: boolean) => void;
    motion.initial = new Promise<boolean>(r => { resolve = r; });
    await draw(null, true);
    expect(motion.animations).toHaveLength(0);
    await act(async () => motion.listener!(true));
    await act(async () => resolve(false));
    expect(motion.animations).toHaveLength(0);
  });

  it('stays still when the preference read fails', async () => {
    motion.initial = Promise.reject(new Error('unavailable'));
    await draw(null, true);
    expect(motion.animations).toHaveLength(0);
  });

  it.each(['confirmed', 'pending'] as const)('gives %s a solid readable status surface with no competing animation', async (result) => {
    await draw(); const running = motion.animations.filter(a => a.start.mock.calls.length);
    motion.animations.length = 0;
    await draw(result, true);
    expect(motion.animations).toHaveLength(0);
    for (const animation of running) expect(animation.stop).toHaveBeenCalledOnce();
    const ring = styles().find(s => s.width === 236 && s.alignItems === 'center');
    expect(ring.backgroundColor).toBe(result === 'confirmed' ? mobileTokens.color.accent : mobileTokens.color.notice);
    expect(container.querySelector('svg')?.getAttribute('color')).toBe(mobileTokens.color.onAccent);
  });

  it('cleans up every started loop and the accessibility subscription on unmount', async () => {
    await draw(); const running = motion.animations.filter(a => a.start.mock.calls.length);
    await act(async () => root.unmount());
    for (const animation of running) expect(animation.stop).toHaveBeenCalledOnce();
    expect(motion.remove).toHaveBeenCalledOnce();
    root = createRoot(container);
  });

  it('keeps loading controls static, labeled and at least 44 pixels in both directions', async () => {
    await act(async () => root.render(createElement(ActionButton, { title: 'Wird gesendet …', loading: true })));
    expect(container.textContent).toBe('Wird gesendet …');
    expect(container.querySelector('svg')).not.toBeNull();
    expect(styles()[0]).toMatchObject({ minWidth: 44, minHeight: 44 });
    expect(motion.animations).toHaveLength(0);
  });

  it.each([false, true])('applies insets exactly once for a standalone/embedded screen (%s)', async embedded => {
    const insets = { top: 47, bottom: 34, left: 11, right: 19 };
    await act(async () => root.render(createElement(SafeAreaProvider, {
      initialMetrics: { insets, frame: { x: 0, y: 0, width: 390, height: 844 } },
    }, createElement(EmbeddedScreenContext.Provider, { value: embedded }, createElement(Screen, { title: 'Test' })))));
    expect(styles()[0]).toMatchObject({ paddingTop: embedded ? 8 : 63, paddingBottom: embedded ? 0 : 50,
      paddingLeft: embedded ? 20 : 31, paddingRight: embedded ? 20 : 39 });
  });
});

import { createContext, createElement, useContext, type ReactNode } from 'react';
import { vi } from 'vitest';

// Native modules cannot load in Node. Keep their public geometry/context contract
// visible to rendered component tests; the Android prebuild checks real autolinking.
vi.mock('react-native-svg', () => ({
  default: ({ children, width, height, viewBox, fill, stroke, strokeWidth, strokeLinecap, strokeLinejoin, color }: Record<string, unknown>) =>
    createElement('svg', { width, height, viewBox, fill, stroke, strokeWidth, strokeLinecap, strokeLinejoin, color }, children as ReactNode),
  Path: ({ d }: { d: string }) => createElement('path', { d }),
}));
vi.mock('react-native-safe-area-context', () => {
  const zero = { top: 0, right: 0, bottom: 0, left: 0 };
  const Context = createContext(zero);
  return {
    SafeAreaProvider: ({ children, initialMetrics }: { children?: ReactNode; initialMetrics?: { insets: typeof zero } }) =>
      createElement(Context.Provider, { value: initialMetrics?.insets ?? zero }, children),
    SafeAreaView: ({ children }: { children?: ReactNode }) => createElement('div', {}, children),
    useSafeAreaInsets: () => useContext(Context),
  };
});

import { defineConfig } from 'vitest/config';

// DT-016: covers only non-hardware-dependent logic (payload normalization, capability-check
// branching, and the adapter's event-callback wiring via a test double for
// react-native-nfc-manager) - no React Native component rendering is exercised here, so no
// jsdom/RTL/jest-expo is required (Development Sprint 011 Plan, Section 11).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});

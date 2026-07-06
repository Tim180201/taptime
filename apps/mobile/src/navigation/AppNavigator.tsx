import { useState } from 'react';
import type { CallerContext } from '@taptime/core';
import { LoginScreen } from '../screens/LoginScreen';
import { ScanScreen } from '../screens/ScanScreen';

// Two-screen Login -> Scan flow (Development Sprint 008, DT-014), extending Sprint 006's
// single-screen foundation exactly as its own comment anticipated ("establishing the pattern
// and location for future navigation"). A minimal conditional render is sufficient for two
// screens; no routing library was found genuinely necessary.
export function AppNavigator() {
  const [caller, setCaller] = useState<CallerContext | null>(null);

  if (caller === null) {
    return <LoginScreen onSignedIn={setCaller} />;
  }

  return <ScanScreen caller={caller} />;
}

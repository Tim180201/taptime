import { ScanScreen } from '../screens/ScanScreen';

// Minimal navigation foundation (Development Sprint 006, Section 6/9): a single-screen
// "navigator" establishing the pattern and location for future navigation, without adding a
// routing library dependency not yet needed for one screen.
export function AppNavigator() {
  return <ScanScreen />;
}

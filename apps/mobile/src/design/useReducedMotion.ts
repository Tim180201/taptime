import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** Stay still until the device preference is known; a live change beats an older read. */
export function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(true);
  useEffect(() => {
    let current = true;
    let changed = false;
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
      changed = true;
      setReducedMotion(value);
    });
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (current && !changed) setReducedMotion(value);
    }).catch(() => { /* Unknown preference stays still. */ });
    return () => { current = false; subscription.remove(); };
  }, []);
  return reducedMotion;
}

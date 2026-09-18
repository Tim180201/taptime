import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';
import { LineIcon } from './LineIcon';
import { mobileTokens } from './tokens';

export function ScanRing({ animate, scanning, result }: {
  readonly animate: boolean; readonly scanning: boolean; readonly result: 'confirmed' | 'pending' | null;
}) {
  const [reducedMotion, setReducedMotion] = useState(true);
  const breath = useRef(new Animated.Value(1)).current;
  const wave1 = useRef(new Animated.Value(0)).current;
  const wave2 = useRef(new Animated.Value(0)).current;
  const flash = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let current = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (current) setReducedMotion(value); });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    return () => { current = false; subscription.remove(); };
  }, []);
  useEffect(() => {
    for (const value of [breath, wave1, wave2, flash]) value.stopAnimation();
    breath.setValue(1); wave1.setValue(0); wave2.setValue(0); flash.setValue(0);
    if (reducedMotion) return;
    const animations: Animated.CompositeAnimation[] = [];
    if (animate) {
      animations.push(Animated.loop(Animated.sequence([
        Animated.timing(breath, { toValue: 1.035, duration: 2400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breath, { toValue: 1, duration: 2400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])));
      const ripple = (value: Animated.Value) => Animated.loop(Animated.sequence([
        Animated.timing(value, { toValue: 1, duration: 2800, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(value, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]));
      animations.push(ripple(wave1), Animated.sequence([Animated.delay(1400), ripple(wave2)]));
    }
    if (scanning) animations.push(Animated.sequence([
      Animated.timing(flash, { toValue: 0.5, duration: 80, useNativeDriver: true }),
      Animated.timing(flash, { toValue: 0.15, duration: 120, useNativeDriver: true }),
      Animated.timing(flash, { toValue: 0.4, duration: 80, useNativeDriver: true }),
      Animated.timing(flash, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]));
    animations.forEach((animation) => animation.start());
    return () => {
      animations.forEach((animation) => animation.stop());
      for (const value of [breath, wave1, wave2, flash]) value.stopAnimation();
    };
  }, [animate, scanning, reducedMotion, breath, wave1, wave2, flash]);
  const color = result === 'pending' ? mobileTokens.color.notice : mobileTokens.color.accent;
  return <View style={styles.wrap} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    {animate && !reducedMotion ? [wave1, wave2].map((wave, index) => <Animated.View key={index}
      style={[styles.wave, { borderColor: color,
        opacity: wave.interpolate({ inputRange: [0, 0.08, 1], outputRange: [0, 0.3, 0] }),
        transform: [{ scale: wave.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.35] }) }],
      }]} />) : null}
    <Animated.View style={[styles.ring, { borderColor: result === null ? mobileTokens.color.line : color,
      transform: [{ scale: breath }] }]}>
      <LineIcon size={result === null ? 92 : 76} name={result === null ? 'capture' : result === 'confirmed' ? 'check' : 'pending'} color={color} />
      <Animated.View style={[styles.flash, { opacity: flash }]} />
    </Animated.View>
  </View>;
}
const styles = StyleSheet.create({
  wrap: { width: 300, height: 300, alignItems: 'center', justifyContent: 'center' },
  ring: { width: 236, height: 236, borderRadius: 999, borderWidth: 2,
    backgroundColor: mobileTokens.color.surface, alignItems: 'center', justifyContent: 'center' },
  wave: { position: 'absolute', width: 236, height: 236, borderRadius: 999, borderWidth: 1 },
  flash: { position: 'absolute', width: 232, height: 232, borderRadius: 999, backgroundColor: mobileTokens.color.text },
});

import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { LineIcon } from './LineIcon';
import { mobileTokens } from './tokens';
import { useReducedMotion } from './useReducedMotion';

export function ScanRing({ animate, scanning, result }: {
  readonly animate: boolean; readonly scanning: boolean; readonly result: 'confirmed' | 'pending' | null;
}) {
  const reducedMotion = useReducedMotion();
  const breath = useRef(new Animated.Value(0)).current;
  const wave1 = useRef(new Animated.Value(0)).current;
  const wave2 = useRef(new Animated.Value(0)).current;
  const flash = useRef(new Animated.Value(0)).current;
  const breathing = animate && result === null;
  useEffect(() => {
    for (const value of [breath, wave1, wave2, flash]) value.stopAnimation();
    breath.setValue(0); wave1.setValue(0); wave2.setValue(0); flash.setValue(0);
    if (reducedMotion) return;
    const animations: Animated.CompositeAnimation[] = [];
    if (breathing) {
      animations.push(Animated.loop(Animated.sequence([
        Animated.timing(breath, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breath, { toValue: 0, duration: 1000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])));
      const ripple = (value: Animated.Value) => Animated.loop(Animated.sequence([
        Animated.timing(value, { toValue: 1, duration: 2000, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(value, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]));
      animations.push(ripple(wave1), Animated.sequence([Animated.delay(650), ripple(wave2)]));
    }
    if (scanning && result === null) animations.push(Animated.sequence([
      Animated.timing(flash, { toValue: 0.2, duration: 180, useNativeDriver: true }),
      Animated.timing(flash, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]));
    animations.forEach((animation) => animation.start());
    return () => {
      animations.forEach((animation) => animation.stop());
      for (const value of [breath, wave1, wave2, flash]) value.stopAnimation();
    };
  }, [breathing, scanning, result, reducedMotion, breath, wave1, wave2, flash]);
  const color = result === 'pending' ? mobileTokens.color.notice : mobileTokens.color.accent;
  const scale = breathing && !reducedMotion
    ? breath.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.10] }) : 1;
  return <View style={styles.wrap} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    {breathing && !reducedMotion ? [wave1, wave2].map((wave, index) => <Animated.View key={index}
      style={[styles.wave, { borderColor: color,
        opacity: wave.interpolate({ inputRange: [0, 0.08, 1], outputRange: [0, 0.4, 0] }),
        transform: [{ scale: wave.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.25] }) }],
      }]} />) : null}
    <Animated.View style={[styles.ring, { borderColor: result === null ? mobileTokens.color.line : color,
      backgroundColor: result === null ? mobileTokens.color.surface : color,
      transform: [{ scale }] }]}>
      {breathing && !reducedMotion ? <Animated.View pointerEvents="none" style={[styles.glow, {
        opacity: breath.interpolate({ inputRange: [0, 1], outputRange: [0.05, 0.65] }),
      }]} /> : null}
      <LineIcon size={result === null ? 92 : 76} name={result === null ? 'capture' : result === 'confirmed' ? 'check' : 'pending'}
        color={result === null ? color : mobileTokens.color.onAccent} />
      <Animated.View pointerEvents="none" style={[styles.flash, { opacity: flash }]} />
    </Animated.View>
  </View>;
}
const styles = StyleSheet.create({
  wrap: { width: 300, maxWidth: '100%', height: 300, alignItems: 'center', justifyContent: 'center' },
  ring: { width: 236, height: 236, borderRadius: 999, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center' },
  wave: { position: 'absolute', width: 236, height: 236, borderRadius: 999, borderWidth: 2 },
  glow: { position: 'absolute', width: 236, height: 236, borderRadius: 999, borderWidth: 2,
    borderColor: mobileTokens.color.accent,
    boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 24, spreadDistance: 4, color: mobileTokens.color.accent }] },
  flash: { position: 'absolute', width: 232, height: 232, borderRadius: 999, backgroundColor: mobileTokens.color.accent },
});

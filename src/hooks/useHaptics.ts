import { useCallback, useRef } from 'react';
import * as Haptics from 'expo-haptics';

export type HapticStyle = 'light' | 'medium' | 'heavy' | 'soft' | 'rigid';

interface HapticsConfig {
  enabled?: boolean;
  style?: HapticStyle;
  minInterval?: number;
}

export function useHaptics(config: HapticsConfig = {}) {
  const { enabled = true, style = 'light', minInterval = 16 } = config;
  const lastHapticTime = useRef<number>(0);
  const lastVelocity = useRef<number>(0);
  const hapticCounter = useRef<number>(0);

  const triggerHaptic = useCallback((intensity?: number) => {
    if (!enabled) return;

    const now = Date.now();
    if (now - lastHapticTime.current < minInterval) return;

    lastHapticTime.current = now;

    // Adjust style based on intensity (0-1)
    if (intensity !== undefined) {
      if (intensity < 0.3) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
      } else if (intensity < 0.6) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } else if (intensity < 0.8) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
      }
      return;
    }

    switch (style) {
      case 'light':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        break;
      case 'medium':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        break;
      case 'heavy':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        break;
      case 'soft':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
        break;
      case 'rigid':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
        break;
    }
  }, [enabled, style, minInterval]);

  const triggerDrawingHaptic = useCallback((velocity: number, pressure: number = 0.5) => {
    if (!enabled) return;

    const now = Date.now();
    hapticCounter.current++;

    // Calculate haptic intensity based on velocity and pressure
    const velocityNormalized = Math.min(1, velocity / 500); // Normalize velocity to 0-1
    const deltaVelocity = Math.abs(velocity - lastVelocity.current) / 500;
    lastVelocity.current = velocity;

    // Continuous feedback with fixed short interval for smooth sensation
    const fixedInterval = 20; // 50Hz feedback rate for smooth continuous feel
    
    if (now - lastHapticTime.current < fixedInterval) return;
    lastHapticTime.current = now;

    // Adjust haptic style based on velocity for natural feel
    if (velocity < 50) {
      // Very slow movement - ultra soft continuous feedback
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
    } else if (velocity < 150) {
      // Medium speed - alternate between soft and light for texture
      if (hapticCounter.current % 2 === 0) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } else if (velocity < 300) {
      // Fast movement - consistent light feedback
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else {
      // Very fast - medium feedback for stronger sensation
      if (hapticCounter.current % 2 === 0) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    }

    // Add extra pulse on sharp direction changes
    if (deltaVelocity > 0.4) {
      setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }, 10);
    }
  }, [enabled]);

  const triggerSelection = useCallback(() => {
    if (!enabled) return;
    Haptics.selectionAsync();
  }, [enabled]);

  const triggerNotification = useCallback((type: 'success' | 'warning' | 'error' = 'success') => {
    if (!enabled) return;
    
    switch (type) {
      case 'success':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
      case 'warning':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        break;
      case 'error':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        break;
    }
  }, [enabled]);

  return {
    triggerHaptic,
    triggerDrawingHaptic,
    triggerSelection,
    triggerNotification,
  };
}
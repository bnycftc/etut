import * as Haptics from 'expo-haptics';
import { AccessibilityInfo } from 'react-native';

/**
 * Haptic and screen-reader feedback. Every call is fire-and-forget: a device without a Taptic
 * Engine, the web preview or a missing screen reader simply gets nothing.
 */

function ignore(): void {
  // Feedback is optional; a failure must never reach the timer.
}

/** A session was saved (iOS "success" pattern). */
export function hapticSuccess(): void {
  try {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(ignore);
  } catch {
    ignore();
  }
}

/** A light tap for starting, resuming or undoing. */
export function hapticTap(): void {
  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(ignore);
  } catch {
    ignore();
  }
}

/** Reads `message` out with VoiceOver / TalkBack when one is running. */
export function announce(message: string): void {
  try {
    AccessibilityInfo.announceForAccessibility(message);
  } catch {
    ignore();
  }
}

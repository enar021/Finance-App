import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { getDateKey } from './dates';

export const NOTIF_ENABLED_KEY = '@pennywise_notifications_enabled';
const LAST_MIDDAY_KEY = '@pennywise_last_midday_notif';
const LAST_EVENING_KEY = '@pennywise_last_evening_notif';

export const REMINDER_TIMES = {
  midday: { hour: 13, minute: 0, label: '1:00 PM', name: 'Midday Check-in' },
  evening: { hour: 20, minute: 30, label: '8:30 PM', name: 'Evening Wrap-up' },
};

export type NotificationPermissionStatus =
  | 'granted'
  | 'denied'
  | 'default'
  | 'unsupported';

/**
 * Check browser or device notification permission status
 */
export function getNotificationPermissionStatus(): NotificationPermissionStatus {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && 'Notification' in window) {
    return Notification.permission as NotificationPermissionStatus;
  }
  return 'unsupported';
}

/**
 * Request notification permissions from user
 */
export async function requestNotificationPermission(): Promise<NotificationPermissionStatus> {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && 'Notification' in window) {
    try {
      const permission = await Notification.requestPermission();
      return permission as NotificationPermissionStatus;
    } catch {
      return 'denied';
    }
  }
  return 'unsupported';
}

/**
 * Dispatch a notification via Service Worker or Web Notification
 */
export async function sendNotification(title: string, body: string): Promise<boolean> {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  if (Notification.permission !== 'granted') {
    return false;
  }

  try {
    const iconUrl = '/Finance-App/icon-192.png';
    const badgeUrl = '/Finance-App/favicon.png';

    // If Service Worker registration is active, use showNotification for better mobile PWA support
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && 'showNotification' in reg) {
        await reg.showNotification(title, {
          body,
          icon: iconUrl,
          badge: badgeUrl,
          tag: 'pennywise-reminder',
        });
        return true;
      }
    }

    // Fallback to standard Notification constructor
    new Notification(title, {
      body,
      icon: iconUrl,
      badge: badgeUrl,
      tag: 'pennywise-reminder',
    });
    return true;
  } catch (err) {
    console.warn('Could not display notification:', err);
    return false;
  }
}

/**
 * Send an immediate test notification
 */
export async function sendTestReminder(): Promise<{ ok: boolean; status: NotificationPermissionStatus }> {
  let status = getNotificationPermissionStatus();

  if (status === 'default') {
    status = await requestNotificationPermission();
  }

  if (status !== 'granted') {
    return { ok: false, status };
  }

  const success = await sendNotification(
    'Penny Wise • Reminders Active! 🔔',
    "Daily reminders are working! You'll be notified at 1:00 PM and 8:30 PM to log expenses."
  );

  return { ok: success, status };
}

/**
 * Check if notifications are enabled by user setting
 */
export async function areNotificationsEnabled(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(NOTIF_ENABLED_KEY);
    return val === null ? true : val === 'true';
  } catch {
    return true;
  }
}

/**
 * Set user notification toggle preference
 */
export async function setNotificationsEnabled(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(NOTIF_ENABLED_KEY, enabled ? 'true' : 'false');
  } catch {
    // ignore
  }
}

/**
 * Check current time and fire midday (13:00) or evening (20:30) reminders
 */
export async function checkAndTriggerScheduledReminders(): Promise<void> {
  const isEnabled = await areNotificationsEnabled();
  if (!isEnabled) return;

  const status = getNotificationPermissionStatus();
  if (status !== 'granted') return;

  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const todayKey = getDateKey(now);

  // 1. Midday Reminder: Target 13:00 (1:00 PM), window 13:00 - 15:00
  if (
    (currentHour === 13 && currentMinute >= 0) ||
    currentHour === 14
  ) {
    const lastMidday = await AsyncStorage.getItem(LAST_MIDDAY_KEY);
    if (lastMidday !== todayKey) {
      await AsyncStorage.setItem(LAST_MIDDAY_KEY, todayKey);
      await sendNotification(
        'Penny Wise • Midday Check-in ☀️',
        'Grabbed lunch or morning coffee? Log your expenses in Penny Wise to stay within budget!'
      );
    }
  }

  // 2. Evening Reminder: Target 20:30 (8:30 PM), window 20:30 - 23:59
  if (
    (currentHour === 20 && currentMinute >= 30) ||
    currentHour >= 21
  ) {
    const lastEvening = await AsyncStorage.getItem(LAST_EVENING_KEY);
    if (lastEvening !== todayKey) {
      await AsyncStorage.setItem(LAST_EVENING_KEY, todayKey);
      await sendNotification(
        'Penny Wise • Evening Wrap-up 🌙',
        "Don't forget to record today's spending in Penny Wise before your day ends!"
      );
    }
  }
}

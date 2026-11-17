import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getDateKey } from './dates';

export const NOTIF_ENABLED_KEY = '@pennywise_notifications_enabled';
const LAST_MIDDAY_KEY = '@pennywise_last_midday_notif';
const LAST_EVENING_KEY = '@pennywise_last_evening_notif';

const MIDDAY_NOTIF_ID = 'pennywise-midday';
const EVENING_NOTIF_ID = 'pennywise-evening';
const REMINDER_CHANNEL_ID = 'pennywise-daily-reminders';

export const REMINDER_TIMES = {
  midday: { hour: 13, minute: 0, label: '1:00 PM', name: 'Midday Check-in' },
  evening: { hour: 20, minute: 30, label: '8:30 PM', name: 'Evening Wrap-up' },
};

export type NotificationPermissionStatus =
  | 'granted'
  | 'denied'
  | 'default'
  | 'unsupported';

let cachedNativePermissionStatus: NotificationPermissionStatus = 'default';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

function mapExpoPermissionStatus(
  status: Notifications.PermissionStatus
): NotificationPermissionStatus {
  if (status === Notifications.PermissionStatus.GRANTED) return 'granted';
  if (status === Notifications.PermissionStatus.DENIED) return 'denied';
  return 'default';
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
      name: 'Daily Expense Reminders',
      importance: 6 as Notifications.AndroidImportance, // AndroidImportance.HIGH
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#10B981',
    });
  } catch {
    // ignore channel setup errors on unsupported environments
  }
}

/**
 * Synchronous permission status check (uses cached status on native)
 */
export function getNotificationPermissionStatus(): NotificationPermissionStatus {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission as NotificationPermissionStatus;
    }
    return 'unsupported';
  }
  return cachedNativePermissionStatus;
}

/**
 * Async permission status check across Web, iOS, and Android
 */
export async function getNotificationPermissionStatusAsync(): Promise<NotificationPermissionStatus> {
  if (Platform.OS === 'web') {
    return getNotificationPermissionStatus();
  }

  try {
    const settings = await Notifications.getPermissionsAsync();
    const mapped = mapExpoPermissionStatus(settings.status);
    cachedNativePermissionStatus = mapped;
    return mapped;
  } catch {
    return 'unsupported';
  }
}

/**
 * Request notification permissions from user on Web, iOS, or Android
 */
export async function requestNotificationPermission(): Promise<NotificationPermissionStatus> {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const permission = await Notification.requestPermission();
        return permission as NotificationPermissionStatus;
      } catch {
        return 'denied';
      }
    }
    return 'unsupported';
  }

  try {
    await ensureAndroidChannel();
    const existing = await Notifications.getPermissionsAsync();
    let finalStatus = existing.status;

    if (finalStatus !== Notifications.PermissionStatus.GRANTED) {
      const requested = await Notifications.requestPermissionsAsync();
      finalStatus = requested.status;
    }

    const mapped = mapExpoPermissionStatus(finalStatus);
    cachedNativePermissionStatus = mapped;

    if (mapped === 'granted') {
      await syncNativeScheduledReminders();
    }

    return mapped;
  } catch {
    cachedNativePermissionStatus = 'denied';
    return 'denied';
  }
}

/**
 * Dispatch an immediate notification via Expo Notifications (native) or Service Worker / Web Notification (web)
 */
export async function sendNotification(title: string, body: string): Promise<boolean> {
  if (Platform.OS !== 'web') {
    const status = await getNotificationPermissionStatusAsync();
    if (status !== 'granted') {
      return false;
    }

    try {
      await ensureAndroidChannel();
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: true,
        },
        trigger: null,
      });
      return true;
    } catch (err) {
      console.warn('Could not display native notification:', err);
      return false;
    }
  }

  if (typeof window === 'undefined' || !('Notification' in window)) {
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
  let status = await getNotificationPermissionStatusAsync();

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
 * Cancel native scheduled daily reminders
 */
export async function cancelNativeDailyReminders(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelScheduledNotificationAsync(MIDDAY_NOTIF_ID);
  } catch {
    // ignore if not scheduled
  }
  try {
    await Notifications.cancelScheduledNotificationAsync(EVENING_NOTIF_ID);
  } catch {
    // ignore if not scheduled
  }
}

/**
 * Register daily repeating OS notifications at 1:00 PM and 8:30 PM on iOS & Android
 */
export async function syncNativeScheduledReminders(): Promise<void> {
  if (Platform.OS === 'web') return;

  const isEnabled = await areNotificationsEnabled();
  if (!isEnabled) {
    await cancelNativeDailyReminders();
    return;
  }

  const status = await getNotificationPermissionStatusAsync();
  if (status !== 'granted') return;

  try {
    await ensureAndroidChannel();

    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const hasMidday = scheduled.some((item) => item.identifier === MIDDAY_NOTIF_ID);
    const hasEvening = scheduled.some((item) => item.identifier === EVENING_NOTIF_ID);

    if (!hasMidday) {
      await Notifications.scheduleNotificationAsync({
        identifier: MIDDAY_NOTIF_ID,
        content: {
          title: 'Penny Wise • Midday Check-in ☀️',
          body: 'Grabbed lunch or morning coffee? Log your expenses in Penny Wise to stay within budget!',
          sound: true,
        },
        trigger: {
          type: 'daily' as Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: REMINDER_TIMES.midday.hour,
          minute: REMINDER_TIMES.midday.minute,
          ...(Platform.OS === 'android' ? { channelId: REMINDER_CHANNEL_ID } : {}),
        },
      });
    }

    if (!hasEvening) {
      await Notifications.scheduleNotificationAsync({
        identifier: EVENING_NOTIF_ID,
        content: {
          title: 'Penny Wise • Evening Wrap-up 🌙',
          body: "Don't forget to record today's spending in Penny Wise before your day ends!",
          sound: true,
        },
        trigger: {
          type: 'daily' as Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: REMINDER_TIMES.evening.hour,
          minute: REMINDER_TIMES.evening.minute,
          ...(Platform.OS === 'android' ? { channelId: REMINDER_CHANNEL_ID } : {}),
        },
      });
    }
  } catch (err) {
    console.warn('Could not schedule native reminders:', err);
  }
}

/**
 * Set user notification toggle preference and sync native schedules
 */
export async function setNotificationsEnabled(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(NOTIF_ENABLED_KEY, enabled ? 'true' : 'false');
    if (Platform.OS !== 'web') {
      if (enabled) {
        await syncNativeScheduledReminders();
      } else {
        await cancelNativeDailyReminders();
      }
    }
  } catch {
    // ignore
  }
}

/**
 * Sync native OS daily schedules (iOS/Android) or fire foreground/PWA window checks (Web)
 */
export async function checkAndTriggerScheduledReminders(): Promise<void> {
  if (Platform.OS !== 'web') {
    await syncNativeScheduledReminders();
    return;
  }

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
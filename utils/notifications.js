"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.REMINDER_TIMES = exports.NOTIF_ENABLED_KEY = void 0;
exports.getNotificationPermissionStatus = getNotificationPermissionStatus;
exports.getNotificationPermissionStatusAsync = getNotificationPermissionStatusAsync;
exports.requestNotificationPermission = requestNotificationPermission;
exports.sendNotification = sendNotification;
exports.sendTestReminder = sendTestReminder;
exports.areNotificationsEnabled = areNotificationsEnabled;
exports.cancelNativeDailyReminders = cancelNativeDailyReminders;
exports.syncNativeScheduledReminders = syncNativeScheduledReminders;
exports.setNotificationsEnabled = setNotificationsEnabled;
exports.checkAndTriggerScheduledReminders = checkAndTriggerScheduledReminders;
const async_storage_1 = __importDefault(require("@react-native-async-storage/async-storage"));
const Notifications = __importStar(require("expo-notifications"));
const react_native_1 = require("react-native");
const dates_1 = require("./dates");
exports.NOTIF_ENABLED_KEY = '@pennywise_notifications_enabled';
const LAST_MIDDAY_KEY = '@pennywise_last_midday_notif';
const LAST_EVENING_KEY = '@pennywise_last_evening_notif';
const MIDDAY_NOTIF_ID = 'pennywise-midday';
const EVENING_NOTIF_ID = 'pennywise-evening';
const REMINDER_CHANNEL_ID = 'pennywise-daily-reminders';
exports.REMINDER_TIMES = {
    midday: { hour: 13, minute: 0, label: '1:00 PM', name: 'Midday Check-in' },
    evening: { hour: 20, minute: 30, label: '8:30 PM', name: 'Evening Wrap-up' },
};
let cachedNativePermissionStatus = 'default';
if (react_native_1.Platform.OS !== 'web') {
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
function mapExpoPermissionStatus(status) {
    if (status === Notifications.PermissionStatus.GRANTED)
        return 'granted';
    if (status === Notifications.PermissionStatus.DENIED)
        return 'denied';
    return 'default';
}
async function ensureAndroidChannel() {
    if (react_native_1.Platform.OS !== 'android')
        return;
    try {
        await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
            name: 'Daily Expense Reminders',
            importance: 6, // AndroidImportance.HIGH
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#10B981',
        });
    }
    catch {
        // ignore channel setup errors on unsupported environments
    }
}
/**
 * Synchronous permission status check (uses cached status on native)
 */
function getNotificationPermissionStatus() {
    if (react_native_1.Platform.OS === 'web') {
        if (typeof window !== 'undefined' && 'Notification' in window) {
            return Notification.permission;
        }
        return 'unsupported';
    }
    return cachedNativePermissionStatus;
}
/**
 * Async permission status check across Web, iOS, and Android
 */
async function getNotificationPermissionStatusAsync() {
    if (react_native_1.Platform.OS === 'web') {
        return getNotificationPermissionStatus();
    }
    try {
        const settings = await Notifications.getPermissionsAsync();
        const mapped = mapExpoPermissionStatus(settings.status);
        cachedNativePermissionStatus = mapped;
        return mapped;
    }
    catch {
        return 'unsupported';
    }
}
/**
 * Request notification permissions from user on Web, iOS, or Android
 */
async function requestNotificationPermission() {
    if (react_native_1.Platform.OS === 'web') {
        if (typeof window !== 'undefined' && 'Notification' in window) {
            try {
                const permission = await Notification.requestPermission();
                return permission;
            }
            catch {
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
    }
    catch {
        cachedNativePermissionStatus = 'denied';
        return 'denied';
    }
}
/**
 * Dispatch an immediate notification via Expo Notifications (native) or Service Worker / Web Notification (web)
 */
async function sendNotification(title, body) {
    if (react_native_1.Platform.OS !== 'web') {
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
        }
        catch (err) {
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
    }
    catch (err) {
        console.warn('Could not display notification:', err);
        return false;
    }
}
/**
 * Send an immediate test notification
 */
async function sendTestReminder() {
    let status = await getNotificationPermissionStatusAsync();
    if (status === 'default') {
        status = await requestNotificationPermission();
    }
    if (status !== 'granted') {
        return { ok: false, status };
    }
    const success = await sendNotification('Penny Wise • Reminders Active! 🔔', "Daily reminders are working! You'll be notified at 1:00 PM and 8:30 PM to log expenses.");
    return { ok: success, status };
}
/**
 * Check if notifications are enabled by user setting
 */
async function areNotificationsEnabled() {
    try {
        const val = await async_storage_1.default.getItem(exports.NOTIF_ENABLED_KEY);
        return val === null ? false : val === 'true';
    }
    catch {
        return false;
    }
}
/**
 * Cancel native scheduled daily reminders
 */
async function cancelNativeDailyReminders() {
    if (react_native_1.Platform.OS === 'web')
        return;
    try {
        await Notifications.cancelScheduledNotificationAsync(MIDDAY_NOTIF_ID);
    }
    catch {
        // ignore if not scheduled
    }
    try {
        await Notifications.cancelScheduledNotificationAsync(EVENING_NOTIF_ID);
    }
    catch {
        // ignore if not scheduled
    }
}
/**
 * Register daily repeating OS notifications at 1:00 PM and 8:30 PM on iOS & Android
 */
async function syncNativeScheduledReminders() {
    if (react_native_1.Platform.OS === 'web')
        return;
    const isEnabled = await areNotificationsEnabled();
    if (!isEnabled) {
        await cancelNativeDailyReminders();
        return;
    }
    const status = await getNotificationPermissionStatusAsync();
    if (status !== 'granted')
        return;
    try {
        await ensureAndroidChannel();
        await cancelNativeDailyReminders();
        await Notifications.scheduleNotificationAsync({
            identifier: MIDDAY_NOTIF_ID,
            content: {
                title: 'Penny Wise • Midday Check-in ☀️',
                body: 'Grabbed lunch or morning coffee? Log your expenses in Penny Wise to stay within budget!',
                sound: true,
            },
            trigger: {
                type: 'daily',
                hour: exports.REMINDER_TIMES.midday.hour,
                minute: exports.REMINDER_TIMES.evening.minute,
                ...(react_native_1.Platform.OS === 'android' ? { channelId: REMINDER_CHANNEL_ID } : {}),
            },
        });
        await Notifications.scheduleNotificationAsync({
            identifier: EVENING_NOTIF_ID,
            content: {
                title: 'Penny Wise • Evening Wrap-up 🌙',
                body: "Don't forget to record today's spending in Penny Wise before your day ends!",
                sound: true,
            },
            trigger: {
                type: 'daily',
                hour: exports.REMINDER_TIMES.evening.hour,
                minute: exports.REMINDER_TIMES.evening.minute,
                ...(react_native_1.Platform.OS === 'android' ? { channelId: REMINDER_CHANNEL_ID } : {}),
            },
        });
    }
    catch (err) {
        console.warn('Could not schedule native reminders:', err);
    }
}
/**
 * Set user notification toggle preference and sync native schedules
 */
async function setNotificationsEnabled(enabled) {
    try {
        await async_storage_1.default.setItem(exports.NOTIF_ENABLED_KEY, enabled ? 'true' : 'false');
        if (react_native_1.Platform.OS !== 'web') {
            if (enabled) {
                await syncNativeScheduledReminders();
            }
            else {
                await cancelNativeDailyReminders();
            }
        }
    }
    catch {
        // ignore
    }
}
/**
 * Sync native OS daily schedules (iOS/Android) or fire foreground/PWA window checks (Web)
 */
async function checkAndTriggerScheduledReminders() {
    if (react_native_1.Platform.OS !== 'web') {
        await syncNativeScheduledReminders();
        return;
    }
    const isEnabled = await areNotificationsEnabled();
    if (!isEnabled)
        return;
    const status = getNotificationPermissionStatus();
    if (status !== 'granted')
        return;
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const todayKey = (0, dates_1.getDateKey)(now);
    // 1. Midday Reminder: Target 13:00 (1:00 PM), window 13:00 - 15:00
    if ((currentHour === 13 && currentMinute >= 0) ||
        currentHour === 14) {
        const lastMidday = await async_storage_1.default.getItem(LAST_MIDDAY_KEY);
        if (lastMidday !== todayKey) {
            await async_storage_1.default.setItem(LAST_MIDDAY_KEY, todayKey);
            await sendNotification('Penny Wise • Midday Check-in ☀️', 'Grabbed lunch or morning coffee? Log your expenses in Penny Wise to stay within budget!');
        }
    }
    // 2. Evening Reminder: Target 20:30 (8:30 PM), window 20:30 - 23:59
    if ((currentHour === 20 && currentMinute >= 30) ||
        currentHour >= 21) {
        const lastEvening = await async_storage_1.default.getItem(LAST_EVENING_KEY);
        if (lastEvening !== todayKey) {
            await async_storage_1.default.setItem(LAST_EVENING_KEY, todayKey);
            await sendNotification('Penny Wise • Evening Wrap-up 🌙', "Don't forget to record today's spending in Penny Wise before your day ends!");
        }
    }
}

import React, { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '@/constants/theme';
import {
  areNotificationsEnabled,
  getNotificationPermissionStatus,
  getNotificationPermissionStatusAsync,
  requestNotificationPermission,
  sendTestReminder,
  setNotificationsEnabled,
  type NotificationPermissionStatus,
} from '@/utils/notifications';
import { showAlert } from '@/utils/alerts';

export default function NotificationSettingsScreen() {
  const [enabled, setEnabled] = useState(false);
  const [permission, setPermission] = useState<NotificationPermissionStatus>(
    getNotificationPermissionStatus()
  );

  useEffect(() => {
    let active = true;
    areNotificationsEnabled().then((value) => {
      if (active) setEnabled(value);
    });
    getNotificationPermissionStatusAsync().then((value) => {
      if (active) setPermission(value);
    });
    return () => {
      active = false;
    };
  }, []);

  const handleToggle = async (value: boolean) => {
    setEnabled(value);
    await setNotificationsEnabled(value);
    if (!value) return;

    const status = await requestNotificationPermission();
    setPermission(status);
    if (status === 'granted') {
      showAlert('Reminders active', 'Daily reminders are scheduled for 1:00 PM and 8:30 PM.');
    } else if (status === 'denied') {
      showAlert(
        'Permission blocked',
        `Allow notifications for Penny Wise in ${Platform.OS === 'web' ? 'your browser site settings' : 'your device app settings'}.`
      );
    }
  };

  const handleTest = async () => {
    const result = await sendTestReminder();
    setPermission(result.status);
    if (result.ok) {
      showAlert(
        'Test sent',
        Platform.OS === 'web'
          ? 'The browser accepted the notification. Your browser and device settings control whether web notifications show as banners or play a sound.'
          : 'Check your notification banner.'
      );
    } else if (result.status === 'denied') {
      showAlert('Permission blocked', 'Allow notifications in your device or browser settings.');
    } else if (result.status === 'unsupported') {
      showAlert(
        'Notifications unavailable',
        Platform.OS === 'web'
          ? 'Web notifications require a supported browser or installed web app.'
          : 'Notifications are not supported on this device.'
      );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>Choose whether Penny Wise can send expense reminders.</Text>
        <View style={styles.card}>
          <View style={styles.toggleRow}>
            <View style={styles.iconCircle}>
              <Ionicons name="notifications-outline" size={20} color="#D97706" />
            </View>
            <View style={styles.toggleText}>
              <Text style={styles.title}>Daily reminders</Text>
              <Text style={styles.subtitle}>Two reminders each day</Text>
            </View>
            <Switch
              value={enabled}
              onValueChange={handleToggle}
              trackColor={{ false: '#CBD5E1', true: THEME.colors.pillDark }}
              thumbColor="#FFFFFF"
            />
          </View>
          <View style={styles.schedule}>
            <View style={styles.scheduleRow}>
              <Text style={styles.scheduleName}>Midday check-in</Text>
              <Text style={styles.scheduleTime}>1:00 PM</Text>
            </View>
            <View style={styles.scheduleRow}>
              <Text style={styles.scheduleName}>Evening wrap-up</Text>
              <Text style={styles.scheduleTime}>8:30 PM</Text>
            </View>
          </View>
          <Text style={styles.permission}>
            Permission: {permission === 'granted' ? 'Allowed' : permission === 'denied' ? 'Blocked' : permission}
          </Text>
          <TouchableOpacity style={styles.testButton} onPress={handleTest} activeOpacity={0.75}>
            <Ionicons name="paper-plane-outline" size={16} color={THEME.colors.pillDark} />
            <Text style={styles.testText}>Send test reminder</Text>
          </TouchableOpacity>
          {Platform.OS === 'web' && (
            <Text style={styles.webNotificationNote}>
              On iPhone, add Penny Wise to the Home Screen, then enable Banners and Sounds in
              Settings {'>'} Notifications {'>'} Penny Wise. Focus or Scheduled Summary may silence
              or delay alerts.
            </Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: THEME.colors.background },
  content: { gap: 14, padding: 20, paddingBottom: 36 },
  intro: { color: THEME.colors.textSecondary, fontSize: 14, lineHeight: 20 },
  card: {
    backgroundColor: THEME.colors.white,
    borderColor: '#E2E8F0',
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    padding: 16,
  },
  toggleRow: { alignItems: 'center', flexDirection: 'row', gap: 11 },
  iconCircle: {
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  toggleText: { flex: 1 },
  title: { color: THEME.colors.textDark, fontSize: 15, fontWeight: '800' },
  subtitle: { color: THEME.colors.textSecondary, fontSize: 12, marginTop: 3 },
  schedule: {
    backgroundColor: '#F8FAFC',
    borderRadius: THEME.radius.md,
    gap: 11,
    marginTop: 18,
    padding: 14,
  },
  scheduleRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  scheduleName: { color: THEME.colors.textDark, fontSize: 13, fontWeight: '700' },
  scheduleTime: { color: THEME.colors.textSecondary, fontSize: 13, fontWeight: '700' },
  permission: { color: THEME.colors.textMuted, fontSize: 12, marginTop: 13 },
  testButton: {
    alignItems: 'center',
    backgroundColor: THEME.colors.mintCard,
    borderColor: '#CCE2D8',
    borderRadius: THEME.radius.full,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    marginTop: 14,
    paddingVertical: 12,
  },
  testText: { color: THEME.colors.pillDark, fontSize: 13, fontWeight: '800' },
  webNotificationNote: {
    backgroundColor: '#F8FAFC',
    borderRadius: THEME.radius.md,
    color: THEME.colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 12,
    padding: 12,
  },
});

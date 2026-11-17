import React, { useCallback, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { THEME } from '@/constants/theme';
import { useFinanceStore } from '@/store/useFinanceStore';
import { formatCurrency, formatMonthLabel } from '@/utils/dates';
import { areNotificationsEnabled } from '@/utils/notifications';

const menuItems = [
  {
    route: '/settings/budget' as const,
    title: 'Budget & cycle',
    subtitle: 'Account, allowance, savings balance and monthly rollover',
    icon: 'wallet-outline' as const,
  },
  {
    route: '/settings/subscriptions' as const,
    title: 'Subscriptions',
    subtitle: 'Manage recurring monthly expenses',
    icon: 'repeat-outline' as const,
  },
  {
    route: '/settings/notifications' as const,
    title: 'Notifications',
    subtitle: 'Daily reminders and permission settings',
    icon: 'notifications-outline' as const,
  },
  {
    route: '/settings/about' as const,
    title: 'Privacy & About',
    subtitle: 'Privacy notice, terms and data controls',
    icon: 'shield-checkmark-outline' as const,
  },
];

export default function SettingsScreen() {
  const stats = useFinanceStore((state) => state.stats);
  const subscriptions = useFinanceStore((state) => state.subscriptions);
  const activeSubscriptionCount = subscriptions.filter(
    (subscription) => !subscription.cancelledFromMonth
  ).length;
  const isConfigured = Boolean(
    stats.bankName && stats.baseAllowance !== null && stats.totalBank !== null
  );
  const [remindersEnabled, setRemindersEnabled] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      areNotificationsEnabled().then((enabled) => {
        if (active) setRemindersEnabled(enabled);
      });
      return () => {
        active = false;
      };
    }, [])
  );

  const summary =
    stats.baseAllowance === null
      ? 'Budget not set up'
      : `${formatMonthLabel(stats.currentMonthLabel)} · ₱ ${formatCurrency(stats.baseAllowance)} monthly`;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heading}>
          <Text style={styles.eyebrow}>PREFERENCES</Text>
          <Text style={styles.title}>Settings</Text>
          <Text style={styles.subtitle}>Choose what you want to manage.</Text>
        </View>

        {menuItems
          .filter((item) => item.route !== '/settings/subscriptions' || isConfigured)
          .map((item) => {
            let subtitle = item.subtitle;
            if (item.route === '/settings/budget') subtitle = summary;
            if (item.route === '/settings/subscriptions') {
              subtitle = `${activeSubscriptionCount} active · manage recurring expenses`;
            }
            if (item.route === '/settings/notifications') {
              subtitle = remindersEnabled ? 'Daily reminders are on' : 'Daily reminders are off';
            }

            return (
              <TouchableOpacity
                key={item.route}
                style={styles.menuItem}
                onPress={() => router.push(item.route)}
                activeOpacity={0.75}
                accessibilityRole="button"
              >
                <View style={styles.iconCircle}>
                  <Ionicons name={item.icon} size={20} color={THEME.colors.pillDark} />
                </View>
                <View style={styles.menuText}>
                  <Text style={styles.menuTitle}>{item.title}</Text>
                  <Text style={styles.menuSubtitle}>{subtitle}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={THEME.colors.textMuted} />
              </TouchableOpacity>
            );
          })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: THEME.colors.background },
  content: { gap: 12, padding: 20, paddingBottom: 36 },
  heading: { marginBottom: 8 },
  eyebrow: { color: THEME.colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  title: { color: THEME.colors.textDark, fontSize: 29, fontWeight: '800', marginTop: 4 },
  subtitle: { color: THEME.colors.textSecondary, fontSize: 14, marginTop: 4 },
  menuItem: {
    alignItems: 'center',
    backgroundColor: THEME.colors.white,
    borderColor: '#E2E8F0',
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 76,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  iconCircle: {
    alignItems: 'center',
    backgroundColor: THEME.colors.mintCard,
    borderRadius: 13,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  menuText: { flex: 1 },
  menuTitle: { color: THEME.colors.textDark, fontSize: 15, fontWeight: '800' },
  menuSubtitle: { color: THEME.colors.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 3 },
});

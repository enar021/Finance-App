import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import SavingsCard from '@/components/SavingsCard';
import SavingsHistoryModal from '@/components/SavingsHistoryModal';
import { THEME } from '@/constants/theme';
import { useFinanceStore } from '@/store/useFinanceStore';
import { formatCurrency, formatMonthLabel } from '@/utils/dates';
import {
  areNotificationsEnabled,
  getNotificationPermissionStatus,
  requestNotificationPermission,
  sendTestReminder,
  setNotificationsEnabled,
  type NotificationPermissionStatus,
} from '@/utils/notifications';

function parseMoney(value: string): number | null {
  const normalized = value.replace(/,/g, '').trim();
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;

  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : null;
}

export default function SettingsScreen() {
  const { stats, savingsHistory, saveSettings, endMonth, resetAllData } = useFinanceStore();
  const [bankName, setBankName] = useState(stats.bankName);
  const [allowanceInput, setAllowanceInput] = useState(
    stats.baseAllowance === null ? '' : stats.baseAllowance.toString()
  );
  const [savingsInput, setSavingsInput] = useState(
    stats.totalBank === null ? '' : stats.totalBank.toString()
  );
  const [showSavingsModal, setShowSavingsModal] = useState(false);
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [permStatus, setPermStatus] = useState<NotificationPermissionStatus>('default');

  useEffect(() => {
    setBankName(stats.bankName);
    setAllowanceInput(stats.baseAllowance === null ? '' : stats.baseAllowance.toString());
    setSavingsInput(stats.totalBank === null ? '' : stats.totalBank.toString());
    areNotificationsEnabled().then(setRemindersEnabled);
    setPermStatus(getNotificationPermissionStatus());
  }, [stats.bankName, stats.baseAllowance, stats.totalBank]);

  const handleToggleReminders = async (val: boolean) => {
    setRemindersEnabled(val);
    await setNotificationsEnabled(val);
    if (val) {
      const status = await requestNotificationPermission();
      setPermStatus(status);
      if (status === 'granted') {
        Alert.alert(
          'Reminders Active 🔔',
          "You will receive reminders at 1:00 PM and 8:30 PM daily to record your expenses."
        );
      } else if (status === 'denied') {
        Alert.alert(
          'Permission Blocked',
          'Notifications are blocked in your browser settings. Please allow notifications for Penny Wise in your browser settings.'
        );
      }
    }
  };

  const handleTestReminder = async () => {
    const result = await sendTestReminder();
    setPermStatus(result.status);
    if (result.ok) {
      Alert.alert('Test Sent! 🔔', 'Check your device notification banner.');
    } else if (result.status === 'denied') {
      Alert.alert(
        'Permission Blocked',
        'Please allow notifications for Penny Wise in your browser site settings.'
      );
    } else if (result.status === 'unsupported') {
      Alert.alert(
        'Notifications',
        'Web notifications require adding Penny Wise to your Home Screen on iOS (Safari > Share > Add to Home Screen).'
      );
    }
  };

  const isConfigured = Boolean(
    stats.bankName && stats.baseAllowance !== null && stats.totalBank !== null
  );

  const handleSave = () => {
    const allowance = parseMoney(allowanceInput);
    const savingsBalance = parseMoney(savingsInput);
    if (!bankName.trim()) {
      Alert.alert('Add an account name', 'Enter the name of the account where you save money.');
      return;
    }
    if (allowance === null) {
      Alert.alert('Invalid allowance', 'Enter a non-negative amount with up to two decimal places.');
      return;
    }
    if (savingsBalance === null) {
      Alert.alert('Invalid savings balance', 'Enter a non-negative amount with up to two decimal places.');
      return;
    }

    saveSettings(bankName, allowance, savingsBalance);
    Alert.alert('Saved', 'Your budget settings have been updated.');
  };

  const handleRollover = () => {
    if (!isConfigured || stats.currentRemaining === null || stats.baseAllowance === null) return;

    const transfer = Math.max(0, stats.currentRemaining);
    Alert.alert(
      'Start next month?',
      `This adds ₱ ${formatCurrency(transfer)} to ${stats.bankName} and opens the next monthly budget with ₱ ${formatCurrency(stats.baseAllowance)}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Start next month', onPress: endMonth },
      ]
    );
  };

  const handleReset = () => {
    Alert.alert(
      'Clear ledger data?',
      'This removes the saved account name, budget, savings balance, and expenses from this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear data', style: 'destructive', onPress: resetAllData },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View>
            <Text style={styles.eyebrow}>SETTINGS</Text>
            <Text style={styles.title}>Budget details</Text>
            <Text style={styles.subtitle}>These values are used for each monthly budget cycle.</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeading}>
              <View style={styles.iconCircle}>
                <Ionicons name="business-outline" size={18} color={THEME.colors.pillDark} />
              </View>
              <Text style={styles.cardTitle}>Savings account</Text>
            </View>
            <Text style={styles.label}>ACCOUNT NAME</Text>
            <TextInput
              autoCapitalize="words"
              autoCorrect={false}
              onChangeText={setBankName}
              placeholder="e.g. Savings account"
              placeholderTextColor={THEME.colors.textMuted}
              style={styles.input}
              value={bankName}
            />

            <Text style={styles.label}>MONTHLY ALLOWANCE</Text>
            <TextInput
              keyboardType="decimal-pad"
              onChangeText={setAllowanceInput}
              placeholder="0.00"
              placeholderTextColor={THEME.colors.textMuted}
              style={styles.input}
              value={allowanceInput}
            />

            <Text style={styles.label}>CURRENT SAVINGS BALANCE</Text>
            <TextInput
              keyboardType="decimal-pad"
              onChangeText={setSavingsInput}
              placeholder="0.00"
              placeholderTextColor={THEME.colors.textMuted}
              style={styles.input}
              value={savingsInput}
            />

            <TouchableOpacity style={styles.saveButton} onPress={handleSave} activeOpacity={0.8}>
              <Text style={styles.saveButtonText}>Save settings</Text>
            </TouchableOpacity>
          </View>

          {isConfigured && (
            <>
              <SavingsCard
                bankName={stats.bankName}
                totalSavings={stats.totalBank!}
                onPress={() => setShowSavingsModal(true)}
              />

              <View style={[styles.card, styles.cycleCard]}>
                <View style={styles.cardHeading}>
                  <View style={[styles.iconCircle, styles.cycleIcon]}>
                    <Ionicons name="sync-outline" size={18} color="#6D28D9" />
                  </View>
                  <Text style={styles.cardTitle}>Monthly cycle</Text>
                </View>
                <Text style={styles.cycleMonth}>{formatMonthLabel(stats.currentMonthLabel)}</Text>
                <Text style={styles.cycleText}>
                  Transfer any positive remaining balance to {stats.bankName}, then begin the next
                  month with your saved allowance.
                </Text>
                <TouchableOpacity style={styles.rolloverButton} onPress={handleRollover} activeOpacity={0.8}>
                  <Ionicons name="arrow-forward-circle-outline" size={19} color="#FFFFFF" />
                  <Text style={styles.rolloverButtonText}>Start next month</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* Daily Reminders Card */}
          <View style={styles.card}>
            <View style={styles.reminderHeader}>
              <View style={styles.cardHeading}>
                <View style={[styles.iconCircle, styles.reminderIcon]}>
                  <Ionicons name="notifications-outline" size={18} color="#D97706" />
                </View>
                <View>
                  <View style={styles.titleRowWithBadge}>
                    <Text style={styles.cardTitle}>Daily Reminders</Text>
                    <View
                      style={[
                        styles.permBadge,
                        permStatus === 'granted' ? styles.permBadgeGreen : styles.permBadgeAmber,
                      ]}
                    >
                      <Text
                        style={[
                          styles.permText,
                          permStatus === 'granted' ? styles.permTextGreen : styles.permTextAmber,
                        ]}
                      >
                        {permStatus === 'granted' ? 'Active' : 'Setup'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.reminderSubtitle}>Twice daily expense check-ins</Text>
                </View>
              </View>
              <Switch
                value={remindersEnabled}
                onValueChange={handleToggleReminders}
                trackColor={{ false: '#CBD5E1', true: THEME.colors.pillDark }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.reminderScheduleList}>
              <View style={styles.reminderRow}>
                <View style={styles.timeBadge}>
                  <Ionicons name="sunny-outline" size={15} color="#D97706" />
                  <Text style={styles.timeBadgeText}>1:00 PM</Text>
                </View>
                <View style={styles.reminderInfo}>
                  <Text style={styles.reminderTitle}>Midday Check-in</Text>
                  <Text style={styles.reminderDesc}>Log lunch & morning purchases</Text>
                </View>
              </View>

              <View style={styles.reminderRow}>
                <View style={[styles.timeBadge, styles.eveningBadge]}>
                  <Ionicons name="moon-outline" size={15} color="#4F46E5" />
                  <Text style={[styles.timeBadgeText, styles.eveningBadgeText]}>8:30 PM</Text>
                </View>
                <View style={styles.reminderInfo}>
                  <Text style={styles.reminderTitle}>Evening Wrap-up</Text>
                  <Text style={styles.reminderDesc}>{"Record today's remaining spending"}</Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={styles.testNotificationBtn}
              onPress={handleTestReminder}
              activeOpacity={0.75}
            >
              <Ionicons name="paper-plane-outline" size={16} color={THEME.colors.pillDark} />
              <Text style={styles.testNotificationText}>Send Test Reminder</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={handleReset} style={styles.resetButton} activeOpacity={0.7}>
            <Text style={styles.resetText}>Clear all data</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {showSavingsModal && (
        <SavingsHistoryModal
          visible
          bankName={stats.bankName}
          totalSavings={stats.totalBank ?? 0}
          baseAllowance={stats.baseAllowance}
          history={savingsHistory}
          onClose={() => setShowSavingsModal(false)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: THEME.colors.background },
  flex: { flex: 1 },
  content: {
    gap: 18,
    padding: 20,
    paddingBottom: 48,
  },
  eyebrow: { color: THEME.colors.textMuted, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  title: {
    color: THEME.colors.textDark,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.6,
    marginTop: 3,
  },
  subtitle: { color: THEME.colors.textSecondary, fontSize: 14, lineHeight: 20, marginTop: 5 },
  card: {
    backgroundColor: THEME.colors.white,
    borderColor: '#E2E8F0',
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    padding: 18,
  },
  cardHeading: { alignItems: 'center', flexDirection: 'row', gap: 10, marginBottom: 18 },
  iconCircle: {
    alignItems: 'center',
    backgroundColor: THEME.colors.mintCard,
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  cycleIcon: { backgroundColor: THEME.colors.lilacCard },
  cardTitle: { color: THEME.colors.textDark, fontSize: 17, fontWeight: '800' },
  label: {
    color: THEME.colors.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    color: THEME.colors.textDark,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: THEME.colors.pillDark,
    borderRadius: THEME.radius.full,
    paddingVertical: 14,
  },
  saveButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  cycleCard: { backgroundColor: THEME.colors.lilacCard, borderColor: 'rgba(196, 181, 253, 0.5)' },
  cycleMonth: { color: THEME.colors.textDark, fontSize: 18, fontWeight: '800' },
  cycleText: { color: THEME.colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 7 },
  rolloverButton: {
    alignItems: 'center',
    backgroundColor: THEME.colors.pillDark,
    borderRadius: THEME.radius.full,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    marginTop: 17,
    paddingVertical: 14,
  },
  rolloverButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  resetButton: { alignItems: 'center', paddingVertical: 12 },
  resetText: { color: THEME.colors.indicatorRed, fontSize: 14, fontWeight: '800' },
  reminderHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  titleRowWithBadge: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  permBadge: {
    borderRadius: THEME.radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  permBadgeGreen: { backgroundColor: '#D1FAE5' },
  permBadgeAmber: { backgroundColor: '#FEF3C7' },
  permText: { fontSize: 10, fontWeight: '800' },
  permTextGreen: { color: '#065F46' },
  permTextAmber: { color: '#B45309' },
  reminderIcon: { backgroundColor: '#FEF3C7' },
  reminderSubtitle: { color: THEME.colors.textSecondary, fontSize: 12, fontWeight: '600', marginTop: 2 },
  reminderScheduleList: {
    backgroundColor: '#F8FAFC',
    borderRadius: THEME.radius.md,
    gap: 12,
    marginBottom: 16,
    padding: 14,
  },
  reminderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  timeBadge: {
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  timeBadgeText: {
    color: '#B45309',
    fontSize: 12,
    fontWeight: '800',
  },
  eveningBadge: {
    backgroundColor: '#EEF2FF',
  },
  eveningBadgeText: {
    color: '#4338CA',
  },
  reminderInfo: { flex: 1 },
  reminderTitle: {
    color: THEME.colors.textDark,
    fontSize: 14,
    fontWeight: '800',
  },
  reminderDesc: {
    color: THEME.colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 1,
  },
  testNotificationBtn: {
    alignItems: 'center',
    backgroundColor: THEME.colors.mintCard,
    borderColor: '#CCE2D8',
    borderRadius: THEME.radius.full,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    paddingVertical: 12,
  },
  testNotificationText: {
    color: THEME.colors.pillDark,
    fontSize: 13,
    fontWeight: '800',
  },
});

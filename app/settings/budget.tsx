import React, { useEffect, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '@/constants/theme';
import { useFinanceStore } from '@/store/useFinanceStore';
import { formatCurrency, formatMonthLabel } from '@/utils/dates';
import { showAlert, showConfirm } from '@/utils/alerts';

function parseMoney(value: string): number | null {
  const normalized = value.replace(/,/g, '').trim();
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : null;
}

export default function BudgetSettingsScreen() {
  const stats = useFinanceStore((state) => state.stats);
  const saveSettings = useFinanceStore((state) => state.saveSettings);
  const endMonth = useFinanceStore((state) => state.endMonth);
  const [bankName, setBankName] = useState(stats.bankName);
  const [allowanceInput, setAllowanceInput] = useState(
    stats.baseAllowance === null ? '' : stats.baseAllowance.toString()
  );
  const [savingsInput, setSavingsInput] = useState(
    stats.totalBank === null ? '' : stats.totalBank.toString()
  );

  useEffect(() => {
    setBankName(stats.bankName);
    setAllowanceInput(stats.baseAllowance === null ? '' : stats.baseAllowance.toString());
    setSavingsInput(stats.totalBank === null ? '' : stats.totalBank.toString());
  }, [stats.bankName, stats.baseAllowance, stats.totalBank]);

  const isConfigured = Boolean(
    stats.bankName && stats.baseAllowance !== null && stats.totalBank !== null
  );

  const handleSave = () => {
    Keyboard.dismiss();
    const allowance = parseMoney(allowanceInput);
    const savingsBalance = parseMoney(savingsInput);
    if (!bankName.trim()) {
      showAlert('Add an account name', 'Enter the name of the account where you save money.');
      return;
    }
    if (allowance === null) {
      showAlert('Invalid allowance', 'Enter a non-negative amount with up to two decimal places.');
      return;
    }
    if (savingsBalance === null) {
      showAlert('Invalid savings balance', 'Enter a non-negative amount with up to two decimal places.');
      return;
    }
    saveSettings(bankName, allowance, savingsBalance);
    showAlert('Saved', 'Your budget settings have been updated.');
  };

  const handleRollover = () => {
    const remaining = stats.currentRemaining;
    if (!isConfigured || remaining === null || stats.baseAllowance === null) return;
    const transfer = Math.max(0, remaining);
    showConfirm(
      'Start next month?',
      `This adds ₱ ${formatCurrency(transfer)} to ${stats.bankName} and opens the next monthly budget with ₱ ${formatCurrency(stats.baseAllowance)}.`,
      { confirmText: 'Start next month', onConfirm: endMonth }
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.intro}>
            Edit the amounts used for your current budget and savings balance.
          </Text>

          <View style={styles.card}>
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
            <TouchableOpacity style={styles.primaryButton} onPress={handleSave} activeOpacity={0.8}>
              <Text style={styles.primaryButtonText}>Save budget</Text>
            </TouchableOpacity>
          </View>

          {isConfigured && (
            <View style={[styles.card, styles.cycleCard]}>
              <View style={styles.cycleHeading}>
                <Ionicons name="sync-outline" size={19} color="#6D28D9" />
                <Text style={styles.cardTitle}>Monthly cycle</Text>
              </View>
              <Text style={styles.month}>{formatMonthLabel(stats.currentMonthLabel)}</Text>
              <Text style={styles.body}>
                Start the next cycle to transfer any positive remaining balance to {stats.bankName}.
              </Text>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleRollover}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryButtonText}>Start next month</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: THEME.colors.background },
  flex: { flex: 1 },
  content: { gap: 16, padding: 20, paddingBottom: 36 },
  intro: { color: THEME.colors.textSecondary, fontSize: 14, lineHeight: 20 },
  card: {
    backgroundColor: THEME.colors.white,
    borderColor: '#E2E8F0',
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    padding: 18,
  },
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
  primaryButton: {
    alignItems: 'center',
    backgroundColor: THEME.colors.pillDark,
    borderRadius: THEME.radius.full,
    marginTop: 4,
    paddingVertical: 14,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  cycleCard: { backgroundColor: THEME.colors.lilacCard, borderColor: 'rgba(196, 181, 253, 0.5)' },
  cycleHeading: { alignItems: 'center', flexDirection: 'row', gap: 9, marginBottom: 10 },
  cardTitle: { color: THEME.colors.textDark, fontSize: 16, fontWeight: '800' },
  month: { color: THEME.colors.textDark, fontSize: 18, fontWeight: '800' },
  body: { color: THEME.colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 6 },
});

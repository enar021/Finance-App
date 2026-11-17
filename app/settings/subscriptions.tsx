import React, { useState } from 'react';
import { Alert, Keyboard, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '@/constants/theme';
import { useFinanceStore } from '@/store/useFinanceStore';
import { formatCurrency, formatMonthLabel } from '@/utils/dates';

function parseMoney(value: string): number | null {
  const normalized = value.replace(/,/g, '').trim();
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : null;
}

export default function SubscriptionsSettingsScreen() {
  const subscriptions = useFinanceStore((state) => state.subscriptions);
  const addSubscription = useFinanceStore((state) => state.addSubscription);
  const cancelSubscription = useFinanceStore((state) => state.cancelSubscription);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');

  const handleAdd = () => {
    Keyboard.dismiss();
    const monthlyAmount = parseMoney(amount);
    if (monthlyAmount === null || monthlyAmount <= 0) {
      Alert.alert('Invalid amount', 'Enter a monthly amount greater than 0.');
      return;
    }
    const result = addSubscription(name, monthlyAmount);
    if (!result.ok) {
      Alert.alert('Cannot add subscription', result.message);
      return;
    }
    setName('');
    setAmount('');
  };

  const confirmCancel = (id: string, subscriptionName: string) => {
    Alert.alert(
      'Cancel subscription?',
      `${subscriptionName} remains charged for the current budget month. No charges will be added from the next cycle.`,
      [
        { text: 'Keep subscription', style: 'cancel' },
        {
          text: 'Cancel subscription',
          style: 'destructive',
          onPress: () => cancelSubscription(id),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>
          New subscriptions start next budget cycle and are logged as expenses against Remaining.
        </Text>

        <View style={styles.card}>
          <Text style={styles.label}>SUBSCRIPTION NAME</Text>
          <TextInput
            autoCapitalize="sentences"
            maxLength={40}
            onChangeText={setName}
            placeholder="e.g. Music streaming"
            placeholderTextColor={THEME.colors.textMuted}
            style={styles.input}
            value={name}
          />
          <Text style={styles.label}>MONTHLY AMOUNT (₱)</Text>
          <TextInput
            keyboardType="decimal-pad"
            onChangeText={setAmount}
            placeholder="0.00"
            placeholderTextColor={THEME.colors.textMuted}
            style={styles.input}
            value={amount}
          />
          <TouchableOpacity style={styles.addButton} onPress={handleAdd} activeOpacity={0.8}>
            <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />
            <Text style={styles.addButtonText}>Add subscription</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.listHeader}>
          <Text style={styles.sectionTitle}>Your subscriptions</Text>
          <Text style={styles.count}>{subscriptions.length}</Text>
        </View>
        {subscriptions.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="repeat-outline" size={26} color={THEME.colors.textMuted} />
            <Text style={styles.emptyText}>No subscriptions added yet.</Text>
          </View>
        ) : (
          subscriptions.map((subscription) => (
            <View key={subscription.id} style={styles.subscriptionRow}>
              <View style={styles.subscriptionIcon}>
                <Ionicons name="repeat-outline" size={17} color={THEME.colors.pillDark} />
              </View>
              <View style={styles.subscriptionDetails}>
                <Text style={styles.subscriptionName}>{subscription.name}</Text>
                <Text style={styles.subscriptionAmount}>
                  ₱ {formatCurrency(subscription.amount)} / month
                </Text>
                <Text style={styles.subscriptionMeta}>
                  {subscription.cancelledFromMonth
                    ? `Canceled from ${formatMonthLabel(subscription.cancelledFromMonth)}`
                    : `Starts ${formatMonthLabel(subscription.startMonth)}`}
                </Text>
              </View>
              {!subscription.cancelledFromMonth && (
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => confirmCancel(subscription.id, subscription.name)}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel={`Cancel ${subscription.name} subscription`}
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
              )}
            </View>
          ))
        )}
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
  addButton: {
    alignItems: 'center',
    backgroundColor: THEME.colors.pillDark,
    borderRadius: THEME.radius.full,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    paddingVertical: 13,
  },
  addButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  listHeader: { alignItems: 'center', flexDirection: 'row', gap: 8, marginTop: 4 },
  sectionTitle: { color: THEME.colors.textDark, fontSize: 16, fontWeight: '800' },
  count: { color: THEME.colors.textMuted, fontSize: 13, fontWeight: '700' },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: THEME.colors.white,
    borderColor: '#E2E8F0',
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    gap: 8,
    padding: 24,
  },
  emptyText: { color: THEME.colors.textSecondary, fontSize: 13, fontWeight: '600' },
  subscriptionRow: {
    alignItems: 'center',
    backgroundColor: THEME.colors.white,
    borderColor: '#E2E8F0',
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 13,
  },
  subscriptionIcon: {
    alignItems: 'center',
    backgroundColor: THEME.colors.mintCard,
    borderRadius: 11,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  subscriptionDetails: { flex: 1 },
  subscriptionName: { color: THEME.colors.textDark, fontSize: 14, fontWeight: '800' },
  subscriptionAmount: { color: THEME.colors.textSecondary, fontSize: 13, fontWeight: '700', marginTop: 2 },
  subscriptionMeta: { color: THEME.colors.textMuted, fontSize: 11, fontWeight: '600', marginTop: 3 },
  cancelButton: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderRadius: THEME.radius.full,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  cancelText: { color: THEME.colors.indicatorRed, fontSize: 12, fontWeight: '800' },
});

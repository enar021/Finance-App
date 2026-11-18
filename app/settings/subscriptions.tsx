import React, { useEffect, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '@/constants/theme';
import { useFinanceStore } from '@/store/useFinanceStore';
import type { Subscription } from '@/types';
import {
  formatCurrency,
  formatMonthLabel,
  getNextMonthLabel,
  isAfterMonth,
} from '@/utils/dates';
import { showAlert, showConfirm } from '@/utils/alerts';

function parseMoney(value: string): number | null {
  const normalized = value.replace(/,/g, '').trim();
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : null;
}

type MonthPickerTarget = 'start' | 'effective' | 'payment';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function getTermsForMonth(subscription: Subscription, monthLabel: string) {
  const effectiveChange = [...(subscription.changes ?? [])]
    .filter((change) => change.effectiveMonth <= monthLabel)
    .sort((a, b) => a.effectiveMonth.localeCompare(b.effectiveMonth))
    .slice(-1)[0];
  return effectiveChange ?? { name: subscription.name, amount: subscription.amount };
}

export default function SubscriptionsSettingsScreen() {
  const subscriptions = useFinanceStore((state) => state.subscriptions);
  const stats = useFinanceStore((state) => state.stats);
  const addSubscription = useFinanceStore((state) => state.addSubscription);
  const updateSubscription = useFinanceStore((state) => state.updateSubscription);
  const setSubscriptionPaymentOverride = useFinanceStore(
    (state) => state.setSubscriptionPaymentOverride
  );
  const cancelSubscription = useFinanceStore((state) => state.cancelSubscription);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [startMonth, setStartMonth] = useState(() =>
    getNextMonthLabel(stats.currentMonthLabel)
  );
  const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null);
  const [editName, setEditName] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editEffectiveMonth, setEditEffectiveMonth] = useState('');
  const [paymentSubscription, setPaymentSubscription] = useState<Subscription | null>(null);
  const [paymentMonth, setPaymentMonth] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [monthPicker, setMonthPicker] = useState<{
    target: MonthPickerTarget;
    minimumMonth: string;
  } | null>(null);
  const [monthPickerYear, setMonthPickerYear] = useState(new Date().getFullYear());

  useEffect(() => {
    setStartMonth(getNextMonthLabel(stats.currentMonthLabel));
  }, [stats.currentMonthLabel]);

  const openMonthPicker = (
    target: MonthPickerTarget,
    selectedMonth: string,
    minimumMonth: string
  ) => {
    setMonthPicker({ target, minimumMonth });
    setMonthPickerYear(Number(selectedMonth.slice(0, 4)));
  };

  const selectPickerMonth = (monthIndex: number) => {
    if (!monthPicker) return;
    const monthLabel = `${monthPickerYear}-${String(monthIndex + 1).padStart(2, '0')}`;
    if (monthLabel < monthPicker.minimumMonth) return;

    if (monthPicker.target === 'start') setStartMonth(monthLabel);
    if (monthPicker.target === 'effective') setEditEffectiveMonth(monthLabel);
    if (monthPicker.target === 'payment') setPaymentMonth(monthLabel);
    setMonthPicker(null);
  };

  const handleAdd = () => {
    Keyboard.dismiss();
    const monthlyAmount = parseMoney(amount);
    if (monthlyAmount === null || monthlyAmount <= 0) {
      showAlert('Invalid amount', 'Enter a monthly amount greater than 0.');
      return;
    }
    const result = addSubscription(name, monthlyAmount, startMonth);
    if (!result.ok) {
      showAlert('Cannot add subscription', result.message);
      return;
    }
    setName('');
    setAmount('');
    setStartMonth(getNextMonthLabel(stats.currentMonthLabel));
  };

  const openEdit = (subscription: Subscription) => {
    const nextMonth = getNextMonthLabel(stats.currentMonthLabel);
    const effectiveMonth = isAfterMonth(subscription.startMonth, nextMonth)
      ? subscription.startMonth
      : nextMonth;
    const currentTerms = getTermsForMonth(subscription, effectiveMonth);
    setEditingSubscription(subscription);
    setEditName(currentTerms.name);
    setEditAmount(currentTerms.amount.toString());
    setEditEffectiveMonth(effectiveMonth);
  };

  const saveEdit = () => {
    if (!editingSubscription) return;
    Keyboard.dismiss();
    const monthlyAmount = parseMoney(editAmount);
    if (monthlyAmount === null || monthlyAmount <= 0) {
      showAlert('Invalid amount', 'Enter a monthly amount greater than 0.');
      return;
    }
    const result = updateSubscription(
      editingSubscription.id,
      editName,
      monthlyAmount,
      editEffectiveMonth
    );
    if (!result.ok) {
      showAlert('Cannot update subscription', result.message);
      return;
    }
    setEditingSubscription(null);
  };

  const openPayment = (subscription: Subscription) => {
    const monthLabel = isAfterMonth(
      subscription.startMonth,
      stats.currentMonthLabel
    )
      ? subscription.startMonth
      : stats.currentMonthLabel;
    const override = subscription.paymentOverrides?.find(
      (item) => item.monthLabel === monthLabel
    );
    const terms = getTermsForMonth(subscription, monthLabel);
    setPaymentSubscription(subscription);
    setPaymentMonth(monthLabel);
    setPaymentAmount((override?.amount ?? terms.amount).toString());
  };

  const savePaymentChange = () => {
    if (!paymentSubscription) return;
    Keyboard.dismiss();
    const changedAmount = parseMoney(paymentAmount);
    if (changedAmount === null) {
      showAlert('Invalid amount', 'Enter a valid payment amount, including 0 if no payment is due.');
      return;
    }
    const result = setSubscriptionPaymentOverride(
      paymentSubscription.id,
      paymentMonth,
      changedAmount
    );
    if (!result.ok) {
      showAlert('Cannot change payment', result.message);
      return;
    }
    setPaymentSubscription(null);
  };

  const skipPayment = () => {
    if (!paymentSubscription) return;
    showConfirm(
      'Skip this month’s payment?',
      `${paymentSubscription.name} will not be added as an expense for ${formatMonthLabel(paymentMonth)}. The subscription will continue in later months.`,
      {
        confirmText: 'Skip payment',
        confirmStyle: 'destructive',
        onConfirm: () => {
          const result = setSubscriptionPaymentOverride(
            paymentSubscription.id,
            paymentMonth,
            null
          );
          if (!result.ok) {
            showAlert('Cannot skip payment', result.message);
            return;
          }
          setPaymentSubscription(null);
        },
      }
    );
  };

  const confirmCancel = (id: string, subscriptionName: string) => {
    showConfirm(
      'Cancel subscription?',
      `${subscriptionName} remains charged for the current budget month. No charges will be added from the next cycle.`,
      {
        cancelText: 'Keep subscription',
        confirmText: 'Cancel subscription',
        confirmStyle: 'destructive',
        onConfirm: () => cancelSubscription(id),
      }
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>
          Recurring expenses are logged against your budget. You can change future terms or adjust
          one month’s payment without changing the later schedule.
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
            accessibilityLabel="Subscription name"
          />
          <Text style={styles.label}>MONTHLY AMOUNT (₱)</Text>
          <TextInput
            keyboardType="decimal-pad"
            onChangeText={setAmount}
            placeholder="0.00"
            placeholderTextColor={THEME.colors.textMuted}
            style={styles.input}
            value={amount}
            accessibilityLabel="Subscription monthly amount"
          />
          <Text style={styles.label}>START MONTH</Text>
          <TouchableOpacity
            style={styles.monthPickerTrigger}
            onPress={() => openMonthPicker('start', startMonth, stats.currentMonthLabel)}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Subscription start month"
          >
            <Text style={styles.monthPickerValue}>{formatMonthLabel(startMonth)}</Text>
            <Ionicons name="calendar-outline" size={18} color={THEME.colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addButton}
            onPress={handleAdd}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Add recurring subscription"
          >
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
          subscriptions.map((subscription) => {
            const currentTerms = getTermsForMonth(subscription, stats.currentMonthLabel);
            return (
              <View key={subscription.id} style={styles.subscriptionRow}>
                <View style={styles.subscriptionMainRow}>
                  <View style={styles.subscriptionIcon}>
                    <Ionicons name="repeat-outline" size={17} color={THEME.colors.pillDark} />
                  </View>
                  <View style={styles.subscriptionDetails}>
                    <Text style={styles.subscriptionName}>{currentTerms.name}</Text>
                    <Text style={styles.subscriptionAmount}>
                      ₱ {formatCurrency(currentTerms.amount)} / month
                    </Text>
                    <Text style={styles.subscriptionMeta}>
                      {subscription.cancelledFromMonth
                        ? `Canceled from ${formatMonthLabel(subscription.cancelledFromMonth)}`
                        : `Starts ${formatMonthLabel(subscription.startMonth)}`}
                    </Text>
                  </View>
                </View>
                {!subscription.cancelledFromMonth && (
                  <View style={styles.subscriptionActions}>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => openEdit(subscription)}
                      activeOpacity={0.75}
                      accessibilityRole="button"
                      accessibilityLabel={`Edit ${subscription.name} from a selected month`}
                    >
                      <Ionicons name="pencil-outline" size={15} color={THEME.colors.textDark} />
                      <Text style={styles.actionText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => openPayment(subscription)}
                      activeOpacity={0.75}
                      accessibilityRole="button"
                      accessibilityLabel={`Change or skip a payment for ${subscription.name}`}
                    >
                      <Ionicons name="options-outline" size={15} color={THEME.colors.textDark} />
                      <Text style={styles.actionText}>Payment</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.cancelButton]}
                      onPress={() => confirmCancel(subscription.id, subscription.name)}
                      activeOpacity={0.75}
                      accessibilityRole="button"
                      accessibilityLabel={`Cancel ${subscription.name} subscription`}
                    >
                      <Text style={styles.cancelText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal
        visible={Boolean(editingSubscription) && monthPicker?.target !== 'effective'}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingSubscription(null)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit subscription</Text>
            <Text style={styles.modalDescription}>
              Changes apply from the selected month onward. Existing earlier expenses stay unchanged.
            </Text>
            <Text style={styles.label}>NAME</Text>
            <TextInput
              value={editName}
              onChangeText={setEditName}
              maxLength={40}
              placeholder="Subscription name"
              placeholderTextColor={THEME.colors.textMuted}
              style={styles.input}
              accessibilityLabel="Updated subscription name"
            />
            <Text style={styles.label}>MONTHLY AMOUNT (₱)</Text>
            <TextInput
              value={editAmount}
              onChangeText={setEditAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={THEME.colors.textMuted}
              style={styles.input}
              accessibilityLabel="Updated subscription amount"
            />
            <Text style={styles.label}>EFFECTIVE FROM</Text>
            <TouchableOpacity
              style={styles.monthPickerTrigger}
              onPress={() => {
                if (!editingSubscription) return;
                const minimumMonth = isAfterMonth(
                  editingSubscription.startMonth,
                  stats.currentMonthLabel
                )
                  ? editingSubscription.startMonth
                  : stats.currentMonthLabel;
                openMonthPicker('effective', editEffectiveMonth, minimumMonth);
              }}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Subscription change effective month"
            >
              <Text style={styles.monthPickerValue}>
                {formatMonthLabel(editEffectiveMonth)}
              </Text>
              <Ionicons name="calendar-outline" size={18} color={THEME.colors.textSecondary} />
            </TouchableOpacity>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => setEditingSubscription(null)}
                accessibilityRole="button"
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={saveEdit}
                accessibilityRole="button"
                accessibilityLabel="Save subscription changes"
              >
                <Text style={styles.primaryButtonText}>Save changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={Boolean(paymentSubscription) && monthPicker?.target !== 'payment'}
        transparent
        animationType="fade"
        onRequestClose={() => setPaymentSubscription(null)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Adjust a payment</Text>
            <Text style={styles.modalDescription}>
              This only affects the selected month. The subscription continues as usual afterward.
            </Text>
            <Text style={styles.label}>MONTH</Text>
            <TouchableOpacity
              style={styles.monthPickerTrigger}
              onPress={() => {
                if (!paymentSubscription) return;
                const minimumMonth = isAfterMonth(
                  paymentSubscription.startMonth,
                  stats.currentMonthLabel
                )
                  ? paymentSubscription.startMonth
                  : stats.currentMonthLabel;
                openMonthPicker('payment', paymentMonth, minimumMonth);
              }}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Payment month"
            >
              <Text style={styles.monthPickerValue}>{formatMonthLabel(paymentMonth)}</Text>
              <Ionicons name="calendar-outline" size={18} color={THEME.colors.textSecondary} />
            </TouchableOpacity>
            <Text style={styles.label}>PAYMENT AMOUNT (₱)</Text>
            <TextInput
              value={paymentAmount}
              onChangeText={setPaymentAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={THEME.colors.textMuted}
              style={styles.input}
              accessibilityLabel="One-time payment amount"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.skipButton}
                onPress={skipPayment}
                accessibilityRole="button"
                accessibilityLabel="Skip this month's subscription payment"
              >
                <Text style={styles.skipButtonText}>Skip month</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={savePaymentChange}
                accessibilityRole="button"
                accessibilityLabel="Save one-time payment amount"
              >
                <Text style={styles.primaryButtonText}>Save payment</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setPaymentSubscription(null)}
              accessibilityRole="button"
            >
              <Text style={styles.secondaryButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={Boolean(monthPicker)}
        transparent
        animationType="fade"
        onRequestClose={() => setMonthPicker(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              Select{' '}
              {monthPicker?.target === 'start'
                ? 'start month'
                : monthPicker?.target === 'effective'
                  ? 'effective month'
                  : 'payment month'}
            </Text>
            <View style={styles.monthPickerYearRow}>
              <TouchableOpacity
                style={styles.yearNavigationButton}
                onPress={() => setMonthPickerYear((year) => year - 1)}
                disabled={
                  !monthPicker ||
                  monthPickerYear <= Number(monthPicker.minimumMonth.slice(0, 4))
                }
                accessibilityRole="button"
                accessibilityLabel="Previous year"
              >
                <Ionicons name="chevron-back" size={20} color={THEME.colors.textDark} />
              </TouchableOpacity>
              <Text style={styles.monthPickerYear}>{monthPickerYear}</Text>
              <TouchableOpacity
                style={styles.yearNavigationButton}
                onPress={() => setMonthPickerYear((year) => year + 1)}
                disabled={monthPickerYear >= 9999}
                accessibilityRole="button"
                accessibilityLabel="Next year"
              >
                <Ionicons name="chevron-forward" size={20} color={THEME.colors.textDark} />
              </TouchableOpacity>
            </View>
            <View style={styles.monthGrid}>
              {MONTH_NAMES.map((monthName, index) => {
                const monthLabel = `${monthPickerYear}-${String(index + 1).padStart(2, '0')}`;
                const isDisabled = !monthPicker || monthLabel < monthPicker.minimumMonth;
                const isSelected =
                  (monthPicker?.target === 'start' && startMonth === monthLabel) ||
                  (monthPicker?.target === 'effective' &&
                    editEffectiveMonth === monthLabel) ||
                  (monthPicker?.target === 'payment' && paymentMonth === monthLabel);
                return (
                  <TouchableOpacity
                    key={monthName}
                    style={[
                      styles.monthOption,
                      isSelected && styles.monthOptionSelected,
                      isDisabled && styles.monthOptionDisabled,
                    ]}
                    onPress={() => selectPickerMonth(index)}
                    disabled={isDisabled}
                    activeOpacity={0.75}
                    accessibilityRole="button"
                    accessibilityLabel={`${monthName} ${monthPickerYear}`}
                    accessibilityState={{ disabled: isDisabled, selected: isSelected }}
                  >
                    <Text
                      style={[
                        styles.monthOptionText,
                        isSelected && styles.monthOptionTextSelected,
                        isDisabled && styles.monthOptionTextDisabled,
                      ]}
                    >
                      {monthName.slice(0, 3)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setMonthPicker(null)}
              accessibilityRole="button"
              accessibilityLabel="Close month picker"
            >
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  monthPickerTrigger: {
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    minHeight: 52,
    paddingHorizontal: 14,
  },
  monthPickerValue: { color: THEME.colors.textDark, fontSize: 16, fontWeight: '600' },
  addButton: {
    alignItems: 'center',
    backgroundColor: THEME.colors.pillDark,
    borderRadius: THEME.radius.full,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    minHeight: 48,
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
    backgroundColor: THEME.colors.white,
    borderColor: '#E2E8F0',
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    gap: 12,
    padding: 13,
  },
  subscriptionMainRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
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
  subscriptionActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionButton: {
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderColor: '#CBD5E1',
    borderRadius: THEME.radius.full,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 12,
  },
  actionText: { color: THEME.colors.textDark, fontSize: 12, fontWeight: '800' },
  cancelButton: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  cancelText: { color: THEME.colors.indicatorRed, fontSize: 12, fontWeight: '800' },
  modalOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: THEME.colors.white,
    borderRadius: THEME.radius.lg,
    maxWidth: 440,
    padding: 20,
    width: '100%',
  },
  modalTitle: { color: THEME.colors.textDark, fontSize: 20, fontWeight: '800' },
  modalDescription: { color: THEME.colors.textSecondary, fontSize: 13, lineHeight: 19, marginVertical: 10 },
  monthPickerYearRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 18,
    justifyContent: 'center',
    marginVertical: 14,
  },
  yearNavigationButton: {
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderColor: '#CBD5E1',
    borderRadius: 12,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  monthPickerYear: { color: THEME.colors.textDark, fontSize: 18, fontWeight: '800' },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 8,
  },
  monthOption: {
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderColor: '#CBD5E1',
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
    width: '31%',
  },
  monthOptionSelected: {
    backgroundColor: THEME.colors.pillDark,
    borderColor: THEME.colors.pillDark,
  },
  monthOptionDisabled: { opacity: 0.45 },
  monthOptionText: { color: THEME.colors.textDark, fontSize: 14, fontWeight: '700' },
  monthOptionTextSelected: { color: '#FFFFFF' },
  monthOptionTextDisabled: { color: THEME.colors.textMuted },
  modalActions: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: THEME.colors.pillDark,
    borderRadius: THEME.radius.full,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 16,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  secondaryButton: {
    alignItems: 'center',
    borderColor: '#CBD5E1',
    borderRadius: THEME.radius.full,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 16,
  },
  secondaryButtonText: { color: THEME.colors.textDark, fontSize: 13, fontWeight: '800' },
  skipButton: {
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderRadius: THEME.radius.full,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 14,
  },
  skipButtonText: { color: THEME.colors.indicatorRed, fontSize: 13, fontWeight: '800' },
  modalClose: { alignItems: 'center', minHeight: 44, justifyContent: 'center', marginTop: 4 },
});

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
import AddBankModal from '@/components/AddBankModal';
import PendingRolloverModal from '@/components/PendingRolloverModal';
import { formatCurrency, formatMonthLabel } from '@/utils/dates';
import { showAlert, showConfirm } from '@/utils/alerts';
import type { BankAccount } from '@/types';

function parseMoney(value: string): number | null {
  const normalized = value.replace(/,/g, '').trim();
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : null;
}

export default function BudgetSettingsScreen() {
  const stats = useFinanceStore((state) => state.stats);
  const bankAccounts = useFinanceStore((state) => state.bankAccounts);
  const saveSettings = useFinanceStore((state) => state.saveSettings);
  const addBankAccount = useFinanceStore((state) => state.addBankAccount);
  const updateBankAccount = useFinanceStore((state) => state.updateBankAccount);
  const deleteBankAccount = useFinanceStore((state) => state.deleteBankAccount);
  const endMonth = useFinanceStore((state) => state.endMonth);
  const distributeRollover = useFinanceStore((state) => state.distributeRollover);

  // Form states
  const [bankName, setBankName] = useState(stats.bankName || 'Main Savings');
  const [allowanceInput, setAllowanceInput] = useState(
    stats.baseAllowance === null ? '' : stats.baseAllowance.toString()
  );
  const [savingsInput, setSavingsInput] = useState(
    bankAccounts.length === 1
      ? bankAccounts[0].balance.toString()
      : stats.totalBank === null
        ? '0'
        : stats.totalBank.toString()
  );
  const [isSaving, setIsSaving] = useState(false);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);

  const [editingBank, setEditingBank] = useState<BankAccount | null>(null);
  const [editName, setEditName] = useState('');
  const [editBalance, setEditBalance] = useState('');
  const [isRolloverDismissed, setIsRolloverDismissed] = useState(false);

  useEffect(() => {
    setBankName(stats.bankName || 'Main Savings');
    setAllowanceInput(stats.baseAllowance === null ? '' : stats.baseAllowance.toString());
  }, [stats.bankName, stats.baseAllowance]);

  useEffect(() => {
    setSavingsInput(
      bankAccounts.length === 1
        ? bankAccounts[0].balance.toString()
        : stats.totalBank === null
          ? '0'
          : stats.totalBank.toString()
    );
  }, [bankAccounts, stats.totalBank]);

  const totalSavings =
    bankAccounts.reduce((sum, b) => sum + b.balance, 0) +
    (stats.pendingRollover?.amount ?? 0);
  const isConfigured = Boolean(
    stats.bankName && stats.baseAllowance !== null
  );

  const handleSave = () => {
    if (isSaving) return;
    Keyboard.dismiss();
    const trimmedBank = bankName.trim();
    if (!trimmedBank) {
      showAlert('Name Required', 'Enter a name for your savings account.');
      return;
    }
    const allowance = parseMoney(allowanceInput);
    if (allowance === null) {
      showAlert('Invalid Allowance', 'Enter a non-negative allowance amount.');
      return;
    }
    const savingsBalance = parseMoney(savingsInput);
    if (savingsBalance === null) {
      showAlert('Invalid Savings', 'Enter a non-negative savings balance.');
      return;
    }

    setIsSaving(true);
    saveSettings(trimmedBank, allowance, savingsBalance);
    setTimeout(() => setIsSaving(false), 500);
    showAlert('Saved', 'Your budget and savings settings have been updated.');
  };

  const handleSaveEditBank = () => {
    if (!editingBank) return;
    const trimmed = editName.trim();
    if (!trimmed) {
      showAlert('Name Required', 'Enter a bank name.');
      return;
    }
    const balance = parseMoney(editBalance);
    if (balance === null || balance < 0) {
      showAlert('Invalid Balance', 'Enter a valid non-negative balance.');
      return;
    }

    const result = updateBankAccount(editingBank.id, trimmed, balance);
    if (result.ok) {
      setEditingBank(null);
      showAlert('Updated', `${trimmed} balance has been updated.`);
    } else {
      showAlert('Error', result.message || 'Could not update bank.');
    }
  };

  const handleDeleteBank = (bank: BankAccount) => {
    if (bankAccounts.length <= 1) {
      showAlert('Cannot Delete', 'You must have at least one bank account.');
      return;
    }

    const otherBanks = bankAccounts.filter((b) => b.id !== bank.id);
    const destName = otherBanks[0]?.name || 'another bank';

    showConfirm(
      'Remove Bank',
      bank.balance > 0
        ? `Remove ${bank.name}? Its ₱ ${formatCurrency(bank.balance)} will be transferred to ${destName}.`
        : `Remove ${bank.name}?`,
      {
        confirmText: 'Remove Bank',
        confirmStyle: 'destructive',
        onConfirm: () => {
          setEditingBank(null);
          deleteBankAccount(bank.id, otherBanks[0]?.id);
        },
      }
    );
  };

  const handleRollover = () => {
    const remaining = stats.currentRemaining;
    if (!isConfigured || remaining === null || stats.baseAllowance === null) return;
    const transfer = Math.max(0, remaining);

    showConfirm(
      'Start next month?',
      transfer > 0 && bankAccounts.length > 1
        ? `This rolls over ₱ ${formatCurrency(transfer)} and starts the next month. You'll be asked how much to distribute across your accounts.`
        : `This rolls over ₱ ${formatCurrency(transfer)} into ${bankAccounts[0]?.name || stats.bankName} and starts the next month with ₱ ${formatCurrency(stats.baseAllowance)}.`,
      {
        confirmText: 'Start next month',
        onConfirm: () => {
          endMonth(bankAccounts.length === 1 ? bankAccounts[0]?.id : undefined);
        },
      }
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
            Edit your monthly spending budget and manage your savings accounts.
          </Text>

          {/* MAIN SETTINGS CARD */}
          <View style={styles.card}>
            <Text style={styles.label}>ACCOUNT NAME</Text>
            <TextInput
              autoCapitalize="words"
              onChangeText={setBankName}
              placeholder="e.g. Main Savings"
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

            {bankAccounts.length > 1 ? (
              <View style={styles.totalSavingsCard}>
                <Text style={styles.label}>TOTAL SAVINGS BALANCE</Text>
                <Text style={styles.totalSavingsAmount}>₱ {formatCurrency(totalSavings)}</Text>
                <Text style={styles.totalSavingsSub}>Sum across {bankAccounts.length} bank accounts</Text>
              </View>
            ) : (
              <>
                <Text style={styles.label}>
                  {stats.pendingRollover?.amount
                    ? 'BANK ACCOUNT BALANCE'
                    : 'TOTAL SAVINGS BALANCE'}
                </Text>
                <TextInput
                  keyboardType="decimal-pad"
                  onChangeText={setSavingsInput}
                  placeholder="0.00"
                  placeholderTextColor={THEME.colors.textMuted}
                  style={styles.input}
                  value={savingsInput}
                />
              </>
            )}

            {/* Clean Banks List Section */}
            {Boolean(stats.pendingRollover && stats.pendingRollover.amount > 0) && (
              <TouchableOpacity
                style={styles.pendingBanner}
                onPress={() => setIsRolloverDismissed(false)}
                activeOpacity={0.85}
              >
                <View style={styles.pendingBannerLeft}>
                  <View style={styles.pendingBannerIcon}>
                    <Ionicons name="sparkles" size={16} color="#059669" />
                  </View>
                  <View style={styles.pendingBannerTextCol}>
                    <Text style={styles.pendingBannerTitle}>
                      ₱ {formatCurrency(stats.pendingRollover!.amount)} Pending Rollover
                    </Text>
                    <Text style={styles.pendingBannerSub}>
                      From {formatMonthLabel(stats.pendingRollover!.monthLabel)} · Tap to distribute
                    </Text>
                  </View>
                </View>
                <View style={styles.pendingBannerBtn}>
                  <Text style={styles.pendingBannerBtnText}>Distribute</Text>
                </View>
              </TouchableOpacity>
            )}

            <View style={styles.banksSection}>
              <View style={styles.banksHeaderRow}>
                <Text style={styles.label}>BANKS & ACCOUNTS</Text>
                <TouchableOpacity
                  onPress={() => setShowAddModal(true)}
                  style={styles.headerActionBtn}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add" size={14} color="#059669" />
                  <Text style={styles.headerActionText}>Add Bank</Text>
                </TouchableOpacity>
              </View>

              {/* Account Rows */}
              <View style={styles.accountList}>
                {bankAccounts.length === 0 ? (
                  <View style={styles.emptyBankBox}>
                    <Text style={styles.emptyBankText}>No bank accounts added yet.</Text>
                  </View>
                ) : (
                  bankAccounts.map((bank) => (
                    <TouchableOpacity
                      key={bank.id}
                      style={styles.accountRow}
                      onPress={() => {
                        setEditingBank(bank);
                        setEditName(bank.name);
                        setEditBalance(bank.balance.toString());
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.accountLeft}>
                        <View style={[styles.accountDot, styles.bankDot]} />
                        <Text style={styles.accountName}>{bank.name}</Text>
                      </View>
                      <View style={styles.accountRight}>
                        <Text style={styles.accountBalance}>₱ {formatCurrency(bank.balance)}</Text>
                        <Ionicons name="pencil" size={13} color={THEME.colors.textMuted} />
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            </View>

            {/* Single Save Button */}
            <TouchableOpacity
              style={[styles.primaryButton, isSaving && styles.primaryButtonDisabled]}
              onPress={handleSave}
              disabled={isSaving}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryButtonText}>{isSaving ? 'Saving...' : 'Save changes'}</Text>
            </TouchableOpacity>
          </View>

          {/* MONTHLY CYCLE CARD */}
          {isConfigured && (
            <View style={[styles.card, styles.cycleCard]}>
              <View style={styles.cycleHeading}>
                <Ionicons name="sync-outline" size={19} color="#6D28D9" />
                <Text style={styles.cardTitle}>Monthly cycle</Text>
              </View>
              <Text style={styles.month}>{formatMonthLabel(stats.currentMonthLabel)}</Text>
              <Text style={styles.body}>
                Start the next cycle to roll over any positive remaining budget balance into {stats.bankName}.
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

      {/* ADD BANK MODAL */}
      <AddBankModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAddBank={addBankAccount}
      />

      {/* EDIT BANK MODAL */}
      <Modal visible={Boolean(editingBank)} transparent animationType="fade" onRequestClose={() => setEditingBank(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Bank</Text>
              <TouchableOpacity onPress={() => setEditingBank(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={22} color={THEME.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>BANK NAME</Text>
            <TextInput
              style={styles.input}
              value={editName}
              onChangeText={setEditName}
            />

            <Text style={styles.label}>BALANCE</Text>
            <TextInput
              style={styles.input}
              keyboardType="decimal-pad"
              value={editBalance}
              onChangeText={setEditBalance}
            />

            <View style={styles.modalActions}>
              {editingBank && (
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDeleteBank(editingBank)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="trash-outline" size={17} color="#DC2626" />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.primaryButton, { flex: 1, marginTop: 0 }]}
                onPress={handleSaveEditBank}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryButtonText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {Boolean(stats.pendingRollover && stats.pendingRollover.amount > 0) && (
        <PendingRolloverModal
          visible={Boolean(stats.pendingRollover && stats.pendingRollover.amount > 0) && !isRolloverDismissed}
          pendingRollover={stats.pendingRollover}
          bankAccounts={bankAccounts}
          onSelectBank={distributeRollover}
          onDismiss={() => setIsRolloverDismissed(true)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: THEME.colors.background },
  flex: { flex: 1 },
  content: { gap: 16, padding: 20, paddingBottom: 36 },
  intro: { color: THEME.colors.textSecondary, fontSize: 13, lineHeight: 18 },
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
    paddingVertical: 12,
  },
  banksSection: {
    borderTopColor: '#F1F5F9',
    borderTopWidth: 1,
    marginBottom: 16,
    paddingTop: 14,
  },
  banksHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  headerActionBtn: {
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderRadius: THEME.radius.full,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  headerActionText: {
    color: '#065F46',
    fontSize: 11,
    fontWeight: '700',
  },
  accountList: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  accountRow: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomColor: '#F1F5F9',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  accountLeft: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  accountDot: {
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  vaultDot: {
    backgroundColor: '#10B981',
  },
  bankDot: {
    backgroundColor: '#818CF8',
  },
  totalSavingsCard: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    marginBottom: 16,
    padding: 14,
  },
  totalSavingsAmount: {
    color: THEME.colors.textDark,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  totalSavingsSub: {
    color: THEME.colors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  emptyBankBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  emptyBankText: {
    color: THEME.colors.textMuted,
    fontSize: 13,
  },
  modalSubtitle: {
    color: THEME.colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  accountName: {
    color: THEME.colors.textDark,
    fontSize: 14,
    fontWeight: '600',
  },
  accountRight: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  accountBalance: {
    color: THEME.colors.textDark,
    fontSize: 14,
    fontWeight: '800',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: THEME.colors.pillDark,
    borderRadius: THEME.radius.full,
    marginTop: 4,
    paddingVertical: 14,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  primaryButtonDisabled: { opacity: 0.65 },
  cycleCard: { backgroundColor: THEME.colors.lilacCard, borderColor: 'rgba(196, 181, 253, 0.5)' },
  cycleHeading: { alignItems: 'center', flexDirection: 'row', gap: 9, marginBottom: 10 },
  cardTitle: { color: THEME.colors.textDark, fontSize: 16, fontWeight: '800' },
  month: { color: THEME.colors.textDark, fontSize: 18, fontWeight: '800' },
  body: { color: THEME.colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 6 },
  modalOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: THEME.radius.card,
    maxWidth: 400,
    padding: 20,
    width: '100%',
    ...THEME.shadow.soft,
  },
  modalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalTitle: {
    color: THEME.colors.textDark,
    fontSize: 17,
    fontWeight: '800',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  cancelButton: {
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: THEME.radius.full,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  cancelButtonText: {
    color: THEME.colors.textDark,
    fontSize: 14,
    fontWeight: '700',
  },
  deleteButton: {
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderRadius: THEME.radius.full,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  pendingBanner: {
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderRadius: THEME.radius.card,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  pendingBannerLeft: {
    alignItems: 'center',
    flexDirection: 'row',
    flex: 1,
    gap: 10,
  },
  pendingBannerIcon: {
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    borderRadius: THEME.radius.full,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  pendingBannerTextCol: {
    flex: 1,
  },
  pendingBannerTitle: {
    color: '#065F46',
    fontSize: 14,
    fontWeight: '800',
  },
  pendingBannerSub: {
    color: '#047857',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 1,
  },
  pendingBannerBtn: {
    backgroundColor: '#059669',
    borderRadius: THEME.radius.full,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  pendingBannerBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});

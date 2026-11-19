import React, { useState } from 'react';
import {
  Keyboard,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '@/constants/theme';
import { formatCurrency } from '@/utils/dates';
import { showAlert } from '@/utils/alerts';
import type { BankAccount } from '@/types';

function parseMoney(value: string): number | null {
  const normalized = value.replace(/,/g, '').trim();
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : null;
}

interface DistributeSavingsModalProps {
  visible: boolean;
  mainSavingsName?: string;
  totalSavings: number;
  bankAccounts: BankAccount[];
  initialTargetBankId?: string;
  onClose: () => void;
  onTransfer: (fromId: string, toId: string, amount: number) => { ok: boolean; message?: string };
  onAddBank: (name: string, balance?: number) => { ok: boolean; message?: string };
}

export default function DistributeSavingsModal({
  visible,
  mainSavingsName,
  totalSavings,
  bankAccounts,
  initialTargetBankId,
  onClose,
  onTransfer,
  onAddBank,
}: DistributeSavingsModalProps) {
  const [fromId, setFromId] = useState<string>(() => {
    if (initialTargetBankId && bankAccounts.some((b) => b.id === initialTargetBankId)) {
      const target = bankAccounts.find((b) => b.id === initialTargetBankId);
      if (target && target.balance > 0) return initialTargetBankId;
    }
    return bankAccounts[0]?.id || '';
  });

  const [toId, setToId] = useState<string>(() => {
    if (initialTargetBankId && bankAccounts.some((b) => b.id === initialTargetBankId)) {
      if (fromId === initialTargetBankId) {
        return bankAccounts.find((b) => b.id !== initialTargetBankId)?.id || '';
      }
      return initialTargetBankId;
    }
    return bankAccounts.find((b) => b.id !== fromId)?.id || bankAccounts[1]?.id || '';
  });

  const [amountInput, setAmountInput] = useState('');
  const [showAddInline, setShowAddInline] = useState(bankAccounts.length < 2);
  const [newBankName, setNewBankName] = useState('');
  const [newBankBalance, setNewBankBalance] = useState('');

  // Source account details
  const fromAccount = bankAccounts.find((b) => b.id === fromId);
  const toAccount = bankAccounts.find((b) => b.id === toId);
  const availableBalance = fromAccount ? fromAccount.balance : 0;

  // Swap From and To
  const handleSwap = () => {
    if (fromId === toId) return;
    const prevFrom = fromId;
    const prevTo = toId;
    setFromId(prevTo);
    setToId(prevFrom);
    setAmountInput('');
  };

  // Shortcut percentage
  const handleSetPercent = (pct: number) => {
    if (availableBalance <= 0) return;
    const calculated = Math.round((availableBalance * pct + Number.EPSILON) * 100) / 100;
    setAmountInput(calculated.toString());
  };

  // Execute Transfer
  const handleExecuteTransfer = () => {
    Keyboard.dismiss();
    if (!fromId || !toId) {
      showAlert('Select Accounts', 'Choose both source and destination accounts.');
      return;
    }
    if (fromId === toId) {
      showAlert('Same Account', 'Source and destination accounts must be different.');
      return;
    }
    const amount = parseMoney(amountInput);
    if (amount === null || amount <= 0) {
      showAlert('Invalid Amount', 'Enter a transfer amount greater than 0.');
      return;
    }
    if (amount > availableBalance) {
      showAlert(
        'Insufficient Balance',
        `Available balance in ${fromAccount?.name || 'source'} is ₱ ${formatCurrency(availableBalance)}.`
      );
      return;
    }

    const result = onTransfer(fromId, toId, amount);
    if (result.ok) {
      setAmountInput('');
      onClose();
      showAlert(
        'Transfer Complete',
        `Transferred ₱ ${formatCurrency(amount)} from ${fromAccount?.name || 'source'} to ${toAccount?.name || 'destination'}.`
      );
    } else {
      showAlert('Transfer Failed', result.message || 'Could not complete transfer.');
    }
  };

  // Execute Add Bank
  const handleExecuteAddBank = () => {
    Keyboard.dismiss();
    const trimmed = newBankName.trim();
    if (!trimmed) {
      showAlert('Bank Name Required', 'Enter a name for the new bank.');
      return;
    }
    const initialAmount = newBankBalance.trim() ? parseMoney(newBankBalance) : 0;
    if (initialAmount === null || initialAmount < 0) {
      showAlert('Invalid Balance', 'Enter a valid non-negative starting balance.');
      return;
    }

    const result = onAddBank(trimmed, initialAmount);
    if (result.ok) {
      setNewBankName('');
      setNewBankBalance('');
      setShowAddInline(false);
      showAlert('Bank Added', `${trimmed} has been created.`);
    } else {
      showAlert('Cannot Add Bank', result.message || 'An error occurred.');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Transfer Savings</Text>
              <Text style={styles.subtitle}>Move funds between bank accounts</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={22} color={THEME.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Clean Balance Overview */}
          <View style={styles.summaryBar}>
            <View style={styles.summaryCol}>
              <Text style={styles.summaryLabel}>TOTAL SAVINGS</Text>
              <Text style={styles.summaryAmount}>₱ {formatCurrency(totalSavings)}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryColRight}>
              <Text style={styles.summaryLabel}>ACCOUNTS</Text>
              <Text style={styles.summaryAmount}>{bankAccounts.length} {bankAccounts.length === 1 ? 'bank' : 'banks'}</Text>
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {bankAccounts.length < 2 && !showAddInline ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="business-outline" size={32} color={THEME.colors.textMuted} />
                <Text style={styles.emptyTitle}>Second Bank Needed</Text>
                <Text style={styles.emptyDesc}>
                  You need at least two bank accounts to transfer funds. Add another bank account below.
                </Text>
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={() => setShowAddInline(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="add" size={17} color="#FFFFFF" />
                  <Text style={styles.primaryButtonText}>Add Bank</Text>
                </TouchableOpacity>
              </View>
            ) : showAddInline ? (
              /* Inline Add Bank Form */
              <View style={styles.addInlineBox}>
                <Text style={styles.sectionHeader}>ADD NEW BANK ACCOUNT</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Bank name (e.g. Maya, GCash, BDO)"
                  placeholderTextColor={THEME.colors.textMuted}
                  value={newBankName}
                  onChangeText={setNewBankName}
                  autoFocus
                />
                <TextInput
                  style={styles.input}
                  placeholder="Starting balance (optional, ₱ 0.00)"
                  placeholderTextColor={THEME.colors.textMuted}
                  keyboardType="decimal-pad"
                  value={newBankBalance}
                  onChangeText={setNewBankBalance}
                />
                <View style={styles.inlineActionsRow}>
                  {bankAccounts.length >= 2 && (
                    <TouchableOpacity
                      style={styles.secondaryButton}
                      onPress={() => setShowAddInline(false)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.secondaryButtonText}>Cancel</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.primaryButton, { flex: 1, marginTop: 0 }]}
                    onPress={handleExecuteAddBank}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.primaryButtonText}>Create Bank</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              /* Transfer Interface */
              <View style={styles.formContainer}>
                {/* FROM ACCOUNT */}
                <Text style={styles.sectionHeader}>TRANSFER FROM</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll}>
                  {bankAccounts.map((bank) => {
                    const isSelected = fromId === bank.id;
                    return (
                      <TouchableOpacity
                        key={bank.id}
                        style={[styles.accountPill, isSelected && styles.accountPillActive]}
                        onPress={() => {
                          setFromId(bank.id);
                          if (toId === bank.id) {
                            const other = bankAccounts.find((b) => b.id !== bank.id);
                            if (other) setToId(other.id);
                          }
                          setAmountInput('');
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.accountPillName, isSelected && styles.accountPillNameActive]}>
                          {bank.name}
                        </Text>
                        <Text style={[styles.accountPillBalance, isSelected && styles.accountPillBalanceActive]}>
                          ₱ {formatCurrency(bank.balance)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* SWAP BUTTON */}
                <View style={styles.swapRow}>
                  <View style={styles.swapLine} />
                  <TouchableOpacity style={styles.swapButton} onPress={handleSwap} activeOpacity={0.7}>
                    <Ionicons name="swap-vertical" size={17} color={THEME.colors.textDark} />
                  </TouchableOpacity>
                  <View style={styles.swapLine} />
                </View>

                {/* TO ACCOUNT */}
                <Text style={styles.sectionHeader}>TRANSFER TO</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll}>
                  {bankAccounts.map((bank) => {
                    const isSelected = toId === bank.id;
                    const isDisabled = fromId === bank.id;
                    return (
                      <TouchableOpacity
                        key={bank.id}
                        style={[
                          styles.accountPill,
                          isSelected && styles.accountPillActive,
                          isDisabled && styles.accountPillDisabled,
                        ]}
                        onPress={() => {
                          if (!isDisabled) setToId(bank.id);
                        }}
                        disabled={isDisabled}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.accountPillName, isSelected && styles.accountPillNameActive]}>
                          {bank.name}
                        </Text>
                        <Text style={[styles.accountPillBalance, isSelected && styles.accountPillBalanceActive]}>
                          ₱ {formatCurrency(bank.balance)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* AMOUNT INPUT */}
                <View style={styles.amountHeader}>
                  <Text style={styles.sectionHeader}>AMOUNT</Text>
                  {availableBalance > 0 && (
                    <View style={styles.quickChips}>
                      <TouchableOpacity onPress={() => handleSetPercent(0.25)} style={styles.quickChip}>
                        <Text style={styles.quickChipText}>25%</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleSetPercent(0.5)} style={styles.quickChip}>
                        <Text style={styles.quickChipText}>50%</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleSetPercent(1)} style={styles.quickChip}>
                        <Text style={styles.quickChipText}>Max</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                <View style={styles.inputWrapper}>
                  <Text style={styles.currencyPrefix}>₱</Text>
                  <TextInput
                    style={styles.amountInput}
                    placeholder="0.00"
                    placeholderTextColor={THEME.colors.textMuted}
                    keyboardType="decimal-pad"
                    value={amountInput}
                    onChangeText={setAmountInput}
                  />
                </View>

                {/* SUBMIT BUTTON */}
                <TouchableOpacity
                  style={[styles.primaryButton, availableBalance <= 0 && styles.buttonDisabled]}
                  onPress={handleExecuteTransfer}
                  disabled={availableBalance <= 0}
                  activeOpacity={0.8}
                >
                  <Text style={styles.primaryButtonText}>Transfer Funds</Text>
                </TouchableOpacity>

                {/* ADD BANK LINK */}
                <TouchableOpacity
                  style={styles.addBankToggle}
                  onPress={() => setShowAddInline(true)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add" size={16} color={THEME.colors.textMuted} />
                  <Text style={styles.addBankToggleText}>Add another bank</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: THEME.radius.card,
    maxHeight: '85%',
    maxWidth: 440,
    padding: 22,
    width: '100%',
    ...THEME.shadow.soft,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  title: {
    color: THEME.colors.textDark,
    fontSize: 18,
    fontWeight: '800',
  },
  subtitle: {
    color: THEME.colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  summaryBar: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 16,
    padding: 12,
  },
  summaryCol: {
    flex: 1,
  },
  summaryColRight: {
    alignItems: 'flex-end',
    flex: 1,
  },
  summaryLabel: {
    color: THEME.colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  summaryAmount: {
    color: THEME.colors.textDark,
    fontSize: 15,
    fontWeight: '800',
  },
  summaryDivider: {
    backgroundColor: '#E2E8F0',
    marginHorizontal: 12,
    width: 1,
  },
  formContainer: {
    gap: 10,
  },
  sectionHeader: {
    color: THEME.colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  pillScroll: {
    marginHorizontal: -4,
  },
  accountPill: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: 4,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  accountPillActive: {
    backgroundColor: THEME.colors.pillDark,
    borderColor: THEME.colors.pillDark,
  },
  accountPillDisabled: {
    opacity: 0.35,
  },
  accountPillName: {
    color: THEME.colors.textDark,
    fontSize: 12,
    fontWeight: '700',
  },
  accountPillNameActive: {
    color: '#FFFFFF',
  },
  accountPillBalance: {
    color: THEME.colors.textSecondary,
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
  accountPillBalanceActive: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  swapRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: 4,
  },
  swapLine: {
    backgroundColor: '#E2E8F0',
    flex: 1,
    height: 1,
  },
  swapButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#CBD5E1',
    borderRadius: 16,
    borderWidth: 1,
    height: 32,
    justifyContent: 'center',
    marginHorizontal: 12,
    width: 32,
  },
  amountHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  quickChips: {
    flexDirection: 'row',
    gap: 6,
  },
  quickChip: {
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  quickChipText: {
    color: THEME.colors.textDark,
    fontSize: 11,
    fontWeight: '700',
  },
  inputWrapper: {
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: 14,
  },
  currencyPrefix: {
    color: THEME.colors.textMuted,
    fontSize: 18,
    fontWeight: '700',
    marginRight: 6,
  },
  amountInput: {
    color: THEME.colors.textDark,
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    paddingVertical: 12,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: THEME.colors.pillDark,
    borderRadius: THEME.radius.full,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    marginTop: 8,
    paddingVertical: 14,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: THEME.radius.full,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  secondaryButtonText: {
    color: THEME.colors.textDark,
    fontSize: 13,
    fontWeight: '700',
  },
  addBankToggle: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
    marginTop: 8,
    paddingVertical: 6,
  },
  addBankToggleText: {
    color: THEME.colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyTitle: {
    color: THEME.colors.textDark,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 10,
  },
  emptyDesc: {
    color: THEME.colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginVertical: 8,
    textAlign: 'center',
  },
  addInlineBox: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
    padding: 14,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    color: THEME.colors.textDark,
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inlineActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
});

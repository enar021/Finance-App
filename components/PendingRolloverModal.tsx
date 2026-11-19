import React, { useEffect, useMemo, useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '@/constants/theme';
import { formatCurrency, formatMonthLabel } from '@/utils/dates';
import { showAlert } from '@/utils/alerts';
import type { BankAccount, PendingRollover } from '@/types';

function parseInputNumber(val: string): number {
  const normalized = val.replace(/,/g, '').trim();
  const num = Number(normalized);
  return Number.isFinite(num) && num > 0 ? num : 0;
}

interface PendingRolloverModalProps {
  visible: boolean;
  pendingRollover: PendingRollover | null | undefined;
  bankAccounts: BankAccount[];
  onSelectBank: (allocations: Record<string, number>) => { ok: boolean; message?: string };
  onDismiss: () => void;
}

export default function PendingRolloverModal({
  visible,
  pendingRollover,
  bankAccounts,
  onSelectBank,
  onDismiss,
}: PendingRolloverModalProps) {
  const totalAmount = pendingRollover?.amount ?? 0;

  // Map of bank.id -> input string
  const [inputs, setInputs] = useState<Record<string, string>>({});

  // Reset inputs when modal opens
  useEffect(() => {
    if (visible) {
      const initial: Record<string, string> = {};
      bankAccounts.forEach((bank) => {
        initial[bank.id] = '';
      });
      setInputs(initial);
    }
  }, [visible, bankAccounts]);

  // Compute live allocated total
  const allocatedTotal = useMemo(() => {
    let sum = 0;
    Object.values(inputs).forEach((val) => {
      sum += parseInputNumber(val);
    });
    return Math.round((sum + Number.EPSILON) * 100) / 100;
  }, [inputs]);

  const remaining = Math.round((totalAmount - allocatedTotal + Number.EPSILON) * 100) / 100;
  const isComplete = Math.abs(remaining) <= 0.01 && allocatedTotal > 0;
  const isOverBudget = remaining < -0.01;

  // Handle single bank text input change
  const handleChangeText = (bankId: string, text: string) => {
    setInputs((prev) => ({
      ...prev,
      [bankId]: text,
    }));
  };

  const handleConfirm = () => {
    Keyboard.dismiss();
    if (!isComplete) {
      if (isOverBudget) {
        showAlert('Over Total', `Allocated total is ₱ ${formatCurrency(Math.abs(remaining))} over the savings amount.`);
      } else {
        showAlert('Incomplete', `Please allocate the remaining ₱ ${formatCurrency(remaining)} across your accounts.`);
      }
      return;
    }

    const numericAllocations: Record<string, number> = {};
    bankAccounts.forEach((b) => {
      const num = parseInputNumber(inputs[b.id] || '0');
      if (num > 0) {
        numericAllocations[b.id] = num;
      }
    });

    const result = onSelectBank(numericAllocations);
    if (result.ok) {
      const parts = Object.entries(numericAllocations).map(([bId, amt]) => {
        const name = bankAccounts.find((b) => b.id === bId)?.name || 'Account';
        return `₱ ${formatCurrency(amt)} to ${name}`;
      });
      showAlert('Rollover Distributed', `Saved ${parts.join(', ')}.`);
    } else {
      showAlert('Distribution Error', result.message || 'Could not distribute savings.');
    }
  };

  if (!pendingRollover || pendingRollover.amount <= 0) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardAvoid}
        >
          <View style={styles.card}>
            {/* Header Icon + Celebration */}
            <View style={styles.header}>
              <View style={styles.iconCircle}>
                <Ionicons name="sparkles" size={24} color="#059669" />
              </View>
              <View style={styles.headerTextGroup}>
                <Text style={styles.title}>Monthly Savings Rollover</Text>
                <Text style={styles.monthLabel}>
                  {formatMonthLabel(pendingRollover.monthLabel)}
                </Text>
              </View>
              <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={22} color={THEME.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Amount Badge */}
            <View style={styles.amountBadge}>
              <Text style={styles.amountLabel}>UNSPENT BUDGET SAVED</Text>
              <Text style={styles.amountValue}>
                +₱ {formatCurrency(totalAmount)}
              </Text>
            </View>

            <Text style={styles.instruction}>
              Enter how much savings goes into each account:
            </Text>

            <ScrollView
              style={styles.bankList}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {bankAccounts.map((bank) => {
                const curVal = inputs[bank.id] ?? '';
                return (
                  <View key={bank.id} style={styles.bankItem}>
                    {/* Top row: Name & current balance */}
                    <View style={styles.bankHeaderRow}>
                      <View style={styles.bankLeft}>
                        <View style={styles.bankDot} />
                        <Text style={styles.bankName}>{bank.name}</Text>
                      </View>
                      <Text style={styles.bankBalance}>
                        Current: ₱ {formatCurrency(bank.balance)}
                      </Text>
                    </View>

                    {/* Bottom row: Input */}
                    <View style={styles.inputWrapper}>
                      <Text style={styles.currencyPrefix}>₱</Text>
                      <TextInput
                        style={styles.amountInput}
                        keyboardType="decimal-pad"
                        placeholder="0.00"
                        placeholderTextColor={THEME.colors.textMuted}
                        value={curVal}
                        onChangeText={(txt) => handleChangeText(bank.id, txt)}
                      />
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            {/* Live Distribution Status Bar */}
            <View style={[styles.statusBar, isComplete ? styles.statusComplete : isOverBudget ? styles.statusOver : styles.statusPending]}>
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>
                  {isComplete
                    ? '✓ Total perfectly distributed'
                    : isOverBudget
                    ? `Over total by ₱ ${formatCurrency(Math.abs(remaining))}`
                    : `₱ ${formatCurrency(remaining)} remaining to allocate`}
                </Text>
                <Text style={styles.statusFigures}>
                  ₱ {formatCurrency(allocatedTotal)} / ₱ {formatCurrency(totalAmount)}
                </Text>
              </View>
            </View>

            {/* Confirm Button */}
            <TouchableOpacity
              style={[styles.confirmBtn, !isComplete && styles.confirmBtnDisabled]}
              onPress={handleConfirm}
              disabled={!isComplete}
              activeOpacity={0.8}
            >
              <Text style={styles.confirmBtnText}>Confirm Distribution</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.dismissBtn} onPress={onDismiss} activeOpacity={0.7}>
              <Text style={styles.dismissText}>Decide Later</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  keyboardAvoid: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    maxHeight: '90%',
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
  headerTextGroup: {
    flex: 1,
    marginLeft: 10,
  },
  iconCircle: {
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  title: {
    color: THEME.colors.textDark,
    fontSize: 17,
    fontWeight: '800',
  },
  monthLabel: {
    color: THEME.colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 1,
  },
  amountBadge: {
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  amountLabel: {
    color: '#065F46',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  amountValue: {
    color: '#059669',
    fontSize: 22,
    fontWeight: '800',
    marginTop: 2,
  },
  instruction: {
    color: THEME.colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 10,
  },
  bankList: {
    maxHeight: 240,
  },
  bankItem: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
    marginBottom: 10,
    padding: 12,
  },
  bankHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  bankLeft: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  bankDot: {
    backgroundColor: '#10B981',
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  bankName: {
    color: THEME.colors.textDark,
    fontSize: 14,
    fontWeight: '700',
  },
  bankBalance: {
    color: THEME.colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },
  inputWrapper: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: 12,
  },
  currencyPrefix: {
    color: THEME.colors.textMuted,
    fontSize: 15,
    fontWeight: '700',
    marginRight: 6,
  },
  amountInput: {
    color: THEME.colors.textDark,
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    paddingVertical: 10,
  },
  statusBar: {
    borderRadius: 10,
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statusPending: {
    backgroundColor: '#FEF3C7',
  },
  statusComplete: {
    backgroundColor: '#DCFCE7',
  },
  statusOver: {
    backgroundColor: '#FEE2E2',
  },
  statusRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statusLabel: {
    color: THEME.colors.textDark,
    fontSize: 11,
    fontWeight: '700',
  },
  statusFigures: {
    color: THEME.colors.textDark,
    fontSize: 11,
    fontWeight: '700',
  },
  confirmBtn: {
    alignItems: 'center',
    backgroundColor: THEME.colors.pillDark,
    borderRadius: THEME.radius.full,
    marginTop: 12,
    paddingVertical: 14,
  },
  confirmBtnDisabled: {
    opacity: 0.45,
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  dismissBtn: {
    alignItems: 'center',
    marginTop: 8,
    paddingVertical: 8,
  },
  dismissText: {
    color: THEME.colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
});

import React, { useState } from 'react';
import {
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
import { formatCurrency } from '@/utils/dates';
import { showAlert } from '@/utils/alerts';
import type { BankAccount } from '@/types';

interface DepositToBankModalProps {
  visible: boolean;
  bank: BankAccount | null;
  onDeposit: (bankId: string, amount: number, note?: string) => { ok: boolean; message?: string };
  onClose: () => void;
}

const QUICK_AMOUNTS = [100, 500, 1000, 5000];

export default function DepositToBankModal({
  visible,
  bank,
  onDeposit,
  onClose,
}: DepositToBankModalProps) {
  const [amountInput, setAmountInput] = useState('');
  const [note, setNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  if (!bank) return null;

  const handleQuickAdd = (value: number) => {
    const current = Number(amountInput.replace(/,/g, '')) || 0;
    const next = current + value;
    setAmountInput(next.toString());
  };

  const handleSave = () => {
    if (isSaving) return;

    const normalized = amountInput.replace(/,/g, '').trim();
    if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
      showAlert('Invalid Amount', 'Enter a positive amount with up to two decimal places.');
      return;
    }

    const parsed = Number(normalized);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      showAlert('Invalid Amount', 'Please enter a valid amount greater than ₱0.');
      return;
    }

    setIsSaving(true);
    const result = onDeposit(bank.id, parsed, note.trim() || undefined);
    setIsSaving(false);

    if (result.ok) {
      setAmountInput('');
      setNote('');
      onClose();
      showAlert('Deposit Complete', `₱ ${formatCurrency(parsed)} has been added to ${bank.name}.`);
    } else {
      showAlert('Deposit Failed', result.message || 'Could not complete deposit.');
    }
  };

  const parsedAmount = Number(amountInput.replace(/,/g, '')) || 0;
  const projectedBalance = bank.balance + parsedAmount;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardAvoid}
        >
          <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()} style={styles.card}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <View style={styles.iconCircle}>
                  <Ionicons name="gift-outline" size={20} color="#059669" />
                </View>
                <View>
                  <Text style={styles.title}>Deposit to {bank.name}</Text>
                  <Text style={styles.subtitle}>Add money from gifts, bonuses, etc.</Text>
                </View>
              </View>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={22} color={THEME.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView bounces={false} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Balance preview card */}
              <View style={styles.previewCard}>
                <View style={styles.previewCol}>
                  <Text style={styles.previewLabel}>CURRENT BALANCE</Text>
                  <Text style={styles.previewVal}>₱ {formatCurrency(bank.balance)}</Text>
                </View>
                <Ionicons name="arrow-forward" size={16} color={THEME.colors.textMuted} />
                <View style={styles.previewColRight}>
                  <Text style={styles.previewLabel}>NEW BALANCE</Text>
                  <Text style={[styles.previewVal, { color: '#059669' }]}>
                    ₱ {formatCurrency(projectedBalance)}
                  </Text>
                </View>
              </View>

              {/* Amount input */}
              <Text style={styles.inputLabel}>AMOUNT TO DEPOSIT</Text>
              <View style={styles.amountInputRow}>
                <Text style={styles.currencyPrefix}>₱</Text>
                <TextInput
                  style={styles.amountInput}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={THEME.colors.textMuted}
                  value={amountInput}
                  onChangeText={setAmountInput}
                  autoFocus
                />
              </View>

              {/* Quick chips */}
              <View style={styles.chipsRow}>
                {QUICK_AMOUNTS.map((val) => (
                  <TouchableOpacity
                    key={val}
                    style={styles.chip}
                    onPress={() => handleQuickAdd(val)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.chipText}>+₱{val}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Note input */}
              <Text style={styles.inputLabel}>NOTE (OPTIONAL)</Text>
              <TextInput
                style={styles.noteInput}
                placeholder="e.g. Birthday gift, savings deposit"
                placeholderTextColor={THEME.colors.textMuted}
                value={note}
                onChangeText={setNote}
                maxLength={40}
              />

              {/* Deposit Button */}
              <TouchableOpacity
                style={[styles.primaryButton, (!parsedAmount || isSaving) && styles.buttonDisabled]}
                onPress={handleSave}
                disabled={!parsedAmount || isSaving}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryButtonText}>
                  {isSaving ? 'Depositing...' : `Deposit ₱ ${formatCurrency(parsedAmount)}`}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  keyboardAvoid: {
    width: '100%',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    padding: 22,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    ...THEME.shadow.soft,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerLeft: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
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
  subtitle: {
    color: THEME.colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  previewCard: {
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    padding: 14,
  },
  previewCol: {
    flex: 1,
  },
  previewColRight: {
    alignItems: 'flex-end',
    flex: 1,
  },
  previewLabel: {
    color: THEME.colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  previewVal: {
    color: THEME.colors.textDark,
    fontSize: 16,
    fontWeight: '800',
  },
  inputLabel: {
    color: THEME.colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  amountInputRow: {
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 10,
    paddingHorizontal: 14,
  },
  currencyPrefix: {
    color: THEME.colors.textMuted,
    fontSize: 22,
    fontWeight: '700',
    marginRight: 6,
  },
  amountInput: {
    color: THEME.colors.textDark,
    flex: 1,
    fontSize: 22,
    fontWeight: '800',
    paddingVertical: 12,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
    borderRadius: THEME.radius.full,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 8,
  },
  chipText: {
    color: THEME.colors.textDark,
    fontSize: 12,
    fontWeight: '700',
  },
  noteInput: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    color: THEME.colors.textDark,
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: THEME.colors.pillDark,
    borderRadius: THEME.radius.full,
    paddingVertical: 14,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  buttonDisabled: {
    opacity: 0.45,
  },
});

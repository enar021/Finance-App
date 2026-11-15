import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '@/constants/theme';
import { formatCurrency } from '@/utils/dates';

interface AddMoneyModalProps {
  visible: boolean;
  currentRemaining: number | null;
  onAdd: (amount: number, note?: string) => void;
  onClose: () => void;
}

const QUICK_AMOUNTS = [100, 500, 1000, 2000];

export default function AddMoneyModal({
  visible,
  currentRemaining,
  onAdd,
  onClose,
}: AddMoneyModalProps) {
  const [amountInput, setAmountInput] = useState('');
  const [note, setNote] = useState('');

  const handleQuickAdd = (value: number) => {
    const current = Number(amountInput.replace(/,/g, '')) || 0;
    const next = current + value;
    setAmountInput(next.toString());
  };

  const handleSave = () => {
    const parsed = Number(amountInput.replace(/,/g, '').trim());
    if (!Number.isFinite(parsed) || parsed <= 0) {
      Alert.alert('Invalid amount', 'Please enter a valid amount greater than ₱0.');
      return;
    }

    onAdd(parsed, note.trim() || undefined);
    setAmountInput('');
    setNote('');
    onClose();
  };

  const parsedAmount = Number(amountInput.replace(/,/g, '')) || 0;
  const projectedRemaining = (currentRemaining ?? 0) + parsedAmount;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardAvoid}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={styles.sheet}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.handle} />

            <View style={styles.header}>
              <View style={styles.headerIconSquare}>
                <Ionicons name="add-circle-outline" size={24} color={THEME.colors.pillDark} />
              </View>
              <View style={styles.headerTextGroup}>
                <Text style={styles.title}>Add to Balance</Text>
                <Text style={styles.subtitle}>
                  Add extra cash, bonuses, or gifts to your current remaining funds.
                </Text>
              </View>
            </View>

            {/* Projection Preview */}
            <View style={styles.projectionCard}>
              <View>
                <Text style={styles.projectionLabel}>CURRENT REMAINING</Text>
                <Text style={styles.projectionCurrent}>
                  ₱ {formatCurrency(currentRemaining ?? 0)}
                </Text>
              </View>
              <Ionicons name="arrow-forward" size={18} color={THEME.colors.textMuted} />
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.projectionLabel}>NEW REMAINING</Text>
                <Text style={styles.projectionNew}>
                  ₱ {formatCurrency(projectedRemaining)}
                </Text>
              </View>
            </View>

            {/* Amount input */}
            <Text style={styles.inputLabel}>AMOUNT TO ADD (₱)</Text>
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

            {/* Quick add pill chips */}
            <View style={styles.quickAddRow}>
              {QUICK_AMOUNTS.map((val) => (
                <TouchableOpacity
                  key={val}
                  style={styles.quickChip}
                  onPress={() => handleQuickAdd(val)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.quickChipText}>+₱{val.toLocaleString('en-PH')}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Note input */}
            <Text style={styles.inputLabel}>SOURCE / NOTE (OPTIONAL)</Text>
            <TextInput
              style={styles.noteInput}
              placeholder="e.g. Cash gift, freelance, refund"
              placeholderTextColor={THEME.colors.textMuted}
              value={note}
              onChangeText={setNote}
              maxLength={40}
            />

            {/* Action buttons */}
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleSave}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>Add to remaining money</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
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
  sheet: {
    backgroundColor: THEME.colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    width: '100%',
  },
  handle: {
    alignSelf: 'center',
    backgroundColor: '#CBD5E1',
    borderRadius: 3,
    height: 5,
    marginBottom: 16,
    width: 44,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    marginBottom: 16,
  },
  headerIconSquare: {
    alignItems: 'center',
    backgroundColor: THEME.colors.mintCard,
    borderRadius: 14,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  headerTextGroup: {
    flex: 1,
  },
  title: {
    color: THEME.colors.textDark,
    fontSize: 20,
    fontWeight: '800',
  },
  subtitle: {
    color: THEME.colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  projectionCard: {
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  projectionLabel: {
    color: THEME.colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  projectionCurrent: {
    color: THEME.colors.textSecondary,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 2,
  },
  projectionNew: {
    color: THEME.colors.indicatorGreen,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
  inputLabel: {
    color: THEME.colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  amountInputRow: {
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: THEME.radius.md,
    flexDirection: 'row',
    marginBottom: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  currencyPrefix: {
    color: THEME.colors.textDark,
    fontSize: 24,
    fontWeight: '800',
    marginRight: 6,
  },
  amountInput: {
    color: THEME.colors.textDark,
    flex: 1,
    fontSize: 24,
    fontWeight: '800',
  },
  quickAddRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  quickChip: {
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
    borderRadius: THEME.radius.full,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 7,
  },
  quickChipText: {
    color: THEME.colors.textDark,
    fontSize: 12,
    fontWeight: '700',
  },
  noteInput: {
    backgroundColor: '#F1F5F9',
    borderRadius: THEME.radius.md,
    color: THEME.colors.textDark,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: THEME.colors.pillDark,
    borderRadius: THEME.radius.full,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 15,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  cancelButton: {
    alignItems: 'center',
    marginTop: 10,
    paddingVertical: 10,
  },
  cancelButtonText: {
    color: THEME.colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
});

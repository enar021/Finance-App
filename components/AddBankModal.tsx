import React, { useEffect, useState } from 'react';
import {
  Keyboard,
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
import { showAlert } from '@/utils/alerts';

function parseMoney(value: string): number | null {
  const normalized = value.replace(/,/g, '').trim();
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : null;
}

interface AddBankModalProps {
  visible: boolean;
  onClose: () => void;
  onAddBank: (name: string, startingBalance: number) => { ok: boolean; message?: string };
}

export default function AddBankModal({ visible, onClose, onAddBank }: AddBankModalProps) {
  const [name, setName] = useState('');
  const [balanceInput, setBalanceInput] = useState('');

  useEffect(() => {
    if (visible) {
      setName('');
      setBalanceInput('');
    }
  }, [visible]);

  const handleCreate = () => {
    Keyboard.dismiss();
    const trimmed = name.trim();
    if (!trimmed) {
      showAlert('Name Required', 'Enter a bank name.');
      return;
    }

    const balance = balanceInput.trim() ? parseMoney(balanceInput) : 0;
    if (balance === null || balance < 0) {
      showAlert('Invalid Balance', 'Enter a non-negative starting balance.');
      return;
    }

    const result = onAddBank(trimmed, balance);
    if (result.ok) {
      onClose();
      showAlert('Bank Added', `${trimmed} has been created.`);
    } else {
      showAlert('Error', result.message || 'Could not add bank.');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardAvoid}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Bank</Text>
              <TouchableOpacity
                onPress={onClose}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={22} color={THEME.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>BANK NAME</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Maya, BDO, GCash"
              placeholderTextColor={THEME.colors.textMuted}
              value={name}
              onChangeText={setName}
              autoFocus
            />

            <Text style={styles.label}>STARTING BALANCE (OPTIONAL)</Text>
            <TextInput
              style={styles.input}
              placeholder="0.00"
              placeholderTextColor={THEME.colors.textMuted}
              keyboardType="decimal-pad"
              value={balanceInput}
              onChangeText={setBalanceInput}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={onClose}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleCreate}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Create Bank"
              >
                <Text style={styles.primaryButtonText}>Create Bank</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  keyboardAvoid: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
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
  label: {
    color: THEME.colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    color: THEME.colors.textDark,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
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
  primaryButton: {
    alignItems: 'center',
    backgroundColor: THEME.colors.pillDark,
    borderRadius: THEME.radius.full,
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 13,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '@/constants/theme';
import {
  formatMonthLabel,
  getDateKey,
  getMonthLabel,
  isAfterMonth,
  parseDateKey,
} from '@/utils/dates';

interface ExpenseFormProps {
  onSubmit: (title: string, amount: number, date: Date) => void;
  onCancel: () => void;
  defaultDate?: string; // "YYYY-MM-DD"
  currentMonthLabel?: string; // "YYYY-MM", the open budget month
}

const CATEGORY_PRESETS = [
  { label: 'Food', emoji: '🍔' },
  { label: 'Coffee', emoji: '☕' },
  { label: 'Ride', emoji: '🚗' },
  { label: 'Groceries', emoji: '🛒' },
  { label: 'Shopping', emoji: '🛍️' },
  { label: 'Bills', emoji: '⚡' },
];

export default function ExpenseForm({
  onSubmit,
  onCancel,
  defaultDate,
  currentMonthLabel,
}: ExpenseFormProps) {
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  
  const todayStr = getDateKey();
  const [dateStr, setDateStr] = useState(defaultDate || todayStr);

  const handleSubmit = () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      Alert.alert('Missing Name', 'Please enter an expense name (e.g. Groceries, Lunch).');
      return;
    }

    const normalizedAmount = amount.replace(/,/g, '').trim();
    if (!/^\d+(\.\d{1,2})?$/.test(normalizedAmount)) {
      Alert.alert('Invalid Amount', 'Enter a positive amount with up to two decimal places.');
      return;
    }
    const parsedAmount = Number(normalizedAmount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Invalid Amount', 'Enter a positive amount with up to two decimal places.');
      return;
    }

    const parsedDate = parseDateKey(dateStr);
    if (!parsedDate) {
      Alert.alert('Invalid Date', 'Enter a real date in YYYY-MM-DD format.');
      return;
    }

    if (currentMonthLabel && isAfterMonth(getMonthLabel(parsedDate), currentMonthLabel)) {
      Alert.alert(
        'Finish the current month first',
        `${formatMonthLabel(currentMonthLabel)} is still open. End the month before logging expenses for ${formatMonthLabel(getMonthLabel(parsedDate))}.`
      );
      return;
    }

    onSubmit(trimmedTitle, parsedAmount, parsedDate);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.backdrop}
    >
      <View style={styles.sheetContainer}>
        {/* Drag handle / top bar */}
        <View style={styles.dragHandle} />

        <View style={styles.header}>
          <Text style={styles.headerTitle}>Log Expense</Text>
          <TouchableOpacity onPress={onCancel} style={styles.closeBtn}>
            <Ionicons name="close" size={20} color={THEME.colors.textDark} />
          </TouchableOpacity>
        </View>

        {/* Quick Category Chips */}
        <Text style={styles.inputLabel}>Quick Categories</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScroll}
        >
          {CATEGORY_PRESETS.map((cat) => {
            const isSelected = title === cat.label;
            return (
              <TouchableOpacity
                key={cat.label}
                style={[styles.categoryChip, isSelected && styles.categoryChipSelected]}
                onPress={() => setTitle(cat.label)}
                activeOpacity={0.7}
              >
                <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
                <Text style={[styles.categoryText, isSelected && styles.categoryTextSelected]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Text style={styles.inputLabel}>Expense Name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Groceries, Coffee, Rent"
          placeholderTextColor={THEME.colors.textMuted}
          value={title}
          onChangeText={setTitle}
        />

        <Text style={styles.inputLabel}>Amount (P)</Text>
        <TextInput
          style={styles.input}
          placeholder="0.00"
          placeholderTextColor={THEME.colors.textMuted}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
        />

        <Text style={styles.inputLabel}>Date (YYYY-MM-DD)</Text>
        <TextInput
          style={styles.input}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={THEME.colors.textMuted}
          value={dateStr}
          onChangeText={setDateStr}
        />

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.submitButton}
            onPress={handleSubmit}
            activeOpacity={0.8}
          >
            <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
            <Text style={styles.submitButtonText}>Add to Daily Log</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: Platform.OS === 'ios' ? 40 : 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 10,
  },
  dragHandle: {
    width: 44,
    height: 5,
    backgroundColor: '#CBD5E1',
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: THEME.colors.textDark,
    letterSpacing: -0.3,
  },
  categoryScroll: {
    paddingVertical: 4,
    gap: 8,
    marginBottom: 14,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: THEME.radius.full,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  categoryChipSelected: {
    backgroundColor: THEME.colors.pillDark,
    borderColor: THEME.colors.pillDark,
  },
  categoryEmoji: {
    fontSize: 15,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.textDark,
  },
  categoryTextSelected: {
    color: '#FFFFFF',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderRadius: THEME.radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: THEME.colors.textDark,
    fontWeight: '600',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  buttonRow: {
    marginTop: 8,
  },
  submitButton: {
    backgroundColor: THEME.colors.pillDark,
    borderRadius: THEME.radius.full,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
import React from 'react';
import { Alert, Platform, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Expense } from '@/types';
import { formatDateShort, formatCurrency, getDayName } from '@/utils/dates';
import { THEME } from '@/constants/theme';

interface ExpenseItemProps {
  expense: Expense;
  onDelete?: (id: string) => void;
  showDay?: boolean;
}

export default function ExpenseItem({ expense, onDelete, showDay = false }: ExpenseItemProps) {
  const confirmDelete = () => {
    if (!onDelete) return;
    if (Platform.OS === 'web') {
      if (window.confirm(`Remove ${expense.title} from your ledger?`)) {
        onDelete(expense.id);
      }
      return;
    }

    Alert.alert('Delete expense?', `Remove ${expense.title} from your ledger?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete(expense.id) },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Ionicons
          name={expense.subscriptionId ? 'repeat-outline' : 'receipt-outline'}
          size={18}
          color={THEME.colors.textDark}
        />
      </View>

      <View style={styles.details}>
        <Text style={styles.title} numberOfLines={1}>
          {expense.title}
        </Text>
        <Text style={styles.meta}>
          {expense.subscriptionId ? 'Monthly subscription • ' : ''}
          {showDay ? `${getDayName(expense.date)}, ` : ''}
          {formatDateShort(expense.date)}
        </Text>
      </View>

      <Text style={styles.amount}>-₱ {formatCurrency(expense.amount)}</Text>

      {onDelete && (
        <TouchableOpacity
          onPress={confirmDelete}
          style={styles.deleteButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="trash-outline" size={17} color={THEME.colors.indicatorRed} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: THEME.radius.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(203, 213, 225, 0.4)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: THEME.colors.cardLavenderLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  details: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.colors.textDark,
  },
  meta: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    marginTop: 2,
    fontWeight: '500',
  },
  amount: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.colors.indicatorRed,
    marginRight: 8,
  },
  deleteButton: {
    padding: 4,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
  },
});
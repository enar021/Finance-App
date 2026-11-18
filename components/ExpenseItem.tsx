import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Expense } from '@/types';
import { formatDateShort, formatCurrency, getDayName } from '@/utils/dates';
import { THEME } from '@/constants/theme';
import { showConfirm } from '@/utils/alerts';

interface ExpenseItemProps {
  expense: Expense;
  onDelete?: (id: string) => void;
  onEdit?: (expense: Expense) => void;
  showDay?: boolean;
}

export default function ExpenseItem({ expense, onDelete, onEdit, showDay = false }: ExpenseItemProps) {
  const { width } = useWindowDimensions();
  const isPhone = width <= 430;

  const confirmDelete = () => {
    if (!onDelete) return;
    showConfirm(
      'Delete expense?',
      `Are you sure you want to delete "${expense.title}"? This cannot be undone.`,
      {
        cancelText: 'Keep expense',
        confirmText: 'Delete',
        confirmStyle: 'destructive',
        onConfirm: () => onDelete(expense.id),
      }
    );
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
        <Text style={styles.title} numberOfLines={isPhone ? 2 : 1}>
          {expense.title}
        </Text>
        <Text style={styles.meta}>
          {expense.subscriptionId ? 'Monthly subscription • ' : ''}
          {showDay ? `${getDayName(expense.date)}, ` : ''}
          {formatDateShort(expense.date)}
        </Text>
        {isPhone && <Text style={styles.phoneAmount}>-₱ {formatCurrency(expense.amount)}</Text>}
      </View>

      {!isPhone && <Text style={styles.amount}>-₱ {formatCurrency(expense.amount)}</Text>}

      {onDelete && (
        <View style={styles.actions}>
          {onEdit && (
            <TouchableOpacity
              onPress={() => onEdit(expense)}
              style={styles.actionButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={`Edit ${expense.title}`}
            >
              <Ionicons name="pencil-outline" size={17} color={THEME.colors.textDark} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={confirmDelete}
            style={styles.deleteButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={`Delete ${expense.title}`}
          >
            <Ionicons name="trash-outline" size={17} color={THEME.colors.indicatorRed} />
          </TouchableOpacity>
        </View>
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
  phoneAmount: {
    color: THEME.colors.indicatorRed,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 3,
  },
  amount: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.colors.indicatorRed,
    marginRight: 8,
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionButton: {
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  deleteButton: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 36,
    width: 36,
    padding: 4,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
  },
});
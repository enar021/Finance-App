import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '@/constants/theme';
import { formatCurrency } from '@/utils/dates';
import { PennyWiseLogo } from '@/components/PennyWiseLogo';

interface BalanceHeroCardProps {
  monthLabel?: string;
  currentRemaining: number;
  baseAllowance: number;
  extraAllowance?: number;
  onAddMoney?: () => void;
}

export default function BalanceHeroCard({
  currentRemaining,
  baseAllowance,
  extraAllowance = 0,
  onAddMoney,
}: BalanceHeroCardProps) {
  const isOverBudget = currentRemaining < 0;
  const totalBudget = baseAllowance + extraAllowance;
  const spent = Math.max(0, totalBudget - currentRemaining);

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.titleGroup}>
          <View style={styles.iconSquare}>
            <PennyWiseLogo size={22} />
          </View>
          <Text style={styles.monthText}>Penny Wise</Text>
        </View>

        {onAddMoney && (
          <TouchableOpacity
            style={styles.addMoneyBtn}
            onPress={onAddMoney}
            activeOpacity={0.75}
            accessibilityLabel="Add money to balance"
          >
            <Ionicons name="add" size={16} color={THEME.colors.textDark} />
            <Text style={styles.addMoneyText}>Add money</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.remainingLabel}>REMAINING</Text>

      <Text style={[styles.amount, isOverBudget && styles.overBudgetAmount]}>
        {isOverBudget ? '-₱ ' : '₱ '}
        {formatCurrency(Math.abs(currentRemaining))}
      </Text>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Spent ₱ {formatCurrency(spent)}</Text>
        <Text style={styles.footerText}>
          Budget ₱ {formatCurrency(totalBudget)}
          {extraAllowance > 0 ? ` (+₱ ${formatCurrency(extraAllowance)})` : ''}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: THEME.colors.mintCard,
    borderColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: THEME.radius.card,
    borderWidth: 1,
    padding: 22,
    ...THEME.shadow.soft,
  },
  topRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  titleGroup: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  iconSquare: {
    alignItems: 'center',
    backgroundColor: THEME.colors.white,
    borderRadius: 12,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  monthText: { color: THEME.colors.textDark, fontSize: 17, fontWeight: '800' },
  addMoneyBtn: {
    alignItems: 'center',
    backgroundColor: THEME.colors.white,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: THEME.radius.full,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    ...THEME.shadow.button,
  },
  addMoneyText: {
    color: THEME.colors.textDark,
    fontSize: 13,
    fontWeight: '800',
  },
  remainingLabel: {
    color: THEME.colors.textDark,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.7,
    marginTop: 16,
    opacity: 0.55,
  },
  amount: {
    color: THEME.colors.textDark,
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: -1,
    marginTop: 2,
  },
  overBudgetAmount: { color: THEME.colors.indicatorRed },
  footer: {
    borderTopColor: 'rgba(15, 23, 42, 0.1)',
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 13,
  },
  footerText: { color: THEME.colors.textSecondary, fontSize: 12, fontWeight: '700' },
});

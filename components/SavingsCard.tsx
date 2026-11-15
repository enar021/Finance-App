import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '@/constants/theme';
import { formatCurrency } from '@/utils/dates';

interface SavingsCardProps {
  bankName: string;
  totalSavings: number;
  onPress?: () => void;
}

export default function SavingsCard({ bankName, totalSavings, onPress }: SavingsCardProps) {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.85}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={`View savings growth history for ${bankName}`}
    >
      {/* Top Header Row */}
      <View style={styles.headerRow}>
        <View style={styles.titleGroup}>
          <View style={styles.iconSquare}>
            <Ionicons name="shield-checkmark" size={18} color="#059669" />
          </View>
          <Text style={styles.bankName}>{bankName}</Text>
        </View>

        <View style={styles.savingsPill}>
          <Text style={styles.savingsPillText}>Total Savings</Text>
        </View>
      </View>

      {/* Bottom Amount Row with Circle Arrow Button from Inspo */}
      <View style={styles.amountRow}>
        <Text style={styles.amount}>
          ₱ {formatCurrency(totalSavings)}
        </Text>

        <View style={styles.arrowCircle}>
          <Ionicons name="arrow-forward" size={18} color={THEME.colors.textDark} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: THEME.colors.mintCard,
    borderRadius: THEME.radius.card,
    paddingVertical: 22,
    paddingHorizontal: 22,
    ...THEME.shadow.soft,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.7)',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconSquare: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: THEME.colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...THEME.shadow.button,
  },
  bankName: {
    fontSize: 24,
    fontWeight: '800',
    color: THEME.colors.textDark,
    letterSpacing: -0.4,
  },
  savingsPill: {
    backgroundColor: THEME.colors.white,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: THEME.radius.full,
    ...THEME.shadow.button,
  },
  savingsPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#065F46',
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  amount: {
    fontSize: 38,
    fontWeight: '800',
    color: THEME.colors.textDark,
    letterSpacing: -0.6,
  },
  arrowCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: THEME.colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...THEME.shadow.button,
  },
});

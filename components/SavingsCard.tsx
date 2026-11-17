import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '@/constants/theme';
import { formatCurrency } from '@/utils/dates';
import { isCompact, isNarrow } from '@/utils/responsive';

interface SavingsCardProps {
  bankName: string;
  totalSavings: number;
  onPress?: () => void;
}

export default function SavingsCard({ bankName, totalSavings, onPress }: SavingsCardProps) {
  const { width: sw } = useWindowDimensions();
  const narrow = isNarrow(sw);
  const compact = isCompact(sw);

  return (
    <TouchableOpacity
      style={[styles.card, narrow && { paddingVertical: 16, paddingHorizontal: 16 }]}
      onPress={onPress}
      activeOpacity={0.85}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={`View savings growth history for ${bankName}`}
    >
      <View style={[styles.headerRow, narrow && styles.headerRowNarrow]}>
        <View style={[styles.titleGroup, { flexShrink: 1 }, narrow && { width: '100%' }]}>
          <View style={[styles.iconSquare, narrow && { width: 30, height: 30, borderRadius: 10 }]}>
            <Ionicons name="shield-checkmark" size={narrow ? 15 : 18} color="#059669" />
          </View>
          <Text
            style={[styles.bankName, { fontSize: narrow ? 18 : compact ? 21 : 24 }]}
            numberOfLines={narrow ? 2 : 1}
          >
            {bankName}
          </Text>
        </View>

        <View style={[styles.savingsPill, narrow && { paddingHorizontal: 8, paddingVertical: 4 }]}>
          <Text style={[styles.savingsPillText, narrow && { fontSize: 10 }]}>Total Savings</Text>
        </View>
      </View>

      <View style={styles.amountRow}>
        <Text
          style={[styles.amount, { fontSize: narrow ? 28 : compact ? 33 : 38 }]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          ₱ {formatCurrency(totalSavings)}
        </Text>

        <View style={[styles.arrowCircle, narrow && { width: 36, height: 36, borderRadius: 18 }]}>
          <Ionicons name="arrow-forward" size={narrow ? 15 : 18} color={THEME.colors.textDark} />
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
  headerRowNarrow: {
    alignItems: 'flex-start',
    flexDirection: 'column',
    gap: 10,
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
    flexShrink: 1,
  },
  savingsPill: {
    backgroundColor: THEME.colors.white,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: THEME.radius.full,
    ...THEME.shadow.button,
    flexShrink: 0,
    marginLeft: 8,
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
    flex: 1,
    marginRight: 12,
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
    flexShrink: 0,
  },
});
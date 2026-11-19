import React, { useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '@/constants/theme';
import { formatCurrency } from '@/utils/dates';
import { isCompact, isNarrow } from '@/utils/responsive';
import type { BankAccount } from '@/types';

interface SavingsCardCarouselProps {
  mainSavingsName: string;
  bankAccounts: BankAccount[];
  totalSavings: number;
  pendingRolloverAmount?: number;
  onOpenVaultHistory?: () => void;
  onTransferPress?: (targetBankId?: string) => void;
  onDistributePress?: (targetBankId?: string) => void;
  onAddBankPress?: () => void;
  onManageBanks?: () => void;
  onBankPress?: (bank: BankAccount) => void;
  onAddMoneyToBankPress?: (bank: BankAccount) => void;
}

const BANK_CARD_THEMES = [
  {
    bg: THEME.colors.lilacCard,
    border: 'rgba(196, 181, 253, 0.6)',
    pillBg: THEME.colors.white,
    pillColor: '#6D28D9',
    iconColor: '#7C3AED',
    iconName: 'business-outline' as const,
  },
  {
    bg: THEME.colors.creamCard,
    border: 'rgba(253, 230, 138, 0.7)',
    pillBg: THEME.colors.white,
    pillColor: '#B45309',
    iconColor: '#D97706',
    iconName: 'wallet-outline' as const,
  },
  {
    bg: THEME.colors.periwinkleCard,
    border: 'rgba(186, 215, 245, 0.7)',
    pillBg: THEME.colors.white,
    pillColor: '#1E40AF',
    iconColor: '#2563EB',
    iconName: 'card-outline' as const,
  },
  {
    bg: '#D5F0E8',
    border: 'rgba(167, 243, 208, 0.7)',
    pillBg: THEME.colors.white,
    pillColor: '#065F46',
    iconColor: '#059669',
    iconName: 'shield-outline' as const,
  },
];

export default function SavingsCardCarousel({
  mainSavingsName,
  bankAccounts,
  totalSavings,
  pendingRolloverAmount,
  onOpenVaultHistory,
  onTransferPress,
  onDistributePress,
  onAddBankPress,
  onManageBanks,
  onBankPress,
  onAddMoneyToBankPress,
}: SavingsCardCarouselProps) {
  const { width: sw } = useWindowDimensions();
  const cardWidth = Math.max(280, sw - 40);
  const narrow = isNarrow(sw);
  const compact = isCompact(sw);

  const scrollX = useRef(new Animated.Value(0)).current;
  const [activeIndex, setActiveIndex] = useState(0);

  const hasAddAction = Boolean(onAddBankPress || onManageBanks);
  const totalCards = 1 + bankAccounts.length + (hasAddAction ? 1 : 0);

  const handleScrollEnd = (offsetX: number) => {
    const idx = Math.round(offsetX / cardWidth);
    const clamped = Math.max(0, Math.min(idx, totalCards - 1));
    setActiveIndex(clamped);
  };

  const displayName = mainSavingsName.trim() || 'Main Savings';
  const triggerTransfer = onTransferPress || onDistributePress;

  return (
    <View style={styles.container}>
      <Animated.ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        decelerationRate="fast"
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          {
            useNativeDriver: false,
            listener: (event: any) => {
              const offsetX = event.nativeEvent.contentOffset.x;
              const idx = Math.round(offsetX / cardWidth);
              const clamped = Math.max(0, Math.min(idx, totalCards - 1));
              if (clamped !== activeIndex) {
                setActiveIndex(clamped);
              }
            },
          }
        )}
        onMomentumScrollEnd={(event) => {
          handleScrollEnd(event.nativeEvent.contentOffset.x);
        }}
      >
        {/* CARD 0: Main Savings (Overview) */}
        <View style={{ width: cardWidth }}>
          <TouchableOpacity
            style={[styles.card, styles.totalCard, narrow && styles.cardNarrow]}
            onPress={onOpenVaultHistory}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel={`${displayName} total savings, tap to view history`}
          >
            {/* Header: Title + Subtitle */}
            <View style={styles.headerRow}>
              <View style={styles.titleGroup}>
                <View style={[styles.iconSquare, narrow && styles.iconSquareNarrow]}>
                  <Ionicons name="shield-checkmark" size={narrow ? 16 : 19} color="#059669" />
                </View>
                <View style={styles.titleTextCol}>
                  <Text
                    style={[styles.bankName, { fontSize: narrow ? 18 : compact ? 20 : 22 }]}
                    numberOfLines={1}
                  >
                    {displayName}
                  </Text>
                  <Text style={styles.bankSubtitle}>
                    {(pendingRolloverAmount ?? 0) > 0
                      ? `₱ ${formatCurrency(pendingRolloverAmount!)} pending distribution`
                      : bankAccounts.length === 0
                      ? 'Total Savings'
                      : `${bankAccounts.length} ${
                          bankAccounts.length === 1 ? 'account' : 'accounts'
                        }`}
                  </Text>
                </View>
              </View>

              <View style={styles.vaultPill}>
                <Text style={styles.vaultPillText}>Total Savings</Text>
              </View>
            </View>

            {/* Bottom Row: Amount + Action */}
            <View style={styles.amountRow}>
              <View style={styles.amountCol}>
                <Text
                  style={[styles.amount, { fontSize: narrow ? 26 : compact ? 30 : 34 }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  ₱ {formatCurrency(totalSavings)}
                </Text>
                <Text style={styles.amountLabel}>Total Savings Balance</Text>
              </View>

              {bankAccounts.length > 1 && triggerTransfer ? (
                <TouchableOpacity
                  style={[styles.transferButton, narrow && styles.transferButtonNarrow]}
                  onPress={(e) => {
                    e.stopPropagation();
                    triggerTransfer();
                  }}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel="Transfer savings"
                >
                  <Ionicons name="swap-horizontal" size={15} color="#065F46" />
                  <Text style={[styles.transferButtonText, narrow && { fontSize: 12 }]}>
                    Transfer
                  </Text>
                </TouchableOpacity>
              ) : onAddBankPress ? (
                <TouchableOpacity
                  style={[styles.transferButton, narrow && styles.transferButtonNarrow]}
                  onPress={(e) => {
                    e.stopPropagation();
                    onAddBankPress();
                  }}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel="Add bank account"
                >
                  <Ionicons name="add" size={15} color="#065F46" />
                  <Text style={[styles.transferButtonText, narrow && { fontSize: 12 }]}>
                    Add Bank
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </TouchableOpacity>
        </View>

        {/* CARDS 1..N: Sub-Banks */}
        {bankAccounts.map((bank, index) => {
          const theme = BANK_CARD_THEMES[index % BANK_CARD_THEMES.length];
          const percent =
            totalSavings > 0
              ? Math.max(0, Math.min(100, Math.round((bank.balance / totalSavings) * 100)))
              : 0;

          return (
            <View key={bank.id} style={{ width: cardWidth }}>
              <TouchableOpacity
                style={[
                  styles.card,
                  { backgroundColor: theme.bg, borderColor: theme.border },
                  narrow && styles.cardNarrow,
                ]}
                onPress={() => {
                  if (onBankPress) {
                    onBankPress(bank);
                  } else if (triggerTransfer) {
                    triggerTransfer(bank.id);
                  }
                }}
                activeOpacity={0.88}
                accessibilityRole="button"
                accessibilityLabel={`${bank.name}, balance ₱ ${formatCurrency(bank.balance)}`}
              >
                {/* Header: Bank Name + Percent */}
                <View style={styles.headerRow}>
                  <View style={styles.titleGroup}>
                    <View style={[styles.iconSquare, narrow && styles.iconSquareNarrow]}>
                      <Ionicons
                        name={theme.iconName}
                        size={narrow ? 16 : 19}
                        color={theme.iconColor}
                      />
                    </View>
                    <View style={styles.titleTextCol}>
                      <Text
                        style={[styles.bankName, { fontSize: narrow ? 18 : compact ? 20 : 22 }]}
                        numberOfLines={1}
                      >
                        {bank.name}
                      </Text>
                      <Text style={styles.bankSubtitle}>
                        {percent}% of total savings
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Bottom Row: Amount + Action Buttons */}
                <View style={styles.amountRow}>
                  <View style={styles.amountCol}>
                    <Text
                      style={[styles.amount, { fontSize: narrow ? 26 : compact ? 30 : 34 }]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                    >
                      ₱ {formatCurrency(bank.balance)}
                    </Text>
                    <Text style={styles.amountLabel}>Account Balance</Text>
                  </View>

                  <View style={styles.cardActionsGroup}>
                    {onAddMoneyToBankPress && (
                      <TouchableOpacity
                        style={[
                          styles.transferButton,
                          { backgroundColor: theme.pillBg },
                          narrow && styles.transferButtonNarrow,
                        ]}
                        onPress={(e) => {
                          e.stopPropagation();
                          onAddMoneyToBankPress(bank);
                        }}
                        activeOpacity={0.75}
                        accessibilityRole="button"
                        accessibilityLabel={`Add money to ${bank.name}`}
                      >
                        <Ionicons name="add" size={15} color={theme.pillColor} />
                        <Text
                          style={[
                            styles.transferButtonText,
                            { color: theme.pillColor },
                            narrow && { fontSize: 12 },
                          ]}
                        >
                          Add
                        </Text>
                      </TouchableOpacity>
                    )}

                    {bankAccounts.length > 1 && triggerTransfer && (
                      <TouchableOpacity
                        style={[
                          styles.transferButton,
                          { backgroundColor: theme.pillBg },
                          narrow && styles.transferButtonNarrow,
                        ]}
                        onPress={(e) => {
                          e.stopPropagation();
                          triggerTransfer(bank.id);
                        }}
                        activeOpacity={0.75}
                        accessibilityRole="button"
                        accessibilityLabel={`Transfer to or from ${bank.name}`}
                      >
                        <Ionicons name="swap-horizontal" size={15} color={theme.pillColor} />
                        <Text
                          style={[
                            styles.transferButtonText,
                            { color: theme.pillColor },
                            narrow && { fontSize: 12 },
                          ]}
                        >
                          Transfer
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            </View>
          );
        })}

        {/* CARD N+1: Add Bank CTA */}
        {hasAddAction && (
          <View style={{ width: cardWidth }}>
            <TouchableOpacity
              style={[styles.card, styles.addBankCard, narrow && styles.cardNarrow]}
              onPress={() => {
                if (onAddBankPress) {
                  onAddBankPress();
                } else if (onManageBanks) {
                  onManageBanks();
                }
              }}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Add bank account"
            >
              <View style={styles.addBankContent}>
                <View style={styles.addBankIconCircle}>
                  <Ionicons name="add" size={24} color={THEME.colors.textDark} />
                </View>
                <Text style={styles.addBankTitle}>
                  {bankAccounts.length > 0 ? 'Add Another Bank' : 'Add Bank'}
                </Text>
                <Text style={styles.addBankSubtitle}>
                  Create a sub-account under {displayName}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        )}
      </Animated.ScrollView>

      {/* Pagination Dots */}
      {totalCards > 1 && (
        <View style={styles.paginationRow}>
          {Array.from({ length: totalCards }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                activeIndex === i ? styles.dotActive : styles.dotInactive,
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  card: {
    borderRadius: THEME.radius.card,
    borderWidth: 1,
    minHeight: 140,
    padding: 18,
    ...THEME.shadow.soft,
  },
  cardNarrow: {
    minHeight: 130,
    padding: 15,
  },
  totalCard: {
    backgroundColor: THEME.colors.mintCard,
    borderColor: 'rgba(255, 255, 255, 0.7)',
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  titleGroup: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    marginRight: 8,
  },
  iconSquare: {
    alignItems: 'center',
    backgroundColor: THEME.colors.white,
    borderRadius: 12,
    height: 36,
    justifyContent: 'center',
    width: 36,
    ...THEME.shadow.button,
  },
  iconSquareNarrow: {
    borderRadius: 10,
    height: 32,
    width: 32,
  },
  titleTextCol: {
    flex: 1,
  },
  bankName: {
    color: THEME.colors.textDark,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  bankSubtitle: {
    color: THEME.colors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 1,
  },
  vaultPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: THEME.radius.full,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  vaultPillText: {
    color: '#065F46',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  amountRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 'auto',
  },
  amountCol: {
    flex: 1,
    marginRight: 10,
  },
  amount: {
    color: THEME.colors.textDark,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  amountLabel: {
    color: THEME.colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  cardActionsGroup: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  transferButton: {
    alignItems: 'center',
    backgroundColor: THEME.colors.white,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: THEME.radius.full,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 13,
    paddingVertical: 8,
    ...THEME.shadow.button,
  },
  transferButtonNarrow: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  transferButtonText: {
    color: '#065F46',
    fontSize: 13,
    fontWeight: '700',
  },
  addBankCard: {
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    borderWidth: 2,
    justifyContent: 'center',
  },
  addBankContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  addBankIconCircle: {
    alignItems: 'center',
    backgroundColor: THEME.colors.white,
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    marginBottom: 6,
    width: 40,
    ...THEME.shadow.button,
  },
  addBankTitle: {
    color: THEME.colors.textDark,
    fontSize: 15,
    fontWeight: '800',
  },
  addBankSubtitle: {
    color: THEME.colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  paginationRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 10,
    gap: 6,
  },
  dot: {
    borderRadius: 3,
    height: 6,
  },
  dotActive: {
    backgroundColor: THEME.colors.pillDark,
    width: 18,
  },
  dotInactive: {
    backgroundColor: '#CBD5E1',
    width: 6,
  },
});

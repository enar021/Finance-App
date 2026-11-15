import React, { useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { THEME } from '@/constants/theme';
import type { SavingsRecord } from '@/types';
import { formatCurrency, formatMonthLabel } from '@/utils/dates';

interface SavingsHistoryModalProps {
  visible: boolean;
  bankName: string;
  totalSavings: number;
  baseAllowance: number | null;
  history: SavingsRecord[];
  onClose: () => void;
}

export default function SavingsHistoryModal({
  visible,
  bankName,
  totalSavings,
  baseAllowance,
  history,
  onClose,
}: SavingsHistoryModalProps) {
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);

  // Compute total accumulated rollover
  const totalRolledOver = useMemo(
    () => history.reduce((sum, h) => sum + h.rolloverAmount, 0),
    [history]
  );

  // Calculate starting initial balance (totalSavings minus all recorded rollovers)
  const initialBalance = Math.max(0, totalSavings - totalRolledOver);

  // Construct data points for compounding trend graph (chronological order)
  const chartPoints = useMemo(() => {
    // Chronological order: oldest to newest
    const chronological = [...history].sort((a, b) => a.monthLabel.localeCompare(b.monthLabel));

    const points: Array<{ label: string; fullLabel: string; value: number; change?: number }> = [
      {
        label: 'Start',
        fullLabel: 'Initial Balance',
        value: initialBalance,
      },
    ];

    chronological.forEach((rec) => {
      points.push({
        label: formatMonthLabel(rec.monthLabel).split(' ')[0], // e.g. "Nov"
        fullLabel: formatMonthLabel(rec.monthLabel),
        value: rec.newTotalSavings,
        change: rec.rolloverAmount,
      });
    });

    return points;
  }, [history, initialBalance]);

  // Graph geometry
  const { width: windowWidth } = useWindowDimensions();
  const maxContentWidth = Math.min(windowWidth - 40, 480);
  const graphWidth = Math.max(220, maxContentWidth - 40);
  const graphHeight = 150;
  const padX = 24;
  const padY = 24;

  const { pathLine, pathArea, pointCoords } = useMemo(() => {
    const values = chartPoints.map((p) => p.value);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const range = maxVal - minVal || 1;

    const coords = chartPoints.map((p, i) => {
      const x =
        chartPoints.length === 1
          ? graphWidth / 2
          : padX + (i / (chartPoints.length - 1)) * (graphWidth - padX * 2);
      const y =
        graphHeight - padY - ((p.value - minVal) / range) * (graphHeight - padY * 2);
      return { x, y, ...p };
    });

    if (coords.length === 1) {
      return {
        pathLine: '',
        pathArea: '',
        pointCoords: coords,
      };
    }

    const lineD = coords.reduce(
      (acc, c, idx) => (idx === 0 ? `M ${c.x} ${c.y}` : `${acc} L ${c.x} ${c.y}`),
      ''
    );

    const lastX = coords[coords.length - 1].x;
    const firstX = coords[0].x;
    const bottomY = graphHeight - 8;
    const areaD = `${lineD} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;

    return {
      pathLine: lineD,
      pathArea: areaD,
      pointCoords: coords,
    };
  }, [chartPoints]);

  const activePoint =
    selectedPointIndex !== null && pointCoords[selectedPointIndex]
      ? pointCoords[selectedPointIndex]
      : pointCoords[pointCoords.length - 1];

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        {/* Top Navigation */}
        <View style={styles.navBar}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
            <Ionicons name="close" size={22} color={THEME.colors.textDark} />
          </TouchableOpacity>
          <View style={styles.navTitleGroup}>
            <Text style={styles.navTitle}>Savings Growth</Text>
            <Text style={styles.navSubtitle}>{bankName || 'Savings Account'}</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Main Vault Balance Card */}
          <View style={styles.vaultCard}>
            <View style={styles.vaultHeader}>
              <View style={styles.vaultIconSquare}>
                <Ionicons name="shield-checkmark" size={20} color="#059669" />
              </View>
              <View style={styles.vaultBadge}>
                <Text style={styles.vaultBadgeText}>COMPOUNDING VAULT</Text>
              </View>
            </View>

            <Text style={styles.vaultLabel}>TOTAL SAVINGS BALANCE</Text>
            <Text style={styles.vaultAmount} numberOfLines={1} adjustsFontSizeToFit>
              ₱ {formatCurrency(totalSavings)}
            </Text>

            <View style={styles.vaultFooter}>
              <View style={styles.vaultStat}>
                <Text style={styles.vaultStatLabel}>TOTAL ROLLED OVER</Text>
                <Text style={styles.vaultStatValue}>+₱ {formatCurrency(totalRolledOver)}</Text>
              </View>
              <View style={styles.vaultDivider} />
              <View style={styles.vaultStat}>
                <Text style={styles.vaultStatLabel}>MONTHLY ALLOWANCE</Text>
                <Text style={styles.vaultStatValue}>
                  ₱ {baseAllowance !== null ? formatCurrency(baseAllowance) : '0'}
                </Text>
              </View>
            </View>
          </View>

          {/* Savings Trend Graph Card */}
          <View style={styles.chartCard}>
            <View style={styles.chartCardHeader}>
              <View>
                <Text style={styles.chartTitle}>GROWTH TIMELINE</Text>
                <Text style={styles.chartSub}>
                  {activePoint?.fullLabel ?? 'Savings Growth'}
                </Text>
              </View>
              <View style={styles.chartBalanceBadge}>
                <Text style={styles.chartBalanceText}>
                  ₱ {formatCurrency(activePoint?.value ?? totalSavings)}
                </Text>
              </View>
            </View>

            <View style={styles.svgWrapper}>
              <Svg width={graphWidth} height={graphHeight}>
                <Defs>
                  <LinearGradient id="growthGrad" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor="#10B981" stopOpacity="0.35" />
                    <Stop offset="1" stopColor="#10B981" stopOpacity="0.0" />
                  </LinearGradient>
                </Defs>

                {/* Subtle Baseline Grid */}
                <Path
                  d={`M ${padX} ${graphHeight - 8} L ${graphWidth - padX} ${graphHeight - 8}`}
                  stroke="#E2E8F0"
                  strokeWidth="1"
                />

                {/* Area fill */}
                {pathArea ? (
                  <Path d={pathArea} fill="url(#growthGrad)" />
                ) : null}

                {/* Line stroke */}
                {pathLine ? (
                  <Path
                    d={pathLine}
                    fill="none"
                    stroke="#059669"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ) : null}

                {/* Data Points */}
                {pointCoords.map((pt, idx) => {
                  const isSelected =
                    selectedPointIndex === idx ||
                    (selectedPointIndex === null && idx === pointCoords.length - 1);
                  return (
                    <Circle
                      key={idx}
                      cx={pt.x}
                      cy={pt.y}
                      r={isSelected ? 6 : 4}
                      fill="#FFFFFF"
                      stroke="#059669"
                      strokeWidth={isSelected ? 3 : 2}
                      onPress={() => setSelectedPointIndex(idx)}
                    />
                  );
                })}
              </Svg>
            </View>

            {/* X-Axis Month Labels */}
            <View style={styles.xAxisRow}>
              {pointCoords.map((pt, idx) => (
                <TouchableOpacity
                  key={idx}
                  onPress={() => setSelectedPointIndex(idx)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.xAxisLabel,
                      (selectedPointIndex === idx ||
                        (selectedPointIndex === null && idx === pointCoords.length - 1)) &&
                        styles.xAxisLabelActive,
                    ]}
                  >
                    {pt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Month-by-Month Rollover Timeline */}
          <View style={styles.timelineSection}>
            <Text style={styles.timelineHeading}>MONTHLY ROLLOVER HISTORY</Text>

            {history.length === 0 ? (
              <View style={styles.emptyCard}>
                <View style={styles.emptyIconCircle}>
                  <Ionicons name="time-outline" size={26} color="#059669" />
                </View>
                <Text style={styles.emptyTitle}>First Month in Progress!</Text>
                <Text style={styles.emptyText}>
                  At the end of each monthly cycle, any unspent remaining allowance automatically
                  rolls over here into your savings vault, building your wealth month-by-month.
                </Text>
              </View>
            ) : (
              <View style={styles.recordList}>
                {history.map((record) => {
                  const savingsRate =
                    record.budget > 0
                      ? Math.round((record.rolloverAmount / record.budget) * 100)
                      : 0;

                  return (
                    <View key={record.id} style={styles.recordCard}>
                      <View style={styles.recordTopRow}>
                        <View style={styles.recordMonthGroup}>
                          <Text style={styles.recordMonth}>
                            {formatMonthLabel(record.monthLabel)}
                          </Text>
                          <Text style={styles.recordDate}>Completed cycle</Text>
                        </View>
                        <View style={styles.rolloverBadge}>
                          <Ionicons name="trending-up" size={14} color="#065F46" />
                          <Text style={styles.rolloverBadgeText}>
                            +₱ {formatCurrency(record.rolloverAmount)}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.recordStatsGrid}>
                        <View style={styles.recordStatCol}>
                          <Text style={styles.recordStatLabel}>BUDGET</Text>
                          <Text style={styles.recordStatVal}>₱ {formatCurrency(record.budget)}</Text>
                        </View>
                        <View style={styles.recordStatCol}>
                          <Text style={styles.recordStatLabel}>SPENT</Text>
                          <Text style={styles.recordStatVal}>₱ {formatCurrency(record.spent)}</Text>
                        </View>
                        <View style={styles.recordStatCol}>
                          <Text style={styles.recordStatLabel}>SAVINGS RATE</Text>
                          <Text style={[styles.recordStatVal, { color: '#059669' }]}>
                            {savingsRate}%
                          </Text>
                        </View>
                      </View>

                      <View style={styles.recordBalanceRow}>
                        <Text style={styles.recordBalanceLabel}>Ending Vault Balance:</Text>
                        <Text style={styles.recordBalanceAmount}>
                          ₱ {formatCurrency(record.newTotalSavings)}
                        </Text>
                      </View>
                    </View>
                  );
                })}

                {/* Starting initial balance card */}
                <View style={styles.initialRecordCard}>
                  <View style={styles.initialIconSquare}>
                    <Ionicons name="flag-outline" size={18} color={THEME.colors.textDark} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.initialTitle}>Initial Starting Balance</Text>
                    <Text style={styles.initialSub}>Configured baseline deposit</Text>
                  </View>
                  <Text style={styles.initialAmount}>₱ {formatCurrency(initialBalance)}</Text>
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: THEME.colors.background },
  navBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  closeBtn: {
    alignItems: 'center',
    backgroundColor: THEME.colors.white,
    borderColor: '#E2E8F0',
    borderRadius: THEME.radius.full,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
    ...THEME.shadow.button,
  },
  navTitleGroup: { alignItems: 'center' },
  navTitle: { color: THEME.colors.textDark, fontSize: 17, fontWeight: '800' },
  navSubtitle: { color: THEME.colors.textSecondary, fontSize: 12, fontWeight: '600', marginTop: 1 },
  content: {
    padding: 20,
    paddingBottom: 40,
    gap: 16,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  vaultCard: {
    backgroundColor: THEME.colors.mintCard,
    borderColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: THEME.radius.card,
    borderWidth: 1,
    padding: 22,
    ...THEME.shadow.soft,
  },
  vaultHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  vaultIconSquare: {
    alignItems: 'center',
    backgroundColor: THEME.colors.white,
    borderRadius: 12,
    height: 38,
    justifyContent: 'center',
    width: 38,
    ...THEME.shadow.button,
  },
  vaultBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: THEME.radius.full,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  vaultBadgeText: {
    color: '#065F46',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  vaultLabel: {
    color: THEME.colors.textDark,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    opacity: 0.6,
  },
  vaultAmount: {
    color: THEME.colors.textDark,
    fontSize: 38,
    fontWeight: '800',
    letterSpacing: -0.6,
    marginVertical: 4,
  },
  vaultFooter: {
    borderTopColor: 'rgba(15, 23, 42, 0.1)',
    borderTopWidth: 1,
    flexDirection: 'row',
    marginTop: 16,
    paddingTop: 14,
  },
  vaultStat: { flex: 1 },
  vaultDivider: {
    backgroundColor: 'rgba(15, 23, 42, 0.1)',
    marginHorizontal: 16,
    width: 1,
  },
  vaultStatLabel: {
    color: THEME.colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  vaultStatValue: {
    color: THEME.colors.textDark,
    fontSize: 15,
    fontWeight: '800',
    marginTop: 2,
  },
  chartCard: {
    backgroundColor: THEME.colors.white,
    borderColor: '#E2E8F0',
    borderRadius: THEME.radius.card,
    borderWidth: 1,
    padding: 20,
    ...THEME.shadow.soft,
  },
  chartCardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  chartTitle: {
    color: THEME.colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  chartSub: {
    color: THEME.colors.textDark,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 2,
  },
  chartBalanceBadge: {
    backgroundColor: '#D1FAE5',
    borderRadius: THEME.radius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chartBalanceText: {
    color: '#065F46',
    fontSize: 14,
    fontWeight: '800',
  },
  svgWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  xAxisRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 6,
    paddingHorizontal: 10,
  },
  xAxisLabel: {
    color: THEME.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  xAxisLabelActive: {
    color: '#059669',
    fontWeight: '800',
  },
  timelineSection: { marginTop: 4 },
  timelineHeading: {
    color: THEME.colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 12,
  },
  recordList: { gap: 10 },
  recordCard: {
    backgroundColor: THEME.colors.white,
    borderColor: '#E2E8F0',
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    padding: 16,
  },
  recordTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  recordMonthGroup: {},
  recordMonth: { color: THEME.colors.textDark, fontSize: 16, fontWeight: '800' },
  recordDate: { color: THEME.colors.textSecondary, fontSize: 12, marginTop: 1 },
  rolloverBadge: {
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    borderRadius: THEME.radius.full,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  rolloverBadgeText: { color: '#065F46', fontSize: 13, fontWeight: '800' },
  recordStatsGrid: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
  },
  recordStatCol: { alignItems: 'center', flex: 1 },
  recordStatLabel: { color: THEME.colors.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  recordStatVal: { color: THEME.colors.textDark, fontSize: 13, fontWeight: '800', marginTop: 2 },
  recordBalanceRow: {
    alignItems: 'center',
    borderTopColor: '#F1F5F9',
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
  },
  recordBalanceLabel: { color: THEME.colors.textSecondary, fontSize: 12, fontWeight: '600' },
  recordBalanceAmount: { color: THEME.colors.textDark, fontSize: 14, fontWeight: '800' },
  initialRecordCard: {
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  initialIconSquare: {
    alignItems: 'center',
    backgroundColor: THEME.colors.white,
    borderRadius: 10,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  initialTitle: { color: THEME.colors.textDark, fontSize: 14, fontWeight: '800' },
  initialSub: { color: THEME.colors.textSecondary, fontSize: 11, marginTop: 1 },
  initialAmount: { color: THEME.colors.textDark, fontSize: 15, fontWeight: '800' },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: THEME.colors.white,
    borderColor: '#E2E8F0',
    borderRadius: THEME.radius.card,
    borderWidth: 1,
    padding: 24,
  },
  emptyIconCircle: {
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    borderRadius: 30,
    height: 60,
    justifyContent: 'center',
    marginBottom: 12,
    width: 60,
  },
  emptyTitle: { color: THEME.colors.textDark, fontSize: 17, fontWeight: '800' },
  emptyText: {
    color: THEME.colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
    textAlign: 'center',
  },
});

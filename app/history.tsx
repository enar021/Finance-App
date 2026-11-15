import SpendingPieChart, { ChartSegment } from "@/components/SpendingPieChart";
import { THEME } from "@/constants/theme";
import { useFinanceStore } from "@/store/useFinanceStore";
import {
  formatCurrency,
  formatDateShort,
  formatMonthLabel,
  getMonthLabel,
  getPreviousMonthLabel,
} from "@/utils/dates";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type FilterType = "current" | "previous" | "custom";

const PALETTE = [
  "#2DD4BF", // Mint / Teal
  "#818CF8", // Indigo / Lilac
  "#FBBF24", // Warm Amber
  "#F472B6", // Rose Pink
  "#60A5FA", // Sky Blue
  "#A78BFA", // Purple
  "#34D399", // Emerald
  "#FB923C", // Orange
  "#94A3B8", // Slate
  "#E879F9", // Fuchsia
];

export default function HistoryScreen() {
  const { expenses, stats } = useFinanceStore();
  const [filterType, setFilterType] = useState<FilterType>("current");
  const [customMonth, setCustomMonth] = useState<string>("all");
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [selectedCategoryKey, setSelectedCategoryKey] = useState<string | null>(
    null,
  );
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [animKey, setAnimKey] = useState<number>(0);

  // 100% Native Driver animations for zero-lag 120 FPS transitions
  const cardEntranceAnim = useRef(new Animated.Value(0)).current;
  const badgeScaleAnim = useRef(new Animated.Value(0.9)).current;
  const utilizationProgressAnim = useRef(new Animated.Value(0)).current;

  // Retrigger animations every time screen comes into focus
  useFocusEffect(
    useCallback(() => {
      setAnimKey((k) => k + 1);
    }, []),
  );

  const currentMonthLabel = stats.currentMonthLabel || getMonthLabel();
  const previousMonthLabel = getPreviousMonthLabel(currentMonthLabel);

  // Collect all unique month labels present across expenses & current stats
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    set.add(currentMonthLabel);
    set.add(previousMonthLabel);
    expenses.forEach((e) => {
      if (e.monthLabel) set.add(e.monthLabel);
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [expenses, currentMonthLabel, previousMonthLabel]);

  // Determine active month label based on filter
  const activeMonthLabel = useMemo(() => {
    if (filterType === "current") return currentMonthLabel;
    if (filterType === "previous") return previousMonthLabel;
    return customMonth; // could be specific "YYYY-MM" or "all"
  }, [filterType, currentMonthLabel, previousMonthLabel, customMonth]);

  // Filter expenses matching the active filter
  const filteredExpenses = useMemo(() => {
    if (filterType === "current") {
      return expenses.filter((e) => e.monthLabel === currentMonthLabel);
    }
    if (filterType === "previous") {
      return expenses.filter((e) => e.monthLabel === previousMonthLabel);
    }
    // Custom filter
    if (customMonth === "all") {
      return expenses;
    }
    return expenses.filter((e) => e.monthLabel === customMonth);
  }, [
    expenses,
    filterType,
    currentMonthLabel,
    previousMonthLabel,
    customMonth,
  ]);

  // Calculate totals
  const totalSpent = useMemo(
    () => filteredExpenses.reduce((sum, e) => sum + e.amount, 0),
    [filteredExpenses],
  );

  const baseAllowance = stats.baseAllowance ?? 0;
  // Allowance for the period: if single month, baseAllowance + extra; if all-time, baseAllowance * count
  const periodAllowance = useMemo(() => {
    if (baseAllowance === 0) return null;
    if (filterType === 'custom' && customMonth === 'all') {
      const monthCount = Math.max(1, availableMonths.length);
      return baseAllowance * monthCount + (stats.extraAllowance ?? 0);
    }
    if (filterType === 'current') {
      return baseAllowance + (stats.extraAllowance ?? 0);
    }
    return baseAllowance;
  }, [baseAllowance, filterType, customMonth, availableMonths.length, stats.extraAllowance]);

  const remainingAllowance =
    periodAllowance !== null ? periodAllowance - totalSpent : null;
  const spentPercentage =
    periodAllowance && periodAllowance > 0
      ? Math.min(100, Math.round((totalSpent / periodAllowance) * 100))
      : 0;

  // Trigger smooth, graceful animations whenever screen focuses or month changes
  useEffect(() => {
    // 1. Budget utilization smooth fill-up animation (900ms)
    utilizationProgressAnim.setValue(0);
    Animated.timing(utilizationProgressAnim, {
      toValue: spentPercentage,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();

    // 2. Card entrance & badge scale
    cardEntranceAnim.setValue(0);
    badgeScaleAnim.setValue(0.9);

    Animated.parallel([
      Animated.timing(cardEntranceAnim, {
        toValue: 1,
        duration: 350,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(badgeScaleAnim, {
        toValue: 1,
        friction: 7,
        tension: 50,
        useNativeDriver: true,
      }),
    ]).start();
  }, [animKey, activeMonthLabel, spentPercentage]);

  // Group expenses by title / category for the pie chart
  const segments: ChartSegment[] = useMemo(() => {
    if (filteredExpenses.length === 0 || totalSpent === 0) return [];

    const grouped: Record<
      string,
      { total: number; count: number; rawTitle: string }
    > = {};

    filteredExpenses.forEach((exp) => {
      const normalized = exp.title.trim().toLowerCase();
      if (!grouped[normalized]) {
        grouped[normalized] = {
          total: 0,
          count: 0,
          rawTitle: exp.title.trim(),
        };
      }
      grouped[normalized].total += exp.amount;
      grouped[normalized].count += 1;
    });

    const entries = Object.entries(grouped).sort(
      (a, b) => b[1].total - a[1].total,
    );

    return entries.map(([key, data], index) => ({
      key,
      label: data.rawTitle,
      amount: data.total,
      percentage: (data.total / totalSpent) * 100,
      color: PALETTE[index % PALETTE.length],
      count: data.count,
    }));
  }, [filteredExpenses, totalSpent]);

  // Expenses for the currently expanded or selected category
  const activeCategoryExpenses = useMemo(() => {
    const key = expandedCategory || selectedCategoryKey;
    if (!key) return [];
    return filteredExpenses.filter((e) => e.title.trim().toLowerCase() === key);
  }, [filteredExpenses, expandedCategory, selectedCategoryKey]);

  // Human readable label for current filter
  const filterDescription = useMemo(() => {
    if (filterType === "current") return formatMonthLabel(currentMonthLabel);
    if (filterType === "previous") return formatMonthLabel(previousMonthLabel);
    if (customMonth === "all") return "All Time History";
    return formatMonthLabel(customMonth);
  }, [filterType, currentMonthLabel, previousMonthLabel, customMonth]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.eyebrow}>ALLOWANCE DISTRIBUTION</Text>
          <Text style={styles.title}>Spending Statistics</Text>
          <Text style={styles.subtitle}>{filterDescription}</Text>
        </View>

        {/* Filter Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterBar}
        >
          <TouchableOpacity
            style={[
              styles.filterPill,
              filterType === "current" && styles.filterPillActive,
            ]}
            onPress={() => {
              setFilterType("current");
              setSelectedCategoryKey(null);
              setExpandedCategory(null);
            }}
            activeOpacity={0.75}
          >
            <Text
              style={[
                styles.filterPillText,
                filterType === "current" && styles.filterPillTextActive,
              ]}
            >
              Current Month
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterPill,
              filterType === "previous" && styles.filterPillActive,
            ]}
            onPress={() => {
              setFilterType("previous");
              setSelectedCategoryKey(null);
              setExpandedCategory(null);
            }}
            activeOpacity={0.75}
          >
            <Text
              style={[
                styles.filterPillText,
                filterType === "previous" && styles.filterPillTextActive,
              ]}
            >
              Previous Month
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterPill,
              filterType === "custom" && styles.filterPillActive,
            ]}
            onPress={() => {
              setFilterType("custom");
              setShowCustomModal(true);
            }}
            activeOpacity={0.75}
          >
            <Ionicons
              name="calendar-outline"
              size={13}
              color={
                filterType === "custom" ? "#FFFFFF" : THEME.colors.textDark
              }
            />
            <Text
              style={[
                styles.filterPillText,
                filterType === "custom" && styles.filterPillTextActive,
              ]}
            >
              Custom
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Custom filter indicator banner */}
        {filterType === "custom" && (
          <TouchableOpacity
            style={styles.customBanner}
            onPress={() => setShowCustomModal(true)}
            activeOpacity={0.8}
          >
            <View style={styles.customBannerLeft}>
              <Ionicons
                name="filter-circle"
                size={18}
                color={THEME.colors.pillDark}
              />
              <Text style={styles.customBannerText}>
                Showing:{" "}
                <Text style={styles.customBannerBold}>{filterDescription}</Text>
              </Text>
            </View>
            <Text style={styles.changeBtnText}>Change</Text>
          </TouchableOpacity>
        )}

        {/* Allowance Utilization Card */}
        {periodAllowance !== null && (
          <Animated.View
            style={[
              styles.utilizationCard,
              {
                opacity: cardEntranceAnim,
                transform: [
                  {
                    translateY: cardEntranceAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [12, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.utilizationHeader}>
              <View>
                <Text style={styles.utilizationLabel}>BUDGET UTILIZATION</Text>
                <Text style={styles.utilizationSpent}>
                  ₱ {formatCurrency(totalSpent)}{" "}
                  <Text style={styles.utilizationTotal}>
                    / ₱ {formatCurrency(periodAllowance)}
                  </Text>
                </Text>
              </View>
              <Animated.View
                style={[
                  styles.percentBadge,
                  {
                    transform: [{ scale: badgeScaleAnim }],
                  },
                ]}
              >
                <Text style={styles.percentBadgeText}>{spentPercentage}%</Text>
              </Animated.View>
            </View>

            {/* Two-tone Animated Progress Bar */}
            <View style={styles.progressBarTrack}>
              <Animated.View
                style={[
                  styles.progressBarFill,
                  {
                    width: utilizationProgressAnim.interpolate({
                      inputRange: [0, 100],
                      outputRange: ["0%", "100%"],
                      extrapolate: "clamp",
                    }),
                  },
                ]}
              />
            </View>

            <View style={styles.utilizationFooter}>
              <Text style={styles.utilizationFooterText}>
                {remainingAllowance !== null && remainingAllowance >= 0
                  ? `₱ ${formatCurrency(remainingAllowance)} remaining`
                  : `₱ ${formatCurrency(Math.abs(remainingAllowance ?? 0))} over budget`}
              </Text>
              <Text style={styles.utilizationFooterSub}>
                {filteredExpenses.length} total transactions
              </Text>
            </View>
          </Animated.View>
        )}

        {/* Pie Graph Card */}
        <Animated.View
          style={[
            styles.chartCard,
            {
              opacity: cardEntranceAnim,
              transform: [
                {
                  translateY: cardEntranceAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [16, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.chartCardHeader}>
            <Text style={styles.chartCardTitle}>Allowance Distribution</Text>
            <Text style={styles.chartCardHint}>
              {segments.length > 0
                ? "Tap slice to inspect"
                : "No expenses logged"}
            </Text>
          </View>

          <SpendingPieChart
            segments={segments}
            totalAmount={totalSpent}
            allowance={periodAllowance}
            selectedKey={selectedCategoryKey}
            onSelectSegment={(key) => {
              setSelectedCategoryKey(key);
              setExpandedCategory(key);
            }}
            size={230}
            animationKey={`${animKey}_${activeMonthLabel}`}
          />

          {segments.length === 0 && (
            <View style={styles.emptyStateBox}>
              <Ionicons
                name="pie-chart-outline"
                size={32}
                color={THEME.colors.textMuted}
              />
              <Text style={styles.emptyStateTitle}>No spending recorded</Text>
              <Text style={styles.emptyStateSub}>
                Expenses logged for this period will appear distributed here.
              </Text>
            </View>
          )}
        </Animated.View>

        {/* Category Breakdown List */}
        {segments.length > 0 && (
          <View style={styles.breakdownSection}>
            <Text style={styles.sectionHeaderTitle}>BREAKDOWN BY CATEGORY</Text>

            <View style={styles.categoryList}>
              {segments.map((seg) => {
                const isSelected = selectedCategoryKey === seg.key;
                const isExpanded = expandedCategory === seg.key;

                return (
                  <View
                    key={seg.key}
                    style={[
                      styles.categoryCard,
                      isSelected && styles.categoryCardSelected,
                    ]}
                  >
                    <TouchableOpacity
                      style={styles.categoryCardMain}
                      activeOpacity={0.7}
                      onPress={() => {
                        const next = isSelected ? null : seg.key;
                        setSelectedCategoryKey(next);
                        setExpandedCategory(isExpanded ? null : seg.key);
                      }}
                    >
                      <View
                        style={[
                          styles.colorSwatch,
                          { backgroundColor: seg.color },
                        ]}
                      >
                        <Ionicons
                          name="pricetag-outline"
                          size={14}
                          color="#FFFFFF"
                        />
                      </View>

                      <View style={styles.categoryInfo}>
                        <Text style={styles.categoryTitle}>{seg.label}</Text>
                        <Text style={styles.categoryCount}>
                          {seg.count}{" "}
                          {seg.count === 1 ? "transaction" : "transactions"}
                        </Text>
                      </View>

                      <View style={styles.categoryAmountGroup}>
                        <Text style={styles.categoryAmount}>
                          ₱ {formatCurrency(seg.amount)}
                        </Text>
                        <Text style={styles.categoryPercent}>
                          {seg.percentage.toFixed(1)}%
                        </Text>
                      </View>

                      <Ionicons
                        name={isExpanded ? "chevron-up" : "chevron-down"}
                        size={16}
                        color={THEME.colors.textSecondary}
                        style={{ marginLeft: 6 }}
                      />
                    </TouchableOpacity>

                    {/* Proportional Mini Bar */}
                    <View style={styles.categoryBarTrack}>
                      <View
                        style={[
                          styles.categoryBarFill,
                          {
                            width: `${Math.max(4, seg.percentage)}%`,
                            backgroundColor: seg.color,
                          },
                        ]}
                      />
                    </View>

                    {/* Expanded individual transactions in category */}
                    {isExpanded && activeCategoryExpenses.length > 0 && (
                      <View style={styles.expandedList}>
                        <Text style={styles.expandedHeading}>
                          Expenses in this category:
                        </Text>
                        {activeCategoryExpenses.map((exp) => (
                          <View key={exp.id} style={styles.expandedItem}>
                            <View>
                              <Text style={styles.expandedItemDate}>
                                {formatDateShort(exp.date)}
                              </Text>
                            </View>
                            <Text style={styles.expandedItemAmount}>
                              ₱ {formatCurrency(exp.amount)}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Custom Month Picker Modal */}
      <Modal
        visible={showCustomModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCustomModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowCustomModal(false)}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Select Time Period</Text>
            <Text style={styles.modalSub}>
              Choose a month to view its spending distribution.
            </Text>

            <ScrollView
              style={styles.modalScroll}
              showsVerticalScrollIndicator={false}
            >
              <TouchableOpacity
                style={[
                  styles.modalOption,
                  filterType === "custom" &&
                    customMonth === "all" &&
                    styles.modalOptionActive,
                ]}
                onPress={() => {
                  setFilterType("custom");
                  setCustomMonth("all");
                  setShowCustomModal(false);
                  setSelectedCategoryKey(null);
                  setExpandedCategory(null);
                }}
              >
                <View style={styles.modalOptionLeft}>
                  <Ionicons
                    name="infinite-outline"
                    size={18}
                    color={THEME.colors.textDark}
                  />
                  <Text style={styles.modalOptionText}>All Time History</Text>
                </View>
                {filterType === "custom" && customMonth === "all" && (
                  <Ionicons
                    name="checkmark-circle"
                    size={18}
                    color={THEME.colors.pillDark}
                  />
                )}
              </TouchableOpacity>

              {availableMonths.map((month) => {
                const isSelected =
                  filterType === "custom" && customMonth === month;
                const isCurrent = month === currentMonthLabel;

                return (
                  <TouchableOpacity
                    key={month}
                    style={[
                      styles.modalOption,
                      isSelected && styles.modalOptionActive,
                    ]}
                    onPress={() => {
                      setFilterType("custom");
                      setCustomMonth(month);
                      setShowCustomModal(false);
                      setSelectedCategoryKey(null);
                      setExpandedCategory(null);
                    }}
                  >
                    <View style={styles.modalOptionLeft}>
                      <Ionicons
                        name="calendar-outline"
                        size={18}
                        color={THEME.colors.textDark}
                      />
                      <Text style={styles.modalOptionText}>
                        {formatMonthLabel(month)}
                      </Text>
                      {isCurrent && (
                        <View style={styles.currentMonthBadge}>
                          <Text style={styles.currentMonthBadgeText}>
                            CURRENT
                          </Text>
                        </View>
                      )}
                    </View>
                    {isSelected && (
                      <Ionicons
                        name="checkmark-circle"
                        size={18}
                        color={THEME.colors.pillDark}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowCustomModal(false)}
            >
              <Text style={styles.modalCloseButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: THEME.colors.background },
  content: {
    padding: 20,
    paddingBottom: 40,
    gap: 16,
  },
  header: { marginTop: 4 },
  eyebrow: {
    color: THEME.colors.textMuted,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
  },
  title: {
    color: THEME.colors.textDark,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.6,
    marginTop: 3,
  },
  subtitle: {
    color: THEME.colors.textSecondary,
    fontSize: 14,
    fontWeight: "600",
    marginTop: 2,
  },
  filterBar: {
    flexDirection: "row",
    gap: 8,
  },
  filterPill: {
    alignItems: "center",
    backgroundColor: THEME.colors.white,
    borderColor: "#E2E8F0",
    borderRadius: THEME.radius.full,
    borderWidth: 1,
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  filterPillActive: {
    backgroundColor: THEME.colors.pillDark,
    borderColor: THEME.colors.pillDark,
  },
  filterPillText: {
    color: THEME.colors.textDark,
    fontSize: 13,
    fontWeight: "700",
  },
  filterPillTextActive: {
    color: "#FFFFFF",
  },
  customBanner: {
    alignItems: "center",
    backgroundColor: "#E0E7FF",
    borderRadius: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  customBannerLeft: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  customBannerText: {
    color: THEME.colors.textDark,
    fontSize: 13,
  },
  customBannerBold: {
    fontWeight: "800",
  },
  changeBtnText: {
    color: "#4F46E5",
    fontSize: 12,
    fontWeight: "800",
  },
  utilizationCard: {
    backgroundColor: THEME.colors.mintCard,
    borderRadius: THEME.radius.card,
    padding: 20,
    ...THEME.shadow.soft,
  },
  utilizationHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  utilizationLabel: {
    color: THEME.colors.textDark,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    opacity: 0.6,
  },
  utilizationSpent: {
    color: THEME.colors.textDark,
    fontSize: 26,
    fontWeight: "800",
    marginTop: 4,
  },
  utilizationTotal: {
    color: THEME.colors.textSecondary,
    fontSize: 15,
    fontWeight: "600",
  },
  percentBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.65)",
    borderRadius: THEME.radius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  percentBadgeText: {
    color: THEME.colors.textDark,
    fontSize: 14,
    fontWeight: "800",
  },
  progressBarTrack: {
    backgroundColor: "rgba(15, 23, 42, 0.1)",
    borderRadius: 6,
    height: 10,
    marginVertical: 14,
    overflow: "hidden",
    width: "100%",
  },
  progressBarFill: {
    backgroundColor: THEME.colors.pillDark,
    borderRadius: 6,
    height: "100%",
  },
  utilizationFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  utilizationFooterText: {
    color: THEME.colors.textDark,
    fontSize: 13,
    fontWeight: "700",
  },
  utilizationFooterSub: {
    color: THEME.colors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
  },
  chartCard: {
    backgroundColor: THEME.colors.white,
    borderColor: "#E2E8F0",
    borderRadius: THEME.radius.card,
    borderWidth: 1,
    padding: 20,
    ...THEME.shadow.soft,
  },
  chartCardHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  chartCardTitle: {
    color: THEME.colors.textDark,
    fontSize: 16,
    fontWeight: "800",
  },
  chartCardHint: {
    color: THEME.colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  emptyStateBox: {
    alignItems: "center",
    marginTop: 10,
    paddingVertical: 14,
  },
  emptyStateTitle: {
    color: THEME.colors.textDark,
    fontSize: 15,
    fontWeight: "800",
    marginTop: 8,
  },
  emptyStateSub: {
    color: THEME.colors.textSecondary,
    fontSize: 12,
    marginTop: 4,
    textAlign: "center",
  },
  breakdownSection: {
    marginTop: 4,
  },
  sectionHeaderTitle: {
    color: THEME.colors.textMuted,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 10,
  },
  categoryList: {
    gap: 10,
  },
  categoryCard: {
    backgroundColor: THEME.colors.white,
    borderColor: "#E2E8F0",
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    overflow: "hidden",
    padding: 14,
  },
  categoryCardSelected: {
    borderColor: THEME.colors.pillDark,
    borderWidth: 1.5,
  },
  categoryCardMain: {
    alignItems: "center",
    flexDirection: "row",
  },
  colorSwatch: {
    alignItems: "center",
    borderRadius: 10,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  categoryInfo: {
    flex: 1,
    marginLeft: 12,
  },
  categoryTitle: {
    color: THEME.colors.textDark,
    fontSize: 15,
    fontWeight: "800",
  },
  categoryCount: {
    color: THEME.colors.textMuted,
    fontSize: 12,
    marginTop: 1,
  },
  categoryAmountGroup: {
    alignItems: "flex-end",
  },
  categoryAmount: {
    color: THEME.colors.textDark,
    fontSize: 15,
    fontWeight: "800",
  },
  categoryPercent: {
    color: THEME.colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 1,
  },
  categoryBarTrack: {
    backgroundColor: "#F1F5F9",
    borderRadius: 3,
    height: 6,
    marginTop: 10,
    overflow: "hidden",
    width: "100%",
  },
  categoryBarFill: {
    borderRadius: 3,
    height: "100%",
  },
  expandedList: {
    borderTopColor: "#F1F5F9",
    borderTopWidth: 1,
    marginTop: 12,
    paddingTop: 10,
  },
  expandedHeading: {
    color: THEME.colors.textMuted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  expandedItem: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
  },
  expandedItemDate: {
    color: THEME.colors.textSecondary,
    fontSize: 13,
  },
  expandedItemAmount: {
    color: THEME.colors.textDark,
    fontSize: 13,
    fontWeight: "700",
  },
  modalOverlay: {
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    flex: 1,
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: THEME.colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "65%",
    padding: 24,
    width: "100%",
  },
  modalHandle: {
    alignSelf: "center",
    backgroundColor: "#CBD5E1",
    borderRadius: 3,
    height: 5,
    marginBottom: 16,
    width: 44,
  },
  modalTitle: {
    color: THEME.colors.textDark,
    fontSize: 20,
    fontWeight: "800",
  },
  modalSub: {
    color: THEME.colors.textSecondary,
    fontSize: 13,
    marginBottom: 16,
    marginTop: 4,
  },
  modalScroll: {
    maxHeight: 280,
  },
  modalOption: {
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  modalOptionActive: {
    backgroundColor: "#EEF2FF",
    borderColor: "#818CF8",
    borderWidth: 1,
  },
  modalOptionLeft: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  modalOptionText: {
    color: THEME.colors.textDark,
    fontSize: 15,
    fontWeight: "700",
  },
  currentMonthBadge: {
    backgroundColor: THEME.colors.pillDark,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  currentMonthBadgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "800",
  },
  modalCloseButton: {
    alignItems: "center",
    backgroundColor: THEME.colors.pillDark,
    borderRadius: THEME.radius.full,
    marginTop: 14,
    paddingVertical: 14,
  },
  modalCloseButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
});

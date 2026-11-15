import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import AddMoneyModal from '@/components/AddMoneyModal';
import BalanceHeroCard from '@/components/BalanceHeroCard';
import ExpenseForm from '@/components/ExpenseForm';
import ExpenseItem from '@/components/ExpenseItem';
import SavingsCard from '@/components/SavingsCard';
import SavingsHistoryModal from '@/components/SavingsHistoryModal';
import { THEME } from '@/constants/theme';
import { useFinanceStore } from '@/store/useFinanceStore';
import {
  formatCurrency,
  formatFullDate,
  formatMonthLabel,
  getDateKey,
  getMonthLabel,
  getMonthWeeks,
  getWeekNumberInMonth,
  parseDateKey,
} from '@/utils/dates';

type DashboardView = 'day' | 'weeks';

function getWeekDayKeys(dateKey: string): string[] {
  const monthLabel = getMonthLabel(dateKey);
  const week = getMonthWeeks(monthLabel).find(
    (candidate) => candidate.weekNumber === getWeekNumberInMonth(dateKey)
  );
  const start = week ? parseDateKey(week.startDate) : null;
  const end = week ? parseDateKey(week.endDate) : null;
  if (!start || !end || !week) return [dateKey];

  const result: string[] = [];
  const current = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endDay = end.getDate();

  while (current.getDate() <= endDay && current.getMonth() === start.getMonth()) {
    result.push(getDateKey(current));
    current.setDate(current.getDate() + 1);
  }

  return result.length > 0 ? result : [dateKey];
}

function WheelPagination({
  total,
  scrollX,
  dayCardWidth,
  onSelectIndex,
}: {
  total: number;
  scrollX: Animated.Value;
  dayCardWidth: number;
  onSelectIndex: (index: number) => void;
}) {
  // Window displays 3 dots centered inside a 56px container with 8px margins on both sides
  // Dot width: 8, gap: 8 => step = 16
  // 3 dots span 40px: slot 0 at 8px, slot 1 (center) at 24px, slot 2 at 40px (ends at 48px, with 8px margin before container edge)
  const getTargetX = (pageIndex: number) => {
    const startIndex = Math.max(0, Math.min(pageIndex <= 1 ? 0 : pageIndex - 1, total - 3));
    return 4 - startIndex * 16;
  };

  const inputRange = Array.from({ length: total }, (_, i) => i * dayCardWidth);
  const outputRange = Array.from({ length: total }, (_, i) => getTargetX(i));

  const wheelTranslateX = scrollX.interpolate({
    inputRange,
    outputRange,
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.wheelContainer}>
      <Animated.View
        style={[
          styles.wheelTrack,
          {
            transform: [{ translateX: wheelTranslateX }],
          },
        ]}
      >
        {Array.from({ length: total }, (_, i) => {
          const darkOpacity = scrollX.interpolate({
            inputRange: [
              (i - 1) * dayCardWidth,
              i * dayCardWidth,
              (i + 1) * dayCardWidth,
            ],
            outputRange: [0, 1, 0],
            extrapolate: 'clamp',
          });

          const dotOpacity = scrollX.interpolate({
            inputRange: [
              (i - 2) * dayCardWidth,
              (i - 1) * dayCardWidth,
              i * dayCardWidth,
              (i + 1) * dayCardWidth,
              (i + 2) * dayCardWidth,
            ],
            outputRange: [0.3, 0.65, 1.0, 0.65, 0.3],
            extrapolate: 'clamp',
          });

          return (
            <TouchableOpacity
              key={i}
              onPress={() => onSelectIndex(i)}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 6, right: 6 }}
              accessibilityLabel={`Day ${i + 1}`}
            >
              <Animated.View
                style={[
                  styles.wheelDotBase,
                  {
                    opacity: dotOpacity,
                  },
                ]}
              >
                <View style={styles.wheelDotLight} />
                <Animated.View
                  style={[
                    styles.wheelDotDark,
                    {
                      opacity: darkOpacity,
                    },
                  ]}
                />
              </Animated.View>
            </TouchableOpacity>
          );
        })}
      </Animated.View>
    </View>
  );
}

export default function Dashboard() {
  const { stats, expenses, savingsHistory, addExpense, addMoney, deleteExpense, isLoaded, checkAndAdvanceMonth } =
    useFinanceStore();
  const [view, setView] = useState<DashboardView>('day');

  // Verify and auto-advance month when user focuses on the ledger screen
  useFocusEffect(
    useCallback(() => {
      checkAndAdvanceMonth();
    }, [checkAndAdvanceMonth])
  );
  const [selectedDate, setSelectedDate] = useState(getDateKey());
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showAddMoney, setShowAddMoney] = useState(false);
  const [showSavingsModal, setShowSavingsModal] = useState(false);
  const dayPagerRef = useRef<any>(null);
  const isManualNavigationRef = useRef(false);
  const isDraggingRef = useRef(false);
  const scrollX = useRef(new Animated.Value(0)).current;
  const { width: screenWidth } = useWindowDimensions();
  const dayCardWidth = screenWidth - 40;

  const baseAllowance = stats.baseAllowance;
  const currentRemaining = stats.currentRemaining;
  const totalBank = stats.totalBank;
  const isConfigured = Boolean(
    stats.bankName &&
      baseAllowance !== null &&
      currentRemaining !== null &&
      totalBank !== null
  );

  const selectedDateInfo = parseDateKey(selectedDate);
  const selectedDayName = selectedDateInfo?.toLocaleDateString('en-US', { weekday: 'long' }) ?? '';
  const selectedWeek = getWeekNumberInMonth(selectedDate);
  const weeks = useMemo(() => getMonthWeeks(stats.currentMonthLabel), [stats.currentMonthLabel]);
  const weekDayKeys = useMemo(() => getWeekDayKeys(selectedDate), [selectedDate]);
  const selectedDayIndex = Math.max(0, weekDayKeys.indexOf(selectedDate));

  const scrollToDay = (index: number) => {
    const clampedIndex = Math.max(0, Math.min(index, weekDayKeys.length - 1));
    const nextDate = weekDayKeys[clampedIndex];
    if (nextDate) {
      isManualNavigationRef.current = true;
      setSelectedDate(nextDate);
      dayPagerRef.current?.scrollTo({ x: clampedIndex * dayCardWidth, animated: true });
    }
  };

  const handleScrollEnd = (offsetX: number) => {
    const index = Math.round(offsetX / dayCardWidth);
    const clampedIndex = Math.max(0, Math.min(index, weekDayKeys.length - 1));
    const nextDate = weekDayKeys[clampedIndex];
    if (nextDate && nextDate !== selectedDate) {
      setSelectedDate(nextDate);
    }
  };

  const dayExpenses = useMemo(
    () =>
      expenses
        .filter((expense) => expense.date === selectedDate)
        .sort((a, b) => b.id.localeCompare(a.id)),
    [expenses, selectedDate]
  );
  const dayTotal = dayExpenses.reduce((total, expense) => total + expense.amount, 0);

  useEffect(() => {
    if (getMonthLabel(selectedDate) !== stats.currentMonthLabel) {
      const today = getDateKey();
      if (getMonthLabel(today) === stats.currentMonthLabel) {
        setSelectedDate(today);
      } else {
        setSelectedDate(`${stats.currentMonthLabel}-01`);
      }
    }
  }, [stats.currentMonthLabel]);

  useEffect(() => {
    if (view === 'day') {
      scrollX.setValue(selectedDayIndex * dayCardWidth);
      if (isDraggingRef.current || isManualNavigationRef.current) {
        isManualNavigationRef.current = false;
        return;
      }
      const targetX = selectedDayIndex * dayCardWidth;
      dayPagerRef.current?.scrollTo({ x: targetX, animated: false });
      const timer = setTimeout(() => {
        if (!isDraggingRef.current) {
          dayPagerRef.current?.scrollTo({ x: targetX, animated: false });
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [view, selectedDayIndex, dayCardWidth]);

  if (!isLoaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={THEME.colors.pillDark} />
      </View>
    );
  }

  if (!isConfigured || baseAllowance === null || currentRemaining === null || totalBank === null) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.setupContent}>
          <View style={styles.setupIcon}>
            <Ionicons name="wallet-outline" size={32} color={THEME.colors.pillDark} />
          </View>
          <Text style={styles.setupTitle}>Set up your ledger</Text>
          <Text style={styles.setupText}>
            Add your monthly allowance, savings account name, and current savings balance to begin.
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.push('/settings')}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>Set up budget</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const showDay = () => {
    isManualNavigationRef.current = false;
    setSelectedDate(getDateKey());
    setView('day');
  };

  if (view === 'weeks') {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <BalanceHeroCard
            monthLabel={stats.currentMonthLabel}
            currentRemaining={currentRemaining}
            baseAllowance={baseAllowance}
            extraAllowance={stats.extraAllowance ?? 0}
            onAddMoney={() => setShowAddMoney(true)}
          />

          <View style={styles.weeksHeader}>
            <View>
              <Text style={styles.eyebrow}>MONTH OVERVIEW</Text>
              <Text style={styles.monthTitle}>{formatMonthLabel(stats.currentMonthLabel)}</Text>
            </View>
            <TouchableOpacity style={styles.todayButton} onPress={showDay} activeOpacity={0.7}>
              <Ionicons name="today-outline" size={16} color={THEME.colors.textDark} />
              <Text style={styles.todayButtonText}>Today</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.weekList}>
            {weeks.map((week) => {
              const weekExpenses = expenses.filter(
                (expense) => expense.date >= week.startDate && expense.date <= week.endDate
              );
              const weekTotal = weekExpenses.reduce((total, expense) => total + expense.amount, 0);
              const isCurrentWeek =
                getMonthLabel(selectedDate) === stats.currentMonthLabel &&
                selectedWeek === week.weekNumber;

              return (
                <TouchableOpacity
                  key={week.weekNumber}
                  style={[styles.weekCard, isCurrentWeek && styles.weekCardCurrent]}
                  onPress={() => {
                    isManualNavigationRef.current = false;
                    setSelectedDate(week.startDate);
                    setView('day');
                  }}
                  activeOpacity={0.8}
                >
                  <View style={[styles.weekIcon, isCurrentWeek && styles.weekIconCurrent]}>
                    <Ionicons name="calendar-outline" size={20} color={THEME.colors.textDark} />
                  </View>
                  <View style={styles.weekDetails}>
                    <Text style={styles.weekTitle}>Week {week.weekNumber}</Text>
                    <Text style={styles.weekRange}>{week.dateRange}</Text>
                  </View>
                  <View style={styles.weekAmount}>
                    <Text style={styles.weekAmountLabel}>SPENT</Text>
                    <Text style={styles.weekAmountValue}>₱ {formatCurrency(weekTotal)}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={THEME.colors.textSecondary} />
                </TouchableOpacity>
              );
            })}
          </View>

          <SavingsCard
            bankName={stats.bankName}
            totalSavings={totalBank ?? 0}
            onPress={() => setShowSavingsModal(true)}
          />
        </ScrollView>

        {showAddMoney && (
          <AddMoneyModal
            visible
            currentRemaining={currentRemaining}
            onAdd={(amount, note) => {
              const result = addMoney(amount, note);
              if (!result.ok && result.message) {
                Alert.alert('Cannot add money', result.message);
              }
            }}
            onClose={() => setShowAddMoney(false)}
          />
        )}

        {showSavingsModal && (
          <SavingsHistoryModal
            visible
            bankName={stats.bankName}
            totalSavings={totalBank ?? 0}
            baseAllowance={baseAllowance}
            history={savingsHistory}
            onClose={() => setShowSavingsModal(false)}
          />
        )}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <BalanceHeroCard
          monthLabel={stats.currentMonthLabel}
          currentRemaining={currentRemaining}
          baseAllowance={baseAllowance}
          extraAllowance={stats.extraAllowance ?? 0}
          onAddMoney={() => setShowAddMoney(true)}
        />

        <View style={styles.dayNavRow}>
          <View style={styles.dayNavTitleGroup}>
            <Text style={styles.weekLabel}>Week {selectedWeek}</Text>
            <Text style={styles.dateLabel}>{formatFullDate(selectedDate)}</Text>
          </View>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setView('weeks')}
            activeOpacity={0.75}
          >
            <Ionicons name="arrow-back" size={16} color={THEME.colors.textDark} />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.cardPagerWrapper}>
          <Animated.ScrollView
            ref={dayPagerRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            contentOffset={{ x: selectedDayIndex * dayCardWidth, y: 0 }}
            onContentSizeChange={() => {
              if (!isDraggingRef.current && !isManualNavigationRef.current) {
                dayPagerRef.current?.scrollTo({
                  x: selectedDayIndex * dayCardWidth,
                  animated: false,
                });
              }
            }}
            onScrollBeginDrag={() => {
              isDraggingRef.current = true;
              isManualNavigationRef.current = true;
            }}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { x: scrollX } } }],
              {
                useNativeDriver: true,
                listener: (event: any) => {
                  const offsetX = event.nativeEvent.contentOffset.x;
                  const index = Math.round(offsetX / dayCardWidth);
                  const clampedIndex = Math.max(0, Math.min(index, weekDayKeys.length - 1));
                  const nextDate = weekDayKeys[clampedIndex];
                  if (nextDate && nextDate !== selectedDate) {
                    isManualNavigationRef.current = true;
                    setSelectedDate(nextDate);
                  }
                },
              }
            )}
            onMomentumScrollEnd={(event) => {
              isDraggingRef.current = false;
              isManualNavigationRef.current = true;
              handleScrollEnd(event.nativeEvent.contentOffset.x);
            }}
            onScrollEndDrag={(event) => {
              isDraggingRef.current = false;
              isManualNavigationRef.current = true;
              handleScrollEnd(event.nativeEvent.contentOffset.x);
            }}
          >
            {weekDayKeys.map((dateKey) => {
              const date = parseDateKey(dateKey);
              const dayName = date?.toLocaleDateString('en-US', { weekday: 'long' }) ?? '';
              const expensesForDay = expenses
                .filter((expense) => expense.date === dateKey)
                .sort((a, b) => b.id.localeCompare(a.id));

              return (
                <View
                  key={dateKey}
                  style={[styles.dailyCard, { width: dayCardWidth }]}
                >
                  <View style={styles.dailyCardHeader}>
                    <View>
                      <View style={styles.dayTitleRow}>
                        <Text style={styles.dayName}>{dayName}</Text>
                        {dateKey === getDateKey() && (
                          <View style={styles.todayBadge}>
                            <Text style={styles.todayBadgeText}>TODAY</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.daySubtitle}>Expenses for this date</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.addIconButton}
                      onPress={() => {
                        setSelectedDate(dateKey);
                        setShowAddExpense(true);
                      }}
                      accessibilityLabel={`Add expense for ${dayName}`}
                    >
                      <Ionicons name="add" size={22} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>

                  {expensesForDay.length === 0 ? (
                    <TouchableOpacity
                      style={styles.emptyDay}
                      onPress={() => {
                        setSelectedDate(dateKey);
                        setShowAddExpense(true);
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="receipt-outline" size={28} color={THEME.colors.textMuted} />
                      <Text style={styles.emptyDayTitle}>No expenses yet</Text>
                      <Text style={styles.emptyDayText}>Tap to add an expense for {dayName}.</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.expenseList}>
                      {expensesForDay.map((expense) => (
                        <ExpenseItem key={expense.id} expense={expense} onDelete={deleteExpense} />
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </Animated.ScrollView>
        </View>

        {/* 3-Dot Wheel Pagination Indicator */}
        <WheelPagination
          total={weekDayKeys.length}
          scrollX={scrollX}
          dayCardWidth={dayCardWidth}
          onSelectIndex={scrollToDay}
        />

        <View style={styles.totalBar}>
          <View style={styles.totalLabelGroup}>
            <View style={styles.totalIcon}>
              <Ionicons name="receipt-outline" size={18} color="#B45309" />
            </View>
            <Text style={styles.totalLabel}>Total</Text>
          </View>
          <Text style={styles.totalAmount}>₱ {formatCurrency(dayTotal)}</Text>
        </View>

        <SavingsCard
          bankName={stats.bankName}
          totalSavings={totalBank ?? 0}
          onPress={() => setShowSavingsModal(true)}
        />
      </ScrollView>

      {showAddExpense && (
        <Modal
          visible
          animationType="slide"
          transparent
          onRequestClose={() => setShowAddExpense(false)}
        >
          <ExpenseForm
            defaultDate={selectedDate}
            currentMonthLabel={stats.currentMonthLabel}
            onSubmit={(title, amount, date) => {
              const result = addExpense(title, amount, date);
              if (!result.ok) {
                Alert.alert('Cannot add expense', result.message);
                return; // keep the sheet open
              }
              setShowAddExpense(false);
            }}
            onCancel={() => setShowAddExpense(false)}
          />
        </Modal>
      )}

      {showAddMoney && (
        <AddMoneyModal
          visible
          currentRemaining={currentRemaining}
          onAdd={(amount, note) => {
            const result = addMoney(amount, note);
            if (!result.ok && result.message) {
              Alert.alert('Cannot add money', result.message);
            }
          }}
          onClose={() => setShowAddMoney(false)}
        />
      )}

      {showSavingsModal && (
        <SavingsHistoryModal
          visible
          bankName={stats.bankName}
          totalSavings={totalBank ?? 0}
          baseAllowance={baseAllowance}
          history={savingsHistory}
          onClose={() => setShowSavingsModal(false)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: THEME.colors.background },
  loading: {
    alignItems: 'center',
    backgroundColor: THEME.colors.background,
    flex: 1,
    justifyContent: 'center',
  },
  content: { gap: 20, padding: 20, paddingBottom: 40 },
  dayNavRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  dayNavTitleGroup: { flex: 1, marginRight: 12 },
  weekLabel: { color: THEME.colors.textDark, fontSize: 25, fontWeight: '800' },
  dateLabel: { color: THEME.colors.textSecondary, fontSize: 14, fontWeight: '600', marginTop: 2 },
  backButton: {
    alignItems: 'center',
    backgroundColor: THEME.colors.white,
    borderColor: '#CBD5E1',
    borderRadius: THEME.radius.full,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  backButtonText: { color: THEME.colors.textDark, fontSize: 14, fontWeight: '800' },
  cardPagerWrapper: {
    justifyContent: 'center',
    position: 'relative',
  },
  wheelContainer: {
    alignSelf: 'center',
    height: 24,
    justifyContent: 'center',
    marginBottom: 4,
    marginTop: -2,
    overflow: 'hidden',
    width: 56,
  },
  wheelTrack: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 24,
  },
  wheelDotBase: {
    borderRadius: 4,
    height: 8,
    marginHorizontal: 4,
    overflow: 'hidden',
    position: 'relative',
    width: 8,
  },
  wheelDotLight: {
    backgroundColor: '#CBD5E1',
    borderRadius: 4,
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  wheelDotDark: {
    backgroundColor: THEME.colors.pillDark,
    borderRadius: 4,
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  dailyCard: {
    backgroundColor: '#E9EDF2',
    borderRadius: THEME.radius.xl,
    minHeight: 300,
    padding: 20,
  },
  dailyCardHeader: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between' },
  dayTitleRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  dayName: { color: THEME.colors.textDark, fontSize: 30, fontWeight: '800' },
  todayBadge: {
    backgroundColor: THEME.colors.pillDark,
    borderRadius: THEME.radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  todayBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  daySubtitle: { color: THEME.colors.textSecondary, fontSize: 13, marginTop: 2 },
  addIconButton: {
    alignItems: 'center',
    backgroundColor: THEME.colors.pillDark,
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  emptyDay: { alignItems: 'center', flex: 1, justifyContent: 'center', paddingVertical: 70 },
  emptyDayTitle: { color: THEME.colors.textDark, fontSize: 17, fontWeight: '800', marginTop: 10 },
  emptyDayText: { color: THEME.colors.textSecondary, fontSize: 13, marginTop: 4, textAlign: 'center' },
  expenseList: { marginTop: 18 },
  totalBar: {
    alignItems: 'center',
    backgroundColor: THEME.colors.cardLavender,
    borderRadius: THEME.radius.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  totalLabelGroup: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  totalIcon: {
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  totalLabel: { color: THEME.colors.textDark, fontSize: 18, fontWeight: '800' },
  totalAmount: { color: THEME.colors.textDark, fontSize: 22, fontWeight: '800' },
  weeksHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  eyebrow: { color: THEME.colors.textMuted, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  monthTitle: { color: THEME.colors.textDark, fontSize: 26, fontWeight: '800', marginTop: 4 },
  todayButton: {
    alignItems: 'center',
    backgroundColor: THEME.colors.white,
    borderColor: '#E2E8F0',
    borderRadius: THEME.radius.full,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  todayButtonText: { color: THEME.colors.textDark, fontSize: 13, fontWeight: '800' },
  weekList: { gap: 10 },
  weekCard: {
    alignItems: 'center',
    backgroundColor: THEME.colors.white,
    borderColor: '#E2E8F0',
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    padding: 16,
  },
  weekCardCurrent: { backgroundColor: THEME.colors.mintCard, borderColor: '#A7F3D0' },
  weekIcon: {
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  weekIconCurrent: {
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
  },
  weekDetails: { flex: 1 },
  weekTitle: { color: THEME.colors.textDark, fontSize: 17, fontWeight: '800' },
  weekRange: { color: THEME.colors.textSecondary, fontSize: 13, marginTop: 2 },
  weekAmount: { alignItems: 'flex-end' },
  weekAmountLabel: { color: THEME.colors.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  weekAmountValue: { color: THEME.colors.textDark, fontSize: 15, fontWeight: '800', marginTop: 2 },
  setupContent: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: 32 },
  setupIcon: {
    alignItems: 'center',
    backgroundColor: THEME.colors.mintCard,
    borderRadius: 40,
    height: 80,
    justifyContent: 'center',
    width: 80,
  },
  setupTitle: { color: THEME.colors.textDark, fontSize: 26, fontWeight: '800', marginTop: 22 },
  setupText: {
    color: THEME.colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
    textAlign: 'center',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: THEME.colors.pillDark,
    borderRadius: THEME.radius.full,
    flexDirection: 'row',
    gap: 8,
    marginTop: 24,
    paddingHorizontal: 22,
    paddingVertical: 15,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});
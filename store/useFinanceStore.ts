import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  FinanceState,
  UserStats,
  Expense,
  AddExpenseResult,
  SavingsRecord,
  ExtraMoneyRecord,
  Subscription,
  AddSubscriptionResult,
} from '@/types';
import {
  formatMonthLabel,
  getDateKey,
  getMonthLabel,
  getNextMonthLabel,
  isAfterMonth,
  toDateKey,
} from '@/utils/dates';
import * as Crypto from 'expo-crypto';

const STATS_KEY = '@pocketledger_stats_v2';
const EXPENSES_KEY = '@pocketledger_expenses_v2';
const SAVINGS_HISTORY_KEY = '@pocketledger_savings_history_v2';
const SUBSCRIPTIONS_KEY = '@pennywise_subscriptions_v1';
const TERMS_KEY = '@pennywise_terms_accepted_v1';

const DEFAULT_STATS: UserStats = {
  bankName: '',
  baseAllowance: null,
  extraAllowance: 0,
  extraMoneyHistory: [],
  rolloverInProgressFromMonth: undefined,
  currentRemaining: null,
  totalBank: null,
  currentMonthLabel: getMonthLabel(),
};

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function isValidAmount(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isValidMonthLabel(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);
  return Boolean(match);
}

function safeParseJSON<T>(raw: string | null, fallback: T, label: string): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    console.warn(`Malformed JSON in ${label}; falling back to default:`, error);
    return fallback;
  }
}

function getLastDayOfMonthKey(monthLabel: string): string {
  const [year, month] = monthLabel.split('-').map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return `${monthLabel}-${String(lastDay).padStart(2, '0')}`;
}

function calculateRemaining(stats: UserStats, expenses: Expense[]): number | null {
  if (stats.baseAllowance === null) return null;

  const totalBudget = roundMoney(stats.baseAllowance + (stats.extraAllowance ?? 0));

  const spent = expenses
    .filter((expense) => expense.monthLabel === stats.currentMonthLabel)
    .reduce((sum, expense) => sum + expense.amount, 0);

  return roundMoney(totalBudget - spent);
}

function applySubscriptionExpenses(
  subscriptions: Subscription[],
  expenses: Expense[],
  monthLabel: string
): Expense[] {
  const existing = new Set(
    expenses
      .filter((expense) => expense.subscriptionId)
      .map((expense) => `${expense.subscriptionId}:${expense.monthLabel}`)
  );
  const recurringExpenses = subscriptions
    .filter(
      (subscription) =>
        subscription.startMonth <= monthLabel &&
        (!subscription.cancelledFromMonth ||
          monthLabel < subscription.cancelledFromMonth) &&
        !existing.has(`${subscription.id}:${monthLabel}`)
    )
    .map(
      (subscription): Expense => ({
        id: `sub_${subscription.id}_${monthLabel}`,
        title: subscription.name,
        amount: subscription.amount,
        date: `${monthLabel}-01`,
        monthLabel,
        subscriptionId: subscription.id,
      })
    );

  return recurringExpenses.length > 0 ? [...recurringExpenses, ...expenses] : expenses;
}

function advanceMonthsIfNeeded(
  currentStats: UserStats,
  expenses: Expense[],
  history: SavingsRecord[] = [],
  subscriptions: Subscription[] = []
): { stats: UserStats; history: SavingsRecord[]; expenses: Expense[]; changed: boolean } {
  const targetMonth = getMonthLabel();
  let currentMonth = currentStats.currentMonthLabel;
  let updatedExpenses = expenses;

  if (!isAfterMonth(targetMonth, currentMonth)) {
    updatedExpenses = applySubscriptionExpenses(subscriptions, updatedExpenses, currentMonth);
    const updatedStats =
      updatedExpenses === expenses
        ? currentStats
        : { ...currentStats, currentRemaining: calculateRemaining(currentStats, updatedExpenses) };
    return { stats: updatedStats, history, expenses: updatedExpenses, changed: false };
  }

  let totalBank = currentStats.totalBank;
  let newHistory = [...history];

  while (isAfterMonth(targetMonth, currentMonth)) {
    updatedExpenses = applySubscriptionExpenses(subscriptions, updatedExpenses, currentMonth);
    if (currentStats.baseAllowance !== null && totalBank !== null) {
      const monthExpenses = updatedExpenses.filter((e) => e.monthLabel === currentMonth);
      const spent = roundMoney(monthExpenses.reduce((sum, e) => sum + e.amount, 0));
      const monthBudget = roundMoney(
        currentStats.baseAllowance +
          (currentMonth === currentStats.currentMonthLabel ? (currentStats.extraAllowance ?? 0) : 0)
      );
      const surplus = roundMoney(Math.max(0, monthBudget - spent));
      totalBank = roundMoney(totalBank + surplus);

      const record: SavingsRecord = {
        id: `sav_${currentMonth}_${Date.now()}`,
        monthLabel: currentMonth,
        date: getLastDayOfMonthKey(currentMonth),
        budget: monthBudget,
        spent,
        rolloverAmount: surplus,
        newTotalSavings: totalBank,
        note: `Rollover savings from ${formatMonthLabel(currentMonth)}`,
      };
      newHistory = [record, ...newHistory.filter((h) => h.monthLabel !== currentMonth)];
    }
    currentMonth = getNextMonthLabel(currentMonth);
  }

  updatedExpenses = applySubscriptionExpenses(subscriptions, updatedExpenses, currentMonth);
  const updatedStats: UserStats = {
    ...currentStats,
    totalBank,
    extraAllowance: 0,
    extraMoneyHistory: [],
    currentMonthLabel: currentMonth,
    currentRemaining: null,
  };
  updatedStats.currentRemaining = calculateRemaining(updatedStats, updatedExpenses);

  return { stats: updatedStats, history: newHistory, expenses: updatedExpenses, changed: true };
}

function normalizeExpense(expense: unknown): Expense | null {
  if (!expense || typeof expense !== 'object') return null;
  const item = expense as Partial<Expense>;
  const date = typeof item.date === 'string' ? toDateKey(item.date) : null;
  if (
    !date ||
    typeof item.id !== 'string' ||
    !item.id ||
    !isValidAmount(item.amount) ||
    typeof item.title !== 'string' ||
    !item.title.trim()
  ) {
    return null;
  }

  return {
    id: item.id,
    title: item.title.trim(),
    amount: roundMoney(item.amount),
    date,
    monthLabel: getMonthLabel(date),
    subscriptionId:
      typeof item.subscriptionId === 'string' && item.subscriptionId
        ? item.subscriptionId
        : undefined,
  };
}

function normalizeSavingsRecord(record: unknown): SavingsRecord | null {
  if (!record || typeof record !== 'object') return null;
  const item = record as Partial<SavingsRecord>;
  if (
    typeof item.id !== 'string' ||
    !item.id ||
    !isValidMonthLabel(item.monthLabel) ||
    typeof item.date !== 'string' ||
    !item.date ||
    !isValidAmount(item.budget) ||
    !isValidAmount(item.spent) ||
    !isValidAmount(item.rolloverAmount) ||
    !isValidAmount(item.newTotalSavings)
  ) {
    return null;
  }

  return {
    id: item.id,
    monthLabel: item.monthLabel,
    date: item.date,
    budget: roundMoney(item.budget),
    spent: roundMoney(item.spent),
    rolloverAmount: roundMoney(item.rolloverAmount),
    newTotalSavings: roundMoney(item.newTotalSavings),
    note: typeof item.note === 'string' ? item.note : '',
  };
}

function normalizeExtraMoneyRecord(record: unknown): ExtraMoneyRecord | null {
  if (!record || typeof record !== 'object') return null;
  const item = record as Partial<ExtraMoneyRecord>;
  if (
    typeof item.id !== 'string' ||
    !item.id ||
    !isValidAmount(item.amount) ||
    item.amount <= 0 ||
    typeof item.date !== 'string' ||
    !isValidMonthLabel(item.monthLabel)
  ) {
    return null;
  }

  const date = toDateKey(item.date);
  if (!date) return null;

  return {
    id: item.id,
    amount: roundMoney(item.amount),
    note: typeof item.note === 'string' ? item.note.trim().slice(0, 40) : '',
    date,
    monthLabel: item.monthLabel,
  };
}

function normalizeSubscription(value: unknown): Subscription | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Partial<Subscription>;
  if (
    typeof item.id !== 'string' ||
    !item.id ||
    typeof item.name !== 'string' ||
    !item.name.trim() ||
    !isValidAmount(item.amount) ||
    item.amount <= 0 ||
    !isValidMonthLabel(item.startMonth) ||
    (item.cancelledFromMonth !== undefined &&
      !isValidMonthLabel(item.cancelledFromMonth))
  ) {
    return null;
  }

  return {
    id: item.id,
    name: item.name.trim(),
    amount: roundMoney(item.amount),
    startMonth: item.startMonth,
    cancelledFromMonth: item.cancelledFromMonth,
  };
}

async function persistStats(stats: UserStats): Promise<void> {
  try {
    await AsyncStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch (error) {
    console.error('Failed to save stats to local storage:', error);
  }
}

async function persistExpenses(expenses: Expense[]): Promise<void> {
  try {
    await AsyncStorage.setItem(EXPENSES_KEY, JSON.stringify(expenses));
  } catch (error) {
    console.error('Failed to save expenses to local storage:', error);
  }
}

async function persistSavingsHistory(history: SavingsRecord[]): Promise<void> {
  try {
    await AsyncStorage.setItem(SAVINGS_HISTORY_KEY, JSON.stringify(history));
  } catch (error) {
    console.error('Failed to save savings history to local storage:', error);
  }
}

async function persistSubscriptions(subscriptions: Subscription[]): Promise<void> {
  try {
    await AsyncStorage.setItem(SUBSCRIPTIONS_KEY, JSON.stringify(subscriptions));
  } catch (error) {
    console.error('Failed to save subscriptions to local storage:', error);
  }
}

export const useFinanceStore = create<FinanceState>((set, get) => ({
  stats: DEFAULT_STATS,
  expenses: [],
  savingsHistory: [],
  subscriptions: [],
  isLoaded: false,
  hasAcceptedTerms: false,

  loadData: async () => {
    const [statsRes, expensesRes, savingsHistoryRes, subscriptionsRes, termsRes] = await Promise.allSettled([
      AsyncStorage.getItem(STATS_KEY),
      AsyncStorage.getItem(EXPENSES_KEY),
      AsyncStorage.getItem(SAVINGS_HISTORY_KEY),
      AsyncStorage.getItem(SUBSCRIPTIONS_KEY),
      AsyncStorage.getItem(TERMS_KEY),
    ]);

    const statsRaw = statsRes.status === 'fulfilled' ? statsRes.value : null;
    const expensesRaw = expensesRes.status === 'fulfilled' ? expensesRes.value : null;
    const savingsHistoryRaw =
      savingsHistoryRes.status === 'fulfilled' ? savingsHistoryRes.value : null;
    const subscriptionsRaw =
      subscriptionsRes.status === 'fulfilled' ? subscriptionsRes.value : null;
    const termsRaw = termsRes.status === 'fulfilled' ? termsRes.value : null;

    if (statsRes.status === 'rejected') {
      console.error('Failed to read stats key:', statsRes.reason);
    }
    if (expensesRes.status === 'rejected') {
      console.error('Failed to read expenses key:', expensesRes.reason);
    }
    if (savingsHistoryRes.status === 'rejected') {
      console.error('Failed to read savings history key:', savingsHistoryRes.reason);
    }
    if (subscriptionsRes.status === 'rejected') {
      console.error('Failed to read subscriptions key:', subscriptionsRes.reason);
    }
    if (termsRes.status === 'rejected') {
      console.error('Failed to read terms key:', termsRes.reason);
    }

    const parsedStats = safeParseJSON<unknown>(statsRaw, null, STATS_KEY);
    const storedStats =
      parsedStats && typeof parsedStats === 'object' && !Array.isArray(parsedStats)
        ? (parsedStats as Record<string, unknown>)
        : null;

    const parsedExpenses = safeParseJSON<unknown>(expensesRaw, [], EXPENSES_KEY);
    let expenses = Array.isArray(parsedExpenses)
      ? parsedExpenses
          .map(normalizeExpense)
          .filter((expense): expense is Expense => expense !== null)
      : [];
    const loadedExpenseCount = expenses.length;

    const parsedHistory = safeParseJSON<unknown>(savingsHistoryRaw, [], SAVINGS_HISTORY_KEY);
    let savingsHistory = Array.isArray(parsedHistory)
      ? parsedHistory
          .map(normalizeSavingsRecord)
          .filter((record): record is SavingsRecord => record !== null)
      : [];

    const parsedSubscriptions = safeParseJSON<unknown>(
      subscriptionsRaw,
      [],
      SUBSCRIPTIONS_KEY
    );
    const subscriptions = Array.isArray(parsedSubscriptions)
      ? parsedSubscriptions
          .map(normalizeSubscription)
          .filter((subscription): subscription is Subscription => subscription !== null)
      : [];

    const bankName =
      typeof storedStats?.bankName === 'string' ? storedStats.bankName.trim() : '';

    let stats: UserStats = {
      bankName,
      baseAllowance:
        bankName && isValidAmount(storedStats?.baseAllowance)
          ? roundMoney(storedStats.baseAllowance)
          : null,
      extraAllowance: isValidAmount(storedStats?.extraAllowance)
        ? roundMoney(storedStats.extraAllowance)
        : 0,
      extraMoneyHistory: Array.isArray(storedStats?.extraMoneyHistory)
        ? storedStats.extraMoneyHistory
            .map(normalizeExtraMoneyRecord)
            .filter((record): record is ExtraMoneyRecord => record !== null)
        : [],
      rolloverInProgressFromMonth:
        isValidMonthLabel(storedStats?.rolloverInProgressFromMonth)
          ? storedStats.rolloverInProgressFromMonth
          : undefined,
      currentRemaining: null,
      totalBank:
        bankName && isValidAmount(storedStats?.totalBank)
          ? roundMoney(storedStats.totalBank)
          : null,
      currentMonthLabel:
        isValidMonthLabel(storedStats?.currentMonthLabel) &&
        (
          !isAfterMonth(storedStats.currentMonthLabel, getMonthLabel()) ||
          (
            isValidMonthLabel(storedStats?.rolloverInProgressFromMonth) &&
            getNextMonthLabel(storedStats.rolloverInProgressFromMonth) ===
              storedStats.currentMonthLabel
          )
        )
          ? storedStats.currentMonthLabel
          : getMonthLabel(),
    };

    const advanced = advanceMonthsIfNeeded(stats, expenses, savingsHistory, subscriptions);
    expenses = advanced.expenses;
    if (advanced.changed) {
      stats = advanced.stats;
      savingsHistory = advanced.history;
      if (stats.currentMonthLabel === getMonthLabel()) {
        stats = { ...stats, rolloverInProgressFromMonth: undefined };
      }
      persistStats(stats);
      persistSavingsHistory(savingsHistory);
      persistExpenses(expenses);
    } else {
      if (
        stats.rolloverInProgressFromMonth &&
        stats.currentMonthLabel === getMonthLabel()
      ) {
        stats = { ...stats, rolloverInProgressFromMonth: undefined };
        persistStats(stats);
      }
      stats = advanced.stats;
      stats.currentRemaining = calculateRemaining(stats, expenses);
      if (expenses.length !== loadedExpenseCount) {
        persistExpenses(expenses);
      }
    }

    const hasAcceptedTerms = termsRaw === 'true' || Boolean(storedStats?.bankName);

    set({ stats, expenses, savingsHistory, subscriptions, hasAcceptedTerms, isLoaded: true });
  },

  acceptTerms: () => {
    set({ hasAcceptedTerms: true });
    AsyncStorage.setItem(TERMS_KEY, 'true').catch((err) => {
      console.error('Failed to save terms acceptance:', err);
    });
  },

  checkAndAdvanceMonth: () => {
    const { stats, expenses, savingsHistory, subscriptions } = get();
    const advanced = advanceMonthsIfNeeded(stats, expenses, savingsHistory, subscriptions);
    let checkedStats = advanced.stats;
    if (advanced.changed) {
      if (checkedStats.currentMonthLabel === getMonthLabel()) {
        checkedStats = { ...checkedStats, rolloverInProgressFromMonth: undefined };
      }
      persistSavingsHistory(advanced.history);
    }
    if (
      checkedStats.rolloverInProgressFromMonth &&
      checkedStats.currentMonthLabel === getMonthLabel()
    ) {
      checkedStats = { ...checkedStats, rolloverInProgressFromMonth: undefined };
    }

    const expensesChanged = advanced.expenses !== expenses;
    const statsChanged = checkedStats !== stats;
    if (statsChanged || expensesChanged || advanced.changed) {
      if (!advanced.changed && expensesChanged) {
        checkedStats.currentRemaining = calculateRemaining(checkedStats, advanced.expenses);
      }
      set({
        stats: checkedStats,
        expenses: advanced.expenses,
        savingsHistory: advanced.history,
      });
      if (statsChanged || advanced.changed) persistStats(checkedStats);
      if (expensesChanged) persistExpenses(advanced.expenses);
    }
    return advanced.changed;
  },

  saveSettings: (bankName: string, allowance: number, savingsBalance: number) => {
    const { stats, expenses } = get();
    if (!bankName.trim() || !isValidAmount(allowance) || !isValidAmount(savingsBalance)) return;

    const newStats: UserStats = {
      ...stats,
      bankName: bankName.trim(),
      baseAllowance: roundMoney(allowance),
      extraAllowance: roundMoney(stats.extraAllowance ?? 0),
      totalBank: roundMoney(savingsBalance),
      currentRemaining: null,
    };
    newStats.currentRemaining = calculateRemaining(newStats, expenses);

    set({ stats: newStats });
    persistStats(newStats);
  },

  addMoney: (amount: number, note?: string) => {
    const { stats, expenses } = get();
    if (!isValidAmount(amount) || amount <= 0) {
      return { ok: false, message: 'Please enter a valid amount greater than 0.' };
    }
    if (stats.baseAllowance === null) {
      return { ok: false, message: 'Please set up your budget first in Settings.' };
    }

    const currentExtra = stats.extraAllowance ?? 0;
    const newExtra = roundMoney(currentExtra + amount);

    const newStats: UserStats = {
      ...stats,
      extraAllowance: newExtra,
      extraMoneyHistory: [
        ...(stats.extraMoneyHistory ?? []),
        {
          id: Crypto.randomUUID ? Crypto.randomUUID() : `add_${Date.now()}_${Math.random()}`,
          amount: roundMoney(amount),
          note: note?.trim().slice(0, 40) ?? '',
          date: getDateKey(),
          monthLabel: stats.currentMonthLabel,
        },
      ],
      currentRemaining: null,
    };
    newStats.currentRemaining = calculateRemaining(newStats, expenses);

    set({ stats: newStats });
    persistStats(newStats);
    return { ok: true };
  },

  addExpense: (title: string, amount: number, date: Date): AddExpenseResult => {
    get().checkAndAdvanceMonth();
    const { stats, expenses } = get();
    const dateKey = toDateKey(date);

    if (!title.trim() || !isValidAmount(amount) || amount <= 0 || !dateKey) {
      return {
        ok: false,
        error: 'invalid_input',
        message: 'Enter a name, a positive amount, and a valid date.',
      };
    }

    const monthLabel = getMonthLabel(dateKey);

    if (monthLabel !== stats.currentMonthLabel) {
      const endedMonth =
        isAfterMonth(stats.currentMonthLabel, monthLabel)
          ? `${formatMonthLabel(monthLabel)} has already ended`
          : `${formatMonthLabel(monthLabel)} has not started yet`;
      return {
        ok: false,
        error: 'month_not_finished',
        message: `${endedMonth}. Expenses can only be logged for the open month, ${formatMonthLabel(stats.currentMonthLabel)}.`,
      };
    }

    const newExpense: Expense = {
      id: Crypto.randomUUID ? Crypto.randomUUID() : `exp_${Date.now()}_${Math.random()}`,
      title: title.trim(),
      amount: roundMoney(amount),
      date: dateKey,
      monthLabel,
    };

    const newExpenses = [newExpense, ...expenses];

    const newStats: UserStats = {
      ...stats,
      currentRemaining: null,
    };
    newStats.currentRemaining = calculateRemaining(newStats, newExpenses);

    set({ stats: newStats, expenses: newExpenses });
    persistStats(newStats);
    persistExpenses(newExpenses);
    return { ok: true };
  },

  addSubscription: (name: string, amount: number): AddSubscriptionResult => {
    const { stats, subscriptions } = get();
    const trimmedName = name.trim();
    if (!trimmedName || !isValidAmount(amount) || amount <= 0) {
      return { ok: false, message: 'Enter a name and a valid amount greater than 0.' };
    }
    if (stats.baseAllowance === null) {
      return { ok: false, message: 'Set up your monthly budget before adding subscriptions.' };
    }

    const subscription: Subscription = {
      id: Crypto.randomUUID ? Crypto.randomUUID() : `subscription_${Date.now()}_${Math.random()}`,
      name: trimmedName,
      amount: roundMoney(amount),
      startMonth: getNextMonthLabel(stats.currentMonthLabel),
    };
    const newSubscriptions = [...subscriptions, subscription];
    set({ subscriptions: newSubscriptions });
    persistSubscriptions(newSubscriptions);
    return { ok: true };
  },

  cancelSubscription: (id: string) => {
    const { stats, subscriptions } = get();
    const subscription = subscriptions.find((item) => item.id === id);
    if (!subscription || subscription.cancelledFromMonth) return;

    const cancelledFromMonth = getNextMonthLabel(stats.currentMonthLabel);
    const newSubscriptions = subscriptions.map((item) =>
      item.id === id ? { ...item, cancelledFromMonth } : item
    );
    set({ subscriptions: newSubscriptions });
    persistSubscriptions(newSubscriptions);
  },

  deleteExpense: (id: string) => {
    const { stats, expenses } = get();
    const expenseToDelete = expenses.find((e) => e.id === id);
    if (!expenseToDelete) return;
    if (expenseToDelete.subscriptionId) return;

    const newExpenses = expenses.filter((e) => e.id !== id);

    const newStats: UserStats = { ...stats, currentRemaining: null };
    newStats.currentRemaining = calculateRemaining(newStats, newExpenses);

    set({ stats: newStats, expenses: newExpenses });
    persistStats(newStats);
    persistExpenses(newExpenses);
  },

  endMonth: () => {
    const { stats, expenses, savingsHistory, subscriptions } = get();
    if (stats.baseAllowance === null || stats.totalBank === null || !stats.bankName) return;

    const currentMonth = stats.currentMonthLabel;
    if (savingsHistory.some((record) => record.monthLabel === currentMonth)) return;
    const currentExpenses = applySubscriptionExpenses(subscriptions, expenses, currentMonth);
    const monthExpenses = currentExpenses.filter((e) => e.monthLabel === currentMonth);
    const spent = roundMoney(monthExpenses.reduce((sum, e) => sum + e.amount, 0));
    const totalBudget = roundMoney(stats.baseAllowance + (stats.extraAllowance ?? 0));
    const rolloverSavings = roundMoney(Math.max(0, totalBudget - spent));
    const newTotalBank = roundMoney(stats.totalBank + rolloverSavings);

    const record: SavingsRecord = {
      id: `sav_${currentMonth}_${Date.now()}`,
      monthLabel: currentMonth,
      date: getDateKey(),
      budget: totalBudget,
      spent,
      rolloverAmount: rolloverSavings,
      newTotalSavings: newTotalBank,
      note: `Monthly rollover for ${formatMonthLabel(currentMonth)}`,
    };

    const newHistory = [record, ...savingsHistory.filter((h) => h.monthLabel !== currentMonth)];
    const nextMonth = getNextMonthLabel(currentMonth);
    const newExpenses = applySubscriptionExpenses(subscriptions, currentExpenses, nextMonth);

    const newStats: UserStats = {
      ...stats,
      totalBank: newTotalBank,
      extraAllowance: 0,
      extraMoneyHistory: [],
      rolloverInProgressFromMonth: currentMonth,
      currentRemaining: null,
      currentMonthLabel: nextMonth,
    };
    newStats.currentRemaining = calculateRemaining(newStats, newExpenses);

    set({ stats: newStats, savingsHistory: newHistory, expenses: newExpenses });
    persistStats(newStats);
    persistSavingsHistory(newHistory);
    if (newExpenses !== expenses) persistExpenses(newExpenses);
  },

  resetAllData: async () => {
    try {
      await Promise.all([
        AsyncStorage.removeItem(STATS_KEY),
        AsyncStorage.removeItem(EXPENSES_KEY),
        AsyncStorage.removeItem(SAVINGS_HISTORY_KEY),
        AsyncStorage.removeItem(SUBSCRIPTIONS_KEY),
        AsyncStorage.removeItem(TERMS_KEY),
      ]);
      set({
        stats: DEFAULT_STATS,
        expenses: [],
        savingsHistory: [],
        subscriptions: [],
        hasAcceptedTerms: false,
        isLoaded: true,
      });
    } catch (e) {
      console.error(e);
    }
  },

  getMonthExpenses: (monthLabel?: string) => {
    const { stats, expenses } = get();
    const target = monthLabel || stats.currentMonthLabel;
    return expenses.filter((e) => e.monthLabel === target);
  },
}));
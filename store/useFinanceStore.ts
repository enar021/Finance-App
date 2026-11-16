import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FinanceState, UserStats, Expense, AddExpenseResult, SavingsRecord } from '@/types';
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
const TERMS_KEY = '@pennywise_terms_accepted_v1';

const DEFAULT_STATS: UserStats = {
  bankName: '',
  baseAllowance: null,
  extraAllowance: 0,
  currentRemaining: null,
  totalBank: null,
  currentMonthLabel: getMonthLabel(),
};

function isValidAmount(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function calculateRemaining(stats: UserStats, expenses: Expense[]): number | null {
  if (stats.baseAllowance === null) return null;

  const totalBudget = stats.baseAllowance + (stats.extraAllowance ?? 0);

  const spent = expenses
    .filter((expense) => expense.monthLabel === stats.currentMonthLabel)
    .reduce((sum, expense) => sum + expense.amount, 0);

  return totalBudget - spent;
}

function advanceMonthsIfNeeded(
  currentStats: UserStats,
  expenses: Expense[],
  history: SavingsRecord[] = []
): { stats: UserStats; history: SavingsRecord[]; changed: boolean } {
  const targetMonth = getMonthLabel();
  let currentMonth = currentStats.currentMonthLabel;

  if (!isAfterMonth(targetMonth, currentMonth)) {
    return { stats: currentStats, history, changed: false };
  }

  let totalBank = currentStats.totalBank;
  let newHistory = [...history];

  while (isAfterMonth(targetMonth, currentMonth)) {
    if (currentStats.baseAllowance !== null && totalBank !== null) {
      const monthExpenses = expenses.filter((e) => e.monthLabel === currentMonth);
      const spent = monthExpenses.reduce((sum, e) => sum + e.amount, 0);
      const monthBudget =
        currentStats.baseAllowance +
        (currentMonth === currentStats.currentMonthLabel ? (currentStats.extraAllowance ?? 0) : 0);
      const surplus = Math.max(0, monthBudget - spent);
      totalBank += surplus;

      const record: SavingsRecord = {
        id: `sav_${currentMonth}_${Date.now()}`,
        monthLabel: currentMonth,
        date: `${currentMonth}-28`,
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

  const updatedStats: UserStats = {
    ...currentStats,
    totalBank,
    extraAllowance: 0,
    currentMonthLabel: currentMonth,
    currentRemaining: null,
  };
  updatedStats.currentRemaining = calculateRemaining(updatedStats, expenses);

  return { stats: updatedStats, history: newHistory, changed: true };
}

function normalizeExpense(expense: Expense): Expense | null {
  const date = toDateKey(expense.date);
  if (
    !date ||
    typeof expense.id !== 'string' ||
    !expense.id ||
    !isValidAmount(expense.amount) ||
    !expense.title?.trim()
  ) {
    return null;
  }

  return {
    id: expense.id,
    title: expense.title.trim(),
    amount: expense.amount,
    date,
    monthLabel: getMonthLabel(date),
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

export const useFinanceStore = create<FinanceState>((set, get) => ({
  stats: DEFAULT_STATS,
  expenses: [],
  savingsHistory: [],
  isLoaded: false,
  hasAcceptedTerms: false,

  loadData: async () => {
    try {
      const [statsRaw, expensesRaw, savingsHistoryRaw, termsRaw] = await Promise.all([
        AsyncStorage.getItem(STATS_KEY),
        AsyncStorage.getItem(EXPENSES_KEY),
        AsyncStorage.getItem(SAVINGS_HISTORY_KEY),
        AsyncStorage.getItem(TERMS_KEY),
      ]);

      const storedStats = statsRaw ? JSON.parse(statsRaw) : null;
      const rawExpenses: Expense[] = expensesRaw ? JSON.parse(expensesRaw) : [];
      const expenses = rawExpenses
        .map(normalizeExpense)
        .filter((expense): expense is Expense => expense !== null);
      const rawHistory: SavingsRecord[] = savingsHistoryRaw ? JSON.parse(savingsHistoryRaw) : [];
      let savingsHistory = Array.isArray(rawHistory) ? rawHistory : [];
      const bankName =
        typeof storedStats?.bankName === 'string' ? storedStats.bankName.trim() : '';

      let stats: UserStats = {
        bankName,
        baseAllowance: bankName && isValidAmount(storedStats?.baseAllowance)
          ? storedStats.baseAllowance
          : null,
        extraAllowance: isValidAmount(storedStats?.extraAllowance)
          ? storedStats.extraAllowance
          : 0,
        currentRemaining: null,
        totalBank: bankName && isValidAmount(storedStats?.totalBank) ? storedStats.totalBank : null,
        currentMonthLabel:
          typeof storedStats?.currentMonthLabel === 'string'
            ? storedStats.currentMonthLabel
            : getMonthLabel(),
      };

      const advanced = advanceMonthsIfNeeded(stats, expenses, savingsHistory);
      if (advanced.changed) {
        stats = advanced.stats;
        savingsHistory = advanced.history;
        persistStats(stats);
        persistSavingsHistory(savingsHistory);
      } else {
        stats.currentRemaining = calculateRemaining(stats, expenses);
      }

      const hasAcceptedTerms = termsRaw === 'true' || Boolean(storedStats?.bankName);

      set({ stats, expenses, savingsHistory, hasAcceptedTerms, isLoaded: true });
    } catch (error) {
      console.error('Failed to load local data:', error);
      set({ stats: DEFAULT_STATS, expenses: [], savingsHistory: [], hasAcceptedTerms: false, isLoaded: true });
    }
  },

  acceptTerms: () => {
    set({ hasAcceptedTerms: true });
    AsyncStorage.setItem(TERMS_KEY, 'true').catch((err) => {
      console.error('Failed to save terms acceptance:', err);
    });
  },

  checkAndAdvanceMonth: () => {
    const { stats, expenses, savingsHistory } = get();
    const advanced = advanceMonthsIfNeeded(stats, expenses, savingsHistory);
    if (advanced.changed) {
      set({ stats: advanced.stats, savingsHistory: advanced.history });
      persistStats(advanced.stats);
      persistSavingsHistory(advanced.history);
      return true;
    }
    return false;
  },

  saveSettings: (bankName: string, allowance: number, savingsBalance: number) => {
    const { stats, expenses } = get();
    if (!bankName.trim() || !isValidAmount(allowance) || !isValidAmount(savingsBalance)) return;

    const newStats: UserStats = {
      ...stats,
      bankName: bankName.trim(),
      baseAllowance: allowance,
      extraAllowance: stats.extraAllowance ?? 0,
      totalBank: savingsBalance,
      currentRemaining: null,
    };
    newStats.currentRemaining = calculateRemaining(newStats, expenses);

    set({ stats: newStats });
    persistStats(newStats);
  },

  addMoney: (amount: number, _note?: string) => {
    const { stats, expenses } = get();
    if (!isValidAmount(amount) || amount <= 0) {
      return { ok: false, message: 'Please enter a valid amount greater than 0.' };
    }
    if (stats.baseAllowance === null) {
      return { ok: false, message: 'Please set up your budget first in Settings.' };
    }

    const currentExtra = stats.extraAllowance ?? 0;
    const newExtra = currentExtra + amount;

    const newStats: UserStats = {
      ...stats,
      extraAllowance: newExtra,
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

    // Block starting a new month until the current one has been ended.
    if (isAfterMonth(monthLabel, stats.currentMonthLabel)) {
      return {
        ok: false,
        error: 'month_not_finished',
        message: `You can't log expenses for ${formatMonthLabel(monthLabel)} yet. Finish ${formatMonthLabel(stats.currentMonthLabel)} first by ending the month.`,
      };
    }

    const newExpense: Expense = {
      id: Crypto.randomUUID ? Crypto.randomUUID() : `exp_${Date.now()}_${Math.random()}`,
      title: title.trim(),
      amount,
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

  deleteExpense: (id: string) => {
    const { stats, expenses } = get();
    const expenseToDelete = expenses.find((e) => e.id === id);
    if (!expenseToDelete) return;

    const newExpenses = expenses.filter((e) => e.id !== id);

    const newStats: UserStats = { ...stats, currentRemaining: null };
    newStats.currentRemaining = calculateRemaining(newStats, newExpenses);

    set({ stats: newStats, expenses: newExpenses });
    persistStats(newStats);
    persistExpenses(newExpenses);
  },

  endMonth: () => {
    const { stats, expenses, savingsHistory } = get();
    if (stats.baseAllowance === null || stats.totalBank === null || !stats.bankName) return;

    const currentMonth = stats.currentMonthLabel;
    const monthExpenses = expenses.filter((e) => e.monthLabel === currentMonth);
    const spent = monthExpenses.reduce((sum, e) => sum + e.amount, 0);
    const totalBudget = stats.baseAllowance + (stats.extraAllowance ?? 0);
    const rolloverSavings = Math.max(0, totalBudget - spent);
    const newTotalBank = stats.totalBank + rolloverSavings;

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

    const newStats: UserStats = {
      ...stats,
      totalBank: newTotalBank,
      extraAllowance: 0,
      currentRemaining: null,
      currentMonthLabel: getNextMonthLabel(stats.currentMonthLabel),
    };
    newStats.currentRemaining = calculateRemaining(newStats, expenses);

    set({ stats: newStats, savingsHistory: newHistory });
    persistStats(newStats);
    persistSavingsHistory(newHistory);
  },

  resetAllData: async () => {
    try {
      await Promise.all([
        AsyncStorage.removeItem(STATS_KEY),
        AsyncStorage.removeItem(EXPENSES_KEY),
        AsyncStorage.removeItem(SAVINGS_HISTORY_KEY),
        AsyncStorage.removeItem(TERMS_KEY),
      ]);
      set({ stats: DEFAULT_STATS, expenses: [], savingsHistory: [], hasAcceptedTerms: false, isLoaded: true });
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
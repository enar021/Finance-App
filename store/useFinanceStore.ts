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
  FinanceBackup,
  SubscriptionChange,
  SubscriptionPaymentOverride,
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
const BACKUP_CONSENT_KEY = '@pennywise_backup_consent_v1';

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
  const activeSubscriptions = subscriptions.filter(
    (subscription) =>
      subscription.startMonth <= monthLabel &&
      (!subscription.cancelledFromMonth || monthLabel < subscription.cancelledFromMonth)
  );
  const shouldKeepExpense = (expense: Expense) => {
    if (!expense.subscriptionId || expense.monthLabel !== monthLabel) return true;
    const subscription = activeSubscriptions.find(
      (item) => item.id === expense.subscriptionId
    );
    const override = subscription?.paymentOverrides?.find(
      (item) => item.monthLabel === monthLabel
    );
    return Boolean(subscription && !override?.skipped);
  };
  let updatedExpenses = expenses;
  if (expenses.some((expense) => !shouldKeepExpense(expense))) {
    updatedExpenses = expenses.filter(shouldKeepExpense);
  }

  activeSubscriptions.forEach((subscription) => {
    const change = [...(subscription.changes ?? [])]
      .filter((item) => item.effectiveMonth <= monthLabel)
      .sort((a, b) => a.effectiveMonth.localeCompare(b.effectiveMonth))
      .at(-1);
    const override = subscription.paymentOverrides?.find(
      (item) => item.monthLabel === monthLabel
    );
    if (override?.skipped) return;

    const existingIndex = updatedExpenses.findIndex(
      (expense) =>
        expense.subscriptionId === subscription.id && expense.monthLabel === monthLabel
    );
    const recurringExpense: Expense = {
      id: existingIndex >= 0
        ? updatedExpenses[existingIndex].id
        : `sub_${subscription.id}_${monthLabel}`,
      title: change?.name ?? subscription.name,
      amount: override?.amount ?? change?.amount ?? subscription.amount,
      date: existingIndex >= 0
        ? updatedExpenses[existingIndex].date
        : `${monthLabel}-01`,
      monthLabel,
      subscriptionId: subscription.id,
    };

    if (existingIndex >= 0) {
      const existingExpense = updatedExpenses[existingIndex];
      if (
        existingExpense.title !== recurringExpense.title ||
        existingExpense.amount !== recurringExpense.amount ||
        existingExpense.date !== recurringExpense.date
      ) {
        if (updatedExpenses === expenses) updatedExpenses = [...expenses];
        updatedExpenses[existingIndex] = recurringExpense;
      }
    } else {
      if (updatedExpenses === expenses) updatedExpenses = [...expenses];
      updatedExpenses.unshift(recurringExpense);
    }
  });

  return updatedExpenses;
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
      !isValidMonthLabel(item.cancelledFromMonth)) ||
    (item.changes !== undefined && !Array.isArray(item.changes)) ||
    (item.paymentOverrides !== undefined && !Array.isArray(item.paymentOverrides))
  ) {
    return null;
  }

  const changes = (item.changes ?? [])
    .map(normalizeSubscriptionChange)
    .filter((change): change is SubscriptionChange => change !== null);
  const paymentOverrides = (item.paymentOverrides ?? [])
    .map(normalizeSubscriptionPaymentOverride)
    .filter((override): override is SubscriptionPaymentOverride => override !== null);
  if (
    changes.length !== (item.changes ?? []).length ||
    paymentOverrides.length !== (item.paymentOverrides ?? []).length ||
    new Set(changes.map((change) => change.effectiveMonth)).size !== changes.length ||
    new Set(paymentOverrides.map((override) => override.monthLabel)).size !==
      paymentOverrides.length
  ) {
    return null;
  }

  return {
    id: item.id,
    name: item.name.trim(),
    amount: roundMoney(item.amount),
    startMonth: item.startMonth,
    cancelledFromMonth: item.cancelledFromMonth,
    changes,
    paymentOverrides,
  };
}

function normalizeSubscriptionChange(value: unknown): SubscriptionChange | null {
  if (
    !value ||
    typeof value !== 'object' ||
    !isValidMonthLabel((value as SubscriptionChange).effectiveMonth) ||
    typeof (value as SubscriptionChange).name !== 'string' ||
    !(value as SubscriptionChange).name.trim() ||
    !isValidAmount((value as SubscriptionChange).amount) ||
    (value as SubscriptionChange).amount <= 0
  ) {
    return null;
  }
  const item = value as SubscriptionChange;
  return {
    effectiveMonth: item.effectiveMonth,
    name: item.name.trim(),
    amount: roundMoney(item.amount),
  };
}

function normalizeSubscriptionPaymentOverride(
  value: unknown
): SubscriptionPaymentOverride | null {
  if (
    !value ||
    typeof value !== 'object' ||
    !isValidMonthLabel((value as SubscriptionPaymentOverride).monthLabel) ||
    typeof (value as SubscriptionPaymentOverride).skipped !== 'boolean' ||
    ((value as SubscriptionPaymentOverride).amount !== undefined &&
      (!isValidAmount((value as SubscriptionPaymentOverride).amount) ||
        (value as SubscriptionPaymentOverride).skipped))
  ) {
    return null;
  }
  const item = value as SubscriptionPaymentOverride;
  return {
    monthLabel: item.monthLabel,
    skipped: item.skipped,
    amount: item.amount === undefined ? undefined : roundMoney(item.amount),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function normalizeBackup(value: unknown): {
  stats: UserStats;
  expenses: Expense[];
  savingsHistory: SavingsRecord[];
  subscriptions: Subscription[];
} | null {
  if (
    !isRecord(value) ||
    value.app !== 'penny-wise' ||
    value.version !== 1 ||
    typeof value.exportedAt !== 'string' ||
    !Number.isFinite(Date.parse(value.exportedAt)) ||
    !isRecord(value.data)
  ) {
    return null;
  }

  const { stats: rawStats, expenses: rawExpenses, savingsHistory: rawHistory, subscriptions: rawSubscriptions } =
    value.data;
  if (
    !isRecord(rawStats) ||
    typeof rawStats.bankName !== 'string' ||
    (rawStats.baseAllowance !== null && !isValidAmount(rawStats.baseAllowance)) ||
    (rawStats.totalBank !== null && !isValidAmount(rawStats.totalBank)) ||
    !isValidMonthLabel(rawStats.currentMonthLabel) ||
    !Array.isArray(rawExpenses) ||
    !Array.isArray(rawHistory) ||
    !Array.isArray(rawSubscriptions) ||
    (rawStats.extraAllowance !== undefined && !isValidAmount(rawStats.extraAllowance)) ||
    (rawStats.rolloverInProgressFromMonth !== undefined &&
      !isValidMonthLabel(rawStats.rolloverInProgressFromMonth)) ||
    (rawStats.extraMoneyHistory !== undefined && !Array.isArray(rawStats.extraMoneyHistory))
  ) {
    return null;
  }

  const rolloverMonth = rawStats.rolloverInProgressFromMonth as string | undefined;
  if (
    isAfterMonth(rawStats.currentMonthLabel, getMonthLabel()) &&
    (!rolloverMonth || getNextMonthLabel(rolloverMonth) !== rawStats.currentMonthLabel)
  ) {
    return null;
  }

  const expenses = rawExpenses
    .map(normalizeExpense)
    .filter((expense): expense is Expense => expense !== null);
  const savingsHistory = rawHistory
    .map(normalizeSavingsRecord)
    .filter((record): record is SavingsRecord => record !== null);
  const subscriptions = rawSubscriptions
    .map(normalizeSubscription)
    .filter((subscription): subscription is Subscription => subscription !== null);
  const extraMoneyHistory = (rawStats.extraMoneyHistory ?? [])
    .map(normalizeExtraMoneyRecord)
    .filter((record): record is ExtraMoneyRecord => record !== null);

  if (
    expenses.length !== rawExpenses.length ||
    savingsHistory.length !== rawHistory.length ||
    subscriptions.length !== rawSubscriptions.length ||
    extraMoneyHistory.length !== (rawStats.extraMoneyHistory ?? []).length
  ) {
    return null;
  }

  const hasUniqueIds = <T extends { id: string }>(items: T[]) =>
    new Set(items.map((item) => item.id)).size === items.length;
  if (
    !hasUniqueIds(expenses) ||
    !hasUniqueIds(savingsHistory) ||
    !hasUniqueIds(subscriptions) ||
    !hasUniqueIds(extraMoneyHistory)
  ) {
    return null;
  }

  const stats: UserStats = {
    bankName: rawStats.bankName.trim(),
    baseAllowance:
      rawStats.baseAllowance === null ? null : roundMoney(rawStats.baseAllowance as number),
    extraAllowance:
      rawStats.extraAllowance === undefined ? 0 : roundMoney(rawStats.extraAllowance as number),
    extraMoneyHistory,
    rolloverInProgressFromMonth: rolloverMonth,
    currentRemaining: null,
    totalBank: rawStats.totalBank === null ? null : roundMoney(rawStats.totalBank as number),
    currentMonthLabel: rawStats.currentMonthLabel,
  };

  return { stats, expenses, savingsHistory, subscriptions };
}

export const useFinanceStore = create<FinanceState>((set, get) => {
  let writeQueue: Promise<void> = Promise.resolve();
  let writeRevision = 0;

  const persistEntries = async (
    entries: [string, string][],
    label: string
  ): Promise<boolean> => {
    const revision = ++writeRevision;
    set({ saveStatus: 'saving' });
    const write = writeQueue.then(() => AsyncStorage.multiSet(entries));
    writeQueue = write.then(
      () => undefined,
      () => undefined
    );

    try {
      await write;
      if (revision === writeRevision) set({ saveStatus: 'saved' });
      return true;
    } catch (error) {
      console.error(`Failed to save ${label} to local storage:`, error);
      if (revision === writeRevision) set({ saveStatus: 'error' });
      return false;
    }
  };

  const persistCurrentData = (): void => {
    const { stats, expenses, savingsHistory, subscriptions } = get();
    void persistEntries(
      [
        [STATS_KEY, JSON.stringify(stats)],
        [EXPENSES_KEY, JSON.stringify(expenses)],
        [SAVINGS_HISTORY_KEY, JSON.stringify(savingsHistory)],
        [SUBSCRIPTIONS_KEY, JSON.stringify(subscriptions)],
      ],
      'finance data'
    );
  };

  return ({
  stats: DEFAULT_STATS,
  expenses: [],
  savingsHistory: [],
  subscriptions: [],
  isLoaded: false,
  hasAcceptedTerms: false,
  hasConfirmedBackupConsent: false,
  saveStatus: 'idle',

  loadData: async () => {
    const [
      statsRes,
      expensesRes,
      savingsHistoryRes,
      subscriptionsRes,
      termsRes,
      backupConsentRes,
    ] = await Promise.allSettled([
      AsyncStorage.getItem(STATS_KEY),
      AsyncStorage.getItem(EXPENSES_KEY),
      AsyncStorage.getItem(SAVINGS_HISTORY_KEY),
      AsyncStorage.getItem(SUBSCRIPTIONS_KEY),
      AsyncStorage.getItem(TERMS_KEY),
      AsyncStorage.getItem(BACKUP_CONSENT_KEY),
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
    if (backupConsentRes.status === 'rejected') {
      console.error('Failed to read backup consent key:', backupConsentRes.reason);
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

    const shouldClearRollover =
      Boolean(stats.rolloverInProgressFromMonth) &&
      stats.currentMonthLabel === getMonthLabel();
    const advanced = advanceMonthsIfNeeded(stats, expenses, savingsHistory, subscriptions);
    expenses = advanced.expenses;
    let shouldPersist = false;
    if (advanced.changed) {
      stats = advanced.stats;
      savingsHistory = advanced.history;
      if (stats.currentMonthLabel === getMonthLabel()) {
        stats = { ...stats, rolloverInProgressFromMonth: undefined };
      }
      shouldPersist = true;
    } else {
      if (shouldClearRollover) {
        shouldPersist = true;
      }
      stats = advanced.stats;
      if (shouldClearRollover) {
        stats = { ...stats, rolloverInProgressFromMonth: undefined };
      }
      stats.currentRemaining = calculateRemaining(stats, expenses);
      if (expenses.length !== loadedExpenseCount) {
        shouldPersist = true;
      }
    }

    const hasAcceptedTerms = termsRaw === 'true' || Boolean(storedStats?.bankName);
    const hasConfirmedBackupConsent =
      backupConsentRes.status === 'fulfilled' && backupConsentRes.value === 'true';

    set({
      stats,
      expenses,
      savingsHistory,
      subscriptions,
      hasAcceptedTerms,
      hasConfirmedBackupConsent,
      isLoaded: true,
    });
    if (shouldPersist) persistCurrentData();
  },

  clearSaveStatus: () => {
    if (get().saveStatus === 'saved') set({ saveStatus: 'idle' });
  },

  confirmBackupConsent: async () => {
    try {
      await AsyncStorage.setItem(BACKUP_CONSENT_KEY, 'true');
      set({ hasConfirmedBackupConsent: true });
      return true;
    } catch (error) {
      console.error('Failed to save backup consent:', error);
      return false;
    }
  },

  createBackup: () => {
    get().checkAndAdvanceMonth();
    const { stats, expenses, savingsHistory, subscriptions } = get();
    return {
      app: 'penny-wise',
      version: 1,
      exportedAt: new Date().toISOString(),
      data: { stats, expenses, savingsHistory, subscriptions },
    };
  },

  restoreBackup: async (backup: unknown) => {
    const restored = normalizeBackup(backup);
    if (!restored) {
      return {
        ok: false,
        message: 'This file is not a valid Penny Wise backup or contains invalid ledger data.',
      };
    }

    const advanced = advanceMonthsIfNeeded(
      restored.stats,
      restored.expenses,
      restored.savingsHistory,
      restored.subscriptions
    );
    const stats = {
      ...advanced.stats,
      currentRemaining: calculateRemaining(advanced.stats, advanced.expenses),
    };
    const values: [string, string][] = [
      [STATS_KEY, JSON.stringify(stats)],
      [EXPENSES_KEY, JSON.stringify(advanced.expenses)],
      [SAVINGS_HISTORY_KEY, JSON.stringify(advanced.history)],
      [SUBSCRIPTIONS_KEY, JSON.stringify(restored.subscriptions)],
    ];

    const saved = await persistEntries(values, 'ledger backup');
    if (!saved) {
      return {
        ok: false,
        message: 'Could not save the restored ledger. Your current data was not replaced.',
      };
    }

    set({
      stats,
      expenses: advanced.expenses,
      savingsHistory: advanced.history,
      subscriptions: restored.subscriptions,
      hasAcceptedTerms: get().hasAcceptedTerms || Boolean(stats.bankName),
      isLoaded: true,
    });
    return { ok: true, message: 'Your backup has been restored.' };
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
      persistCurrentData();
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
    persistCurrentData();
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
    persistCurrentData();
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
    persistCurrentData();
    return { ok: true };
  },

  updateExpense: (id: string, title: string, amount: number, date: Date): AddExpenseResult => {
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
      return {
        ok: false,
        error: 'month_not_finished',
        message: `Expenses can only be edited for the open month, ${formatMonthLabel(stats.currentMonthLabel)}.`,
      };
    }

    const existing = expenses.find((expense) => expense.id === id);
    if (!existing || existing.subscriptionId) {
      return {
        ok: false,
        error: 'invalid_input',
        message: 'This expense cannot be edited.',
      };
    }

    const newExpenses = expenses.map((expense) =>
      expense.id === id
        ? {
            ...expense,
            title: title.trim(),
            amount: roundMoney(amount),
            date: dateKey,
            monthLabel,
          }
        : expense
    );
    const newStats: UserStats = {
      ...stats,
      currentRemaining: calculateRemaining(stats, newExpenses),
    };

    set({ stats: newStats, expenses: newExpenses });
    persistCurrentData();
    return { ok: true };
  },

  addSubscription: (
    name: string,
    amount: number,
    startMonth = getNextMonthLabel(get().stats.currentMonthLabel)
  ): AddSubscriptionResult => {
    const { stats, subscriptions } = get();
    const trimmedName = name.trim();
    if (!trimmedName || !isValidAmount(amount) || amount <= 0) {
      return { ok: false, message: 'Enter a name and a valid amount greater than 0.' };
    }
    if (!isValidMonthLabel(startMonth) || isAfterMonth(stats.currentMonthLabel, startMonth)) {
      return { ok: false, message: 'Choose a valid start month in the current or a future cycle.' };
    }
    if (stats.baseAllowance === null) {
      return { ok: false, message: 'Set up your monthly budget before adding subscriptions.' };
    }

    const subscription: Subscription = {
      id: Crypto.randomUUID ? Crypto.randomUUID() : `subscription_${Date.now()}_${Math.random()}`,
      name: trimmedName,
      amount: roundMoney(amount),
      startMonth,
      changes: [],
      paymentOverrides: [],
    };
    const newSubscriptions = [...subscriptions, subscription];
    const newExpenses =
      startMonth === stats.currentMonthLabel
        ? applySubscriptionExpenses(newSubscriptions, get().expenses, startMonth)
        : get().expenses;
    const newStats = {
      ...stats,
      currentRemaining: calculateRemaining(stats, newExpenses),
    };
    set({ stats: newStats, expenses: newExpenses, subscriptions: newSubscriptions });
    persistCurrentData();
    return { ok: true };
  },

  updateSubscription: (id, name, amount, effectiveMonth): AddSubscriptionResult => {
    const { stats, expenses, subscriptions } = get();
    const trimmedName = name.trim();
    if (!trimmedName || !isValidAmount(amount) || amount <= 0) {
      return { ok: false, message: 'Enter a name and a valid amount greater than 0.' };
    }
    if (!isValidMonthLabel(effectiveMonth) || isAfterMonth(stats.currentMonthLabel, effectiveMonth)) {
      return { ok: false, message: 'Choose a valid effective month in the current or a future cycle.' };
    }
    const subscription = subscriptions.find((item) => item.id === id);
    if (!subscription || subscription.cancelledFromMonth) {
      return { ok: false, message: 'This subscription is no longer active.' };
    }
    if (isAfterMonth(subscription.startMonth, effectiveMonth)) {
      return {
        ok: false,
        message: 'Choose an effective month on or after the subscription start month.',
      };
    }

    const changes = (subscription.changes ?? []).filter(
      (change) => change.effectiveMonth !== effectiveMonth
    );
    changes.push({
      effectiveMonth,
      name: trimmedName,
      amount: roundMoney(amount),
    });
    changes.sort((a, b) => a.effectiveMonth.localeCompare(b.effectiveMonth));
    const updatedSubscription = { ...subscription, changes };
    const newSubscriptions = subscriptions.map((item) =>
      item.id === id ? updatedSubscription : item
    );
    const affectedMonths = new Set([
      effectiveMonth,
      ...expenses
        .filter(
          (expense) =>
            expense.subscriptionId === id && expense.monthLabel >= effectiveMonth
        )
        .map((expense) => expense.monthLabel),
    ]);
    let newExpenses = expenses;
    Array.from(affectedMonths)
      .sort()
      .forEach((monthLabel) => {
        newExpenses = applySubscriptionExpenses(newSubscriptions, newExpenses, monthLabel);
      });
    const newStats = {
      ...stats,
      currentRemaining: calculateRemaining(stats, newExpenses),
    };

    set({ stats: newStats, expenses: newExpenses, subscriptions: newSubscriptions });
    persistCurrentData();
    return { ok: true };
  },

  setSubscriptionPaymentOverride: (id, monthLabel, amount): AddSubscriptionResult => {
    const { stats, expenses, subscriptions } = get();
    if (!isValidMonthLabel(monthLabel) || isAfterMonth(stats.currentMonthLabel, monthLabel)) {
      return { ok: false, message: 'Choose the current or a future budget month.' };
    }
    if (amount !== null && !isValidAmount(amount)) {
      return { ok: false, message: 'Enter a valid payment amount.' };
    }
    const subscription = subscriptions.find((item) => item.id === id);
    if (
      !subscription ||
      monthLabel < subscription.startMonth ||
      (subscription.cancelledFromMonth && monthLabel >= subscription.cancelledFromMonth)
    ) {
      return { ok: false, message: 'This subscription is not active in that month.' };
    }

    const paymentOverrides = (subscription.paymentOverrides ?? []).filter(
      (item) => item.monthLabel !== monthLabel
    );
    paymentOverrides.push(
      amount === null
        ? { monthLabel, skipped: true }
        : { monthLabel, skipped: false, amount: roundMoney(amount) }
    );
    const updatedSubscription = { ...subscription, paymentOverrides };
    const newSubscriptions = subscriptions.map((item) =>
      item.id === id ? updatedSubscription : item
    );
    const newExpenses = applySubscriptionExpenses(newSubscriptions, expenses, monthLabel);
    const newStats = {
      ...stats,
      currentRemaining: calculateRemaining(stats, newExpenses),
    };

    set({ stats: newStats, expenses: newExpenses, subscriptions: newSubscriptions });
    persistCurrentData();
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
    const affectedMonths = new Set([
      cancelledFromMonth,
      ...get()
        .expenses.filter(
          (expense) =>
            expense.subscriptionId === id && expense.monthLabel >= cancelledFromMonth
        )
        .map((expense) => expense.monthLabel),
    ]);
    let newExpenses = get().expenses;
    Array.from(affectedMonths)
      .sort()
      .forEach((monthLabel) => {
        newExpenses = applySubscriptionExpenses(newSubscriptions, newExpenses, monthLabel);
      });
    set({ subscriptions: newSubscriptions, expenses: newExpenses });
    persistCurrentData();
  },

  deleteExpense: (id: string) => {
    const { stats, expenses } = get();
    const expenseToDelete = expenses.find((e) => e.id === id);
    if (!expenseToDelete || expenseToDelete.subscriptionId) return;

    const newExpenses = expenses.filter((e) => e.id !== id);

    const newStats: UserStats = { ...stats, currentRemaining: null };
    newStats.currentRemaining = calculateRemaining(newStats, newExpenses);

    set({ stats: newStats, expenses: newExpenses });
    persistCurrentData();
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
    persistCurrentData();
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
      return true;
    } catch (e) {
      console.error('Failed to clear saved finance data:', e);
      return false;
    }
  },

  getMonthExpenses: (monthLabel?: string) => {
    const { stats, expenses } = get();
    const target = monthLabel || stats.currentMonthLabel;
    return expenses.filter((e) => e.monthLabel === target);
  },
  });
});
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
  SubscriptionChange,
  SubscriptionPaymentOverride,
  BankAccount,
  PendingRollover,
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
const BANK_ACCOUNTS_KEY = '@pennywise_bank_accounts_v1';

const DEFAULT_STATS: UserStats = {
  bankName: '',
  baseAllowance: null,
  extraAllowance: 0,
  extraMoneyHistory: [],
  rolloverInProgressFromMonth: undefined,
  currentRemaining: null,
  totalBank: 0,
  currentMonthLabel: getMonthLabel(),
  pendingRollover: null,
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
  subscriptions: Subscription[] = [],
  bankAccounts: BankAccount[] = []
): { stats: UserStats; history: SavingsRecord[]; expenses: Expense[]; bankAccounts: BankAccount[]; changed: boolean } {
  const targetMonth = getMonthLabel();
  let currentMonth = currentStats.currentMonthLabel;
  let updatedExpenses = expenses;
  let updatedBankAccounts = [...bankAccounts];

  if (!isAfterMonth(targetMonth, currentMonth)) {
    updatedExpenses = applySubscriptionExpenses(subscriptions, updatedExpenses, currentMonth);
    const updatedStats =
      updatedExpenses === expenses
        ? currentStats
        : { ...currentStats, currentRemaining: calculateRemaining(currentStats, updatedExpenses) };
    return { stats: updatedStats, history, expenses: updatedExpenses, bankAccounts, changed: false };
  }

  let totalBank = roundMoney(updatedBankAccounts.reduce((sum, b) => sum + b.balance, 0));
  let newHistory = [...history];
  let pendingRollover: { amount: number; monthLabel: string } | null = currentStats.pendingRollover ?? null;

  while (isAfterMonth(targetMonth, currentMonth)) {
    updatedExpenses = applySubscriptionExpenses(subscriptions, updatedExpenses, currentMonth);
    if (currentStats.baseAllowance !== null) {
      const monthExpenses = updatedExpenses.filter((e) => e.monthLabel === currentMonth);
      const spent = roundMoney(monthExpenses.reduce((sum, e) => sum + e.amount, 0));
      const monthBudget = roundMoney(
        currentStats.baseAllowance +
          (currentMonth === currentStats.currentMonthLabel ? (currentStats.extraAllowance ?? 0) : 0)
      );
      const surplus = roundMoney(Math.max(0, monthBudget - spent));

      if (surplus > 0) {
        if (updatedBankAccounts.length === 1) {
          updatedBankAccounts[0] = {
            ...updatedBankAccounts[0],
            balance: roundMoney(updatedBankAccounts[0].balance + surplus),
          };
          totalBank = roundMoney(updatedBankAccounts[0].balance);
        } else if (updatedBankAccounts.length > 1) {
          pendingRollover = {
            amount: roundMoney((pendingRollover?.amount ?? 0) + surplus),
            monthLabel: currentMonth,
          };
        }
      }

      const record: SavingsRecord = {
        id: `sav_${currentMonth}_${Date.now()}`,
        monthLabel: currentMonth,
        date: getLastDayOfMonthKey(currentMonth),
        budget: monthBudget,
        spent,
        rolloverAmount: surplus,
        newTotalSavings: roundMoney(totalBank + (pendingRollover ? pendingRollover.amount : 0)),
        note: `Rollover savings from ${formatMonthLabel(currentMonth)}`,
      };
      newHistory = [record, ...newHistory.filter((h) => h.monthLabel !== currentMonth)];
    }
    currentMonth = getNextMonthLabel(currentMonth);
  }

  updatedExpenses = applySubscriptionExpenses(subscriptions, updatedExpenses, currentMonth);
  const computedTotalBank = roundMoney(
    updatedBankAccounts.reduce((sum, b) => sum + b.balance, 0) +
      (pendingRollover ? pendingRollover.amount : 0)
  );
  const updatedStats: UserStats = {
    ...currentStats,
    totalBank: computedTotalBank,
    extraAllowance: 0,
    extraMoneyHistory: [],
    currentMonthLabel: currentMonth,
    currentRemaining: null,
    pendingRollover,
  };
  updatedStats.currentRemaining = calculateRemaining(updatedStats, updatedExpenses);

  return { stats: updatedStats, history: newHistory, expenses: updatedExpenses, bankAccounts: updatedBankAccounts, changed: true };
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

function normalizePendingRollover(value: unknown): PendingRollover | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Partial<PendingRollover>;
  if (typeof item.amount !== 'number' || !isValidAmount(item.amount) || item.amount <= 0) {
    return null;
  }
  if (typeof item.monthLabel !== 'string' || !isValidMonthLabel(item.monthLabel)) {
    return null;
  }
  return {
    amount: roundMoney(item.amount),
    monthLabel: item.monthLabel,
  };
}

function normalizeBankAccount(value: unknown): BankAccount | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Partial<BankAccount>;
  if (
    typeof item.id !== 'string' ||
    !item.id ||
    typeof item.name !== 'string' ||
    !item.name.trim() ||
    !isValidAmount(item.balance)
  ) {
    return null;
  }
  return {
    id: item.id,
    name: item.name.trim(),
    balance: roundMoney(item.balance),
    createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
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
  bankAccounts: BankAccount[];
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

  const {
    stats: rawStats,
    expenses: rawExpenses,
    savingsHistory: rawHistory,
    subscriptions: rawSubscriptions,
    bankAccounts: rawBankAccounts,
  } = value.data;
  if (
    !isRecord(rawStats) ||
    typeof rawStats.bankName !== 'string' ||
    (rawStats.baseAllowance !== null && !isValidAmount(rawStats.baseAllowance)) ||
    (rawStats.totalBank !== null && !isValidAmount(rawStats.totalBank)) ||
    !isValidMonthLabel(rawStats.currentMonthLabel) ||
    !Array.isArray(rawExpenses) ||
    !Array.isArray(rawHistory) ||
    !Array.isArray(rawSubscriptions) ||
    (rawBankAccounts !== undefined && !Array.isArray(rawBankAccounts)) ||
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
  const bankAccounts = Array.isArray(rawBankAccounts)
    ? rawBankAccounts
        .map(normalizeBankAccount)
        .filter((bank): bank is BankAccount => bank !== null)
    : [];

  if (
    expenses.length !== rawExpenses.length ||
    savingsHistory.length !== rawHistory.length ||
    subscriptions.length !== rawSubscriptions.length ||
    extraMoneyHistory.length !== (rawStats.extraMoneyHistory ?? []).length ||
    (Array.isArray(rawBankAccounts) && bankAccounts.length !== rawBankAccounts.length)
  ) {
    return null;
  }

  const hasUniqueIds = <T extends { id: string }>(items: T[]) =>
    new Set(items.map((item) => item.id)).size === items.length;
  if (
    !hasUniqueIds(expenses) ||
    !hasUniqueIds(savingsHistory) ||
    !hasUniqueIds(subscriptions) ||
    !hasUniqueIds(extraMoneyHistory) ||
    !hasUniqueIds(bankAccounts)
  ) {
    return null;
  }

  const bankName = rawStats.bankName.trim();
  const distributedTotal = roundMoney(bankAccounts.reduce((sum, b) => sum + b.balance, 0));
  const rawTotalBank =
    rawStats.totalBank !== null && isValidAmount(rawStats.totalBank)
      ? roundMoney(rawStats.totalBank as number)
      : 0;
  const computedTotalBank = bankAccounts.length > 0 ? distributedTotal : Math.max(rawTotalBank, distributedTotal);
  const pendingRollover = rawStats.pendingRollover
    ? normalizePendingRollover(rawStats.pendingRollover)
    : null;

  const stats: UserStats = {
    bankName,
    baseAllowance:
      rawStats.baseAllowance === null ? null : roundMoney(rawStats.baseAllowance as number),
    extraAllowance:
      rawStats.extraAllowance === undefined ? 0 : roundMoney(rawStats.extraAllowance as number),
    extraMoneyHistory,
    rolloverInProgressFromMonth: rolloverMonth,
    currentRemaining: null,
    totalBank: computedTotalBank,
    currentMonthLabel: rawStats.currentMonthLabel,
    pendingRollover,
  };

  return { stats, expenses, savingsHistory, subscriptions, bankAccounts };
}

export const useFinanceStore = create<FinanceState>((set, get) => {
  let writeQueue: Promise<void> = Promise.resolve();
  let writeRevision = 0;
  let isCurrentlyLoading = false;

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
    if (!get().isLoaded) return;
    const { stats, expenses, savingsHistory, subscriptions, bankAccounts } = get();
    void persistEntries(
      [
        [STATS_KEY, JSON.stringify(stats)],
        [EXPENSES_KEY, JSON.stringify(expenses)],
        [SAVINGS_HISTORY_KEY, JSON.stringify(savingsHistory)],
        [SUBSCRIPTIONS_KEY, JSON.stringify(subscriptions)],
        [BANK_ACCOUNTS_KEY, JSON.stringify(bankAccounts)],
      ],
      'finance data'
    );
  };

  return ({
  stats: DEFAULT_STATS,
  expenses: [],
  savingsHistory: [],
  subscriptions: [],
  bankAccounts: [],
  isLoaded: false,
  hasAcceptedTerms: false,
  hasConfirmedBackupConsent: false,
  saveStatus: 'idle',

  loadData: async () => {
    if (isCurrentlyLoading) return;
    isCurrentlyLoading = true;
    try {
      await writeQueue;
      const [
      statsRes,
      expensesRes,
      savingsHistoryRes,
      subscriptionsRes,
      termsRes,
      backupConsentRes,
      bankAccountsRes,
    ] = await Promise.allSettled([
      AsyncStorage.getItem(STATS_KEY),
      AsyncStorage.getItem(EXPENSES_KEY),
      AsyncStorage.getItem(SAVINGS_HISTORY_KEY),
      AsyncStorage.getItem(SUBSCRIPTIONS_KEY),
      AsyncStorage.getItem(TERMS_KEY),
      AsyncStorage.getItem(BACKUP_CONSENT_KEY),
      AsyncStorage.getItem(BANK_ACCOUNTS_KEY),
    ]);

    const statsRaw = statsRes.status === 'fulfilled' ? statsRes.value : null;
    const expensesRaw = expensesRes.status === 'fulfilled' ? expensesRes.value : null;
    const savingsHistoryRaw =
      savingsHistoryRes.status === 'fulfilled' ? savingsHistoryRes.value : null;
    const subscriptionsRaw =
      subscriptionsRes.status === 'fulfilled' ? subscriptionsRes.value : null;
    const termsRaw = termsRes.status === 'fulfilled' ? termsRes.value : null;
    const bankAccountsRaw =
      bankAccountsRes.status === 'fulfilled' ? bankAccountsRes.value : null;

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
    if (bankAccountsRes.status === 'rejected') {
      console.error('Failed to read bank accounts key:', bankAccountsRes.reason);
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

    const parsedBankAccounts = safeParseJSON<unknown>(
      bankAccountsRaw,
      [],
      BANK_ACCOUNTS_KEY
    );
    let bankAccounts = Array.isArray(parsedBankAccounts)
      ? parsedBankAccounts
          .map(normalizeBankAccount)
          .filter((bank): bank is BankAccount => bank !== null)
      : [];

    if (new Set(bankAccounts.map((b) => b.id)).size !== bankAccounts.length) {
      bankAccounts = [];
    }

    const bankName =
      typeof storedStats?.bankName === 'string' ? storedStats.bankName.trim() : '';

    let shouldPersist = false;

    const storedTotalBank =
      isValidAmount(storedStats?.totalBank) ? roundMoney(storedStats.totalBank) : 0;

    // Backward compatibility: If no bankAccounts exist, create initial bank with existing savings
    if (bankAccounts.length === 0 && (storedTotalBank > 0 || bankName)) {
      bankAccounts = [
        {
          id: `bank_${Date.now()}`,
          name: bankName || 'Savings',
          balance: storedTotalBank,
          createdAt: new Date().toISOString(),
        },
      ];
      shouldPersist = true;
    }

    const distributedSum = roundMoney(
      bankAccounts.reduce((sum, b) => sum + b.balance, 0)
    );

    let pendingRollover = normalizePendingRollover(storedStats?.pendingRollover);

    // If pendingRollover is null, trust it — distributeRollover() already cleared it.
    // If pendingRollover exists, trust it — dismissPendingRollover() preserves it.
    // Only correct obviously inflated history records from the old doubling bug:
    // if pendingRollover is null but history shows a total higher than what's in
    // the banks, the history figure was inflated — fix it cosmetically.
    const latestSavingsRecord = savingsHistory[0];
    if (
      !pendingRollover &&
      latestSavingsRecord &&
      latestSavingsRecord.newTotalSavings > distributedSum
    ) {
      latestSavingsRecord.newTotalSavings = distributedSum;
      shouldPersist = true;
    }

    const totalBank = roundMoney(
      distributedSum + (pendingRollover ? pendingRollover.amount : 0)
    );

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
      totalBank,
      pendingRollover,
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
    const advanced = advanceMonthsIfNeeded(stats, expenses, savingsHistory, subscriptions, bankAccounts);
    expenses = advanced.expenses;
    bankAccounts = advanced.bankAccounts;
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

    const hasAcceptedTerms = termsRaw === 'true' || Boolean(stats.bankName);
    const hasConfirmedBackupConsent =
      backupConsentRes.status === 'fulfilled' && backupConsentRes.value === 'true';

    set({
      stats,
      expenses,
      savingsHistory,
      subscriptions,
      bankAccounts,
      hasAcceptedTerms,
      hasConfirmedBackupConsent,
      isLoaded: true,
    });
    if (shouldPersist) persistCurrentData();
    } finally {
      isCurrentlyLoading = false;
    }
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
    const { stats, expenses, savingsHistory, subscriptions, bankAccounts } = get();
    return {
      app: 'penny-wise',
      version: 1,
      exportedAt: new Date().toISOString(),
      data: { stats, expenses, savingsHistory, subscriptions, bankAccounts },
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
      restored.subscriptions,
      restored.bankAccounts
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
      [BANK_ACCOUNTS_KEY, JSON.stringify(advanced.bankAccounts)],
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
      bankAccounts: advanced.bankAccounts,
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
    if (!get().isLoaded) return false;
    const { stats, expenses, savingsHistory, subscriptions, bankAccounts } = get();
    const advanced = advanceMonthsIfNeeded(
      stats,
      expenses,
      savingsHistory,
      subscriptions,
      bankAccounts
    );
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
    const banksChanged = advanced.bankAccounts !== bankAccounts;
    if (statsChanged || expensesChanged || banksChanged || advanced.changed) {
      if (!advanced.changed && expensesChanged) {
        checkedStats.currentRemaining = calculateRemaining(checkedStats, advanced.expenses);
      }
      set({
        stats: checkedStats,
        expenses: advanced.expenses,
        savingsHistory: advanced.history,
        bankAccounts: advanced.bankAccounts,
      });
      persistCurrentData();
    }
    return advanced.changed;
  },

  saveSettings: (bankName: string, allowance: number, savingsBalance: number) => {
    const { stats, expenses, bankAccounts } = get();
    if (!bankName.trim() || !isValidAmount(allowance) || !isValidAmount(savingsBalance)) return;

    const trimmedBankName = bankName.trim();
    const roundedAllowance = roundMoney(allowance);
    const roundedSavings = roundMoney(savingsBalance);

    let updatedBankAccounts = [...bankAccounts];
    if (updatedBankAccounts.length === 0) {
      updatedBankAccounts = [
        {
          id: `bank_${Date.now()}`,
          name: trimmedBankName || 'Primary Savings',
          balance: roundedSavings,
          createdAt: new Date().toISOString(),
        },
      ];
    } else if (updatedBankAccounts.length === 1) {
      updatedBankAccounts = [
        {
          ...updatedBankAccounts[0],
          name: trimmedBankName,
          balance: roundedSavings,
        },
      ];
    }

    const newTotalBank = roundMoney(
      updatedBankAccounts.reduce((sum, b) => sum + b.balance, 0) +
        (stats.pendingRollover?.amount ?? 0)
    );

    const newStats: UserStats = {
      ...stats,
      bankName: trimmedBankName,
      baseAllowance: roundedAllowance,
      extraAllowance: roundMoney(stats.extraAllowance ?? 0),
      totalBank: newTotalBank,
      currentRemaining: null,
    };
    newStats.currentRemaining = calculateRemaining(newStats, expenses);

    set({ stats: newStats, bankAccounts: updatedBankAccounts });
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

  endMonth: (target?: string | Record<string, number>) => {
    const { stats, expenses, savingsHistory, subscriptions, bankAccounts } = get();
    if (stats.baseAllowance === null || stats.totalBank === null || !stats.bankName) return;

    const currentMonth = stats.currentMonthLabel;
    if (savingsHistory.some((record) => record.monthLabel === currentMonth)) return;
    const currentExpenses = applySubscriptionExpenses(subscriptions, expenses, currentMonth);
    const monthExpenses = currentExpenses.filter((e) => e.monthLabel === currentMonth);
    const spent = roundMoney(monthExpenses.reduce((sum, e) => sum + e.amount, 0));
    const totalBudget = roundMoney(stats.baseAllowance + (stats.extraAllowance ?? 0));
    const rolloverSavings = roundMoney(Math.max(0, totalBudget - spent));

    let updatedBankAccounts = [...bankAccounts];
    let pendingRollover: { amount: number; monthLabel: string } | null =
      stats.pendingRollover
        ? {
            amount: roundMoney(stats.pendingRollover.amount),
            monthLabel: stats.pendingRollover.monthLabel,
          }
        : null;

    if (rolloverSavings > 0) {
      if (typeof target === 'string' && updatedBankAccounts.some((b) => b.id === target)) {
        updatedBankAccounts = updatedBankAccounts.map((b) =>
          b.id === target ? { ...b, balance: roundMoney(b.balance + rolloverSavings) } : b
        );
      } else if (typeof target === 'object' && target !== null) {
        const allocatedTotal = roundMoney(
          Object.values(target).reduce(
            (sum, amount) => sum + (Number.isFinite(amount) && amount > 0 ? amount : 0),
            0
          )
        );
        if (
          Math.abs(allocatedTotal - rolloverSavings) > 0.01 ||
          Object.values(target).some((amount) => !Number.isFinite(amount) || amount < 0) ||
          Object.keys(target).some((bankId) =>
            !updatedBankAccounts.some((bank) => bank.id === bankId)
          )
        ) {
          return;
        }
        updatedBankAccounts = updatedBankAccounts.map((b) => {
          const addAmt = target[b.id] ? roundMoney(target[b.id]) : 0;
          return addAmt > 0 ? { ...b, balance: roundMoney(b.balance + addAmt) } : b;
        });
      } else if (updatedBankAccounts.length === 1) {
        updatedBankAccounts = [
          { ...updatedBankAccounts[0], balance: roundMoney(updatedBankAccounts[0].balance + rolloverSavings) },
        ];
      } else {
        pendingRollover = {
          amount: roundMoney((pendingRollover?.amount ?? 0) + rolloverSavings),
          monthLabel: pendingRollover?.monthLabel ?? currentMonth,
        };
      }
    }

    const newTotalBank = roundMoney(
      updatedBankAccounts.reduce((sum, b) => sum + b.balance, 0) +
        (pendingRollover ? pendingRollover.amount : 0)
    );

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
      pendingRollover,
    };
    newStats.currentRemaining = calculateRemaining(newStats, newExpenses);

    set({
      stats: newStats,
      savingsHistory: newHistory,
      expenses: newExpenses,
      bankAccounts: updatedBankAccounts,
    });
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
        AsyncStorage.removeItem(BANK_ACCOUNTS_KEY),
      ]);
      set({
        stats: DEFAULT_STATS,
        expenses: [],
        savingsHistory: [],
        subscriptions: [],
        bankAccounts: [],
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

  addBankAccount: (name: string, initialBalance = 0) => {
    const trimmed = name.trim();
    if (!trimmed) {
      return { ok: false, message: 'Please enter a bank name.' };
    }
    const balance = Number.isFinite(initialBalance) && initialBalance >= 0 ? roundMoney(initialBalance) : 0;
    const { stats, bankAccounts } = get();

    const newBank: BankAccount = {
      id: `bank_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: trimmed,
      balance,
      createdAt: new Date().toISOString(),
    };

    const updatedBankAccounts = [...bankAccounts, newBank];
    const pendingAmount = stats.pendingRollover?.amount ?? 0;
    const newTotalBank = roundMoney(
      updatedBankAccounts.reduce((sum, b) => sum + b.balance, 0) + pendingAmount
    );

    const newStats: UserStats = {
      ...stats,
      totalBank: newTotalBank,
    };

    set({ stats: newStats, bankAccounts: updatedBankAccounts });
    persistCurrentData();
    return { ok: true };
  },

  updateBankAccount: (id: string, name: string, balance: number) => {
    const trimmed = name.trim();
    if (!trimmed) {
      return { ok: false, message: 'Please enter a bank name.' };
    }
    if (!isValidAmount(balance)) {
      return { ok: false, message: 'Please enter a valid balance (0 or greater).' };
    }

    const { stats, bankAccounts } = get();
    const existing = bankAccounts.find((b) => b.id === id);
    if (!existing) {
      return { ok: false, message: 'Bank account not found.' };
    }

    const roundedBalance = roundMoney(balance);
    const updatedBankAccounts = bankAccounts.map((b) =>
      b.id === id ? { ...b, name: trimmed, balance: roundedBalance } : b
    );
    const pendingAmount = stats.pendingRollover?.amount ?? 0;
    const newTotalBank = roundMoney(
      updatedBankAccounts.reduce((sum, b) => sum + b.balance, 0) + pendingAmount
    );

    const newStats: UserStats = {
      ...stats,
      totalBank: newTotalBank,
    };

    set({ stats: newStats, bankAccounts: updatedBankAccounts });
    persistCurrentData();
    return { ok: true };
  },

  deleteBankAccount: (id: string, transferToId?: string) => {
    const { stats, bankAccounts } = get();
    const target = bankAccounts.find((b) => b.id === id);
    if (!target) {
      return { ok: false, message: 'Bank account not found.' };
    }
    if (bankAccounts.length <= 1) {
      return { ok: false, message: 'You must have at least one bank account.' };
    }

    const remaining = bankAccounts.filter((b) => b.id !== id);
    let updatedRemaining = remaining;

    // If the deleted bank had money, return it to the remaining bank
    if (target.balance > 0) {
      const destId = transferToId && remaining.some((b) => b.id === transferToId)
        ? transferToId
        : remaining[0].id;
      updatedRemaining = remaining.map((b) =>
        b.id === destId ? { ...b, balance: roundMoney(b.balance + target.balance) } : b
      );
    }

    const pendingAmount = stats.pendingRollover?.amount ?? 0;
    const newTotalBank = roundMoney(
      updatedRemaining.reduce((sum, b) => sum + b.balance, 0) + pendingAmount
    );

    const newStats: UserStats = {
      ...stats,
      totalBank: newTotalBank,
    };

    set({ stats: newStats, bankAccounts: updatedRemaining });
    persistCurrentData();
    return { ok: true };
  },

  transferBetweenBanks: (fromId: string, toId: string, amount: number) => {
    if (fromId === toId) {
      return { ok: false, message: 'Source and destination must be different.' };
    }
    if (!isValidAmount(amount) || amount <= 0) {
      return { ok: false, message: 'Transfer amount must be greater than 0.' };
    }

    const roundedAmount = roundMoney(amount);
    const { bankAccounts } = get();
    const fromBank = bankAccounts.find((b) => b.id === fromId);
    const toBank = bankAccounts.find((b) => b.id === toId);

    if (!fromBank || !toBank) {
      return { ok: false, message: 'Selected bank accounts could not be found.' };
    }

    if (fromBank.balance < roundedAmount) {
      return {
        ok: false,
        message: `Insufficient balance in ${fromBank.name}. Available: ₱ ${fromBank.balance.toFixed(2)}`,
      };
    }

    const updatedBankAccounts = bankAccounts.map((b) => {
      if (b.id === fromId) {
        return { ...b, balance: roundMoney(b.balance - roundedAmount) };
      }
      if (b.id === toId) {
        return { ...b, balance: roundMoney(b.balance + roundedAmount) };
      }
      return b;
    });

    set({ bankAccounts: updatedBankAccounts });
    persistCurrentData();
    return { ok: true };
  },

  addMoneyToBank: (bankId: string, amount: number, _note?: string) => {
    if (!isValidAmount(amount) || amount <= 0) {
      return { ok: false, message: 'Please enter an amount greater than 0.' };
    }
    const { stats, bankAccounts } = get();
    const targetBank = bankAccounts.find((b) => b.id === bankId);
    if (!targetBank) {
      return { ok: false, message: 'Bank account not found.' };
    }

    const roundedAmount = roundMoney(amount);
    const updatedBankAccounts = bankAccounts.map((b) =>
      b.id === bankId ? { ...b, balance: roundMoney(b.balance + roundedAmount) } : b
    );
    const pendingAmount = stats.pendingRollover?.amount ?? 0;
    const newTotalBank = roundMoney(
      updatedBankAccounts.reduce((sum, b) => sum + b.balance, 0) + pendingAmount
    );

    const newStats: UserStats = {
      ...stats,
      totalBank: newTotalBank,
    };

    set({ stats: newStats, bankAccounts: updatedBankAccounts });
    persistCurrentData();
    return { ok: true };
  },

  distributeRollover: (target: string | Record<string, number>) => {
    const { stats, bankAccounts } = get();
    if (!stats.pendingRollover) {
      return { ok: false, message: 'No pending rollover to distribute.' };
    }
    const rolloverAmount = stats.pendingRollover.amount;

    const allocations: Record<string, number> = {};
    if (typeof target === 'string') {
      const targetBank = bankAccounts.find((b) => b.id === target);
      if (!targetBank) {
        return { ok: false, message: 'Selected bank account was not found.' };
      }
      allocations[target] = rolloverAmount;
    } else if (typeof target === 'object' && target !== null) {
      const totalAllocated = roundMoney(
        Object.values(target).reduce((sum, amt) => sum + (Number.isFinite(amt) ? amt : 0), 0)
      );
      if (Math.abs(totalAllocated - rolloverAmount) > 0.05) {
        return {
          ok: false,
          message: `Total allocated (₱ ${totalAllocated}) must equal rollover amount (₱ ${rolloverAmount}).`,
        };
      }
      for (const [bId, amt] of Object.entries(target)) {
        if (!bankAccounts.some((b) => b.id === bId)) {
          return { ok: false, message: 'One of the selected bank accounts was not found.' };
        }
        if (amt < 0) {
          return { ok: false, message: 'Allocation amounts cannot be negative.' };
        }
        allocations[bId] = roundMoney(amt);
      }
    } else {
      return { ok: false, message: 'Invalid rollover distribution target.' };
    }

    const updatedBankAccounts = bankAccounts.map((b) => {
      const addAmt = allocations[b.id] ? roundMoney(allocations[b.id]) : 0;
      return addAmt > 0 ? { ...b, balance: roundMoney(b.balance + addAmt) } : b;
    });
    const newTotalBank = roundMoney(updatedBankAccounts.reduce((sum, b) => sum + b.balance, 0));

    const newStats: UserStats = {
      ...stats,
      totalBank: newTotalBank,
      pendingRollover: null,
    };

    set({ stats: newStats, bankAccounts: updatedBankAccounts });
    persistCurrentData();
    return { ok: true };
  },

  dismissPendingRollover: () => {
    // Keep pendingRollover intact so unallocated rollover savings are never lost.
  },
  });
});
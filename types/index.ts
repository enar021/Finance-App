export interface UserStats {
  bankName: string;
  baseAllowance: number | null;
  extraAllowance?: number;
  extraMoneyHistory?: ExtraMoneyRecord[];
  rolloverInProgressFromMonth?: string;
  currentRemaining: number | null;
  totalBank: number | null;
  currentMonthLabel: string;
}

export interface ExtraMoneyRecord {
  id: string;
  amount: number;
  note: string;
  date: string;
  monthLabel: string;
}

export interface Expense {
  id: string;
  title: string;
  amount: number;
  date: string;
  monthLabel: string;
  subscriptionId?: string;
}

export interface Subscription {
  id: string;
  name: string;
  amount: number;
  startMonth: string;
  cancelledFromMonth?: string;
  changes?: SubscriptionChange[];
  paymentOverrides?: SubscriptionPaymentOverride[];
}

export interface SubscriptionChange {
  effectiveMonth: string;
  name: string;
  amount: number;
}

export interface SubscriptionPaymentOverride {
  monthLabel: string;
  skipped: boolean;
  amount?: number;
}

export interface SavingsRecord {
  id: string;
  monthLabel: string;
  date: string;
  budget: number;
  spent: number;
  rolloverAmount: number;
  newTotalSavings: number;
  note?: string;
}

export interface FinanceBackup {
  app: 'penny-wise';
  version: 1;
  exportedAt: string;
  data: {
    stats: UserStats;
    expenses: Expense[];
    savingsHistory: SavingsRecord[];
    subscriptions: Subscription[];
  };
}

export type AddExpenseResult =
  | { ok: true }
  | { ok: false; error: 'invalid_input' | 'month_not_finished'; message: string };

export type AddSubscriptionResult =
  | { ok: true }
  | { ok: false; message: string };

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface FinanceState {
  stats: UserStats;
  expenses: Expense[];
  savingsHistory: SavingsRecord[];
  subscriptions: Subscription[];
  isLoaded: boolean;
  hasAcceptedTerms: boolean;
  hasConfirmedBackupConsent: boolean;
  saveStatus: SaveStatus;

  // Actions
  loadData: () => Promise<void>;
  confirmBackupConsent: () => Promise<boolean>;
  clearSaveStatus: () => void;
  createBackup: () => FinanceBackup;
  restoreBackup: (backup: unknown) => Promise<{ ok: boolean; message: string }>;
  acceptTerms: () => void;
  checkAndAdvanceMonth: () => boolean;
  saveSettings: (bankName: string, allowance: number, savingsBalance: number) => void;
  addMoney: (amount: number, note?: string) => { ok: boolean; message?: string };
  addExpense: (title: string, amount: number, date: Date) => AddExpenseResult;
  updateExpense: (id: string, title: string, amount: number, date: Date) => AddExpenseResult;
  addSubscription: (name: string, amount: number, startMonth?: string) => AddSubscriptionResult;
  updateSubscription: (
    id: string,
    name: string,
    amount: number,
    effectiveMonth: string
  ) => AddSubscriptionResult;
  setSubscriptionPaymentOverride: (
    id: string,
    monthLabel: string,
    amount: number | null
  ) => AddSubscriptionResult;
  cancelSubscription: (id: string) => void;
  deleteExpense: (id: string) => void;
  endMonth: () => void;
  resetAllData: () => Promise<boolean>;
  getMonthExpenses: (monthLabel?: string) => Expense[];
}
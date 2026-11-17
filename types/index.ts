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

export type AddExpenseResult =
  | { ok: true }
  | { ok: false; error: 'invalid_input' | 'month_not_finished'; message: string };

export type AddSubscriptionResult =
  | { ok: true }
  | { ok: false; message: string };

export interface FinanceState {
  stats: UserStats;
  expenses: Expense[];
  savingsHistory: SavingsRecord[];
  subscriptions: Subscription[];
  isLoaded: boolean;
  hasAcceptedTerms: boolean;

  // Actions
  loadData: () => Promise<void>;
  acceptTerms: () => void;
  checkAndAdvanceMonth: () => boolean;
  saveSettings: (bankName: string, allowance: number, savingsBalance: number) => void;
  addMoney: (amount: number, note?: string) => { ok: boolean; message?: string };
  addExpense: (title: string, amount: number, date: Date) => AddExpenseResult;
  addSubscription: (name: string, amount: number) => AddSubscriptionResult;
  cancelSubscription: (id: string) => void;
  deleteExpense: (id: string) => void;
  endMonth: () => void;
  resetAllData: () => Promise<boolean>;
  getMonthExpenses: (monthLabel?: string) => Expense[];
}
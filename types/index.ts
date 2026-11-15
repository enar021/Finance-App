export interface UserStats {
  bankName: string;
  baseAllowance: number | null;
  extraAllowance?: number;
  currentRemaining: number | null;
  totalBank: number | null;
  currentMonthLabel: string;
}

export interface Expense {
  id: string;
  title: string;
  amount: number;
  date: string;
  monthLabel: string;
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

export interface FinanceState {
  stats: UserStats;
  expenses: Expense[];
  savingsHistory: SavingsRecord[];
  isLoaded: boolean;

  // Actions
  loadData: () => Promise<void>;
  checkAndAdvanceMonth: () => boolean;
  saveSettings: (bankName: string, allowance: number, savingsBalance: number) => void;
  addMoney: (amount: number, note?: string) => { ok: boolean; message?: string };
  addExpense: (title: string, amount: number, date: Date) => AddExpenseResult;
  deleteExpense: (id: string) => void;
  endMonth: () => void;
  resetAllData: () => Promise<void>;
  getMonthExpenses: (monthLabel?: string) => Expense[];
}
/**
 * Date and currency utility functions for PocketLedger
 */

export function getDateKey(date: Date = new Date()): string {
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseDateKey(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, monthIndex, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== monthIndex ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

export function toDateKey(value: Date | string): string {
  if (value instanceof Date) return getDateKey(value);

  if (parseDateKey(value)) return value;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : getDateKey(date);
}

export function getMonthLabel(date: Date | string = new Date()): string {
  const dateKey = toDateKey(date);
  return dateKey.slice(0, 7);
}

export function formatMonthLabel(label: string): string {
  if (!label) return '';
  const [year, month] = label.split('-');
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function formatDateShort(dateStr: string): string {
  const date = parseDateKey(toDateKey(dateStr));
  if (!date) return '';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatFullDate(dateStr: string): string {
  const date = parseDateKey(toDateKey(dateStr));
  if (!date) return '';
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function getDayName(dateStr: string): string {
  const date = parseDateKey(toDateKey(dateStr));
  if (!date) return '';
  return date.toLocaleDateString('en-US', { weekday: 'long' });
}

export function formatCurrency(amount: number): string {
  const val = isNaN(amount) ? 0 : amount;
  return Number(val).toLocaleString('en-PH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

// "YYYY-MM" labels sort correctly as plain strings
export function isAfterMonth(label: string, reference: string): boolean {
  return label > reference;
}

export function getNextMonthLabel(currentLabel: string): string {
  const [year, month] = currentLabel.split('-').map(Number);
  if (month === 12) {
    return `${year + 1}-01`;
  }
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

export function getPreviousMonthLabel(currentLabel: string): string {
  const [year, month] = currentLabel.split('-').map(Number);
  if (month === 1) {
    return `${year - 1}-12`;
  }
  return `${year}-${String(month - 1).padStart(2, '0')}`;
}

export function getWeekNumberInMonth(date: Date | string): number {
  const parsedDate = typeof date === 'string' ? parseDateKey(toDateKey(date)) : date;
  if (!parsedDate) return 1;
  return Math.ceil(parsedDate.getDate() / 7);
}

export interface MonthWeek {
  weekNumber: number;
  startDate: string;
  endDate: string;
  dateRange: string;
}

export function getMonthWeeks(monthLabel: string): MonthWeek[] {
  const [yearValue, monthValue] = monthLabel.split('-').map(Number);
  const lastDay = new Date(yearValue, monthValue, 0).getDate();
  const weekCount = Math.ceil(lastDay / 7);

  return Array.from({ length: weekCount }, (_, index) => {
    const weekNumber = index + 1;
    const startDay = index * 7 + 1;
    const endDay = Math.min(startDay + 6, lastDay);
    const startDate = `${yearValue}-${String(monthValue).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`;
    const endDate = `${yearValue}-${String(monthValue).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;

    return {
      weekNumber,
      startDate,
      endDate,
      dateRange: `${formatDateShort(startDate)} – ${formatDateShort(endDate)}`,
    };
  });
}
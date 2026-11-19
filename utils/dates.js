"use strict";
/**
 * Date and currency utility functions for PocketLedger
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDateKey = getDateKey;
exports.parseDateKey = parseDateKey;
exports.toDateKey = toDateKey;
exports.getMonthLabel = getMonthLabel;
exports.formatMonthLabel = formatMonthLabel;
exports.formatDateShort = formatDateShort;
exports.formatFullDate = formatFullDate;
exports.getDayName = getDayName;
exports.formatCurrency = formatCurrency;
exports.isAfterMonth = isAfterMonth;
exports.getNextMonthLabel = getNextMonthLabel;
exports.getPreviousMonthLabel = getPreviousMonthLabel;
exports.getWeekNumberInMonth = getWeekNumberInMonth;
exports.getMonthWeeks = getMonthWeeks;
function getDateKey(date = new Date()) {
    if (Number.isNaN(date.getTime()))
        return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
function parseDateKey(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match)
        return null;
    const year = Number(match[1]);
    const monthIndex = Number(match[2]) - 1;
    const day = Number(match[3]);
    const date = new Date(year, monthIndex, day);
    if (date.getFullYear() !== year ||
        date.getMonth() !== monthIndex ||
        date.getDate() !== day) {
        return null;
    }
    return date;
}
function toDateKey(value) {
    if (value instanceof Date)
        return getDateKey(value);
    if (parseDateKey(value))
        return value;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : getDateKey(date);
}
function getMonthLabel(date = new Date()) {
    const dateKey = toDateKey(date);
    return dateKey.slice(0, 7);
}
function formatMonthLabel(label) {
    if (!label)
        return '';
    const [year, month] = label.split('-');
    const date = new Date(Number(year), Number(month) - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}
function formatDateShort(dateStr) {
    const date = parseDateKey(toDateKey(dateStr));
    if (!date)
        return '';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function formatFullDate(dateStr) {
    const date = parseDateKey(toDateKey(dateStr));
    if (!date)
        return '';
    return date.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    });
}
function getDayName(dateStr) {
    const date = parseDateKey(toDateKey(dateStr));
    if (!date)
        return '';
    return date.toLocaleDateString('en-US', { weekday: 'long' });
}
function formatCurrency(amount) {
    const val = isNaN(amount) ? 0 : amount;
    return Number(val).toLocaleString('en-PH', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    });
}
// "YYYY-MM" labels sort correctly as plain strings
function isAfterMonth(label, reference) {
    return label > reference;
}
function getNextMonthLabel(currentLabel) {
    const [year, month] = currentLabel.split('-').map(Number);
    if (month === 12) {
        return `${year + 1}-01`;
    }
    return `${year}-${String(month + 1).padStart(2, '0')}`;
}
function getPreviousMonthLabel(currentLabel) {
    const [year, month] = currentLabel.split('-').map(Number);
    if (month === 1) {
        return `${year - 1}-12`;
    }
    return `${year}-${String(month - 1).padStart(2, '0')}`;
}
function getWeekNumberInMonth(date) {
    const parsedDate = typeof date === 'string' ? parseDateKey(toDateKey(date)) : date;
    if (!parsedDate)
        return 1;
    return Math.ceil(parsedDate.getDate() / 7);
}
function getMonthWeeks(monthLabel) {
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

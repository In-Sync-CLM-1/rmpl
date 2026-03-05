import { format, parseISO } from "date-fns";

/**
 * IST Timezone offset: +5:30 (330 minutes)
 */
const IST_OFFSET_MINUTES = 330;

/**
 * Convert a UTC date to IST
 */
export const toIST = (date: Date | string): Date => {
  const d = typeof date === 'string' ? new Date(date) : date;
  // Get the UTC time and add IST offset
  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  return new Date(utc + IST_OFFSET_MINUTES * 60000);
};

/**
 * Format a date/time in IST timezone
 * @param date - The date to format (can be UTC string or Date object)
 * @param formatString - The date-fns format string
 * @returns Formatted string in IST
 */
export const formatInIST = (date: Date | string | null | undefined, formatString: string): string => {
  if (!date) return "N/A";
  try {
    const istDate = toIST(date);
    return format(istDate, formatString);
  } catch (error) {
    console.error("Error formatting date:", error);
    return "Invalid Date";
  }
};

/**
 * Format time only in IST (HH:mm:ss)
 */
export const formatTimeIST = (date: Date | string | null | undefined): string => {
  return formatInIST(date, "HH:mm:ss");
};

/**
 * Format time only in IST (HH:mm)
 */
export const formatTimeShortIST = (date: Date | string | null | undefined): string => {
  return formatInIST(date, "HH:mm");
};

/**
 * Format date in IST (dd MMM yyyy)
 */
export const formatDateIST = (date: Date | string | null | undefined): string => {
  return formatInIST(date, "dd MMM yyyy");
};

/**
 * Format full datetime in IST
 */
export const formatDateTimeIST = (date: Date | string | null | undefined): string => {
  return formatInIST(date, "dd MMM yyyy, HH:mm:ss");
};

/**
 * Get current time in IST
 */
export const getCurrentTimeIST = (): Date => {
  return toIST(new Date());
};

/**
 * Check if a sign-in time is late (after 09:30 IST)
 * @param signInTime - The sign-in time to check
 * @param graceMinutes - Minutes after 9:30 to still consider on-time (default: 0)
 * @returns true if late, false otherwise
 */
export const isLateSignIn = (signInTime: Date | string, graceMinutes: number = 0): boolean => {
  const istTime = toIST(signInTime);
  const hours = istTime.getHours();
  const minutes = istTime.getMinutes();
  const totalMinutes = hours * 60 + minutes;
  const lateThreshold = 10 * 60 + graceMinutes; // 10:00 AM + grace
  return totalMinutes > lateThreshold;
};

/**
 * Calculate late minutes from expected start time (09:30 IST)
 */
export const getLateMinutes = (signInTime: Date | string): number => {
  const istTime = toIST(signInTime);
  const hours = istTime.getHours();
  const minutes = istTime.getMinutes();
  const totalMinutes = hours * 60 + minutes;
  const expectedStartMinutes = 10 * 60; // 10:00 AM
  return Math.max(0, totalMinutes - expectedStartMinutes);
};

/**
 * Format a date to YYYY-MM-DD using local date components (NOT UTC)
 * This prevents timezone shifts when working with calendar dates
 */
export const formatLocalDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

/**
 * Parse a YYYY-MM-DD string as a local date (NOT UTC)
 * This ensures "2026-02-08" is interpreted as Feb 8th in local time
 */
export const parseLocalDateString = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
};

/**
 * Check if two dates are the same calendar day (ignoring time)
 */
export const isSameLocalDay = (date1: Date, date2: Date): boolean => {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
};

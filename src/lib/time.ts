import { formatInTimeZone, toZonedTime } from 'date-fns-tz';

export const APP_TIMEZONE = 'America/Los_Angeles';

/**
 * Formats a time string (e.g., "14:30") into a 12-hour format with am/pm,
 * interpreting the time as being in the application's standard timezone.
 * If minutes are zero, they are omitted (e.g., "2 pm"). Otherwise, they are included (e.g., "2:30 pm").
 * @param timeStr The time string to format (HH:mm or HH:mm:ss).
 * @returns The formatted 12-hour time string (e.g., "2:30 pm" or "11 am").
 */
export function formatTime12hr(timeStr: string): string {
  if (!timeStr) return '';
  const [hours, minutes] = timeStr.split(':').map(Number);
  
  // Create a UTC date with the given time, then format it in Pacific Time
  // Using a fixed date (2000-01-01) to avoid any date-related timezone issues
  const utcDate = new Date(Date.UTC(2000, 0, 1, hours, minutes));
  
  const formatString = minutes === 0 ? 'h a' : 'h:mm a';
  
  return formatInTimeZone(utcDate, APP_TIMEZONE, formatString);
}

/**
 * Formats a time string (e.g., "21:00") into a 12-hour format with minutes and AM/PM,
 * interpreting the time as being in the application's standard timezone.
 * Example: "21:00" becomes "9:00 PM".
 * @param timeStr The time string to format (HH:mm or HH:mm:ss).
 * @returns The formatted 12-hour time string (e.g., "9:00 PM").
 */
export function formatTime12hrWithMinutes(timeStr: string): string {
  if (!timeStr) return '';
  const [hours, minutes] = timeStr.split(':').map(Number);
  
  // Create a UTC date with the given time, then format it in Pacific Time
  // Using a fixed date (2000-01-01) to avoid any date-related timezone issues
  const utcDate = new Date(Date.UTC(2000, 0, 1, hours, minutes));

  // Format in Pacific Time and convert to uppercase
  const formattedTime = formatInTimeZone(utcDate, APP_TIMEZONE, 'h:mm a');
  
  // Convert am/pm to AM/PM
  const lastTwo = formattedTime.slice(-2);
  return formattedTime.slice(0, -2) + lastTwo.toUpperCase();
} 
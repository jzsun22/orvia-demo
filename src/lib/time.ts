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
  
  // Create a date object representing today in Pacific Time, then set the time.
  const nowInPT = toZonedTime(new Date(), APP_TIMEZONE);
  const dateInPT = new Date(nowInPT.getFullYear(), nowInPT.getMonth(), nowInPT.getDate(), hours, minutes);

  const formatString = minutes === 0 ? 'h a' : 'h:mm a';
  
  return formatInTimeZone(dateInPT, APP_TIMEZONE, formatString);
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
  
  const nowInPT = toZonedTime(new Date(), APP_TIMEZONE);
  const dateInPT = new Date(nowInPT.getFullYear(), nowInPT.getMonth(), nowInPT.getDate(), hours, minutes);

  // 'h:mm a' -> '9:00 pm'
  const formattedTime = formatInTimeZone(dateInPT, APP_TIMEZONE, 'h:mm a');
  
  // '9:00 pm' -> '9:00 PM'
  const lastTwo = formattedTime.slice(-2);
  return formattedTime.slice(0, -2) + lastTwo.toUpperCase();
} 
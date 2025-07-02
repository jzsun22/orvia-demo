import { formatInTimeZone, toDate } from 'date-fns-tz';

export const APP_TIMEZONE = 'America/Los_Angeles';

/**
 * Formats a time string (e.g., "14:30") into a 12-hour format with am/pm,
 * interpreting the time as being in the application's standard timezone.
 * If minutes are zero, they are omitted (e.g., "2 pm"). Otherwise, they are included (e.g., "2:30 pm").
 * @param timeStr The time string to format (HH:mm or HH:mm:ss).
 * @returns The formatted 12-hour time string (e.g., "2:30pm" or "11am").
 */
export function formatTime12hr(timeStr: string): string {
  if (!timeStr) return '';
  try {
    const parts = timeStr.split(':');
    const minutes = parts.length > 1 ? parseInt(parts[1], 10) : 0;
    const formatString = minutes === 0 ? 'ha' : 'h:mma';
    
    const date = toDate(`2000-01-01T${timeStr}`, { timeZone: APP_TIMEZONE });
    
    return formatInTimeZone(date, APP_TIMEZONE, formatString);
  } catch (e) {
    console.error(`Error formatting time string: ${timeStr}`, e);
    const parts = timeStr.split(':');
    if (parts.length >= 2) {
      return `${parts[0]}:${parts[1]}`;
    }
    return timeStr;
  }
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
  try {
    const date = toDate(`2000-01-01T${timeStr}`, { timeZone: APP_TIMEZONE });

    const formattedTime = formatInTimeZone(date, APP_TIMEZONE, 'h:mm a');
    
    const lastTwo = formattedTime.slice(-2);
    return formattedTime.slice(0, -2) + lastTwo.toUpperCase();
  } catch(e) {
    console.error(`Error formatting time string with minutes: ${timeStr}`, e);
    const parts = timeStr.split(':');
    if (parts.length >= 2) {
      return `${parts[0]}:${parts[1]}`;
    }
    return timeStr;
  }
} 
import { LOCALE } from '@/utils/system';

export function formatIsoHour(timeIso: string): string {
  const timeToken = timeIso.split('T')[1];

  return timeToken?.slice(0, 5) ?? timeIso;
}

// Example: Montag, 05.03.2026, 22:05
// Example: Monday, 03/05/2026, 22:05
const FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  weekday: 'long',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
};

/**
 * Formats the given date into a localized string based on predefined locale and format options.
 *
 * @param {Date} [date=new Date()] - The date to format. Defaults to the current date and time if not provided.
 * @return {string} The formatted date string.
 */
export function getFormattedDate(date: Date = new Date()): string {
  return date.toLocaleString(LOCALE, FORMAT_OPTIONS);
}

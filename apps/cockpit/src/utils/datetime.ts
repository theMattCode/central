export const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export type IsoDate = string;

export function isIsoDate(value: unknown): value is IsoDate {
  return typeof value === 'string' && ISO_DATE_REGEX.test(value);
}

export type IsoDateRange = {
  from: IsoDate;
  to: IsoDate;
};

export function isIsoDateRange(value: unknown): value is IsoDateRange {
  return (
    typeof value === 'object' &&
    value !== null &&
    'from' in value &&
    isIsoDate(value.from) &&
    'to' in value &&
    isIsoDate(value.to)
  );
}

function pad(value: number, length: number): string {
  return value.toString().padStart(length, '0');
}

type DateParts = { year: number; month: string; day: string };

function getCurrentLocalDateParts(): DateParts {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: pad(now.getMonth() + 1, 2),
    day: pad(now.getDate(), 2),
  };
}

export function getCurrentLocalDate(): string {
  const { year, month, day } = getCurrentLocalDateParts();
  return `${year}-${month}-${day}`;
}

export function getCurrentLocalMonth(): string {
  const { year, month } = getCurrentLocalDateParts();
  return `${year}-${month}`;
}

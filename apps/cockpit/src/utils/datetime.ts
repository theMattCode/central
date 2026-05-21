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

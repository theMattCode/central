import { describe, expect, it, vi } from 'vitest';
import { getCurrentLocalDate, getCurrentLocalMonth } from '@/utils/datetime.ts';

describe('datetime', () => {
  it('getCurrentLocalDate should return current local date in YYYY-MM-DD format', () => {
    const currentDate = getCurrentLocalDate();
    expect(currentDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('getCurrentLocalMonth should return current local month in YYYY-MM format', () => {
    const currentMonth = getCurrentLocalMonth();
    expect(currentMonth).toMatch(/^\d{4}-\d{2}$/);
  });

  it('returns current local date', () => {
    vi.setSystemTime(new Date(2026, 4, 31));
    const date = getCurrentLocalDate();
    expect(date).toMatch(/^2026-05-31/);
  });

  it('returns current local month', () => {
    vi.setSystemTime(new Date(2026, 5, 30));
    const month = getCurrentLocalMonth();
    expect(month).toMatch(/^2026-06/);
  });
});

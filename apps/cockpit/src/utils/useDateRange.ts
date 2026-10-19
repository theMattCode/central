import { createStore } from 'solid-js';
import type { IsoDate, IsoDateRange } from '@/utils/datetime.ts';

export function useDateRange() {
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const [dateRange, setDateRange] = createStore<IsoDateRange>({
    from: firstOfMonth.toISOString().split('T')[0],
    to: today.toISOString().split('T')[0],
  });

  const onFromChanged = (from: IsoDate) => setDateRange((range) => void (range.from = from));
  const onToChanged = (to: IsoDate) => setDateRange((range) => void (range.to = to));

  return { dateRange, onFromChanged, onToChanged };
}

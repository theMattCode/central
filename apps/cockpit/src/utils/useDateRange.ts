import { useCallback, useMemo, useState } from 'react';
import type { IsoDate, IsoDateRange } from '@/utils/datetime.ts';

export function useDateRange() {
  const [dateRange, setDateRange] = useState<IsoDateRange>(() => {
    const today = new Date();
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const from: IsoDate = firstOfMonth.toISOString().split('T')[0];
    const to: IsoDate = today.toISOString().split('T')[0];
    return { from, to };
  });

  const onFromChanged = useCallback((from: IsoDate) => {
    setDateRange((range) => ({ ...range, from }));
  }, []);
  const onToChanged = useCallback((to: IsoDate) => {
    setDateRange((range) => ({ ...range, to }));
  }, []);

  return useMemo(
    () => ({ dateRange, onFromChanged, onToChanged }),
    [dateRange],
  );
}

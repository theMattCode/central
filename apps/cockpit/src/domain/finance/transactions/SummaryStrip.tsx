import type { Summary } from '@/domain/finance/transactions/model.ts';
import { KPISection } from '@/components/KPI/KPISection.tsx/KPISection.tsx';

const formatter = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
});

export function SummaryStrip({ summary }: { summary: Summary }) {
  const income = Number.parseFloat(summary.incomeTotal.amount);
  const expenses = Number.parseFloat(summary.expenseTotal.amount);
  const net = Number.parseFloat(summary.netTotal.amount);

  return (
    <>
      <KPISection label="Income" value={formatter.format(income)} tone="positive" />
      <KPISection label="Expenses" value={formatter.format(expenses)} tone="negative" />
      <KPISection label="Net" value={formatter.format(net)} tone={net < 0 ? 'negative' : 'positive'} />
    </>
  );
}

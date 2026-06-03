import type { Summary } from '@/domain/finance/transactions/model.ts';
import { KPISection } from '@/domain/finance/transactions/KPISection.tsx';

export function SummaryStrip({ summary }: { summary: Summary }) {
  const income = Number.parseFloat(summary.incomeTotal.amount);
  const expenses = Number.parseFloat(summary.expenseTotal.amount);
  const net = Number.parseFloat(summary.netTotal.amount);

  return (
    <>
      <KPISection label="Income" value={income} tone="positive" />
      <KPISection label="Expenses" value={expenses} tone="negative" />
      <KPISection label="Net" value={net} tone={net < 0 ? 'negative' : 'positive'} />
    </>
  );
}

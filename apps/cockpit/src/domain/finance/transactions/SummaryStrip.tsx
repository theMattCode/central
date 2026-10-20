import type { Summary } from '@/domain/finance/transactions/model.ts';
import { KPISection } from '@/components/KPI/KPISection.tsx';

const formatter = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
});

export function SummaryStrip(props: { summary: Summary }) {
  return (
    <>
      <KPISection
        label="Income"
        value={formatter.format(Number.parseFloat(props.summary.incomeTotal.amount))}
        tone="positive"
      />
      <KPISection
        label="Expenses"
        value={formatter.format(Number.parseFloat(props.summary.expenseTotal.amount))}
        tone="negative"
      />
      <KPISection
        label="Net"
        value={formatter.format(Number.parseFloat(props.summary.netTotal.amount))}
        tone={Number.parseFloat(props.summary.netTotal.amount) < 0 ? 'negative' : 'positive'}
      />
    </>
  );
}

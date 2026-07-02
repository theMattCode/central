import { createFileRoute } from '@tanstack/react-router';
import { Transactions } from '@/domain/finance/transactions/Transactions.tsx';
import { GridLayout } from '@/components/ContentLayout/GridLayout.tsx';

export const Route = createFileRoute('/finance/transactions')({
  component: TransactionsRoute,
  staticData: {
    crumb: { label: 'Transactions' },
  },
});

function TransactionsRoute() {
  return (
    <GridLayout>
      <Transactions />
    </GridLayout>
  );
}

import { createFileRoute } from '@tanstack/react-router';
import { Transactions } from '@/components/organisms/finance/transactions/Transactions.tsx';

export const Route = createFileRoute('/finance/transactions')({
  component: TransactionsRoute,
  staticData: {
    crumb: { label: 'Transactions' },
  },
});

function TransactionsRoute() {
  return <Transactions />;
}

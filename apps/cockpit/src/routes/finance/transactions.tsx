import { createFileRoute } from '@tanstack/react-router';
import { FinanceTransactionsTracker } from '@/components/organisms/finance/transactions/FinanceTransactionsTracker.tsx';

export const Route = createFileRoute('/finance/transactions')({
  component: FinanceTransactionsRoute,
});

function FinanceTransactionsRoute() {
  return <FinanceTransactionsTracker />;
}

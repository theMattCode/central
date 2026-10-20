import { createFileRoute } from '@tanstack/solid-router';
import { Transactions } from '@/domain/finance/transactions/Transactions.tsx';
import { GridLayout } from '@/components/GridLayout/GridLayout.tsx';
import { FinanceClientProvider } from '@/domain/finance/FinanceClientContext.tsx';
import { DEFAULT_FINANCE_CLIENT } from '@/domain/finance/financeClient.ts';

export const Route = createFileRoute('/finance/transactions')({
  component: TransactionsRoute,
  staticData: {
    crumb: { label: 'Transactions' },
  },
});

function TransactionsRoute() {
  return (
    <FinanceClientProvider client={DEFAULT_FINANCE_CLIENT}>
      <GridLayout>
        <Transactions />
      </GridLayout>
    </FinanceClientProvider>
  );
}

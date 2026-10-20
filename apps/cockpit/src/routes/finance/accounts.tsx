import { createFileRoute } from '@tanstack/solid-router';
import { AccountsPage } from '@/domain/finance/accounts/AccountsPage.tsx';
import { GridLayout } from '@/components/GridLayout/GridLayout.tsx';
import { FinanceClientProvider } from '@/domain/finance/FinanceClientContext.tsx';
import { DEFAULT_FINANCE_CLIENT } from '@/domain/finance/financeClient.ts';

export const Route = createFileRoute('/finance/accounts')({
  component: AccountsRoute,
  staticData: {
    crumb: { label: 'Accounts' },
  },
});

function AccountsRoute() {
  return (
    <FinanceClientProvider client={DEFAULT_FINANCE_CLIENT}>
      <GridLayout>
        <AccountsPage />
      </GridLayout>
    </FinanceClientProvider>
  );
}

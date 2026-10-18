import { createFileRoute } from '@tanstack/react-router';
import { AccountsPage } from '@/domain/finance/accounts/AccountsPage.tsx';
import { GridLayout } from '@/components/GridLayout/GridLayout.tsx';

export const Route = createFileRoute('/finance/accounts')({
  component: AccountsRoute,
  staticData: {
    crumb: { label: 'Accounts' },
  },
});

function AccountsRoute() {
  return (
    <GridLayout>
      <AccountsPage />
    </GridLayout>
  );
}

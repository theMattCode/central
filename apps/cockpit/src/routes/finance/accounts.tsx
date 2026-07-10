import { createFileRoute } from '@tanstack/react-router';
import { MdAccountBalance as AccountsIcon } from 'react-icons/md';
import { AccountsPage } from '@/domain/finance/accounts/AccountsPage';

export const Route = createFileRoute('/finance/accounts')({
  component: AccountsPage,
  staticData: {
    crumb: { label: 'Accounts', icon: AccountsIcon },
  },
});

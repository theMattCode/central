/* @vitest-environment jsdom */
import type { PropsWithChildren } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FinancialAccount } from '@/domain/finance/accounts/model.ts';
import { AccountsPage } from '@/domain/finance/accounts/AccountsPage.tsx';
import type { FinanceClient } from '@/domain/finance/financeClient.ts';
import { FinanceClientProvider } from '@/domain/finance/FinanceClientContext.tsx';

function createAccount(partial: Partial<FinancialAccount> & Pick<FinancialAccount, 'id' | 'name'>): FinancialAccount {
  return {
    id: partial.id,
    name: partial.name,
    accountType: partial.accountType ?? 'bank',
    primaryCurrencyCode: partial.primaryCurrencyCode ?? 'EUR',
    displayOrder: partial.displayOrder ?? 0,
    status: partial.status ?? 'active',
    archivedAt: partial.archivedAt ?? null,
    createdAt: partial.createdAt ?? '2026-10-17T10:00:00Z',
    updatedAt: partial.updatedAt ?? '2026-10-17T10:00:00Z',
  };
}

describe('AccountsPage', () => {
  const user = userEvent.setup();
  const getAccountsMock = vi.fn<FinanceClient['getAccounts']>();
  const createAccountMock = vi.fn<FinanceClient['createAccount']>();

  const financeClientMock: FinanceClient = {
    getTransactions: () => Promise.reject(new Error('not used by accounts')),
    getAccounts: (options) => getAccountsMock(options),
    createAccount: (input) => createAccountMock(input),
  };

  function TestWrapper({ children }: PropsWithChildren) {
    return <FinanceClientProvider client={financeClientMock}>{children}</FinanceClientProvider>;
  }

  beforeEach(() => {
    getAccountsMock.mockReset();
    createAccountMock.mockReset();
    getAccountsMock.mockResolvedValue([]);
  });

  it('lists accounts with their type and currency', async () => {
    getAccountsMock.mockResolvedValue([
      createAccount({ id: 'giro', name: 'Girokonto', accountType: 'bank' }),
      createAccount({ id: 'depot', name: 'Depot', accountType: 'investment', primaryCurrencyCode: 'USD' }),
    ]);

    render(<AccountsPage />, { wrapper: TestWrapper });

    const list = await screen.findByRole('list', { name: 'Accounts' });
    const items = within(list).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual(['GirokontoBankEUR', 'DepotInvestmentUSD']);
  });

  it('shows an empty state when there are no accounts', async () => {
    render(<AccountsPage />, { wrapper: TestWrapper });

    expect(await screen.findByText('No accounts yet.')).toBeDefined();
  });

  it('offers every account type', async () => {
    render(<AccountsPage />, { wrapper: TestWrapper });

    const options = within(screen.getByLabelText('Type')).getAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual(['Cash', 'Bank', 'Credit', 'Loan', 'Investment']);
  });

  it('creates an account and shows it after reloading', async () => {
    const created = createAccount({ id: 'depot', name: 'Depot', accountType: 'investment' });
    createAccountMock.mockResolvedValue(created);
    getAccountsMock.mockResolvedValueOnce([]).mockResolvedValue([created]);
    render(<AccountsPage />, { wrapper: TestWrapper });

    await user.type(screen.getByLabelText('Name'), '  Depot ');
    await user.selectOptions(screen.getByLabelText('Type'), 'investment');
    await user.click(screen.getByRole('button', { name: 'Add account' }));

    expect(createAccountMock).toHaveBeenCalledWith({
      name: 'Depot',
      accountType: 'investment',
      primaryCurrencyCode: 'EUR',
    });
    const list = await screen.findByRole('list', { name: 'Accounts' });
    expect(within(list).getByText('Depot')).toBeDefined();
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('');
  });

  it('upper-cases the currency while typing', async () => {
    render(<AccountsPage />, { wrapper: TestWrapper });
    const currency = screen.getByLabelText('Currency') as HTMLInputElement;

    await user.clear(currency);
    await user.type(currency, 'usd');

    expect(currency.value).toBe('USD');
  });

  it('keeps the form and shows the backend error when creating fails', async () => {
    createAccountMock.mockRejectedValue(new Error('Field primaryCurrencyCode must be an ISO 4217 code like EUR'));
    render(<AccountsPage />, { wrapper: TestWrapper });

    await user.type(screen.getByLabelText('Name'), 'Wallet');
    await user.click(screen.getByRole('button', { name: 'Add account' }));

    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Field primaryCurrencyCode must be an ISO 4217 code like EUR',
    );
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Wallet');
    await waitFor(() => expect(getAccountsMock).toHaveBeenCalledTimes(1));
  });
});

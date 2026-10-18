/* @vitest-environment jsdom */
import type { PropsWithChildren } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
  const updateAccountMock = vi.fn<FinanceClient['updateAccount']>();
  const archiveAccountMock = vi.fn<FinanceClient['archiveAccount']>();
  const restoreAccountMock = vi.fn<FinanceClient['restoreAccount']>();
  const reorderAccountsMock = vi.fn<FinanceClient['reorderAccounts']>();

  const financeClientMock: FinanceClient = {
    getTransactions: () => Promise.reject(new Error('not used by accounts')),
    getAccounts: (options) => getAccountsMock(options),
    createAccount: (input) => createAccountMock(input),
    updateAccount: (id, input) => updateAccountMock(id, input),
    archiveAccount: (id) => archiveAccountMock(id),
    restoreAccount: (id) => restoreAccountMock(id),
    reorderAccounts: (ids) => reorderAccountsMock(ids),
  };

  function TestWrapper({ children }: PropsWithChildren) {
    return <FinanceClientProvider client={financeClientMock}>{children}</FinanceClientProvider>;
  }

  beforeEach(() => {
    getAccountsMock.mockReset();
    createAccountMock.mockReset();
    updateAccountMock.mockReset();
    archiveAccountMock.mockReset();
    restoreAccountMock.mockReset();
    reorderAccountsMock.mockReset();
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

  it('edits an account and shows the change after reloading', async () => {
    const giro = createAccount({ id: 'giro', name: 'Girokonto', accountType: 'bank' });
    const renamed = { ...giro, name: 'Main account', primaryCurrencyCode: 'CHF' };
    updateAccountMock.mockResolvedValue(renamed);
    getAccountsMock.mockResolvedValueOnce([giro]).mockResolvedValue([renamed]);
    render(<AccountsPage />, { wrapper: TestWrapper });

    await user.click(await screen.findByRole('button', { name: 'Edit Girokonto' }));
    const editor = screen.getByRole('form', { name: 'Edit Girokonto' });
    expect((within(editor).getByLabelText('Name') as HTMLInputElement).value).toBe('Girokonto');
    expect((within(editor).getByLabelText('Type') as HTMLSelectElement).value).toBe('bank');
    await user.clear(within(editor).getByLabelText('Name'));
    await user.type(within(editor).getByLabelText('Name'), 'Main account ');
    await user.clear(within(editor).getByLabelText('Currency'));
    await user.type(within(editor).getByLabelText('Currency'), 'chf');
    await user.click(within(editor).getByRole('button', { name: 'Save account' }));

    expect(updateAccountMock).toHaveBeenCalledWith('giro', {
      name: 'Main account',
      accountType: 'bank',
      primaryCurrencyCode: 'CHF',
    });
    const list = await screen.findByRole('list', { name: 'Accounts' });
    expect(await within(list).findByText('Main account')).toBeDefined();
    expect(screen.queryByRole('form', { name: 'Edit Girokonto' })).toBeNull();
  });

  it('closes the editor without saving on cancel', async () => {
    getAccountsMock.mockResolvedValue([createAccount({ id: 'giro', name: 'Girokonto' })]);
    render(<AccountsPage />, { wrapper: TestWrapper });

    await user.click(await screen.findByRole('button', { name: 'Edit Girokonto' }));
    await user.click(screen.getByRole('button', { name: 'Cancel editing' }));

    expect(screen.queryByRole('form', { name: 'Edit Girokonto' })).toBeNull();
    expect(updateAccountMock).not.toHaveBeenCalled();
  });

  it('keeps the editor open and shows the backend error when saving fails', async () => {
    getAccountsMock.mockResolvedValue([createAccount({ id: 'giro', name: 'Girokonto' })]);
    updateAccountMock.mockRejectedValue(new Error("The currency of a financial account with entries can't be changed"));
    render(<AccountsPage />, { wrapper: TestWrapper });

    await user.click(await screen.findByRole('button', { name: 'Edit Girokonto' }));
    const editor = screen.getByRole('form', { name: 'Edit Girokonto' });
    await user.clear(within(editor).getByLabelText('Currency'));
    await user.type(within(editor).getByLabelText('Currency'), 'USD');
    await user.click(within(editor).getByRole('button', { name: 'Save account' }));

    expect(await within(editor).findByRole('alert')).toHaveProperty(
      'textContent',
      "The currency of a financial account with entries can't be changed",
    );
    expect(screen.getByRole('form', { name: 'Edit Girokonto' })).toBeDefined();
  });

  it('shows archived accounts in a collapsed section without edit actions', async () => {
    getAccountsMock.mockResolvedValue([
      createAccount({ id: 'giro', name: 'Girokonto' }),
      createAccount({
        id: 'old',
        name: 'Old wallet',
        accountType: 'cash',
        status: 'archived',
        archivedAt: '2026-10-01T10:00:00Z',
      }),
    ]);
    render(<AccountsPage />, { wrapper: TestWrapper });

    const active = await screen.findByRole('list', { name: 'Accounts' });
    expect(
      within(active)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['GirokontoBankEUR']);
    const toggle = screen.getByRole('button', { name: 'Archived (1)' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('list', { name: 'Archived accounts' })).toBeNull();

    await user.click(toggle);

    const archived = screen.getByRole('list', { name: 'Archived accounts' });
    expect(
      within(archived)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['Old walletCashEUR']);
    expect(within(archived).queryByRole('button', { name: 'Edit Old wallet' })).toBeNull();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });

  it('hides the archived section when nothing is archived', async () => {
    getAccountsMock.mockResolvedValue([createAccount({ id: 'giro', name: 'Girokonto' })]);
    render(<AccountsPage />, { wrapper: TestWrapper });

    await screen.findByRole('list', { name: 'Accounts' });

    expect(screen.queryByRole('button', { name: /Archived/ })).toBeNull();
  });

  it('archives an account and shows it as archived after reloading', async () => {
    const giro = createAccount({ id: 'giro', name: 'Girokonto' });
    const archivedGiro = { ...giro, status: 'archived' as const, archivedAt: '2026-10-17T12:00:00Z' };
    archiveAccountMock.mockResolvedValue(archivedGiro);
    getAccountsMock.mockResolvedValueOnce([giro]).mockResolvedValue([archivedGiro]);
    render(<AccountsPage />, { wrapper: TestWrapper });

    await user.click(await screen.findByRole('button', { name: 'Archive Girokonto' }));

    expect(archiveAccountMock).toHaveBeenCalledWith('giro');
    expect(await screen.findByRole('button', { name: 'Archived (1)' })).toBeDefined();
    expect(screen.getByText('No active accounts.')).toBeDefined();
  });

  it('restores an archived account', async () => {
    const old = createAccount({
      id: 'old',
      name: 'Old wallet',
      status: 'archived',
      archivedAt: '2026-10-01T10:00:00Z',
    });
    const restored = { ...old, status: 'active' as const, archivedAt: null };
    restoreAccountMock.mockResolvedValue(restored);
    getAccountsMock.mockResolvedValueOnce([old]).mockResolvedValue([restored]);
    render(<AccountsPage />, { wrapper: TestWrapper });

    await user.click(await screen.findByRole('button', { name: 'Archived (1)' }));
    await user.click(screen.getByRole('button', { name: 'Restore Old wallet' }));

    expect(restoreAccountMock).toHaveBeenCalledWith('old');
    const active = await screen.findByRole('list', { name: 'Accounts' });
    expect(within(active).getByText('Old wallet')).toBeDefined();
    expect(screen.queryByRole('button', { name: /Archived/ })).toBeNull();
  });

  it('shows the backend error when archiving fails', async () => {
    getAccountsMock.mockResolvedValue([createAccount({ id: 'giro', name: 'Girokonto' })]);
    archiveAccountMock.mockRejectedValue(new Error('Financial account giro was not found'));
    render(<AccountsPage />, { wrapper: TestWrapper });

    await user.click(await screen.findByRole('button', { name: 'Archive Girokonto' }));

    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Financial account giro was not found');
  });

  describe('reordering', () => {
    const accounts = [
      createAccount({ id: 'a', name: 'A', displayOrder: 0 }),
      createAccount({ id: 'b', name: 'B', displayOrder: 1 }),
      createAccount({ id: 'c', name: 'C', displayOrder: 2 }),
    ];

    // jsdom has no layout; give each list item its own row so dnd-kit can measure positions.
    beforeEach(() => {
      vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
        const item = this.closest('li');
        const index = item?.parentElement ? Array.from(item.parentElement.children).indexOf(item) : 0;
        const top = index * 50;
        return { x: 0, y: top, top, left: 0, right: 300, bottom: top + 40, width: 300, height: 40, toJSON: () => ({}) };
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    function activeNames() {
      return within(screen.getByRole('list', { name: 'Accounts' }))
        .getAllByRole('listitem')
        .map((item) => item.textContent);
    }

    it('moves an account down with the keyboard and saves the new order', async () => {
      getAccountsMock.mockResolvedValue(accounts);
      reorderAccountsMock.mockResolvedValue([accounts[1], accounts[0], accounts[2]]);
      render(<AccountsPage />, { wrapper: TestWrapper });

      const handle = await screen.findByRole('button', { name: 'Reorder A' });
      handle.focus();
      await user.keyboard(' ');
      await user.keyboard('{ArrowDown}');
      await user.keyboard(' ');

      await waitFor(() => expect(reorderAccountsMock).toHaveBeenCalledWith(['b', 'a', 'c']));
      expect(activeNames()).toEqual(['BBankEUR', 'ABankEUR', 'CBankEUR']);
    });

    it('snaps back and shows the error when saving the order fails', async () => {
      getAccountsMock.mockResolvedValue(accounts);
      reorderAccountsMock.mockRejectedValue(
        new Error('Field accountIds must contain every active financial account exactly once'),
      );
      render(<AccountsPage />, { wrapper: TestWrapper });

      const handle = await screen.findByRole('button', { name: 'Reorder A' });
      handle.focus();
      await user.keyboard(' ');
      await user.keyboard('{ArrowDown}');
      await user.keyboard(' ');

      expect(await screen.findByRole('alert')).toHaveProperty(
        'textContent',
        'Field accountIds must contain every active financial account exactly once',
      );
      expect(activeNames()).toEqual(['ABankEUR', 'BBankEUR', 'CBankEUR']);
    });

    it('does not offer reordering for archived accounts', async () => {
      getAccountsMock.mockResolvedValue([
        accounts[0],
        createAccount({ id: 'old', name: 'Old', status: 'archived', archivedAt: '2026-10-01T10:00:00Z' }),
      ]);
      render(<AccountsPage />, { wrapper: TestWrapper });

      await user.click(await screen.findByRole('button', { name: 'Archived (1)' }));

      expect(screen.queryByRole('button', { name: 'Reorder Old' })).toBeNull();
    });
  });
});

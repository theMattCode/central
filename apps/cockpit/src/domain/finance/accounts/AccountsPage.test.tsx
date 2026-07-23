/* @vitest-environment jsdom */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountsPage } from '@/domain/finance/accounts/AccountsPage.tsx';
import { FinanceClientProvider } from '@/domain/finance/FinanceClientContext.tsx';
import type { FinancialAccount } from '@/domain/finance/accounts/model.ts';
import type {
  AccountsResponse,
  FinanceClient,
  FinancialAccountCreateInput,
  FinancialAccountUpdateInput,
  TransactionsResponse,
} from '@/domain/finance/financeClient.ts';
import type { IsoDateRange } from '@/utils/datetime.ts';

const account = (partial: Partial<FinancialAccount> = {}): FinancialAccount => ({
  id: partial.id ?? 'main-checking',
  name: partial.name ?? 'Main Checking',
  accountType: partial.accountType ?? 'bank',
  primaryCurrencyCode: partial.primaryCurrencyCode ?? 'EUR',
  displayOrder: partial.displayOrder ?? 10,
  status: partial.status ?? 'active',
  archivedAt: partial.archivedAt,
  createdAt: partial.createdAt ?? '2026-06-01T10:00:00Z',
  updatedAt: partial.updatedAt ?? '2026-06-01T10:00:00Z',
});

describe('AccountsPage', () => {
  const getAccountsMock = vi.fn<FinanceClient['getAccounts']>();
  const createAccountMock = vi.fn<FinanceClient['createAccount']>();
  const updateAccountMock = vi.fn<FinanceClient['updateAccount']>();

  const financeClient: FinanceClient = {
    getAccounts(options?: { signal?: AbortSignal }): Promise<AccountsResponse> {
      return getAccountsMock(options);
    },
    createAccount(input: FinancialAccountCreateInput): Promise<FinancialAccount> {
      return createAccountMock(input);
    },
    updateAccount(input: FinancialAccountUpdateInput): Promise<FinancialAccount> {
      return updateAccountMock(input);
    },
    archiveAccount() {
      throw new Error('archive should not be called by AccountsPage tests');
    },
    getTransactions(_input: IsoDateRange, _options?: { signal?: AbortSignal }): Promise<TransactionsResponse> {
      throw new Error('transactions should not be called by AccountsPage tests');
    },
  };

  beforeEach(() => {
    getAccountsMock.mockReset();
    createAccountMock.mockReset();
    updateAccountMock.mockReset();
  });

  function renderPage() {
    return render(
      <FinanceClientProvider client={financeClient}>
        <AccountsPage />
      </FinanceClientProvider>,
    );
  }

  it('creates a new account from a first-card draft and reloads the ordered list', async () => {
    const createdAccount = account({ id: 'new-account', name: 'Travel Cash', accountType: 'cash', displayOrder: 20 });
    getAccountsMock.mockResolvedValueOnce({ accounts: [] }).mockResolvedValueOnce({ accounts: [createdAccount] });
    createAccountMock.mockResolvedValue(createdAccount);
    const user = userEvent.setup();

    renderPage();

    await screen.findByRole('button', { name: 'Add' });
    await user.click(screen.getByRole('button', { name: 'Add' }));

    const nameInput = screen.getByLabelText('Name');
    expect(document.activeElement).toBe(nameInput);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Enter a name.')).toBeTruthy();
    expect(createAccountMock).not.toHaveBeenCalled();

    await user.type(nameInput, 'Travel Cash');
    await user.selectOptions(screen.getByLabelText('Account type'), 'cash');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(createAccountMock).toHaveBeenCalledWith({
        name: 'Travel Cash',
        accountType: 'cash',
        primaryCurrencyCode: 'EUR',
      });
    });
    await screen.findByRole('heading', { name: 'Travel Cash' });
    expect(getAccountsMock).toHaveBeenCalledTimes(2);
  });

  it('edits only an existing account name and reloads after the server accepts it', async () => {
    const initialAccount = account();
    const updatedAccount = account({ name: 'Everyday Checking', updatedAt: '2026-06-02T10:00:00Z' });
    getAccountsMock
      .mockResolvedValueOnce({ accounts: [initialAccount] })
      .mockResolvedValueOnce({ accounts: [updatedAccount] });
    updateAccountMock.mockResolvedValue(updatedAccount);
    const user = userEvent.setup();

    renderPage();

    await screen.findByRole('heading', { name: 'Main Checking' });
    await user.click(screen.getByRole('button', { name: 'Edit Main Checking' }));

    expect(screen.queryByLabelText('Account type')).toBeNull();
    expect(screen.getByText('Bank · EUR')).toBeTruthy();
    const nameInput = screen.getByLabelText('Name');
    await user.clear(nameInput);
    await user.type(nameInput, 'Everyday Checking');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(updateAccountMock).toHaveBeenCalledWith({
        id: initialAccount.id,
        name: 'Everyday Checking',
        displayOrder: initialAccount.displayOrder,
      });
    });
    await screen.findByRole('heading', { name: 'Everyday Checking' });
    expect(getAccountsMock).toHaveBeenCalledTimes(2);
  });
});

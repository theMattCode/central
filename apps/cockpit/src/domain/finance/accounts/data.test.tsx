/* @vitest-environment jsdom */
import type { PropsWithChildren } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useFinancialAccounts } from '@/domain/finance/accounts/data.ts';
import type { FinancialAccount } from '@/domain/finance/accounts/model.ts';
import {
  type AccountsResponse,
  type FinanceClient,
  type TransactionsResponse,
} from '@/domain/finance/financeClient.ts';
import { FinanceClientProvider } from '@/domain/finance/FinanceClientContext.tsx';
import type { IsoDateRange } from '@/utils/datetime.ts';

describe('useFinancialAccounts', () => {
  const getAccountsMock = vi.fn<FinanceClient['getAccounts']>();

  beforeEach(() => {
    getAccountsMock.mockReset();
    getAccountsMock.mockResolvedValue({ accounts: [] });
  });

  const financeClientMock: FinanceClient = {
    getAccounts(options?: { signal?: AbortSignal }): Promise<AccountsResponse> {
      return getAccountsMock(options);
    },
    createAccount() {
      throw new Error('create account should not be called by account data tests');
    },
    updateAccount() {
      throw new Error('update account should not be called by account data tests');
    },
    archiveAccount() {
      throw new Error('archive account should not be called by account data tests');
    },
    getTransactions(_input: IsoDateRange, _options?: { signal?: AbortSignal }): Promise<TransactionsResponse> {
      throw new Error('transactions should not be called by account tests');
    },
  };

  function TestWrapper({ children }: PropsWithChildren) {
    return <FinanceClientProvider client={financeClientMock}>{children}</FinanceClientProvider>;
  }

  function createAccount(partial: Partial<FinancialAccount> & Pick<FinancialAccount, 'id'>): FinancialAccount {
    return {
      id: partial.id,
      name: partial.name ?? 'Main Checking',
      accountType: partial.accountType ?? 'bank',
      primaryCurrencyCode: partial.primaryCurrencyCode ?? 'EUR',
      displayOrder: partial.displayOrder ?? 0,
      status: partial.status ?? 'active',
      archivedAt: partial.archivedAt,
      createdAt: partial.createdAt ?? '2026-05-12T10:00:00Z',
      updatedAt: partial.updatedAt ?? '2026-05-12T10:00:00Z',
    };
  }

  it('loads accounts and separates active accounts from archived history', async () => {
    const activeAccount = createAccount({ id: 'active' });
    const archivedAccount = createAccount({
      id: 'archived',
      name: 'Old Card',
      status: 'archived',
      archivedAt: '2026-05-13T10:00:00Z',
    });
    getAccountsMock.mockResolvedValueOnce({ accounts: [activeAccount, archivedAccount] });

    const { result } = renderHook(() => useFinancialAccounts(), { wrapper: TestWrapper });

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(getAccountsMock).toHaveBeenCalledWith({ signal: expect.any(AbortSignal) });
    expect(result.current.error).toBeNull();
    expect(result.current.data).toEqual({
      accounts: [activeAccount, archivedAccount],
      activeAccounts: [activeAccount],
      archivedAccounts: [archivedAccount],
    });
  });

  it('reloads accounts when requested', async () => {
    const initialAccount = createAccount({ id: 'initial' });
    const reloadedAccount = createAccount({ id: 'reloaded', name: 'Reloaded' });
    getAccountsMock
      .mockResolvedValueOnce({ accounts: [initialAccount] })
      .mockResolvedValueOnce({ accounts: [reloadedAccount] });

    const { result } = renderHook(() => useFinancialAccounts(), { wrapper: TestWrapper });

    await waitFor(() => {
      expect(result.current.data?.accounts).toEqual([initialAccount]);
    });

    act(() => result.current.reload());

    await waitFor(() => {
      expect(result.current.data?.accounts).toEqual([reloadedAccount]);
    });

    expect(getAccountsMock).toHaveBeenCalledTimes(2);
  });
});

/* @vitest-environment jsdom */
import type { PropsWithChildren } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Summary, Transaction } from '@/domain/finance/transactions/model.ts';
import { useTransactions } from '@/domain/finance/transactions/data.ts';
import { type FinanceClient, type TransactionsResponse } from '@/domain/finance/financeClient.ts';
import { FinanceClientProvider } from '@/domain/finance/FinanceClientContext.tsx';
import type { IsoDateRange } from '@/utils/datetime.ts';

describe('useTransactions', () => {
  const getTransactionsMock = vi.fn<FinanceClient['getTransactions']>();

  beforeEach(() => {
    getTransactionsMock.mockReset();
    getTransactionsMock.mockResolvedValue({
      from: '2026-05-01',
      to: '2026-05-31',
      summary: TEST_SUMMARY,
      transactions: [],
    });
  });

  const financeClientMock: FinanceClient = {
    getTransactions(input: IsoDateRange, options?: { signal?: AbortSignal }): Promise<TransactionsResponse> {
      return getTransactionsMock(input, options);
    },
  };

  function TestWrapper({ children }: PropsWithChildren) {
    return <FinanceClientProvider client={financeClientMock}>{children}</FinanceClientProvider>;
  }

  const TEST_SUMMARY: Summary = {
    incomeTotal: { amount: '100.00', currencyCode: 'EUR' },
    expenseTotal: { amount: '25.00', currencyCode: 'EUR' },
    netTotal: { amount: '75.00', currencyCode: 'EUR' },
  };

  function createTransaction(partial: Partial<Transaction> & Pick<Transaction, 'id'>): Transaction {
    return {
      id: partial.id,
      direction: partial.direction ?? 'expense',
      transactionDate: partial.transactionDate ?? '2026-05-12',
      amount: partial.amount ?? '10.00',
      currencyCode: partial.currencyCode ?? 'EUR',
      description: partial.description ?? 'Test transaction',
      category: partial.category,
      note: partial.note,
      createdAt: partial.createdAt ?? '2026-05-12T10:00:00Z',
      updatedAt: partial.updatedAt ?? '2026-05-12T10:00:00Z',
    };
  }

  it('loads transactions for the requested date range', async () => {
    const transactions = [
      createTransaction({ id: 'groceries', category: 'Groceries' }),
      createTransaction({
        id: 'salary',
        direction: 'income',
        category: 'Salary',
      }),
      createTransaction({ id: 'uncategorized' }),
      createTransaction({ id: 'repeat-groceries', category: 'Groceries' }),
    ];
    getTransactionsMock.mockResolvedValueOnce({
      from: '2026-05-01',
      to: '2026-05-31',
      summary: TEST_SUMMARY,
      transactions,
    });

    const { result } = renderHook(() => useTransactions({ from: '2026-05-01', to: '2026-05-31' }), {
      wrapper: TestWrapper,
    });

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(getTransactionsMock).toHaveBeenCalledWith(
      { from: '2026-05-01', to: '2026-05-31' },
      { signal: expect.any(AbortSignal) },
    );
    expect(result.current.error).toBeNull();
    expect(result.current.data).toEqual({
      transactions,
      summary: TEST_SUMMARY,
      categories: ['Groceries', 'Salary'],
    });
  });

  it('reloads the current date range when reload is called', async () => {
    const initialTransaction = createTransaction({
      id: 'initial',
      description: 'Initial transaction',
    });
    const reloadedTransaction = createTransaction({
      id: 'reloaded',
      description: 'Reloaded transaction',
    });
    getTransactionsMock
      .mockResolvedValueOnce({
        from: '2026-05-01',
        to: '2026-05-31',
        summary: TEST_SUMMARY,
        transactions: [initialTransaction],
      })
      .mockResolvedValueOnce({
        from: '2026-05-01',
        to: '2026-05-31',
        summary: TEST_SUMMARY,
        transactions: [reloadedTransaction],
      });

    const { result } = renderHook(() => useTransactions({ from: '2026-05-01', to: '2026-05-31' }), {
      wrapper: TestWrapper,
    });

    await waitFor(() => {
      expect(result.current.data?.transactions).toEqual([initialTransaction]);
    });

    act(() => result.current.reload());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.data?.transactions).toEqual([reloadedTransaction]);
    });

    expect(getTransactionsMock).toHaveBeenCalledTimes(2);
    expect(getTransactionsMock).toHaveBeenLastCalledWith(
      { from: '2026-05-01', to: '2026-05-31' },
      { signal: expect.any(AbortSignal) },
    );
  });

  it('fetches again and aborts the previous request when the date range changes', async () => {
    const signals: AbortSignal[] = [];
    getTransactionsMock.mockImplementation((_input, options) => {
      if (options?.signal) {
        signals.push(options.signal);
      }
      return Promise.resolve({
        from: '2026-05-01',
        to: '2026-05-31',
        summary: TEST_SUMMARY,
        transactions: [],
      });
    });

    const { rerender } = renderHook(({ from, to }) => useTransactions({ from, to }), {
      initialProps: { from: '2026-05-01', to: '2026-05-31' },
      wrapper: TestWrapper,
    });

    await waitFor(() => {
      expect(getTransactionsMock).toHaveBeenCalledTimes(1);
    });

    rerender({ from: '2026-06-01', to: '2026-06-30' });

    await waitFor(() => {
      expect(getTransactionsMock).toHaveBeenCalledTimes(2);
    });

    expect(signals[0]?.aborted).toBe(true);
    expect(signals[1]?.aborted).toBe(false);
    expect(getTransactionsMock).toHaveBeenLastCalledWith(
      { from: '2026-06-01', to: '2026-06-30' },
      { signal: expect.any(AbortSignal) },
    );
  });

  it('returns a non-loading error state when loading fails', async () => {
    const error = new Error('transactions unavailable');
    getTransactionsMock.mockRejectedValueOnce(error);

    const { result } = renderHook(() => useTransactions({ from: '2026-05-01', to: '2026-05-31' }), {
      wrapper: TestWrapper,
    });

    await waitFor(() => {
      expect(result.current.error?.message).toBe('transactions unavailable');
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeNull();
    expect(result.current.error?.source).toBe(error);
  });
});

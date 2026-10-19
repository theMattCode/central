/* @vitest-environment jsdom */

import { cleanup, render, screen, waitFor } from '@solidjs/testing-library';
import { createStore, Errored, flush, Loading } from 'solid-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Summary, Transaction, TransactionInput } from '@/domain/finance/transactions/model.ts';
import { useTransactions, type TransactionsResource } from '@/domain/finance/transactions/data.ts';
import { type FinanceClient, type TransactionsResponse } from '@/domain/finance/financeClient.ts';
import { FinanceClientProvider } from '@/domain/finance/FinanceClientContext.tsx';
import type { IsoDateRange } from '@/utils/datetime.ts';
import { createCashTransaction } from '@/domain/finance/transactions/api.ts';

vi.mock('@/domain/finance/transactions/api.ts', () => ({
  createCashTransaction: vi.fn(),
  deleteCashTransaction: vi.fn(),
  updateCashTransaction: vi.fn(),
}));

const TEST_SUMMARY: Summary = {
  incomeTotal: { amount: '100.00', currencyCode: 'EUR' },
  expenseTotal: { amount: '25.00', currencyCode: 'EUR' },
  netTotal: { amount: '75.00', currencyCode: 'EUR' },
};

const getTransactionsMock = vi.fn<FinanceClient['getTransactions']>();

describe('useTransactions', () => {
  const createCashTransactionMock = vi.mocked(createCashTransaction);

  beforeEach(() => {
    getTransactionsMock.mockReset();
    createCashTransactionMock.mockReset();
    getTransactionsMock.mockResolvedValue(response([]));
  });

  afterEach(cleanup);

  it('loads and derives transaction categories through a loading boundary', async () => {
    const transactions = [
      createTransaction({ id: 'groceries', category: 'Groceries' }),
      createTransaction({ id: 'salary', direction: 'income', category: 'Salary' }),
      createTransaction({ id: 'repeat-groceries', category: 'Groceries' }),
    ];
    getTransactionsMock.mockResolvedValueOnce(response(transactions));

    renderTransactions({ from: '2026-05-01', to: '2026-05-31' });

    expect(screen.getByText('Loading transactions...')).toBeDefined();
    expect(await screen.findByText('groceries,salary,repeat-groceries')).toBeDefined();
    expect(screen.getByTestId('categories').textContent).toBe('Groceries,Salary');
    expect(getTransactionsMock).toHaveBeenCalledWith({ from: '2026-05-01', to: '2026-05-31' });
  });

  it('reloads the current date range', async () => {
    getTransactionsMock
      .mockResolvedValueOnce(response([createTransaction({ id: 'initial' })]))
      .mockResolvedValueOnce(response([createTransaction({ id: 'reloaded' })]));
    const resource = renderTransactions({ from: '2026-05-01', to: '2026-05-31' });
    expect(await screen.findByText('initial')).toBeDefined();

    await resource().reload();

    expect(await screen.findByText('reloaded')).toBeDefined();
    expect(getTransactionsMock).toHaveBeenCalledTimes(2);
  });

  it('fetches again when the date range changes', async () => {
    const [dateRange, setDateRange] = createStore({ from: '2026-05-01', to: '2026-05-31' });
    renderTransactions(dateRange);
    await waitFor(() => expect(getTransactionsMock).toHaveBeenCalledTimes(1));

    setDateRange((current) => {
      current.from = '2026-06-01';
      current.to = '2026-06-30';
    });
    flush();

    await waitFor(() => expect(getTransactionsMock).toHaveBeenCalledTimes(2));
    expect(getTransactionsMock).toHaveBeenLastCalledWith({ from: '2026-06-01', to: '2026-06-30' });
  });

  it('routes load failures to an error boundary', async () => {
    getTransactionsMock.mockRejectedValueOnce(new Error('transactions unavailable'));
    renderTransactions({ from: '2026-05-01', to: '2026-05-31' });

    expect(await screen.findByText('transactions unavailable')).toBeDefined();
  });

  it('shows an optimistic create and reconciles it with refreshed server data', async () => {
    const saved = createTransaction({ id: 'saved', description: 'Lunch' });
    getTransactionsMock.mockResolvedValueOnce(response([])).mockResolvedValueOnce(response([saved]));
    let resolveCreate: (() => void) | undefined;
    createCashTransactionMock.mockReturnValueOnce(new Promise((resolve) => (resolveCreate = () => resolve(saved))));
    const resource = renderTransactions({ from: '2026-05-01', to: '2026-05-31' });
    await screen.findByTestId('transactions');

    const createPromise = resource().create(transactionInput({ description: 'Lunch' }));
    flush();

    expect(screen.getByTestId('transactions').textContent).toContain('optimistic-');
    expect(resource().isMutating()).toBe(true);

    resolveCreate?.();
    await createPromise;

    expect(screen.getByTestId('transactions').textContent).toBe('saved');
    expect(resource().isMutating()).toBe(false);
  });

  it('calculates optimistic totals without floating-point rounding errors', async () => {
    getTransactionsMock.mockResolvedValueOnce(
      response([
        createTransaction({ id: 'first', amount: '0.10', direction: 'income' }),
        createTransaction({ id: 'second', amount: '0.20', direction: 'income' }),
      ]),
    );
    const resource = renderTransactions({ from: '2026-05-01', to: '2026-05-31' });
    await screen.findByText('first,second');

    const createPromise = resource().create(transactionInput({ amount: '0.10' }));
    flush();

    expect(resource().data.summary.incomeTotal.amount).toBe('0.30');
    expect(resource().data.summary.expenseTotal.amount).toBe('0.10');
    expect(resource().data.summary.netTotal.amount).toBe('0.20');

    await createPromise;
  });
});

function renderTransactions(dateRange: IsoDateRange): () => TransactionsResource {
  let resource: TransactionsResource | undefined;
  const financeClient: FinanceClient = {
    getTransactions: getTransactionsMock,
    getAccounts: () => Promise.reject(new Error('not used by transactions')),
    createAccount: () => Promise.reject(new Error('not used by transactions')),
    updateAccount: () => Promise.reject(new Error('not used by transactions')),
    archiveAccount: () => Promise.reject(new Error('not used by transactions')),
    restoreAccount: () => Promise.reject(new Error('not used by transactions')),
    reorderAccounts: () => Promise.reject(new Error('not used by transactions')),
  };

  render(() => (
    <FinanceClientProvider client={financeClient}>
      <TransactionsHarness dateRange={dateRange} onResource={(value) => (resource = value)} />
    </FinanceClientProvider>
  ));

  return () => {
    if (!resource) throw new Error('Transactions resource is not initialized.');
    return resource;
  };
}

function TransactionsHarness(props: { dateRange: IsoDateRange; onResource: (value: TransactionsResource) => void }) {
  const resource = useTransactions(props.dateRange);
  props.onResource(resource);
  return (
    <Errored fallback={(error) => <span>{String((error() as Error).message)}</span>}>
      <Loading fallback={<span>Loading transactions...</span>}>
        <span data-testid="transactions">
          {resource.data.transactions.map((transaction) => transaction.id).join(',')}
        </span>
        <span data-testid="categories">{resource.data.categories.join(',')}</span>
      </Loading>
    </Errored>
  );
}

function response(transactions: Transaction[]): TransactionsResponse {
  return { from: '2026-05-01', to: '2026-05-31', summary: TEST_SUMMARY, transactions };
}

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
    financialAccountId: partial.financialAccountId ?? 'giro',
    financialAccountName: partial.financialAccountName ?? 'Girokonto',
    createdAt: partial.createdAt ?? '2026-05-12T10:00:00Z',
    updatedAt: partial.updatedAt ?? '2026-05-12T10:00:00Z',
  };
}

function transactionInput(partial: Partial<TransactionInput> = {}): TransactionInput {
  return {
    direction: partial.direction ?? 'expense',
    transactionDate: partial.transactionDate ?? '2026-05-12',
    amount: partial.amount ?? '10.00',
    description: partial.description ?? 'Test transaction',
    category: partial.category,
    note: partial.note,
    financialAccountId: partial.financialAccountId ?? 'giro',
  };
}

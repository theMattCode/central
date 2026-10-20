import {
  action,
  affects,
  createOptimistic,
  createOptimisticStore,
  isPending,
  refresh,
  type Accessor,
  type Store,
} from 'solid-js';
import type { Summary, Transaction, TransactionInput } from '@/domain/finance/transactions/model.ts';
import { useFinanceClient } from '@/domain/finance/FinanceClientContext.tsx';
import {
  createCashTransaction,
  deleteCashTransaction,
  updateCashTransaction,
} from '@/domain/finance/transactions/api.ts';

export interface TransactionsData {
  categories: string[];
  summary: Summary;
  transactions: Transaction[];
}

export interface TransactionsResource {
  create: (input: TransactionInput) => Promise<void>;
  data: Store<TransactionsData>;
  delete: (transaction: Transaction) => Promise<void>;
  isMutating: Accessor<boolean>;
  isRefreshing: Accessor<boolean>;
  reload: () => Promise<void>;
  update: (id: string, input: TransactionInput) => Promise<void>;
}

type TransactionsProps = { from: string; to: string };

const EMPTY_SUMMARY: Summary = {
  incomeTotal: { amount: '0.00', currencyCode: 'EUR' },
  expenseTotal: { amount: '0.00', currencyCode: 'EUR' },
  netTotal: { amount: '0.00', currencyCode: 'EUR' },
};

export function useTransactions(dateRange: TransactionsProps): TransactionsResource {
  const financeClient = useFinanceClient();
  const [data, setData] = createOptimisticStore<TransactionsData>(
    async () => {
      const response = await financeClient.getTransactions({ from: dateRange.from, to: dateRange.to });
      return {
        transactions: response.transactions,
        summary: response.summary,
        categories: extractCategories(response.transactions),
      };
    },
    { transactions: [], summary: EMPTY_SUMMARY, categories: [] },
    { name: 'transactions' },
  );
  const [isMutating, setIsMutating] = createOptimistic(false);

  const reload = action(function* () {
    affects(data);
    yield refresh(data);
  });

  const create = action(function* (input: TransactionInput) {
    setIsMutating(true);
    affects(data);
    const now = new Date().toISOString();
    const optimisticTransaction: Transaction = {
      ...input,
      id: `optimistic-${crypto.randomUUID()}`,
      currencyCode: data.summary.netTotal.currencyCode,
      // The account name arrives with the refreshed server data.
      financialAccountName: '',
      createdAt: now,
      updatedAt: now,
    };
    setData((current) => {
      current.transactions.unshift(optimisticTransaction);
      updateDerivedData(current);
    });
    yield createCashTransaction({ data: input });
    yield refresh(data);
  });

  const update = action(function* (id: string, input: TransactionInput) {
    setIsMutating(true);
    affects(data);
    setData((current) => {
      const index = current.transactions.findIndex((transaction) => transaction.id === id);
      if (index < 0) return;
      current.transactions[index] = {
        ...current.transactions[index],
        ...input,
        updatedAt: new Date().toISOString(),
      };
      updateDerivedData(current);
    });
    yield updateCashTransaction({ data: { id, ...input } });
    yield refresh(data);
  });

  const remove = action(function* (transaction: Transaction) {
    setIsMutating(true);
    affects(data);
    setData((current) => {
      current.transactions = current.transactions.filter((candidate) => candidate.id !== transaction.id);
      updateDerivedData(current);
    });
    yield deleteCashTransaction({ data: { id: transaction.id } });
    yield refresh(data);
  });

  return {
    create: async (input) => void (await create(input)),
    data,
    delete: async (transaction) => void (await remove(transaction)),
    isMutating,
    isRefreshing: () => isPending(() => data.transactions),
    reload: async () => void (await reload()),
    update: async (id, input) => void (await update(id, input)),
  };
}

function updateDerivedData(data: TransactionsData): void {
  data.categories = extractCategories(data.transactions);
  data.summary = calculateSummary(data.transactions, data.summary.netTotal.currencyCode);
}

function calculateSummary(transactions: Transaction[], currencyCode: string): Summary {
  let incomeTotal = 0n;
  let expenseTotal = 0n;

  for (const transaction of transactions) {
    const amount = toMinorUnits(transaction.amount);
    if (amount === undefined) continue;
    if (transaction.direction === 'income') incomeTotal += amount;
    else expenseTotal += amount;
  }

  return {
    incomeTotal: { amount: formatMinorUnits(incomeTotal), currencyCode },
    expenseTotal: { amount: formatMinorUnits(expenseTotal), currencyCode },
    netTotal: { amount: formatMinorUnits(incomeTotal - expenseTotal), currencyCode },
  };
}

function toMinorUnits(value: string): bigint | undefined {
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) return undefined;

  const [, sign, whole, fraction = ''] = match;
  const amount = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  return sign === '-' ? -amount : amount;
}

function formatMinorUnits(value: bigint): string {
  const sign = value < 0n ? '-' : '';
  const absolute = value < 0n ? -value : value;
  return `${sign}${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`;
}

function extractCategories(transactions: Transaction[]): string[] {
  return Array.from(new Set(transactions.map((transaction) => transaction.category).filter(Boolean) as string[])).sort(
    (left, right) => left.localeCompare(right),
  );
}

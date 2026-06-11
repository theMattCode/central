import type { Summary, Transaction } from '@/domain/finance/transactions/model.ts';
import { useEffect, useState } from 'react';
import { toErrorMessage } from '@/utils/formatting.ts';

import { useFinanceClient } from '@/domain/finance/FinanceClientContext.tsx';

interface Error {
  source: unknown;
  message: string;
}

interface ComputedData {
  transactions: Transaction[];
  summary: Summary;
  categories: string[];
}

interface Transactions {
  data: ComputedData | null;
  error: Error | null;
  loading: boolean;
  reload: () => void;
}

type TransactionsProps = { from: string; to: string };

export function useTransactions({ from, to }: TransactionsProps): Transactions {
  const financeClient = useFinanceClient();
  const [reloadVersion, setReloadVersion] = useState(0);
  const [transactions, setTransactions] = useState<Transactions>({
    data: null,
    error: null,
    loading: true,
    reload: () => setReloadVersion((version) => version + 1),
  });

  useEffect(() => {
    const abortController = new AbortController();

    const loadTransactions = async () => {
      try {
        setTransactions((prev) => ({ ...prev, loading: true }));
        const response = await financeClient.getTransactions({ from, to }, { signal: abortController.signal });
        setTransactions((prev) => ({
          ...prev,
          loading: false,
          error: null,
          data: {
            transactions: response.transactions,
            summary: response.summary,
            categories: extractCategories(response.transactions),
          },
        }));
      } catch (error) {
        if (abortController.signal.aborted) {
          return;
        }
        setTransactions((prev) => ({
          ...prev,
          loading: false,
          error: { source: error, message: toErrorMessage(error) },
        }));
      }
    };

    void loadTransactions();

    return () => abortController.abort();
  }, [financeClient, from, to, reloadVersion]);

  return transactions;
}

function extractCategories(transactions: Transaction[]) {
  return Array.from(new Set(transactions.map((transaction) => transaction.category).filter(Boolean) as string[])).sort(
    (left, right) => left.localeCompare(right),
  );
}

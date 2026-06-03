import { isIsoDateRange, type IsoDateRange } from '@/utils/datetime.ts';
import { createServerFn } from '@tanstack/react-start';
import { fetchJson } from '@/utils/backend.ts';
import type { Summary, Transaction } from '@/domain/finance/transactions/model.ts';
import { createFinanceUrl } from '@/domain/finance/transactions/api.ts';
import { useEffect, useState } from 'react';
import { toErrorMessage } from '@/utils/formatting.ts';

export function validateTransactionsParameters(input: unknown): IsoDateRange {
  if (!isIsoDateRange(input)) {
    throw new Error(`invalid transactions parameters: ${input}`);
  }
  return input;
}

interface TransactionsPayload extends IsoDateRange {
  summary: Summary;
  transactions: Transaction[];
}

export type TransactionsResponse = Readonly<TransactionsPayload>;

async function requestTransactions(from: string, to: string): Promise<TransactionsResponse> {
  const url = createFinanceUrl('api/v1/finance/transactions');
  url.searchParams.set('from', from);
  url.searchParams.set('to', to);
  return fetchJson<TransactionsResponse>(url);
}

export const fetchTransactions = createServerFn({ method: 'GET' })
  .inputValidator(validateTransactionsParameters)
  .handler(async ({ data }) => requestTransactions(data.from, data.to));

interface Error {
  source: unknown;
  message: string;
}

interface TransactionsData {
  transactions: Transaction[];
  summary: Summary;
  categories: string[];
}

interface TransactionsModel {
  data: TransactionsData | null;
  error: Error | null;
  loading: boolean;
  reload: () => void;
}

type TransactionsProps = { from: string; to: string };

export function useTransactions({ from, to }: TransactionsProps): TransactionsModel {
  const [reloadVersion, setReloadVersion] = useState(0);
  const [model, setModel] = useState<TransactionsModel>({
    data: null,
    error: null,
    loading: true,
    reload: () => setReloadVersion((version) => version + 1),
  });

  useEffect(() => {
    const abortController = new AbortController();

    const loadTransactions = async () => {
      try {
        setModel((prev) => ({ ...prev, loading: true }));
        const data = await fetchTransactions({ data: { from, to }, signal: abortController.signal });
        setModel((prev) => ({
          ...prev,
          loading: false,
          data: {
            transactions: data.transactions,
            summary: data.summary,
            categories: extractCategories(data.transactions),
          },
        }));
      } catch (error) {
        if (abortController.signal.aborted) {
          return;
        }
        setModel((prev) => ({ ...prev, error: { source: error, message: toErrorMessage(error) } }));
      }
    };

    void loadTransactions();

    return () => abortController.abort();
  }, [from, to, reloadVersion]);

  console.log('transactions', model);
  return model;
}

function extractCategories(transactions: Transaction[]) {
  return Array.from(new Set(transactions.map((transaction) => transaction.category).filter(Boolean) as string[])).sort(
    (left, right) => left.localeCompare(right),
  );
}

import { createServerFn } from '@tanstack/react-start';
import { fetchJson } from '@/utils/backend.ts';
import { createFinanceUrl } from '@/domain/finance/transactions/api.ts';
import type { Summary, Transaction } from '@/domain/finance/transactions/model.ts';
import { isIsoDateRange, type IsoDateRange } from '@/utils/datetime.ts';

export interface TransactionsResponse extends IsoDateRange {
  summary: Summary;
  transactions: Transaction[];
}

export interface FinanceClient {
  getTransactions(input: IsoDateRange, options?: { signal?: AbortSignal }): Promise<TransactionsResponse>;
}

function validateTransactionsParameters(input: unknown): IsoDateRange {
  if (!isIsoDateRange(input)) {
    throw new Error(`invalid transactions parameters: ${input}`);
  }
  return input;
}

async function requestTransactions(from: string, to: string): Promise<TransactionsResponse> {
  const url = createFinanceUrl('api/v1/finance/transactions');
  url.searchParams.set('from', from);
  url.searchParams.set('to', to);
  return fetchJson<TransactionsResponse>(url);
}

const fetchTransactions = createServerFn({ method: 'GET' })
  .inputValidator(validateTransactionsParameters)
  .handler(async ({ data }) => requestTransactions(data.from, data.to));

export const defaultFinanceClient: FinanceClient = {
  getTransactions: ({ from, to }, { signal } = {}) => fetchTransactions({ data: { from, to }, signal }),
};

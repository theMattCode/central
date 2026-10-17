import { createServerFn } from '@tanstack/react-start';
import { fetchJson, resolveBackendBaseUrl } from '@/utils/backend.ts';
import type { Summary, Transaction } from '@/domain/finance/transactions/model.ts';
import {
  type FinancialAccount,
  type FinancialAccountInput,
  validateFinancialAccountInput,
} from '@/domain/finance/accounts/model.ts';
import { isIsoDateRange, type IsoDateRange } from '@/utils/datetime.ts';

export interface FinanceClient {
  getTransactions(input: IsoDateRange, options?: { signal?: AbortSignal }): Promise<TransactionsResponse>;
  getAccounts(options?: { signal?: AbortSignal }): Promise<FinancialAccount[]>;
  createAccount(input: FinancialAccountInput): Promise<FinancialAccount>;
}

// TODO remove export (once api.ts is migrated to finance client)
export function getFinanceURL(): URL {
  return new URL('api/v1/finance/transactions', resolveBackendBaseUrl());
}

function getAccountsURL(): URL {
  return new URL('api/v1/finance/accounts', resolveBackendBaseUrl());
}

export interface TransactionsResponse extends IsoDateRange {
  summary: Summary;
  transactions: Transaction[];
}

async function requestTransactions(from: string, to: string): Promise<TransactionsResponse> {
  const url = getFinanceURL();
  url.searchParams.set('from', from);
  url.searchParams.set('to', to);
  return fetchJson<TransactionsResponse>(url);
}

function validateTransactionsParameters(input: unknown): IsoDateRange {
  if (!isIsoDateRange(input)) {
    throw new Error(`invalid transactions parameters: ${input}`);
  }
  return input;
}

const fetchTransactions = createServerFn({ method: 'GET' })
  .inputValidator(validateTransactionsParameters)
  .handler(async ({ data }) => requestTransactions(data.from, data.to));

const fetchAccounts = createServerFn({ method: 'GET' }).handler(async () => {
  const response = await fetchJson<{ accounts: FinancialAccount[] }>(getAccountsURL());
  return response.accounts;
});

const postAccount = createServerFn({ method: 'POST' })
  .inputValidator(validateFinancialAccountInput)
  .handler(async ({ data }) =>
    fetchJson<FinancialAccount>(getAccountsURL(), { method: 'POST', body: JSON.stringify(data) }),
  );

export const DEFAULT_FINANCE_CLIENT: FinanceClient = {
  getTransactions: ({ from, to }, { signal } = {}) => fetchTransactions({ data: { from, to }, signal }),
  getAccounts: ({ signal } = {}) => fetchAccounts({ signal }),
  createAccount: (input) => postAccount({ data: input }),
};

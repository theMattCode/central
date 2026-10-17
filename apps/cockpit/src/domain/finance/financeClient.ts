import { createServerFn } from '@tanstack/react-start';
import { fetchJson, resolveBackendBaseUrl } from '@/utils/backend.ts';
import type { Summary, Transaction } from '@/domain/finance/transactions/model.ts';
import {
  type FinancialAccount,
  type FinancialAccountInput,
  validateFinancialAccountIdInput,
  validateFinancialAccountInput,
  validateReorderFinancialAccountsInput,
  validateUpdateFinancialAccountInput,
} from '@/domain/finance/accounts/model.ts';
import { isIsoDateRange, type IsoDateRange } from '@/utils/datetime.ts';

export interface FinanceClient {
  getTransactions(input: IsoDateRange, options?: { signal?: AbortSignal }): Promise<TransactionsResponse>;
  getAccounts(options?: { signal?: AbortSignal }): Promise<FinancialAccount[]>;
  createAccount(input: FinancialAccountInput): Promise<FinancialAccount>;
  updateAccount(id: string, input: FinancialAccountInput): Promise<FinancialAccount>;
  archiveAccount(id: string): Promise<FinancialAccount>;
  restoreAccount(id: string): Promise<FinancialAccount>;
  reorderAccounts(accountIds: string[]): Promise<FinancialAccount[]>;
}

// TODO remove export (once api.ts is migrated to finance client)
export function getFinanceURL(): URL {
  return new URL('api/v1/finance/transactions', resolveBackendBaseUrl());
}

function getAccountsURL(path = ''): URL {
  return new URL(`api/v1/finance/accounts${path}`, resolveBackendBaseUrl());
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

const putAccount = createServerFn({ method: 'POST' })
  .inputValidator(validateUpdateFinancialAccountInput)
  .handler(async ({ data }) =>
    fetchJson<FinancialAccount>(getAccountsURL(`/${encodeURIComponent(data.id)}`), {
      method: 'PUT',
      body: JSON.stringify(data.account),
    }),
  );

const postArchiveAccount = createServerFn({ method: 'POST' })
  .inputValidator(validateFinancialAccountIdInput)
  .handler(async ({ data }) =>
    fetchJson<FinancialAccount>(getAccountsURL(`/${encodeURIComponent(data.id)}/archive`), { method: 'POST' }),
  );

const postRestoreAccount = createServerFn({ method: 'POST' })
  .inputValidator(validateFinancialAccountIdInput)
  .handler(async ({ data }) =>
    fetchJson<FinancialAccount>(getAccountsURL(`/${encodeURIComponent(data.id)}/restore`), { method: 'POST' }),
  );

const putAccountOrder = createServerFn({ method: 'POST' })
  .inputValidator(validateReorderFinancialAccountsInput)
  .handler(async ({ data }) => {
    const response = await fetchJson<{ accounts: FinancialAccount[] }>(getAccountsURL('/order'), {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return response.accounts;
  });

export const DEFAULT_FINANCE_CLIENT: FinanceClient = {
  getTransactions: ({ from, to }, { signal } = {}) => fetchTransactions({ data: { from, to }, signal }),
  getAccounts: ({ signal } = {}) => fetchAccounts({ signal }),
  createAccount: (input) => postAccount({ data: input }),
  updateAccount: (id, account) => putAccount({ data: { id, account } }),
  archiveAccount: (id) => postArchiveAccount({ data: { id } }),
  restoreAccount: (id) => postRestoreAccount({ data: { id } }),
  reorderAccounts: (accountIds) => putAccountOrder({ data: { accountIds } }),
};

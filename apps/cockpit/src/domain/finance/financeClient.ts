import { createServerFn } from '@tanstack/react-start';
import { fetchJson, resolveBackendBaseUrl } from '@/utils/backend.ts';
import type { Summary, Transaction } from '@/domain/finance/transactions/model.ts';
import { isIsoDateRange, type IsoDateRange } from '@/utils/datetime.ts';
import type { FinancialAccount, FinancialAccountType } from '@/domain/finance/accounts/model.ts';

export type FinancialAccountInput = {
  name: string;
  accountType: FinancialAccountType;
  primaryCurrencyCode: string;
  displayOrder: number;
};

export type UpdateFinancialAccountInput = FinancialAccountInput & {
  id: string;
};

export type ArchiveFinancialAccountInput = {
  id: string;
};

export interface AccountsResponse {
  accounts: FinancialAccount[];
}

export interface TransactionsResponse extends IsoDateRange {
  summary: Summary;
  transactions: Transaction[];
}

export interface FinanceClient {
  getAccounts(options?: { signal?: AbortSignal }): Promise<AccountsResponse>;
  createAccount(input: FinancialAccountInput): Promise<FinancialAccount>;
  updateAccount(input: UpdateFinancialAccountInput): Promise<FinancialAccount>;
  archiveAccount(input: ArchiveFinancialAccountInput): Promise<FinancialAccount>;

  getTransactions(input: IsoDateRange, options?: { signal?: AbortSignal }): Promise<TransactionsResponse>;
}

function getFinanceURL(path: string): URL {
  return new URL(`api/v1/finance/${path}`, resolveBackendBaseUrl());
}

const fetchAccounts = createServerFn({ method: 'GET' }).handler(() =>
  fetchJson<AccountsResponse>(getFinanceURL('accounts')),
);

const ACCOUNT_TYPES = ['cash', 'bank', 'credit', 'loan'];

function validateFinancialAccountInput(input: unknown): FinancialAccountInput {
  if (!input || typeof input !== 'object') throw new Error('Invalid financial account payload.');

  const value = input as Partial<FinancialAccountInput>;
  if (
    typeof value.name !== 'string' ||
    !value.accountType ||
    !ACCOUNT_TYPES.includes(value.accountType) ||
    typeof value.primaryCurrencyCode !== 'string' ||
    typeof value.displayOrder !== 'number'
  ) {
    throw new Error('Invalid financial account payload.');
  }

  return {
    name: value.name,
    accountType: value.accountType,
    primaryCurrencyCode: value.primaryCurrencyCode,
    displayOrder: value.displayOrder,
  };
}

const createFinancialAccount = createServerFn({ method: 'POST' })
  .inputValidator(validateFinancialAccountInput)
  .handler(async ({ data }) =>
    fetchJson<FinancialAccount>(getFinanceURL('accounts'), { method: 'POST', body: JSON.stringify(data) }),
  );

function validateUpdateFinancialAccountInput(input: unknown): UpdateFinancialAccountInput {
  if (!input || typeof input !== 'object') throw new Error('Invalid financial account payload.');

  const value = input as Partial<UpdateFinancialAccountInput>;
  if (typeof value.id !== 'string' || !value.id) throw new Error('Invalid financial account payload.');

  return {
    id: value.id,
    ...validateFinancialAccountInput(input),
  };
}

const updateFinancialAccount = createServerFn({ method: 'POST' })
  .inputValidator(validateUpdateFinancialAccountInput)
  .handler(async ({ data }) => {
    const { id, ...account } = data;
    return fetchJson<FinancialAccount>(getFinanceURL(`accounts/${id}`), {
      method: 'PUT',
      body: JSON.stringify(account),
    });
  });

function validateArchiveFinancialAccountInput(input: unknown): ArchiveFinancialAccountInput {
  if (!input || typeof input !== 'object') throw new Error('Invalid financial account payload.');

  const value = input as Partial<ArchiveFinancialAccountInput>;
  if (typeof value.id !== 'string' || !value.id) throw new Error('Invalid financial account payload.');

  return { id: value.id };
}

const archiveFinancialAccount = createServerFn({ method: 'POST' })
  .inputValidator(validateArchiveFinancialAccountInput)
  .handler(async ({ data }) =>
    fetchJson<FinancialAccount>(getFinanceURL(`accounts/${data.id}/archive`), { method: 'POST' }),
  );

function validateTransactionsParameters(input: unknown): IsoDateRange {
  if (!isIsoDateRange(input)) throw new Error(`invalid transactions parameters: ${input}`);
  return input;
}

const fetchTransactions = createServerFn({ method: 'GET' })
  .inputValidator(validateTransactionsParameters)
  .handler(async ({ data }) => {
    const url = getFinanceURL('transactions');
    url.searchParams.set('from', data.from);
    url.searchParams.set('to', data.to);
    return fetchJson<TransactionsResponse>(url);
  });

export const DEFAULT_FINANCE_CLIENT: FinanceClient = {
  getAccounts: ({ signal } = {}) => fetchAccounts({ signal }),
  createAccount: (input) => createFinancialAccount({ data: input }),
  updateAccount: (input) => updateFinancialAccount({ data: input }),
  archiveAccount: (input) => archiveFinancialAccount({ data: input }),
  getTransactions: ({ from, to }, { signal } = {}) => fetchTransactions({ data: { from, to }, signal }),
};

import { createServerFn } from '@tanstack/react-start';
import { resolveBackendBaseUrl } from './backendBaseUrl.ts';
import type { CashTransaction, CashTransactionInput, CashTransactionList } from './model.ts';

type BackendError = {
  error?: {
    message?: string;
  };
};

type UpdateTransactionInput = CashTransactionInput & {
  id: string;
};

type DeleteTransactionInput = {
  id: string;
};

function createFinanceUrl(path: string): URL {
  return new URL(path, resolveBackendBaseUrl());
}

function validateMonthInput(input: unknown): { month: string } {
  if (!input || typeof input !== 'object') {
    throw new Error('Invalid cash month payload.');
  }

  const value = input as { month?: unknown };
  if (typeof value.month !== 'string' || !/^\d{4}-\d{2}$/.test(value.month)) {
    throw new Error('Invalid cash month payload.');
  }

  return { month: value.month };
}

function validateTransactionInput(input: unknown): CashTransactionInput {
  if (!input || typeof input !== 'object') {
    throw new Error('Invalid cash transaction payload.');
  }

  const value = input as Partial<CashTransactionInput>;
  if (
    (value.direction !== 'income' && value.direction !== 'expense') ||
    typeof value.transactionDate !== 'string' ||
    typeof value.amount !== 'string' ||
    typeof value.description !== 'string' ||
    (value.category !== undefined && typeof value.category !== 'string') ||
    (value.note !== undefined && typeof value.note !== 'string')
  ) {
    throw new Error('Invalid cash transaction payload.');
  }

  return {
    direction: value.direction,
    transactionDate: value.transactionDate,
    amount: value.amount,
    description: value.description,
    category: value.category,
    note: value.note,
  };
}

function validateUpdateTransactionInput(input: unknown): UpdateTransactionInput {
  if (!input || typeof input !== 'object') {
    throw new Error('Invalid cash transaction payload.');
  }

  const value = input as Partial<UpdateTransactionInput>;
  if (typeof value.id !== 'string' || !value.id) {
    throw new Error('Invalid cash transaction payload.');
  }

  return {
    id: value.id,
    ...validateTransactionInput(input),
  };
}

function validateDeleteTransactionInput(input: unknown): DeleteTransactionInput {
  if (!input || typeof input !== 'object') {
    throw new Error('Invalid cash transaction payload.');
  }

  const value = input as Partial<DeleteTransactionInput>;
  if (typeof value.id !== 'string' || !value.id) {
    throw new Error('Invalid cash transaction payload.');
  }

  return { id: value.id };
}

async function toErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as BackendError;
    if (payload.error?.message) {
      return payload.error.message;
    }
  } catch {
    // ignore JSON parse errors and return fallback below
  }

  return `Finance request failed with status ${response.status}.`;
}

async function requestJson<T>(url: URL, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(await toErrorMessage(response));
  }

  return (await response.json()) as T;
}

async function requestCashTransactions(month: string): Promise<CashTransactionList> {
  const url = createFinanceUrl('api/v1/finance/transactions');
  url.searchParams.set('month', month);

  return requestJson<CashTransactionList>(url);
}

async function requestCreateCashTransaction(input: CashTransactionInput): Promise<CashTransaction> {
  const url = createFinanceUrl('api/v1/finance/transactions');

  return requestJson<CashTransaction>(url, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

async function requestUpdateCashTransaction(input: UpdateTransactionInput): Promise<CashTransaction> {
  const url = createFinanceUrl(`api/v1/finance/transactions/${input.id}`);
  const { id: _id, ...transaction } = input;

  return requestJson<CashTransaction>(url, {
    method: 'PUT',
    body: JSON.stringify(transaction),
  });
}

async function requestDeleteCashTransaction(input: DeleteTransactionInput): Promise<void> {
  const url = createFinanceUrl(`api/v1/finance/transactions/${input.id}`);
  const response = await fetch(url, { method: 'DELETE' });

  if (!response.ok) {
    throw new Error(await toErrorMessage(response));
  }
}

export const fetchCashTransactions = createServerFn({ method: 'GET' })
  .inputValidator(validateMonthInput)
  .handler(async ({ data }) => requestCashTransactions(data.month));

export const createCashTransaction = createServerFn({ method: 'POST' })
  .inputValidator(validateTransactionInput)
  .handler(async ({ data }) => requestCreateCashTransaction(data));

export const updateCashTransaction = createServerFn({ method: 'POST' })
  .inputValidator(validateUpdateTransactionInput)
  .handler(async ({ data }) => requestUpdateCashTransaction(data));

export const deleteCashTransaction = createServerFn({ method: 'POST' })
  .inputValidator(validateDeleteTransactionInput)
  .handler(async ({ data }) => requestDeleteCashTransaction(data));

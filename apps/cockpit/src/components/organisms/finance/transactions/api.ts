import { createServerFn } from '@tanstack/react-start';
import type { CashTransactionInput, Transaction } from './model.ts';
import { fetchJson, resolveBackendBaseUrl, resolveErrorMessage } from '@/utils/backend.ts';

type UpdateTransactionInput = CashTransactionInput & {
  id: string;
};

type DeleteTransactionInput = {
  id: string;
};

export function createFinanceUrl(path: string): URL {
  return new URL(path, resolveBackendBaseUrl());
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

async function requestCreateCashTransaction(input: CashTransactionInput): Promise<Transaction> {
  const url = createFinanceUrl('api/v1/finance/transactions');

  return fetchJson<Transaction>(url, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

async function requestUpdateCashTransaction(input: UpdateTransactionInput): Promise<Transaction> {
  const url = createFinanceUrl(`api/v1/finance/transactions/${input.id}`);
  const { id: _id, ...transaction } = input;

  return fetchJson<Transaction>(url, {
    method: 'PUT',
    body: JSON.stringify(transaction),
  });
}

async function requestDeleteCashTransaction(input: DeleteTransactionInput): Promise<void> {
  const url = createFinanceUrl(`api/v1/finance/transactions/${input.id}`);
  const response = await fetch(url, { method: 'DELETE' });

  if (!response.ok) {
    throw new Error(await resolveErrorMessage(response));
  }
}

export const createCashTransaction = createServerFn({ method: 'POST' })
  .inputValidator(validateTransactionInput)
  .handler(async ({ data }) => requestCreateCashTransaction(data));

export const updateCashTransaction = createServerFn({ method: 'POST' })
  .inputValidator(validateUpdateTransactionInput)
  .handler(async ({ data }) => requestUpdateCashTransaction(data));

export const deleteCashTransaction = createServerFn({ method: 'POST' })
  .inputValidator(validateDeleteTransactionInput)
  .handler(async ({ data }) => requestDeleteCashTransaction(data));

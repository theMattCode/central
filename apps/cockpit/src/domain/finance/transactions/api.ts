import { createServerFn } from '@tanstack/react-start';
import type { TransactionInput, Transaction } from '@/domain/finance/transactions/model.ts';
import { fetchJson, resolveErrorMessage } from '@/utils/backend.ts';
import { getFinanceURL } from '@/domain/finance/financeClient.ts';

type UpdateTransactionInput = TransactionInput & {
  id: string;
};

type DeleteTransactionInput = {
  id: string;
};

export function getTransactionURL(id: string): URL {
  const url = getFinanceURL();
  url.pathname = `${url.pathname}/${encodeURIComponent(id)}`;
  return url;
}

export function validateTransactionInput(input: unknown): TransactionInput {
  if (!input || typeof input !== 'object') {
    throw new Error('Invalid cash transaction payload.');
  }

  const value = input as Partial<TransactionInput>;
  if (
    (value.direction !== 'income' && value.direction !== 'expense') ||
    typeof value.transactionDate !== 'string' ||
    typeof value.amount !== 'string' ||
    typeof value.description !== 'string' ||
    (value.category !== undefined && typeof value.category !== 'string') ||
    (value.note !== undefined && typeof value.note !== 'string') ||
    typeof value.financialAccountId !== 'string' ||
    !value.financialAccountId
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
    financialAccountId: value.financialAccountId,
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

async function requestCreateCashTransaction(input: TransactionInput): Promise<Transaction> {
  const url = getFinanceURL();

  return fetchJson<Transaction>(url, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

async function requestUpdateCashTransaction(input: UpdateTransactionInput): Promise<Transaction> {
  const { id, ...transaction } = input;

  return fetchJson<Transaction>(getTransactionURL(id), {
    method: 'PUT',
    body: JSON.stringify(transaction),
  });
}

async function requestDeleteCashTransaction(input: DeleteTransactionInput): Promise<void> {
  const response = await fetch(getTransactionURL(input.id), { method: 'DELETE' });

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

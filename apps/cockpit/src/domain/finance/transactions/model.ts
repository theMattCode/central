import { getCurrentLocalDate } from '@/utils/datetime.ts';

export type TransactionDirection = 'income' | 'expense';

/** The transaction flow books in EUR only; only EUR accounts can be picked. */
export const TRANSACTION_CURRENCY_CODE = 'EUR';

export type MoneyAmount = Readonly<{
  amount: string;
  currencyCode: string;
}>;

export type Transaction = Readonly<{
  id: string;
  direction: TransactionDirection;
  transactionDate: string;
  amount: string;
  currencyCode: string;
  description: string;
  category?: string;
  note?: string;
  financialAccountId: string;
  financialAccountName: string;
  createdAt: string;
  updatedAt: string;
}>;

export type TransactionInput = Readonly<{
  direction: TransactionDirection;
  transactionDate: string;
  amount: string;
  description: string;
  category?: string;
  note?: string;
  financialAccountId: string;
}>;

export type Summary = Readonly<{
  incomeTotal: MoneyAmount;
  expenseTotal: MoneyAmount;
  netTotal: MoneyAmount;
}>;

export type TransactionFormState = {
  direction: TransactionDirection;
  transactionDate: string;
  amount: string;
  description: string;
  category: string;
  note: string;
  financialAccountId: string;
};

export function createEmptyTransactionFormState(transactionDate = getCurrentLocalDate()): TransactionFormState {
  return {
    direction: 'expense',
    transactionDate,
    amount: '',
    description: '',
    category: '',
    note: '',
    financialAccountId: '',
  };
}

export function toCashTransactionInput(form: TransactionFormState): TransactionInput {
  return {
    direction: form.direction,
    transactionDate: form.transactionDate,
    amount: form.amount.trim(),
    description: form.description.trim(),
    category: form.category.trim() || undefined,
    note: form.note.trim() || undefined,
    financialAccountId: form.financialAccountId,
  };
}

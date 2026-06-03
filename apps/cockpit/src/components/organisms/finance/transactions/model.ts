import { getCurrentLocalDate } from '@/utils/datetime.ts';

export type TransactionDirection = 'income' | 'expense';

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
  createdAt: string;
  updatedAt: string;
}>;

export type CashTransactionInput = Readonly<{
  direction: TransactionDirection;
  transactionDate: string;
  amount: string;
  description: string;
  category?: string;
  note?: string;
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
};

export function createEmptyTransactionFormState(transactionDate = getCurrentLocalDate()): TransactionFormState {
  return {
    direction: 'expense',
    transactionDate,
    amount: '',
    description: '',
    category: '',
    note: '',
  };
}

export function toCashTransactionInput(form: TransactionFormState): CashTransactionInput {
  return {
    direction: form.direction,
    transactionDate: form.transactionDate,
    amount: form.amount.trim(),
    description: form.description.trim(),
    category: form.category.trim() || undefined,
    note: form.note.trim() || undefined,
  };
}

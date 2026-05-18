export type TransactionDirection = 'income' | 'expense';

export type MoneyAmount = Readonly<{
  amount: string;
  currencyCode: string;
}>;

export type CashTransaction = Readonly<{
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

export type CashSummary = Readonly<{
  incomeTotal: MoneyAmount;
  expenseTotal: MoneyAmount;
  netTotal: MoneyAmount;
}>;

export type CashTransactionList = Readonly<{
  month: string;
  summary: CashSummary;
  transactions: CashTransaction[];
}>;

export type CashFormState = {
  direction: TransactionDirection;
  transactionDate: string;
  amount: string;
  description: string;
  category: string;
  note: string;
};

export function getCurrentLocalDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function getCurrentLocalMonth(): string {
  return getCurrentLocalDate().slice(0, 7);
}

export function createEmptyCashFormState(transactionDate = getCurrentLocalDate()): CashFormState {
  return {
    direction: 'expense',
    transactionDate,
    amount: '',
    description: '',
    category: '',
    note: '',
  };
}

export function toCashTransactionInput(form: CashFormState): CashTransactionInput {
  return {
    direction: form.direction,
    transactionDate: form.transactionDate,
    amount: form.amount.trim(),
    description: form.description.trim(),
    category: form.category.trim() || undefined,
    note: form.note.trim() || undefined,
  };
}

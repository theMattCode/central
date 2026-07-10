import type { FinancialAccountInput } from '@/domain/finance/financeClient.ts';

export type FinancialAccountType = 'cash' | 'bank' | 'credit' | 'loan';
export type FinancialAccountStatus = 'active' | 'archived';

export type FinancialAccount = Readonly<{
  id: string;
  name: string;
  accountType: FinancialAccountType;
  primaryCurrencyCode: string;
  displayOrder: number;
  status: FinancialAccountStatus;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}>;

export type FinancialAccountFormState = {
  name: string;
  accountType: FinancialAccountType;
  primaryCurrencyCode: string;
  displayOrder: string;
};

export const FINANCIAL_ACCOUNT_TYPES: ReadonlyArray<{
  value: FinancialAccountType;
  label: string;
}> = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Bank' },
  { value: 'credit', label: 'Credit' },
  { value: 'loan', label: 'Loan' },
];

export function createEmptyFinancialAccountFormState(): FinancialAccountFormState {
  return {
    name: '',
    accountType: 'bank',
    primaryCurrencyCode: 'EUR',
    displayOrder: '0',
  };
}

export function toFinancialAccountFormState(account: FinancialAccount): FinancialAccountFormState {
  return {
    name: account.name,
    accountType: account.accountType,
    primaryCurrencyCode: account.primaryCurrencyCode,
    displayOrder: account.displayOrder.toString(),
  };
}

export function toFinancialAccountInput(form: FinancialAccountFormState): FinancialAccountInput {
  return {
    name: form.name.trim(),
    accountType: form.accountType,
    primaryCurrencyCode: form.primaryCurrencyCode.trim().toUpperCase(),
    displayOrder: Number.parseInt(form.displayOrder, 10) || 0,
  };
}

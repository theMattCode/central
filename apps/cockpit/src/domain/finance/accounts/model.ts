import type { FinancialAccountCreateInput, FinancialAccountUpdateInput } from '@/domain/finance/financeClient.ts';

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
  };
}

export function toFinancialAccountFormState(account: FinancialAccount): FinancialAccountFormState {
  return {
    name: account.name,
    accountType: account.accountType,
    primaryCurrencyCode: account.primaryCurrencyCode,
  };
}

export function toFinancialAccountCreateInput(form: FinancialAccountFormState): FinancialAccountCreateInput {
  return {
    name: form.name.trim(),
    accountType: form.accountType,
    primaryCurrencyCode: form.primaryCurrencyCode.trim().toUpperCase(),
  };
}

export function toFinancialAccountUpdateInput(
  account: FinancialAccount,
  form: FinancialAccountFormState,
): FinancialAccountUpdateInput {
  return {
    id: account.id,
    name: form.name.trim(),
    displayOrder: account.displayOrder,
  };
}

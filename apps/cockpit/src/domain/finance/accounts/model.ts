export const FINANCIAL_ACCOUNT_TYPES = ['cash', 'bank', 'credit', 'loan', 'investment'] as const;

export type FinancialAccountType = (typeof FINANCIAL_ACCOUNT_TYPES)[number];

export const FINANCIAL_ACCOUNT_TYPE_LABELS: Readonly<Record<FinancialAccountType, string>> = {
  cash: 'Cash',
  bank: 'Bank',
  credit: 'Credit',
  loan: 'Loan',
  investment: 'Investment',
};

export type FinancialAccountStatus = 'active' | 'archived';

export type FinancialAccount = Readonly<{
  id: string;
  name: string;
  accountType: FinancialAccountType;
  primaryCurrencyCode: string;
  displayOrder: number;
  status: FinancialAccountStatus;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}>;

export type FinancialAccountInput = Readonly<{
  name: string;
  accountType: FinancialAccountType;
  primaryCurrencyCode: string;
}>;

export function createEmptyFinancialAccountInput(): FinancialAccountInput {
  return { name: '', accountType: 'bank', primaryCurrencyCode: 'EUR' };
}

export function isFinancialAccountType(value: unknown): value is FinancialAccountType {
  return FINANCIAL_ACCOUNT_TYPES.includes(value as FinancialAccountType);
}

/** Shape check for server function input; the backend owns the business validation. */
export function validateFinancialAccountInput(input: unknown): FinancialAccountInput {
  if (!input || typeof input !== 'object') {
    throw new Error('Invalid financial account payload.');
  }

  const value = input as Partial<Record<keyof FinancialAccountInput, unknown>>;
  if (
    typeof value.name !== 'string' ||
    !isFinancialAccountType(value.accountType) ||
    typeof value.primaryCurrencyCode !== 'string'
  ) {
    throw new Error('Invalid financial account payload.');
  }

  return { name: value.name, accountType: value.accountType, primaryCurrencyCode: value.primaryCurrencyCode };
}

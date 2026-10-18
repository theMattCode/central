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

export type FinancialAccountIdInput = Readonly<{ id: string }>;

export function validateFinancialAccountIdInput(input: unknown): FinancialAccountIdInput {
  const value = (input ?? {}) as Partial<Record<keyof FinancialAccountIdInput, unknown>>;
  if (typeof value.id !== 'string' || !value.id) {
    throw new Error('Invalid financial account payload.');
  }

  return { id: value.id };
}

export type UpdateFinancialAccountInput = Readonly<{ id: string; account: FinancialAccountInput }>;

export function validateUpdateFinancialAccountInput(input: unknown): UpdateFinancialAccountInput {
  const { id } = validateFinancialAccountIdInput(input);
  const value = input as Partial<Record<keyof UpdateFinancialAccountInput, unknown>>;

  return { id, account: validateFinancialAccountInput(value.account) };
}

export type ReorderFinancialAccountsInput = Readonly<{ accountIds: string[] }>;

export function validateReorderFinancialAccountsInput(input: unknown): ReorderFinancialAccountsInput {
  const value = (input ?? {}) as Partial<Record<keyof ReorderFinancialAccountsInput, unknown>>;
  if (!Array.isArray(value.accountIds) || !value.accountIds.every((id) => typeof id === 'string')) {
    throw new Error('Invalid financial account payload.');
  }

  return { accountIds: value.accountIds };
}

/** Moves `activeId` to the position of `overId`, like dropping a dragged item onto another. */
export function moveAccountId(ids: readonly string[], activeId: string, overId: string): string[] {
  const from = ids.indexOf(activeId);
  const to = ids.indexOf(overId);
  if (from === -1 || to === -1 || from === to) {
    return [...ids];
  }

  const moved = ids.filter((id) => id !== activeId);
  moved.splice(to, 0, activeId);
  return moved;
}

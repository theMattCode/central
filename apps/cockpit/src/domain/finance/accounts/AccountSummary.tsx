import { FINANCIAL_ACCOUNT_TYPE_LABELS, type FinancialAccount } from '@/domain/finance/accounts/model.ts';

export function AccountSummary({ account }: { account: FinancialAccount }) {
  return (
    <>
      <span className="flex-1 truncate text-(--color-txt)">{account.name}</span>
      <span className="text-sm text-(--color-txt-sec)">{FINANCIAL_ACCOUNT_TYPE_LABELS[account.accountType]}</span>
      <span className="w-10 text-right text-sm text-(--color-txt-sec)">{account.primaryCurrencyCode}</span>
    </>
  );
}

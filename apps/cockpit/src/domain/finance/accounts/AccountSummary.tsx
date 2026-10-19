import { FINANCIAL_ACCOUNT_TYPE_LABELS, type FinancialAccount } from '@/domain/finance/accounts/model.ts';

export function AccountSummary(props: { account: FinancialAccount }) {
  return (
    <>
      <span class="flex-1 truncate text-(--color-txt)">{props.account.name}</span>
      <span class="text-sm text-(--color-txt-sec)">{FINANCIAL_ACCOUNT_TYPE_LABELS[props.account.accountType]}</span>
      <span class="w-10 text-right text-sm text-(--color-txt-sec)">{props.account.primaryCurrencyCode}</span>
    </>
  );
}

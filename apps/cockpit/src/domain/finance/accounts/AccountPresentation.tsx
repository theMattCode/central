import type { IconType } from 'react-icons';
import { BsCreditCard as CreditIcon } from 'react-icons/bs';
import { GiMoneyStack as CashIcon } from 'react-icons/gi';
import { MdOutlineAccountBalance as LoanIcon, MdOutlineAccountBalanceWallet as BankIcon } from 'react-icons/md';
import {
  FINANCIAL_ACCOUNT_TYPES,
  type FinancialAccount,
  type FinancialAccountType,
} from '@/domain/finance/accounts/model.ts';
import { cx } from '@/utils/styles.ts';

const TYPE_REPRESENTATION: Record<FinancialAccountType, IconType> = {
  bank: BankIcon,
  cash: CashIcon,
  loan: LoanIcon,
  credit: CreditIcon,
};

export function AccountIcon({ accountType, className }: { accountType: FinancialAccountType; className?: string }) {
  const Icon = TYPE_REPRESENTATION[accountType];
  return (
    <div className={cx('h-12 aspect-square shrink-0 rounded', className)}>
      <Icon className="w-full h-full" />
    </div>
  );
}

export function AccountDetails({
  accountType,
  primaryCurrencyCode,
}: {
  accountType: FinancialAccountType;
  primaryCurrencyCode: string;
}) {
  const typeLabel = FINANCIAL_ACCOUNT_TYPES.find((type) => type.value === accountType)?.label ?? accountType;
  return (
    <div className="text-sm text-(--color-txt-sec)">
      {typeLabel} · {primaryCurrencyCode}
    </div>
  );
}

export function AccountStatus({ account }: { account: FinancialAccount }) {
  return (
    <span
      className={cx(
        'rounded-full border border-(--color-section-border) px-2 py-1 text-xs',
        account.status === 'active'
          ? 'text-(--color-sem-positive) border-(--color-sem-positive)'
          : 'text-(--color-txt-sec) border-(--color-txt-sec)',
      )}
    >
      {account.status}
    </span>
  );
}

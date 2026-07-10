import { Section } from '@/components/Section/Section.tsx';
import { GridLayout } from '@/components/ContentLayout/GridLayout.tsx';
import type {
  FinancialAccount,
  FinancialAccountStatus,
  FinancialAccountType,
} from '@/domain/finance/accounts/model.ts';
import { BsCreditCard as CreditIcon } from 'react-icons/bs';
import {
  MdAdd as AddIcon,
  MdOutlineAccountBalance as LoanIcon,
  MdOutlineAccountBalanceWallet as BankIcon,
} from 'react-icons/md';
import { GiMoneyStack as CashIcon } from 'react-icons/gi';
import { cx } from '@/utils/styles.ts';
import type { IconType } from 'react-icons';
import { useState } from 'react';
import { ButtonGroup, type Option } from '@/components/ButtonGroup/ButtonGroup.tsx';
import { Button } from '@/components/Button/Button.tsx';

const testAccounts: FinancialAccount[] = [
  {
    id: 'cash-wallet',
    name: 'Cash Wallet',
    accountType: 'cash',
    primaryCurrencyCode: 'EUR',
    displayOrder: 10,
    status: 'active',
    archivedAt: null,
    createdAt: '2026-01-01T09:00:00.000Z',
    updatedAt: '2026-01-01T09:00:00.000Z',
  },
  {
    id: 'checking-account',
    name: 'Everyday Checking',
    accountType: 'bank',
    primaryCurrencyCode: 'EUR',
    displayOrder: 20,
    status: 'active',
    archivedAt: null,
    createdAt: '2026-01-02T09:00:00.000Z',
    updatedAt: '2026-01-02T09:00:00.000Z',
  },
  {
    id: 'savings-account',
    name: 'Emergency Savings',
    accountType: 'bank',
    primaryCurrencyCode: 'EUR',
    displayOrder: 30,
    status: 'active',
    archivedAt: null,
    createdAt: '2026-01-03T09:00:00.000Z',
    updatedAt: '2026-01-03T09:00:00.000Z',
  },
  {
    id: 'credit-card',
    name: 'Travel Credit Card',
    accountType: 'credit',
    primaryCurrencyCode: 'EUR',
    displayOrder: 40,
    status: 'active',
    archivedAt: null,
    createdAt: '2026-01-04T09:00:00.000Z',
    updatedAt: '2026-01-04T09:00:00.000Z',
  },
  {
    id: 'old-cash-envelope',
    name: 'Old Cash Envelope',
    accountType: 'cash',
    primaryCurrencyCode: 'EUR',
    displayOrder: 60,
    status: 'archived',
    archivedAt: '2026-06-01T12:00:00.000Z',
    createdAt: '2026-01-06T09:00:00.000Z',
    updatedAt: '2026-06-01T12:00:00.000Z',
  },
  {
    id: 'car-loan',
    name: 'Car Loan',
    accountType: 'loan',
    primaryCurrencyCode: 'EUR',
    displayOrder: 50,
    status: 'active',
    archivedAt: null,
    createdAt: '2026-01-05T09:00:00.000Z',
    updatedAt: '2026-01-05T09:00:00.000Z',
  },
];

const OPTION_ALL: Option = { id: 'all', text: 'All', style: { optionColor: 'var(--color-pri)' } };
const OPTION_ACTIVE: Option = { id: 'active', text: 'Active', style: { optionColor: 'var(--color-sem-positive)' } };
const OPTION_ARCHIVED: Option = { id: 'archived', text: 'Archived', style: { optionColor: 'var(--color-text-sec)' } };
const STATUS_FILTER_OPTIONS: Option[] = [OPTION_ALL, OPTION_ACTIVE, OPTION_ARCHIVED];

export type StatusFilterID = 'all' | FinancialAccountStatus;

function StatusFilterButton(props: { onChanged: (statusFilter: StatusFilterID) => void }) {
  return (
    <ButtonGroup
      options={STATUS_FILTER_OPTIONS}
      defaultValue={OPTION_ALL}
      onChanged={(option: Option) => props.onChanged(option.id as StatusFilterID)}
    />
  );
}

function PageActions(props: { onStatusFilterChanged: (statusFilter: StatusFilterID) => void }) {
  return (
    <div className="w-full pr-4 flex gap-2 justify-end">
      <StatusFilterButton onChanged={props.onStatusFilterChanged} />
      <Button type="button" text="Add" icon={AddIcon} />
    </div>
  );
}

export function AccountsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilterID>('all');
  return (
    <>
      <PageActions onStatusFilterChanged={(statusFilter: StatusFilterID) => setStatusFilter(statusFilter)} />
      <GridLayout>
        {testAccounts
          .filter((account) => statusFilter === 'all' || account.status === statusFilter)
          .sort((a, b) => a.displayOrder - b.displayOrder)
          .map((account) => (
            <AccountSection key={account.id} account={account} />
          ))}
      </GridLayout>
    </>
  );
}

function Status({ account }: { account: FinancialAccount }) {
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

function Details(props: { accountType: FinancialAccountType; primaryCurrencyCode: string }) {
  return (
    <div className="text-sm text-(--color-txt-sec)">
      {props.accountType} · {props.primaryCurrencyCode}
    </div>
  );
}

const TYPE_REPRESENTATION: Record<FinancialAccountType, { Icon: IconType; colorStyles: string }> = {
  bank: { Icon: BankIcon, colorStyles: '' },
  cash: { Icon: CashIcon, colorStyles: '' },
  loan: { Icon: LoanIcon, colorStyles: '' },
  credit: { Icon: CreditIcon, colorStyles: '' },
};

function Info({ account }: { account: FinancialAccount }) {
  return (
    <div className="w-full flex flex-col">
      <div className="w-full flex items-start justify-between gap-2">
        <h1 className="font-semibold">{account.name}</h1>
        <Status account={account} />
      </div>
      <Details accountType={account.accountType} primaryCurrencyCode={account.primaryCurrencyCode} />
    </div>
  );
}

export function AccountSection({ account }: { account: FinancialAccount }) {
  const { Icon, colorStyles } = TYPE_REPRESENTATION[account.accountType];
  return (
    <Section className="grid-section-lg">
      <div className="w-full flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <div className={cx('h-12 aspect-square rounded', colorStyles)}>
            <Icon className="w-full h-full" />
          </div>
          <Info account={account} />
        </div>
      </div>
    </Section>
  );
}

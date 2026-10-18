import type { FinancialAccount } from '@/domain/finance/accounts/model.ts';

type Props = {
  /** `null` while the accounts are loading or after loading failed. */
  accounts: FinancialAccount[] | null;
  error?: string | null;
  /** Only accounts in this currency can be picked. */
  currencyCode: string;
  value: string;
  onChange: (accountId: string) => void;
};

const SELECT_CLASS_NAME =
  'w-full rounded-md border border-(--color-section-border) bg-(--color-bg) px-3 py-2 text-(--color-txt) outline-none disabled:opacity-60';

/**
 * Picks the financial account a new entry is booked on. Only active accounts are offered; an
 * account that is already assigned stays selectable even if it has been archived since.
 */
export function AccountPicker({ accounts, error, currencyCode, value, onChange }: Props) {
  if (!accounts) {
    // Disabled until the accounts are known; submitting without an account is caught when building the input.
    return (
      <div className="w-full flex flex-col gap-1 text-sm text-(--color-txt-sec)">
        <label className="flex flex-col gap-1">
          Account
          <select disabled className={SELECT_CLASS_NAME} value="">
            <option value="">{error ? 'No accounts' : 'Loading accounts...'}</option>
          </select>
        </label>
        {error && (
          <span role="alert" className="text-red-600 dark:text-red-300">
            Accounts could not be loaded: {error}
          </span>
        )}
      </div>
    );
  }

  const selectable = accounts.filter(
    (account) => account.status === 'active' && account.primaryCurrencyCode === currencyCode,
  );
  const assigned = accounts.find((account) => account.id === value && !selectable.includes(account));

  if (selectable.length === 0 && !assigned) {
    return (
      <p className="flex flex-col gap-1 text-sm text-(--color-txt-sec)">
        No {currencyCode} account yet.
        <a href="/finance/accounts" className="text-(--color-pri) underline">
          Create an account
        </a>
      </p>
    );
  }

  return (
    <label className="w-full flex flex-col gap-1 text-sm text-(--color-txt-sec)">
      Account
      <select required className={SELECT_CLASS_NAME} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="" disabled>
          Select an account
        </option>
        {assigned && (
          <option value={assigned.id}>
            {assigned.name}
            {assigned.status === 'archived' ? ' (archived)' : ''}
          </option>
        )}
        {selectable.map((account) => (
          <option key={account.id} value={account.id}>
            {account.name}
          </option>
        ))}
      </select>
    </label>
  );
}

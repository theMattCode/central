import { useState } from 'react';
import { MdAdd as AddIcon } from 'react-icons/md';
import { Button } from '@/components/Button/Button.tsx';
import { Input } from '@/components/Input/Input.tsx';
import { Section } from '@/components/Section/Section.tsx';
import { useAccounts } from '@/domain/finance/accounts/data.ts';
import {
  createEmptyFinancialAccountInput,
  FINANCIAL_ACCOUNT_TYPE_LABELS,
  FINANCIAL_ACCOUNT_TYPES,
  type FinancialAccount,
  type FinancialAccountInput,
  type FinancialAccountType,
} from '@/domain/finance/accounts/model.ts';
import { useFinanceClient } from '@/domain/finance/FinanceClientContext.tsx';
import { toErrorMessage } from '@/utils/formatting.ts';

export function AccountsPage() {
  const financeClient = useFinanceClient();
  const { accounts, error, loading, reload } = useAccounts();
  const [form, setForm] = useState<FinancialAccountInput>(createEmptyFinancialAccountInput);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitForm = async () => {
    setFormError(null);
    setIsSubmitting(true);

    try {
      await financeClient.createAccount({
        name: form.name.trim(),
        accountType: form.accountType,
        primaryCurrencyCode: form.primaryCurrencyCode.trim(),
      });
      setForm(createEmptyFinancialAccountInput());
      reload();
    } catch (error) {
      setFormError(toErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {error && <ErrorMessage message={error} />}
      <AccountForm error={formError} form={form} isSubmitting={isSubmitting} onChange={setForm} onSubmit={submitForm} />
      {loading && !accounts && <p className="col-span-full text-sm text-(--color-txt-sec)">Loading accounts...</p>}
      {accounts && <AccountList accounts={accounts} />}
    </>
  );
}

type AccountFormProps = {
  error: string | null;
  form: FinancialAccountInput;
  isSubmitting: boolean;
  onChange: (form: FinancialAccountInput) => void;
  onSubmit: () => Promise<void>;
};

function AccountForm({ error, form, isSubmitting, onChange, onSubmit }: AccountFormProps) {
  const updateForm = (patch: Partial<FinancialAccountInput>) => onChange({ ...form, ...patch });

  return (
    <Section className="col-span-full">
      <form
        className="w-full flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit();
        }}
      >
        <div className="w-full grid grid-cols-1 sm:grid-cols-[2fr_1fr_6rem] gap-4">
          <label className="flex flex-col gap-1 text-sm text-(--color-txt-sec)">
            Name
            <Input required value={form.name} onChange={(event) => updateForm({ name: event.target.value })} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-(--color-txt-sec)">
            Type
            <select
              className="w-full rounded-md border border-(--color-section-border) bg-(--color-bg) px-3 py-2 text-(--color-txt) outline-none"
              value={form.accountType}
              onChange={(event) => updateForm({ accountType: event.target.value as FinancialAccountType })}
            >
              {FINANCIAL_ACCOUNT_TYPES.map((accountType) => (
                <option key={accountType} value={accountType}>
                  {FINANCIAL_ACCOUNT_TYPE_LABELS[accountType]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-(--color-txt-sec)">
            Currency
            <Input
              required
              maxLength={3}
              autoCapitalize="characters"
              value={form.primaryCurrencyCode}
              onChange={(event) => updateForm({ primaryCurrencyCode: event.target.value.toUpperCase() })}
            />
          </label>
        </div>
        <div className="flex justify-end">
          <Button type="submit" aria-label="Add account" text="Add" icon={AddIcon} disabled={isSubmitting} />
        </div>
        {error && <ErrorMessage message={error} />}
      </form>
    </Section>
  );
}

function AccountList({ accounts }: { accounts: FinancialAccount[] }) {
  if (accounts.length === 0) {
    return (
      <Section className="col-span-full">
        <p className="text-sm text-(--color-txt-sec)">No accounts yet.</p>
      </Section>
    );
  }

  return (
    <Section className="col-span-full">
      <ul aria-label="Accounts" className="w-full flex flex-col divide-y divide-(--color-section-border)">
        {accounts.map((account) => (
          <li key={account.id} className="flex items-center gap-3 py-2">
            <span className="flex-1 truncate text-(--color-txt)">{account.name}</span>
            <span className="text-sm text-(--color-txt-sec)">{FINANCIAL_ACCOUNT_TYPE_LABELS[account.accountType]}</span>
            <span className="w-10 text-right text-sm text-(--color-txt-sec)">{account.primaryCurrencyCode}</span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="col-span-full rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300"
    >
      {message}
    </div>
  );
}

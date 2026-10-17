import { useState } from 'react';
import type { IconType } from 'react-icons';
import { MdClose as CancelIcon } from 'react-icons/md';
import { Button } from '@/components/Button/Button.tsx';
import { Input } from '@/components/Input/Input.tsx';
import { ErrorMessage } from '@/domain/finance/accounts/ErrorMessage.tsx';
import {
  FINANCIAL_ACCOUNT_TYPE_LABELS,
  FINANCIAL_ACCOUNT_TYPES,
  type FinancialAccountInput,
  type FinancialAccountType,
} from '@/domain/finance/accounts/model.ts';
import { toErrorMessage } from '@/utils/formatting.ts';

type Props = {
  /** Accessible name of the form. */
  label: string;
  initialValue: FinancialAccountInput;
  submitLabel: string;
  submitText: string;
  submitIcon: IconType;
  /** Start over with `initialValue` after a successful submit, e.g. for a create form. */
  resetOnSuccess?: boolean;
  onSubmit: (input: FinancialAccountInput) => Promise<void>;
  onCancel?: () => void;
};

export function AccountEditor({
  label,
  initialValue,
  submitLabel,
  submitText,
  submitIcon,
  resetOnSuccess = false,
  onSubmit,
  onCancel,
}: Props) {
  const [form, setForm] = useState<FinancialAccountInput>(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const updateForm = (patch: Partial<FinancialAccountInput>) => setForm((prev) => ({ ...prev, ...patch }));

  const submit = async () => {
    setError(null);
    setIsSubmitting(true);

    try {
      await onSubmit({
        name: form.name.trim(),
        accountType: form.accountType,
        primaryCurrencyCode: form.primaryCurrencyCode.trim(),
      });
      if (resetOnSuccess) {
        setForm(initialValue);
      }
    } catch (error) {
      setError(toErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      aria-label={label}
      className="w-full flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
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
      <div className="flex gap-4 justify-end">
        {onCancel && (
          <Button type="button" aria-label="Cancel editing" text="Cancel" icon={CancelIcon} onClick={onCancel} />
        )}
        <Button type="submit" aria-label={submitLabel} text={submitText} icon={submitIcon} disabled={isSubmitting} />
      </div>
      {error && <ErrorMessage message={error} />}
    </form>
  );
}

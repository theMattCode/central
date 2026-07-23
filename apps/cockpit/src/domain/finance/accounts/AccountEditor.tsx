import { useEffect, useRef, useState } from 'react';
import { MdClose as CancelIcon, MdSave as SaveIcon } from 'react-icons/md';
import { Button } from '@/components/Button/Button.tsx';
import { EditableText } from '@/components/EditableText/EditableText.tsx';
import { Input } from '@/components/Input/Input.tsx';
import { Section } from '@/components/Section/Section.tsx';
import { AccountDetails, AccountIcon } from '@/domain/finance/accounts/AccountPresentation.tsx';
import {
  createEmptyFinancialAccountFormState,
  FINANCIAL_ACCOUNT_TYPES,
  toFinancialAccountFormState,
  type FinancialAccount,
  type FinancialAccountFormState,
  type FinancialAccountType,
} from '@/domain/finance/accounts/model.ts';
import { toErrorMessage } from '@/utils/formatting.ts';

type FormField = 'name' | 'primaryCurrencyCode';

type AccountEditorProps = {
  account: FinancialAccount | null;
  onCancel: () => void;
  onSubmit: (form: FinancialAccountFormState) => Promise<void>;
  shouldFocusName: boolean;
};

function validateForm(form: FinancialAccountFormState): Partial<Record<FormField, string>> {
  const errors: Partial<Record<FormField, string>> = {};
  if (!form.name.trim()) {
    errors.name = 'Enter a name.';
  }
  if (!/^[A-Za-z]{3}$/.test(form.primaryCurrencyCode.trim())) {
    errors.primaryCurrencyCode = 'Enter a three-letter currency code.';
  }
  return errors;
}

function FieldError({ message }: { message?: string }) {
  return message ? <span className="text-xs text-(--color-sem-negative)">{message}</span> : null;
}

export function AccountEditor({ account, onCancel, onSubmit, shouldFocusName }: AccountEditorProps) {
  const [form, setForm] = useState<FinancialAccountFormState>(() =>
    account ? toFinancialAccountFormState(account) : createEmptyFinancialAccountFormState(),
  );
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FormField, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const currencyInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (shouldFocusName) {
      nameInputRef.current?.focus();
    }
  }, [shouldFocusName]);

  const updateForm = (patch: Partial<FinancialAccountFormState>) => {
    setForm((currentForm) => ({ ...currentForm, ...patch }));
    setFieldErrors({});
    setSubmitError(null);
  };

  const submit = async () => {
    const nextFieldErrors = validateForm(form);
    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      (nextFieldErrors.name ? nameInputRef.current : currencyInputRef.current)?.focus();
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit(form);
    } catch (error) {
      setSubmitError(toErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const accountType = account?.accountType ?? form.accountType;

  return (
    <Section className="grid-section-lg">
      <form
        className="w-full flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="flex items-start gap-4">
          <AccountIcon accountType={accountType} className="mt-6" />
          <div className="min-w-0 grow flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm text-(--color-txt-sec)">
              Name
              <EditableText
                ref={nameInputRef}
                value={form.name}
                initialEditing
                error={Boolean(fieldErrors.name)}
                onChange={(name) => updateForm({ name })}
              />
              <FieldError message={fieldErrors.name} />
            </label>
            {account ? (
              <AccountDetails accountType={account.accountType} primaryCurrencyCode={account.primaryCurrencyCode} />
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm text-(--color-txt-sec)">
                  Account type
                  <select
                    className="w-full rounded-md border border-(--color-section-border) bg-(--color-bg) px-3 py-2 text-(--color-txt) outline-none"
                    value={form.accountType}
                    onChange={(event) => updateForm({ accountType: event.target.value as FinancialAccountType })}
                  >
                    {FINANCIAL_ACCOUNT_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm text-(--color-txt-sec)">
                  Currency
                  <Input
                    ref={currencyInputRef}
                    value={form.primaryCurrencyCode}
                    maxLength={3}
                    aria-invalid={Boolean(fieldErrors.primaryCurrencyCode)}
                    onChange={(event) => updateForm({ primaryCurrencyCode: event.target.value.toUpperCase() })}
                  />
                  <FieldError message={fieldErrors.primaryCurrencyCode} />
                </label>
              </div>
            )}
          </div>
        </div>
        {submitError && (
          <div
            role="alert"
            className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300"
          >
            {submitError}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" text="Cancel" icon={CancelIcon} onClick={onCancel} disabled={isSubmitting} />
          <Button type="submit" text="Save" icon={SaveIcon} disabled={isSubmitting} />
        </div>
      </form>
    </Section>
  );
}

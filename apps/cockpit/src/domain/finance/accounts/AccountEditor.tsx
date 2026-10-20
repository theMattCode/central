import { createSignal, createStore, For, Show, untrack } from 'solid-js';
import type { IconTypes } from 'solid-icons';
import { MdFillClose as CancelIcon } from 'solid-icons/md';
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
  /** Read once when the editor opens. */
  initialValue: FinancialAccountInput;
  submitLabel: string;
  submitText: string;
  submitIcon: IconTypes;
  /** Start over with `initialValue` after a successful submit, e.g. for a create form. */
  resetOnSuccess?: boolean;
  onSubmit: (input: FinancialAccountInput) => Promise<void>;
  onCancel?: () => void;
};

export function AccountEditor(props: Props) {
  const toForm = (value: FinancialAccountInput) => ({
    name: value.name,
    accountType: value.accountType,
    primaryCurrencyCode: value.primaryCurrencyCode,
  });
  const [form, setForm] = createStore(untrack(() => toForm(props.initialValue)));
  const [error, setError] = createSignal<string | null>(null);
  const [isSubmitting, setIsSubmitting] = createSignal(false);
  const updateForm = (patch: Partial<FinancialAccountInput>) =>
    setForm((current) => void Object.assign(current, patch));

  const submit = async () => {
    setError(null);
    setIsSubmitting(true);

    try {
      await props.onSubmit({
        name: form.name.trim(),
        accountType: form.accountType,
        primaryCurrencyCode: form.primaryCurrencyCode.trim(),
      });
      if (props.resetOnSuccess) {
        updateForm(toForm(props.initialValue));
      }
    } catch (error) {
      setError(toErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      aria-label={props.label}
      class="w-full flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div class="w-full grid grid-cols-1 sm:grid-cols-[2fr_1fr_6rem] gap-4">
        <label class="flex flex-col gap-1 text-sm text-(--color-txt-sec)">
          Name
          <Input required value={form.name} onInput={(event) => updateForm({ name: event.currentTarget.value })} />
        </label>
        <label class="flex flex-col gap-1 text-sm text-(--color-txt-sec)">
          Type
          <select
            class="w-full rounded-md border border-(--color-section-border) bg-(--color-bg) px-3 py-2 text-(--color-txt) outline-none"
            onChange={(event) => updateForm({ accountType: event.currentTarget.value as FinancialAccountType })}
          >
            <For each={FINANCIAL_ACCOUNT_TYPES}>
              {(accountType) => (
                <option value={accountType} selected={accountType === form.accountType}>
                  {FINANCIAL_ACCOUNT_TYPE_LABELS[accountType]}
                </option>
              )}
            </For>
          </select>
        </label>
        <label class="flex flex-col gap-1 text-sm text-(--color-txt-sec)">
          Currency
          <Input
            required
            maxlength={3}
            autocapitalize="characters"
            value={form.primaryCurrencyCode}
            onInput={(event) => updateForm({ primaryCurrencyCode: event.currentTarget.value.toUpperCase() })}
          />
        </label>
      </div>
      <div class="flex gap-4 justify-end">
        <Show when={props.onCancel}>
          <Button
            type="button"
            aria-label="Cancel editing"
            text="Cancel"
            icon={CancelIcon}
            onClick={() => props.onCancel?.()}
          />
        </Show>
        <Button
          type="submit"
          aria-label={props.submitLabel}
          text={props.submitText}
          icon={props.submitIcon}
          disabled={isSubmitting()}
        />
      </div>
      <Show when={error()}>{(message) => <ErrorMessage message={message()} />}</Show>
    </form>
  );
}

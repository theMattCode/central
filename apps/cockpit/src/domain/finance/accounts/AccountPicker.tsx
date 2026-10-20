import { createMemo, For, Show } from 'solid-js';
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
  'w-full rounded-md glass-control px-3 py-2 text-(--color-txt) outline-none disabled:opacity-60';

/**
 * Picks the financial account a new entry is booked on. Only active accounts are offered; an
 * account that is already assigned stays selectable even if it has been archived since.
 */
export function AccountPicker(props: Props) {
  const selectable = createMemo(() =>
    (props.accounts ?? []).filter(
      (account) => account.status === 'active' && account.primaryCurrencyCode === props.currencyCode,
    ),
  );
  const assigned = createMemo(() =>
    props.accounts?.find((account) => account.id === props.value && !selectable().includes(account)),
  );

  return (
    <Show
      when={props.accounts}
      fallback={
        // Disabled until the accounts are known; submitting without an account is caught when building the input.
        <div class="w-full flex flex-col gap-1 text-sm text-(--color-txt-sec)">
          <label class="flex flex-col gap-1">
            Account
            <select disabled class={SELECT_CLASS_NAME}>
              <option value="">{props.error ? 'No accounts' : 'Loading accounts...'}</option>
            </select>
          </label>
          <Show when={props.error}>
            <span role="alert" class="text-red-600 dark:text-red-300">
              Accounts could not be loaded: {props.error}
            </span>
          </Show>
        </div>
      }
    >
      <Show
        when={selectable().length > 0 || assigned()}
        fallback={
          <p class="flex flex-col gap-1 text-sm text-(--color-txt-sec)">
            No {props.currencyCode} account yet.
            <a href="/finance/accounts" class="text-(--color-pri) underline">
              Create an account
            </a>
          </p>
        }
      >
        <label class="w-full flex flex-col gap-1 text-sm text-(--color-txt-sec)">
          Account
          {/* Options carry the selection so it survives the options rendering after the select. */}
          <select required class={SELECT_CLASS_NAME} onChange={(event) => props.onChange(event.currentTarget.value)}>
            <option value="" disabled selected={!props.value}>
              Select an account
            </option>
            <Show when={assigned()}>
              {(account) => (
                <option value={account().id} selected>
                  {account().name}
                  {account().status === 'archived' ? ' (archived)' : ''}
                </option>
              )}
            </Show>
            <For each={selectable()}>
              {(account) => (
                <option value={account.id} selected={account.id === props.value}>
                  {account.name}
                </option>
              )}
            </For>
          </select>
        </label>
      </Show>
    </Show>
  );
}

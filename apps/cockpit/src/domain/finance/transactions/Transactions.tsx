import { createStore, Errored, For, Loading, Show } from 'solid-js';
import type { JSX } from '@solidjs/web';
import {
  MdFillAdd as AddIcon,
  MdFillClose as CancelIcon,
  MdFillDelete_outline as DeleteIcon,
  MdFillEdit as EditIcon,
  MdFillSave as SaveIcon,
} from 'solid-icons/md';
import { Button } from '@/components/Button/Button.tsx';
import { ButtonGroup, type Option as ButtonGroupOption } from '@/components/ButtonGroup/ButtonGroup.tsx';
import { toErrorMessage } from '@/utils/formatting.ts';
import {
  createEmptyTransactionFormState,
  toCashTransactionInput,
  TRANSACTION_CURRENCY_CODE,
  type Transaction,
  type TransactionDirection,
  type TransactionFormState,
} from '@/domain/finance/transactions/model.ts';
import { useTransactions } from '@/domain/finance/transactions/data.ts';
import { useDateRange } from '@/utils/useDateRange.ts';
import { SummaryStrip } from '@/domain/finance/transactions/SummaryStrip.tsx';
import { Section } from '@/components/Section/Section.tsx';
import { Input } from '@/components/Input/Input.tsx';
import { Icon } from '@/components/Icon/Icon.tsx';
import { PayMoneyIcon, ReceiveMoneyIcon } from '@/components/Icon/OriginalIcons.tsx';
import { AccountPicker } from '@/domain/finance/accounts/AccountPicker.tsx';
import { useAccounts } from '@/domain/finance/accounts/data.ts';
import type { FinancialAccount } from '@/domain/finance/accounts/model.ts';

export type Direction = { value: TransactionDirection; label: string };

export function Transactions() {
  const { dateRange /*, onFromChanged, onToChanged */ } = useDateRange();
  const transactions = useTransactions(dateRange);
  const accounts = useAccounts();

  const [state, setState] = createStore({
    form: createEmptyTransactionFormState(),
    editingTransactionId: null as string | null,
    formError: null as string | null,
  });

  const resetForm = () => {
    setState((current) => {
      current.editingTransactionId = null;
      current.form = createEmptyTransactionFormState();
      current.formError = null;
    });
  };

  const startEdit = (transaction: Transaction) => {
    setState((current) => {
      current.editingTransactionId = transaction.id;
      current.form = {
        direction: transaction.direction,
        transactionDate: transaction.transactionDate,
        amount: transaction.amount,
        description: transaction.description,
        category: transaction.category ?? '',
        note: transaction.note ?? '',
        financialAccountId: transaction.financialAccountId,
      };
      current.formError = null;
    });
  };

  const submitForm = async () => {
    setState((current) => void (current.formError = null));

    try {
      const input = toCashTransactionInput(state.form);
      if (state.editingTransactionId) {
        await transactions.update(state.editingTransactionId, input);
      } else {
        await transactions.create(input);
      }
      resetForm();
    } catch (error) {
      setState((current) => void (current.formError = toErrorMessage(error)));
    }
  };

  const deleteTransaction = async (transaction: Transaction) => {
    if (!window.confirm(`Delete "${transaction.description}"?`)) {
      return;
    }

    try {
      await transactions.delete(transaction);
      if (state.editingTransactionId === transaction.id) {
        resetForm();
      }
    } catch (error) {
      setState((current) => void (current.formError = toErrorMessage(error)));
    }
  };

  return (
    <>
      <Errored fallback={(error, reset) => <TransactionsError error={error()} onRetry={reset} />}>
        <Loading fallback={<p class="col-span-full text-sm text-(--color-txt-sec)">Loading transactions...</p>}>
          <SummaryStrip summary={transactions.data.summary} />
          <TransactionForm
            accounts={accounts.data.accounts}
            categories={transactions.data.categories}
            editing={Boolean(state.editingTransactionId)}
            error={state.formError}
            form={state.form}
            isSubmitting={transactions.isMutating()}
            onCancel={resetForm}
            onChange={(form) => setState((current) => void (current.form = form))}
            onSubmit={submitForm}
          />
          {/* Transaction list should have kind of toolbar
          <input type="month" value={month} class="rounded-md border border-(--color-section-border) bg-(--color-bg) px-3 py-2 text-(--color-txt)" onChange={(event) => setDateRangeMonth(event.target.value)} />
          <label class="flex flex-col gap-1 text-sm text-(--color-txt-sec)"></label>
          <button type="button" aria-label="Refresh transactions" title="Refresh" class="mt-6 rounded-md border border-(--color-section-border) p-2 text-(--color-txt-sec) hover:bg-(--color-pri)/10 hover:text-(--color-pri)" onClick={reload} >
            <RefreshIcon class="h-5 w-5" />
          </button>
       */}
          <Show when={transactions.isRefreshing()}>
            <p class="col-span-full text-sm text-(--color-txt-sec)">Updating transactions...</p>
          </Show>
          <TransactionList
            transactions={transactions.data.transactions}
            onDelete={deleteTransaction}
            onEdit={startEdit}
          />
        </Loading>
      </Errored>
    </>
  );
}

function TransactionsError(props: { error: unknown; onRetry: () => void }) {
  return (
    <div class="col-span-full flex flex-col gap-2 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300">
      <span>{toErrorMessage(props.error)}</span>
      <button class="self-start underline" onClick={props.onRetry} type="button">
        Retry
      </button>
    </div>
  );
}

type TransactionFormProps = {
  /** Read under the form's own boundaries, so loading or failing accounts never blocks the form. */
  accounts: FinancialAccount[];
  categories: string[];
  editing: boolean;
  error: string | null;
  form: TransactionFormState;
  isSubmitting: boolean;
  onCancel: () => void;
  onChange: (form: TransactionFormState) => void;
  onSubmit: () => void;
};

const DIRECTION_OPTIONS: ButtonGroupOption[] = [
  {
    id: 'expense',
    text: 'Ausgabe',
    style: { optionColor: 'var(--color-sem-negative)' },
    icon: PayMoneyIcon,
  },
  {
    id: 'income',
    text: 'Einnahme',
    style: { optionColor: 'var(--color-sem-positive)' },
    icon: ReceiveMoneyIcon,
  },
];

function TransactionForm(props: TransactionFormProps) {
  const updateForm = (patch: Partial<TransactionFormState>) => props.onChange({ ...props.form, ...patch });
  return (
    <Section>
      <form
        class="w-full flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void props.onSubmit();
        }}
      >
        <div class="w-full grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          <label class="w-full flex flex-col gap-1 text-sm text-(--color-txt-sec)">
            Direction
            <ButtonGroup
              defaultValue={DIRECTION_OPTIONS[0]}
              value={DIRECTION_OPTIONS.find((option) => option.id === props.form.direction)}
              options={DIRECTION_OPTIONS}
              onChanged={(option) => updateForm({ direction: option.id as TransactionDirection })}
            />
          </label>
          <label class="w-full flex flex-col gap-1 text-sm text-(--color-txt-sec)">
            Date
            <Input
              type="date"
              value={props.form.transactionDate}
              onInput={(event) => updateForm({ transactionDate: event.currentTarget.value })}
            />
          </label>
          <label class="w-full flex flex-col gap-1 text-sm text-(--color-txt-sec)">
            Amount
            <Input
              inputmode="decimal"
              value={props.form.amount}
              placeholder="0.00"
              onInput={(event) => updateForm({ amount: event.currentTarget.value })}
            />
          </label>
          <Errored
            fallback={(error) => (
              <AccountPicker
                accounts={null}
                error={toErrorMessage(error())}
                currencyCode={TRANSACTION_CURRENCY_CODE}
                value=""
                onChange={() => {}}
              />
            )}
          >
            <Loading
              fallback={
                <AccountPicker accounts={null} currencyCode={TRANSACTION_CURRENCY_CODE} value="" onChange={() => {}} />
              }
            >
              <AccountPicker
                accounts={props.accounts}
                currencyCode={TRANSACTION_CURRENCY_CODE}
                value={props.form.financialAccountId}
                onChange={(financialAccountId) => updateForm({ financialAccountId })}
              />
            </Loading>
          </Errored>
          <label class="flex flex-col gap-1 text-sm text-(--color-txt-sec)">
            Description
            <Input
              value={props.form.description}
              onInput={(event) => updateForm({ description: event.currentTarget.value })}
            />
          </label>
          <label class="flex flex-col gap-1 text-sm text-(--color-txt-sec)">
            Category
            <Input
              list="cash-category-options"
              value={props.form.category}
              onInput={(event) => updateForm({ category: event.currentTarget.value })}
            />
          </label>
          <label class="flex flex-col gap-1 text-sm text-(--color-txt-sec)">
            Note
            <Input value={props.form.note} onInput={(event) => updateForm({ note: event.currentTarget.value })} />
          </label>
        </div>
        <div class="flex gap-4 justify-end">
          <Show when={props.editing}>
            <Button
              type="button"
              aria-label="Cancel edit"
              title="Cancel"
              onClick={props.onCancel}
              icon={CancelIcon}
              text="Cancel"
            />
          </Show>
          <Button
            type="submit"
            name={props.editing ? 'Save Transaction' : 'Add transaction'}
            text={props.editing ? 'Save' : 'Add'}
            icon={props.editing ? SaveIcon : AddIcon}
            disabled={props.isSubmitting}
          />
        </div>
        <Show when={props.error}>
          <div class="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300 lg:col-span-5">
            {props.error}
          </div>
        </Show>
        <datalist id="cash-category-options">
          <For each={props.categories}>{(category) => <option value={category} />}</For>
        </datalist>
      </form>
    </Section>
  );
}

function TransactionList(props: {
  transactions: Transaction[];
  onDelete: (transaction: Transaction) => void;
  onEdit: (transaction: Transaction) => void;
}) {
  return (
    <Show
      when={props.transactions.length > 0}
      fallback={<p class="text-sm text-(--color-txt-sec)">No transactions for this month.</p>}
    >
      <Section>
        <div class="w-full hidden overflow-x-auto sm:block">
          <table class="w-full border-separate border-spacing-0 text-sm">
            <thead class="text-left text-(--color-txt-sec)">
              <tr>
                <th class="border-b border-(--color-section-border) py-2 pr-3 font-medium">Date</th>
                <th class="border-b border-(--color-section-border) py-2 pr-3 font-medium">Description</th>
                <th class="border-b border-(--color-section-border) py-2 pr-3 font-medium">Account</th>
                <th class="border-b border-(--color-section-border) py-2 pr-3 font-medium">Category</th>
                <th class="border-b border-(--color-section-border) py-2 pr-3 text-right font-medium">Amount</th>
                <th class="border-b border-(--color-section-border) py-2 pl-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              <For each={props.transactions}>
                {(transaction) => (
                  <TransactionRow transaction={transaction} onDelete={props.onDelete} onEdit={props.onEdit} />
                )}
              </For>
            </tbody>
          </table>
        </div>
        <div class="w-full flex flex-col gap-4 sm:hidden">
          <For each={props.transactions}>
            {(transaction) => (
              <TransactionCard transaction={transaction} onDelete={props.onDelete} onEdit={props.onEdit} />
            )}
          </For>
        </div>
      </Section>
    </Show>
  );
}

function TransactionRow(props: {
  transaction: Transaction;
  onDelete: (transaction: Transaction) => void;
  onEdit: (transaction: Transaction) => void;
}) {
  return (
    <tr>
      <td class="border-b border-(--color-section-border) py-2 pr-3">{props.transaction.transactionDate}</td>
      <td class="border-b border-(--color-section-border) py-2 pr-3">
        <div class="font-medium">{props.transaction.description}</div>
        {props.transaction.note && <div class="text-xs text-(--color-txt-sec)">{props.transaction.note}</div>}
      </td>
      <td class="border-b border-(--color-section-border) py-2 pr-3 text-(--color-txt-sec)">
        {props.transaction.financialAccountName}
      </td>
      <td class="border-b border-(--color-section-border) py-2 pr-3 text-(--color-txt-sec)">
        {props.transaction.category ?? '-'}
      </td>
      <td
        class={[
          'border-b border-(--color-section-border) py-2 pr-3 text-right font-semibold',
          {
            'text-emerald-600 dark:text-emerald-300': props.transaction.direction === 'income',
            'text-rose-600 dark:text-rose-300': props.transaction.direction !== 'income',
          },
        ]}
      >
        {props.transaction.direction === 'income' ? '+' : '-'}
        {props.transaction.amount} {props.transaction.currencyCode}
      </td>
      <td class="border-b border-(--color-section-border) py-2 pl-3">
        <div class="flex justify-end gap-1">
          <IconButton label="Edit transaction" onClick={() => props.onEdit(props.transaction)}>
            <Icon icon={EditIcon} class="h-5 w-5" />
          </IconButton>
          <IconButton label="Delete transaction" onClick={() => props.onDelete(props.transaction)}>
            <Icon icon={DeleteIcon} class="h-5 w-5" />
          </IconButton>
        </div>
      </td>
    </tr>
  );
}

function TransactionCard(props: {
  transaction: Transaction;
  onDelete: (transaction: Transaction) => void;
  onEdit: (transaction: Transaction) => void;
}) {
  return (
    <Section>
      <div class="w-full flex flex-col">
        <div class="w-full flex items-start justify-between gap-3">
          <div>
            <div class="font-medium">{props.transaction.description}</div>
            <div class="text-sm text-(--color-txt-sec)">
              {props.transaction.transactionDate} - {props.transaction.financialAccountName}
              {props.transaction.category ? ` - ${props.transaction.category}` : ''}
            </div>
            {props.transaction.note && <div class="mt-1 text-sm text-(--color-txt-sec)">{props.transaction.note}</div>}
          </div>
          <div
            class={[
              'shrink-0 text-right font-semibold',
              {
                'text-emerald-600 dark:text-emerald-300': props.transaction.direction === 'income',
                'text-rose-600 dark:text-rose-300': props.transaction.direction !== 'income',
              },
            ]}
          >
            {props.transaction.direction === 'income' ? '+' : '-'}
            {props.transaction.amount} {props.transaction.currencyCode}
          </div>
        </div>
        <div class="flex justify-end gap-1">
          <IconButton label="Edit transaction" onClick={() => props.onEdit(props.transaction)}>
            <Icon icon={EditIcon} class="h-5 w-5" />
          </IconButton>
          <IconButton label="Delete transaction" onClick={() => props.onDelete(props.transaction)}>
            <Icon icon={DeleteIcon} class="h-5 w-5" />
          </IconButton>
        </div>
      </div>
    </Section>
  );
}

function IconButton(props: { children: JSX.Element; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={props.label}
      title={props.label}
      class="rounded-md p-2 text-(--color-txt-sec) hover:bg-(--color-pri)/10 hover:text-(--color-pri)"
      onClick={props.onClick}
    >
      {props.children}
    </button>
  );
}

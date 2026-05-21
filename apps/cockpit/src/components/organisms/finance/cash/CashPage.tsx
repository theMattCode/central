import { type ReactNode, useEffect, useMemo, useState } from 'react';
import {
  MdAdd as AddIcon,
  MdClose as CancelIcon,
  MdDeleteOutline as DeleteIcon,
  MdEdit as EditIcon,
  MdRefresh as RefreshIcon,
  MdSave as SaveIcon,
} from 'react-icons/md';
import { Section } from '@/components/atoms/Section/Section.tsx';
import {
  createEmptyCashFormState,
  toCashTransactionInput,
  type CashFormState,
  type CashTransaction,
  type CashTransactionList,
  type TransactionDirection,
} from '@/components/organisms/finance/cash/model/model.ts';
import {
  createCashTransaction,
  deleteCashTransaction,
  fetchCashTransactions,
  updateCashTransaction,
} from '@/components/organisms/finance/cash/model/cashApi.ts';
import { cx } from '@/utils/styles.ts';
import { Button } from '@/components/atoms/Button/Button.tsx';
import { getCurrentLocalMonth } from '@/utils/datetime.ts';

type LoadState =
  | { status: 'loading' }
  | { status: 'loaded'; data: CashTransactionList }
  | { status: 'error'; message: string };

const DIRECTION_OPTIONS: Array<{ value: TransactionDirection; label: string }> = [
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
];

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected finance request error.';
}

export function CashPage() {
  const [month, setMonth] = useState(getCurrentLocalMonth);
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [form, setForm] = useState<CashFormState>(() => createEmptyCashFormState());
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => {
    const abortController = new AbortController();
    setState({ status: 'loading' });

    const loadTransactions = async () => {
      try {
        const data = await fetchCashTransactions({ data: { month }, signal: abortController.signal });
        setState({ status: 'loaded', data });
      } catch (error) {
        if (abortController.signal.aborted) {
          return;
        }
        setState({ status: 'error', message: toErrorMessage(error) });
      }
    };

    void loadTransactions();

    return () => abortController.abort();
  }, [month, refreshVersion]);

  const categories = useMemo(() => {
    if (state.status !== 'loaded') {
      return [];
    }

    return Array.from(
      new Set(state.data.transactions.map((transaction) => transaction.category).filter(Boolean) as string[]),
    ).sort((left, right) => left.localeCompare(right));
  }, [state]);

  const resetForm = () => {
    setEditingTransactionId(null);
    setForm(createEmptyCashFormState());
    setFormError(null);
  };

  const refresh = () => setRefreshVersion((version) => version + 1);

  const startEdit = (transaction: CashTransaction) => {
    setEditingTransactionId(transaction.id);
    setForm({
      direction: transaction.direction,
      transactionDate: transaction.transactionDate,
      amount: transaction.amount,
      description: transaction.description,
      category: transaction.category ?? '',
      note: transaction.note ?? '',
    });
    setFormError(null);
  };

  const submitForm = async () => {
    setFormError(null);
    setIsSubmitting(true);

    try {
      const input = toCashTransactionInput(form);
      if (editingTransactionId) {
        await updateCashTransaction({ data: { id: editingTransactionId, ...input } });
      } else {
        await createCashTransaction({ data: input });
      }
      resetForm();
      refresh();
    } catch (error) {
      setFormError(toErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteTransaction = async (transaction: CashTransaction) => {
    if (!window.confirm(`Delete "${transaction.description}"?`)) {
      return;
    }

    try {
      await deleteCashTransaction({ data: { id: transaction.id } });
      if (editingTransactionId === transaction.id) {
        resetForm();
      }
      refresh();
    } catch (error) {
      setFormError(toErrorMessage(error));
    }
  };

  return (
    <Section>
      <div className="w-full min-w-0 flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Income & Expense</h1>
            <p className="text-sm text-(--color-txt-sec)">Cash</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex flex-col gap-1 text-sm text-(--color-txt-sec)">
              Month
              <input
                type="month"
                value={month}
                className="rounded-md border border-(--color-section-border) bg-(--color-bg) px-3 py-2 text-(--color-txt)"
                onChange={(event) => setMonth(event.target.value)}
              />
            </label>
            <button
              type="button"
              aria-label="Refresh transactions"
              title="Refresh"
              className="mt-6 rounded-md border border-(--color-section-border) p-2 text-(--color-txt-sec) hover:bg-(--color-pri)/10 hover:text-(--color-pri)"
              onClick={refresh}
            >
              <RefreshIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        {state.status === 'loaded' && <SummaryStrip data={state.data} />}
        {state.status === 'error' && (
          <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300">
            {state.message}
          </div>
        )}

        <TransactionForm
          categories={categories}
          editing={Boolean(editingTransactionId)}
          error={formError}
          form={form}
          isSubmitting={isSubmitting}
          onCancel={resetForm}
          onChange={setForm}
          onSubmit={submitForm}
        />

        {state.status === 'loading' && <p className="text-sm text-(--color-txt-sec)">Loading transactions...</p>}
        {state.status === 'loaded' && (
          <TransactionList data={state.data} onDelete={deleteTransaction} onEdit={startEdit} />
        )}
      </div>
    </Section>
  );
}

function SummaryStrip({ data }: { data: CashTransactionList }) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      <SummaryValue label="Income" value={data.summary.incomeTotal.amount} tone="income" />
      <SummaryValue label="Expenses" value={data.summary.expenseTotal.amount} tone="expense" />
      <SummaryValue label="Net" value={data.summary.netTotal.amount} tone="net" />
    </div>
  );
}

function SummaryValue({ label, value, tone }: { label: string; value: string; tone: 'income' | 'expense' | 'net' }) {
  return (
    <div className="rounded-md border border-(--color-section-border) px-3 py-2">
      <div className="text-xs uppercase text-(--color-txt-sec)">{label}</div>
      <div
        className={cx(
          'text-xl font-semibold',
          tone === 'income' ? 'text-emerald-600 dark:text-emerald-300' : undefined,
          tone === 'expense' ? 'text-rose-600 dark:text-rose-300' : undefined,
        )}
      >
        {value} EUR
      </div>
    </div>
  );
}

type TransactionFormProps = {
  categories: string[];
  editing: boolean;
  error: string | null;
  form: CashFormState;
  isSubmitting: boolean;
  onCancel: () => void;
  onChange: (form: CashFormState) => void;
  onSubmit: () => void;
};

function TransactionForm({
  categories,
  editing,
  error,
  form,
  isSubmitting,
  onCancel,
  onChange,
  onSubmit,
}: TransactionFormProps) {
  const updateForm = (patch: Partial<CashFormState>) => onChange({ ...form, ...patch });

  return (
    <form
      className="grid gap-3 rounded-md border border-(--color-section-border) p-3 lg:grid-cols-[8rem_10rem_8rem_1fr_12rem] lg:items-end"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit();
      }}
    >
      <label className="flex flex-col gap-1 text-sm text-(--color-txt-sec)">
        Direction
        <select
          value={form.direction}
          className="rounded-md border border-(--color-section-border) bg-(--color-bg) px-3 py-2 text-(--color-txt)"
          onChange={(event) => updateForm({ direction: event.target.value as TransactionDirection })}
        >
          {DIRECTION_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm text-(--color-txt-sec)">
        Date
        <input
          type="date"
          value={form.transactionDate}
          className="rounded-md border border-(--color-section-border) bg-(--color-bg) px-3 py-2 text-(--color-txt)"
          onChange={(event) => updateForm({ transactionDate: event.target.value })}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-(--color-txt-sec)">
        Amount
        <input
          inputMode="decimal"
          value={form.amount}
          placeholder="0.00"
          className="rounded-md border border-(--color-section-border) bg-(--color-bg) px-3 py-2 text-(--color-txt)"
          onChange={(event) => updateForm({ amount: event.target.value })}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-(--color-txt-sec)">
        Description
        <input
          value={form.description}
          className="rounded-md border border-(--color-section-border) bg-(--color-bg) px-3 py-2 text-(--color-txt)"
          onChange={(event) => updateForm({ description: event.target.value })}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-(--color-txt-sec)">
        Category
        <input
          list="cash-category-options"
          value={form.category}
          className="rounded-md border border-(--color-section-border) bg-(--color-bg) px-3 py-2 text-(--color-txt)"
          onChange={(event) => updateForm({ category: event.target.value })}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-(--color-txt-sec) lg:col-span-4">
        Note
        <input
          value={form.note}
          className="rounded-md border border-(--color-section-border) bg-(--color-bg) px-3 py-2 text-(--color-txt)"
          onChange={(event) => updateForm({ note: event.target.value })}
        />
      </label>
      <div className="flex gap-2 lg:justify-end">
        {editing && (
          <button
            type="button"
            aria-label="Cancel edit"
            title="Cancel"
            className="rounded-md border border-(--color-section-border) p-2 text-(--color-txt-sec) hover:bg-(--color-pri)/10 hover:text-(--color-pri)"
            onClick={onCancel}
          >
            <CancelIcon className="h-5 w-5" />
          </button>
        )}
        <Button type="submit" name={editing ? 'Save Transaction' : 'Add transaction'} text={editing ? 'Save' : 'Add'} />
        <button
          type="submit"
          aria-label={editing ? 'Save transaction' : 'Add transaction'}
          title={editing ? 'Save' : 'Add'}
          disabled={isSubmitting}
          className="rounded-md border border-(--color-pri)/60 bg-(--color-pri)/10 p-2 text-(--color-pri) disabled:opacity-50"
        >
          {editing ? <SaveIcon className="h-5 w-5" /> : <AddIcon className="h-5 w-5" />}
        </button>
      </div>
      {error && (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300 lg:col-span-5">
          {error}
        </div>
      )}
      <datalist id="cash-category-options">
        {categories.map((category) => (
          <option key={category} value={category} />
        ))}
      </datalist>
    </form>
  );
}

function TransactionList({
  data,
  onDelete,
  onEdit,
}: {
  data: CashTransactionList;
  onDelete: (transaction: CashTransaction) => void;
  onEdit: (transaction: CashTransaction) => void;
}) {
  if (data.transactions.length === 0) {
    return <p className="text-sm text-(--color-txt-sec)">No transactions for this month.</p>;
  }

  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead className="text-left text-(--color-txt-sec)">
            <tr>
              <th className="border-b border-(--color-section-border) py-2 pr-3 font-medium">Date</th>
              <th className="border-b border-(--color-section-border) py-2 pr-3 font-medium">Description</th>
              <th className="border-b border-(--color-section-border) py-2 pr-3 font-medium">Category</th>
              <th className="border-b border-(--color-section-border) py-2 pr-3 text-right font-medium">Amount</th>
              <th className="border-b border-(--color-section-border) py-2 pl-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.transactions.map((transaction) => (
              <TransactionRow key={transaction.id} transaction={transaction} onDelete={onDelete} onEdit={onEdit} />
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-2 md:hidden">
        {data.transactions.map((transaction) => (
          <TransactionCard key={transaction.id} transaction={transaction} onDelete={onDelete} onEdit={onEdit} />
        ))}
      </div>
    </>
  );
}

function TransactionRow({
  transaction,
  onDelete,
  onEdit,
}: {
  transaction: CashTransaction;
  onDelete: (transaction: CashTransaction) => void;
  onEdit: (transaction: CashTransaction) => void;
}) {
  return (
    <tr>
      <td className="border-b border-(--color-section-border) py-2 pr-3">{transaction.transactionDate}</td>
      <td className="border-b border-(--color-section-border) py-2 pr-3">
        <div className="font-medium">{transaction.description}</div>
        {transaction.note && <div className="text-xs text-(--color-txt-sec)">{transaction.note}</div>}
      </td>
      <td className="border-b border-(--color-section-border) py-2 pr-3 text-(--color-txt-sec)">
        {transaction.category ?? '-'}
      </td>
      <td
        className={cx(
          'border-b border-(--color-section-border) py-2 pr-3 text-right font-semibold',
          transaction.direction === 'income'
            ? 'text-emerald-600 dark:text-emerald-300'
            : 'text-rose-600 dark:text-rose-300',
        )}
      >
        {transaction.direction === 'income' ? '+' : '-'}
        {transaction.amount} {transaction.currencyCode}
      </td>
      <td className="border-b border-(--color-section-border) py-2 pl-3">
        <div className="flex justify-end gap-1">
          <IconButton label="Edit transaction" onClick={() => onEdit(transaction)}>
            <EditIcon className="h-5 w-5" />
          </IconButton>
          <IconButton label="Delete transaction" onClick={() => onDelete(transaction)}>
            <DeleteIcon className="h-5 w-5" />
          </IconButton>
        </div>
      </td>
    </tr>
  );
}

function TransactionCard({
  transaction,
  onDelete,
  onEdit,
}: {
  transaction: CashTransaction;
  onDelete: (transaction: CashTransaction) => void;
  onEdit: (transaction: CashTransaction) => void;
}) {
  return (
    <div className="rounded-md border border-(--color-section-border) p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium">{transaction.description}</div>
          <div className="text-sm text-(--color-txt-sec)">
            {transaction.transactionDate}
            {transaction.category ? ` - ${transaction.category}` : ''}
          </div>
          {transaction.note && <div className="mt-1 text-sm text-(--color-txt-sec)">{transaction.note}</div>}
        </div>
        <div
          className={cx(
            'shrink-0 text-right font-semibold',
            transaction.direction === 'income'
              ? 'text-emerald-600 dark:text-emerald-300'
              : 'text-rose-600 dark:text-rose-300',
          )}
        >
          {transaction.direction === 'income' ? '+' : '-'}
          {transaction.amount} {transaction.currencyCode}
        </div>
      </div>
      <div className="mt-2 flex justify-end gap-1">
        <IconButton label="Edit transaction" onClick={() => onEdit(transaction)}>
          <EditIcon className="h-5 w-5" />
        </IconButton>
        <IconButton label="Delete transaction" onClick={() => onDelete(transaction)}>
          <DeleteIcon className="h-5 w-5" />
        </IconButton>
      </div>
    </div>
  );
}

function IconButton({ children, label, onClick }: { children: ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="rounded-md p-2 text-(--color-txt-sec) hover:bg-(--color-pri)/10 hover:text-(--color-pri)"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

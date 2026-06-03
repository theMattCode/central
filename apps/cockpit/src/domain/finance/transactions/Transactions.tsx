import { type ReactNode, useState } from 'react';
import {
  MdAdd as AddIcon,
  MdClose as CancelIcon,
  MdDeleteOutline as DeleteIcon,
  MdEdit as EditIcon,
  MdSave as SaveIcon,
} from 'react-icons/md';
import { GiPayMoney, GiReceiveMoney } from 'react-icons/gi';
import { Button } from '@/components/Button/Button.tsx';
import { ButtonGroup, type Option as ButtonGroupOption } from '@/components/ButtonGroup/ButtonGroup.tsx';
import { toErrorMessage } from '@/utils/formatting.ts';
import { cx } from '@/utils/styles.ts';
import {
  createCashTransaction,
  deleteCashTransaction,
  updateCashTransaction,
} from 'src/domain/finance/transactions/api.ts';
import {
  createEmptyTransactionFormState,
  type Summary,
  toCashTransactionInput,
  type Transaction,
  type TransactionDirection,
  type TransactionFormState,
} from 'src/domain/finance/transactions/model.ts';
import { useTransactions } from '@/domain/finance/transactions/data.ts';
import { useDateRange } from '@/utils/useDateRange.ts';
import { Grid } from '@/components/Grid/Grid.tsx';

export type Direction = { value: TransactionDirection; label: string };

export function Transactions() {
  const { dateRange /*, onFromChanged, onToChanged */ } = useDateRange();
  const { data, loading, error, reload } = useTransactions(dateRange);

  const [form, setForm] = useState<TransactionFormState>(() => createEmptyTransactionFormState());
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setEditingTransactionId(null);
    setForm(createEmptyTransactionFormState());
    setFormError(null);
  };

  const startEdit = (transaction: Transaction) => {
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
        await updateCashTransaction({
          data: { id: editingTransactionId, ...input },
        });
      } else {
        await createCashTransaction({ data: input });
      }
      resetForm();
      reload();
    } catch (error) {
      setFormError(toErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteTransaction = async (transaction: Transaction) => {
    if (!window.confirm(`Delete "${transaction.description}"?`)) {
      return;
    }

    try {
      await deleteCashTransaction({ data: { id: transaction.id } });
      if (editingTransactionId === transaction.id) {
        resetForm();
      }
      reload();
    } catch (error) {
      setFormError(toErrorMessage(error));
    }
  };

  return (
    <div className="w-full min-w-0 h-full transition-all flex flex-col gap-4">
      {data && (
        <>
          {data?.summary && (
            <Grid>
              <SummaryStrip summary={data.summary} />
            </Grid>
          )}
          {error && (
            <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-400 dark:text-red-300">
              {error.message}
            </div>
          )}
          <TransactionForm
            categories={data?.categories ?? []}
            editing={Boolean(editingTransactionId)}
            error={formError}
            form={form}
            isSubmitting={isSubmitting}
            onCancel={resetForm}
            onChange={setForm}
            onSubmit={submitForm}
          />
          {loading && <p className="text-sm text-(--color-txt-sec)">Loading transactions...</p>}
          {/* Transaction list should have kind of toolbar
          <input type="month" value={month} className="rounded-md border border-(--color-section-border) bg-(--color-bg) px-3 py-2 text-(--color-txt)" onChange={(event) => setDateRangeMonth(event.target.value)} />
          <label className="flex flex-col gap-1 text-sm text-(--color-txt-sec)"></label>
          <button type="button" aria-label="Refresh transactions" title="Refresh" className="mt-6 rounded-md border border-(--color-section-border) p-2 text-(--color-txt-sec) hover:bg-(--color-pri)/10 hover:text-(--color-pri)" onClick={reload} >
            <RefreshIcon className="h-5 w-5" />
          </button>
       */}
          {data && <TransactionList transactions={data.transactions} onDelete={deleteTransaction} onEdit={startEdit} />}
        </>
      )}
    </div>
  );
}

function SummaryStrip({ summary }: { summary: Summary }) {
  return (
    <>
      <SummaryValue label="Income" value={summary.incomeTotal.amount} tone="income" />
      <SummaryValue label="Expenses" value={summary.expenseTotal.amount} tone="expense" />
      <SummaryValue label="Net" value={summary.netTotal.amount} tone="net" />
    </>
  );
}

function SummaryValue({ label, value, tone }: { label: string; value: string; tone: 'income' | 'expense' | 'net' }) {
  return (
    <div className="rounded-md border border-(--color-section-border) px-3 py-2 flex flex-col">
      <div className="text-xs uppercase text-(--color-txt-sec)">{label}</div>
      <div
        className={cx(
          'text-xl font-semibold text-center',
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
    icon: GiPayMoney,
  },
  {
    id: 'income',
    text: 'Einnahme',
    style: { optionColor: 'var(--color-sem-positive)' },
    icon: GiReceiveMoney,
  },
];

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
  const updateForm = (patch: Partial<TransactionFormState>) => onChange({ ...form, ...patch });
  return (
    <form
      className="flex flex-col gap-3 rounded-md border border-(--color-section-border) p-3"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit();
      }}
    >
      <div className="flex flex-col md:flex-row md:flex-wrap flex-1 gap-3">
        <label className="flex flex-col gap-1 text-sm text-(--color-txt-sec)">
          Direction
          <ButtonGroup
            defaultValue={DIRECTION_OPTIONS[0]}
            options={DIRECTION_OPTIONS}
            onChanged={(option) => updateForm({ direction: option.id as TransactionDirection })}
          />
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
      </div>
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
        <Button
          type="submit"
          name={editing ? 'Save Transaction' : 'Add transaction'}
          text={editing ? 'Save' : 'Add'}
          icon={editing ? SaveIcon : AddIcon}
          disabled={isSubmitting}
        />
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
  transactions,
  onDelete,
  onEdit,
}: {
  transactions: Transaction[];
  onDelete: (transaction: Transaction) => void;
  onEdit: (transaction: Transaction) => void;
}) {
  if (transactions.length === 0) {
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
            {transactions.map((transaction) => (
              <TransactionRow key={transaction.id} transaction={transaction} onDelete={onDelete} onEdit={onEdit} />
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-2 md:hidden">
        {transactions.map((transaction) => (
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
  transaction: Transaction;
  onDelete: (transaction: Transaction) => void;
  onEdit: (transaction: Transaction) => void;
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
  transaction: Transaction;
  onDelete: (transaction: Transaction) => void;
  onEdit: (transaction: Transaction) => void;
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

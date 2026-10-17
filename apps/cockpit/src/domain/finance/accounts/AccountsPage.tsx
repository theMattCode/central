import { useState } from 'react';
import { MdAdd as AddIcon, MdEdit as EditIcon, MdSave as SaveIcon } from 'react-icons/md';
import { Button } from '@/components/Button/Button.tsx';
import { Section } from '@/components/Section/Section.tsx';
import { AccountEditor } from '@/domain/finance/accounts/AccountEditor.tsx';
import { useAccounts } from '@/domain/finance/accounts/data.ts';
import { ErrorMessage } from '@/domain/finance/accounts/ErrorMessage.tsx';
import {
  createEmptyFinancialAccountInput,
  FINANCIAL_ACCOUNT_TYPE_LABELS,
  type FinancialAccount,
  type FinancialAccountInput,
} from '@/domain/finance/accounts/model.ts';
import { useFinanceClient } from '@/domain/finance/FinanceClientContext.tsx';

export function AccountsPage() {
  const financeClient = useFinanceClient();
  const { accounts, error, loading, reload } = useAccounts();

  const createAccount = async (input: FinancialAccountInput) => {
    await financeClient.createAccount(input);
    reload();
  };

  const updateAccount = async (id: string, input: FinancialAccountInput) => {
    await financeClient.updateAccount(id, input);
    reload();
  };

  return (
    <>
      {error && <ErrorMessage message={error} />}
      <Section className="col-span-full">
        <AccountEditor
          label="New account"
          initialValue={createEmptyFinancialAccountInput()}
          submitLabel="Add account"
          submitText="Add"
          submitIcon={AddIcon}
          resetOnSuccess
          onSubmit={createAccount}
        />
      </Section>
      {loading && !accounts && <p className="col-span-full text-sm text-(--color-txt-sec)">Loading accounts...</p>}
      {accounts && <AccountList accounts={accounts} onUpdate={updateAccount} />}
    </>
  );
}

type AccountListProps = {
  accounts: FinancialAccount[];
  onUpdate: (id: string, input: FinancialAccountInput) => Promise<void>;
};

function AccountList({ accounts, onUpdate }: AccountListProps) {
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);

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
          <li key={account.id} className="flex flex-wrap items-center gap-3 py-2">
            {editingAccountId === account.id ? (
              <AccountEditor
                label={`Edit ${account.name}`}
                initialValue={account}
                submitLabel="Save account"
                submitText="Save"
                submitIcon={SaveIcon}
                onSubmit={async (input) => {
                  await onUpdate(account.id, input);
                  setEditingAccountId(null);
                }}
                onCancel={() => setEditingAccountId(null)}
              />
            ) : (
              <>
                <span className="flex-1 truncate text-(--color-txt)">{account.name}</span>
                <span className="text-sm text-(--color-txt-sec)">
                  {FINANCIAL_ACCOUNT_TYPE_LABELS[account.accountType]}
                </span>
                <span className="w-10 text-right text-sm text-(--color-txt-sec)">{account.primaryCurrencyCode}</span>
                <Button
                  type="button"
                  aria-label={`Edit ${account.name}`}
                  icon={EditIcon}
                  onClick={() => setEditingAccountId(account.id)}
                />
              </>
            )}
          </li>
        ))}
      </ul>
    </Section>
  );
}

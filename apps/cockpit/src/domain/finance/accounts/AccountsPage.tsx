import { useState } from 'react';
import { MdAdd as AddIcon, MdArchive as ArchiveIcon, MdEdit as EditIcon, MdSave as SaveIcon } from 'react-icons/md';
import { Button } from '@/components/Button/Button.tsx';
import { Section } from '@/components/Section/Section.tsx';
import { AccountEditor } from '@/domain/finance/accounts/AccountEditor.tsx';
import { AccountSummary } from '@/domain/finance/accounts/AccountSummary.tsx';
import { ArchivedAccounts } from '@/domain/finance/accounts/ArchivedAccounts.tsx';
import { useAccounts } from '@/domain/finance/accounts/data.ts';
import { ErrorMessage } from '@/domain/finance/accounts/ErrorMessage.tsx';
import {
  createEmptyFinancialAccountInput,
  type FinancialAccount,
  type FinancialAccountInput,
} from '@/domain/finance/accounts/model.ts';
import { useFinanceClient } from '@/domain/finance/FinanceClientContext.tsx';
import { toErrorMessage } from '@/utils/formatting.ts';

export function AccountsPage() {
  const financeClient = useFinanceClient();
  const { accounts, error, loading, reload } = useAccounts();
  const [actionError, setActionError] = useState<string | null>(null);

  const createAccount = async (input: FinancialAccountInput) => {
    await financeClient.createAccount(input);
    reload();
  };

  const updateAccount = async (id: string, input: FinancialAccountInput) => {
    await financeClient.updateAccount(id, input);
    reload();
  };

  const runAccountAction = async (action: () => Promise<FinancialAccount>) => {
    setActionError(null);
    try {
      await action();
      reload();
    } catch (error) {
      setActionError(toErrorMessage(error));
    }
  };

  const activeAccounts = accounts?.filter((account) => account.status === 'active') ?? [];
  const archivedAccounts = accounts?.filter((account) => account.status === 'archived') ?? [];

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
      {actionError && <ErrorMessage message={actionError} />}
      {loading && !accounts && <p className="col-span-full text-sm text-(--color-txt-sec)">Loading accounts...</p>}
      {accounts && (
        <AccountList
          accounts={activeAccounts}
          emptyMessage={archivedAccounts.length > 0 ? 'No active accounts.' : 'No accounts yet.'}
          onUpdate={updateAccount}
          onArchive={(account) => void runAccountAction(() => financeClient.archiveAccount(account.id))}
        />
      )}
      {archivedAccounts.length > 0 && (
        <ArchivedAccounts
          accounts={archivedAccounts}
          onRestore={(account) => void runAccountAction(() => financeClient.restoreAccount(account.id))}
        />
      )}
    </>
  );
}

type AccountListProps = {
  accounts: FinancialAccount[];
  emptyMessage: string;
  onUpdate: (id: string, input: FinancialAccountInput) => Promise<void>;
  onArchive: (account: FinancialAccount) => void;
};

function AccountList({ accounts, emptyMessage, onUpdate, onArchive }: AccountListProps) {
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);

  if (accounts.length === 0) {
    return (
      <Section className="col-span-full">
        <p className="text-sm text-(--color-txt-sec)">{emptyMessage}</p>
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
                <AccountSummary account={account} />
                <Button
                  type="button"
                  aria-label={`Edit ${account.name}`}
                  title="Edit"
                  icon={EditIcon}
                  onClick={() => setEditingAccountId(account.id)}
                />
                <Button
                  type="button"
                  aria-label={`Archive ${account.name}`}
                  title="Archive"
                  icon={ArchiveIcon}
                  onClick={() => onArchive(account)}
                />
              </>
            )}
          </li>
        ))}
      </ul>
    </Section>
  );
}

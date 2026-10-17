import { useState } from 'react';
import { MdAdd as AddIcon } from 'react-icons/md';
import { Section } from '@/components/Section/Section.tsx';
import { AccountEditor } from '@/domain/finance/accounts/AccountEditor.tsx';
import { ArchivedAccounts } from '@/domain/finance/accounts/ArchivedAccounts.tsx';
import { useAccounts } from '@/domain/finance/accounts/data.ts';
import { ErrorMessage } from '@/domain/finance/accounts/ErrorMessage.tsx';
import {
  createEmptyFinancialAccountInput,
  type FinancialAccount,
  type FinancialAccountInput,
} from '@/domain/finance/accounts/model.ts';
import { SortableAccountList } from '@/domain/finance/accounts/SortableAccountList.tsx';
import { useFinanceClient } from '@/domain/finance/FinanceClientContext.tsx';
import { toErrorMessage } from '@/utils/formatting.ts';

export function AccountsPage() {
  const financeClient = useFinanceClient();
  const { accounts, error, loading, reload, setAccounts } = useAccounts();
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

  // Show the new order right away and roll back if the backend rejects it.
  const reorderAccounts = async (accountIds: string[]) => {
    if (!accounts) {
      return;
    }
    const previous = accounts;
    const reordered = accountIds.flatMap((id) => activeAccounts.filter((account) => account.id === id));
    setActionError(null);
    setAccounts([...reordered, ...archivedAccounts]);
    try {
      setAccounts(await financeClient.reorderAccounts(accountIds));
    } catch (error) {
      setAccounts(previous);
      setActionError(toErrorMessage(error));
    }
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
      {actionError && <ErrorMessage message={actionError} />}
      {loading && !accounts && <p className="col-span-full text-sm text-(--color-txt-sec)">Loading accounts...</p>}
      {accounts && (
        <SortableAccountList
          accounts={activeAccounts}
          emptyMessage={archivedAccounts.length > 0 ? 'No active accounts.' : 'No accounts yet.'}
          onUpdate={updateAccount}
          onArchive={(account) => void runAccountAction(() => financeClient.archiveAccount(account.id))}
          onReorder={(accountIds) => void reorderAccounts(accountIds)}
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

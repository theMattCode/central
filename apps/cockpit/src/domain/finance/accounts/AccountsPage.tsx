import { createMemo, createSignal, Errored, Loading, Show } from 'solid-js';
import { MdFillAdd as AddIcon } from 'solid-icons/md';
import { Section } from '@/components/Section/Section.tsx';
import { AccountEditor } from '@/domain/finance/accounts/AccountEditor.tsx';
import { ArchivedAccounts } from '@/domain/finance/accounts/ArchivedAccounts.tsx';
import { useAccounts } from '@/domain/finance/accounts/data.ts';
import { ErrorMessage } from '@/domain/finance/accounts/ErrorMessage.tsx';
import { createEmptyFinancialAccountInput } from '@/domain/finance/accounts/model.ts';
import { SortableAccountList } from '@/domain/finance/accounts/SortableAccountList.tsx';
import { toErrorMessage } from '@/utils/formatting.ts';

export function AccountsPage() {
  const accounts = useAccounts();
  const [actionError, setActionError] = createSignal<string | null>(null);

  const activeAccounts = createMemo(() => accounts.data.accounts.filter((account) => account.status === 'active'));
  const archivedAccounts = createMemo(() => accounts.data.accounts.filter((account) => account.status === 'archived'));

  const runAccountAction = async (accountAction: () => Promise<void>) => {
    setActionError(null);
    try {
      await accountAction();
    } catch (error) {
      setActionError(toErrorMessage(error));
    }
  };

  return (
    <>
      <Section class="col-span-full">
        <AccountEditor
          label="New account"
          initialValue={createEmptyFinancialAccountInput()}
          submitLabel="Add account"
          submitText="Add"
          submitIcon={AddIcon}
          resetOnSuccess
          onSubmit={accounts.create}
        />
      </Section>
      <Show when={actionError()}>{(message) => <ErrorMessage message={message()} />}</Show>
      <Errored fallback={(error) => <ErrorMessage message={toErrorMessage(error())} />}>
        <Loading fallback={<p class="col-span-full text-sm text-(--color-txt-sec)">Loading accounts...</p>}>
          <SortableAccountList
            accounts={activeAccounts()}
            emptyMessage={archivedAccounts().length > 0 ? 'No active accounts.' : 'No accounts yet.'}
            onUpdate={accounts.update}
            onArchive={(account) => void runAccountAction(() => accounts.archive(account.id))}
            onReorder={(accountIds) => void runAccountAction(() => accounts.reorder(accountIds))}
          />
          <Show when={archivedAccounts().length > 0}>
            <ArchivedAccounts
              accounts={archivedAccounts()}
              onRestore={(account) => void runAccountAction(() => accounts.restore(account.id))}
            />
          </Show>
        </Loading>
      </Errored>
    </>
  );
}

import { useEffect, useRef, useState } from 'react';
import { MdAdd as AddIcon, MdRefresh as RefreshIcon } from 'react-icons/md';
import { Button } from '@/components/Button/Button.tsx';
import { ButtonGroup, type Option } from '@/components/ButtonGroup/ButtonGroup.tsx';
import { GridLayout } from '@/components/ContentLayout/GridLayout.tsx';
import { Section } from '@/components/Section/Section.tsx';
import { AccountSection } from '@/domain/finance/accounts/AccountSection.tsx';
import { useFinancialAccounts } from '@/domain/finance/accounts/data.ts';
import type { FinancialAccount, FinancialAccountStatus } from '@/domain/finance/accounts/model.ts';

const OPTION_ALL: Option = { id: 'all', text: 'All', style: { optionColor: 'var(--color-pri)' } };
const OPTION_ACTIVE: Option = { id: 'active', text: 'Active', style: { optionColor: 'var(--color-sem-positive)' } };
const OPTION_ARCHIVED: Option = { id: 'archived', text: 'Archived', style: { optionColor: 'var(--color-txt-sec)' } };
const STATUS_FILTER_OPTIONS: Option[] = [OPTION_ALL, OPTION_ACTIVE, OPTION_ARCHIVED];

type StatusFilterID = 'all' | FinancialAccountStatus;
type DraftSection = {
  id: string;
  account?: FinancialAccount;
};

function StatusFilterButton(props: { onChanged: (statusFilter: StatusFilterID) => void }) {
  return (
    <ButtonGroup
      options={STATUS_FILTER_OPTIONS}
      defaultValue={OPTION_ALL}
      onChanged={(option: Option) => props.onChanged(option.id as StatusFilterID)}
    />
  );
}

function PageActions({
  statusFilter,
  onAdd,
  onStatusFilterChanged,
  addDisabled,
}: {
  statusFilter: StatusFilterID;
  onAdd: () => void;
  onStatusFilterChanged: (statusFilter: StatusFilterID) => void;
  addDisabled: boolean;
}) {
  return (
    <div className="w-full pr-4 flex gap-2 justify-end">
      <StatusFilterButton onChanged={onStatusFilterChanged} />
      {statusFilter !== 'archived' && (
        <Button type="button" text="Add" icon={AddIcon} onClick={onAdd} disabled={addDisabled} />
      )}
    </div>
  );
}

export function AccountsPage() {
  const { data, error, loading, reload } = useFinancialAccounts();
  const [statusFilter, setStatusFilter] = useState<StatusFilterID>('all');
  const [drafts, setDrafts] = useState<DraftSection[]>([]);
  const [editingAccountIds, setEditingAccountIds] = useState<Set<string>>(new Set());
  const nextDraftId = useRef(0);

  useEffect(() => {
    if (!data) {
      return;
    }

    setDrafts((currentDrafts) =>
      currentDrafts.filter(
        (draft) => !draft.account || !data.accounts.some((account) => account.id === draft.account?.id),
      ),
    );
  }, [data]);

  const addDraft = () => {
    nextDraftId.current += 1;
    setDrafts((currentDrafts) => [{ id: `new-account-${nextDraftId.current}` }, ...currentDrafts]);
  };

  const updateEditingAccount = (id: string, isEditing: boolean) => {
    setEditingAccountIds((currentIds) => {
      const nextIds = new Set(currentIds);
      if (isEditing) {
        nextIds.add(id);
      } else {
        nextIds.delete(id);
      }
      return nextIds;
    });
  };

  const completeDraft = (draftId: string, account: FinancialAccount) => {
    setDrafts((currentDrafts) => currentDrafts.map((draft) => (draft.id === draftId ? { ...draft, account } : draft)));
    reload();
  };

  const visibleAccounts = (data?.accounts ?? [])
    .filter((account) => statusFilter === 'all' || account.status === statusFilter || editingAccountIds.has(account.id))
    .sort((left, right) => {
      const leftEditing = editingAccountIds.has(left.id);
      const rightEditing = editingAccountIds.has(right.id);
      if (leftEditing !== rightEditing) {
        return leftEditing ? -1 : 1;
      }
      return (
        left.displayOrder - right.displayOrder || left.name.localeCompare(right.name) || left.id.localeCompare(right.id)
      );
    });

  const isInitialLoading = loading && !data;

  return (
    <>
      <PageActions
        statusFilter={statusFilter}
        onAdd={addDraft}
        onStatusFilterChanged={setStatusFilter}
        addDisabled={!data}
      />
      {error && (
        <div className="mt-4 mr-4 flex items-center justify-between gap-3 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300">
          <span>{error.message}</span>
          <Button type="button" text="Retry" icon={RefreshIcon} onClick={reload} />
        </div>
      )}
      {isInitialLoading ? (
        <AccountsSkeleton />
      ) : (
        <GridLayout>
          {drafts.map((draft) => (
            <AccountSection
              key={draft.id}
              account={draft.account ?? null}
              onCreated={(account) => completeDraft(draft.id, account)}
              onDiscardDraft={() => setDrafts((currentDrafts) => currentDrafts.filter((item) => item.id !== draft.id))}
              onEditingChange={() => undefined}
              onSaved={reload}
              shouldFocusName={!draft.account}
            />
          ))}
          {visibleAccounts.map((account) => (
            <AccountSection
              key={account.id}
              account={account}
              onEditingChange={(isEditing) => updateEditingAccount(account.id, isEditing)}
              onSaved={reload}
            />
          ))}
        </GridLayout>
      )}
    </>
  );
}

function AccountsSkeleton() {
  return (
    <GridLayout>
      {Array.from({ length: 4 }, (_, index) => (
        <Section key={index} className="grid-section-lg">
          <div className="w-full flex items-center gap-4">
            <div className="h-12 aspect-square rounded bg-(--color-skeleton) animate-pulse" />
            <div className="grow flex flex-col gap-2">
              <div className="h-4 w-3/5 rounded bg-(--color-skeleton) animate-pulse" />
              <div className="h-3 w-2/5 rounded bg-(--color-skeleton) animate-pulse" />
            </div>
          </div>
        </Section>
      ))}
    </GridLayout>
  );
}

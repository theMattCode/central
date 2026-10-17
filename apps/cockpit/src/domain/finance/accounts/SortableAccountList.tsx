import { type ReactNode, useState } from 'react';
import {
  MdArchive as ArchiveIcon,
  MdDragIndicator as DragIcon,
  MdEdit as EditIcon,
  MdSave as SaveIcon,
} from 'react-icons/md';
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/Button/Button.tsx';
import { Section } from '@/components/Section/Section.tsx';
import { AccountEditor } from '@/domain/finance/accounts/AccountEditor.tsx';
import { AccountSummary } from '@/domain/finance/accounts/AccountSummary.tsx';
import { type FinancialAccount, type FinancialAccountInput, moveAccountId } from '@/domain/finance/accounts/model.ts';
import { cx } from '@/utils/styles.ts';

type Props = {
  accounts: FinancialAccount[];
  emptyMessage: string;
  onUpdate: (id: string, input: FinancialAccountInput) => Promise<void>;
  onArchive: (account: FinancialAccount) => void;
  onReorder: (accountIds: string[]) => void;
};

/** Active accounts, sortable by pointer, touch, or keyboard through each row's drag handle. */
export function SortableAccountList({ accounts, emptyMessage, onUpdate, onArchive, onReorder }: Props) {
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const sensors = useSensors(
    // A small distance keeps clicks on the handle from starting a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const accountIds = accounts.map((account) => account.id);

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) {
      onReorder(moveAccountId(accountIds, String(active.id), String(over.id)));
    }
  };

  if (accounts.length === 0) {
    return (
      <Section className="col-span-full">
        <p className="text-sm text-(--color-txt-sec)">{emptyMessage}</p>
      </Section>
    );
  }

  return (
    <Section className="col-span-full">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={accountIds} strategy={verticalListSortingStrategy}>
          <ul aria-label="Accounts" className="w-full flex flex-col divide-y divide-(--color-section-border)">
            {accounts.map((account) => (
              <SortableAccountItem key={account.id} account={account} editing={editingAccountId === account.id}>
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
              </SortableAccountItem>
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </Section>
  );
}

type SortableAccountItemProps = {
  account: FinancialAccount;
  editing: boolean;
  children: ReactNode;
};

function SortableAccountItem({ account, editing, children }: SortableAccountItemProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: account.id,
    disabled: editing,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cx(
        'flex flex-wrap items-center gap-3 py-2 bg-(--color-bg)',
        isDragging ? 'relative z-10 opacity-80' : undefined,
      )}
    >
      {!editing && (
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Reorder ${account.name}`}
          title="Drag to reorder"
          // touch-none lets a touch drag move the row instead of scrolling the page.
          className="touch-none cursor-grab active:cursor-grabbing rounded-md p-1 text-(--color-txt-sec) hover:text-(--color-pri)"
        >
          <DragIcon aria-hidden className="h-5 w-5" />
        </button>
      )}
      {children}
    </li>
  );
}

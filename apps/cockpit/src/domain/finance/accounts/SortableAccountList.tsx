import { createEffect, createSignal, For, onSettled, Show, untrack, type ParentProps } from 'solid-js';
import {
  MdFillArchive as ArchiveIcon,
  MdFillDrag_indicator as DragIcon,
  MdFillEdit as EditIcon,
  MdFillSave as SaveIcon,
} from 'solid-icons/md';
import { DragDropManager } from '@dnd-kit/dom';
import { isSortable, Sortable } from '@dnd-kit/dom/sortable';
import { effect } from '@dnd-kit/state';
import { Button } from '@/components/Button/Button.tsx';
import { Icon } from '@/components/Icon/Icon.tsx';
import { Section } from '@/components/Section/Section.tsx';
import { AccountEditor } from '@/domain/finance/accounts/AccountEditor.tsx';
import { AccountSummary } from '@/domain/finance/accounts/AccountSummary.tsx';
import { type FinancialAccount, type FinancialAccountInput, moveAccountId } from '@/domain/finance/accounts/model.ts';

type Props = {
  accounts: FinancialAccount[];
  emptyMessage: string;
  onUpdate: (id: string, input: FinancialAccountInput) => Promise<void>;
  onArchive: (account: FinancialAccount) => void;
  onReorder: (accountIds: string[]) => void;
};

/** Active accounts, sortable by pointer, touch, or keyboard through each row's drag handle. */
export function SortableAccountList(props: Props) {
  const [editingAccountId, setEditingAccountId] = createSignal<string | null>(null);
  const manager = createSortableManager((activeId, overIndex) => {
    const accountIds = props.accounts.map((account) => account.id);
    props.onReorder(moveAccountId(accountIds, activeId, accountIds[overIndex]));
  });

  return (
    <Show
      when={props.accounts.length > 0}
      fallback={
        <Section class="col-span-full">
          <p class="text-sm text-(--color-txt-sec)">{props.emptyMessage}</p>
        </Section>
      }
    >
      <Section class="col-span-full">
        <ul aria-label="Accounts" class="w-full flex flex-col divide-y divide-(--color-section-border)">
          <For each={props.accounts}>
            {(account, index) => (
              <SortableAccountItem
                manager={manager}
                account={account}
                index={index()}
                editing={editingAccountId() === account.id}
              >
                <Show
                  when={editingAccountId() === account.id}
                  fallback={
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
                        onClick={() => props.onArchive(account)}
                      />
                    </>
                  }
                >
                  <AccountEditor
                    label={`Edit ${account.name}`}
                    initialValue={account}
                    submitLabel="Save account"
                    submitText="Save"
                    submitIcon={SaveIcon}
                    onSubmit={async (input) => {
                      await props.onUpdate(account.id, input);
                      setEditingAccountId(null);
                    }}
                    onCancel={() => setEditingAccountId(null)}
                  />
                </Show>
              </SortableAccountItem>
            )}
          </For>
        </ul>
      </Section>
    </Show>
  );
}

/**
 * dnd-kit reorders the DOM nodes while dragging and settles the dropped node after its drop animation. Solid owns
 * those nodes, so once dnd-kit is done the dropped node is put back where it started, and `onDrop` reorders the data
 * so Solid moves it for real. A canceled drag is restored by dnd-kit itself.
 */
function createSortableManager(onDrop: (activeId: string, overIndex: number) => void): DragDropManager {
  const manager = new DragDropManager();
  let restoreSourcePosition: (() => void) | undefined;

  manager.monitor.addEventListener('beforedragstart', ({ operation }) => {
    const element = operation.source?.element;
    const previous = element?.previousElementSibling;
    const parent = element?.parentElement;
    restoreSourcePosition = () => {
      if (!element) return;
      if (previous) previous.after(element);
      else parent?.prepend(element);
    };
  });

  manager.monitor.addEventListener('dragend', ({ operation, canceled }) => {
    const restore = restoreSourcePosition;
    restoreSourcePosition = undefined;

    const { source } = operation;
    if (canceled || !isSortable(source) || source.initialIndex === source.index) return;
    const { id, index } = source;

    // dnd-kit marks the source idle right before it moves the node into place, so act a microtask later.
    const stopWaiting = effect(() => {
      if (source.status !== 'idle') return;
      queueMicrotask(() => {
        stopWaiting();
        restore?.();
        onDrop(String(id), index);
      });
    });
  });

  onSettled(() => () => manager.destroy());

  return manager;
}

type SortableAccountItemProps = ParentProps<{
  manager: DragDropManager;
  account: FinancialAccount;
  index: number;
  editing: boolean;
}>;

function SortableAccountItem(props: SortableAccountItemProps) {
  const sortable = new Sortable(
    untrack(() => ({ id: props.account.id, index: props.index, disabled: props.editing })),
    props.manager,
  );
  const [isDragging, setIsDragging] = createSignal(false);

  createEffect(
    () => [props.index, props.editing] as const,
    ([index, editing]) => {
      sortable.index = index;
      sortable.disabled = editing;
      if (props.manager.dragOperation.status.idle) sortable.refreshShape();
    },
  );

  onSettled(() => {
    const unsubscribe = [
      props.manager.monitor.addEventListener('dragstart', ({ operation }) =>
        setIsDragging(operation.source?.id === sortable.id),
      ),
      props.manager.monitor.addEventListener('dragend', () => setIsDragging(false)),
    ];

    return () => {
      unsubscribe.forEach((dispose) => dispose());
      sortable.destroy();
    };
  });

  return (
    <li
      ref={(element) => (sortable.element = element)}
      class={['flex flex-wrap items-center gap-3 py-2', { 'relative z-10 opacity-80 bg-(--color-bg)': isDragging() }]}
    >
      <Show when={!props.editing}>
        <button
          type="button"
          ref={(element) => (sortable.handle = element)}
          aria-label={`Reorder ${props.account.name}`}
          title="Drag to reorder"
          // touch-none lets a touch drag move the row instead of scrolling the page.
          class="touch-none cursor-grab active:cursor-grabbing rounded-md p-1 text-(--color-txt-sec) hover:text-(--color-pri)"
        >
          <Icon icon={DragIcon} class="h-5 w-5" />
        </button>
      </Show>
      {props.children}
    </li>
  );
}

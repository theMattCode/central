import { createSignal, For, Show } from 'solid-js';
import {
  MdFillExpand_less as CollapseIcon,
  MdFillExpand_more as ExpandIcon,
  MdFillUnarchive as RestoreIcon,
} from 'solid-icons/md';
import { Button } from '@/components/Button/Button.tsx';
import { Icon } from '@/components/Icon/Icon.tsx';
import { Section } from '@/components/Section/Section.tsx';
import { AccountSummary } from '@/domain/finance/accounts/AccountSummary.tsx';
import type { FinancialAccount } from '@/domain/finance/accounts/model.ts';

type Props = {
  accounts: FinancialAccount[];
  onRestore: (account: FinancialAccount) => void;
};

/** Archived accounts stay visible for reference but can only be restored. Collapsed by default. */
export function ArchivedAccounts(props: Props) {
  const [expanded, setExpanded] = createSignal(false);

  return (
    <Section class="col-span-full">
      <button
        type="button"
        aria-expanded={expanded() ? 'true' : 'false'}
        class="w-full flex items-center justify-between text-sm text-(--color-txt-sec)"
        onClick={() => setExpanded((value) => !value)}
      >
        <span>Archived ({props.accounts.length})</span>
        <Icon icon={expanded() ? CollapseIcon : ExpandIcon} class="h-5 w-5" />
      </button>
      <Show when={expanded()}>
        <ul aria-label="Archived accounts" class="w-full flex flex-col divide-y divide-(--color-section-border)">
          <For each={props.accounts}>
            {(account) => (
              <li class="flex items-center gap-3 py-2 opacity-70">
                <AccountSummary account={account} />
                <Button
                  type="button"
                  aria-label={`Restore ${account.name}`}
                  title="Restore"
                  icon={RestoreIcon}
                  onClick={() => props.onRestore(account)}
                />
              </li>
            )}
          </For>
        </ul>
      </Show>
    </Section>
  );
}
